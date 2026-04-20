"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchHotspots } from "@/services/analytics.service";
import { fetchPublicHotspots } from "@/services/public-analytics.service";

interface Hotspot {
  district: string;
  current_cases: number;
  previous_cases: number;
  growth_rate: number;
  latitude: number;
  longitude: number;
  severity: string;
}

export default function HotspotsPanel({
  usePublicApi = false,
}: {
  usePublicApi?: boolean;
}) {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHotspots();
  }, []);

  const loadHotspots = async () => {
    try {
      setLoading(true);
      const data = usePublicApi
        ? await fetchPublicHotspots()
        : await fetchHotspots();
      setHotspots(data);
    } catch (error) {
      console.error("Failed to load hotspots:", error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    if (usePublicApi) {
      switch (severity) {
        case "critical":
          return <Badge variant="destructive">Sharp rise</Badge>;
        case "high":
          return <Badge className="bg-orange-500">Rising fast</Badge>;
        default:
          return <Badge className="bg-yellow-500">Rising</Badge>;
      }
    }
    switch (severity) {
      case "critical":
        return <Badge variant="destructive">Critical</Badge>;
      case "high":
        return <Badge className="bg-orange-500">High</Badge>;
      case "moderate":
        return <Badge className="bg-yellow-500">Moderate</Badge>;
      default:
        return <Badge variant="secondary">Low</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            Active Hotspots
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

  return (
    <Card className="shadow-lg border-2 hover:shadow-xl transition-shadow">
      <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/50 dark:to-red-950/50">
        <CardTitle className="flex items-center gap-2">
          <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
            <Flame className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          {usePublicApi ? "Areas with rising cases" : "Active Hotspots"}
          {hotspots.length > 0 && (
            <Badge variant="destructive" className="ml-auto">
              {hotspots.length}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {usePublicApi
            ? "Areas where dengue cases have increased suddenly"
            : "Districts with high case counts and rapid growth"}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        {hotspots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <div className="p-4 bg-muted rounded-full mb-3">
              <MapPin className="h-8 w-8" />
            </div>
            <p className="font-medium">
              {usePublicApi
                ? "No sudden rises detected"
                : "No hotspots detected"}
            </p>
            <p className="text-sm">
              {usePublicApi
                ? "All districts appear stable this week"
                : "All districts under control"}
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-gray-100 dark:scrollbar-track-gray-800">
            {hotspots.map((hotspot, index) => (
              <div
                key={hotspot.district}
                className={`p-4 rounded-lg border-2 transition-all duration-300 hover:shadow-md hover:scale-[1.02] cursor-pointer animate-in slide-in-from-right-5 ${
                  hotspot.severity === "critical"
                    ? "bg-gradient-to-r from-red-50 to-red-100 dark:from-red-950/50 dark:to-red-900/30 border-red-300 dark:border-red-800 hover:from-red-100 hover:to-red-200 dark:hover:from-red-900/50 dark:hover:to-red-800/30"
                    : hotspot.severity === "high"
                      ? "bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-950/50 dark:to-orange-900/30 border-orange-300 dark:border-orange-800 hover:from-orange-100 hover:to-orange-200 dark:hover:from-orange-900/50 dark:hover:to-orange-800/30"
                      : "bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-950/50 dark:to-yellow-900/30 border-yellow-300 dark:border-yellow-800 hover:from-yellow-100 hover:to-yellow-200 dark:hover:from-yellow-900/50 dark:hover:to-yellow-800/30"
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-1.5 rounded-lg ${
                        hotspot.severity === "critical"
                          ? "bg-red-200 dark:bg-red-800/50"
                          : hotspot.severity === "high"
                            ? "bg-orange-200 dark:bg-orange-800/50"
                            : "bg-yellow-200 dark:bg-yellow-800/50"
                      }`}
                    >
                      <MapPin className="h-4 w-4" />
                    </div>
                    <span className="font-semibold text-lg">
                      {hotspot.district}
                    </span>
                  </div>
                  {getSeverityBadge(hotspot.severity)}
                </div>
                {usePublicApi ? (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="p-2 bg-white/60 dark:bg-gray-800/60 rounded-lg flex-1 text-center">
                      <div className="text-xs text-muted-foreground mb-0.5">
                        Cases this week
                      </div>
                      <div className="font-bold text-xl">
                        {hotspot.current_cases}
                      </div>
                    </div>
                    <div
                      className={`text-sm font-medium flex items-center gap-1 ${
                        hotspot.growth_rate > 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-green-600 dark:text-green-400"
                      }`}
                    >
                      {hotspot.growth_rate > 0 ? "↑" : "↓"}
                      up from {hotspot.previous_cases} last week
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-2 bg-white/60 dark:bg-gray-800/60 rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">
                        Current
                      </div>
                      <div className="font-bold text-2xl">
                        {hotspot.current_cases}
                      </div>
                    </div>
                    <div className="text-center p-2 bg-white/60 dark:bg-gray-800/60 rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">
                        Previous
                      </div>
                      <div className="font-medium text-lg">
                        {hotspot.previous_cases}
                      </div>
                    </div>
                    <div className="text-center p-2 bg-white/60 dark:bg-gray-800/60 rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">
                        Growth
                      </div>
                      <div
                        className={`font-bold text-lg flex items-center justify-center gap-1 ${
                          hotspot.growth_rate > 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-green-600 dark:text-green-400"
                        }`}
                      >
                        {hotspot.growth_rate > 0 ? "↑" : "↓"}
                        {Math.abs(hotspot.growth_rate).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
