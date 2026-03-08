import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart as RechartsBar,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Loader2 } from "lucide-react";

export interface YearlySummaryData {
  year: number;
  districts: {
    district: string;
    total_cases: number;
    avg_cases: number;
    max_cases: number;
    min_cases: number;
    week_count: number;
  }[];
}

interface YearlySummaryTabProps {
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  availableYears: number[];
  yearlySummary: YearlySummaryData | null;
  getRiskLevel: (cases: number) => { level: string; color: string };
  isDark: boolean;
}

export function YearlySummaryTab({
  selectedYear,
  setSelectedYear,
  availableYears,
  yearlySummary,
  getRiskLevel,
  isDark,
}: YearlySummaryTabProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Yearly District Summary</CardTitle>
            <CardDescription>
              Detailed statistics for each district in {selectedYear}
            </CardDescription>
          </div>
          <Select
            value={selectedYear.toString()}
            onValueChange={(v) => setSelectedYear(parseInt(v))}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {yearlySummary ? (
          <div className="space-y-4">
            {/* Bar chart */}
            <ResponsiveContainer width="100%" height={400}>
              <RechartsBar data={yearlySummary.districts}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isDark ? "#374151" : "#e5e7eb"}
                />
                <XAxis
                  dataKey="district"
                  angle={-45}
                  textAnchor="end"
                  height={100}
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
                <Bar dataKey="total_cases" fill="#3b82f6" name="Total Cases" />
                <Bar dataKey="max_cases" fill="#dc2626" name="Peak Week" />
              </RechartsBar>
            </ResponsiveContainer>

            {/* District table */}
            <div className="rounded-lg border">
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="p-3 text-left font-medium">District</th>
                    <th className="p-3 text-right font-medium">Total</th>
                    <th className="p-3 text-right font-medium">Average</th>
                    <th className="p-3 text-right font-medium">Peak</th>
                    <th className="p-3 text-right font-medium">Minimum</th>
                    <th className="p-3 text-center font-medium">Risk Level</th>
                  </tr>
                </thead>
                <tbody>
                  {yearlySummary.districts.map((district) => {
                    const risk = getRiskLevel(district.max_cases);
                    return (
                      <tr
                        key={district.district}
                        className="border-b last:border-0"
                      >
                        <td className="p-3 font-medium">{district.district}</td>
                        <td className="p-3 text-right">
                          {district.total_cases.toLocaleString()}
                        </td>
                        <td className="p-3 text-right">
                          {district.avg_cases.toFixed(1)}
                        </td>
                        <td className="p-3 text-right font-semibold text-red-600 dark:text-red-400">
                          {district.max_cases}
                        </td>
                        <td className="p-3 text-right text-muted-foreground">
                          {district.min_cases}
                        </td>
                        <td className="p-3 text-center">
                          <Badge
                            variant={
                              risk.color as
                                | "default"
                                | "secondary"
                                | "destructive"
                                | "outline"
                            }
                          >
                            {risk.level}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
