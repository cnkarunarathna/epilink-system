"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  MessageSquare,
  MessageSquareDashed,
  Search,
  ChevronLeft,
  Loader2,
  ExternalLink,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  fetchChatSummary,
  ChatSummaryItemDto,
  MessageResponseDto,
} from "@/services/chat.service";
import { getPriorityColor, getStatusColor } from "@/services/tasks.service";
import { useUnread } from "@/contexts/UnreadContext";
import { useSocketEvent } from "@/hooks/useSocket";
import { ChatPanel } from "./ChatPanel";
import { TaskChatListItem } from "./TaskChatListItem";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AllChatsPageProps {
  role: "supervisor" | "phi";
}

type MobileView = "list" | "chat";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "submitted", label: "Submitted" },
  { value: "verified", label: "Verified" },
  { value: "completed", label: "Completed" },
  { value: "rejected", label: "Rejected" },
];

const PAGE_SIZE = 30;

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ListSkeleton() {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-3 rounded-2xl border border-border/50 bg-background/70 px-3 py-3 animate-pulse shadow-sm"
        >
          <div className="mt-1 h-2 w-2 rounded-full bg-muted-foreground/20 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-3/4 rounded bg-muted-foreground/15" />
            <div className="h-3 w-full rounded bg-muted-foreground/10" />
            <div className="h-3 w-1/3 rounded bg-muted-foreground/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Empty states ─────────────────────────────────────────────────────────────

function EmptyList({ role }: { role: AllChatsPageProps["role"] }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/30 shadow-inner">
        <MessageSquareDashed className="h-7 w-7 opacity-40" />
      </div>
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-semibold text-foreground">
          No conversations yet
        </p>
        <p className="text-xs leading-5">
          Conversations appear here once messaging starts on a task.
        </p>
      </div>
      {role === "supervisor" && (
        <a
          href="/supervisor/tasks"
          className="mt-2 inline-flex items-center rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
        >
          Go to Tasks
        </a>
      )}
    </div>
  );
}

function EmptyFilteredList({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-muted/30 shadow-inner">
        <Filter className="h-6 w-6 opacity-45" />
      </div>
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-semibold text-foreground">
          No matching conversations
        </p>
        <p className="text-xs leading-5">
          Adjust the search or filters to surface conversations again.
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="rounded-full"
        onClick={onReset}
      >
        Reset filters
      </Button>
    </div>
  );
}

