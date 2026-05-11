"use client";

import React from "react";
import { formatDistanceToNow } from "date-fns";
import { Trash2, Wind, Eye, Search, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatSummaryItemDto } from "@/services/chat.service";
import { getStatusColor, getPriorityColor } from "@/services/tasks.service";
import { Badge } from "@/components/ui/badge";

interface TaskChatListItemProps {
  item: ChatSummaryItemDto;
  isSelected: boolean;
  isFocused?: boolean;
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

const TYPE_ICON: Record<string, React.ElementType> = {
  cleanup: Trash2,
  fogging: Wind,
  inspection: Eye,
  investigation: Search,
};

export const TaskChatListItem = React.forwardRef<
  HTMLButtonElement,
  TaskChatListItemProps
>(function TaskChatListItem({ item, isSelected, isFocused, onClick }, ref) {
  const hasUnread = item.unreadCount > 0;
  const TypeIcon = TYPE_ICON[item.type];

  const timeAgo = item.lastMessage?.sentAt
    ? formatDistanceToNow(new Date(item.lastMessage.sentAt), {
        addSuffix: false,
      })
    : null;

  return (
    <button
      ref={ref}
      onClick={onClick}
      aria-label={`${item.title}, ${item.status.replace("_", " ")}${hasUnread ? `, ${item.unreadCount} unread message${item.unreadCount !== 1 ? "s" : ""}` : ""}`}
      className={cn(
        "group relative w-full overflow-hidden rounded-2xl border px-3 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        isSelected
          ? "border-primary/25 bg-primary/10 shadow-sm shadow-primary/5"
          : isFocused
            ? "border-primary/30 bg-muted/70 shadow-sm"
            : "border-border/60 bg-background/70 hover:-translate-y-px hover:border-border hover:bg-muted/50 hover:shadow-sm",
      )}
      aria-current={isSelected ? "true" : undefined}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-background",
            STATUS_DOT[item.status] ?? "bg-gray-400",
          )}
          aria-label={item.status}
        />

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start gap-2">
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-sm leading-5",
                hasUnread
                  ? "font-semibold text-foreground"
                  : "font-medium text-foreground/85",
              )}
            >
              {item.title}
            </span>

            <div className="flex shrink-0 items-center gap-1.5">
              {timeAgo && (
                <span className="text-[11px] text-muted-foreground">
                  {timeAgo}
                </span>
              )}
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>

          <p className="line-clamp-1 text-xs leading-5 text-muted-foreground">
            {item.lastMessage
              ? item.lastMessage.isSystemMessage
                ? item.lastMessage.content
                : `${item.lastMessage.senderName}: ${item.lastMessage.content}`
              : "No messages yet"}
          </p>

          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {TypeIcon && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                <TypeIcon className="h-3 w-3 shrink-0" />
                {item.type}
              </span>
            )}
            <Badge
              className={cn(
                "h-5 rounded-full px-2 text-[10px] font-medium capitalize",
                getStatusColor(
                  item.status as Parameters<typeof getStatusColor>[0],
                ),
              )}
            >
              {item.status.replace("_", " ")}
            </Badge>
            <span
              className={cn(
                "text-[10px] font-medium capitalize",
                getPriorityColor(
                  item.priority as Parameters<typeof getPriorityColor>[0],
                ),
              )}
            >
              {item.priority}
            </span>
          </div>
        </div>

        {hasUnread && (
          <span className="ml-1 flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground shadow-sm">
            {item.unreadCount > 99 ? "99+" : item.unreadCount}
          </span>
        )}
      </div>
    </button>
  );
});
