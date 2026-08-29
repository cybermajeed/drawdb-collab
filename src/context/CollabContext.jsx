import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { nanoid } from "nanoid";
import { CONNECTION_STATE } from "../collaboration/protocol";
import { supabase } from "../lib/supabase";
import { diagramApi } from "../api/diagrams";

export const COLORS = [
  "#2563eb", // blue
  "#dc2626", // red
  "#16a34a", // green
  "#9333ea", // purple
  "#ea580c", // orange
  "#0d9488", // teal
  "#db2777", // pink
  "#ca8a04", // yellow
  "#4f46e5", // indigo
  "#0891b2", // cyan
];

function getIdentity() {
  const stored = localStorage.getItem("drawdb-collaboration-identity");
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      localStorage.removeItem("drawdb-collaboration-identity");
    }
  }

  let name = window.prompt("Welcome to Collaboration! Please enter your name:");
  if (!name || name.trim() === "") {
    const suffix = Math.floor(Math.random() * 900 + 100);
    name = `Guest ${suffix}`;
  } else {
    name = name.trim();
  }

  const identity = {
    clientId: nanoid(),
    displayName: name,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
  localStorage.setItem(
    "drawdb-collaboration-identity",
    JSON.stringify(identity),
  );
  return identity;
}

export const CollabContext = createContext(null);

