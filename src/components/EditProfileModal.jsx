import React, { useState, useEffect } from "react";
import { Modal, Input, Toast } from "@douyinfe/semi-ui";
import { useCollab } from "../hooks/useCollab";
import { COLORS } from "../context/CollabContext";
import { useTranslation } from "react-i18next";

export default function EditProfileModal({ visible, onCancel }) {
  const { identity, updateIdentity, participants } = useCollab();
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [color, setColor] = useState("");

  useEffect(() => {
    if (visible && identity) {
      setName(identity.displayName || "");
      setColor(identity.color || COLORS[0]);
    }
  }, [visible, identity]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Toast.error("Name cannot be empty");
      return;
    }
    // Unique check
    const isTaken = participants.some(
      (p) =>
        p.displayName.toLowerCase() === trimmed.toLowerCase() &&
        p.clientId !== identity.clientId
    );
    if (isTaken) {
      Toast.error("This username is already taken in the current session.");
      return;
    }

    updateIdentity(trimmed, color);
    onCancel();
    Toast.success("Profile updated successfully");
  };

  return (
    <Modal
      title="Edit Profile"
      visible={visible}
      onOk={handleSave}
      onCancel={onCancel}
      width={360}
      okText="Save"
      cancelText="Cancel"
    >
      <div className="mb-4">
        <div className="text-sm font-semibold mb-2">Username</div>
        <Input
          value={name}
          onChange={setName}
          maxLength={20}
          placeholder="Enter your name"
        />
      </div>
      <div>
        <div className="text-sm font-semibold mb-2">Cursor Color</div>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <div
              key={c}
              onClick={() => setColor(c)}
              className={`w-8 h-8 rounded-full cursor-pointer border-2 transition-all ${
                color === c
                  ? "border-zinc-800 dark:border-zinc-200 scale-110"
                  : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
}
