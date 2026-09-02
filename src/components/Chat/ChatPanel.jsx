import { useState, useRef, useEffect } from "react";
import { Button, Input, Avatar, Tooltip } from "@douyinfe/semi-ui";
import { IconSend, IconClose } from "@douyinfe/semi-icons";
import { useCollab, useLayout, useSettings } from "../../hooks";

export default function ChatPanel() {
  const { chatMessages, sendChatMessage, identity } = useCollab();
  const { setLayout } = useLayout();
  const { settings } = useSettings();
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef(null);

  const handleSend = () => {
    if (inputValue.trim()) {
      sendChatMessage(inputValue.trim());
      setInputValue("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  return (
    <div
      className={`flex flex-col h-full border-l border-color ${settings.mode === "dark" ? "bg-[#1f2023]" : "bg-white"}`}
      style={{ width: "350px", minWidth: "350px" }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-color">
        <h2 className="text-lg font-semibold m-0">Chat</h2>
        <Button
          type="tertiary"
          icon={<IconClose />}
          onClick={() => setLayout((prev) => ({ ...prev, chat: false }))}
        />
      </div>

      <div
        className="flex-1 overflow-y-auto p-4 space-y-4"
        ref={scrollRef}
      >
        {chatMessages?.length === 0 ? (
          <div className="text-center text-gray-500 text-sm mt-10">
            No messages yet. Start the conversation!
          </div>
        ) : (
          chatMessages?.map((msg) => {
            const isSelf = msg.clientId === identity?.clientId;
            return (
              <div
                key={msg.id}
                className={`flex w-full ${isSelf ? "justify-end" : "justify-start"}`}
              >
                {!isSelf && (
                  <Tooltip content={msg.displayName}>
                    <Avatar
                      size="small"
                      color="blue"
                      style={{
                        backgroundColor: msg.color,
                        marginRight: "8px",
                        flexShrink: 0,
                      }}
                    >
                      {msg.displayName.charAt(0).toUpperCase()}
                    </Avatar>
                  </Tooltip>
                )}
                <div
                  className={`px-3 py-2 rounded-lg max-w-[75%] break-words text-sm shadow-sm ${
                    isSelf
                      ? "bg-blue-600 text-white rounded-tr-sm"
                      : `${settings.mode === "dark" ? "bg-zinc-800" : "bg-gray-100"} rounded-tl-sm`
                  }`}
                >
                  {isSelf && (
                    <div className="text-xs opacity-70 mb-1 text-right">You</div>
                  )}
                  {!isSelf && (
                    <div className="text-xs opacity-70 mb-1" style={{ color: msg.color }}>
                      {msg.displayName}
                    </div>
                  )}
                  <div>{msg.text}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-3 border-t border-color flex gap-2">
        <Input
          placeholder="Type a message..."
          value={inputValue}
          onChange={(v) => setInputValue(v)}
          onKeyDown={handleKeyDown}
          className="flex-1"
        />
        <Button
          theme="solid"
          type="primary"
          icon={<IconSend />}
          onClick={handleSend}
          disabled={!inputValue.trim()}
        />
      </div>
    </div>
  );
}
