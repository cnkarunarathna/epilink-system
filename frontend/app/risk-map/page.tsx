"use client";

import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RefreshCw,
  Loader2,
  MapPin,
  TrendingUp,
  TrendingDown,
  Activity,
  Thermometer,
  Sparkles,
  Zap,
  AlertTriangle,
  Shield,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { PublicLayout } from "@/components/layout/PublicLayout";
import SriLankaMap from "@/components/dashboard/maps/SriLankaMap";
import PublicSummaryBanner from "@/components/public/PublicSummaryBanner";
import TrendStoryChart from "@/components/public/TrendStoryChart";
import DistrictWatchList from "@/components/public/DistrictWatchList";
import PublicHealthWarnings from "@/components/public/PublicHealthWarnings";
import DistrictRiskTable from "@/components/public/DistrictRiskTable";
import PreventionChecklist from "@/components/public/PreventionChecklist";
import DistrictSearchBar from "@/components/public/DistrictSearchBar";
import OnboardingBanner from "@/components/public/OnboardingBanner";
import InfoTooltip from "@/components/public/InfoTooltip";
import ActionGuidance from "@/components/public/ActionGuidance";
import NationalStatusBar from "@/components/public/NationalStatusBar";
import {
  fetchPublicLatestPerDistrict,
  fetchPublicTimeseries,
  fetchPublicDashboardSummary,
  fetchPublicTrends,
} from "@/services/public-analytics.service";
import settingsService from "@/services/settings.service";

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

