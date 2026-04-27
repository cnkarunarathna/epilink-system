"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  User,
  Loader2,
  Wrench,
  Sparkles,
  TrendingUp,
  Activity,
  Shield,
  Globe,
  AlertTriangle,
} from "lucide-react";

// ── Shared types ───────────────────────────────────────────────────

export interface ChatEntry {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: string[];
  timestamp: Date;
}

// ── Tool label mapping ─────────────────────────────────────────────

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
  get_national_briefing: "National Briefing",
  get_weekly_ml_forecast: "ML Forecast",
  get_rapid_hotspots: "Rapid Hotspots",
  get_historical_range: "Historical Range",
  get_year_over_year_comparison: "Year-over-Year",
  get_colombo_ds_breakdown: "Colombo DS Zones",
  get_field_response_capacity: "Field Capacity",
  evaluate_national_intervention_effectiveness: "Intervention Scorecard",
};

// ── Preset question categories ─────────────────────────────────────

interface PresetCategory {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  chipClass: string;
  labelClass: string;
  questions: string[];
}

const PRESET_CATEGORIES: PresetCategory[] = [
  {
    id: "national",
    label: "National Overview",
    icon: Globe,
    chipClass:
      "bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/50",
    labelClass: "text-purple-500",
    questions: [
      "Summarize the current national dengue situation",
      "Which districts need immediate attention?",
      "How many districts are in active outbreak?",
      "Compare the top 3 risk districts",
    ],
  },
  {
    id: "forecast",
    label: "Forecast & Trends",
    icon: TrendingUp,
    chipClass:
      "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50",
    labelClass: "text-blue-500",
    questions: [
      "What does the ML model forecast for next week?",
      "Which districts are growing fastest?",
      "How does this year compare to last year nationally?",
      "What is the weather impact on dengue?",
    ],
  },
  {
    id: "performance",
    label: "Response Performance",
    icon: Activity,
    chipClass:
      "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/50",
    labelClass: "text-amber-500",
    questions: [
      "Which districts respond best to outbreaks?",
      "Where is vector control most effective nationally?",
      "Which districts need capacity support?",
      "Rank districts by intervention effectiveness",
    ],
  },
  {
    id: "operational",
    label: "Operational",
    icon: Shield,
    chipClass:
      "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50",
    labelClass: "text-emerald-500",
    questions: [
      "Are field teams nationally coping with the workload?",
      "Which district has the most overdue tasks?",
      "What is the national task completion rate?",
    ],
  },
];

// ── Smart follow-up suggestions ────────────────────────────────────

const TOOL_FOLLOWUPS: Record<string, string[]> = {
  get_national_briefing: [
    "Which districts need immediate intervention?",
    "Which districts respond best to outbreaks?",
    "How does this week compare to last week nationally?",
  ],
  get_rapid_hotspots: [
    "What resources should be deployed to the top hotspots?",
    "Are outbreak alerts active in these hotspot districts?",
    "Are field teams coping in the highest-burden districts?",
  ],
  compare_districts: [
    "What is driving the difference between these districts?",
    "Which of these districts respond best to interventions?",
    "Are field teams coping in the highest-burden district?",
  ],
  get_weekly_ml_forecast: [
    "How accurate have the recent predictions been?",
    "Which districts are forecast to rise most sharply?",
    "How does this forecast compare to last week?",
  ],
  get_growth_rate: [
    "Which district is growing fastest right now?",
    "Are neighboring districts also rising?",
    "What does the model forecast for next week?",
  ],
  get_weather_correlation: [
    "Are there active outbreak alerts right now?",
    "What does the ML model predict for next week?",
    "Which districts are most weather-sensitive?",
  ],
  get_outbreak_alerts: [
    "Are field teams coping with the current outbreaks?",
    "What resources should be deployed immediately?",
    "Which of these districts respond best to interventions?",
  ],
  evaluate_national_intervention_effectiveness: [
    "Which districts need the most capacity support?",
    "How do the top responders control outbreaks?",
    "Are the poorest responders currently in active outbreak?",
  ],
  get_field_response_capacity: [
    "Which districts have the most overdue tasks nationally?",
    "How does field capacity correlate with outbreak control?",
    "Which districts need PHI capacity support?",
  ],
  get_year_over_year_comparison: [
    "Is the current year on track to exceed last year?",
    "What seasonal patterns explain year-to-year variation?",
    "Which districts improved most year over year?",
  ],
  get_historical_range: [
    "How does this period compare to the same period last year?",
    "What interventions were active during this window?",
    "What does the model predict for the coming weeks?",
  ],
  get_district_details: [
    "What is the seasonal pattern here?",
    "Are field teams coping with this case load?",
    "What does the model predict for next week?",
  ],
  year_over_year: [
    "How does this year compare to last year?",
    "What is the typical seasonal peak here?",
    "How does the weather affect case numbers?",
  ],
  get_intervention_history: [
    "How quickly was the last outbreak controlled here?",
    "Are field teams currently keeping pace?",
    "Which districts have the fastest response times nationally?",
  ],
  get_seasonal_pattern: [
    "Are we currently in peak transmission season?",
    "How does this year compare to the seasonal baseline?",
    "Which districts are entering their peak season now?",
  ],
  get_demographic_hotspots: [
    "How should resources be allocated across these zones?",
    "Are field teams covering the highest-risk zones?",
  ],
  get_colombo_ds_breakdown: [
    "Which Colombo DS zone needs the most urgent attention?",
    "How should PHI resources be allocated within Colombo?",
  ],
};

