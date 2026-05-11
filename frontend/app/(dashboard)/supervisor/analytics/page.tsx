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
} from "lucide-react";
import {
  fetchLatestPerDistrict,
  fetchTimeseries,
  DistrictLatest,
} from "@/services/analytics.service";
import { fetchTaskStats, TaskStats } from "@/services/tasks.service";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import WeeklyTrendAreaChart from "@/components/dashboard/analytics/WeeklyTrendAreaChart";
import TaskStatusDonutChart from "@/components/dashboard/analytics/TaskStatusDonutChart";
import DistrictWeatherCorrelationChart from "@/components/dashboard/analytics/DistrictWeatherCorrelationChart";
import DistrictOutbreakAlert from "@/components/dashboard/analytics/DistrictOutbreakAlert";

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
  const [taskStats, setTaskStats] = useState<TaskStats | null>(null);

  const supervisorDistrict = user?.district || "Colombo";

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [districtsData, timeseriesData, statsData] = await Promise.all([
        fetchLatestPerDistrict(),
        fetchTimeseries(supervisorDistrict).catch(() => []),
        fetchTaskStats().catch(() => null),
      ]);

      const myDistrict = districtsData.find(
        (d) => d.district.toLowerCase() === supervisorDistrict.toLowerCase(),
      );
      if (myDistrict) setDistrictData(myDistrict);

      setTimeseries(timeseriesData.slice(-12));
      setTaskStats(statsData);
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
      return {
        level: "Medium",
        color: "text-yellow-600",
        bg: "bg-yellow-100",
      };
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
          <h2 className="text-3xl font-bold tracking-tight">
            District Analytics
          </h2>
          <p className="text-muted-foreground">
            {supervisorDistrict} District Insights
          </p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Risk Overview — unchanged */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Current Risk Level
            </CardTitle>
            <AlertTriangle
              className={`h-4 w-4 ${risk?.color || "text-gray-400"}`}
            />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${risk?.color || ""}`}>
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                risk?.level || "-"
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Based on ML predictions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Predicted Cases
            </CardTitle>
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
              {trend >= 0 ? `+${trend.toFixed(0)}` : trend.toFixed(0)} from
              last week
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

      {/* Charts Row — upgraded from CSS to Recharts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Weekly Trend</CardTitle>
            <CardDescription>
              Predicted cases over the last 12 weeks
            </CardDescription>
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

      {/* New Row — weather correlation + district alert */}
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
    </div>
  );
}
