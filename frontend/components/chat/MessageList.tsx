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
  // Format dates in Sri Lanka timezone to accurately compare days
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const formatDateOnly = (dateStr: string) => {
    const parts = dateFormatter.formatToParts(new Date(dateStr));
    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    return `${year}-${month}-${day}`;
  };

  return formatDateOnly(a) === formatDateOnly(b);
}

function formatDate(iso: string) {
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  // Format dates in Sri Lanka timezone for accurate comparison
  const formatDateOnly = (date: Date) => {
    const parts = dateFormatter.formatToParts(date);
    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const dayPart = parts.find((p) => p.type === "day")?.value;
    return `${year}-${month}-${dayPart}`;
  };

  if (formatDateOnly(d) === formatDateOnly(today)) return "Today";
  if (formatDateOnly(d) === formatDateOnly(yesterday)) return "Yesterday";

  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Colombo",
  });
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
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <p className="text-xs">Loading conversation</p>
      </div>
    );
  }

  if (!loading && messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        <MessageSquare className="h-8 w-8 opacity-40" />
        <p className="text-sm font-medium">No messages yet.</p>
        <p className="text-xs">Start the conversation for this task.</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-1 flex-col gap-1 overflow-y-auto bg-[radial-gradient(circle_at_20%_0%,hsl(var(--muted)/0.35),transparent_35%),radial-gradient(circle_at_80%_100%,hsl(var(--muted)/0.26),transparent_40%)] px-3 py-3"
    >
      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center pb-2">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full border border-border/70 bg-background/80 px-4 text-xs shadow-sm hover:bg-background"
            onClick={onLoadMore}
            disabled={loading}
          >
            {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
            Load older messages
          </Button>
        </div>
      )}

      {messages.map((msg, idx) => {
        const prev = messages[idx - 1];
        const showDate = !prev || !isSameDay(prev.createdAt, msg.createdAt);
        const showSenderName =
          !prev || prev.sender.id !== msg.sender.id || showDate;

        return (
          <React.Fragment key={msg.id}>
            {showDate && (
              <div className="sticky top-0 z-10 flex items-center justify-center py-2">
                <span className="rounded-full border border-border/60 bg-background/90 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur">
                  {formatDate(msg.createdAt)}
                </span>
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
