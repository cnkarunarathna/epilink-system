"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  MessageSquare,
  AlertCircle,
  Search,
  X,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useUnread } from "@/contexts/UnreadContext";
import { useTaskChat } from "@/hooks/useTaskChat";
import { searchMessages, MessageResponseDto } from "@/services/chat.service";
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
  /**
   * Popup mode — hide the built-in header row.
   * The parent (ChatPopup) renders its own titlebar and search UI instead.
   */
  hideHeader?: boolean;
  /**
   * When the parent controls search, pass the results here to replace the
   * normal message list.  `undefined` means "use local messages".
   */
  overrideMessages?: MessageResponseDto[];
  overrideLoading?: boolean;
  overrideHasMore?: boolean;
}

export function ChatPanel({
  taskId,
  visible = false,
  hasAssignedPhi = true,
  readOnly = false,
  className,
  hideHeader = false,
  overrideMessages,
  overrideLoading,
  overrideHasMore,
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
    reactToMessage,
  } = useTaskChat(taskId, visible);

  // ─── 6.2 Search state ────────────────────────────────────────────────────────
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MessageResponseDto[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const runSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setSearchResults([]);
        return;
      }
      setSearchLoading(true);
      try {
        const results = await searchMessages(taskId, q);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    },
    [taskId],
  );

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => runSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery, runSearch]);

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
  };

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
          "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/30 p-6 text-center text-muted-foreground",
          className,
        )}
      >
        <AlertCircle className="h-6 w-6 opacity-50" />
        <p className="text-sm">
          Assign a PHI to this task to enable messaging.
        </p>
      </div>
    );
  }

  // When a parent (ChatPopup) provides overrides, use them; otherwise use local state
  const hasOverride = overrideMessages !== undefined;
  const displayMessages = hasOverride
    ? overrideMessages!
    : searchOpen
      ? searchResults
      : messages;
  const displayLoading = hasOverride
    ? (overrideLoading ?? false)
    : searchOpen
      ? searchLoading
      : loading;
  const displayHasMore = hasOverride
    ? (overrideHasMore ?? false)
    : searchOpen
      ? false
      : hasMore;

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-border/80 bg-background",
        className,
      )}
    >
      {/* Header — hidden when the parent popup renders its own titlebar */}
      {!hideHeader && (
        <div className="flex items-center gap-2 border-b bg-muted/24 px-3 py-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium flex-1">Messages</span>

          {/* Search toggle */}
          {searchOpen ? (
            <>
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search messages…"
                className="flex-1 rounded-md border border-border/70 bg-background px-2 py-1 text-sm outline-none placeholder:text-muted-foreground"
              />
              {searchLoading && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
              <button
                onClick={closeSearch}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close search"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Search messages"
            >
              <Search className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Read-only banner */}
      {readOnly && (
        <div className="flex items-center justify-center gap-1.5 border-b bg-muted/55 px-3 py-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          This task is closed. Chat is read-only.
        </div>
      )}

      {/* Search results info */}
      {searchOpen && !searchLoading && searchQuery.trim() && (
        <div className="border-b bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
          {searchResults.length === 0
            ? "No messages found"
            : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""}`}
        </div>
      )}

      {/* Message area */}
      <MessageList
        messages={displayMessages}
        loading={displayLoading}
        hasMore={displayHasMore}
        currentUserId={user.id}
        onLoadMore={loadMore}
        onVisibleMessages={markVisible}
        onReact={reactToMessage}
      />

      {/* Typing indicator (hidden during search) */}
      {!searchOpen && <TypingIndicator typingUsers={typingUsers} />}

      {/* Input */}
      {!readOnly && !searchOpen && (
        <MessageInput onSend={send} onTyping={emitTyping} disabled={readOnly} />
      )}
    </div>
  );
}
