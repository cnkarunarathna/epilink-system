"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
} from "lucide-react";
import { useEffect, useState } from "react";
import { fetchOutbreakAlerts } from "@/services/analytics.service";

interface Alert {
  district: string;
  current_cases: number;
  avg_cases: number;
  alert_level: string;
  description: string;
  severity: string;
}

export default function OutbreakAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const data = await fetchOutbreakAlerts();
      setAlerts(data);
    } catch (error) {
      console.error("Failed to load alerts:", error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive">Critical</Badge>;
      case "high":
        return <Badge variant="destructive">High</Badge>;
      case "moderate":
        return <Badge variant="default">Moderate</Badge>;
      default:
        return <Badge variant="secondary">Low</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Outbreak Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <Activity className="h-6 w-6 animate-pulse text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card className="border-2 border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-green-600" />
            </div>
            Outbreak Alerts
          </CardTitle>
          <CardDescription>Real-time outbreak monitoring</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <div className="p-4 bg-green-50 rounded-full mb-3">
              <Activity className="h-8 w-8 text-green-600" />
            </div>
            <p className="font-medium text-green-700">All Clear!</p>
            <p className="text-sm">No active outbreak alerts detected</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-2">
      <CardHeader className="bg-gradient-to-r from-red-50 to-orange-50">
        <CardTitle className="flex items-center gap-2">
          <div className="p-2 bg-red-100 rounded-lg animate-pulse">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          Outbreak Alerts
          <Badge variant="destructive" className="ml-auto">
            {alerts.length} Active
          </Badge>
        </CardTitle>
        <CardDescription>
          Districts requiring immediate attention
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-3">
          {alerts.map((alert, index) => (
            <div
              key={alert.district}
              className={`p-4 rounded-lg border-l-4 transition-all duration-300 hover:shadow-md hover:scale-[1.02] animate-in slide-in-from-left-5 ${
                alert.severity === "critical"
                  ? "border-red-500 bg-gradient-to-r from-red-50 to-red-100/50 hover:from-red-100 hover:to-red-200/50"
                  : alert.severity === "high"
                  ? "border-orange-500 bg-gradient-to-r from-orange-50 to-orange-100/50 hover:from-orange-100 hover:to-orange-200/50"
                  : "border-yellow-500 bg-gradient-to-r from-yellow-50 to-yellow-100/50 hover:from-yellow-100 hover:to-yellow-200/50"
              }`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold">{alert.district}</h4>
                    {getSeverityBadge(alert.severity)}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {alert.description}
                  </p>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1">
                      <span className="font-medium">Current:</span>
                      <span className="font-bold text-red-600">
                        {alert.current_cases}
                      </span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="font-medium">4-week avg:</span>
                      <span>{alert.avg_cases.toFixed(0)}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      {alert.current_cases > alert.avg_cases ? (
                        <>
                          <TrendingUp className="h-3 w-3 text-red-500" />
                          <span className="text-red-600 font-medium">
                            +
                            {(
                              (alert.current_cases / alert.avg_cases - 1) *
                              100
                            ).toFixed(0)}
                            %
                          </span>
                        </>
                      ) : (
                        <>
                          <TrendingDown className="h-3 w-3 text-green-500" />
                          <span className="text-green-600 font-medium">
                            {(
                              (alert.current_cases / alert.avg_cases - 1) *
                              100
                            ).toFixed(0)}
                            %
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
