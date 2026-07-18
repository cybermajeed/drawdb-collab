export const MESSAGE_TYPES = Object.freeze({
  JOIN: "join",
  JOINED: "joined",
  OPERATION: "operation",
  OPERATION_APPLIED: "operation_applied",
  SNAPSHOT: "snapshot",
  RESYNC_REQUIRED: "resync_required",
  PRESENCE: "presence",
  CURSOR: "cursor",
  ERROR: "error",
  PING: "ping",
  PONG: "pong",
});

export const DIAGRAM_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;
export const CLIENT_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

export function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isValidParticipant(participant) {
  return (
    isPlainObject(participant) &&
    CLIENT_ID_PATTERN.test(participant.clientId || "") &&
    typeof participant.displayName === "string" &&
    participant.displayName.length > 0 &&
    participant.displayName.length <= 64 &&
    typeof participant.color === "string" &&
    participant.color.length <= 32
  );
}