export default function PublicRiskMapPage() {
  const [predictions, setPredictions] = useState<DistrictPrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [districtTimeseries, setDistrictTimeseries] = useState<
    TimeSeriesData[]
  >([]);
  const [showListView, setShowListView] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [dashboardEnabled, setDashboardEnabled] = useState<boolean | null>(null);

  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    settingsService
      .getPublic()
      .then(({ publicDashboard }) => {
        setDashboardEnabled(publicDashboard);
        if (publicDashboard) loadDashboardData();
      })
      .catch(() => {
        // If we can't reach the settings endpoint, assume enabled
        setDashboardEnabled(true);
        loadDashboardData();
      });
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const [latestData, summaryData, trendsData] = await Promise.all([
        fetchPublicLatestPerDistrict(),
        fetchPublicDashboardSummary(),
        fetchPublicTrends(12),
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
    } catch (error: any) {
      toast.error("Failed to load data", {
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
      toast.info(`📍 ${district}`, {
        description: `${districtData.predicted_cases} expected cases this week`,
      });
    }

    try {
      const ts = await fetchPublicTimeseries(district);
      setDistrictTimeseries(ts || []);
    } catch (error: any) {
      console.error("Failed to load timeseries:", error);
    }
  };

  const topRiskDistricts = predictions.slice(0, 10);

  const lastUpdatedLabel = summary
    ? (() => {
        const { year, week } = summary.current_week;
        const jan4 = new Date(year, 0, 4);
        const monday = new Date(jan4);
        monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (week - 1) * 7);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const fmt = (d: Date) =>
          d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
        return `${fmt(monday)} – ${fmt(sunday)}`;
      })()
    : null;

  const getRiskLevel = (
    cases: number,
  ): { level: string; color: string; description: string } => {
    if (cases >= 100)
      return {
        level: "Very High",
        color: "destructive",
        description: "Take precautions now",
      };
    if (cases >= 50)
      return {
        level: "High",
        color: "destructive",
        description: "Stay alert",
      };
    if (cases >= 25)
      return {
        level: "Moderate",
        color: "default",
        description: "Stay cautious",
      };
    if (cases >= 10)
      return {
        level: "Low",
        color: "secondary",
        description: "Normal vigilance",
      };
    return {
      level: "Minimal",
      color: "outline",
      description: "Situation is calm",
    };
  };

  if (dashboardEnabled === null) {
    return (
      <PublicLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PublicLayout>
    );
  }

  if (!dashboardEnabled) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4 text-center">
          <div className="p-4 bg-muted rounded-full">
            <Shield className="h-12 w-12 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Dashboard Temporarily Unavailable</h2>
            <p className="text-muted-foreground max-w-md">
              The public dengue risk dashboard has been temporarily disabled by the administrator.
              Please check back later or contact the Ministry of Health for updates.
            </p>
          </div>
          <a
            href="https://www.epid.gov.lk"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm underline text-muted-foreground hover:text-foreground"
          >
            Visit the Epidemiology Unit of Sri Lanka
          </a>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 max-w-7xl py-8 space-y-8">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-emerald-600 via-teal-700 to-cyan-800 p-8 md:p-12 text-white shadow-2xl">
          <div className="absolute inset-0 bg-grid-white/10 mask-[linear-gradient(0deg,transparent,white)]"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="relative">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm">
                    <Shield className="h-8 w-8" />
                  </div>
                  <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                      Dengue Risk Map
                    </h1>
                    <p className="text-emerald-100 text-base mt-1">
                      Sri Lanka - Public Health Intelligence
                    </p>
                  </div>
                </div>
                <p className="text-emerald-100/90 text-lg max-w-xl flex items-center gap-2">
                  AI-powered dengue risk predictions, outbreak alerts, and trend
                  analysis across all 25 districts
                  <InfoTooltip
                    text="Predictions are generated by a machine learning model trained on historical dengue data and weather patterns. They are updated every week."
                    className="text-emerald-200 hover:text-white"
                  />
                </p>
              </div>
              {summary && (
                <div className="flex gap-3 flex-wrap">
                  <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4 text-center min-w-[100px]">
                    <div className="text-xs text-emerald-200 font-medium">
                      Current Week
                    </div>
                    <div className="text-2xl font-bold mt-1">
                      {summary.current_week.week}
                    </div>
                    <div className="text-xs text-emerald-300">
                      {summary.current_week.year}
                    </div>
                  </div>
                  <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4 text-center min-w-[100px]">
                    <div className="text-xs text-emerald-200 font-medium">
                      Expected Cases
                    </div>
                    <div className="text-2xl font-bold mt-1">
                      {summary.total_cases.toLocaleString()}
                    </div>
                    <div className="text-xs text-emerald-300">
                      {summary.change_percent >= 0 ? "+" : ""}
                      {summary.change_percent.toFixed(1)}% vs last week
                    </div>
                  </div>
                  <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4 text-center min-w-[100px]">
                    <div className="text-xs text-emerald-200 font-medium">
                      Districts to Watch
                    </div>
                    <div className="text-2xl font-bold mt-1">
                      {summary.high_risk_districts}
                    </div>
                    <div className="text-xs text-emerald-300">
                      areas elevated
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Last Updated Indicator */}
        {lastUpdatedLabel && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-lg px-4 py-2.5">
            <Calendar className="h-4 w-4 shrink-0" />
            <span>
              Data covers week{" "}
              <span className="font-medium text-foreground">
                {summary!.current_week.week}, {summary!.current_week.year}
              </span>{" "}
              — {lastUpdatedLabel}
            </span>
            <span className="ml-auto text-xs">Updates every week</span>
          </div>
        )}

        {/* National Status */}
        {summary && (
          <NationalStatusBar
            highRiskDistricts={summary.high_risk_districts}
            totalDistricts={summary.district_count}
          />
        )}

        {/* Onboarding Guide */}
        <OnboardingBanner />

        {/* Plain-English Summary */}
        {summary && predictions.length > 0 && (
          <PublicSummaryBanner summary={summary} topDistricts={predictions} />
        )}

        {/* Key Metrics */}
        {summary && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-linear-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30 border-2 border-blue-200 dark:border-blue-800 hover:shadow-lg transition-all duration-300 hover:scale-105">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400 flex items-center gap-2">
                  <div className="p-1.5 bg-blue-200 dark:bg-blue-800/50 rounded-lg">
                    <Activity className="h-4 w-4" />
                  </div>
                  Expected dengue cases this week
                  <InfoTooltip text="Our AI model estimates this number based on past data and weather patterns. It is not an official government figure — actual reported cases may be lower or higher." />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                  {summary.total_cases.toLocaleString()}
                </div>
                <div className="flex items-center gap-1 text-xs mt-2">
                  {summary.change_percent >= 0 ? (
                    <div className="p-1 bg-red-100 dark:bg-red-900/50 rounded-full">
                      <TrendingUp className="h-3 w-3 text-red-600 dark:text-red-400" />
                    </div>
                  ) : (
                    <div className="p-1 bg-green-100 dark:bg-green-900/50 rounded-full">
                      <TrendingDown className="h-3 w-3 text-green-600 dark:text-green-400" />
                    </div>
                  )}
                  <span
                    className={`font-bold ${
                      summary.change_percent >= 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-green-600 dark:text-green-400"
                    }`}
                  >
                    {Math.abs(summary.change_percent).toFixed(1)}%
                  </span>
                  <span className="text-muted-foreground">
                    compared to last week
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-linear-to-br from-red-50 to-red-100 dark:from-red-950/50 dark:to-red-900/30 border-2 border-red-200 dark:border-red-800 hover:shadow-lg transition-all duration-300 hover:scale-105">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400 flex items-center gap-2">
                  <div className="p-1.5 bg-red-200 dark:bg-red-800/50 rounded-lg">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  Districts to watch closely
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-900 dark:text-red-100">
                  {summary.high_risk_districts}
                </div>
                <p className="text-xs text-red-700 dark:text-red-400 mt-2 font-medium">
                  Areas with an elevated dengue risk level this week
                </p>
              </CardContent>
            </Card>

            <Card className="bg-linear-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/30 border-2 border-green-200 dark:border-green-800 hover:shadow-lg transition-all duration-300 hover:scale-105">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400 flex items-center gap-2">
                  <div className="p-1.5 bg-green-200 dark:bg-green-800/50 rounded-lg">
                    <MapPin className="h-4 w-4" />
                  </div>
                  Districts Covered
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-900 dark:text-green-100">
                  {summary.district_count}
                </div>
                <p className="text-xs text-green-700 dark:text-green-400 mt-2 font-medium">
                  Complete island coverage
                </p>
              </CardContent>
            </Card>

            <Card className="bg-linear-to-br from-orange-50 to-orange-100 dark:from-orange-950/50 dark:to-orange-900/30 border-2 border-orange-200 dark:border-orange-800 hover:shadow-lg transition-all duration-300 hover:scale-105">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-400 flex items-center gap-2">
                  <div className="p-1.5 bg-orange-200 dark:bg-orange-800/50 rounded-lg">
                    <Thermometer className="h-4 w-4" />
                  </div>
                  Current heat level
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-900 dark:text-orange-100">
                  {summary.avg_temperature
                    ? `${summary.avg_temperature.toFixed(1)}°C`
                    : "N/A"}
                </div>
                <p className="text-xs text-orange-700 dark:text-orange-400 mt-2 font-medium">
                  Average temperature this week
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ===== MOBILE FLAT SCROLL (< 768px) ===== */}
        {isMobile && (
          <div className="space-y-8">
            {/* Section 1 — Map */}
            <section className="space-y-4">
              <h2 className="text-lg font-bold flex items-center gap-2 pb-2 border-b">
                <MapPin className="h-5 w-5 text-primary" /> Where is dengue now?
              </h2>
              <div className="flex justify-end">
                <Button onClick={loadDashboardData} disabled={loading} size="sm" className="shadow-md">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Refresh
                </Button>
              </div>
              {predictions.length > 0 && (
                <div className="space-y-4">
                  <DistrictSearchBar districts={predictions.map((p) => p.district)} onSelect={handleDistrictClick} />
                  <div className="flex gap-2">
                    <Button variant={!showListView ? "default" : "outline"} size="sm" onClick={() => setShowListView(false)}>
                      <MapPin className="h-4 w-4 mr-1.5" /> Map
                    </Button>
                    <Button variant={showListView ? "default" : "outline"} size="sm" onClick={() => setShowListView(true)}>
                      <Activity className="h-4 w-4 mr-1.5" /> List
                    </Button>
                  </div>
                  {!showListView ? (
                    <div className="h-[400px] w-full rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 shadow-inner">
                      <SriLankaMap data={predictions} onDistrictClick={handleDistrictClick} publicMode />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {topRiskDistricts.map((district, index) => {
                        const risk = getRiskLevel(district.predicted_cases);
                        return (
                          <div
                            key={district.district}
                            className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors"
                            onClick={() => handleDistrictClick(district.district)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
                                {index + 1}
                              </div>
                              <div>
                                <p className="font-medium">{district.district}</p>
                                <p className="text-sm text-muted-foreground">
                                  {district.predicted_cases.toLocaleString()} expected cases
                                </p>
                              </div>
                            </div>
                            <Badge variant={risk.color as any}>{risk.level}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {selectedDistrict && districtTimeseries.length > 0 && (
                    <div className="space-y-4 p-4 bg-linear-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 rounded-xl border border-blue-200 dark:border-blue-800">
                      {(() => {
                        const d = predictions.find((p) => p.district === selectedDistrict);
                        const risk = d ? getRiskLevel(d.predicted_cases) : null;
                        return d ? (
                          <>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                              <h4 className="text-lg font-bold text-blue-900 dark:text-blue-100">{selectedDistrict}</h4>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between p-2 bg-white/70 dark:bg-gray-800/70 rounded-lg">
                                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Expected cases this week</span>
                                <span className="text-lg font-bold">{d.predicted_cases.toLocaleString()} cases</span>
                              </div>
                              <div className="flex items-center justify-between p-2 bg-white/70 dark:bg-gray-800/70 rounded-lg">
                                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Risk level</span>
                                <div className="flex flex-col items-end gap-0.5">
                                  <Badge variant={risk?.color as any}>{risk?.level}</Badge>
                                  <span className="text-xs text-muted-foreground">{risk?.description}</span>
                                </div>
                              </div>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {districtTimeseries.slice(-4).reverse().map((entry) => {
                                const r = getRiskLevel(entry.cases);
                                return (
                                  <div key={`${entry.year}-${entry.week}`} className="flex items-center justify-between p-2 bg-white/70 dark:bg-gray-800/70 rounded-lg">
                                    <span className="text-xs font-medium text-slate-500">Week {entry.week}, {entry.year}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-bold">{entry.cases}</span>
                                      <Badge variant="outline" className="text-xs">{r.level}</Badge>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <ActionGuidance level={risk!.level} district={selectedDistrict} />
                          </>
                        ) : null;
                      })()}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Section 2 — Trends */}
            <section className="space-y-4">
              <h2 className="text-lg font-bold flex items-center gap-2 pb-2 border-b">
                <Sparkles className="h-5 w-5 text-primary" /> Is it getting better or worse?
              </h2>
              {trends.length > 0 && <TrendStoryChart data={trends} />}
              <PublicHealthWarnings />
              <DistrictWatchList />
            </section>

            {/* Section 3 — Protection */}
            <section className="space-y-4">
              <h2 className="text-lg font-bold flex items-center gap-2 pb-2 border-b">
                <Zap className="h-5 w-5 text-primary" /> How can I protect myself?
              </h2>
              <PreventionChecklist
                riskLevel={
                  summary
                    ? summary.high_risk_districts >= 8 ? "high"
                      : summary.high_risk_districts >= 4 ? "moderate"
                      : "low"
                    : "low"
                }
              />
              {predictions.length > 0 && (
                <DistrictRiskTable districts={predictions} onDistrictClick={handleDistrictClick} />
              )}
            </section>
          </div>
        )}

        {/* ===== DESKTOP TABBED CONTENT (≥ 768px) ===== */}
        {!isMobile && (
        <Tabs defaultValue="risk-map" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 h-14 p-1 bg-muted/50 backdrop-blur-sm">
            <TabsTrigger
              value="risk-map"
              className="text-sm md:text-base font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-md transition-all"
            >
              <MapPin className="h-4 w-4 md:h-5 md:w-5 mr-1.5 md:mr-2" />
              <span className="hidden sm:inline">Where is dengue now?</span>
              <span className="sm:hidden">Map</span>
            </TabsTrigger>
            <TabsTrigger
              value="predictions"
              className="text-sm md:text-base font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-md transition-all"
            >
              <Sparkles className="h-4 w-4 md:h-5 md:w-5 mr-1.5 md:mr-2" />
              <span className="hidden sm:inline">
                Is it getting better or worse?
              </span>
              <span className="sm:hidden">Trends</span>
            </TabsTrigger>
            <TabsTrigger
              value="analysis"
              className="text-sm md:text-base font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-md transition-all"
            >
              <Zap className="h-4 w-4 md:h-5 md:w-5 mr-1.5 md:mr-2" />
              <span className="hidden sm:inline">
                How can I protect myself?
              </span>
              <span className="sm:hidden">Protect</span>
            </TabsTrigger>
          </TabsList>

          {/* ===== RISK MAP TAB ===== */}
          <TabsContent
            value="risk-map"
            className="space-y-6 animate-in fade-in-50 duration-500"
          >
            {/* Refresh */}
            <div className="flex justify-end">
              <Button
                onClick={loadDashboardData}
                disabled={loading}
                size="lg"
                className="shadow-md"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Refresh Data
              </Button>
            </div>

            {/* Interactive Map */}
            <Card className="border-2 border-primary/20 shadow-xl bg-linear-to-br from-slate-50 to-white dark:from-slate-900 dark:to-gray-900">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-linear-to-br from-blue-500 to-indigo-600 rounded-lg shadow-lg">
                      <MapPin className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl">
                        Interactive District Risk Map
                      </CardTitle>
                      <CardDescription className="text-base mt-1">
                        Click any area on the map to see the dengue risk level
                        for that district
                      </CardDescription>
                    </div>
                  </div>
                  {selectedDistrict && (
                    <Badge variant="default" className="text-sm px-3 py-1">
                      Selected: {selectedDistrict}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center h-[600px] bg-muted/30 rounded-lg">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-12 w-12 animate-spin text-primary" />
                      <p className="text-muted-foreground font-medium">
                        Loading map data...
                      </p>
                    </div>
                  </div>
                ) : predictions.length > 0 ? (
                  <div className="grid gap-6">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Find your district</p>
                      <DistrictSearchBar
                        districts={predictions.map((p) => p.district)}
                        onSelect={handleDistrictClick}
                      />
                    </div>
                    <div className="h-[600px] w-full rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 shadow-inner">
                      <SriLankaMap
                        data={predictions}
                        onDistrictClick={handleDistrictClick}
                        publicMode
                      />
                    </div>

                    {/* Selected District Details */}
                    {selectedDistrict && districtTimeseries.length > 0 && (
                      <div className="space-y-4 p-4 bg-linear-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 rounded-xl border border-blue-200 dark:border-blue-800">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                              <h4 className="text-lg font-bold text-blue-900 dark:text-blue-100">
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
                                    <div className="flex items-center justify-between p-2 bg-white/70 dark:bg-gray-800/70 rounded-lg">
                                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                        Expected cases this week
                                      </span>
                                      <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                        {currentData.predicted_cases.toLocaleString()}{" "}
                                        cases
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between p-2 bg-white/70 dark:bg-gray-800/70 rounded-lg">
                                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                        Risk level
                                      </span>
                                      <div className="flex flex-col items-end gap-0.5">
                                        <Badge variant={risk?.color as any}>
                                          {risk?.level}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                          {risk?.description}
                                        </span>
                                      </div>
                                    </div>
                                  </>
                                ) : null;
                              })()}
                            </div>
                          </div>
                          <div className="space-y-3">
                            <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                              <Activity className="h-4 w-4" />
                              How cases changed recently
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
                                      className="flex items-center justify-between p-2 bg-white/70 dark:bg-gray-800/70 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                          Week {entry.week}, {entry.year}
                                        </span>
                                        {entry.temperature && (
                                          <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                            <Thermometer className="h-3 w-3" />
                                            {entry.temperature.toFixed(1)}°C
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                          {entry.cases}
                                        </span>
                                        <Badge
                                          variant="outline"
                                          className="text-xs"
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

                        {/* Action Guidance for selected district */}
                        {(() => {
                          const currentData = predictions.find(
                            (p) => p.district === selectedDistrict,
                          );
                          return currentData ? (
                            <ActionGuidance
                              level={getRiskLevel(currentData.predicted_cases).level}
                              district={selectedDistrict}
                            />
                          ) : null;
                        })()}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[600px] text-muted-foreground bg-muted/30 rounded-lg">
                    <MapPin className="h-16 w-16 mb-4 text-muted-foreground/50" />
                    <p className="text-lg font-medium">No map data available</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Risk Districts */}
            {predictions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Areas to Watch This Week</CardTitle>
                  <CardDescription>
                    These areas have the highest number of expected dengue cases
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
                          onClick={() => handleDistrictClick(district.district)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium">{district.district}</p>
                              <p className="text-sm text-muted-foreground">
                                {district.predicted_cases.toLocaleString()}{" "}
                                expected cases
                              </p>
                            </div>
                          </div>
                          <Badge variant={risk.color as any}>
                            {risk.level}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ===== PREDICTIONS & TRENDS TAB ===== */}
          <TabsContent
            value="predictions"
            className="space-y-6 animate-in fade-in-50 duration-500"
          >
            {/* 12-Week Trend Chart */}
            {trends.length > 0 && <TrendStoryChart data={trends} />}

            {/* Outbreak Alerts */}
            <PublicHealthWarnings />

            {/* Districts to Watch / Declining */}
            <DistrictWatchList />
          </TabsContent>

          {/* ===== HOW CAN I PROTECT MYSELF TAB ===== */}
          <TabsContent
            value="analysis"
            className="space-y-6 animate-in fade-in-50 duration-500"
          >
            <div className="grid gap-6 md:grid-cols-2">
              <PreventionChecklist
                riskLevel={
                  summary
                    ? summary.high_risk_districts >= 8
                      ? "high"
                      : summary.high_risk_districts >= 4
                        ? "moderate"
                        : "low"
                    : "low"
                }
              />
              {predictions.length > 0 && (
                <DistrictRiskTable
                  districts={predictions}
                  onDistrictClick={handleDistrictClick}
                />
              )}
            </div>
          </TabsContent>
        </Tabs>
        )}

        {/* Need help? */}
        <div className="rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-6 py-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Need more information?
          </h3>
          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            <a
              href="tel:0112693532"
              className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            >
              <span className="text-base">📞</span>
              <span>Epidemiology Unit: 011-269-3532</span>
            </a>
            <a
              href="https://www.epid.gov.lk"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            >
              <span className="text-base">🌐</span>
              <span>Epidemiology Unit Website</span>
            </a>
            <a
              href="https://www.health.gov.lk"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            >
              <span className="text-base">🏥</span>
              <span>Ministry of Health Sri Lanka</span>
            </a>
          </div>
        </div>

        {/* Public notice */}
        <div className="text-center text-sm text-muted-foreground py-4 border-t">
          <p>
            These predictions are generated by a computer model and updated
            weekly — they are estimates, not official figures. For confirmed
            health advisories, visit the{" "}
            <a
              href="https://www.epid.gov.lk"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Epidemiology Unit of Sri Lanka
            </a>{" "}
            or consult the Ministry of Health.
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}
