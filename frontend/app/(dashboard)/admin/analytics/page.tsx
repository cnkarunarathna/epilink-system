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
  BarChart3,
  RefreshCw,
  Loader2,
  MapPin,
  TrendingUp,
  TrendingDown,
  Activity,
  Thermometer,
  History,
  Sparkles,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import SriLankaMap from "@/components/dashboard/maps/SriLankaMap";
import OutbreakAlerts from "@/components/dashboard/analytics/OutbreakAlerts";
import HotspotsPanel from "@/components/dashboard/analytics/HotspotsPanel";
import GrowthRatePanel from "@/components/dashboard/analytics/GrowthRatePanel";
import WeatherCorrelation from "@/components/dashboard/analytics/WeatherCorrelation";
import {
  fetchLatestPerDistrict,
  fetchTimeseries,
  fetchDashboardSummary,
  fetchTrends,
} from "@/services/analytics.service";
import dynamic from "next/dynamic";

// Dynamically import historical analytics to reduce initial bundle size
const HistoricalAnalytics = dynamic(() => import("./historical/page"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
});

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

export default function AnalyticsPage() {
  const [predictions, setPredictions] = useState<DistrictPrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [districtTimeseries, setDistrictTimeseries] = useState<
    TimeSeriesData[]
  >([]);

  // Ref to prevent double-fetch in StrictMode
  const hasFetchedRef = useRef(false);

  // Fetch all data on mount
  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch latest predictions and summary in parallel
      const [latestData, summaryData, trendsData] = await Promise.all([
        fetchLatestPerDistrict(),
        fetchDashboardSummary(),
        fetchTrends(12),
      ]);

      // Map latest data to predictions - filter out any null/undefined districts
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

      toast.success("Dashboard Loaded", {
        description: `Week ${summaryData.current_week.week}/${summaryData.current_week.year} data`,
      });
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

    // Load timeseries for selected district
    try {
      const ts = await fetchTimeseries(district);
      setDistrictTimeseries(ts || []);
    } catch (error: any) {
      console.error("Failed to load timeseries:", error);
    }
  };

  // Get top 5 highest risk districts
  const topRiskDistricts = predictions.slice(0, 5);

  // Calculate total predicted cases
  const totalPredictedCases = predictions.reduce(
    (sum, p) => sum + p.predicted_cases,
    0
  );

  // Get risk level (data-driven thresholds based on actual case distribution)
  const getRiskLevel = (cases: number): { level: string; color: string } => {
    if (cases >= 100) return { level: "Very High", color: "destructive" };
    if (cases >= 50) return { level: "High", color: "destructive" };
    if (cases >= 25) return { level: "Medium", color: "default" };
    if (cases >= 10) return { level: "Low", color: "secondary" };
    return { level: "Very Low", color: "outline" };
  };

  return (
    <div className="space-y-6">
      {/* Header with Gradient Background */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-green-600 to-green-800 p-8 text-white shadow-xl">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,white)]"></div>
        <div className="relative">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <h2 className="text-4xl font-bold tracking-tight flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <BarChart3 className="h-8 w-8" />
                </div>
                Dengue Analytics Dashboard
              </h2>
              <p className="text-green-100 text-lg">
                Real-time predictions, trends, and insights for dengue case
                monitoring
              </p>
            </div>
            {summary && (
              <div className="flex gap-4">
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 text-center">
                  <div className="text-sm text-green-100">Prediction Week</div>
                  <div className="text-2xl font-bold">
                    {summary.current_week.week}
                  </div>
                  <div className="text-xs text-green-200">
                    {summary.current_week.year}
                  </div>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 text-center">
                  <div className="text-sm text-green-100">Total Cases</div>
                  <div className="text-2xl font-bold">
                    {summary.total_cases.toLocaleString()}
                  </div>
                  <div className="text-xs text-green-200">
                    {summary.change_percent >= 0 ? "+" : ""}
                    {summary.change_percent.toFixed(1)}%
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="predictions" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 h-14 p-1 bg-muted/50 backdrop-blur-sm">
          <TabsTrigger
            value="predictions"
            className="text-base font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-md transition-all"
          >
            <Sparkles className="h-5 w-5 mr-2" />
            Current Predictions
          </TabsTrigger>
          <TabsTrigger
            value="historical"
            className="text-base font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-md transition-all"
          >
            <History className="h-5 w-5 mr-2" />
            Historical Analytics
          </TabsTrigger>
        </TabsList>

        {/* Predictions Tab */}
        <TabsContent
          value="predictions"
          className="space-y-6 animate-in fade-in-50 duration-500"
        >
          {/* Refresh Button */}
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
          {/* Nested Tabs for Predictions Sections */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 h-12 p-1 bg-muted/50">
              <TabsTrigger value="overview" className="text-sm">
                <Activity className="h-4 w-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="advanced" className="text-sm">
                <Zap className="h-4 w-4 mr-2" />
                Advanced Analytics
              </TabsTrigger>
              <TabsTrigger value="districts" className="text-sm">
                <BarChart3 className="h-4 w-4 mr-2" />
                District Analysis
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Key Metrics */}
              {summary && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-1 w-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded"></div>
                    <h3 className="text-xl font-semibold">Key Metrics</h3>
                  </div>
                  <div className="grid gap-6 md:grid-cols-4">
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30 border-2 border-blue-200 dark:border-blue-800 hover:shadow-lg transition-all duration-300 hover:scale-105">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400 flex items-center gap-2">
                          <div className="p-1.5 bg-blue-200 dark:bg-blue-800/50 rounded-lg">
                            <Activity className="h-4 w-4" />
                          </div>
                          Total Cases
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
                            from last week
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/50 dark:to-red-900/30 border-2 border-red-200 dark:border-red-800 hover:shadow-lg transition-all duration-300 hover:scale-105">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400 flex items-center gap-2">
                          <div className="p-1.5 bg-red-200 dark:bg-red-800/50 rounded-lg">
                            <AlertTriangle className="h-4 w-4" />
                          </div>
                          High Risk Districts
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-red-900 dark:text-red-100">
                          {summary.high_risk_districts}
                        </div>
                        <p className="text-xs text-red-700 dark:text-red-400 mt-2 font-medium">
                          Districts with ≥50 cases
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/30 border-2 border-green-200 dark:border-green-800 hover:shadow-lg transition-all duration-300 hover:scale-105">
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
                          Complete coverage
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/50 dark:to-orange-900/30 border-2 border-orange-200 dark:border-orange-800 hover:shadow-lg transition-all duration-300 hover:scale-105">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-400 flex items-center gap-2">
                          <div className="p-1.5 bg-orange-200 dark:bg-orange-800/50 rounded-lg">
                            <Thermometer className="h-4 w-4" />
                          </div>
                          Avg Temperature
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-orange-900 dark:text-orange-100">
                          {summary.avg_temperature
                            ? `${summary.avg_temperature.toFixed(1)}°C`
                            : "N/A"}
                        </div>
                        <p className="text-xs text-orange-700 dark:text-orange-400 mt-2 font-medium">
                          This week
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {/* Interactive District Risk Map - Main Highlight */}
              <Card className="border-2 border-primary/20 shadow-xl bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-gray-900">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-lg">
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
                      <div className="h-[600px] w-full rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 shadow-inner">
                        <SriLankaMap
                          data={predictions}
                          onDistrictClick={handleDistrictClick}
                        />
                      </div>

                      {/* Selected District Details */}
                      {selectedDistrict && districtTimeseries.length > 0 && (
                        <div className="grid md:grid-cols-2 gap-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 rounded-xl border border-blue-200 dark:border-blue-800">
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
                                  (p) => p.district === selectedDistrict
                                );
                                const risk = currentData
                                  ? getRiskLevel(currentData.predicted_cases)
                                  : null;
                                return currentData ? (
                                  <>
                                    <div className="flex items-center justify-between p-2 bg-white/70 dark:bg-gray-800/70 rounded-lg">
                                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                        Current Forecast
                                      </span>
                                      <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                        {currentData.predicted_cases.toLocaleString()}{" "}
                                        cases
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between p-2 bg-white/70 dark:bg-gray-800/70 rounded-lg">
                                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                        Risk Level
                                      </span>
                                      <Badge variant={risk?.color as any}>
                                        {risk?.level}
                                      </Badge>
                                    </div>
                                  </>
                                ) : null;
                              })()}
                            </div>
                          </div>
                          <div className="space-y-3">
                            <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
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
                                      className="flex items-center justify-between p-2 bg-white/70 dark:bg-gray-800/70 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                          W{entry.week}/{entry.year}
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
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[600px] text-muted-foreground bg-muted/30 rounded-lg">
                      <MapPin className="h-16 w-16 mb-4 text-muted-foreground/50" />
                      <p className="text-lg font-medium">
                        No map data available
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 12-Week Trend Chart */}
              {trends.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>12-Week Trend</CardTitle>
                    <CardDescription>
                      Historical dengue cases over the last 12 weeks
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 flex items-end justify-between gap-2">
                      {trends
                        .filter((t) => t.year && t.week)
                        .map((t) => {
                          const maxCases = Math.max(
                            ...trends.map((d) => d.total_cases)
                          );
                          const height = (t.total_cases / maxCases) * 100;
                          return (
                            <div
                              key={`${t.year}-${t.week}`}
                              className="flex-1 flex flex-col items-center"
                            >
                              <div
                                className="w-full bg-primary rounded-t transition-all hover:bg-primary/80"
                                style={{ height: `${height}%` }}
                                title={`Week ${t.week}: ${t.total_cases} cases`}
                              ></div>
                              <span className="text-xs text-muted-foreground mt-2">
                                W{t.week}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Top Risk Districts */}
              {predictions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Top 10 Risk Districts</CardTitle>
                    <CardDescription>
                      Districts with highest predicted cases this week
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
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

            {/* Advanced Analytics Tab */}
            <TabsContent value="advanced" className="space-y-6">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg shadow-lg">
                    <Zap className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">Advanced Analytics</h3>
                    <p className="text-sm text-muted-foreground">
                      Real-time insights and outbreak detection
                    </p>
                  </div>
                </div>

                {/* Outbreak Alerts */}
                <OutbreakAlerts />

                {/* Hotspots and Growth Rate */}
                <div className="grid gap-4 md:grid-cols-2">
                  <HotspotsPanel />
                  <GrowthRatePanel />
                </div>

                {/* Weather Correlation */}
                <WeatherCorrelation />
              </div>
            </TabsContent>

            {/* District Analysis Tab */}
            <TabsContent value="districts" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>All Districts - Complete Breakdown</CardTitle>
                  <CardDescription>
                    Comprehensive view of predicted cases across all 25
                    districts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {predictions.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {predictions.map((district) => {
                        const risk = getRiskLevel(district.predicted_cases);
                        return (
                          <div
                            key={district.district}
                            className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer transition-all hover:shadow-md"
                            onClick={() =>
                              handleDistrictClick(district.district)
                            }
                          >
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium text-sm">
                                {district.district}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold">
                                {district.predicted_cases.toLocaleString()}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {risk.level}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      No prediction data available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* District Comparison Chart */}
              {predictions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>District Comparison Chart</CardTitle>
                    <CardDescription>
                      Visual comparison of case distribution
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {predictions
                        .slice()
                        .sort((a, b) => b.predicted_cases - a.predicted_cases)
                        .map((district) => {
                          const maxCases = Math.max(
                            ...predictions.map((d) => d.predicted_cases)
                          );
                          const percentage =
                            (district.predicted_cases / maxCases) * 100;
                          const risk = getRiskLevel(district.predicted_cases);

                          return (
                            <div
                              key={district.district}
                              className="space-y-1 cursor-pointer hover:bg-accent p-2 rounded transition-colors"
                              onClick={() =>
                                handleDistrictClick(district.district)
                              }
                            >
                              <div className="flex justify-between text-sm">
                                <span className="font-medium">
                                  {district.district}
                                </span>
                                <span className="text-muted-foreground">
                                  {district.predicted_cases.toLocaleString()}{" "}
                                  cases
                                </span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    risk.level === "Very High"
                                      ? "bg-red-600"
                                      : risk.level === "High"
                                      ? "bg-orange-500"
                                      : risk.level === "Medium"
                                      ? "bg-yellow-500"
                                      : risk.level === "Low"
                                      ? "bg-blue-500"
                                      : "bg-green-500"
                                  }`}
                                  style={{ width: `${percentage}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>{" "}
        </TabsContent>

        {/* Historical Analytics Tab */}
        <TabsContent value="historical">
          <HistoricalAnalytics />
        </TabsContent>
      </Tabs>
    </div>
  );
}
