"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  User,
  Send,
  Loader2,
  Wrench,
  Sparkles,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Trash2,
} from "lucide-react";
import { chatWithAgent, deleteChatSession } from "@/services/analytics.service";

const TOOL_LABELS: Record<string, string> = {
  compare_districts: "District Comparison",
  year_over_year: "Historical Analysis",
  get_weather_correlation: "Weather Correlation",
  get_outbreak_alerts: "Outbreak Alerts",
  get_growth_rate: "Growth Rate Analysis",
};

const PRESET_QUESTIONS = [
  "How does this district compare to its neighbors?",
  "What is the weather impact on dengue here?",
  "Are there any active outbreak alerts?",
  "How does this compare to last year?",
  "Which districts have the fastest case growth?",
];

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const re = /\*\*(.*?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <strong key={k++} className="font-semibold text-purple-700 dark:text-purple-300">
        {m[1]}
      </strong>
    );
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0] as React.ReactNode;
  return <>{parts}</>;
}

function MarkdownMessage({ content }: { content: string }) {
  const result: React.ReactNode[] = [];
  const pending: string[] = [];
  let key = 0;

  const flushList = () => {
    if (!pending.length) return;
    result.push(
      <ul key={key++} className="list-disc ml-4 space-y-1 my-1">
        {pending.map((item, i) => (
          <li key={i} className="text-sm leading-relaxed">
            {renderInline(item)}
          </li>
        ))}
      </ul>
    );
    pending.length = 0;
  };

  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flushList();
      continue;
    }
    const listMatch = line.match(/^[*\-]\s+([\s\S]*)/);
    if (listMatch) {
      pending.push(listMatch[1]);
    } else {
      flushList();
      result.push(
        <p key={key++} className="text-sm leading-relaxed">
          {renderInline(line)}
        </p>
      );
    }
  }

  flushList();
  return <div className="space-y-1">{result}</div>;
}

interface ChatEntry {
  role: "user" | "assistant";
  content: string;
  toolCalls?: string[];
  timestamp: Date;
}

interface Props {
  district: string;
}

export default function InsightChatPanel({ district }: Props) {
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [turnCount, setTurnCount] = useState(0);
  const [expanded, setExpanded] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Clear server session and local state when district changes
  const clearSession = useCallback(async (sid?: string) => {
    if (sid) {
      try {
        await deleteChatSession(sid);
      } catch {
        /* best-effort */
      }
    }
    setMessages([]);
    setSessionId(undefined);
    setTurnCount(0);
    setInput("");
  }, []);

  useEffect(() => {
    // Keep a ref to the current session so the cleanup captures it
    let currentSession: string | undefined;
    setSessionId((prev) => {
      currentSession = prev;
      return undefined;
    });
    clearSession(currentSession);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [district]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    const userEntry: ChatEntry = {
      role: "user",
      content: msg,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userEntry]);
    setInput("");

    setLoading(true);
    try {
      // Enhancement 7: send only the new message + session_id.
      // The Python service manages full history in Redis.
      const resp = await chatWithAgent(district, msg, sessionId);
      setSessionId(resp.session_id);
      if (resp.turn_count !== undefined) setTurnCount(resp.turn_count);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: resp.reply,
          toolCalls: resp.tool_calls_used,
          timestamp: new Date(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Failed to get a response. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border-2 border-purple-200 dark:border-purple-800/50 overflow-hidden shadow-lg">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/50 dark:to-indigo-950/50 hover:from-purple-100 hover:to-indigo-100 dark:hover:from-purple-900/50 dark:hover:to-indigo-900/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg shadow">
            <MessageSquare className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-purple-900 dark:text-purple-200">
            Chat with EpiLink AI Agent
          </span>
          {turnCount > 0 && (
            <Badge variant="outline" className="text-xs">
              {turnCount} {turnCount === 1 ? "turn" : "turns"}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {sessionId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearSession(sessionId);
              }}
              title="Clear session"
              className="p-1 rounded text-purple-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-purple-500" />
          ) : (
            <ChevronUp className="h-4 w-4 text-purple-500" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="bg-white dark:bg-slate-900">
          {/* Messages */}
          <div
            ref={scrollRef}
            className="max-h-[400px] min-h-[120px] overflow-y-auto p-4 space-y-4"
          >
            {messages.length === 0 && !loading && (
              <div className="text-center py-6 space-y-3">
                <div className="flex justify-center">
                  <div className="p-3 bg-purple-100 dark:bg-purple-900/40 rounded-2xl">
                    <Bot className="h-8 w-8 text-purple-500" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Ask me anything about {district}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    I can compare districts, analyze trends, check weather
                    impact, and more
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 mt-3">
                  {PRESET_QUESTIONS.slice(0, 3).map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="text-xs px-3 py-1.5 rounded-full bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in-50 slide-in-from-bottom-2`}
              >
                {msg.role === "assistant" && (
                  <div className="p-1.5 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg h-fit shadow">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] space-y-2 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5"
                      : "bg-slate-50 dark:bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {/* Tool calls badge */}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {msg.toolCalls.map((tool, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="text-[10px] px-2 py-0.5 bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400"
                        >
                          <Wrench className="h-3 w-3 mr-1" />
                          {TOOL_LABELS[tool] || tool}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {msg.role === "user" ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  ) : (
                    <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                      <MarkdownMessage content={msg.content} />
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="p-1.5 bg-primary rounded-lg h-fit shadow">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex gap-3 items-start animate-in fade-in-50">
                <div className="p-1.5 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg shadow">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                    <span>Analyzing with tools...</span>
                    <Sparkles className="h-3 w-3 text-purple-400 animate-pulse" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Preset questions (when there are messages) */}
          {messages.length > 0 && !loading && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {PRESET_QUESTIONS.filter(
                (q) => !messages.some((m) => m.content === q),
              )
                .slice(0, 3)
                .map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    {q}
                  </button>
                ))}
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2 p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask about ${district}...`}
              className="flex-1 bg-white dark:bg-slate-800 border-purple-200 dark:border-purple-800 focus-visible:ring-purple-500 text-sm"
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
              className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow-lg px-4"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
