"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageResponseDto } from "@/services/chat.service";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  messages: MessageResponseDto[];
  loading: boolean;
  hasMore: boolean;
  currentUserId: string;
  onLoadMore: () => void;
  onVisibleMessages: (ids: string[]) => void;
  onReact?: (messageId: string, emoji: string) => void;
}

function isSameDay(a: string, b: string) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(iso, today.toISOString())) return "Today";
  if (isSameDay(iso, yesterday.toISOString())) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export function MessageList({
  messages,
  loading,
  hasMore,
  currentUserId,
  onLoadMore,
  onVisibleMessages,
  onReact,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  // Scroll to bottom when new messages arrive (not on load-more)
  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      const wasAtBottom =
        !containerRef.current ||
        containerRef.current.scrollHeight - containerRef.current.scrollTop <=
          containerRef.current.clientHeight + 80;

      if (wasAtBottom || prevCountRef.current === 0) {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
    prevCountRef.current = messages.length;
  }, [messages.length]);

  // Intersection observer to mark visible unread messages as read
  const observerRef = useRef<IntersectionObserver | null>(null);

  const setupObserver = useCallback(() => {
    observerRef.current?.disconnect();
    const visibleIds: string[] = [];
    let flushTimer: ReturnType<typeof setTimeout>;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = (entry.target as HTMLElement).dataset.messageId;
            if (id && !visibleIds.includes(id)) visibleIds.push(id);
          }
        });
        clearTimeout(flushTimer);
        flushTimer = setTimeout(() => {
          if (visibleIds.length > 0) {
            onVisibleMessages([...visibleIds]);
            visibleIds.length = 0;
          }
        }, 500);
      },
      { root: containerRef.current, threshold: 0.5 },
    );

    // Observe all message elements
    containerRef.current
      ?.querySelectorAll("[data-message-id]")
      .forEach((el) => observerRef.current?.observe(el));
  }, [onVisibleMessages]);

  useEffect(() => {
    setupObserver();
    return () => observerRef.current?.disconnect();
  }, [messages, setupObserver]);

  if (loading && messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!loading && messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        <MessageSquare className="h-8 w-8 opacity-40" />
        <p className="text-sm">No messages yet. Start the conversation.</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3"
    >
      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center pb-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={onLoadMore}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : null}
            Load older messages
          </Button>
        </div>
      )}

      {messages.map((msg, idx) => {
        const prev = messages[idx - 1];
        const showDate = !prev || !isSameDay(prev.createdAt, msg.createdAt);
        const showSenderName =
          !prev ||
          prev.sender.id !== msg.sender.id ||
          showDate;

        return (
          <React.Fragment key={msg.id}>
            {showDate && (
              <div className="flex items-center gap-2 py-2">
                <div className="flex-1 border-t" />
                <span className="text-[10px] text-muted-foreground">
                  {formatDate(msg.createdAt)}
                </span>
                <div className="flex-1 border-t" />
              </div>
            )}
            <div data-message-id={msg.id}>
              <MessageBubble
                message={msg}
                isOwn={msg.sender.id === currentUserId}
                showSenderName={showSenderName}
                currentUserId={currentUserId}
                onReact={onReact}
              />
            </div>
          </React.Fragment>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}
