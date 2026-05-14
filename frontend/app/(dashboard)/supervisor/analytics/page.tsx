"use client";

import { useState, useEffect, useCallback } from "react";
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
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Loader2,
  AlertTriangle,
  ThermometerSun,
  Droplets,
  Cloud,
  BellRing,
  BarChart3,
  ClipboardList,
  Clock,
  Download,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  MapPin,
  Calendar,
  GitBranch,
  Building2,
  History,
} from "lucide-react";
import { exportToCSV } from "@/lib/export";
import {
  fetchLatestPerDistrict,
  fetchTimeseries,
  fetchSeasonalPattern,
  fetchSpilloverRisk,
  fetchInterventionHistory,
  fetchDemographicHotspots,
  DistrictLatest,
  SeasonalPatternResponse,
  SpilloverResponse,
  InterventionHistoryResponse,
  DemographicHotspotsResponse,
} from "@/services/analytics.service";
import { fetchTaskStats, TaskStats } from "@/services/tasks.service";
import { listReports, WeeklyReport } from "@/services/reports.service";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { DISTRICTS } from "@/lib/constants/districts";
import WeeklyTrendAreaChart from "@/components/dashboard/analytics/WeeklyTrendAreaChart";
import TaskStatusDonutChart from "@/components/dashboard/analytics/TaskStatusDonutChart";
import DistrictWeatherCorrelationChart from "@/components/dashboard/analytics/DistrictWeatherCorrelationChart";
import DistrictOutbreakAlert from "@/components/dashboard/analytics/DistrictOutbreakAlert";
import TaskTypeDonutChart from "@/components/dashboard/task-analytics/TaskTypeDonutChart";
import TaskPriorityBarChart from "@/components/dashboard/task-analytics/TaskPriorityBarChart";
import WeeklyTaskTrendChart from "@/components/dashboard/task-analytics/WeeklyTaskTrendChart";
import OverdueTaskCards from "@/components/dashboard/task-analytics/OverdueTaskCards";
import CaseTrendChart from "@/components/dashboard/reports/CaseTrendChart";
import ReportStatusDonut from "@/components/dashboard/reports/ReportStatusDonut";
import HighRiskFrequencyChart from "@/components/dashboard/reports/HighRiskFrequencyChart";
import YearOverYearChart from "@/components/dashboard/analytics/YearOverYearChart";
import SeasonalPatternChart from "@/components/dashboard/analytics/SeasonalPatternChart";
import NeighbourRiskChart from "@/components/dashboard/analytics/NeighbourRiskChart";
import ZoneHotspotChart from "@/components/dashboard/analytics/ZoneHotspotChart";
import OutbreakHistoryChart from "@/components/dashboard/analytics/OutbreakHistoryChart";

interface TimeseriesPoint {
  year: number;
  week: number;
  predicted_cases: number;
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [districtData, setDistrictData] = useState<DistrictLatest | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesPoint[]>([]);
  const [fullTimeseries, setFullTimeseries] = useState<TimeseriesPoint[]>([]);
  const [taskStats, setTaskStats] = useState<TaskStats | null>(null);
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [seasonalData, setSeasonalData] = useState<SeasonalPatternResponse | null>(null);
  const [spilloverData, setSpilloverData] = useState<SpilloverResponse | null>(null);
  const [interventionData, setInterventionData] = useState<InterventionHistoryResponse | null>(null);
  const [zoneData, setZoneData] = useState<DemographicHotspotsResponse | null>(null);

  const supervisorDistrict = user?.district || "Colombo";
  const districtId =
    DISTRICTS.find((d) => d.name.toLowerCase() === supervisorDistrict.toLowerCase())?.id ?? 1;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [
        districtsData,
        timeseriesData,
        statsData,
        reportsData,
        seasonal,
        spillover,
        intervention,
        zone,
      ] = await Promise.all([
        fetchLatestPerDistrict(),
        fetchTimeseries(supervisorDistrict).catch(() => []),
        fetchTaskStats().catch(() => null),
        listReports().catch(() => []),
        fetchSeasonalPattern(supervisorDistrict).catch(() => null),
        fetchSpilloverRisk(supervisorDistrict).catch(() => null),
        fetchInterventionHistory(supervisorDistrict).catch(() => null),
        fetchDemographicHotspots(supervisorDistrict).catch(() => null),
      ]);

