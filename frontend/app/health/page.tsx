"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import healthService, { type HealthResponse } from "@/services/health.service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Database,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Activity,
  Info,
  RefreshCw,
} from "lucide-react";

export default function HealthPage() {
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHealthData = async () => {
      try {
        const data = await healthService.getHealth();
        setHealthData(data);
        setError(null);
      } catch (err) {
        if (axios.isAxiosError(err)) {
          setError(
            err.response?.data?.message ||
              err.message ||
              "Failed to fetch health data"
          );
        } else {
          setError("Unknown error occurred");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchHealthData();
    // Refresh health data every 5 seconds
    const interval = setInterval(fetchHealthData, 5000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-background to-muted">
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            <RefreshCw className="h-12 w-12 animate-spin text-primary" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-48 mx-auto" />
            <Skeleton className="h-4 w-32 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-background to-muted p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Activity className="h-10 w-10 text-primary" />
            <div>
              <h1 className="text-4xl font-bold tracking-tight">
                System Health Monitor
              </h1>
              <p className="text-muted-foreground">
                Real-time monitoring of backend services and database
                connectivity
              </p>
            </div>
          </div>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Connection Error</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>{error}</p>
              <p className="text-sm">
                Make sure the backend server is running on port 3001
              </p>
            </AlertDescription>
          </Alert>
        ) : healthData ? (
          <div className="space-y-6">
            {/* Overall Status Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      Overall Status
                      {healthData.status === "OK" ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                    </CardTitle>
                    <CardDescription>System operational status</CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      Last Updated
                    </p>
                    <p className="text-sm font-mono font-medium">
                      {new Date(healthData.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Badge
                  variant={
                    healthData.status === "OK" ? "default" : "destructive"
                  }
                  className="text-base px-4 py-2"
                >
                  <span
                    className={`mr-2 h-2 w-2 rounded-full ${
                      healthData.status === "OK"
                        ? "bg-green-400 animate-pulse"
                        : "bg-red-400"
                    }`}
                  />
                  {healthData.status}
                </Badge>
              </CardContent>
            </Card>

            {/* Database Status Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  Database Connection
                </CardTitle>
                <CardDescription>
                  PostgreSQL database connectivity status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2 p-4 rounded-lg border bg-card">
                    <p className="text-sm font-medium text-muted-foreground">
                      Status
                    </p>
                    <Badge
                      variant={
                        healthData.database.status === "OK"
                          ? "default"
                          : "destructive"
                      }
                      className="text-lg font-semibold"
                    >
                      {healthData.database.status}
                    </Badge>
                  </div>

                  <div className="space-y-2 p-4 rounded-lg border bg-card">
                    <p className="text-sm font-medium text-muted-foreground">
                      Database Name
                    </p>
                    <p className="text-lg font-semibold font-mono">
                      {healthData.database.database}
                    </p>
                  </div>

                  <div className="space-y-2 p-4 rounded-lg border bg-card">
                    <p className="text-sm font-medium text-muted-foreground">
                      Connection
                    </p>
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-3 w-3 rounded-full ${
                          healthData.database.connected
                            ? "bg-green-500 animate-pulse"
                            : "bg-red-500"
                        }`}
                      />
                      <p
                        className={`text-lg font-semibold ${
                          healthData.database.connected
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {healthData.database.connected
                          ? "Connected"
                          : "Disconnected"}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Info Card */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Auto-Refresh Enabled</AlertTitle>
              <AlertDescription>
                This page automatically refreshes every 5 seconds to provide
                real-time health monitoring.
              </AlertDescription>
            </Alert>

            {/* Debug Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Raw JSON Response</CardTitle>
                <CardDescription>Debugging information</CardDescription>
              </CardHeader>
              <CardContent>
                <details className="cursor-pointer">
                  <summary className="text-sm font-medium hover:text-primary transition-colors">
                    Click to view
                  </summary>
                  <Separator className="my-4" />
                  <pre className="mt-4 overflow-x-auto rounded-lg bg-muted p-4 text-xs">
                    <code>{JSON.stringify(healthData, null, 2)}</code>
                  </pre>
                </details>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}
