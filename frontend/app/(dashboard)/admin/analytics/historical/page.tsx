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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import {
  Calendar,
  TrendingUp,
  TrendingDown,
  BarChart3,
  LineChart,
  Activity,
  Loader2,
  CloudRain,
  Filter,
  RotateCcw,
  ChevronDown,
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

  // Date range filter
  const currentYear = new Date().getFullYear();
  const DATA_START_YEAR = 2006;
  const [filterStartYear, setFilterStartYear] = useState<number>(DATA_START_YEAR);
  const [filterStartWeek, setFilterStartWeek] = useState<number>(1);
  const [filterEndYear, setFilterEndYear] = useState<number>(currentYear);
  const [filterEndWeek, setFilterEndWeek] = useState<number>(52);

  // Available years: dengue case history from 2006, weather data from 2020
  const availableYears = Array.from(
    { length: currentYear - DATA_START_YEAR + 1 },
    (_, i) => DATA_START_YEAR + i,
  );
  const weekNumbers = Array.from({ length: 52 }, (_, i) => i + 1);

  const [filterOpen, setFilterOpen] = useState(false);
  const isCustomFilter =
    filterStartYear !== DATA_START_YEAR ||
    filterStartWeek !== 1 ||
    filterEndYear !== currentYear ||
    filterEndWeek !== 52;

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

  const loadAllHistoricalData = async (
    sYear = filterStartYear,
    sWeek = filterStartWeek,
    eYear = filterEndYear,
    eWeek = filterEndWeek,
  ) => {
    try {
      setLoading(true);
      const data = await fetchHistoricalRange(sYear, sWeek, eYear, eWeek);
      setHistoricalData(data);
    } catch (error: any) {
      toast.error("Failed to load historical data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilter = () => {
    loadAllHistoricalData(filterStartYear, filterStartWeek, filterEndYear, filterEndWeek);
    loadComparisonData();
  };

  const resetFilter = () => {
    setFilterStartYear(DATA_START_YEAR);
    setFilterStartWeek(1);
    setFilterEndYear(currentYear);
    setFilterEndWeek(52);
    loadAllHistoricalData(DATA_START_YEAR, 1, currentYear, 52);
    loadComparisonData();
  };

  const applyPreset = (preset: "all" | "1y" | "3y" | "5y" | "weather") => {
    let sYear = DATA_START_YEAR, sWeek = 1, eYear = currentYear, eWeek = 52;
    if (preset === "1y") { sYear = currentYear - 1; sWeek = 1; }
    else if (preset === "3y") { sYear = currentYear - 3; sWeek = 1; }
    else if (preset === "5y") { sYear = currentYear - 5; sWeek = 1; }
    else if (preset === "weather") { sYear = 2020; sWeek = 1; }
    setFilterStartYear(sYear);
    setFilterStartWeek(sWeek);
    setFilterEndYear(eYear);
    setFilterEndWeek(eWeek);
    loadAllHistoricalData(sYear, sWeek, eYear, eWeek);
    loadComparisonData();
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

  // Comparison data filtered to the selected date range (client-side)
  const filteredComparisonData = comparisonData.filter((item) => {
    const afterStart =
      item.year > filterStartYear ||
      (item.year === filterStartYear && item.week >= filterStartWeek);
    const beforeEnd =
      item.year < filterEndYear ||
      (item.year === filterEndYear && item.week <= filterEndWeek);
    return afterStart && beforeEnd;
  });

  // Process data for time series chart
  const processTimeSeriesData = () => {
    const groupedByWeek: Record<string, any> = {};

    filteredComparisonData.forEach((item) => {
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

    filteredComparisonData.forEach((item) => {
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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Historical Analytics
          </h2>
          <p className="text-muted-foreground">
            Comprehensive analysis of dengue case trends and patterns
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Compact filter popover */}
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-9 gap-2 font-normal",
                  isCustomFilter &&
                    "border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30",
                )}
              >
                <Filter className="h-3.5 w-3.5 shrink-0" />
                <span className="text-xs font-mono">
                  {filterStartYear} W{filterStartWeek}
                  {" – "}
                  {filterEndYear} W{filterEndWeek}
                </span>
                {isCustomFilter && (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                )}
                <ChevronDown className="h-3.5 w-3.5 opacity-40 shrink-0" />
              </Button>
            </PopoverTrigger>

            <PopoverContent align="end" className="w-80 p-0">
              {/* Popover header */}
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <span className="text-sm font-semibold">Date Range</span>
                {isCustomFilter && (
                  <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 h-4 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400">
                    filtered
                  </Badge>
                )}
              </div>

              <div className="p-4 space-y-4">
                {/* Quick presets */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quick Select</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: "All Time", value: "all" as const },
                      { label: "Last Year", value: "1y" as const },
                      { label: "3 Years", value: "3y" as const },
                      { label: "5 Years", value: "5y" as const },
                      { label: "Since 2020", value: "weather" as const, icon: <CloudRain className="h-3 w-3" /> },
                    ].map(({ label, value, icon }) => (
                      <button
                        key={value}
                        onClick={() => { applyPreset(value); setFilterOpen(false); }}
                        disabled={loading}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border bg-muted/40 hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {icon}
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Custom from/to */}
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Custom Range</p>

                  <div className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-2">
                    <span className="text-xs text-muted-foreground">From</span>
                    <Select value={String(filterStartYear)} onValueChange={(v) => setFilterStartYear(Number(v))}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-48">
                        {availableYears.map((y) => (
                          <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground text-center">W</span>
                    <Select value={String(filterStartWeek)} onValueChange={(v) => setFilterStartWeek(Number(v))}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-48">
                        {weekNumbers.map((w) => (
                          <SelectItem key={w} value={String(w)} className="text-xs">Week {w}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-2">
                    <span className="text-xs text-muted-foreground">To</span>
                    <Select value={String(filterEndYear)} onValueChange={(v) => setFilterEndYear(Number(v))}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-48">
                        {availableYears.map((y) => (
                          <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground text-center">W</span>
                    <Select value={String(filterEndWeek)} onValueChange={(v) => setFilterEndWeek(Number(v))}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-48">
                        {weekNumbers.map((w) => (
                          <SelectItem key={w} value={String(w)} className="text-xs">Week {w}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Popover footer actions */}
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-t bg-muted/20">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { resetFilter(); setFilterOpen(false); }}
                  disabled={loading}
                  className="h-7 text-xs text-muted-foreground"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reset
                </Button>
                <Button
                  size="sm"
                  onClick={() => { applyFilter(); setFilterOpen(false); }}
                  disabled={loading}
                  className="h-7 text-xs"
                >
                  {loading
                    ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    : <Filter className="h-3 w-3 mr-1" />}
                  Apply
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Button onClick={() => loadAllHistoricalData()} disabled={loading} size="sm" className="h-9">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Activity className="h-4 w-4 mr-2" />
            )}
            Refresh Data
          </Button>
        </div>
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
