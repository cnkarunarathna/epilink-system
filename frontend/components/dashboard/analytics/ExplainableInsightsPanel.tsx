"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Brain,
  Lightbulb,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  BookOpen,
  RefreshCw,
  Loader2,
  Sparkles,
  ChevronRight,
  Info,
  Gauge,
} from "lucide-react";
import {
  fetchExplainableInsight,
  ExplainInsightResponse,
} from "@/services/analytics.service";
import InsightChatPanel from "./InsightChatPanel";

const riskConfig = {
  critical: {
    color: "bg-red-500",
    text: "text-red-700 dark:text-red-400",
    bg: "from-red-50 to-red-100 dark:from-red-950/60 dark:to-red-900/40",
    border: "border-red-300 dark:border-red-800",
    badge: "destructive" as const,
    glow: "shadow-red-200/50 dark:shadow-red-900/30",
    barColor: "bg-red-500",
  },
  high: {
    color: "bg-orange-500",
    text: "text-orange-700 dark:text-orange-400",
    bg: "from-orange-50 to-orange-100 dark:from-orange-950/60 dark:to-orange-900/40",
    border: "border-orange-300 dark:border-orange-800",
    badge: "destructive" as const,
    glow: "shadow-orange-200/50 dark:shadow-orange-900/30",
    barColor: "bg-orange-500",
  },
  moderate: {
    color: "bg-yellow-500",
    text: "text-yellow-700 dark:text-yellow-400",
    bg: "from-yellow-50 to-amber-100 dark:from-yellow-950/60 dark:to-amber-900/40",
    border: "border-yellow-300 dark:border-yellow-800",
    badge: "default" as const,
    glow: "shadow-yellow-200/50 dark:shadow-yellow-900/30",
    barColor: "bg-yellow-500",
  },
  low: {
    color: "bg-green-500",
    text: "text-green-700 dark:text-green-400",
    bg: "from-green-50 to-emerald-100 dark:from-green-950/60 dark:to-emerald-900/40",
    border: "border-green-300 dark:border-green-800",
    badge: "secondary" as const,
    glow: "shadow-green-200/50 dark:shadow-green-900/30",
    barColor: "bg-green-500",
  },
};

const trendIcons = {
  rising: <TrendingUp className="h-5 w-5 text-red-500" />,
  falling: <TrendingDown className="h-5 w-5 text-green-500" />,
  stable: <Minus className="h-5 w-5 text-blue-500" />,
};

const trendLabels = {
  rising: { text: "Rising", color: "text-red-600 dark:text-red-400" },
  falling: { text: "Falling", color: "text-green-600 dark:text-green-400" },
  stable: { text: "Stable", color: "text-blue-600 dark:text-blue-400" },
};

interface Props {
  district: string | null;
  districts?: string[];
  onDistrictChange?: (district: string) => void;
}

