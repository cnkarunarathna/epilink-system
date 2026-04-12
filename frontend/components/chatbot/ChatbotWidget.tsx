"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
  X,
  Send,
  Bot,
  User,
  Sparkles,
  Copy,
  Check,
  ChevronDown,
  RotateCcw,
  AlertCircle,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Source {
  title: string;
  snippet: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: Source[];
  confidence?: "high" | "medium" | "low";
  note?: string;
  isError?: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const INITIAL_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hello! I'm **EpiBot** 🦟 Ask me anything about dengue prevention, symptoms, or current risk levels in Sri Lanka.",
  timestamp: new Date(),
};

const SUGGESTIONS = [
  "What are the early symptoms of dengue?",
  "How can I prevent dengue at home?",
  "When should I go to the hospital?",
];

const CHATBOT_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

const CONFIDENCE_CONFIG: Record<
  "high" | "medium" | "low",
  { label: string; className: string }
> = {
  high: {
    label: "High confidence",
    className:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  medium: {
    label: "Medium confidence",
    className:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  low: {
    label: "Low confidence",
    className:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ children }) => (
          <code className="bg-black/10 dark:bg-white/10 rounded px-1 py-0.5 text-xs font-mono">
            {children}
          </code>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-current/30 pl-3 opacity-80 my-1">
            {children}
          </blockquote>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function ConfidenceBadge({ level }: { level: "high" | "medium" | "low" }) {
  const cfg = CONFIDENCE_CONFIG[level];
  return (
    <span
      className={cn(
        "inline-block text-[10px] font-medium px-2 py-0.5 rounded-full",
        cfg.className,
      )}
    >
      {cfg.label}
    </span>
  );
}

function NoteWarning({ note }: { note: string }) {
  return (
    <div className="flex items-start gap-1.5 mt-1.5 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-2.5 py-1.5">
      <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
      <span>{note}</span>
    </div>
  );
}

function SourceCitations({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;
  return (
    <details className="mt-2 text-xs text-muted-foreground group">
      <summary className="cursor-pointer select-none hover:text-foreground transition-colors flex items-center gap-1 list-none">
        <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
        {sources.length} source{sources.length > 1 ? "s" : ""}
      </summary>
      <ul className="mt-1.5 space-y-1 pl-2 border-l border-muted">
        {sources.map((src, i) => (
          <li key={i} className="leading-relaxed">
            <span className="font-medium text-foreground/80">{src.title}</span>
            {src.snippet && (
              <p className="text-[11px] opacity-70 line-clamp-2 mt-0.5">
                {src.snippet}
              </p>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
      aria-label="Copy message"
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3 text-muted-foreground" />
      )}
    </button>
  );
}

function SuggestionChips({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 px-4 pb-3">
      {SUGGESTIONS.map((s) => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          className="text-xs rounded-full border px-3 py-1.5 hover:bg-muted transition-colors text-left"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function StatusDot({ online }: { online: boolean | null }) {
  if (online === null) return null;
  return (
    <span
      className={cn(
        "h-2 w-2 rounded-full shrink-0",
        online ? "bg-green-400" : "bg-amber-400",
      )}
      title={online ? "Online" : "Connecting…"}
    />
  );
}

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex gap-2"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <Bot className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="bg-muted rounded-2xl px-4 py-2">
        <div className="flex gap-1 items-center h-4">
          <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.3s]" />
          <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" />
        </div>
      </div>
    </motion.div>
  );
}

function ChatMessageBubble({
  message,
  onRetry,
}: {
  message: ChatMessage;
  onRetry?: (message: ChatMessage) => void;
}) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "flex gap-2 group",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-0.5",
          isUser ? "bg-primary" : "bg-muted",
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-primary-foreground" />
        ) : (
          <Bot className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Bubble + metadata */}
      <div
        className={cn("flex flex-col gap-1 max-w-[80%]", isUser && "items-end")}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm",
            isUser
              ? "bg-primary text-primary-foreground"
              : message.isError
                ? "bg-destructive/10 text-destructive border border-destructive/20"
                : "bg-muted text-foreground",
          )}
        >
          {isUser ? (
            <p className="leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>
          ) : (
            <MarkdownContent content={message.content} />
          )}
        </div>

        {/* Assistant-only metadata */}
        {!isUser && (
          <div className="flex items-center gap-2 px-1 flex-wrap">
            {message.confidence && (
              <ConfidenceBadge level={message.confidence} />
            )}
            <CopyButton content={message.content} />
            {message.isError && onRetry && (
              <button
                onClick={() => onRetry(message)}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                Retry
              </button>
            )}
          </div>
        )}

        {!isUser && message.note && <NoteWarning note={message.note} />}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="px-1">
            <SourceCitations sources={message.sources} />
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Main Widget ───────────────────────────────────────────────────────────────

export function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  const sessionIdRef = useRef<string | null>(null);
  const lastUserMessageRef = useRef<ChatMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Auto-resize textarea ──────────────────────────────────────────────────

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, [input]);

  // ── Smart scroll ──────────────────────────────────────────────────────────

  const scrollToBottom = useCallback(() => {
    if (!userScrolledUp) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [userScrolledUp]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setUserScrolledUp(distanceFromBottom > 80);
  };

  // ── Online / offline status polling ──────────────────────────────────────

  useEffect(() => {
    const check = () =>
      fetch(`${CHATBOT_API_BASE_URL}/chatbot/health`)
        .then((r) => setOnline(r.ok))
        .catch(() => setOnline(false));
    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, []);

  // ── Focus on open ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // ── Session creation ──────────────────────────────────────────────────────

  const handleOpen = async () => {
    setIsOpen(true);
    setUserScrolledUp(false);

    if (!sessionIdRef.current) {
      try {
        const res = await fetch(`${CHATBOT_API_BASE_URL}/chatbot/session`, {
          method: "POST",
        });
        if (res.ok) {
          const data = await res.json();
          sessionIdRef.current = data.session_id ?? null;
        }
      } catch {
        // best-effort; stateless chat still works
      }
    }
  };

  // ── Send message ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isTyping) return;

      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };

      lastUserMessageRef.current = userMessage;
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsTyping(true);
      setUserScrolledUp(false);

      try {
        const response = await fetch(`${CHATBOT_API_BASE_URL}/chatbot`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            session_id: sessionIdRef.current,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.detail?.message ?? data?.error ?? "Request failed",
          );
        }

        // Persist session_id from response (echoed back on every turn)
        if (data.session_id && !sessionIdRef.current) {
          sessionIdRef.current = data.session_id;
        }

        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.response,
          timestamp: new Date(),
          sources: data.sources ?? [],
          confidence: data.confidence ?? undefined,
          note: data.note ?? undefined,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (error) {
        console.error("Chat API error:", error);
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content:
              "Sorry, I'm having trouble connecting right now. Please try again in a moment.",
            timestamp: new Date(),
            isError: true,
          },
        ]);
      } finally {
        setIsTyping(false);
      }
    },
    [isTyping],
  );

  const handleSend = () => sendMessage(input);

  const handleRetry = (errorMessage: ChatMessage) => {
    // Remove the error bubble, then re-send the last user message
    setMessages((prev) => prev.filter((m) => m.id !== errorMessage.id));
    if (lastUserMessageRef.current) {
      sendMessage(lastUserMessageRef.current.content);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const showSuggestions = messages.length === 1 && !isTyping;

  return (
    <>
      {/* Floating Action Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <Button
              size="lg"
              className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow"
              onClick={handleOpen}
            >
              <MessageCircle className="h-6 w-6" />
              <span className="sr-only">Open chat</span>
            </Button>
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-primary" />
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={cn(
              "fixed z-50",
              // Mobile: full screen
              "inset-0",
              // Desktop: fixed bottom-right panel
              "sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[400px]",
            )}
          >
            <div
              className={cn(
                "flex flex-col bg-background border shadow-2xl overflow-hidden",
                // Mobile: full height, no rounded corners
                "h-full rounded-none",
                // Desktop: fixed height, rounded corners
                "sm:h-[580px] sm:max-h-[calc(100vh-3rem)] sm:rounded-2xl",
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b bg-primary text-primary-foreground shrink-0">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/20">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-semibold text-sm">EpiBot</h3>
                      <StatusDot online={online} />
                    </div>
                    <p className="text-xs text-primary-foreground/80">
                      Dengue Information Assistant
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close chat</span>
                </Button>
              </div>

              {/* Messages */}
              <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 space-y-4"
              >
                {messages.map((message) => (
                  <ChatMessageBubble
                    key={message.id}
                    message={message}
                    onRetry={handleRetry}
                  />
                ))}

                {isTyping && <TypingIndicator />}

                <div ref={messagesEndRef} />
              </div>

              {/* Suggestion chips — shown only before first user message */}
              {showSuggestions && (
                <SuggestionChips onSelect={(s) => sendMessage(s)} />
              )}

              {/* Scroll-to-bottom nudge */}
              <AnimatePresence>
                {userScrolledUp && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="absolute bottom-20 left-1/2 -translate-x-1/2 sm:bottom-24"
                  >
                    <button
                      onClick={() => {
                        setUserScrolledUp(false);
                        messagesEndRef.current?.scrollIntoView({
                          behavior: "smooth",
                        });
                      }}
                      className="flex items-center gap-1.5 text-xs bg-background border rounded-full px-3 py-1.5 shadow-md hover:bg-muted transition-colors"
                    >
                      <ChevronDown className="h-3 w-3" />
                      Scroll to latest
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Input Bar */}
              <div className="p-3 border-t bg-muted/30 shrink-0">
                <div className="flex gap-2 items-end">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about dengue… (Shift+Enter for newline)"
                    disabled={isTyping}
                    className="flex-1 resize-none rounded-2xl border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary max-h-24 overflow-y-auto disabled:opacity-50"
                  />
                  <Button
                    size="icon"
                    className="h-10 w-10 rounded-full shrink-0"
                    onClick={handleSend}
                    disabled={!input.trim() || isTyping}
                  >
                    <Send className="h-4 w-4" />
                    <span className="sr-only">Send message</span>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Powered by EpiLink AI
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
