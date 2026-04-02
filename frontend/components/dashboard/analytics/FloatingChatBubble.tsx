"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Bot,
  User,
  Send,
  Loader2,
  Wrench,
  Sparkles,
  X,
  MessageSquare,
  Minimize2,
} from "lucide-react";
import {
  chatWithAgent,
  deleteChatSession,
} from "@/services/analytics.service";

const TOOL_LABELS: Record<string, string> = {
  compare_districts: "District Comparison",
  year_over_year: "Historical Analysis",
  get_weather_correlation: "Weather Correlation",
  get_outbreak_alerts: "Outbreak Alerts",
  get_growth_rate: "Growth Rate",
  get_district_details: "District Details",
  get_seasonal_pattern: "Seasonal Pattern",
  get_cross_district_spillover: "Spillover Risk",
  get_intervention_history: "Intervention History",
  get_model_performance_metrics: "Model Performance",
  get_demographic_hotspots: "Demographic Hotspots",
};

const PRESETS = [
  "Summarize the current dengue situation",
  "Which districts need immediate attention?",
  "How does this compare to last year?",
  "What's the weather impact on dengue?",
  "Are there any active outbreak alerts?",
  "Compare the top 3 risk districts",
  "What is the seasonal pattern for this district?",
  "Are neighboring districts also rising?",
  "When was the last successful intervention here?",
  "How accurate are the model predictions?",
  "Which zones within the district need urgent action?",
];

interface ChatEntry {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: string[];
  timestamp: Date;
}

interface Props {
  district: string | null;
  dashboardContext?: {
    totalCases?: number;
    highRiskCount?: number;
    topDistricts?: string[];
  };
  /** "floating" keeps the existing fixed-position bubble+FAB. "drawer" renders inside a Radix Sheet. */
  mode?: "floating" | "drawer";
  /** Controlled open state — used only in drawer mode. */
  open?: boolean;
  /** Called when the drawer requests an open/close — used only in drawer mode. */
  onOpenChange?: (open: boolean) => void;
}

