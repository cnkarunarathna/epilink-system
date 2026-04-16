"use client";

import React, { useEffect } from "react";
import { MessageSquare, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useUnread } from "@/contexts/UnreadContext";
import { useTaskChat } from "@/hooks/useTaskChat";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { TypingIndicator } from "./TypingIndicator";

interface ChatPanelProps {
  taskId: string;
  /** Whether this panel is currently visible (controls auto-mark-read) */
  visible?: boolean;
  /** If the task has no assigned PHI, show a prompt instead of the chat */
  hasAssignedPhi?: boolean;
  /** If true, input is disabled (task COMPLETED / CANCELLED) */
  readOnly?: boolean;
  className?: string;
}

export function ChatPanel({
  taskId,
  visible = false,
  hasAssignedPhi = true,
  readOnly = false,
  className,
}: ChatPanelProps) {
  const { user } = useAuth();
  const { clearCount, refreshCounts } = useUnread();

  const {
    messages,
    loading,
    hasMore,
    typingUsers,
    send,
    loadMore,
    markVisible,
    emitTyping,
  } = useTaskChat(taskId, visible);

  // When panel becomes visible, clear unread badge immediately and refresh from backend
  useEffect(() => {
    if (visible) {
      clearCount(taskId);
      refreshCounts([taskId]);
    }
  }, [visible, taskId, clearCount, refreshCounts]);

  if (!user) return null;

  // Guard: no PHI assigned
  if (!hasAssignedPhi) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border bg-muted/30 p-6 text-center text-muted-foreground",
          className,
        )}
      >
        <AlertCircle className="h-6 w-6 opacity-50" />
        <p className="text-sm">Assign a PHI to this task to enable messaging.</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border bg-background",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Messages</span>
      </div>

      {/* Read-only banner */}
      {readOnly && (
        <div className="border-b bg-muted/60 px-3 py-1.5 text-center text-xs text-muted-foreground">
          This task is closed. Chat is read-only.
        </div>
      )}

      {/* Message area */}
      <MessageList
        messages={messages}
        loading={loading}
        hasMore={hasMore}
        currentUserId={user.id}
        onLoadMore={loadMore}
        onVisibleMessages={markVisible}
      />

      {/* Typing indicator */}
      <TypingIndicator typingUsers={typingUsers} />

      {/* Input */}
      {!readOnly && (
        <MessageInput
          onSend={send}
          onTyping={emitTyping}
          disabled={readOnly}
        />
      )}
    </div>
  );
}
