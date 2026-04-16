"use client";

import React from "react";
import { Check, CheckCheck, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { MessageResponseDto } from "@/services/chat.service";

interface MessageBubbleProps {
  message: MessageResponseDto;
  isOwn: boolean;
  showSenderName: boolean;
  currentUserId: string;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MessageBubble({
  message,
  isOwn,
  showSenderName,
  currentUserId,
}: MessageBubbleProps) {
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

  const readByOthers = message.readBy.some((r) => r.userId !== currentUserId);

  return (
    <div className={cn("flex flex-col gap-0.5", isOwn ? "items-end" : "items-start")}>
      {/* Sender name */}
      {showSenderName && !isOwn && (
        <span className="px-1 text-xs font-medium text-muted-foreground">
          {message.sender.name}
        </span>
      )}

      {/* Bubble */}
      <div
        className={cn(
          "relative max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm",
          isOwn
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm bg-muted text-foreground",
        )}
      >
        {/* Text content */}
        {message.content && <p className="whitespace-pre-wrap break-words">{message.content}</p>}

        {/* Attachment */}
        {message.attachmentUrl && (
          <div className="mt-1">
            {message.attachmentType === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={message.attachmentUrl}
                alt="attachment"
                className="max-h-48 max-w-full rounded-lg object-contain"
              />
            ) : (
              <a
                href={message.attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:underline",
                  isOwn ? "border-primary-foreground/30 text-primary-foreground" : "border-border",
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
            "mt-0.5 flex items-center gap-1 text-[10px]",
            isOwn ? "justify-end text-primary-foreground/60" : "text-muted-foreground",
          )}
        >
          <span>{formatTime(message.createdAt)}</span>
          {isOwn && (
            readByOthers ? (
              <CheckCheck className="h-3 w-3" />
            ) : (
              <Check className="h-3 w-3" />
            )
          )}
        </div>
      </div>
    </div>
  );
}
