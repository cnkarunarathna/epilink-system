"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, Eye } from "lucide-react";
import { useEffect, useState } from "react";
import {
  fetchPublicHotspots,
  fetchPublicGrowthRate,
} from "@/services/public-analytics.service";

interface WatchItem {
  district: string;
  status: "rising" | "declining";
  message: string;
  urgency: "high" | "moderate" | "low";
}

export default function DistrictWatchList() {
  const [items, setItems] = useState<WatchItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const [hotspots, growth] = await Promise.all([
        fetchPublicHotspots(),
        fetchPublicGrowthRate(4),
      ]);

      const watchItems: WatchItem[] = [];
      const seen = new Set<string>();

      hotspots.slice(0, 5).forEach((h: any) => {
        seen.add(h.district);
        watchItems.push({
          district: h.district,
          status: "rising",
          message:
            h.severity === "critical"
              ? "Cases rose sharply this week. Take extra precautions."
              : h.severity === "high"
                ? "Cases are increasing fast. Stay alert."
                : "Cases are rising. Be cautious.",
          urgency:
            h.severity === "critical"
              ? "high"
              : h.severity === "high"
                ? "moderate"
                : "low",
        });
      });

      growth
        .filter((g: any) => g.trend === "decreasing" && !seen.has(g.district))
        .slice(0, 5)
        .forEach((g: any) => {
          watchItems.push({
            district: g.district,
            status: "declining",
            message: "Cases are declining. Situation is improving.",
            urgency: "low",
          });
        });

      setItems(watchItems);
    } catch (e) {
      console.error("Failed to load watch list:", e);
    } finally {
      setLoading(false);
    }
  };

  const rising = items.filter((i) => i.status === "rising");
  const declining = items.filter((i) => i.status === "declining");

  const urgencyDot = (urgency: string) => {
    if (urgency === "high") return "bg-red-500";
    if (urgency === "moderate") return "bg-orange-500";
    return "bg-yellow-400";
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Districts to Watch
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-40">
            <div className="animate-pulse text-muted-foreground">
              Loading...
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-2">
      <CardHeader className="bg-gradient-to-r from-amber-50 to-red-50 dark:from-amber-950/50 dark:to-red-950/50">
        <CardTitle className="flex items-center gap-2">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
            <Eye className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          Districts to Watch
        </CardTitle>
        <CardDescription>
          Areas where dengue is currently rising or falling — updated weekly
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-5">
        {rising.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4" />
              Rising — take care in these areas
            </h4>
            <div className="space-y-2">
              {rising.map((item, i) => (
                <div
                  key={item.district}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-red-50/60 dark:bg-red-950/30 border-red-200 dark:border-red-800 animate-in slide-in-from-left-4"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${urgencyDot(item.urgency)}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{item.district}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.message}
                    </div>
                  </div>
                  <TrendingUp className="h-4 w-4 text-red-500 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}

        {declining.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-green-600 dark:text-green-400 flex items-center gap-1.5">
              <TrendingDown className="h-4 w-4" />
              Improving — cases are falling
            </h4>
            <div className="space-y-2">
              {declining.map((item, i) => (
                <div
                  key={item.district}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-green-50/60 dark:bg-green-950/30 border-green-200 dark:border-green-800 animate-in slide-in-from-right-4"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-green-500" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{item.district}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.message}
                    </div>
                  </div>
                  <TrendingDown className="h-4 w-4 text-green-500 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}

        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <Minus className="h-8 w-8 mb-2" />
            <p className="font-medium">All districts appear stable this week</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
