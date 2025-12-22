"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import SriLankaMap from "@/components/dashboard/maps/SriLankaMap";
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

  // Fetch all data on mount
  useEffect(() => {
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Dengue Analytics Dashboard
          </h2>
          <p className="text-muted-foreground">
            Predictions, trends, and insights for dengue case monitoring
          </p>
        </div>
      </div>

      <Tabs defaultValue="predictions" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="predictions">
            <Sparkles className="h-4 w-4 mr-2" />
            Current Predictions
          </TabsTrigger>
          <TabsTrigger value="historical">
            <History className="h-4 w-4 mr-2" />
            Historical Analytics
          </TabsTrigger>
        </TabsList>

        {/* Predictions Tab */}
        <TabsContent value="predictions" className="space-y-6">
          {/* Refresh Button */}
          <div className="flex justify-end">
            <Button onClick={loadDashboardData} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh Data
            </Button>
          </div>

          {/* Summary Stats */}
          {summary && (
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Total Cases (Week {summary.current_week.week})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {summary.total_cases.toLocaleString()}
                  </div>
                  <div className="flex items-center gap-1 text-xs mt-1">
                    {summary.change_percent >= 0 ? (
                      <TrendingUp className="h-3 w-3 text-red-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-green-500" />
                    )}
                    <span
                      className={
                        summary.change_percent >= 0
                          ? "text-red-500"
                          : "text-green-500"
                      }
                    >
                      {Math.abs(summary.change_percent).toFixed(1)}%
                    </span>
                    <span className="text-muted-foreground">
                      from last week
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    High Risk Districts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {summary.high_risk_districts}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Districts with ≥50 cases
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Districts Covered
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {summary.district_count}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Complete coverage
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Thermometer className="h-4 w-4" />
                    Avg Temperature
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {summary.avg_temperature
                      ? `${summary.avg_temperature.toFixed(1)}°C`
                      : "N/A"}
                  </div>
                  <p className="text-xs text-muted-foreground">This week</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Trend Chart */}
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

          <div className="grid gap-6 md:grid-cols-2">
            {/* Interactive Map */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  District-wise Risk Map
                </CardTitle>
                <CardDescription>
                  Click on a district to view detailed trends
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center h-96">
                    <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
                  </div>
                ) : predictions.length > 0 ? (
                  <div className="h-[600px] w-full">
                    <SriLankaMap
                      data={predictions}
                      onDistrictClick={handleDistrictClick}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
                    <MapPin className="h-12 w-12 mb-4" />
                    <p>No data available</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Risk Districts */}
            {predictions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Top Risk Districts</CardTitle>
                  <CardDescription>
                    Districts with highest predicted cases
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

            {/* District Timeline */}
            {selectedDistrict && districtTimeseries.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{selectedDistrict} Timeline</CardTitle>
                  <CardDescription>
                    Historical cases for the last {districtTimeseries.length}{" "}
                    weeks
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {districtTimeseries
                      .slice(-12)
                      .reverse()
                      .map((entry) => {
                        const risk = getRiskLevel(entry.cases);
                        return (
                          <div
                            key={`${entry.year}-${entry.week}`}
                            className="flex items-center justify-between p-2 rounded border"
                          >
                            <div>
                              <p className="text-sm font-medium">
                                Week {entry.week}/{entry.year}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {entry.temperature
                                  ? `${entry.temperature.toFixed(1)}°C`
                                  : "N/A"}{" "}
                                •{" "}
                                {entry.precipitation
                                  ? `${entry.precipitation.toFixed(0)}mm`
                                  : "N/A"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold">
                                {entry.cases.toLocaleString()}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {risk.level}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* All Districts Table */}
          {predictions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>All Districts</CardTitle>
                <CardDescription>Complete prediction breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {predictions.map((district) => {
                    const risk = getRiskLevel(district.predicted_cases);
                    return (
                      <div
                        key={district.district}
                        className="flex items-center justify-between p-2 rounded border hover:bg-accent cursor-pointer"
                        onClick={() => handleDistrictClick(district.district)}
                      >
                        <span className="text-sm font-medium">
                          {district.district}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
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
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Historical Analytics Tab */}
        <TabsContent value="historical">
          <HistoricalAnalytics />
        </TabsContent>
      </Tabs>
    </div>
  );
}
