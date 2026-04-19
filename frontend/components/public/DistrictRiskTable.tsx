"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, ChevronDown, ChevronUp } from "lucide-react";

interface District {
  district: string;
  predicted_cases: number;
}

interface Props {
  districts: District[];
  onDistrictClick?: (district: string) => void;
}

const getRisk = (cases: number) => {
  if (cases >= 100)
    return {
      level: "Very High Risk",
      dot: "🔴",
      phrase: "Take strong precautions",
      color: "destructive" as const,
    };
  if (cases >= 50)
    return {
      level: "High Risk",
      dot: "🟠",
      phrase: "Stay alert",
      color: "destructive" as const,
    };
  if (cases >= 25)
    return {
      level: "Moderate Risk",
      dot: "🟡",
      phrase: "Be cautious",
      color: "default" as const,
    };
  if (cases >= 10)
    return {
      level: "Low Risk",
      dot: "🟢",
      phrase: "Normal care",
      color: "secondary" as const,
    };
  return {
    level: "Minimal Risk",
    dot: "💚",
    phrase: "Situation is calm",
    color: "outline" as const,
  };
};

export default function DistrictRiskTable({ districts, onDistrictClick }: Props) {
  const [query, setQuery] = useState("");
  const [expandedDistrict, setExpandedDistrict] = useState<string | null>(null);

  const sorted = [...districts].sort(
    (a, b) => b.predicted_cases - a.predicted_cases,
  );
  const filtered = query.trim()
    ? sorted.filter((d) =>
        d.district.toLowerCase().includes(query.toLowerCase()),
      )
    : sorted;

  return (
    <Card className="shadow-lg border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
            <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          Risk levels across all districts
        </CardTitle>
        <CardDescription>
          Search for your district to see its current dengue risk level
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Find your district..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
          {filtered.map((d) => {
            const risk = getRisk(d.predicted_cases);
            const isOpen = expandedDistrict === d.district;
            return (
              <div
                key={d.district}
                className="rounded-lg border transition-all hover:shadow-sm cursor-pointer"
                onClick={() => {
                  setExpandedDistrict(isOpen ? null : d.district);
                  onDistrictClick?.(d.district);
                }}
              >
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg leading-none">{risk.dot}</span>
                    <div>
                      <div className="font-medium text-sm">{d.district}</div>
                      <div className="text-xs text-muted-foreground">
                        {risk.phrase}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={risk.color}
                      className="hidden sm:block text-xs"
                    >
                      {risk.level}
                    </Badge>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
                {isOpen && (
                  <div className="px-4 pb-3 border-t">
                    <div className="flex items-center justify-between text-sm mt-2">
                      <span className="text-muted-foreground">
                        Expected cases this week
                      </span>
                      <span className="font-bold">
                        {d.predicted_cases.toLocaleString()}
                      </span>
                    </div>
                    <Badge variant={risk.color} className="mt-2">
                      {risk.level}
                    </Badge>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No districts match your search</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
