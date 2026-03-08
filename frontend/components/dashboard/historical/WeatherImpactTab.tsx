import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ChevronDown, X, Thermometer, CloudRain } from "lucide-react";
import { toast } from "sonner";

interface WeatherImpactTabProps {
  availableDistricts: string[];
  selectedDistricts: string[];
  setSelectedDistricts: (districts: string[]) => void;
  weatherCorrelationData: {
    weekLabel: string;
    cases: number;
    temp: number | null;
    precip: number | null;
  }[];
  isDark: boolean;
}

export function WeatherImpactTab({
  availableDistricts,
  selectedDistricts,
  setSelectedDistricts,
  weatherCorrelationData,
  isDark,
}: WeatherImpactTabProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Weather Impact Analysis</CardTitle>
            <CardDescription>
              Correlation between dengue cases and weather conditions across
              selected districts
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="ml-auto flex items-center gap-2"
                  >
                    Select Districts <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-[200px] max-h-[300px] overflow-y-auto"
                >
                  <DropdownMenuLabel>Analyze Districts</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {availableDistricts.map((district) => {
                    const isSelected = selectedDistricts.includes(district);
                    return (
                      <DropdownMenuCheckboxItem
                        key={`weather-sel-${district}`}
                        checked={isSelected}
                        onCheckedChange={() => {
                          if (isSelected) {
                            if (selectedDistricts.length > 1) {
                              setSelectedDistricts(
                                selectedDistricts.filter((d) => d !== district),
                              );
                            } else {
                              toast.error(
                                "At least one district must be selected",
                              );
                            }
                          } else {
                            if (selectedDistricts.length >= 5) {
                              toast.error(
                                "You can only compare up to 5 districts at a time",
                              );
                            } else {
                              setSelectedDistricts([
                                ...selectedDistricts,
                                district,
                              ]);
                            }
                          }
                        }}
                      >
                        {district}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex flex-wrap justify-end gap-2 mt-2">
              {selectedDistricts.map((district) => (
                <Badge
                  key={`w-badge-${district}`}
                  variant="secondary"
                  className="flex items-center gap-1 group"
                >
                  {district}
                  {selectedDistricts.length > 1 && (
                    <button
                      type="button"
                      className="ml-1 rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedDistricts(
                          selectedDistricts.filter((d) => d !== district),
                        );
                      }}
                    >
                      <X className="h-3 w-3 text-muted-foreground group-hover:text-destructive transition-colors" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={500}>
          <ComposedChart data={weatherCorrelationData}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isDark ? "#374151" : "#e5e7eb"}
            />
            <XAxis
              dataKey="weekLabel"
              angle={-45}
              textAnchor="end"
              height={100}
              tick={{ fill: isDark ? "#9ca3af" : "#6b7280" }}
            />
            <YAxis
              yAxisId="left"
              orientation="left"
              tick={{ fill: isDark ? "#9ca3af" : "#6b7280" }}
              label={{
                value: "Cases",
                angle: -90,
                position: "insideLeft",
                fill: isDark ? "#9ca3af" : "#6b7280",
              }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: "#f59e0b" }}
              label={{
                value: "Temp (°C) / Precip (mm)",
                angle: 90,
                position: "insideRight",
                fill: "#f59e0b",
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? "#1f2937" : "#fff",
                borderColor: isDark ? "#374151" : "#e5e7eb",
                color: isDark ? "#f3f4f6" : "#111827",
              }}
            />
            <Legend />
            <Bar
              yAxisId="left"
              dataKey="cases"
              fill="#3b82f6"
              name="Total Cases"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="temp"
              stroke="#f59e0b"
              name="Avg Temperature (°C)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="precip"
              stroke="#06b6d4"
              name="Avg Precipitation (mm)"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Thermometer className="h-4 w-4" />
                Temperature Impact
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Higher temperatures can accelerate the life cycle of mosquitoes,
                potentially increasing dengue risk following warmer periods.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CloudRain className="h-4 w-4" />
                Precipitation Impact
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Increased rainfall creates breeding grounds for mosquitoes,
                typically leading to a rise in cases after a lag of 2-4 weeks.
              </p>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}
