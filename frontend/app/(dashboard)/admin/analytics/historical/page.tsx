"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  Calendar,
  TrendingUp,
  TrendingDown,
  BarChart3,
  LineChart,
  Activity,
  Loader2,
  CloudRain,
} from "lucide-react";

import { toast } from "sonner";
import {
  fetchHistoricalRange,
  fetchCompareDistricts,
  fetchYearlySummary,
  fetchLatestPerDistrict,
} from "@/services/analytics.service";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import { useTheme } from "next-themes";

import { DistrictComparisonTab } from "@/components/dashboard/historical/DistrictComparisonTab";
import { YearlySummaryTab } from "@/components/dashboard/historical/YearlySummaryTab";
import { SeasonalPatternTab } from "@/components/dashboard/historical/SeasonalPatternTab";
import { WeatherImpactTab } from "@/components/dashboard/historical/WeatherImpactTab";

interface HistoricalData {
  year: number;
  week: number;
  district: string;
  cases: number;
  temperature: number | null;
  precipitation: number | null;
}

interface YearlySummary {
  year: number;
  districts: Array<{
    district: string;
    total_cases: number;
    avg_cases: number;
    max_cases: number;
    min_cases: number;
    week_count: number;
  }>;
}

export default function HistoricalAnalyticsPage() {
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(2025);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([
    "Colombo",
    "Gampaha",
    "Kandy",
  ]);
  const [availableDistricts, setAvailableDistricts] = useState<string[]>([]);
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
  const [yearlySummary, setYearlySummary] = useState<YearlySummary | null>(
    null,
  );
  const [comparisonData, setComparisonData] = useState<HistoricalData[]>([]);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Available years for selection
  const availableYears = [2023, 2024, 2025, 2026];

  useEffect(() => {
    loadAvailableDistricts();
    loadAllHistoricalData();
  }, []);

  useEffect(() => {
    if (selectedYear) {
      loadYearlySummary(selectedYear);
    }
  }, [selectedYear]);

  useEffect(() => {
    if (selectedDistricts.length > 0) {
      loadComparisonData();
    }
  }, [selectedDistricts]);

  const loadAvailableDistricts = async () => {
    try {
      const latest = await fetchLatestPerDistrict();
      const districts = latest.map((d) => d.district).sort();
      setAvailableDistricts(districts);
    } catch (error: any) {
      console.error("Failed to load districts:", error);
    }
  };

  const loadAllHistoricalData = async () => {
    try {
      setLoading(true);
      const data = await fetchHistoricalRange();
      setHistoricalData(data);
    } catch (error: any) {
      toast.error("Failed to load historical data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadYearlySummary = async (year: number) => {
    try {
      const data = await fetchYearlySummary(year);
      setYearlySummary(data);
    } catch (error: any) {
      console.error("Failed to load yearly summary:", error);
    }
  };

  const loadComparisonData = async () => {
    try {
      const data = await fetchCompareDistricts(selectedDistricts);
      setComparisonData(data);
    } catch (error: any) {
      console.error("Failed to load comparison data:", error);
    }
  };

  // Process data for time series chart
  const processTimeSeriesData = () => {
    const groupedByWeek: Record<string, any> = {};

    comparisonData.forEach((item) => {
      const key = `${item.year}-W${item.week}`;
      if (!groupedByWeek[key]) {
        groupedByWeek[key] = {
          weekLabel: key,
          year: item.year,
          week: item.week,
        };
      }
      groupedByWeek[key][item.district] = item.cases;
    });

    return Object.values(groupedByWeek).sort((a: any, b: any) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.week - b.week;
    });
  };

  // Process data for yearly comparison
  const processYearlyTrends = () => {
    const yearlyData: Record<
      number,
      { year: number; total: number; avg: number }
    > = {};

    historicalData.forEach((item) => {
      if (!yearlyData[item.year]) {
        yearlyData[item.year] = { year: item.year, total: 0, avg: 0 };
      }
      yearlyData[item.year].total += item.cases;
    });

    // Calculate averages
    Object.values(yearlyData).forEach((yearData) => {
      const yearRecords = historicalData.filter(
        (d) => d.year === yearData.year,
      );
      yearData.avg = yearData.total / yearRecords.length;
    });

    return Object.values(yearlyData).sort((a, b) => a.year - b.year);
  };

  // Process seasonal patterns (by week across years)
  const processSeasonalPattern = () => {
    const weeklyPattern: Record<
      number,
      { week: number; avgCases: number; count: number }
    > = {};

    historicalData.forEach((item) => {
      if (!weeklyPattern[item.week]) {
        weeklyPattern[item.week] = { week: item.week, avgCases: 0, count: 0 };
      }
      weeklyPattern[item.week].avgCases += item.cases;
      weeklyPattern[item.week].count += 1;
    });

    return Object.values(weeklyPattern)
      .map((w) => ({
        week: w.week,
        avgCases: w.avgCases / w.count,
      }))
      .sort((a, b) => a.week - b.week);
  };

  const getRiskLevel = (cases: number) => {
    if (cases >= 100) return { level: "Very High", color: "destructive" };
    if (cases >= 50) return { level: "High", color: "destructive" };
    if (cases >= 25) return { level: "Medium", color: "default" };
    if (cases >= 10) return { level: "Low", color: "secondary" };
    return { level: "Very Low", color: "outline" };
  };

  const timeSeriesData = processTimeSeriesData();
  const yearlyTrends = processYearlyTrends();
  const seasonalPattern = processSeasonalPattern();

  // Process data for weather correlation
  const processWeatherCorrelationData = () => {
    // Only use comparison data for selected districts to show cases vs weather
    const groupedByWeek: Record<string, any> = {};

    comparisonData.forEach((item) => {
      const key = `${item.year}-W${item.week}`;
      if (!groupedByWeek[key]) {
        groupedByWeek[key] = {
          weekLabel: key,
          year: item.year,
          week: item.week,
          cases: 0,
          tempSum: 0,
          precipSum: 0,
          weatherCount: 0,
        };
      }

      groupedByWeek[key].cases += item.cases;

      if (item.temperature !== null) {
        groupedByWeek[key].tempSum += item.temperature;
        groupedByWeek[key].weatherCount += 1;
      }

      if (item.precipitation !== null) {
        groupedByWeek[key].precipSum += item.precipitation;
      }
    });

    return Object.values(groupedByWeek)
      .map((w: any) => ({
        weekLabel: w.weekLabel,
        year: w.year,
        week: w.week,
        cases: w.cases,
        temp:
          w.weatherCount > 0
            ? Number((w.tempSum / w.weatherCount).toFixed(1))
            : null,
        precip:
          w.weatherCount > 0
            ? Number((w.precipSum / w.weatherCount).toFixed(1))
            : null,
      }))
      .sort((a: any, b: any) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.week - b.week;
      });
  };

  const COLORS = [
    "#dc2626", // red
    "#2563eb", // blue
    "#16a34a", // green
    "#ea580c", // orange
    "#9333ea", // purple
    "#0891b2", // cyan
    "#ca8a04", // yellow
    "#db2777", // pink
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Historical Analytics
          </h2>
          <p className="text-muted-foreground">
            Comprehensive analysis of dengue case trends and patterns
          </p>
        </div>
        <Button onClick={loadAllHistoricalData} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Activity className="h-4 w-4 mr-2" />
          )}
          Refresh Data
        </Button>
      </div>

      <Tabs defaultValue="trends" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="trends">
            <LineChart className="h-4 w-4 mr-2" />
            Trends
          </TabsTrigger>
          <TabsTrigger value="comparison">
            <BarChart3 className="h-4 w-4 mr-2" />
            District Comparison
          </TabsTrigger>
          <TabsTrigger value="yearly">
            <Calendar className="h-4 w-4 mr-2" />
            Yearly Summary
          </TabsTrigger>
          <TabsTrigger value="seasonal">
            <TrendingUp className="h-4 w-4 mr-2" />
            Seasonal Patterns
          </TabsTrigger>
          <TabsTrigger value="weather">
            <CloudRain className="h-4 w-4 mr-2" />
            Weather Impact
          </TabsTrigger>
        </TabsList>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Year-over-Year Trends</CardTitle>
              <CardDescription>
                Total dengue cases comparison across years
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={yearlyTrends}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isDark ? "#374151" : "#e5e7eb"}
                  />
                  <XAxis
                    dataKey="year"
                    tick={{ fill: isDark ? "#9ca3af" : "#6b7280" }}
                  />
                  <YAxis tick={{ fill: isDark ? "#9ca3af" : "#6b7280" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? "#1f2937" : "#fff",
                      borderColor: isDark ? "#374151" : "#e5e7eb",
                      color: isDark ? "#f3f4f6" : "#111827",
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#2563eb"
                    fill="#3b82f6"
                    fillOpacity={0.6}
                    name="Total Cases"
                  />
                  <Area
                    type="monotone"
                    dataKey="avg"
                    stroke="#16a34a"
                    fill="#22c55e"
                    fillOpacity={0.4}
                    name="Average Cases"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Historical Overview Stats */}
          {yearlyTrends.length > 0 && (
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Highest Year
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {
                      [...yearlyTrends].sort((a, b) => b.total - a.total)[0]
                        ?.year
                    }
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {[...yearlyTrends]
                      .sort((a, b) => b.total - a.total)[0]
                      ?.total.toLocaleString()}{" "}
                    total cases
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Lowest Year
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {
                      [...yearlyTrends].sort((a, b) => a.total - b.total)[0]
                        ?.year
                    }
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {[...yearlyTrends]
                      .sort((a, b) => a.total - b.total)[0]
                      ?.total.toLocaleString()}{" "}
                    total cases
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Overall Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    {yearlyTrends.length >= 2 &&
                    yearlyTrends[yearlyTrends.length - 1].total >
                      yearlyTrends[0].total ? (
                      <>
                        <TrendingUp className="h-5 w-5 text-red-500" />
                        <span className="text-2xl font-bold text-red-500">
                          Increasing
                        </span>
                      </>
                    ) : (
                      <>
                        <TrendingDown className="h-5 w-5 text-green-500" />
                        <span className="text-2xl font-bold text-green-500">
                          Decreasing
                        </span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* District Comparison Tab */}
        <TabsContent value="comparison" className="space-y-6">
          <DistrictComparisonTab
            availableDistricts={availableDistricts}
            selectedDistricts={selectedDistricts}
            setSelectedDistricts={setSelectedDistricts}
            timeSeriesData={timeSeriesData}
            isDark={isDark}
            COLORS={COLORS}
          />
        </TabsContent>

        {/* Yearly Summary Tab */}
        <TabsContent value="yearly" className="space-y-6">
          <YearlySummaryTab
            selectedYear={selectedYear}
            setSelectedYear={setSelectedYear}
            availableYears={availableYears}
            yearlySummary={yearlySummary}
            getRiskLevel={getRiskLevel}
            isDark={isDark}
          />
        </TabsContent>

        {/* Seasonal Patterns Tab */}
        <TabsContent value="seasonal" className="space-y-6">
          <SeasonalPatternTab
            seasonalPattern={seasonalPattern}
            isDark={isDark}
          />
        </TabsContent>

        {/* Weather Impact Tab */}
        <TabsContent value="weather" className="space-y-6">
          <WeatherImpactTab
            availableDistricts={availableDistricts}
            selectedDistricts={selectedDistricts}
            setSelectedDistricts={setSelectedDistricts}
            weatherCorrelationData={processWeatherCorrelationData()}
            isDark={isDark}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