function getSmartFollowups(messages: ChatEntry[], used: Set<string>): string[] {
  const lastWithTools = [...messages]
    .reverse()
    .find((m) => m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0);
  if (!lastWithTools?.toolCalls) return [];
  const suggestions: string[] = [];
  for (const tool of lastWithTools.toolCalls) {
    for (const q of TOOL_FOLLOWUPS[tool] ?? []) {
      if (!used.has(q) && !suggestions.includes(q)) {
        suggestions.push(q);
        if (suggestions.length >= 3) return suggestions;
      }
    }
  }
  return suggestions;
}

// ── Markdown normaliser ────────────────────────────────────────────

function normalizeMarkdown(content: string) {
  let normalized = content;
  for (let i = 0; i < 3; i += 1) {
    const prev = normalized;
    const trimmed = normalized.trim();
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === "string") normalized = parsed;
      } catch {
        // ignore
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
    if (normalized === prev) break;
  }
  return normalized;
}

function MarkdownContent({ content }: { content: string }) {
  const normalized = normalizeMarkdown(content);
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p className="text-[13px] mb-1.5 last:mb-0 leading-relaxed">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="list-disc pl-4 mb-1.5 space-y-0.5 text-[13px]">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-4 mb-1.5 space-y-0.5 text-[13px]">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => (
          <strong className="font-semibold text-purple-700 dark:text-purple-300">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ children }) => (
          <code className="bg-black/10 dark:bg-white/10 rounded px-1 py-0.5 text-[11px] font-mono">
            {children}
          </code>
        ),
      }}
    >
      {normalized}
    </ReactMarkdown>
  );
}

// ── ChatWindow ─────────────────────────────────────────────────────

interface ChatWindowProps {
  messages: ChatEntry[];
  loading: boolean;
  isLoadingHistory: boolean;
  sessionExpired: boolean;
  district: string;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onSendMessage: (text?: string) => void;
}

export function ChatWindow({
  messages,
  loading,
  isLoadingHistory,
  sessionExpired,
  district,
  scrollRef,
  onSendMessage,
}: ChatWindowProps) {
  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
      {/* Loading history spinner */}
      {isLoadingHistory && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
        </div>
      )}

      {/* Session expired banner */}
      {sessionExpired && !isLoadingHistory && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-[12px]">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            This conversation has expired. Start a new chat below.
          </span>
        </div>
      )}

      {/* Welcome / empty state */}
      {!isLoadingHistory && !sessionExpired && messages.length === 0 && !loading && (
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
              {district !== "Sri Lanka"
                ? `Analyzing ${district} — ask me anything`
                : "I can analyze trends, compare districts, and provide actionable insights"}
            </p>
          </div>
          <div className="text-left space-y-3 mt-1">
            {PRESET_CATEGORIES.map((cat) => {
              const CatIcon = cat.icon;
              return (
                <div key={cat.id}>
                  <div className={`flex items-center gap-1 mb-1.5 ${cat.labelClass}`}>
                    <CatIcon className="h-3 w-3" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider">
                      {cat.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {cat.questions.slice(0, 2).map((q) => (
                      <button
                        key={q}
                        onClick={() => onSendMessage(q)}
                        className={`text-[11px] px-2.5 py-1.5 rounded-full border transition-colors ${cat.chipClass}`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Messages */}
      {!isLoadingHistory &&
        messages.map((msg) => (
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
              {msg.role === "user" ? (
                <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <div className="text-slate-700 dark:text-slate-300">
                  <MarkdownContent content={msg.content} />
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="p-1 bg-primary rounded-lg h-fit shadow shrink-0 mt-0.5">
                <User className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
            )}
          </div>
        ))}

      {/* Loading indicator */}
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
                <span
                  className="w-1 h-1 bg-purple-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="w-1 h-1 bg-purple-400 rounded-full animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="w-1 h-1 bg-purple-400 rounded-full animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Smart follow-up suggestions */}
      {!isLoadingHistory &&
        messages.length > 0 &&
        messages.length < 8 &&
        !loading &&
        (() => {
          const used = new Set(messages.map((m) => m.content));
          const smart = getSmartFollowups(messages, used);
          const fallback = PRESET_CATEGORIES.flatMap((c) => c.questions)
            .filter((q) => !used.has(q))
            .slice(0, 2);
          const display = smart.length > 0 ? smart.slice(0, 2) : fallback;
          if (display.length === 0) return null;
          return (
            <div className="space-y-1">
              {smart.length > 0 && (
                <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-2 w-2" />
                  Suggested
                </p>
              )}
              <div className="flex flex-wrap gap-1">
                {display.map((q) => (
                  <button
                    key={q}
                    onClick={() => onSendMessage(q)}
                    className="text-[10px] px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors truncate max-w-[200px]"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}
    </div>
  );
}
