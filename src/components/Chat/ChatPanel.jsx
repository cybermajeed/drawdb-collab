import { useState, useRef, useEffect } from "react";
import { Button, Input, Avatar, Tooltip, Image } from "@douyinfe/semi-ui";
import { IconSend, IconClose, IconImage } from "@douyinfe/semi-icons";
import { useCollab, useLayout, useSettings } from "../../hooks";

export default function ChatPanel() {
  const { chatMessages, sendChatMessage, identity } = useCollab();
  const { setLayout } = useLayout();
  const { settings } = useSettings();
  const [inputValue, setInputValue] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target.result);
      };
      reader.readAsDataURL(file);
    }
    // reset input so the same file can be selected again
    e.target.value = null;
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf("image") !== -1) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            setSelectedImage(ev.target.result);
          };
          reader.readAsDataURL(file);
          e.preventDefault();
          break;
        }
      }
    }
  };

  const handleSend = () => {
    if (inputValue.trim() || selectedImage) {
      sendChatMessage(inputValue.trim(), selectedImage);
      setInputValue("");
      setSelectedImage(null);
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

      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
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
                    <div className="text-xs opacity-70 mb-1 text-right">
                      You
                    </div>
                  )}
                  {!isSelf && (
                    <div
                      className="text-xs opacity-70 mb-1"
                      style={{ color: msg.color }}
                    >
                      {msg.displayName}
                    </div>
                  )}
                  {msg.image && (
                    <Image 
                      src={msg.image} 
                      alt="Attachment" 
                      className="max-w-full rounded-md mb-2 border border-black/10 dark:border-white/10 cursor-pointer hover:opacity-90 transition-opacity" 
                    />
                  )}
                  {msg.text && <div>{msg.text}</div>}
                </div>
              </div>
            );
          })
        )}
      </div>

      {selectedImage && (
        <div className="px-3 pt-3 pb-1 border-t border-color relative bg-black/5 dark:bg-white/5">
          <div className="relative inline-block">
            <img
              src={selectedImage}
              alt="Preview"
              className="h-20 rounded-md border border-black/20 dark:border-white/20 object-cover"
            />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-2 -right-2 bg-zinc-800 text-white rounded-full p-1 shadow-md hover:bg-zinc-700 transition-colors"
            >
              <IconClose size="small" />
            </button>
          </div>
        </div>
      )}

      <div className="p-3 border-t border-color flex gap-2 items-end">
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleImageSelect}
          style={{ display: "none" }}
        />
        <Button
          type="tertiary"
          icon={<IconImage />}
          onClick={() => fileInputRef.current?.click()}
        />
        <Input
          placeholder="Type a message..."
          value={inputValue}
          onChange={(v) => setInputValue(v)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          className="flex-1"
        />
        <Button
          theme="solid"
          type="primary"
          icon={<IconSend />}
          onClick={handleSend}
          disabled={!inputValue.trim() && !selectedImage}
        />
      </div>
    </div>
  );
}
