"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AttachmentPicker } from "./AttachmentPicker";

const MAX_CHARS = 2000;

interface PendingAttachment {
  url: string;
  type: "image" | "document";
}

interface MessageInputProps {
  onSend: (
    content: string,
    attachment?: { url: string; type: "image" | "document" },
  ) => Promise<void>;
  onTyping: (isTyping: boolean) => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, onTyping, disabled }: MessageInputProps) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  // Auto-grow textarea up to ~4 lines
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`; // 4 × 28px line-height
  }, [value]);

  const stopTyping = useCallback(() => {
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTyping(false);
    }
    if (typingTimer.current) {
      clearTimeout(typingTimer.current);
      typingTimer.current = null;
    }
  }, [onTyping]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    if (next.length > MAX_CHARS) return;
    setValue(next);

    // Typing indicator — emit start, then debounce stop after 1 s
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      onTyping(true);
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(stopTyping, 1000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    const trimmed = value.trim();
    if ((!trimmed && !attachment) || sending || disabled) return;

    stopTyping();
    setSending(true);
    try {
      await onSend(trimmed, attachment ?? undefined);
      setValue("");
      setAttachment(null);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  // Cleanup on unmount
  useEffect(() => () => stopTyping(), [stopTyping]);

  const charCount = value.length;
  const nearLimit = charCount > MAX_CHARS * 0.9;
  const canSend = (value.trim().length > 0 || attachment !== null) && !disabled;

  return (
    <div className="border-t bg-background px-3 py-2">
      <div className="flex items-end gap-2 rounded-xl border bg-muted/50 px-2 py-1.5 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/50">
        {/* Attachment picker */}
        <AttachmentPicker
          disabled={disabled || sending}
          onAttached={(a) => setAttachment(a)}
        />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "Chat is read-only for closed tasks." : "Type a message…"}
          disabled={disabled || sending}
          className={cn(
            "flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
            "py-1 leading-7",
          )}
        />

        {/* Send button */}
        <Button
          type="button"
          size="icon"
          className="h-8 w-8 shrink-0"
          disabled={!canSend || sending}
          onClick={handleSend}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {/* Character counter */}
      {nearLimit && (
        <p className={cn("mt-0.5 text-right text-[10px]", charCount >= MAX_CHARS ? "text-destructive" : "text-muted-foreground")}>
          {charCount}/{MAX_CHARS}
        </p>
      )}
    </div>
  );
}