export default function FloatingChatBubble({
  district,
  dashboardContext,
  mode = "floating",
  open: externalOpen,
  onOpenChange,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const msgIdRef = useRef(0);
  // Keep a ref so async callbacks always see the latest session ID
  const sessionIdRef = useRef<string | undefined>(undefined);

  // In drawer mode the open state is controlled by the parent
  const isOpen = mode === "drawer" ? (externalOpen ?? false) : internalOpen;
  const setIsOpen = useCallback(
    (v: boolean) => {
      if (mode === "drawer") {
        onOpenChange?.(v);
      } else {
        setInternalOpen(v);
      }
    },
    [mode, onOpenChange],
  );

  const nextId = () => `msg-${++msgIdRef.current}`;

  const clearSession = useCallback(async (sid?: string) => {
    if (sid) {
      try { await deleteChatSession(sid); } catch { /* best-effort */ }
    }
    setMessages([]);
    sessionIdRef.current = undefined;
    setInput("");
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Clear server session when district changes
  useEffect(() => {
    if (district) {
      const prev = sessionIdRef.current;
      clearSession(prev);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [district]);

  const sendMessage = useCallback(
    async (text?: string) => {
      const msg = (text || input).trim();
      if (!msg || loading) return;

      const targetDistrict = district || "Sri Lanka";

      const userEntry: ChatEntry = {
        id: nextId(),
        role: "user",
        content: msg,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userEntry]);
      setInput("");

      setLoading(true);
      try {
        const resp = await chatWithAgent(
          targetDistrict,
          msg,
          sessionIdRef.current,
        );
        sessionIdRef.current = resp.session_id;
        const assistantEntry: ChatEntry = {
          id: nextId(),
          role: "assistant",
          content: resp.reply,
          toolCalls: resp.tool_calls_used,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantEntry]);
        if (!isOpen) setUnread((u) => u + 1);
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
    [input, loading, district, isOpen],
  );

  // ── Shared chat UI (used in both floating window and drawer) ──────────
  const chatInner = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-linear-to-r from-purple-600 to-indigo-600 text-white shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">EpiLink AI Analyst</h3>
            <p className="text-[11px] text-purple-200">
              {district
                ? `Analyzing ${district}`
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
            title={mode === "drawer" ? "Close chat" : "Close & clear session"}
            onClick={() => {
              if (mode === "floating") clearSession(sessionIdRef.current);
              setIsOpen(false);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

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
          {district && (
            <Badge variant="outline" className="text-[10px] ml-auto">
              {district}
            </Badge>
          )}
        </div>
      )}

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0"
      >
        {messages.length === 0 && !loading && (
          <div className="text-center py-4 space-y-3">
            <div className="flex justify-center">
              <div className="p-3 bg-linear-to-br from-purple-100 to-indigo-100 dark:from-purple-900/40 dark:to-indigo-900/40 rounded-2xl">
                <Sparkles className="h-7 w-7 text-purple-500" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                How can I help?
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                I can analyze trends, compare districts, and provide
                actionable insights
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5 mt-2">
              {PRESETS.slice(0, 4).map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-[11px] px-2.5 py-1.5 rounded-full bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in-50 slide-in-from-bottom-2`}
          >
            {msg.role === "assistant" && (
              <div className="p-1 bg-linear-to-br from-purple-500 to-indigo-600 rounded-lg h-fit shadow shrink-0 mt-0.5">
                <Bot className="h-3.5 w-3.5 text-white" />
              </div>
            )}
            <div
              className={`max-w-[85%] space-y-1.5 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-3.5 py-2"
                  : "bg-slate-50 dark:bg-slate-800 rounded-2xl rounded-bl-sm px-3.5 py-2.5 border border-slate-200 dark:border-slate-700"
              }`}
            >
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1">
                  {msg.toolCalls.map((tool, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="text-[9px] px-1.5 py-0 bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400"
                    >
                      <Wrench className="h-2.5 w-2.5 mr-0.5" />
                      {TOOL_LABELS[tool] || tool}
                    </Badge>
                  ))}
                </div>
              )}
              <p
                className={`text-[13px] leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? ""
                    : "text-slate-700 dark:text-slate-300"
                }`}
              >
                {msg.content}
              </p>
            </div>
            {msg.role === "user" && (
              <div className="p-1 bg-primary rounded-lg h-fit shadow shrink-0 mt-0.5">
                <User className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-2.5 items-start animate-in fade-in-50">
            <div className="p-1 bg-linear-to-br from-purple-500 to-indigo-600 rounded-lg shadow shrink-0">
              <Bot className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl rounded-bl-sm px-3.5 py-2.5 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-500" />
                <span>Analyzing data...</span>
                <span className="flex gap-0.5">
                  <span className="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick presets after first response */}
      {messages.length > 0 && messages.length < 6 && !loading && (
        <div className="px-3 pb-1.5 flex flex-wrap gap-1 shrink-0">
          {PRESETS.filter(
            (q) => !messages.some((m) => m.content === q),
          )
            .slice(0, 2)
            .map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="text-[10px] px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors truncate max-w-[200px]"
              >
                {q}
              </button>
            ))}
        </div>
      )}

      {/* Input bar */}
      <div className="flex gap-2 p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 shrink-0">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about dengue analytics..."
          className="flex-1 bg-white dark:bg-slate-800 border-purple-200/60 dark:border-purple-800/60 focus-visible:ring-purple-500 text-sm h-9"
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
        />
        <Button
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          size="sm"
          className="bg-linear-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow h-9 px-3"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </>
  );

  // ── Drawer mode ───────────────────────────────────────────────────────
  if (mode === "drawer") {
    return (
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="right"
          // Hide SheetContent's built-in close button — our header has one
          className="w-[420px] sm:max-w-[420px] p-0 flex flex-col gap-0 [&>button:last-of-type]:hidden"
        >
          <SheetTitle className="sr-only">EpiLink AI Analyst</SheetTitle>
          {chatInner}
        </SheetContent>
      </Sheet>
    );
  }

  // ── Floating mode (default) ───────────────────────────────────────────
  return (
    <>
      {/* ── Floating Chat Window ── */}
      {isOpen && (
        <div className="fixed bottom-20 right-6 w-[420px] max-h-[600px] z-50 flex flex-col rounded-2xl border-2 border-purple-200 dark:border-purple-800 shadow-2xl shadow-purple-200/30 dark:shadow-purple-900/20 bg-white dark:bg-slate-900 overflow-hidden animate-in fade-in-0 slide-in-from-bottom-5 zoom-in-95 duration-200">
          {chatInner}
        </div>
      )}

      {/* ── Floating Action Button ── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-2xl transition-all duration-300 ${
          isOpen
            ? "bg-slate-200 dark:bg-slate-700 scale-90"
            : "bg-linear-to-br from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 hover:scale-110 hover:shadow-purple-300/40 dark:hover:shadow-purple-700/40"
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
            {/* Pulse ring */}
            <span className="absolute inset-0 rounded-full bg-purple-400/30 animate-ping opacity-75 pointer-events-none" />
          </>
        )}
      </button>
    </>
  );
}
