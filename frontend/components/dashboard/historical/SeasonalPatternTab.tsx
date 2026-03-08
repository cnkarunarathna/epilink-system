import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface SeasonalPatternTabProps {
  seasonalPattern: { week: string | number; avgCases: number }[];
  isDark: boolean;
}

export function SeasonalPatternTab({
  seasonalPattern,
  isDark,
}: SeasonalPatternTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Seasonal Pattern Analysis</CardTitle>
        <CardDescription>
          Average dengue cases by week across all years
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={seasonalPattern}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isDark ? "#374151" : "#e5e7eb"}
            />
            <XAxis
              dataKey="week"
              tick={{ fill: isDark ? "#9ca3af" : "#6b7280" }}
            />
            <YAxis tick={{ fill: isDark ? "#9ca3af" : "#6b7280" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? "#1f2937" : "#fff",
                borderColor: isDark ? "#374151" : "#e5e7eb",
                color: isDark ? "#f3f4f6" : "#111827",
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="avgCases"
              stroke="#f59e0b"
              fill="#fbbf24"
              fillOpacity={0.6}
              name="Average Cases per Week"
            />
          </AreaChart>
        </ResponsiveContainer>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Peak Season</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                Week{" "}
                {seasonalPattern.length > 0
                  ? [...seasonalPattern].sort(
                      (a, b) => b.avgCases - a.avgCases,
                    )[0]?.week
                  : "-"}
              </div>
              <p className="text-xs text-muted-foreground">
                Highest average cases
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Low Season</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                Week{" "}
                {seasonalPattern.length > 0
                  ? [...seasonalPattern].sort(
                      (a, b) => a.avgCases - b.avgCases,
                    )[0]?.week
                  : "-"}
              </div>
              <p className="text-xs text-muted-foreground">
                Lowest average cases
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Pattern Variation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {seasonalPattern.length > 0
                  ? (
                      Math.max(...seasonalPattern.map((s) => s.avgCases)) /
                      Math.min(...seasonalPattern.map((s) => s.avgCases))
                    ).toFixed(1)
                  : "-"}
                x
              </div>
              <p className="text-xs text-muted-foreground">
                Peak to trough ratio
              </p>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}