export default function ExplainableInsightsPanel({
  district,
  districts = [],
  onDistrictChange,
}: Props) {
  const [insight, setInsight] = useState<ExplainInsightResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (district) {
      loadInsight(district);
    } else {
      setInsight(null);
      setError(null);
    }
  }, [district]);

  const loadInsight = async (name: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchExplainableInsight(name);
      if (data.error) {
        setError(data.error);
        setInsight(null);
      } else {
        setInsight(data);
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message || err.message || "Failed to load insights"
      );
      setInsight(null);
    } finally {
      setLoading(false);
    }
  };



  // ── Empty state ──
  if (!district) {
    return (
      <div className="space-y-4">
        {/* District picker when no district selected */}
        {districts.length > 0 && (
          <div className="flex items-center gap-3">
            <Select onValueChange={(v) => onDistrictChange?.(v)}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select a district to analyze..." />
              </SelectTrigger>
              <SelectContent>
                {districts.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <Card className="border-2 border-dashed border-purple-200 dark:border-purple-800/50">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/40 dark:to-indigo-900/40 rounded-2xl mb-4 shadow-lg shadow-purple-200/30 dark:shadow-purple-900/20">
              <Brain className="h-10 w-10 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-200 mb-1">
              AI-Powered Explainable Insights
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Select a district above or from the map to generate an AI-driven
              explanation of the current dengue risk assessment with actionable
              recommendations.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Loading state ──
  if (loading) {
    return (
      <Card className="border-2 border-purple-200 dark:border-purple-800/50 shadow-xl shadow-purple-100/30 dark:shadow-purple-900/10">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/50 dark:to-indigo-950/50">
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg shadow-lg">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <span>Generating AI Insights for {district}...</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="py-12">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-purple-400/20 animate-ping" />
              <Loader2 className="h-10 w-10 animate-spin text-purple-600 dark:text-purple-400 relative" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                Analyzing with Gemini AI...
              </p>
              <p className="text-xs text-muted-foreground">
                Evaluating risk factors, historical trends, and generating
                expert recommendations
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <Card className="border-2 border-red-200 dark:border-red-800/50">
        <CardHeader className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/50 dark:to-orange-950/50">
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            Insight Unavailable
          </CardTitle>
        </CardHeader>
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadInsight(district)}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!insight) return null;

  const config = riskConfig[insight.risk_level] || riskConfig.low;
  const trend = trendLabels[insight.trend_direction] || trendLabels.stable;
  const confidenceColor =
    insight.confidence_score >= 75
      ? "text-green-600 dark:text-green-400"
      : insight.confidence_score >= 50
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-red-600 dark:text-red-400";
  const confidenceBarColor =
    insight.confidence_score >= 75
      ? "bg-green-500"
      : insight.confidence_score >= 50
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <div className="space-y-4">
      {/* District quick-selector */}
      {districts.length > 0 && (
        <div className="flex items-center gap-3">
          <Select
            value={district}
            onValueChange={(v) => onDistrictChange?.(v)}
          >
            <SelectTrigger className="w-[280px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {districts.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => loadInsight(district)}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Card
        className={`border-2 ${config.border} shadow-xl ${config.glow} transition-all duration-500 animate-in fade-in-50 slide-in-from-bottom-5`}
      >
        {/* Header */}
        <CardHeader className={`bg-gradient-to-r ${config.bg}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg shadow-lg">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  AI Insights — {insight.district}
                  {insight._fallback && (
                    <Badge variant="outline" className="text-xs">
                      Fallback
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="mt-0.5">
                  Explainable risk analysis powered by Gemini AI
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={config.badge}
                className="text-sm px-3 py-1.5 font-semibold uppercase tracking-wide"
              >
                {insight.risk_level} Risk
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => loadInsight(district)}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Top metrics row: Confidence + Trend + Risk Score */}
          <div className="grid grid-cols-3 gap-4">
            {/* Confidence */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Gauge className="h-4 w-4 text-slate-500" />
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Confidence
                </span>
              </div>
              <div className={`text-3xl font-bold ${confidenceColor}`}>
                {insight.confidence_score}%
              </div>
              <div className="mt-2 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-out ${confidenceBarColor}`}
                  style={{ width: `${insight.confidence_score}%` }}
                />
              </div>
            </div>

            {/* Trend */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Trend
                </span>
              </div>
              <div className="flex items-center justify-center gap-2">
                {trendIcons[insight.trend_direction]}
                <span className={`text-xl font-bold ${trend.color}`}>
                  {trend.text}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Case trajectory
              </p>
            </div>

            {/* Risk Score Bar */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <ShieldAlert className="h-4 w-4 text-slate-500" />
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Risk Level
                </span>
              </div>
              <div
                className={`text-xl font-bold uppercase ${config.text}`}
              >
                {insight.risk_level}
              </div>
              <div className="mt-2 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-out ${config.barColor}`}
                  style={{
                    width: `${insight.risk_level === "critical" ? 100 : insight.risk_level === "high" ? 75 : insight.risk_level === "moderate" ? 50 : 25}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-blue-100 dark:bg-blue-900/50 rounded-lg mt-0.5 shrink-0">
                <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  AI Summary
                </h4>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {insight.summary}
                </p>
              </div>
            </div>
          </div>

          {/* Key Drivers + Recommendations grid */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Key Drivers */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <div className="p-1.5 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                Key Drivers
              </h4>
              <div className="space-y-2">
                {insight.key_drivers.map((driver, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 hover:shadow-sm transition-shadow animate-in slide-in-from-left-3"
                    style={{ animationDelay: `${idx * 80}ms` }}
                  >
                    <ChevronRight className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {driver}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendations */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <div className="p-1.5 bg-green-100 dark:bg-green-900/50 rounded-lg">
                  <Lightbulb className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                Recommendations
              </h4>
              <div className="space-y-2">
                {insight.recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 p-3 rounded-lg bg-green-50/50 dark:bg-green-950/30 border border-green-100 dark:border-green-900/40 hover:shadow-sm transition-shadow animate-in slide-in-from-right-3"
                    style={{ animationDelay: `${idx * 80}ms` }}
                  >
                    <ChevronRight className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {rec}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Caveats */}
          {insight.caveats.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <Info className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                </div>
                Caveats
              </h4>
              <div className="space-y-1.5">
                {insight.caveats.map((caveat, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
                  >
                    <Info className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {caveat}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* References */}
          {insight.references.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
                  <BookOpen className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                References
              </h4>
              <div className="flex flex-wrap gap-2">
                {insight.references.map((ref, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="text-xs bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800"
                  >
                    {ref}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Interactive Chat Panel */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-5">
            <InsightChatPanel district={insight.district} />
          </div>

          {/* Phase indicator */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
            <span className="text-xs text-muted-foreground">
              {insight.implementation_phase}
            </span>
            <Badge variant="outline" className="text-xs gap-1">
              <Sparkles className="h-3 w-3" />
              EpiLink XAI
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
