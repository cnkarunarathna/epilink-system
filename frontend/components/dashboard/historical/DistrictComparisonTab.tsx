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
  LineChart as RechartsLine,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ChevronDown, X } from "lucide-react";
import { toast } from "sonner";

interface DistrictComparisonTabProps {
  availableDistricts: string[];
  selectedDistricts: string[];
  setSelectedDistricts: (districts: string[]) => void;
  timeSeriesData: Record<string, string | number>[];
  isDark: boolean;
  COLORS: string[];
}

export function DistrictComparisonTab({
  availableDistricts,
  selectedDistricts,
  setSelectedDistricts,
  timeSeriesData,
  isDark,
  COLORS,
}: DistrictComparisonTabProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>District Time Series Comparison</CardTitle>
            <CardDescription>
              Compare dengue case trends across selected districts
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
                  <DropdownMenuLabel>Available Districts</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {availableDistricts.map((district) => {
                    const isSelected = selectedDistricts.includes(district);
                    return (
                      <DropdownMenuCheckboxItem
                        key={`comp-${district}`}
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
                  key={`badge-${district}`}
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
          <RechartsLine data={timeSeriesData}>
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
            <YAxis tick={{ fill: isDark ? "#9ca3af" : "#6b7280" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? "#1f2937" : "#fff",
                borderColor: isDark ? "#374151" : "#e5e7eb",
                color: isDark ? "#f3f4f6" : "#111827",
              }}
            />
            <Legend />
            {selectedDistricts.map((district, idx) => (
              <Line
                key={district}
                type="monotone"
                dataKey={district}
                stroke={COLORS[idx % COLORS.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </RechartsLine>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
