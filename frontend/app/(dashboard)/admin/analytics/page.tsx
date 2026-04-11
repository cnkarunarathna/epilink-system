"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSocketEvent } from "@/hooks/useSocket";
import { useSocket } from "@/contexts/SocketContext";
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
  BarChart3,
  RefreshCw,
  Loader2,
  MapPin,
  TrendingUp,
  Activity,
  Thermometer,
  History,
  Sparkles,
  Zap,
  AlertTriangle,
  Wifi,
  WifiOff,
  Brain,
  Globe,
  X,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import SriLankaMap from "@/components/dashboard/maps/SriLankaMap";
import OutbreakAlerts from "@/components/dashboard/analytics/OutbreakAlerts";
import HotspotsPanel from "@/components/dashboard/analytics/HotspotsPanel";
import GrowthRatePanel from "@/components/dashboard/analytics/GrowthRatePanel";
import WeatherCorrelation from "@/components/dashboard/analytics/WeatherCorrelation";
import ExplainableInsightsPanel from "@/components/dashboard/analytics/ExplainableInsightsPanel";
import FloatingChatBubble from "@/components/dashboard/analytics/FloatingChatBubble";
import NationalSummaryPanel from "@/components/dashboard/analytics/NationalSummaryPanel";
import AdvancedAnalyticsPanel from "@/components/dashboard/analytics/AdvancedAnalyticsPanel";
import {
  fetchLatestPerDistrict,
  fetchTimeseries,
  fetchDashboardSummary,
  fetchTrends,
  fetchColomboDsBreakdown,
  type ColomboDsBreakdownResponse,
} from "@/services/analytics.service";
import ColomboDsBreakdownModal from "@/components/dashboard/analytics/ColomboDsBreakdownModal";
import {
  BarChart as RechartsBar,
  Bar,
  XAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import HistoricalAnalytics from "./historical/page";

interface DistrictPrediction {
  district: string;
  predicted_cases: number;
}

interface DashboardSummary {
  current_week: { year: number; week: number };
  total_cases: number;
  previous_total: number;
  change_percent: number;
  district_count: number;
  high_risk_districts: number;
  avg_temperature: number | null;
}

interface TrendData {
  year: number;
  week: number;
  total_cases: number;
  avg_temperature: number | null;
  avg_precipitation: number | null;
}

interface TimeSeriesData {
  year: number;
  week: number;
  cases: number;
  temperature: number | null;
  precipitation: number | null;
}

type AnalyticsPanel =
  | "map"
  | "trends"
  | "alerts"
  | "hotspots"
  | "ai"
  | "historical"
  | "national";

const NAV_ITEMS: {
  key: AnalyticsPanel;
  label: string;
  icon: React.ElementType;
  description: string;
}[] = [
  {
    key: "map",
    label: "Risk Map",
    icon: MapPin,
    description: "Interactive district risk map",
  },
  {
    key: "trends",
    label: "Trends",
    icon: TrendingUp,
    description: "12-week case trends & top districts",
  },
  {
    key: "alerts",
    label: "Alerts",
    icon: AlertTriangle,
    description: "Active outbreak alerts",
  },
  {
    key: "hotspots",
    label: "Hotspots",
    icon: Zap,
    description: "Hotspots, growth rates & weather",
  },
  {
    key: "ai",
    label: "AI Insights",
    icon: Brain,
    description: "Explainable AI risk analysis",
  },
  {
    key: "historical",
    label: "Historical",
    icon: History,
    description: "Historical analytics & patterns",
  },
  {
    key: "national",
    label: "National",
    icon: Globe,
    description: "National situation report",
  },
];

export default function AnalyticsPage() {
  const [predictions, setPredictions] = useState<DistrictPrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<AnalyticsPanel>("map");
  const [chatOpen, setChatOpen] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [districtTimeseries, setDistrictTimeseries] = useState<
    TimeSeriesData[]
  >([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [dsBreakdownOpen, setDsBreakdownOpen] = useState(false);
  const [dsBreakdown, setDsBreakdown] = useState<ColomboDsBreakdownResponse | null>(null);
  const [dsBreakdownLoading, setDsBreakdownLoading] = useState(false);

  const { isConnected } = useSocket();
  const hasFetchedRef = useRef(false);

  const handleAnalyticsUpdated = useCallback(
    (data: { type: string; payload?: any }) => {
      console.log("Analytics update received:", data.type);
      switch (data.type) {
        case "predictions":
        case "summary":
        case "trends":
        case "full":
          loadDashboardData();
          toast.info("Real-time Update", {
            description: "New analytics data received",
          });
          break;
        default:
          loadDashboardData();
      }
    },
    [],
  );

  useSocketEvent("analytics:updated", handleAnalyticsUpdated, [
    handleAnalyticsUpdated,
  ]);

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [latestData, summaryData, trendsData] = await Promise.all([
        fetchLatestPerDistrict(),
        fetchDashboardSummary(),
        fetchTrends(12),
      ]);

      const preds = latestData
        .filter((d) => d.district && d.district.trim().length > 0)
        .map((d) => ({
          district: d.district,
          predicted_cases: d.predicted_cases,
        }))
        .sort((a, b) => b.predicted_cases - a.predicted_cases);

      setPredictions(preds);
      setSummary(summaryData);
      setTrends(trendsData);
      setLastUpdated(new Date());
    } catch (error: any) {
      toast.error("Failed to load dashboard", {
        description: error.response?.data?.message || error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDistrictClick = async (district: string) => {
    setSelectedDistrict(district);
    const districtData = predictions.find((p) => p.district === district);
    if (districtData) {
      toast.info(district, {
        description: `Current forecast: ${districtData.predicted_cases} cases`,
      });
    }
    try {
      const ts = await fetchTimeseries(district);
      setDistrictTimeseries(ts || []);
    } catch (error: any) {
      console.error("Failed to load timeseries:", error);
    }
  };

  const openDsBreakdown = async () => {
    setDsBreakdownOpen(true);
    if (dsBreakdown) return; // already loaded
    try {
      setDsBreakdownLoading(true);
      const data = await fetchColomboDsBreakdown();
      setDsBreakdown(data);
    } catch (error: any) {
      toast.error("Failed to load DS breakdown", {
        description: error.response?.data?.message || error.message,
      });
      setDsBreakdownOpen(false);
    } finally {
      setDsBreakdownLoading(false);
    }
  };

  const topRiskDistricts = predictions.slice(0, 10);

  const getRiskLevel = (cases: number): { level: string; color: string } => {
    if (cases >= 100) return { level: "Very High", color: "destructive" };
    if (cases >= 50) return { level: "High", color: "destructive" };
    if (cases >= 25) return { level: "Medium", color: "default" };
    if (cases >= 10) return { level: "Low", color: "secondary" };
    return { level: "Very Low", color: "outline" };
  };

  const getRiskBadgeClass = (level: string): string => {
    switch (level) {
      case "Very High":
        return "bg-red-600 text-white border-red-700";
      case "High":
        return "bg-orange-500 text-white border-orange-600";
      case "Medium":
        return "bg-amber-400 text-amber-950 border-amber-500";
      case "Low":
        return "bg-sky-400 text-sky-950 border-sky-500";
      case "Very Low":
        return "bg-emerald-400 text-emerald-950 border-emerald-500";
      default:
        return "";
    }
  };

  const getRiskDotClass = (level: string): string => {
    switch (level) {
      case "Very High":
        return "bg-red-600";
      case "High":
        return "bg-orange-500";
      case "Medium":
        return "bg-amber-400";
      case "Low":
        return "bg-sky-400";
      case "Very Low":
        return "bg-emerald-400";
      default:
        return "bg-muted-foreground";
    }
  };

  const selectedPrediction = selectedDistrict
    ? (predictions.find((p) => p.district === selectedDistrict) ?? null)
    : null;

  return (
    <div className="space-y-4">
      {/* ── Header Banner ─────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-xl bg-linear-to-br from-green-700 via-emerald-700 to-green-900 p-8 text-white shadow-xl">
        <div className="absolute inset-0 bg-grid-white/10 mask-[linear-gradient(0deg,transparent,white)]" />
        <div className="absolute -top-16 -right-16 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-green-300/10 blur-2xl pointer-events-none" />
        <div className="relative">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <h2 className="text-4xl font-bold tracking-tight flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <BarChart3 className="h-8 w-8" />
                </div>
                Dengue Risk Forecast
              </h2>
              <p className="text-green-100 text-lg">
                Real-time predictions, trends, and AI-driven insights for dengue
                case monitoring
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className={`flex items-center gap-1.5 px-2.5 py-1 border font-medium text-xs ${
                    isConnected
                      ? "bg-emerald-400/20 text-emerald-100 border-emerald-400/50"
                      : "bg-red-400/20 text-red-200 border-red-400/50"
                  }`}
                >
                  {isConnected ? (
                    <Wifi className="h-3 w-3" />
                  ) : (
                    <WifiOff className="h-3 w-3" />
                  )}
                  {isConnected ? "Live" : "Offline"}
                </Badge>
                {lastUpdated && (
                  <span className="text-xs text-green-200/70">
                    Updated{" "}
                    {lastUpdated.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
            </div>
            {summary && (
              <div className="flex gap-3 shrink-0">
                <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4 text-center min-w-20 border border-white/20">
                  <div className="text-xs text-green-200 font-medium uppercase tracking-wide mb-1">
                    Week
                  </div>
                  <div className="text-3xl font-bold leading-none">
                    {summary.current_week.week}
                  </div>
                  <div className="text-xs text-green-300 mt-1">
                    {summary.current_week.year}
                  </div>
                </div>
                <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4 text-center min-w-[100px] border border-white/20">
                  <div className="text-xs text-green-200 font-medium uppercase tracking-wide mb-1">
                    Total Cases
                  </div>
                  <div className="text-3xl font-bold leading-none">
                    {summary.total_cases.toLocaleString()}
                  </div>
                  <div
                    className={`text-xs mt-1 font-semibold ${
                      summary.change_percent >= 0
                        ? "text-red-300"
                        : "text-emerald-300"
                    }`}
                  >
                    {summary.change_percent >= 0 ? "▲" : "▼"}{" "}
                    {Math.abs(summary.change_percent).toFixed(1)}%
                  </div>
                </div>
                <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4 text-center min-w-20 border border-white/20">
                  <div className="text-xs text-green-200 font-medium uppercase tracking-wide mb-1">
                    High Risk
                  </div>
                  <div className="text-3xl font-bold leading-none text-red-300">
                    {summary.high_risk_districts}
                  </div>
                  <div className="text-xs text-green-300 mt-1">districts</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Sticky metrics bar + district context strip ────────── */}
      <div className="sticky top-16 z-30 -mx-4 sm:-mx-6 bg-background/95 backdrop-blur-sm border-b border-border">
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
            {/* Total Cases */}
            <div className="bg-background px-4 py-3 flex items-center gap-3">
              <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/40 rounded-md shrink-0">
                <Activity className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Total Cases</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold tabular-nums">
                    {summary.total_cases.toLocaleString()}
                  </span>
                  <span
                    className={`text-xs font-semibold ${
                      summary.change_percent >= 0
                        ? "text-red-500"
                        : "text-emerald-500"
                    }`}
                  >
                    {summary.change_percent >= 0 ? "▲" : "▼"}
                    {Math.abs(summary.change_percent).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* High Risk Districts */}
            <div className="bg-background px-4 py-3 flex items-center gap-3">
              <div className="p-1.5 bg-red-100 dark:bg-red-900/40 rounded-md shrink-0">
                <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">High Risk</p>
                <span className="text-sm font-bold tabular-nums">
                  {summary.high_risk_districts} districts
                </span>
              </div>
            </div>

            {/* Districts Covered */}
            <div className="bg-background px-4 py-3 flex items-center gap-3">
              <div className="p-1.5 bg-green-100 dark:bg-green-900/40 rounded-md shrink-0">
                <MapPin className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Coverage</p>
                <span className="text-sm font-bold tabular-nums">
                  {summary.district_count} districts
                </span>
              </div>
            </div>

            {/* Avg Temperature */}
            <div className="bg-background px-4 py-3 flex items-center gap-3">
              <div className="p-1.5 bg-orange-100 dark:bg-orange-900/40 rounded-md shrink-0">
                <Thermometer className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Avg Temp</p>
                <span className="text-sm font-bold tabular-nums">
                  {summary.avg_temperature
                    ? `${summary.avg_temperature.toFixed(1)}°C`
                    : "N/A"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* District context strip */}
        {selectedDistrict && selectedPrediction && (() => {
          const risk = getRiskLevel(selectedPrediction.predicted_cases);
          return (
            <div className="flex items-center gap-3 px-4 sm:px-6 py-2 bg-primary/5 border-t border-primary/20">
              <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-sm font-semibold text-primary">
                {selectedDistrict}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {selectedPrediction.predicted_cases.toLocaleString()} cases
              </span>
              <Badge
                variant="outline"
                className={`text-xs ${getRiskBadgeClass(risk.level)}`}
              >
                {risk.level}
              </Badge>
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setSelectedDistrict(null);
                  setDistrictTimeseries([]);
                }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })()}
      </div>

      {/* ── Main layout: nav rail + panel area ────────────────── */}
      <div className="flex gap-5 items-start">
        {/* Desktop Nav Rail */}
        <nav className="hidden md:flex flex-col gap-1 w-44 shrink-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 px-1">
            Views
          </p>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => setActivePanel(item.key)}
              title={item.description}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-left w-full transition-all ${
                activePanel === item.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </button>
          ))}

          {/* AI Chat toggle */}
          <div className="mt-2 pt-2 border-t border-border">
            <button
              onClick={() => setChatOpen((v) => !v)}
              title="AI Chat Analyst"
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-left w-full transition-all ${
                chatOpen
                  ? "bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <MessageSquare className="h-4 w-4 shrink-0" />
              AI Chat
            </button>
          </div>

          {/* Refresh at bottom of rail */}
          <div className="mt-2 pt-2 border-t border-border space-y-2">
            <Button
              onClick={loadDashboardData}
              disabled={loading}
              variant="outline"
              size="sm"
              className="w-full"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              <span className="ml-1.5">{loading ? "Loading…" : "Refresh"}</span>
            </Button>
            {lastUpdated && !loading && (
              <p className="text-xs text-muted-foreground text-center">
                {lastUpdated.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
        </nav>

        {/* Panel Content */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Mobile nav strip */}
          <div className="flex md:hidden gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                onClick={() => setActivePanel(item.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                  activePanel === item.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            ))}
          </div>

          {/* Mobile refresh */}
          <div className="flex md:hidden items-center justify-end gap-3">
            {lastUpdated && !loading && (
              <span className="text-xs text-muted-foreground">
                {lastUpdated.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            )}
            <Button
              onClick={loadDashboardData}
              disabled={loading}
              size="sm"
              variant="outline"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              <span className="ml-1.5">{loading ? "Loading…" : "Refresh"}</span>
            </Button>
          </div>

          {/* ── Risk Map Panel ──────────────────────────────────── */}
          {activePanel === "map" && (
            <div className="space-y-6 animate-in fade-in-50 duration-300">
              <Card className="border-2 border-primary/20 shadow-xl bg-linear-to-br from-slate-50 to-white dark:from-slate-900 dark:to-gray-900">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-linear-to-br from-emerald-500 to-green-700 rounded-lg shadow-lg">
                      <MapPin className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl">
                        Interactive Risk Map
                      </CardTitle>
                      <CardDescription className="text-base mt-1">
                        Click on any district to view detailed analysis and
                        historical trends
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center h-[480px] sm:h-[560px] lg:h-[640px] bg-muted/30 rounded-xl">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <p className="text-muted-foreground font-medium">
                          Loading map data...
                        </p>
                      </div>
                    </div>
                  ) : predictions.length > 0 ? (
                    <div className="space-y-6">
                      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
                        {/* Map */}
                        <div className="h-[480px] sm:h-[560px] lg:h-[640px] w-full rounded-xl overflow-hidden border border-border shadow-inner">
                          <SriLankaMap
                            data={predictions}
                            onDistrictClick={handleDistrictClick}
                          />
                        </div>

                        {/* District list sidebar */}
                        <div className="flex flex-col gap-3">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            All Districts
                          </h4>
                          <div className="space-y-1 overflow-y-auto lg:max-h-[640px] pr-0.5">
                            {predictions.map((district) => {
                              const risk = getRiskLevel(
                                district.predicted_cases,
                              );
                              const isSelected =
                                selectedDistrict === district.district;
                              return (
                                <div
                                  key={district.district}
                                  className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all text-sm ${
                                    isSelected
                                      ? "bg-primary/10 border-primary/40 shadow-sm"
                                      : "hover:bg-accent border-transparent hover:border-border"
                                  }`}
                                  onClick={() =>
                                    handleDistrictClick(district.district)
                                  }
                                >
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`h-2 w-2 rounded-full shrink-0 ${getRiskDotClass(risk.level)}`}
                                    />
                                    <span className="font-medium">
                                      {district.district}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="tabular-nums font-semibold text-xs">
                                      {district.predicted_cases.toLocaleString()}
                                    </span>
                                    <button
                                      className="text-muted-foreground hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                                      title="AI Insights for this district"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedDistrict(district.district);
                                        handleDistrictClick(district.district);
                                        setActivePanel("ai");
                                      }}
                                    >
                                      <Sparkles className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Selected District Details */}
                      {selectedDistrict && districtTimeseries.length > 0 && (
                        <div className="grid md:grid-cols-2 gap-4 p-4 bg-muted/40 rounded-xl border border-border">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-5 w-5 text-primary" />
                              <h4 className="text-lg font-bold">
                                {selectedDistrict}
                              </h4>
                            </div>
                            <div className="space-y-2">
                              {(() => {
                                const currentData = predictions.find(
                                  (p) => p.district === selectedDistrict,
                                );
                                const risk = currentData
                                  ? getRiskLevel(currentData.predicted_cases)
                                  : null;
                                return currentData ? (
                                  <>
                                    <div className="flex items-center justify-between p-2 bg-card rounded-lg">
                                      <span className="text-sm font-medium text-muted-foreground">
                                        Current Forecast
                                      </span>
                                      <span className="text-lg font-bold">
                                        {currentData.predicted_cases.toLocaleString()}{" "}
                                        cases
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between p-2 bg-card rounded-lg">
                                      <span className="text-sm font-medium text-muted-foreground">
                                        Risk Level
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className={getRiskBadgeClass(
                                          risk?.level ?? "",
                                        )}
                                      >
                                        {risk?.level}
                                      </Badge>
                                    </div>
                                    {selectedDistrict === "Colombo" && (
                                      <button
                                        onClick={openDsBreakdown}
                                        className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm font-medium transition-colors"
                                      >
                                        <MapPin className="h-4 w-4" />
                                        View DS-Level Breakdown
                                      </button>
                                    )}
                                  </>
                                ) : null;
                              })()}
                            </div>
                          </div>
                          <div className="space-y-3">
                            <h5 className="text-sm font-semibold text-foreground flex items-center gap-2">
                              <Activity className="h-4 w-4" />
                              Recent Trend (Last 4 Weeks)
                            </h5>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {districtTimeseries
                                .slice(-4)
                                .reverse()
                                .map((entry) => {
                                  const risk = getRiskLevel(entry.cases);
                                  return (
                                    <div
                                      key={`${entry.year}-${entry.week}`}
                                      className="flex items-center justify-between p-2 bg-card rounded-lg hover:bg-accent transition-colors"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium text-muted-foreground">
                                          W{entry.week}/{entry.year}
                                        </span>
                                        {entry.temperature && (
                                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Thermometer className="h-3 w-3" />
                                            {entry.temperature.toFixed(1)}°C
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold">
                                          {entry.cases}
                                        </span>
                                        <Badge
                                          variant="outline"
                                          className={`text-xs ${getRiskBadgeClass(risk.level)}`}
                                        >
                                          {risk.level}
                                        </Badge>
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[480px] sm:h-[560px] text-muted-foreground bg-muted/30 rounded-xl">
                      <MapPin className="h-16 w-16 mb-4 text-muted-foreground/50" />
                      <p className="text-lg font-medium">
                        No map data available
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── Trends Panel ───────────────────────────────────── */}
          {activePanel === "trends" && (
            <div className="space-y-6 animate-in fade-in-50 duration-300">
              {/* 12-Week Trend Chart */}
              {trends.length > 0 ? (
                <Card className="border-2 border-primary/10">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-linear-to-br from-emerald-500 to-green-700 rounded-lg shadow-sm">
                        <TrendingUp className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <CardTitle>12-Week Trend</CardTitle>
                        <CardDescription>
                          Historical dengue cases over the last 12 weeks
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 mt-4 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsBar data={trends}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="week"
                            tickFormatter={(value) => `W${value}`}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12 }}
                            dy={10}
                          />
                          <Tooltip
                            cursor={{ fill: "transparent" }}
                            formatter={(value: number | undefined) => [
                              value || 0,
                              "Cases",
                            ]}
                            labelFormatter={(label, payload) => {
                              if (
                                payload &&
                                payload.length > 0 &&
                                payload[0].payload
                              ) {
                                return `Week ${label}, ${payload[0].payload.year}`;
                              }
                              return `Week ${label}`;
                            }}
                          />
                          <Bar
                            dataKey="total_cases"
                            fill="currentColor"
                            className="fill-primary"
                            radius={[4, 4, 0, 0]}
                          />
                        </RechartsBar>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex items-center justify-center h-64 bg-muted/30 rounded-xl border-2 border-dashed border-border">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="text-sm">Loading trend data…</p>
                  </div>
                </div>
              )}

              {/* Top 10 Risk Districts */}
              {predictions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Top 10 Risk Districts</CardTitle>
                    <CardDescription>
                      Districts with highest predicted cases this week
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {topRiskDistricts.map((district, index) => {
                        const risk = getRiskLevel(district.predicted_cases);
                        return (
                          <div
                            key={district.district}
                            className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors"
                            onClick={() =>
                              handleDistrictClick(district.district)
                            }
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
                                {index + 1}
                              </div>
                              <div>
                                <p className="font-medium">
                                  {district.district}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {district.predicted_cases.toLocaleString()}{" "}
                                  cases
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={getRiskBadgeClass(risk.level)}
                              >
                                {risk.level}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-purple-500 hover:text-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/50"
                                title="AI Insights for this district"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDistrict(district.district);
                                  handleDistrictClick(district.district);
                                  setActivePanel("ai");
                                }}
                              >
                                <Sparkles className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ── Alerts Panel ───────────────────────────────────── */}
          {activePanel === "alerts" && (
            <div className="space-y-6 animate-in fade-in-50 duration-300">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-linear-to-br from-red-500 to-rose-600 rounded-lg shadow-lg">
                  <AlertTriangle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">Outbreak Alerts</h3>
                  <p className="text-sm text-muted-foreground">
                    Real-time outbreak detection and monitoring
                  </p>
                </div>
              </div>
              <OutbreakAlerts />
            </div>
          )}

          {/* ── Hotspots Panel ─────────────────────────────────── */}
          {activePanel === "hotspots" && (
            <div className="space-y-6 animate-in fade-in-50 duration-300">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-linear-to-br from-amber-400 to-orange-500 rounded-lg shadow-lg">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">Hotspots & Weather</h3>
                  <p className="text-sm text-muted-foreground">
                    Active hotspots, growth rates, and weather correlation
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <HotspotsPanel />
                <GrowthRatePanel />
              </div>
              <WeatherCorrelation />
            </div>
          )}

          {/* ── AI Insights Panel ──────────────────────────────── */}
          {activePanel === "ai" && (
            <div className="space-y-6 animate-in fade-in-50 duration-300">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-linear-to-br from-purple-500 to-indigo-600 rounded-lg shadow-lg">
                  <Brain className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">AI-Powered Insights</h3>
                  <p className="text-sm text-muted-foreground">
                    Explainable risk analysis with key drivers and actionable
                    recommendations
                  </p>
                </div>
              </div>
              <ExplainableInsightsPanel
                district={selectedDistrict}
                districts={predictions.map((p) => p.district)}
                onDistrictChange={(d) => {
                  setSelectedDistrict(d);
                  handleDistrictClick(d);
                }}
              />
              <AdvancedAnalyticsPanel
                districts={predictions.map((p) => p.district)}
              />
            </div>
          )}

          {/* ── Historical Panel ───────────────────────────────── */}
          {activePanel === "historical" && (
            <div className="animate-in fade-in-50 duration-300">
              <HistoricalAnalytics />
            </div>
          )}

          {/* ── National Panel ─────────────────────────────────── */}
          {activePanel === "national" && (
            <div className="animate-in fade-in-50 duration-300">
              <NationalSummaryPanel />
            </div>
          )}
        </div>
      </div>

      {/* AI Chat Drawer */}
      <FloatingChatBubble
        mode="drawer"
        open={chatOpen}
        onOpenChange={setChatOpen}
        district={selectedDistrict}
        dashboardContext={{
          totalCases: summary?.total_cases,
          highRiskCount: summary?.high_risk_districts,
          topDistricts: predictions.slice(0, 5).map((p) => p.district),
        }}
      />

      {/* Colombo DS-Level Breakdown Modal */}
      <ColomboDsBreakdownModal
        open={dsBreakdownOpen}
        onClose={() => setDsBreakdownOpen(false)}
        data={dsBreakdown}
        loading={dsBreakdownLoading}
      />
    </div>
  );
}