export default function CollabContextProvider({ children }) {
  const identityRef = useRef(getIdentity());
  const channelRef = useRef(null);
  const sessionRef = useRef(null);
  const versionRef = useRef(0);
  const isApplyingRemoteRef = useRef(false);
  const cursorSentAtRef = useRef(0);
  const previewThrottleRef = useRef(new Map());

  // Supabase Presence doesn't have an explicit table lock service,
  // so we'll store our locks in our presence state and aggregate.
  const heldLocksRef = useRef(new Set());
  const retainedLocksRef = useRef(new Map());

  const [connectionState, setConnectionState] = useState(
    CONNECTION_STATE.DISCONNECTED,
  );
  const [participants, setParticipants] = useState([]);
  const [remoteCursors, setRemoteCursors] = useState({});
  const [tableLocks, setTableLocks] = useState({});

  const trackPresence = useCallback(() => {
    if (channelRef.current && connectionState === CONNECTION_STATE.CONNECTED) {
      channelRef.current.track({
        clientId: identityRef.current.clientId,
        displayName: identityRef.current.displayName,
        color: identityRef.current.color,
        lockedTables: Array.from(heldLocksRef.current),
      });
    }
  }, [connectionState]);

  const connect = useCallback(({ diagramId, version, onSnapshot, onDelta }) => {
    if (sessionRef.current?.diagramId === diagramId) {
      sessionRef.current.onSnapshot = onSnapshot;
      sessionRef.current.onDelta = onDelta;
      versionRef.current = version;
      return;
    }

    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }

    sessionRef.current = { diagramId, onSnapshot, onDelta };
    versionRef.current = version;
    setRemoteCursors({});
    setTableLocks({});
    setParticipants([]);
    heldLocksRef.current.clear();
    retainedLocksRef.current.clear();

    setConnectionState(CONNECTION_STATE.CONNECTING);

    const channel = supabase.channel(`diagrams:${diagramId}`, {
      config: {
        presence: {
          key: identityRef.current.clientId,
        },
      },
    });
    channelRef.current = channel;

    // Listen to broadcast operations (previews)
    channel.on("broadcast", { event: "OPERATION_PREVIEW" }, (payload) => {
      if (payload.payload.clientId !== identityRef.current.clientId) {
        sessionRef.current?.onDelta?.(payload.payload.operation);
      }
    });

    // Listen to awareness (cursors)
    channel.on("broadcast", { event: "CURSOR" }, (payload) => {
      if (payload.payload.clientId !== identityRef.current.clientId) {
        setRemoteCursors((current) => ({
          ...current,
          [payload.payload.clientId]: {
            x: payload.payload.x,
            y: payload.payload.y,
            selected: payload.payload.selected,
          },
        }));
      }
    });

    // Listen to presence
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const nextParticipants = [];
      const nextLocks = {};

      for (const [, presences] of Object.entries(state)) {
        if (!presences || presences.length === 0) continue;
        // We only care about the most recent presence for a given client
        const p = presences[0];

        if (p.clientId !== identityRef.current.clientId) {
          nextParticipants.push({
            clientId: p.clientId,
            displayName: p.displayName,
            color: p.color,
          });
        }

        // Aggregate table locks
        if (Array.isArray(p.lockedTables)) {
          p.lockedTables.forEach((tableId) => {
            nextLocks[tableId] = {
              tableId,
              clientId: p.clientId,
              displayName: p.displayName,
              color: p.color,
              token: 1, // Dummy token
            };
          });
        }
      }
      setParticipants(nextParticipants);
      setTableLocks(nextLocks);
    });

    // Listen to explicit snapshot broadcasts to avoid large postgres_changes payloads
    channel.on("broadcast", { event: "SNAPSHOT_SAVED" }, async (payload) => {
      const newVersion = payload.payload.version;
      if (newVersion > versionRef.current) {
        try {
          const row = await diagramApi.get(diagramId);
          if (row.version > versionRef.current) {
            versionRef.current = row.version;
            sessionRef.current?.onSnapshot?.({
              name: row.name,
              document: row.document,
              version: row.version,
            });
          }
        } catch (e) {
          console.error("Failed to fetch latest snapshot after broadcast:", e);
        }
      }
    });

    channel.subscribe(async (status) => {
      if (channelRef.current !== channel) return;

      if (status === "SUBSCRIBED") {
        setConnectionState(CONNECTION_STATE.CONNECTED);
        if (sessionRef.current) {
          sessionRef.current.retryDelay = 1500;
        }
        channel.track({
          clientId: identityRef.current.clientId,
          displayName: identityRef.current.displayName,
          color: identityRef.current.color,
          lockedTables: Array.from(heldLocksRef.current),
        });
      } else if (
        status === "CLOSED" ||
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT"
      ) {
        setConnectionState(CONNECTION_STATE.DISCONNECTED);
        if (sessionRef.current) {
          // Exponential backoff: start at 3s, max at 30s
          const backoff = Math.min(
            30000,
            (sessionRef.current.retryDelay || 1500) * 2,
          );
          sessionRef.current.retryDelay = backoff;

          window.setTimeout(() => {
            if (sessionRef.current) {
              const session = { ...sessionRef.current };
              sessionRef.current = null;
              connect({ ...session, version: versionRef.current });
            }
          }, backoff);
        }
      }
    });
  }, []);

  const disconnect = useCallback(() => {
    sessionRef.current = null;
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    setConnectionState(CONNECTION_STATE.DISCONNECTED);
    setParticipants([]);
    setRemoteCursors({});
    setTableLocks({});

    for (const preview of previewThrottleRef.current.values()) {
      window.clearTimeout(preview.timer);
    }
    previewThrottleRef.current.clear();

    heldLocksRef.current.clear();
    retainedLocksRef.current.clear();
  }, []);

  const sendSnapshot = useCallback(async (name, document) => {
    const session = sessionRef.current;
    if (!session) {
      throw new Error("Collaboration connection is unavailable");
    }
    const currentVersion = versionRef.current;
    try {
      const updated = await diagramApi.update(session.diagramId, {
        name,
        document,
        baseVersion: currentVersion,
      });
      versionRef.current = updated.version;
      
      if (channelRef.current && connectionState === CONNECTION_STATE.CONNECTED) {
        channelRef.current.send({
          type: "broadcast",
          event: "SNAPSHOT_SAVED",
          payload: { version: updated.version },
        });
      }
      
      return updated;
    } catch (e) {
      if (e.status === 409) {
        // Resync required
        versionRef.current = e.diagram.version;
        sessionRef.current?.onSnapshot?.(e.diagram);
        throw new Error(
          "Version conflict, diagram was updated by someone else.",
        );
      }
      throw e;
    }
  }, []);

  const emitAwareness = useCallback(
    (awareness) => {
      const now = Date.now();
      if (now - cursorSentAtRef.current < 150) return;
      if (!channelRef.current || connectionState !== CONNECTION_STATE.CONNECTED)
        return;
      if (!Number.isFinite(awareness.x) || !Number.isFinite(awareness.y))
        return;

      cursorSentAtRef.current = now;
      channelRef.current.send({
        type: "broadcast",
        event: "CURSOR",
        payload: {
          clientId: identityRef.current.clientId,
          x: awareness.x,
          y: awareness.y,
          selected: awareness.selected ?? null,
        },
      });
    },
    [connectionState],
  );

  const emitDelta = useCallback(
    (delta) => {
      if (
        delta?.target !== "table" ||
        delta.action !== "update" ||
        delta.data?.length !== 2
      ) {
        return;
      }
      const [id, values] = delta.data;
      if (!Number.isFinite(values?.x) || !Number.isFinite(values?.y)) return;

      const sendPreview = (payload) => {
        if (
          !channelRef.current ||
          connectionState !== CONNECTION_STATE.CONNECTED
        )
          return;
        channelRef.current.send({
          type: "broadcast",
          event: "OPERATION_PREVIEW",
          payload: {
            clientId: identityRef.current.clientId,
            operation: { type: "table.move", payload },
          },
        });
      };

      const now = Date.now();
      const current = previewThrottleRef.current.get(id) ?? {
        lastSent: 0,
        timer: null,
        payload: null,
      };
      current.payload = { id, x: values.x, y: values.y };
      const remaining = 150 - (now - current.lastSent);
      if (remaining <= 0) {
        window.clearTimeout(current.timer);
        current.timer = null;
        current.lastSent = now;
        sendPreview(current.payload);
      } else if (current.timer === null) {
        current.timer = window.setTimeout(() => {
          current.timer = null;
          current.lastSent = Date.now();
          sendPreview(current.payload);
        }, remaining);
      }
      previewThrottleRef.current.set(id, current);
    },
    [connectionState],
  );

  const acquireTableLock = useCallback(
    (tableId) => {
      if (heldLocksRef.current.has(tableId)) return Promise.resolve(true);
      // Wait for tableLocks state
      const lock = tableLocks[tableId];
      if (lock && lock.clientId !== identityRef.current.clientId) {
        return Promise.resolve(false);
      }

      heldLocksRef.current.add(tableId);
      trackPresence();
      return Promise.resolve(true);
    },
    [tableLocks, trackPresence],
  );

  const acquireTableLocks = useCallback(
    async (tableIds) => {
      let success = true;
      const newlyAcquired = [];
      for (const tableId of [...new Set(tableIds)]) {
        if (await acquireTableLock(tableId)) {
          newlyAcquired.push(tableId);
        } else {
          success = false;
          break;
        }
      }
      if (!success) {
        newlyAcquired.forEach((id) => heldLocksRef.current.delete(id));
        if (newlyAcquired.length > 0) trackPresence();
      }
      return success;
    },
    [acquireTableLock, trackPresence],
  );

  const releaseTableLocks = useCallback(
    (tableIds) => {
      let changed = false;
      for (const tableId of [...new Set(tableIds)]) {
        if ((retainedLocksRef.current.get(tableId) ?? 0) > 0) continue;
        if (heldLocksRef.current.has(tableId)) {
          heldLocksRef.current.delete(tableId);
          changed = true;
        }
      }
      if (changed) trackPresence();
    },
    [trackPresence],
  );

  const retainTableLock = useCallback((tableId) => {
    retainedLocksRef.current.set(
      tableId,
      (retainedLocksRef.current.get(tableId) ?? 0) + 1,
    );
  }, []);

  const releaseTableLockRetention = useCallback((tableId) => {
    const count = retainedLocksRef.current.get(tableId) ?? 0;
    if (count <= 1) retainedLocksRef.current.delete(tableId);
    else retainedLocksRef.current.set(tableId, count - 1);
  }, []);

  const isTableLockedByOther = useCallback(
    (tableId) => {
      const lock = tableLocks[tableId];
      return Boolean(lock && lock.clientId !== identityRef.current.clientId);
    },
    [tableLocks],
  );

  const hasTableLock = useCallback(
    (tableId) => heldLocksRef.current.has(tableId),
    [],
  );

  const updateIdentity = useCallback(
    (displayName, color) => {
      const identity = {
        ...identityRef.current,
        displayName,
        color,
      };
      identityRef.current = identity;
      localStorage.setItem(
        "drawdb-collaboration-identity",
        JSON.stringify(identity),
      );
      trackPresence();
    },
    [trackPresence],
  );

  useEffect(() => disconnect, [disconnect]);

  const value = useMemo(
    () => ({
      connect,
      disconnect,
      sendSnapshot,
      connectionState,
      participants,
      remoteCursors,
      tableLocks,
      identity: identityRef.current,
      updateIdentity,
      versionRef,
      emitDelta,
      emitAwareness,
      acquireTableLock,
      acquireTableLocks,
      releaseTableLocks,
      retainTableLock,
      releaseTableLockRetention,
      isTableLockedByOther,
      hasTableLock,
      isApplyingRemoteRef,
    }),
    [
      connect,
      acquireTableLock,
      acquireTableLocks,
      connectionState,
      disconnect,
      emitDelta,
      emitAwareness,
      hasTableLock,
      isTableLockedByOther,
      participants,
      remoteCursors,
      releaseTableLockRetention,
      releaseTableLocks,
      retainTableLock,
      sendSnapshot,
      tableLocks,
      updateIdentity,
    ],
  );
  return (
    <CollabContext.Provider value={value}>{children}</CollabContext.Provider>
  );
}
