"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cloud, Droplets, ThermometerSun } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchWeatherCorrelation } from "@/services/analytics.service";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from "recharts";

interface CorrelationData {
  district: string;
  temp_correlation: number;
  precip_correlation: number;
  avg_cases: number;
  avg_temp: number;
  avg_precip: number;
  data_points: number;
}

export default function WeatherCorrelation() {
  const [data, setData] = useState<CorrelationData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCorrelation();
  }, []);

  const loadCorrelation = async () => {
    try {
      setLoading(true);
      const result = await fetchWeatherCorrelation();
      setData(result);
    } catch (error) {
      console.error("Failed to load weather correlation:", error);
    } finally {
      setLoading(false);
    }
  };

  const getCorrelationColor = (value: number) => {
    if (Math.abs(value) > 0.7) return "#dc2626"; // Strong correlation
    if (Math.abs(value) > 0.4) return "#f59e0b"; // Moderate correlation
    return "#64748b"; // Weak correlation
  };

  const getCorrelationLabel = (value: number) => {
    const abs = Math.abs(value);
    if (abs > 0.7) return "Strong";
    if (abs > 0.4) return "Moderate";
    return "Weak";
  };

  if (loading) {
    return (
      <Card className="shadow-lg border-2">
        <CardHeader className="bg-gradient-to-r from-sky-50 to-cyan-50">
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 bg-sky-100 rounded-lg">
              <Cloud className="h-5 w-5 text-sky-600" />
            </div>
            Weather Correlation Analysis
          </CardTitle>
          <CardDescription>
            Analyzing relationships between weather patterns and dengue cases
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center h-64">
            <div className="p-4 bg-sky-100 rounded-full animate-pulse mb-4">
              <Cloud className="h-12 w-12 text-sky-600" />
            </div>
            <div className="text-muted-foreground font-medium">
              Analyzing correlations...
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-2 hover:shadow-xl transition-shadow">
      <CardHeader className="bg-gradient-to-r from-sky-50 via-cyan-50 to-blue-50">
        <CardTitle className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-br from-sky-400 to-cyan-500 rounded-lg shadow-md">
            <Cloud className="h-5 w-5 text-white" />
          </div>
          Weather Correlation Analysis
          <Badge variant="secondary" className="ml-auto">
            {data.length} Districts
          </Badge>
        </CardTitle>
        <CardDescription>
          Relationship between weather conditions and dengue cases
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Top correlations table */}
          <div>
            <h4 className="text-sm font-semibold mb-3">
              Top Temperature Correlations
            </h4>
            <div className="space-y-2">
              {[...data]
                .sort(
                  (a, b) =>
                    Math.abs(b.temp_correlation) - Math.abs(a.temp_correlation)
                )
                .slice(0, 5)
                .map((item) => (
                  <div
                    key={item.district}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <ThermometerSun className="h-4 w-4 text-orange-500" />
                      <div>
                        <div className="font-medium">{item.district}</div>
                        <div className="text-xs text-muted-foreground">
                          Avg: {item.avg_temp.toFixed(1)}°C,{" "}
                          {item.avg_cases.toFixed(0)} cases
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className="font-bold"
                        style={{
                          color: getCorrelationColor(item.temp_correlation),
                        }}
                      >
                        {item.temp_correlation.toFixed(3)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {getCorrelationLabel(item.temp_correlation)}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-3">
              Top Precipitation Correlations
            </h4>
            <div className="space-y-2">
              {[...data]
                .sort(
                  (a, b) =>
                    Math.abs(b.precip_correlation) -
                    Math.abs(a.precip_correlation)
                )
                .slice(0, 5)
                .map((item) => (
                  <div
                    key={item.district}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <Droplets className="h-4 w-4 text-blue-500" />
                      <div>
                        <div className="font-medium">{item.district}</div>
                        <div className="text-xs text-muted-foreground">
                          Avg: {item.avg_precip.toFixed(1)}mm,{" "}
                          {item.avg_cases.toFixed(0)} cases
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className="font-bold"
                        style={{
                          color: getCorrelationColor(item.precip_correlation),
                        }}
                      >
                        {item.precip_correlation.toFixed(3)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {getCorrelationLabel(item.precip_correlation)}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Scatter plot */}
          <div>
            <h4 className="text-sm font-semibold mb-3">
              Temperature vs Precipitation Correlation
            </h4>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart
                margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="temp_correlation"
                  name="Temperature Correlation"
                  domain={[-1, 1]}
                  label={{
                    value: "Temperature Correlation",
                    position: "bottom",
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="precip_correlation"
                  name="Precipitation Correlation"
                  domain={[-1, 1]}
                  label={{
                    value: "Precipitation Correlation",
                    angle: -90,
                    position: "left",
                  }}
                />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as CorrelationData;
                      return (
                        <div className="bg-white p-3 rounded-lg border shadow-lg">
                          <div className="font-semibold">{data.district}</div>
                          <div className="text-xs space-y-1 mt-1">
                            <div>
                              Temp Corr: {data.temp_correlation.toFixed(3)}
                            </div>
                            <div>
                              Precip Corr: {data.precip_correlation.toFixed(3)}
                            </div>
                            <div>Avg Cases: {data.avg_cases.toFixed(0)}</div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Scatter data={data} fill="#3b82f6">
                  {data.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={getCorrelationColor(
                        Math.max(
                          Math.abs(entry.temp_correlation),
                          Math.abs(entry.precip_correlation)
                        )
                      )}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-600"></div>
              <span>Strong (|r| &gt; 0.7)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              <span>Moderate (|r| &gt; 0.4)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-500"></div>
              <span>Weak</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
