"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Loader2, ThermometerSun, Droplets } from "lucide-react";
import { fetchWeatherCorrelation } from "@/services/analytics.service";

interface CorrelationData {
  district: string;
  temp_correlation: number;
  precip_correlation: number;
  avg_cases: number;
  avg_temp: number;
  avg_precip: number;
  data_points: number;
}

interface Props {
  district: string;
  currentTemp?: number | null;
  currentPrecip?: number | null;
}

export default function DistrictWeatherCorrelationChart({
  district,
  currentTemp,
  currentPrecip,
}: Props) {
  const [districtData, setDistrictData] = useState<CorrelationData | null>(null);
  const [loading, setLoading] = useState(true);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  useEffect(() => {
    fetchWeatherCorrelation()
      .then((all: CorrelationData[]) => {
        const match = all.find(
          (d) => d.district.toLowerCase() === district.toLowerCase(),
        );
        setDistrictData(match ?? null);
      })
      .catch((err) => console.error("Weather correlation fetch failed:", err))
      .finally(() => setLoading(false));
  }, [district]);

  if (loading) {
    return (
      <div className="h-56 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!districtData) {
    return (
      <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
        No correlation data available for {district}
      </div>
    );
  }

  const chartData = [
    {
      name: "Temperature",
      value: districtData.temp_correlation,
      avg: `${districtData.avg_temp.toFixed(1)}°C`,
    },
    {
      name: "Precipitation",
      value: districtData.precip_correlation,
      avg: `${districtData.avg_precip.toFixed(1)}mm`,
    },
  ];

  const getBarColor = (value: number) => {
    const abs = Math.abs(value);
    if (abs > 0.7) return value > 0 ? "#dc2626" : "#2563eb";
    if (abs > 0.4) return value > 0 ? "#f97316" : "#3b82f6";
    return isDark ? "#6b7280" : "#9ca3af";
  };

  const getStrength = (value: number) => {
    const abs = Math.abs(value);
    if (abs > 0.7) return "Strong";
    if (abs > 0.4) return "Moderate";
    return "Weak";
  };

  const gridColor = isDark ? "#374151" : "#e5e7eb";
  const tickColor = isDark ? "#9ca3af" : "#6b7280";

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={140}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={gridColor}
            horizontal={false}
          />
          <XAxis
            type="number"
            domain={[-1, 1]}
            tick={{ fill: tickColor, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => v.toFixed(1)}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: tickColor, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={88}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? "#1f2937" : "#ffffff",
              border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value: number | undefined, _name: string | undefined, props: { payload?: { avg?: string } }) => {
              const v = value ?? 0;
              const avg = props.payload?.avg ?? "";
              return [`${v.toFixed(3)} — ${getStrength(v)}${avg ? ` (avg ${avg})` : ""}`, "Correlation with cases"] as [string, string];
            }}
          />
          <ReferenceLine
            x={0}
            stroke={isDark ? "#6b7280" : "#9ca3af"}
            strokeWidth={1}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={30}>
            {chartData.map((entry, idx) => (
              <Cell key={`cell-${idx}`} fill={getBarColor(entry.value)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900/40">
          <ThermometerSun className="h-4 w-4 text-orange-500 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Current Temp</p>
            <p className="font-semibold">
              {currentTemp != null ? `${currentTemp.toFixed(1)}°C` : "—"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40">
          <Droplets className="h-4 w-4 text-blue-500 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Current Precip</p>
            <p className="font-semibold">
              {currentPrecip != null ? `${currentPrecip.toFixed(1)}mm` : "—"}
            </p>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground px-0.5">
        Based on {districtData.data_points} weeks of historical data · Avg{" "}
        {Math.round(districtData.avg_cases)} cases/week
      </p>
    </div>
  );
}
