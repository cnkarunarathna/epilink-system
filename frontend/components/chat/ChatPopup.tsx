"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  X,
  Minus,
  Search,
  ArrowLeft,
  Loader2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { searchMessages, MessageResponseDto } from "@/services/chat.service";
import { useAuth } from "@/contexts/AuthContext";
import { ChatPanel } from "./ChatPanel";

interface ChatPopupProps {
  taskId: string;
  taskTitle?: string;
  hasAssignedPhi?: boolean;
  readOnly?: boolean;
  /** Unread count shown on the FAB badge */
  unreadCount?: number;
}

export function ChatPopup({
  taskId,
  taskTitle,
  hasAssignedPhi = true,
  readOnly = false,
  unreadCount = 0,
}: ChatPopupProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);

  // ── Search state (lifted here so it lives in the popup titlebar) ─────────────
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MessageResponseDto[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => runSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery, runSearch]);

  const openSearch = () => {
    setSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleOpen = () => {
    setOpen(true);
    setMinimized(false);
  };

  const handleClose = () => {
    setOpen(false);
    setMinimized(false);
    closeSearch();
  };

  // ── Override props for ChatPanel (search results replace message list) ────────
  const searchOverride = searchOpen
    ? {
        overrideMessages: searchResults,
        overrideLoading: searchLoading,
        overrideHasMore: false,
      }
    : {};

  // ── Result count banner (shown inside popup when searching) ─────────────────
  const showResultsBanner =
    searchOpen && !searchLoading && searchQuery.trim().length > 0;

  const roleTone =
    user?.role === "supervisor"
      ? {
          badge: "Supervisor Console",
          dot: "bg-emerald-400",
          headerOverlay:
            "bg-gradient-to-r from-emerald-600/95 via-teal-600/95 to-cyan-600/95",
        }
      : {
          badge: "PHI Field View",
          dot: "bg-amber-400",
          headerOverlay:
            "bg-gradient-to-r from-sky-700/95 via-blue-700/95 to-indigo-700/95",
        };

  return (
    <>
      {/* ── FAB trigger ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="fab"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            onClick={handleOpen}
            className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-white/30 bg-linear-to-br from-primary to-primary/80 text-primary-foreground shadow-[0_14px_30px_-12px_hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Open task chat"
          >
            <MessageSquare className="h-6 w-6" />
            {unreadCount > 0 && (
              <span className="absolute inset-0 rounded-full ring-8 ring-primary/20" />
            )}
            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.span
                  key="badge"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 28 }}
                  className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground ring-2 ring-background"
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <>
            {/* ── Mobile backdrop ───────────────────────────────────────────── */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
              onClick={handleClose}
              aria-hidden
            />

            {/* ── Chat window ───────────────────────────────────────────────── */}
            <motion.div
              key="popup"
              initial={{ opacity: 0, y: 48, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 48, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className={cn(
                // base
                "fixed z-50 flex flex-col overflow-hidden border border-border/70 bg-background/95 shadow-2xl backdrop-blur supports-backdrop-filter:bg-background/85",
                // mobile: bottom sheet, full width, rounded top
                "inset-x-0 bottom-0 rounded-t-2xl",
                minimized ? "h-auto" : "h-[85svh]",
                // desktop: corner popup, fixed size
                "md:inset-auto md:bottom-6 md:right-6 md:rounded-2xl",
                minimized
                  ? "md:w-96 lg:w-[420px]"
                  : "md:h-[600px] md:w-96 lg:h-[640px] lg:w-[420px]",
              )}
              role="dialog"
              aria-label="Task chat"
            >
              {/* ── Titlebar ────────────────────────────────────────────────── */}
              <div
                className={cn(
                  "relative flex shrink-0 items-center gap-2 px-3 py-3 text-primary-foreground",
                  roleTone.headerOverlay,
                )}
              >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.24),transparent_45%)]" />
                {searchOpen ? (
                  /* Search mode titlebar */
                  <>
                    <button
                      onClick={closeSearch}
                      className="flex shrink-0 items-center justify-center rounded-md p-1 transition-colors hover:bg-white/20"
                      aria-label="Close search"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <input
                      ref={searchInputRef}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search messages…"
                      className="flex-1 rounded-lg bg-white/15 px-2 py-1 text-sm text-primary-foreground outline-none placeholder:text-primary-foreground/60 focus:bg-white/20"
                      autoFocus
                    />
                    {searchLoading ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin opacity-70" />
                    ) : searchQuery ? (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="flex items-center justify-center rounded-md p-1 transition-colors hover:bg-white/20"
                        aria-label="Clear search"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </>
                ) : (
                  /* Normal titlebar */
                  <>
                    <MessageSquare className="h-4 w-4 shrink-0" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-semibold leading-tight tracking-wide">
                        Messages
                      </span>
                      <div className="flex min-w-0 items-center gap-2">
                        {taskTitle && (
                          <span className="truncate text-[11px] leading-tight text-primary-foreground/75">
                            {taskTitle}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 rounded-full bg-black/20 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary-foreground/90">
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              roleTone.dot,
                            )}
                          />
                          {roleTone.badge}
                        </span>
                      </div>
                    </div>

                    {readOnly && (
                      <span className="hidden items-center gap-1 rounded-full border border-white/25 bg-black/15 px-2 py-0.5 text-[10px] font-medium md:inline-flex">
                        <Sparkles className="h-3 w-3" />
                        Read only
                      </span>
                    )}

                    {/* Search toggle */}
                    <button
                      onClick={openSearch}
                      className="flex items-center justify-center rounded-md p-1.5 transition-colors hover:bg-white/20"
                      aria-label="Search messages"
                    >
                      <Search className="h-4 w-4" />
                    </button>

                    {/* Minimize — desktop only */}
                    <button
                      onClick={() => setMinimized((v) => !v)}
                      className="hidden items-center justify-center rounded-md p-1.5 transition-colors hover:bg-white/20 md:flex"
                      aria-label={minimized ? "Expand chat" : "Minimize chat"}
                    >
                      <Minus className="h-4 w-4" />
                    </button>

                    {/* Close */}
                    <button
                      onClick={handleClose}
                      className="flex items-center justify-center rounded-md p-1.5 transition-colors hover:bg-white/20"
                      aria-label="Close chat"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>

              {/* ── Search results info bar ──────────────────────────────────── */}
              {showResultsBanner && (
                <div className="shrink-0 border-b border-border/70 bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
                  {searchResults.length === 0
                    ? "No messages found"
                    : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""}`}
                </div>
              )}

              {/* ── Chat content (hidden when minimized) ─────────────────────── */}
              {!minimized && (
                <ChatPanel
                  taskId={taskId}
                  visible={open && !minimized}
                  hasAssignedPhi={hasAssignedPhi}
                  readOnly={readOnly}
                  hideHeader
                  className="flex-1 overflow-hidden rounded-none border-0"
                  {...searchOverride}
                />
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
