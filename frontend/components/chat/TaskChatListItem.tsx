"use client";

import React from "react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { ChatSummaryItemDto } from "@/services/chat.service";
import {
  getStatusColor,
  getPriorityColor,
} from "@/services/tasks.service";
import { Badge } from "@/components/ui/badge";

interface TaskChatListItemProps {
  item: ChatSummaryItemDto;
  isSelected: boolean;
  onClick: () => void;
}

const STATUS_DOT: Record<string, string> = {
  pending: "bg-gray-400",
  assigned: "bg-blue-400",
  in_progress: "bg-yellow-400",
  submitted: "bg-purple-400",
  verified: "bg-green-400",
  completed: "bg-green-600",
  rejected: "bg-red-400",
};

export function TaskChatListItem({
  item,
  isSelected,
  onClick,
}: TaskChatListItemProps) {
  const hasUnread = item.unreadCount > 0;

  const timeAgo = item.lastMessage?.sentAt
    ? formatDistanceToNow(new Date(item.lastMessage.sentAt), {
        addSuffix: false,
      })
    : null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-3 flex items-start gap-3 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        isSelected
          ? "bg-primary/10 border border-primary/20"
          : "hover:bg-muted/60 border border-transparent",
      )}
      aria-current={isSelected ? "true" : undefined}
    >
      {/* Status dot */}
      <span
        className={cn(
          "mt-1 h-2 w-2 shrink-0 rounded-full",
          STATUS_DOT[item.status] ?? "bg-gray-400",
        )}
        aria-label={item.status}
      />

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Title row */}
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              "text-sm truncate flex-1",
              hasUnread ? "font-semibold text-foreground" : "font-medium text-foreground/80",
            )}
          >
            {item.title}
          </span>
          {/* Timestamp */}
          {timeAgo && (
            <span className="text-[11px] text-muted-foreground shrink-0">
              {timeAgo}
            </span>
          )}
        </div>

        {/* Last message preview */}
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
          {item.lastMessage
            ? item.lastMessage.isSystemMessage
              ? item.lastMessage.content
              : `${item.lastMessage.senderName}: ${item.lastMessage.content}`
            : "No messages yet"}
        </p>

        {/* Badges row */}
        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
          <Badge
            className={cn(
              "text-[10px] px-1.5 py-0 h-4 font-normal capitalize",
              getStatusColor(item.status as Parameters<typeof getStatusColor>[0]),
            )}
          >
            {item.status.replace("_", " ")}
          </Badge>
          <span
            className={cn(
              "text-[10px] font-medium capitalize",
              getPriorityColor(item.priority as Parameters<typeof getPriorityColor>[0]),
            )}
          >
            {item.priority}
          </span>
        </div>
      </div>

      {/* Unread pill */}
      {hasUnread && (
        <span className="mt-0.5 shrink-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
          {item.unreadCount > 99 ? "99+" : item.unreadCount}
        </span>
      )}
    </button>
  );
}
