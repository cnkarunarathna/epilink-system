"use client";

import React, { useState } from "react";
import { Check, CheckCheck, Clock, FileText, Smile } from "lucide-react";
import { cn } from "@/lib/utils";
import { MessageResponseDto } from "@/services/chat.service";

const ALLOWED_EMOJIS = ["👍", "✅", "👀", "❤️", "😊", "🙏"] as const;

interface MessageBubbleProps {
  message: MessageResponseDto;
  isOwn: boolean;
  showSenderName: boolean;
  currentUserId: string;
  onReact?: (messageId: string, emoji: string) => void;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Colombo",
  });
}

/** Group reactions by emoji and count them. */
function groupReactions(reactions: MessageResponseDto["reactions"]) {
  const map = new Map<string, { count: number; userIds: string[] }>();
  for (const r of reactions) {
    const entry = map.get(r.emoji) ?? { count: 0, userIds: [] };
    entry.count += 1;
    entry.userIds.push(r.userId);
    map.set(r.emoji, entry);
  }
  return Array.from(map.entries()).map(([emoji, { count, userIds }]) => ({
    emoji,
    count,
    userIds,
  }));
}

export function MessageBubble({
  message,
  isOwn,
  showSenderName,
  currentUserId,
  onReact,
}: MessageBubbleProps) {
  const [showPicker, setShowPicker] = useState(false);

  const initials = message.sender.name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  // System messages — centred, no bubble
  if (message.isSystemMessage) {
    return (
      <div className="flex justify-center my-2">
        <span className="rounded-full bg-muted px-3 py-0.5 text-xs italic text-muted-foreground">
          {message.content}
        </span>
      </div>
    );
  }

  const isPending = message.id.startsWith("opt_");
  const readByOthers =
    !isPending && message.readBy.some((r) => r.userId !== currentUserId);
  const groupedReactions = groupReactions(message.reactions ?? []);

  const handleReact = (emoji: string) => {
    onReact?.(message.id, emoji);
    setShowPicker(false);
  };

  return (
    <div
      className={cn(
        "group flex flex-col gap-1",
        isOwn ? "items-end" : "items-start",
        isPending && "opacity-60",
      )}
    >
      {/* Bubble + reaction picker trigger */}
      <div
        className={cn(
          "flex items-end gap-2",
          isOwn ? "flex-row-reverse" : "flex-row",
        )}
      >
        {!isOwn && (
          <div
            className={cn(
              "mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
              "bg-background text-muted-foreground",
              !showSenderName && "opacity-0",
            )}
            aria-hidden
          >
            {initials || "U"}
          </div>
        )}

        {/* Bubble */}
        <div
          className={cn(
            "relative max-w-[78%] rounded-2xl border px-3 py-2 text-sm shadow-sm",
            isOwn
              ? "rounded-br-sm border-primary/25 bg-linear-to-br from-primary to-primary/90 text-primary-foreground"
              : "rounded-bl-sm border-border/75 bg-background text-foreground",
          )}
        >
          {showSenderName && !isOwn && (
            <span className="mb-0.5 block text-[11px] font-semibold text-muted-foreground">
              {message.sender.name}
            </span>
          )}

          {/* Text content */}
          {message.content && (
            <p className="whitespace-pre-wrap wrap-break-word">
              {message.content}
            </p>
          )}

          {/* Attachment */}
          {message.attachmentUrl && (
            <div className="mt-1">
              {message.attachmentType === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={message.attachmentUrl}
                  alt="attachment"
                  className="max-h-48 max-w-full rounded-lg border border-black/10 object-contain"
                />
              ) : (
                <a
                  href={message.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:underline",
                    isOwn
                      ? "border-primary-foreground/30 text-primary-foreground"
                      : "border-border",
                  )}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Document</span>
                </a>
              )}
            </div>
          )}

          {/* Timestamp + read receipt */}
          <div
            className={cn(
              "mt-1 flex items-center gap-1 text-[10px]",
              isOwn
                ? "justify-end text-primary-foreground/60"
                : "text-muted-foreground",
            )}
          >
            <span>{formatTime(message.createdAt)}</span>
            {isOwn &&
              (isPending ? (
                <Clock className="h-3 w-3 animate-pulse" />
              ) : readByOthers ? (
                <>
                  <CheckCheck className="h-3 w-3" />
                  <span className="font-medium">Read</span>
                </>
              ) : (
                <Check className="h-3 w-3" />
              ))}
          </div>
        </div>

        {/* Reaction trigger button — visible on group hover */}
        {onReact && (
          <div className="relative">
            <button
              onClick={() => setShowPicker((v) => !v)}
              className="mb-1 flex h-6 w-6 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground opacity-100 transition-opacity hover:bg-muted md:opacity-0 md:group-hover:opacity-100"
              aria-label="React"
            >
              <Smile className="h-3.5 w-3.5" />
            </button>

            {/* Emoji picker popover */}
            {showPicker && (
              <>
                {/* Backdrop to close */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowPicker(false)}
                />
                <div
                  className={cn(
                    "absolute bottom-8 z-20 flex gap-1 rounded-full border bg-background px-2 py-1 shadow-md",
                    isOwn ? "right-0" : "left-0",
                  )}
                >
                  {ALLOWED_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleReact(emoji)}
                      className="rounded-full p-0.5 text-base hover:bg-muted transition-colors"
                      title={emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Reaction chips */}
      {groupedReactions.length > 0 && (
        <div
          className={cn(
            "flex flex-wrap gap-1 px-1",
            isOwn ? "justify-end" : "justify-start",
          )}
        >
          {groupedReactions.map(({ emoji, count, userIds }) => {
            const iReacted = userIds.includes(currentUserId);
            return (
              <button
                key={emoji}
                onClick={() => onReact?.(message.id, emoji)}
                className={cn(
                  "flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs transition-colors",
                  iReacted
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-muted/60 text-foreground hover:bg-muted",
                )}
              >
                <span>{emoji}</span>
                <span className="font-medium">{count}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
