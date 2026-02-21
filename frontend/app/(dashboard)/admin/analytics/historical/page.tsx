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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  BarChart3,
  LineChart,
  Activity,
  Loader2,
  CloudRain,
  Thermometer,
  X,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  fetchHistoricalRange,
  fetchCompareDistricts,
  fetchYearlySummary,
  fetchLatestPerDistrict,
} from "@/services/analytics.service";
import {
  LineChart as RechartsLine,
  BarChart as RechartsBar,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { useTheme } from "next-themes";

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
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>District Time Series Comparison</CardTitle>
                  <CardDescription>
                    Compare dengue case trends across selected districts
                  </CardDescription>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          className="ml-auto flex items-center gap-2"
                        >
                          Select Districts <ChevronDown className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-[200px] max-h-[300px] overflow-y-auto"
                      >
                        <DropdownMenuLabel>
                          Available Districts
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {availableDistricts.map((district) => {
                          const isSelected =
                            selectedDistricts.includes(district);
                          return (
                            <DropdownMenuCheckboxItem
                              key={`comp-${district}`}
                              checked={isSelected}
                              onCheckedChange={() => {
                                if (isSelected) {
                                  if (selectedDistricts.length > 1) {
                                    setSelectedDistricts(
                                      selectedDistricts.filter(
                                        (d) => d !== district,
                                      ),
                                    );
                                  } else {
                                    toast.error(
                                      "At least one district must be selected",
                                    );
                                  }
                                } else {
                                  if (selectedDistricts.length >= 5) {
                                    toast.error(
                                      "You can only compare up to 5 districts at a time",
                                    );
                                  } else {
                                    setSelectedDistricts([
                                      ...selectedDistricts,
                                      district,
                                    ]);
                                  }
                                }
                              }}
                            >
                              {district}
                            </DropdownMenuCheckboxItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2 mt-2">
                    {selectedDistricts.map((district) => (
                      <Badge
                        key={`badge-${district}`}
                        variant="secondary"
                        className="flex items-center gap-1 group"
                      >
                        {district}
                        {selectedDistricts.length > 1 && (
                          <button
                            type="button"
                            className="ml-1 rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSelectedDistricts(
                                selectedDistricts.filter((d) => d !== district),
                              );
                            }}
                          >
                            <X className="h-3 w-3 text-muted-foreground group-hover:text-destructive transition-colors" />
                          </button>
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={500}>
                <RechartsLine data={timeSeriesData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isDark ? "#374151" : "#e5e7eb"}
                  />
                  <XAxis
                    dataKey="weekLabel"
                    angle={-45}
                    textAnchor="end"
                    height={100}
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
                  {selectedDistricts.map((district, idx) => (
                    <Line
                      key={district}
                      type="monotone"
                      dataKey={district}
                      stroke={COLORS[idx % COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </RechartsLine>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Yearly Summary Tab */}
        <TabsContent value="yearly" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Yearly District Summary</CardTitle>
                  <CardDescription>
                    Detailed statistics for each district in {selectedYear}
                  </CardDescription>
                </div>
                <Select
                  value={selectedYear.toString()}
                  onValueChange={(v) => setSelectedYear(parseInt(v))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {yearlySummary ? (
                <div className="space-y-4">
                  {/* Bar chart */}
                  <ResponsiveContainer width="100%" height={400}>
                    <RechartsBar data={yearlySummary.districts}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={isDark ? "#374151" : "#e5e7eb"}
                      />
                      <XAxis
                        dataKey="district"
                        angle={-45}
                        textAnchor="end"
                        height={100}
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
                      <Bar
                        dataKey="total_cases"
                        fill="#3b82f6"
                        name="Total Cases"
                      />
                      <Bar
                        dataKey="max_cases"
                        fill="#dc2626"
                        name="Peak Week"
                      />
                    </RechartsBar>
                  </ResponsiveContainer>

                  {/* District table */}
                  <div className="rounded-lg border">
                    <table className="w-full">
                      <thead className="border-b bg-muted/50">
                        <tr>
                          <th className="p-3 text-left font-medium">
                            District
                          </th>
                          <th className="p-3 text-right font-medium">Total</th>
                          <th className="p-3 text-right font-medium">
                            Average
                          </th>
                          <th className="p-3 text-right font-medium">Peak</th>
                          <th className="p-3 text-right font-medium">
                            Minimum
                          </th>
                          <th className="p-3 text-center font-medium">
                            Risk Level
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {yearlySummary.districts.map((district, idx) => {
                          const risk = getRiskLevel(district.max_cases);
                          return (
                            <tr
                              key={district.district}
                              className="border-b last:border-0"
                            >
                              <td className="p-3 font-medium">
                                {district.district}
                              </td>
                              <td className="p-3 text-right">
                                {district.total_cases.toLocaleString()}
                              </td>
                              <td className="p-3 text-right">
                                {district.avg_cases.toFixed(1)}
                              </td>
                              <td className="p-3 text-right font-semibold text-red-600 dark:text-red-400">
                                {district.max_cases}
                              </td>
                              <td className="p-3 text-right text-muted-foreground">
                                {district.min_cases}
                              </td>
                              <td className="p-3 text-center">
                                <Badge variant={risk.color as any}>
                                  {risk.level}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Seasonal Patterns Tab */}
        <TabsContent value="seasonal" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Seasonal Pattern Analysis</CardTitle>
              <CardDescription>
                Average dengue cases by week across all years
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={seasonalPattern}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isDark ? "#374151" : "#e5e7eb"}
                  />
                  <XAxis
                    dataKey="week"
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
                    dataKey="avgCases"
                    stroke="#f59e0b"
                    fill="#fbbf24"
                    fillOpacity={0.6}
                    name="Average Cases per Week"
                  />
                </AreaChart>
              </ResponsiveContainer>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Peak Season
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      Week{" "}
                      {seasonalPattern.length > 0
                        ? [...seasonalPattern].sort(
                            (a, b) => b.avgCases - a.avgCases,
                          )[0]?.week
                        : "-"}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Highest average cases
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Low Season
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      Week{" "}
                      {seasonalPattern.length > 0
                        ? [...seasonalPattern].sort(
                            (a, b) => a.avgCases - b.avgCases,
                          )[0]?.week
                        : "-"}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Lowest average cases
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Pattern Variation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {seasonalPattern.length > 0
                        ? (
                            Math.max(
                              ...seasonalPattern.map((s) => s.avgCases),
                            ) /
                            Math.min(...seasonalPattern.map((s) => s.avgCases))
                          ).toFixed(1)
                        : "-"}
                      x
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Peak to trough ratio
                    </p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Weather Impact Tab */}
        <TabsContent value="weather" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Weather Impact Analysis</CardTitle>
                  <CardDescription>
                    Correlation between dengue cases and weather conditions
                    across selected districts
                  </CardDescription>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          className="ml-auto flex items-center gap-2"
                        >
                          Select Districts <ChevronDown className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-[200px] max-h-[300px] overflow-y-auto"
                      >
                        <DropdownMenuLabel>Analyze Districts</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {availableDistricts.map((district) => {
                          const isSelected =
                            selectedDistricts.includes(district);
                          return (
                            <DropdownMenuCheckboxItem
                              key={`weather-sel-${district}`}
                              checked={isSelected}
                              onCheckedChange={() => {
                                if (isSelected) {
                                  if (selectedDistricts.length > 1) {
                                    setSelectedDistricts(
                                      selectedDistricts.filter(
                                        (d) => d !== district,
                                      ),
                                    );
                                  } else {
                                    toast.error(
                                      "At least one district must be selected",
                                    );
                                  }
                                } else {
                                  if (selectedDistricts.length >= 5) {
                                    toast.error(
                                      "You can only compare up to 5 districts at a time",
                                    );
                                  } else {
                                    setSelectedDistricts([
                                      ...selectedDistricts,
                                      district,
                                    ]);
                                  }
                                }
                              }}
                            >
                              {district}
                            </DropdownMenuCheckboxItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2 mt-2">
                    {selectedDistricts.map((district) => (
                      <Badge
                        key={`w-badge-${district}`}
                        variant="secondary"
                        className="flex items-center gap-1 group"
                      >
                        {district}
                        {selectedDistricts.length > 1 && (
                          <button
                            type="button"
                            className="ml-1 rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSelectedDistricts(
                                selectedDistricts.filter((d) => d !== district),
                              );
                            }}
                          >
                            <X className="h-3 w-3 text-muted-foreground group-hover:text-destructive transition-colors" />
                          </button>
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={500}>
                <ComposedChart data={processWeatherCorrelationData()}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isDark ? "#374151" : "#e5e7eb"}
                  />
                  <XAxis
                    dataKey="weekLabel"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    tick={{ fill: isDark ? "#9ca3af" : "#6b7280" }}
                  />
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    tick={{ fill: isDark ? "#9ca3af" : "#6b7280" }}
                    label={{
                      value: "Cases",
                      angle: -90,
                      position: "insideLeft",
                      fill: isDark ? "#9ca3af" : "#6b7280",
                    }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: "#f59e0b" }}
                    label={{
                      value: "Temp (°C) / Precip (mm)",
                      angle: 90,
                      position: "insideRight",
                      fill: "#f59e0b",
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? "#1f2937" : "#fff",
                      borderColor: isDark ? "#374151" : "#e5e7eb",
                      color: isDark ? "#f3f4f6" : "#111827",
                    }}
                  />
                  <Legend />
                  <Bar
                    yAxisId="left"
                    dataKey="cases"
                    fill="#3b82f6"
                    name="Total Cases"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="temp"
                    stroke="#f59e0b"
                    name="Avg Temperature (°C)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="precip"
                    stroke="#06b6d4"
                    name="Avg Precipitation (mm)"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Thermometer className="h-4 w-4" />
                      Temperature Impact
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Higher temperatures can accelerate the life cycle of
                      mosquitoes, potentially increasing dengue risk following
                      warmer periods.
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <CloudRain className="h-4 w-4" />
                      Precipitation Impact
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Increased rainfall creates breeding grounds for
                      mosquitoes, typically leading to a rise in cases after a
                      lag of 2-4 weeks.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