      const myDistrict = districtsData.find(
        (d) => d.district.toLowerCase() === supervisorDistrict.toLowerCase(),
      );
      if (myDistrict) setDistrictData(myDistrict);

      setFullTimeseries(timeseriesData);
      setTimeseries(timeseriesData.slice(-12));
      setTaskStats(statsData);
      setReports(reportsData);
      setSeasonalData(seasonal);
      setSpilloverData(spillover);
      setInterventionData(intervention);
      setZoneData(zone);
    } catch (error) {
      console.error("Failed to load analytics:", error);
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [supervisorDistrict]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getRiskLevel = (cases: number) => {
    if (cases >= 90)
      return { level: "Critical", color: "text-red-600", bg: "bg-red-100" };
    if (cases >= 50)
      return { level: "High", color: "text-orange-600", bg: "bg-orange-100" };
    if (cases >= 25)
      return { level: "Medium", color: "text-yellow-600", bg: "bg-yellow-100" };
    return { level: "Low", color: "text-green-600", bg: "bg-green-100" };
  };

  const risk = districtData ? getRiskLevel(districtData.predicted_cases) : null;

  const trend =
    timeseries.length >= 2
      ? timeseries[timeseries.length - 1].predicted_cases -
        timeseries[timeseries.length - 2].predicted_cases
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">District Analytics</h2>
          <p className="text-muted-foreground">
            {supervisorDistrict} District Insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={loading || timeseries.length === 0}
            onClick={() =>
              exportToCSV(
                timeseries.map((p) => ({
                  Week: p.week,
                  Year: p.year,
                  "Predicted Cases": p.predicted_cases,
                })),
                `${supervisorDistrict.toLowerCase()}-district-analytics.csv`
              )
            }
          >
            <Download className="h-4 w-4 mr-1.5" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Risk overview cards — always visible */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Risk Level</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${risk?.color || "text-gray-400"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${risk?.color || ""}`}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : risk?.level || "-"}
            </div>
            <p className="text-xs text-muted-foreground">Based on ML predictions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Predicted Cases</CardTitle>
            {trend >= 0 ? (
              <TrendingUp className="h-4 w-4 text-red-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-green-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                `~${Math.round(districtData?.predicted_cases || 0)}`
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {trend >= 0 ? `+${trend.toFixed(0)}` : trend.toFixed(0)} from last week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Temperature</CardTitle>
            <ThermometerSun className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : districtData?.temperature ? (
                `${districtData.temperature.toFixed(1)}°C`
              ) : (
                "-"
              )}
            </div>
            <p className="text-xs text-muted-foreground">Average this week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Precipitation</CardTitle>
            <Droplets className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : districtData?.precipitation !== null ? (
                `${districtData?.precipitation?.toFixed(1)}mm`
              ) : (
                "-"
              )}
            </div>
            <p className="text-xs text-muted-foreground">Total this week</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed analytics */}
      <Tabs defaultValue="overview">
        <TabsList className="mb-2">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">Task Analytics</TabsTrigger>
          <TabsTrigger value="reports">Report Insights</TabsTrigger>
          <TabsTrigger value="disease">Disease Intelligence</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Overview ── */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Weekly Trend</CardTitle>
                <CardDescription>Predicted cases over the last 12 weeks</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center h-56">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <WeeklyTrendAreaChart
                    data={timeseries}
                    currentWeek={districtData?.week}
                    currentYear={districtData?.year}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Task Performance</CardTitle>
                <CardDescription>Task completion breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center h-48">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : taskStats ? (
                  <TaskStatusDonutChart stats={taskStats} />
                ) : (
                  <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                    No task data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cloud className="h-4 w-4 text-sky-500" />
                  Weather Impact
                </CardTitle>
                <CardDescription>
                  How weather correlates with dengue cases in {supervisorDistrict}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DistrictWeatherCorrelationChart
                  district={supervisorDistrict}
                  currentTemp={districtData?.temperature}
                  currentPrecip={districtData?.precipitation}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BellRing className="h-4 w-4 text-red-500" />
                  Alert Status
                </CardTitle>
                <CardDescription>
                  Active outbreak alerts for {supervisorDistrict}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DistrictOutbreakAlert district={supervisorDistrict} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Tab 2: Task Analytics ── */}
        <TabsContent value="tasks" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-blue-500" />
                  Task Type Distribution
                </CardTitle>
                <CardDescription>Task counts by type with completion rates</CardDescription>
              </CardHeader>
              <CardContent>
                <TaskTypeDonutChart districtId={districtId} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-orange-500" />
                  Task Priority Breakdown
                </CardTitle>
                <CardDescription>Completed vs remaining tasks by priority</CardDescription>
              </CardHeader>
              <CardContent>
                <TaskPriorityBarChart districtId={districtId} />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  Weekly Task Trend
                </CardTitle>
                <CardDescription>Tasks created vs completed over the last 8 weeks</CardDescription>
              </CardHeader>
              <CardContent>
                <WeeklyTaskTrendChart districtId={districtId} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-red-500" />
                  Overdue Tasks
                </CardTitle>
                <CardDescription>Tasks past their due date in your district</CardDescription>
              </CardHeader>
              <CardContent>
                <OverdueTaskCards districtId={districtId} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Tab 3: Report Insights ── */}
        <TabsContent value="reports" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChartIcon className="h-4 w-4 text-orange-500" />
                  Case Count Trend
                </CardTitle>
                <CardDescription>
                  Predicted and actual cases across all weekly reports
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center h-48">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <CaseTrendChart reports={reports} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4 text-green-500" />
                  Report Approval Status
                </CardTitle>
                <CardDescription>
                  Breakdown of report statuses (approved / pending / archived)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <ReportStatusDonut reports={reports} />
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-red-500" />
                High-Risk District Frequency
              </CardTitle>
              <CardDescription>
                Districts flagged as high-risk or critical across all reports —{" "}
                <span className="text-orange-500 font-medium">{supervisorDistrict}</span>{" "}
                highlighted
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <HighRiskFrequencyChart
                  reports={reports}
                  supervisorDistrict={supervisorDistrict}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 4: Disease Intelligence ── */}
        <TabsContent value="disease" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-indigo-500" />
                  Year-over-Year Comparison
                </CardTitle>
                <CardDescription>
                  Predicted cases per week across all available years in {supervisorDistrict}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center h-56">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <YearOverYearChart data={fullTimeseries} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-orange-500" />
                  Seasonal Pattern
                </CardTitle>
                <CardDescription>
                  Historical weekly averages and peak season windows for {supervisorDistrict}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center h-56">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : seasonalData ? (
                  <SeasonalPatternChart data={seasonalData} />
                ) : (
                  <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                    Seasonal data unavailable
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-blue-500" />
                  Neighbouring Districts
                </CardTitle>
                <CardDescription>
                  Case levels and spillover risk from districts bordering {supervisorDistrict}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center h-48">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : spilloverData ? (
                  <NeighbourRiskChart data={spilloverData} />
                ) : (
                  <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                    Spillover data unavailable
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-purple-500" />
                  Zone Priority Breakdown
                </CardTitle>
                <CardDescription>
                  Estimated cases and intervention priority by zone within {supervisorDistrict}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center h-48">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : zoneData ? (
                  <ZoneHotspotChart data={zoneData} />
                ) : (
                  <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                    Zone data unavailable
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-4 w-4 text-teal-500" />
                Outbreak History
              </CardTitle>
              <CardDescription>
                Past outbreak peaks and response effectiveness in {supervisorDistrict} — bar top
                labels show weeks to recovery
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : interventionData ? (
                <OutbreakHistoryChart data={interventionData} />
              ) : (
                <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                  Outbreak history unavailable
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
