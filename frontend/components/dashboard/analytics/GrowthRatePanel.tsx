"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchGrowthRate } from "@/services/analytics.service";

interface GrowthData {
  district: string;
  avg_growth_rate: number;
  current_cases: number;
  prev_cases: number;
  trend: string;
}

export default function GrowthRatePanel() {
  const [growthData, setGrowthData] = useState<GrowthData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGrowthRate();
  }, []);

  const loadGrowthRate = async () => {
    try {
      setLoading(true);
      const data = await fetchGrowthRate(4);
      setGrowthData(data);
    } catch (error) {
      console.error("Failed to load growth rate:", error);
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "increasing":
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case "decreasing":
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTrendBadge = (trend: string) => {
    switch (trend) {
      case "increasing":
        return <Badge variant="destructive">Rising</Badge>;
      case "decreasing":
        return <Badge className="bg-green-500">Falling</Badge>;
      default:
        return <Badge variant="secondary">Stable</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Growth Rate Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse text-muted-foreground">
              Loading...
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Split into increasing and decreasing
  const increasing = growthData
    .filter((d) => d.trend === "increasing")
    .sort((a, b) => b.avg_growth_rate - a.avg_growth_rate)
    .slice(0, 5);
  const decreasing = growthData
    .filter((d) => d.trend === "decreasing")
    .sort((a, b) => a.avg_growth_rate - b.avg_growth_rate)
    .slice(0, 5);

  return (
    <Card className="shadow-lg border-2 hover:shadow-xl transition-shadow">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/50 dark:to-purple-950/50">
        <CardTitle className="flex items-center gap-2">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
            <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          Growth Rate Analysis
        </CardTitle>
        <CardDescription>
          4-week average growth trends by district
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-6">
          {/* Fastest Growing */}
          {increasing.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
                  <div className="p-1.5 bg-red-100 dark:bg-red-900/50 rounded">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  Fastest Growing
                </h4>
                <Badge variant="destructive">{increasing.length}</Badge>
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-red-300 dark:scrollbar-thumb-red-800 scrollbar-track-red-100 dark:scrollbar-track-red-950">
                {increasing.map((item, index) => (
                  <div
                    key={item.district}
                    className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-red-50 to-red-100 dark:from-red-950/50 dark:to-red-900/30 border-2 border-red-200 dark:border-red-800 hover:shadow-md hover:scale-[1.02] transition-all duration-300 cursor-pointer animate-in slide-in-from-left-5"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-200 dark:bg-red-800/50 rounded-full">
                        {getTrendIcon(item.trend)}
                      </div>
                      <div>
                        <div className="font-semibold text-base">
                          {item.district}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span className="font-medium">
                            {item.current_cases}
                          </span>
                          <span>→</span>
                          <span className="line-through opacity-60">
                            {item.prev_cases}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-xl text-red-600 dark:text-red-400">
                        +{item.avg_growth_rate.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Declining */}
          {decreasing.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-green-600 dark:text-green-400 flex items-center gap-2">
                  <div className="p-1.5 bg-green-100 dark:bg-green-900/50 rounded">
                    <TrendingDown className="h-4 w-4" />
                  </div>
                  Declining
                </h4>
                <Badge className="bg-green-500">{decreasing.length}</Badge>
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-green-300 dark:scrollbar-thumb-green-800 scrollbar-track-green-100 dark:scrollbar-track-green-950">
                {decreasing.map((item, index) => (
                  <div
                    key={item.district}
                    className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/30 border-2 border-green-200 dark:border-green-800 hover:shadow-md hover:scale-[1.02] transition-all duration-300 cursor-pointer animate-in slide-in-from-right-5"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-200 dark:bg-green-800/50 rounded-full">
                        {getTrendIcon(item.trend)}
                      </div>
                      <div>
                        <div className="font-semibold text-base">
                          {item.district}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span className="font-medium">
                            {item.current_cases}
                          </span>
                          <span>→</span>
                          <span className="line-through opacity-60">
                            {item.prev_cases}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-xl text-green-600 dark:text-green-400">
                        {item.avg_growth_rate.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
