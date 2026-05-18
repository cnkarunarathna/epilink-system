"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  CloudRain,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  fetchLocationForecast,
  DailyWeather,
  getWeatherSeverity,
  getWeatherLabel,
  WeatherSeverity,
} from "@/services/weather.service";

export interface WeatherTarget {
  id: string;
  title: string;
  latitude: number | null;
  longitude: number | null;
  dueDate: string | null;
}

interface TaskWeatherRow {
  taskId: string;
  title: string;
  dueDate: string;
  weather: DailyWeather | null;
  severity: WeatherSeverity;
}

const SEVERITY_STYLES: Record<
  WeatherSeverity,
  { icon: string; textColor: string; bgColor: string; label: string }
> = {
  none:     { icon: "☀️",  textColor: "text-green-700",  bgColor: "bg-green-50 dark:bg-green-950/30",  label: "Clear"        },
  light:    { icon: "🌦️",  textColor: "text-sky-700",    bgColor: "bg-sky-50 dark:bg-sky-950/30",      label: "Light rain"   },
  moderate: { icon: "🌧️",  textColor: "text-amber-700",  bgColor: "bg-amber-50 dark:bg-amber-950/30",  label: "Moderate rain"},
  heavy:    { icon: "⛈️",  textColor: "text-orange-700", bgColor: "bg-orange-50 dark:bg-orange-950/30",label: "Heavy rain"   },
  storm:    { icon: "⛈️",  textColor: "text-red-700",    bgColor: "bg-red-50 dark:bg-red-950/30",      label: "Thunderstorm" },
};

export function WeatherWarning({ tasks }: { tasks: WeatherTarget[] }) {
  const [rows, setRows] = useState<TaskWeatherRow[]>([]);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const checkable = tasks.filter(
      (t) => t.latitude !== null && t.longitude !== null && t.dueDate !== null,
    );

    if (checkable.length === 0) {
      setRows([]);
      setFetching(false);
      return;
    }

    setFetching(true);
    setFetchError(false);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Group checkable tasks by rounded location (~1km buckets) to minimise API calls
    const byLocation = new Map<
      string,
      { lat: number; lon: number; taskIds: Set<string> }
    >();
    for (const t of checkable) {
      const key = `${t.latitude!.toFixed(2)},${t.longitude!.toFixed(2)}`;
      if (!byLocation.has(key)) {
        byLocation.set(key, { lat: t.latitude!, lon: t.longitude!, taskIds: new Set() });
      }
      byLocation.get(key)!.taskIds.add(t.id);
    }

    Promise.allSettled(
      Array.from(byLocation.entries()).map(async ([key, { lat, lon }]) => {
        const forecast = await fetchLocationForecast(lat, lon);
        return { key, forecast };
      }),
    ).then((results) => {
      const forecasts = new Map<string, Map<string, DailyWeather>>();
      let anyError = false;
      for (const r of results) {
        if (r.status === "fulfilled") {
          forecasts.set(r.value.key, r.value.forecast);
        } else {
          anyError = true;
        }
      }

      const newRows: TaskWeatherRow[] = [];
      for (const task of tasks) {
        if (task.latitude === null || task.longitude === null || !task.dueDate) continue;

        const dateStr = task.dueDate.slice(0, 10);
        const taskDate = new Date(dateStr + "T00:00:00");
        const daysDiff = Math.floor(
          (taskDate.getTime() - today.getTime()) / 86400000,
        );

        // Only show tasks within the 16-day forecast window
        if (daysDiff < 0 || daysDiff > 15) continue;

        const key = `${task.latitude.toFixed(2)},${task.longitude.toFixed(2)}`;
        const forecast = forecasts.get(key);
        const weather = forecast?.get(dateStr) ?? null;

        newRows.push({
          taskId: task.id,
          title: task.title,
          dueDate: dateStr,
          weather,
          severity: weather ? getWeatherSeverity(weather) : "none",
        });
      }

      setRows(newRows);
      setFetchError(anyError && newRows.length === 0);
      setFetching(false);
    });
  }, [tasks]);

  // Auto-expand when there are weather concerns
  useEffect(() => {
    const hasConcerns = rows.some(
      (r) => r.severity === "moderate" || r.severity === "heavy" || r.severity === "storm",
    );
    if (hasConcerns) setExpanded(true);
  }, [rows]);

  if (fetching) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2 px-1">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Checking weather conditions…
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="text-xs text-muted-foreground px-1 py-1.5">
        Weather data unavailable. Check connectivity and proceed with caution.
      </div>
    );
  }

  if (rows.length === 0) return null;

  const warningCount = rows.filter(
    (r) => r.severity === "moderate" || r.severity === "heavy" || r.severity === "storm",
  ).length;

  const hasConcerns = warningCount > 0;

  return (
    <div className="rounded-lg border bg-card text-sm">
      {/* Header — always visible, toggles detail rows */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-2 font-medium">
          <CloudRain className="h-4 w-4 text-sky-500" />
          Weather on due dates
        </div>
        <div className="flex items-center gap-3">
          {hasConcerns ? (
            <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              {warningCount} weather concern{warningCount !== 1 ? "s" : ""}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-medium text-green-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              All clear
            </span>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Detail rows */}
      {expanded && (
        <>
          <div className="divide-y border-t max-h-44 overflow-y-auto">
            {rows.map((row) => {
              const style = SEVERITY_STYLES[row.severity];
              const precip = row.weather?.precipitationSum;
              const label = row.weather
                ? getWeatherLabel(row.weather.weatherCode)
                : "Clear sky";
              const dueFormatted = new Date(
                row.dueDate + "T12:00:00",
              ).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              });

              return (
                <div
                  key={row.taskId}
                  className="flex items-center justify-between px-4 py-2"
                >
                  <span className="truncate max-w-[200px] text-foreground">
                    {row.title}
                  </span>
                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    <span className="text-muted-foreground text-xs whitespace-nowrap">
                      {dueFormatted}
                    </span>
                    <span
                      className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${style.bgColor} ${style.textColor}`}
                    >
                      {style.icon}{" "}
                      {label}
                      {precip !== undefined && precip > 0 && ` · ${precip}mm`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {hasConcerns && (
            <div className="px-4 py-2.5 border-t rounded-b-lg bg-amber-50 dark:bg-amber-950/20">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                ⚠️ {warningCount} task{warningCount !== 1 ? "s" : ""} scheduled
                during unfavorable weather. Fogging and spraying effectiveness is
                reduced by rain. Consider rescheduling or proceeding with caution.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
