import { useTranslation } from "react-i18next";
import { Tooltip } from "@douyinfe/semi-ui";
import { useCollab } from "../hooks";

export default function OnlineStatus({ isDiagram, loadedDiagramId, setEditProfileVisible }) {
  const { t } = useTranslation();
  const { connectionState, participants, identity } = useCollab();

  if (!isDiagram || !loadedDiagramId) return null;

  return (
    <div className="z-40 flex items-center gap-2.5 rounded-full border border-zinc-200/80 bg-white/70 px-3.5 py-1.5 text-xs font-medium text-zinc-800 shadow-sm backdrop-blur-md transition-all duration-300 dark:border-zinc-700/80 dark:bg-zinc-900/70 dark:text-zinc-100">
      <div className="relative flex h-2.5 w-2.5 items-center justify-center">
        {connectionState === "connecting" && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
        )}
        <span
          className={`relative inline-flex h-2.5 w-2.5 rounded-full transition-colors duration-300 ${
            connectionState === "connected"
              ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
              : connectionState === "connecting"
                ? "bg-amber-500"
                : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"
          }`}
        />
      </div>
      <span className="capitalize tracking-wide">
        {t(`collaboration_${connectionState}`, connectionState)}
      </span>
      {participants.length > 0 && (
        <>
          <div className="h-3.5 w-px bg-zinc-300 dark:bg-zinc-700" />
          <Tooltip
            position="bottomRight"
            content={
              <div className="flex flex-col gap-2 p-1 min-w-[120px]">
                <div className="font-semibold text-xs border-b border-zinc-200 dark:border-zinc-700 pb-1 mb-1 text-zinc-500 dark:text-zinc-400">
                  Online Users
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-3.5 h-3.5 rounded-full border border-black/10 dark:border-white/10 shadow-sm"
                    style={{ backgroundColor: identity?.color }}
                  />
                  <span className="font-medium">{identity?.displayName} (You)</span>
                </div>
                {participants.map((p) => (
                  <div
                    key={p.clientId}
                    className="flex items-center gap-2"
                  >
                    <div
                      className="w-3.5 h-3.5 rounded-full border border-black/10 dark:border-white/10 shadow-sm"
                      style={{ backgroundColor: p.color }}
                    />
                    <span>{p.displayName}</span>
                  </div>
                ))}
              </div>
            }
          >
            <div className="flex items-center -space-x-1 cursor-pointer hover:opacity-80 transition-opacity">
              <div
                className="w-5 h-5 rounded-full border-2 border-white dark:border-zinc-800 z-10 shadow-sm"
                style={{ backgroundColor: identity?.color }}
                title={`${identity?.displayName} (You)`}
              />
              {participants.slice(0, 3).map((p, i) => (
                <div
                  key={p.clientId}
                  className="w-5 h-5 rounded-full border-2 border-white dark:border-zinc-800 shadow-sm"
                  style={{ backgroundColor: p.color, zIndex: 9 - i }}
                  title={p.displayName}
                />
              ))}
              {participants.length > 3 && (
                <div className="flex w-5 h-5 items-center justify-center rounded-full border-2 border-white bg-zinc-100 text-[10px] font-bold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 z-0">
                  +{participants.length - 3}
                </div>
              )}
            </div>
          </Tooltip>
        </>
      )}
      {connectionState === "connected" && (
        <button
          onClick={() => setEditProfileVisible(true)}
          className="ml-1 text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100 transition-colors"
          title="Edit Profile"
        >
          <i className="fa-solid fa-pen-to-square"></i>
        </button>
      )}
    </div>
  );
}
