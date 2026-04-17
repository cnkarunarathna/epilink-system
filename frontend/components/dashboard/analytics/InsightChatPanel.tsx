"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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
  Copy,
  Check,
  RotateCcw,
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

function normalizeMarkdown(content: string) {
  let normalized = content;

  // Some responses can be escaped multiple times (e.g., "\\n" or "\\*\\*").
  // Run a few decode passes so markdown reliably renders in the UI.
  for (let i = 0; i < 3; i += 1) {
    const prev = normalized;
    const trimmed = normalized.trim();

    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === "string") {
          normalized = parsed;
        }
      } catch {
        // Ignore parse failures and continue fallback normalization.
      }
    }

    normalized = normalized
      .replace(/\\\\r\\\\n/g, "\n")
      .replace(/\\\\n/g, "\n")
      .replace(/\\r\\n/g, "\n")
      .replace(/\\n/g, "\n")
      .replace(/\\\\t/g, "\t")
      .replace(/\\t/g, "\t")
      .replace(/\\\\\*/g, "*")
      .replace(/\\\*/g, "*")
      .replace(/\\\\_/g, "_")
      .replace(/\\_/g, "_")
      .replace(/\\\\`/g, "`")
      .replace(/\\`/g, "`")
      .replace(/\\\\\"/g, '"')
      .replace(/\\\"/g, '"');

    if (normalized === prev) {
      break;
    }
  }

  return normalized;
}

function MarkdownContent({ content }: { content: string }) {
  const normalizedContent = normalizeMarkdown(content);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p className="text-sm mb-1.5 last:mb-0 leading-relaxed">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="list-disc pl-4 mb-1.5 space-y-0.5 text-sm">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-4 mb-1.5 space-y-0.5 text-sm">
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => (
          <strong className="font-semibold text-purple-700 dark:text-purple-300">
            {children}
          </strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ children }) => (
          <code className="bg-black/10 dark:bg-white/10 rounded px-1 py-0.5 text-xs font-mono">
            {children}
          </code>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 text-purple-700 dark:text-purple-300 hover:text-purple-800 dark:hover:text-purple-200"
          >
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-purple-300 dark:border-purple-700 pl-3 opacity-80 my-1 text-sm">
            {children}
          </blockquote>
        ),
      }}
    >
      {normalizedContent}
    </ReactMarkdown>
  );
}

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(content).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1 rounded hover:bg-purple-100 dark:hover:bg-purple-900/30"
      aria-label="Copy message"
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3 text-purple-400" />
      )}
    </button>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 items-start animate-in fade-in-50">
      <div className="p-1.5 bg-linear-to-br from-purple-500 to-indigo-600 rounded-lg shadow">
        <Bot className="h-4 w-4 text-white" />
      </div>
      <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
          <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
          <span className="ml-1">Analyzing with tools...</span>
          <Sparkles className="h-3 w-3 text-purple-400 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function formatMessageTime(date: Date) {
  return new Intl.DateTimeFormat("en-LK", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

interface ChatEntry {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: string[];
  timestamp: Date;
  isError?: boolean;
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
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastPromptRef = useRef<string | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, [input]);

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
    setUserScrolledUp(false);
    lastPromptRef.current = null;
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

  // Smart scroll to latest unless user has intentionally scrolled up
  const scrollToBottom = useCallback(() => {
    if (!userScrolledUp) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [userScrolledUp]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setUserScrolledUp(distanceFromBottom > 80);
  };

  const sendMessage = async ({
    text,
    appendUser = true,
  }: {
    text?: string;
    appendUser?: boolean;
  } = {}) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    if (appendUser) {
      const userEntry: ChatEntry = {
        id: `${Date.now()}-user`,
        role: "user",
        content: msg,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userEntry]);
      lastPromptRef.current = msg;
    }

    setInput("");
    setUserScrolledUp(false);

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
          id: `${Date.now()}-assistant`,
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
          id: `${Date.now()}-assistant-error`,
          role: "assistant",
          content: "Failed to get a response. Please try again.",
          timestamp: new Date(),
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = (messageId: string) => {
    const lastPrompt = lastPromptRef.current;
    if (!lastPrompt) return;
    setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    sendMessage({ text: lastPrompt, appendUser: false });
  };

  return (
    <div className="rounded-xl border-2 border-purple-200 dark:border-purple-800/50 overflow-hidden shadow-lg">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-linear-to-r from-purple-50 to-indigo-50 dark:from-purple-950/50 dark:to-indigo-950/50 hover:from-purple-100 hover:to-indigo-100 dark:hover:from-purple-900/50 dark:hover:to-indigo-900/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-linear-to-br from-purple-500 to-indigo-600 rounded-lg shadow">
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
        <div className="bg-white dark:bg-slate-900 relative">
          {/* Messages */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
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
                      onClick={() => sendMessage({ text: q })}
                      className="text-xs px-3 py-1.5 rounded-full bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
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
                className={`flex gap-3 group ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in-50 slide-in-from-bottom-2`}
              >
                {msg.role === "assistant" && (
                  <div className="p-1.5 bg-linear-to-br from-purple-500 to-indigo-600 rounded-lg h-fit shadow">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] space-y-1",
                    msg.role === "user" && "items-end",
                  )}
                >
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2.5",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : msg.isError
                          ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900 rounded-bl-md"
                          : "bg-slate-50 dark:bg-slate-800 rounded-bl-md border border-slate-200 dark:border-slate-700",
                    )}
                  >
                    {msg.role === "user" ? (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    ) : (
                      <div className="text-slate-700 dark:text-slate-300">
                        <MarkdownContent content={msg.content} />
                      </div>
                    )}
                  </div>

                  <div
                    className={cn(
                      "flex items-center gap-2 px-1 text-[11px] text-muted-foreground",
                      msg.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    <span>{formatMessageTime(msg.timestamp)}</span>
                    {msg.role === "assistant" && (
                      <CopyButton content={msg.content} />
                    )}
                    {msg.role === "assistant" && msg.isError && (
                      <button
                        onClick={() => handleRetry(msg.id)}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Retry
                      </button>
                    )}
                  </div>

                  {msg.role === "assistant" &&
                    msg.toolCalls &&
                    msg.toolCalls.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 px-1">
                        {msg.toolCalls.map((tool, i) => (
                          <Badge
                            key={`${tool}-${i}`}
                            variant="outline"
                            className="text-[10px] px-2 py-0.5 bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400"
                          >
                            <Wrench className="h-3 w-3 mr-1" />
                            {TOOL_LABELS[tool] || tool}
                          </Badge>
                        ))}
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
            {loading && <TypingIndicator />}

            <div ref={messagesEndRef} />
          </div>

          {userScrolledUp && (
            <div className="absolute bottom-[74px] left-1/2 -translate-x-1/2 z-10">
              <button
                onClick={() => {
                  setUserScrolledUp(false);
                  messagesEndRef.current?.scrollIntoView({
                    behavior: "smooth",
                  });
                }}
                className="flex items-center gap-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full px-3 py-1.5 shadow-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <ChevronDown className="h-3 w-3" />
                Scroll to latest
              </button>
            </div>
          )}

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
                    onClick={() => sendMessage({ text: q })}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    {q}
                  </button>
                ))}
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2 p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 items-end">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask about ${district}... (Shift+Enter for newline)`}
              className="flex-1 resize-none rounded-2xl border bg-white dark:bg-slate-800 border-purple-200 dark:border-purple-800 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 max-h-24 overflow-y-auto"
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
              size="icon"
              className="h-10 w-10 rounded-full shrink-0 bg-linear-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow-lg"
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
