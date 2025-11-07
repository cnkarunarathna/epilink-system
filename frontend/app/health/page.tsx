"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import healthService, { type HealthResponse } from "@/services/health.service";

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
      <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
            Loading health data...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">
            System Health Monitor
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Real-time monitoring of backend services and database connectivity
          </p>
        </div>

        {error ? (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-6">
            <div className="flex items-center gap-3">
              <div className="shrink-0">
                <svg
                  className="h-8 w-8 text-red-600 dark:text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-900 dark:text-red-200">
                  Connection Error
                </h3>
                <p className="text-red-700 dark:text-red-300 mt-1">{error}</p>
                <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                  Make sure the backend server is running on port 3001
                </p>
              </div>
            </div>
          </div>
        ) : healthData ? (
          <div className="space-y-6">
            {/* Overall Status Card */}
            <div className="rounded-lg bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                    Overall Status
                  </h2>
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                        healthData.status === "OK"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          healthData.status === "OK"
                            ? "bg-green-600"
                            : "bg-red-600"
                        }`}
                      ></span>
                      {healthData.status}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Last Updated
                  </p>
                  <p className="text-sm font-mono text-slate-900 dark:text-white">
                    {new Date(healthData.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Database Status Card */}
            <div className="rounded-lg bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700 p-6">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <svg
                  className="h-6 w-6 text-blue-600 dark:text-blue-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                  />
                </svg>
                Database Connection
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-lg bg-slate-50 dark:bg-slate-700/50 p-4">
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                    Status
                  </p>
                  <p
                    className={`text-lg font-semibold ${
                      healthData.database.status === "OK"
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {healthData.database.status}
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 dark:bg-slate-700/50 p-4">
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                    Database Name
                  </p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white font-mono">
                    {healthData.database.database}
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 dark:bg-slate-700/50 p-4">
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                    Connection
                  </p>
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-3 w-3 rounded-full ${
                        healthData.database.connected
                          ? "bg-green-500 animate-pulse"
                          : "bg-red-500"
                      }`}
                    ></span>
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
            </div>

            {/* Additional Info Card */}
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-6">
              <div className="flex gap-3">
                <svg
                  className="h-6 w-6 text-blue-600 dark:text-blue-400 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-2">
                    Auto-Refresh Enabled
                  </h3>
                  <p className="text-blue-700 dark:text-blue-300 text-sm">
                    This page automatically refreshes every 5 seconds to provide
                    real-time health monitoring.
                  </p>
                </div>
              </div>
            </div>

            {/* Raw JSON Response (for debugging) */}
            <details className="rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
                View Raw JSON Response
              </summary>
              <pre className="mt-4 overflow-x-auto rounded bg-slate-900 p-4 text-xs text-green-400">
                {JSON.stringify(healthData, null, 2)}
              </pre>
            </details>
          </div>
        ) : null}
      </div>
    </div>
  );
}
