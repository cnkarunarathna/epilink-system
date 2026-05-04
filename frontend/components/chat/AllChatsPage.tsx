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
          className="flex items-start gap-3 rounded-lg px-3 py-3 animate-pulse"
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
    <div className="flex flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground h-full">
      <MessageSquareDashed className="h-10 w-10 opacity-30" />
      <div>
        <p className="font-medium text-sm text-foreground">No conversations yet</p>
        <p className="text-xs mt-1">
          Conversations appear here once messaging starts on a task.
        </p>
      </div>
      {role === "supervisor" && (
        <a
          href="/supervisor/tasks"
          className="mt-1 text-xs text-primary hover:underline"
        >
          Go to Tasks
        </a>
      )}
    </div>
  );
}

function EmptySelection() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 h-full text-muted-foreground">
      <MessageSquare className="h-12 w-12 opacity-20" />
      <p className="text-sm">Select a conversation to start chatting</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AllChatsPage({ role }: AllChatsPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clearCount } = useUnread();

  // ─── State ───────────────────────────────────────────────────────────────

  const [items, setItems] = useState<ChatSummaryItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    searchParams.get("task"),
  );
  const [mobileView, setMobileView] = useState<MobileView>(
    searchParams.get("task") ? "chat" : "list",
  );
  const [kbIdx, setKbIdx] = useState(-1);

  // ─── Fetch ────────────────────────────────────────────────────────────────

  const fetchItems = useCallback(
    async (opts: { reset?: boolean; searchVal?: string; statuses?: string[] } = {}) => {
      const { reset = false, searchVal = search, statuses = statusFilter } = opts;
      const offset = reset ? 0 : page * PAGE_SIZE;

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
          setPage(0);
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
    [search, statusFilter, page],
  );

  // Initial load
  useEffect(() => {
    fetchItems({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setMobileView("list");
  };

  // ─── Keyboard navigation ──────────────────────────────────────────────────

  // Reset cursor whenever the displayed list changes (search / filter)
  useEffect(() => {
    setKbIdx(-1);
  }, [search, statusFilter]);

  // Scroll focused item into view
  useEffect(() => {
    if (kbIdx >= 0) {
      itemRefs.current[kbIdx]?.scrollIntoView({ block: "nearest" });
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
    const nextPage = page + 1;
    setPage(nextPage);
    fetchItems({ reset: false });
  };

  // ─── Filtered view (unread-only client-side filter) ───────────────────────

  const displayedItems = useMemo(
    () => (unreadOnly ? items.filter((it) => it.unreadCount > 0) : items),
    [items, unreadOnly],
  );

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

  const isReadOnly =
    selectedItem
      ? ["completed", "rejected", "cancelled"].includes(selectedItem.status)
      : false;

  const hasAssignedPhi = selectedItem
    ? selectedItem.assignedPhi !== null
    : true;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b px-4 py-3 shrink-0">
        {/* Mobile back button */}
        {mobileView === "chat" && (
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden shrink-0"
            onClick={goBackToList}
            aria-label="Back to chats list"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}

        <h1 className="text-lg font-semibold leading-none shrink-0">
          All Chats
        </h1>

        <div className="flex-1 flex items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search conversations…"
              className="pl-8 h-8 text-sm"
            />
          </div>

          {/* Status filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <Filter className="h-3.5 w-3.5" />
                {statusFilter.length > 0
                  ? `Status (${statusFilter.length})`
                  : "Status"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
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

          {/* Unread-only toggle */}
          <Button
            variant={unreadOnly ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setUnreadOnly((v) => !v)}
          >
            Unread only
          </Button>
        </div>

        {/* Jump to task (desktop, only when task selected) */}
        {taskDetailHref && (
          <a
            href={taskDetailHref}
            className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Task detail
          </a>
        )}
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left panel — task list */}
        <aside
          tabIndex={0}
          onKeyDown={handleListKeyDown}
          className={cn(
            "flex flex-col border-r bg-sidebar overflow-hidden shrink-0 focus:outline-none",
            "w-full md:w-80 lg:w-96",
            // Mobile: hide list panel when viewing chat
            mobileView === "chat" ? "hidden md:flex" : "flex",
          )}
        >
          {/* Unread filter chip row */}
          <div className="px-2 pt-2 pb-1 shrink-0 text-xs text-muted-foreground">
            {loading ? null : (
              <span>
                {displayedItems.length} conversation
                {displayedItems.length !== 1 ? "s" : ""}
                {unreadOnly ? " with unread messages" : ""}
              </span>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
            {loading ? (
              <ListSkeleton />
            ) : displayedItems.length === 0 ? (
              <EmptyList role={role} />
            ) : (
              <>
                {displayedItems.map((item, idx) => (
                  <TaskChatListItem
                    key={item.taskId}
                    ref={(el) => { itemRefs.current[idx] = el; }}
                    item={item}
                    isSelected={selectedTaskId === item.taskId}
                    isFocused={kbIdx === idx}
                    onClick={() => selectTask(item.taskId)}
                  />
                ))}

                {/* Load more */}
                {hasMore && !unreadOnly && (
                  <div className="flex justify-center pt-2 pb-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="text-xs"
                    >
                      {loadingMore ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      ) : null}
                      Load more
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </aside>

        {/* Right panel — chat */}
        <section
          className={cn(
            "flex flex-col flex-1 min-w-0 overflow-hidden",
            // Mobile: hide chat panel when viewing list
            mobileView === "list" ? "hidden md:flex" : "flex",
          )}
        >
          {selectedTaskId ? (
            <div className="flex flex-col h-full">
              {/* Mobile: task detail link inside chat header area */}
              {taskDetailHref && (
                <div className="md:hidden flex items-center justify-end px-3 py-1.5 border-b text-xs shrink-0">
                  <a
                    href={taskDetailHref}
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View task detail
                  </a>
                </div>
              )}

              <ChatPanel
                taskId={selectedTaskId}
                visible={true}
                hasAssignedPhi={hasAssignedPhi}
                readOnly={isReadOnly}
                className="flex-1 rounded-none border-0 min-h-0"
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
