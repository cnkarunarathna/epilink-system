"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Menu, X, Minimize2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ChatSidebar } from "./ChatSidebar";
import { ChatWindow } from "./ChatWindow";
import { ChatInput } from "./ChatInput";
import type { ChatEntry } from "./ChatWindow";
import {
  chatWithAgent,
  getChatHistory,
  getUserChatSessions,
  renameChatSession,
  deleteChatSession,
  exportChatSession,
  type ChatSessionMeta,
} from "@/services/analytics.service";

interface Props {
  district: string | null;
  dashboardContext?: {
    totalCases?: number;
    highRiskCount?: number;
    topDistricts?: string[];
  };
  mode?: "floating" | "drawer";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onDistrictChange?: (district: string) => void;
}

export default function AIChatContainer({
  district,
  dashboardContext,
  mode = "floating",
  open: externalOpen,
  onOpenChange,
  onDistrictChange,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const [sessions, setSessions] = useState<ChatSessionMeta[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [activeDistrict, setActiveDistrict] = useState(district || "Sri Lanka");

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const msgIdRef = useRef(0);
  const sessionIdRef = useRef<string | undefined>(undefined);

  const isOpen = mode === "drawer" ? (externalOpen ?? false) : internalOpen;
  const setIsOpen = useCallback(
    (v: boolean) => {
      if (mode === "drawer") onOpenChange?.(v);
      else setInternalOpen(v);
    },
    [mode, onOpenChange],
  );

  const nextId = () => `msg-${++msgIdRef.current}`;

  // ── Session list ───────────────────────────────────────────────────

  const refreshSessions = useCallback(async () => {
    try {
      const res = await getUserChatSessions(1, 50);
      setSessions(res.data);
    } catch {
      // silent
    }
  }, []);

  // Load sessions when the panel first opens
  useEffect(() => {
    if (isOpen) {
      setUnread(0);
      refreshSessions();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Auto-scroll when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Sync active district + clear session when the parent district prop changes
  useEffect(() => {
    if (district) {
      setActiveDistrict(district);
      sessionIdRef.current = undefined;
      setActiveSessionId(null);
      setMessages([]);
      setInput("");
      setSessionExpired(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [district]);

  // Cmd/Ctrl+K — focus input or open panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) inputRef.current?.focus();
        else setIsOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, setIsOpen]);

  // ── Chat actions ───────────────────────────────────────────────────

  const startNewChat = useCallback(() => {
    sessionIdRef.current = undefined;
    setActiveSessionId(null);
    setMessages([]);
    setInput("");
    setSessionExpired(false);
    setActiveDistrict(district || "Sri Lanka");
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [district]);

  const handleExportSession = useCallback(
    async (sessionId: string, format: "json" | "markdown") => {
      try {
        await exportChatSession(sessionId, format);
      } catch {
        // silent — browser download failure is self-evident
      }
    },
    [],
  );

  const selectSession = useCallback(
    async (session: ChatSessionMeta) => {
      if (session.sessionId === activeSessionId) return;
      setActiveSessionId(session.sessionId);
      sessionIdRef.current = session.sessionId;
      setActiveDistrict(session.district);
      onDistrictChange?.(session.district);
      setSessionExpired(false);
      setIsLoadingHistory(true);
      setMessages([]);
      try {
        const history = await getChatHistory(session.sessionId);
        if (history.messages.length === 0) {
          setSessionExpired(true);
        } else {
          const entries: ChatEntry[] = history.messages.map((m, i) => ({
            id: `hist-${i}`,
            role: m.role,
            content: m.content,
            timestamp: new Date(),
          }));
          setMessages(entries);
        }
      } catch {
        setSessionExpired(true);
      } finally {
        setIsLoadingHistory(false);
      }
    },
    [activeSessionId],
  );

  const handleRenameSession = useCallback(async (sessionId: string, title: string) => {
    try {
      await renameChatSession(sessionId, title);
      setSessions((prev) =>
        prev.map((s) => (s.sessionId === sessionId ? { ...s, title } : s)),
      );
    } catch {
      // silent
    }
  }, []);

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      try {
        await deleteChatSession(sessionId);
        setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
        if (sessionId === activeSessionId) {
          sessionIdRef.current = undefined;
          setActiveSessionId(null);
          setMessages([]);
          setSessionExpired(false);
        }
      } catch {
        // silent
      }
    },
    [activeSessionId],
  );

  const sendMessage = useCallback(
    async (text?: string) => {
      const msg = (text || input).trim();
      if (!msg || loading) return;

      setSessionExpired(false);
      const userEntry: ChatEntry = {
        id: nextId(),
        role: "user",
        content: msg,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userEntry]);
      setInput("");
      setLoading(true);

      const wasNewSession = !sessionIdRef.current;
      try {
        const resp = await chatWithAgent(activeDistrict, msg, sessionIdRef.current);
        sessionIdRef.current = resp.session_id;
        setActiveSessionId(resp.session_id);

        const assistantEntry: ChatEntry = {
          id: nextId(),
          role: "assistant",
          content: resp.reply,
          toolCalls: resp.tool_calls_used,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantEntry]);
        if (!isOpen) setUnread((u) => u + 1);

        if (wasNewSession) {
          // Give backend time to persist the session row, then refresh sidebar
          setTimeout(refreshSessions, 1500);
          // Refresh again after auto-title generation completes (~3–5 s)
          setTimeout(refreshSessions, 5000);
        } else {
          setSessions((prev) =>
            prev.map((s) =>
              s.sessionId === resp.session_id
                ? {
                    ...s,
                    turnCount: resp.turn_count ?? s.turnCount,
                    updatedAt: new Date().toISOString(),
                  }
                : s,
            ),
          );
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            content: "Connection failed. Please try again.",
            timestamp: new Date(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, activeDistrict, isOpen, refreshSessions],
  );

  // ── Render ─────────────────────────────────────────────────────────

  const chatContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-linear-to-r from-purple-600 to-indigo-600 text-white shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSidebarOpen((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
            title={isSidebarOpen ? "Hide history" : "Show history"}
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">EpiLink AI Analyst</h3>
            <p className="text-[11px] text-purple-200">
              {activeDistrict !== "Sri Lanka"
                ? `Analyzing ${activeDistrict}`
                : "National dengue analytics"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {mode === "floating" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
              onClick={() => setIsOpen(false)}
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
            title="Close"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Sidebar + chat area */}
      <div className="flex flex-1 min-h-0">
        {isSidebarOpen && (
          <div className="w-[220px] shrink-0">
            <ChatSidebar
              sessions={sessions}
              activeSessionId={activeSessionId}
              onNewChat={startNewChat}
              onSelectSession={selectSession}
              onRenameSession={handleRenameSession}
              onDeleteSession={handleDeleteSession}
              onExportSession={handleExportSession}
            />
          </div>
        )}

        <div className="flex flex-col flex-1 min-w-0">
          {/* Dashboard context bar */}
          {dashboardContext && (
            <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-xs shrink-0">
              {dashboardContext.totalCases !== undefined && (
                <span className="text-slate-600 dark:text-slate-400">
                  <strong className="text-slate-900 dark:text-slate-100">
                    {dashboardContext.totalCases.toLocaleString()}
                  </strong>{" "}
                  cases
                </span>
              )}
              {dashboardContext.highRiskCount !== undefined && (
                <span className="text-red-600 dark:text-red-400">
                  <strong>{dashboardContext.highRiskCount}</strong> high-risk
                </span>
              )}
            </div>
          )}

          <ChatWindow
            messages={messages}
            loading={loading}
            isLoadingHistory={isLoadingHistory}
            sessionExpired={sessionExpired}
            district={activeDistrict}
            scrollRef={scrollRef}
            onSendMessage={sendMessage}
          />
          <ChatInput
            value={input}
            onChange={setInput}
            onSend={() => sendMessage()}
            loading={loading}
            inputRef={inputRef}
          />
        </div>
      </div>
    </div>
  );

  // ── Drawer mode ────────────────────────────────────────────────────

  if (mode === "drawer") {
    return (
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="right"
          className="w-[680px] sm:max-w-[680px] p-0 flex flex-col gap-0 [&>button:last-of-type]:hidden"
        >
          <SheetTitle className="sr-only">EpiLink AI Analyst</SheetTitle>
          {chatContent}
        </SheetContent>
      </Sheet>
    );
  }

  // ── Floating mode ──────────────────────────────────────────────────

  return (
    <>
      {isOpen && (
        <div
          className={`fixed bottom-20 right-6 z-50 flex flex-col rounded-2xl border-2 border-purple-200 dark:border-purple-800 shadow-2xl shadow-purple-200/30 dark:shadow-purple-900/20 bg-white dark:bg-slate-900 overflow-hidden animate-in fade-in-0 slide-in-from-bottom-5 zoom-in-95 duration-200 ${
            isSidebarOpen ? "w-[680px]" : "w-[420px]"
          }`}
          style={{ height: "80vh", maxHeight: "80vh" }}
        >
          {chatContent}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-2xl transition-all duration-300 ${
          isOpen
            ? "bg-slate-200 dark:bg-slate-700 scale-90"
            : "bg-linear-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 hover:scale-110 hover:shadow-purple-300/40 dark:hover:shadow-purple-700/40"
        }`}
        title="Chat with EpiLink AI"
      >
        {isOpen ? (
          <X className="h-6 w-6 text-slate-600 dark:text-slate-300" />
        ) : (
          <>
            <MessageSquare className="h-6 w-6 text-white" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce">
                {unread}
              </span>
            )}
            <span className="absolute inset-0 rounded-full bg-purple-400/30 animate-ping opacity-75 pointer-events-none" />
          </>
        )}
      </button>
    </>
  );
}