function EmptySelection() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/25 shadow-inner">
        <MessageSquare className="h-8 w-8 opacity-30" />
      </div>
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-semibold text-foreground">
          Select a conversation to start chatting
        </p>
        <p className="text-xs leading-5">
          Choose a task on the left to review its message history and continue
          the thread.
        </p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AllChatsPage({ role }: AllChatsPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clearCount, totalUnread } = useUnread();
  const urlTaskId = searchParams.get("task");

  // ─── State ───────────────────────────────────────────────────────────────

  const [items, setItems] = useState<ChatSummaryItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    urlTaskId,
  );
  const [mobileView, setMobileView] = useState<MobileView>(
    urlTaskId ? "chat" : "list",
  );
  const [kbIdx, setKbIdx] = useState(-1);

  // ─── Fetch ────────────────────────────────────────────────────────────────

  const fetchItems = useCallback(
    async (
      opts: {
        reset?: boolean;
        searchVal?: string;
        statuses?: string[];
        offset?: number;
      } = {},
    ) => {
      const {
        reset = false,
        searchVal = search,
        statuses = statusFilter,
      } = opts;
      const offset = opts.offset ?? (reset ? 0 : items.length);

      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const res = await fetchChatSummary({
          search: searchVal || undefined,
          status: statuses.length > 0 ? statuses.join(",") : undefined,
          limit: PAGE_SIZE,
          offset,
        });
        if (reset) {
          setItems(res.items);
        } else {
          setItems((prev) => [...prev, ...res.items]);
        }
        setTotal(res.total);
      } catch (err) {
        console.error("[AllChatsPage] fetchChatSummary failed:", err);
        if (reset) {
          toast.error("Failed to load conversations. Please refresh.");
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [items.length, search, statusFilter],
  );

  // Initial load
  useEffect(() => {
    fetchItems({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSelectedTaskId(urlTaskId);
    setMobileView(urlTaskId ? "chat" : "list");
  }, [urlTaskId]);

  // ─── Refs ─────────────────────────────────────────────────────────────────

  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ─── Debounced search ─────────────────────────────────────────────────────

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      fetchItems({ reset: true, searchVal: val, statuses: statusFilter });
    }, 400);
  };

  // ─── Status filter ────────────────────────────────────────────────────────

  const handleStatusToggle = (status: string) => {
    const next = statusFilter.includes(status)
      ? statusFilter.filter((s) => s !== status)
      : [...statusFilter, status];
    setStatusFilter(next);
    fetchItems({ reset: true, searchVal: search, statuses: next });
  };

  const resetFilters = useCallback(() => {
    setSearch("");
    setStatusFilter([]);
    setUnreadOnly(false);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    fetchItems({ reset: true, searchVal: "", statuses: [] });
  }, [fetchItems]);

  // ─── Task selection ───────────────────────────────────────────────────────

  const selectTask = useCallback(
    (taskId: string) => {
      setSelectedTaskId(taskId);
      setMobileView("chat");
      clearCount(taskId);
      router.replace(`/${role}/chats?task=${taskId}`, { scroll: false });

      // Optimistically zero unread in the list
      setItems((prev) =>
        prev.map((it) =>
          it.taskId === taskId ? { ...it, unreadCount: 0 } : it,
        ),
      );
    },
    [role, router, clearCount],
  );

  const goBackToList = () => {
    setSelectedTaskId(null);
    setMobileView("list");
    setKbIdx(-1);
    router.replace(`/${role}/chats`, { scroll: false });
  };

  // ─── Keyboard navigation ──────────────────────────────────────────────────

  // Reset cursor whenever the displayed list changes (search / filter)
  useEffect(() => {
    setKbIdx(-1);
  }, [search, statusFilter]);

  // Scroll focused item into view
  useEffect(() => {
    if (kbIdx >= 0) {
      itemRefs.current[kbIdx]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [kbIdx]);

  // Global Cmd+F / Ctrl+F → focus search input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ─── Real-time: socket patch on new message ───────────────────────────────

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useSocketEvent<MessageResponseDto>(
    "chat:message",
    (msg) => {
      // Patch last-message preview and increment unread for the affected task
      setItems((prev) => {
        const idx = prev.findIndex((it) => it.taskId === msg.taskId);
        if (idx === -1) return prev;

        const updated = prev.map((it) => {
          if (it.taskId !== msg.taskId) return it;
          return {
            ...it,
            lastMessage: {
              content:
                msg.content.length > 120
                  ? msg.content.slice(0, 120) + "…"
                  : msg.content,
              senderName: msg.sender.name,
              sentAt: msg.createdAt,
              isSystemMessage: msg.isSystemMessage,
            },
            // Only increment unread if this task is not currently selected
            unreadCount:
              msg.taskId === selectedTaskId
                ? it.unreadCount
                : it.unreadCount + 1,
          };
        });

        // Re-sort: unread DESC → sentAt DESC (mirrors backend ordering)
        return [...updated].sort((a, b) => {
          if (b.unreadCount !== a.unreadCount)
            return b.unreadCount - a.unreadCount;
          const aT = a.lastMessage
            ? new Date(a.lastMessage.sentAt).getTime()
            : 0;
          const bT = b.lastMessage
            ? new Date(b.lastMessage.sentAt).getTime()
            : 0;
          return bT - aT;
        });
      });

      // Debounced full re-fetch to catch new tasks that entered the summary list
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchItems({ reset: true, searchVal: search, statuses: statusFilter });
      }, 500);
    },
    [selectedTaskId, search, statusFilter, fetchItems],
  );

  // ─── Load more ────────────────────────────────────────────────────────────

  const hasMore = items.length < total;

  const loadMore = () => {
    fetchItems({ reset: false, offset: items.length });
  };

  // ─── Filtered view (unread-only client-side filter) ───────────────────────

  const displayedItems = useMemo(
    () => (unreadOnly ? items.filter((it) => it.unreadCount > 0) : items),
    [items, unreadOnly],
  );

  const hasActiveFilters =
    search.trim().length > 0 || statusFilter.length > 0 || unreadOnly;

  // ─── Keyboard handler (needs displayedItems, defined after useMemo) ─────────

  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      const len = displayedItems.length;
      if (len === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setKbIdx((prev) => (prev < len - 1 ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setKbIdx((prev) => (prev > 0 ? prev - 1 : len - 1));
      } else if (e.key === "Enter") {
        if (kbIdx >= 0 && kbIdx < len) {
          selectTask(displayedItems[kbIdx].taskId);
        }
      } else if (e.key === "Escape") {
        setSelectedTaskId(null);
        setMobileView("list");
        setKbIdx(-1);
        router.replace(`/${role}/chats`, { scroll: false });
      }
    },
    [displayedItems, kbIdx, selectTask, role, router],
  );

  // ─── Selected item ────────────────────────────────────────────────────────

  const selectedItem = items.find((it) => it.taskId === selectedTaskId) ?? null;
  const taskDetailHref = selectedTaskId
    ? `/${role}/tasks/${selectedTaskId}`
    : null;

  const isReadOnly = selectedItem
    ? ["completed", "rejected", "cancelled"].includes(selectedItem.status)
    : false;

  const hasAssignedPhi = selectedItem
    ? selectedItem.assignedPhi !== null
    : true;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-3 overflow-hidden rounded-4xl bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.10),transparent_26%),radial-gradient(circle_at_bottom_right,hsl(var(--muted)/0.60),transparent_32%)]">
      <div className="rounded-4xl border border-border/70 bg-card/85 px-4 py-3 shadow-sm backdrop-blur-xl md:px-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {/* Title + stats */}
          <h1 className="text-base font-semibold tracking-tight text-foreground">
            All Chats
          </h1>
          <div className="flex items-center gap-1.5">
            <Badge
              variant="secondary"
              className="gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {items.length}
            </Badge>
            <Badge
              variant="secondary"
              className="gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              {totalUnread} unread
            </Badge>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 rounded-full px-2.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={resetFilters}
              >
                Clear filters
              </Button>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Search + filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search conversations…"
                aria-label="Search conversations"
                className="h-8 w-44 rounded-full border-border/70 bg-background/80 pl-8 text-xs shadow-sm sm:w-56"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 rounded-full px-3 text-xs"
                >
                  <Filter className="h-3 w-3" />
                  {statusFilter.length > 0
                    ? `Status (${statusFilter.length})`
                    : "Status"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-xs">
                  Filter by status
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {STATUS_OPTIONS.map((opt) => (
                  <DropdownMenuCheckboxItem
                    key={opt.value}
                    checked={statusFilter.includes(opt.value)}
                    onCheckedChange={() => handleStatusToggle(opt.value)}
                    className="text-sm"
                  >
                    {opt.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant={unreadOnly ? "default" : "outline"}
              size="sm"
              className="h-8 rounded-full px-3 text-xs"
              onClick={() => setUnreadOnly((v) => !v)}
            >
              Unread only
            </Button>

            {taskDetailHref && (
              <a
                href={taskDetailHref}
                className="hidden items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted lg:inline-flex"
              >
                <ExternalLink className="h-3 w-3" />
                Open task
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 grid-rows-1 md:grid-rows-2 lg:grid-rows-1 lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]">
        <aside
          tabIndex={0}
          onKeyDown={handleListKeyDown}
          aria-label="Conversation list"
          className={cn(
            "flex min-h-0 flex-col overflow-hidden overscroll-none rounded-4xl border border-border/70 bg-card/90 shadow-lg shadow-black/5 backdrop-blur-xl focus:outline-none",
            mobileView === "chat" ? "hidden md:flex" : "flex",
          )}
        >
          <div className="sticky top-0 z-10 border-b border-border/70 bg-card/95 px-4 py-4 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Conversations
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {loading
                    ? "Loading conversations"
                    : `${displayedItems.length} conversation${displayedItems.length !== 1 ? "s" : ""}${unreadOnly ? " with unread messages" : ""}`}
                </p>
              </div>
              <Badge
                variant="outline"
                className="rounded-full px-2.5 py-0 text-[10px] font-medium uppercase tracking-[0.18em]"
              >
                {unreadOnly ? "Unread" : "All"}
              </Badge>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain scroll-smooth px-3 py-3 custom-scrollbar">
            {loading ? (
              <ListSkeleton />
            ) : displayedItems.length === 0 ? (
              hasActiveFilters ? (
                <EmptyFilteredList onReset={resetFilters} />
              ) : (
                <EmptyList role={role} />
              )
            ) : (
              <>
                <div className="space-y-2">
                  {displayedItems.map((item, idx) => (
                    <TaskChatListItem
                      key={item.taskId}
                      ref={(el) => {
                        itemRefs.current[idx] = el;
                      }}
                      item={item}
                      isSelected={selectedTaskId === item.taskId}
                      isFocused={kbIdx === idx}
                      onClick={() => selectTask(item.taskId)}
                    />
                  ))}
                </div>

                {hasMore && !unreadOnly && (
                  <div className="flex justify-center py-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="rounded-full px-4 text-xs shadow-sm"
                    >
                      {loadingMore ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Load older conversations
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </aside>

        <section
          aria-label="Chat messages"
          className={cn(
            "flex min-h-0 flex-col overflow-hidden overscroll-none rounded-4xl border border-border/70 bg-card/90 shadow-lg shadow-black/5 backdrop-blur-xl",
            mobileView === "list" ? "hidden md:flex" : "flex",
          )}
        >
          {selectedTaskId ? (
            <div key={selectedTaskId} className="flex min-h-0 flex-1 flex-col animate-in fade-in duration-150">
              <div className="flex items-start justify-between gap-4 border-b border-border/70 bg-background/70 px-4 py-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="md:hidden h-8 w-8 shrink-0 rounded-full"
                      onClick={goBackToList}
                      aria-label="Back to conversations"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h2 className="truncate text-base font-semibold text-foreground md:text-lg">
                      {selectedItem?.title ?? "Conversation"}
                    </h2>
                    {selectedItem && (
                      <Badge
                        className={cn(
                          "rounded-full px-2.5 py-0 text-[10px] font-medium capitalize",
                          getStatusColor(
                            selectedItem.status as Parameters<
                              typeof getStatusColor
                            >[0],
                          ),
                        )}
                      >
                        {selectedItem.status.replace("_", " ")}
                      </Badge>
                    )}
                    {selectedItem && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full px-2.5 py-0 text-[10px] font-medium capitalize",
                          getPriorityColor(
                            selectedItem.priority as Parameters<
                              typeof getPriorityColor
                            >[0],
                          ),
                        )}
                      >
                        {selectedItem.priority}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedItem
                      ? `${selectedItem.district} · ${selectedItem.createdBy.name}${selectedItem.assignedPhi ? ` · ${selectedItem.assignedPhi.name}` : ""}`
                      : "Selected task conversation"}
                  </p>
                </div>

                {taskDetailHref && (
                  <a
                    href={taskDetailHref}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-background px-3 py-2 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View task
                  </a>
                )}
              </div>

              {taskDetailHref && (
                <div className="border-b border-border/70 bg-muted/30 px-4 py-2 text-xs md:hidden">
                  <a
                    href={taskDetailHref}
                    className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open full task details
                  </a>
                </div>
              )}

              <ChatPanel
                taskId={selectedTaskId}
                visible={true}
                hasAssignedPhi={hasAssignedPhi}
                readOnly={isReadOnly}
                className="min-h-0 flex-1 rounded-none border-0 bg-transparent shadow-none"
              />
            </div>
          ) : (
            <EmptySelection />
          )}
        </section>
      </div>
    </div>
  );
}
