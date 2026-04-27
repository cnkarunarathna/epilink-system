"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MapPin,
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import { PROVINCES } from "@/lib/constants/districts";
import { fetchDistrictRows } from "@/services/districts.service";
import type { DistrictRow } from "@/services/districts.service";
import { DistrictDetailSheet } from "@/components/admin/districts/DistrictDetailSheet";

// ── Skeleton rows shown while data loads ─────────────────────────────────────
function TableSkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-28" />
            </div>
          </TableCell>
          <TableCell><Skeleton className="h-4 w-10" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-8" /></TableCell>
          <TableCell><Skeleton className="h-4 w-8" /></TableCell>
          <TableCell><Skeleton className="h-4 w-12" /></TableCell>
          <TableCell><Skeleton className="h-4 w-8" /></TableCell>
          <TableCell />
        </TableRow>
      ))}
    </>
  );
}

// ── Trend indicator ───────────────────────────────────────────────────────────
function TrendCell({ trend }: { trend: number | null }) {
  if (trend === null) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }
  if (trend > 0) {
    return (
      <span className="flex items-center gap-1 text-red-500 text-sm font-medium">
        <TrendingUp className="h-3 w-3" />+{trend}%
      </span>
    );
  }
  if (trend < 0) {
    return (
      <span className="flex items-center gap-1 text-green-500 text-sm font-medium">
        <TrendingDown className="h-3 w-3" />{trend}%
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-muted-foreground text-sm">
      <Minus className="h-3 w-3" />0%
    </span>
  );
}

// ── Stat card skeleton ────────────────────────────────────────────────────────
function StatSkeleton() {
  return <Skeleton className="h-8 w-16" />;
}

export default function DistrictsPage() {
  const [rows, setRows] = useState<DistrictRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [provinceFilter, setProvinceFilter] = useState("all");
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDistrictRows();
      setRows(data);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load district data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((d) => {
      const matchesSearch =
        !q ||
        d.name.toLowerCase().includes(q) ||
        d.province.toLowerCase().includes(q);
      const matchesProvince =
        provinceFilter === "all" || d.province === provinceFilter;
      return matchesSearch && matchesProvince;
    });
  }, [rows, searchQuery, provinceFilter]);

  // Derived stats from live data
  const highRiskCount = rows.filter((d) => d.riskLevel === "High").length;
  const totalActiveTasks = rows.reduce((sum, d) => sum + d.activeTasks, 0);
  const totalActivePHIs = rows.reduce((sum, d) => sum + d.phiCount, 0);
  const nationalIncidenceRate = (() => {
    const totalCases = rows.reduce((sum, d) => sum + (d.predictedCases ?? 0), 0);
    const totalPop = rows.reduce((sum, d) => sum + d.population, 0);
    return totalPop > 0
      ? ((totalCases / totalPop) * 100_000).toFixed(1)
      : null;
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          District Management
        </h2>
        <p className="text-muted-foreground">
          Monitor dengue risk and coverage across all 25 Sri Lankan districts
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Districts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">25</div>
            <p className="text-xs text-muted-foreground">Across 9 provinces</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active PHIs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <StatSkeleton /> : totalActivePHIs}
            </div>
            <p className="text-xs text-muted-foreground">
              Field health inspectors
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              High Risk Districts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {loading ? <StatSkeleton /> : highRiskCount}
            </div>
            <p className="text-xs text-muted-foreground">
              {loading || nationalIncidenceRate === null
                ? "Requires attention"
                : `National rate: ${nationalIncidenceRate} per 100k`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Tasks (National)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <StatSkeleton /> : totalActiveTasks}
            </div>
            <p className="text-xs text-muted-foreground">
              Assigned or in progress
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Error state */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={load}
              className="gap-2"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* District List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle>All Districts</CardTitle>
              <CardDescription>
                {loading
                  ? "Loading…"
                  : `${filtered.length} of 25 districts`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search districts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-[200px]"
                />
              </div>
              <Select value={provinceFilter} onValueChange={setProvinceFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Provinces" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Provinces</SelectItem>
                  {PROVINCES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>District</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Province</TableHead>
                <TableHead>Population</TableHead>
                <TableHead>Incidence Rate</TableHead>
                <TableHead>Risk Level</TableHead>
                <TableHead>Cases</TableHead>
                <TableHead>Trend</TableHead>
                <TableHead>Active Tasks</TableHead>
                <TableHead>PHIs</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableSkeletonRows />
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={11}
                    className="text-center text-muted-foreground py-8"
                  >
                    No districts match your search.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((district) => (
                  <TableRow
                    key={district.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedDistrict(district)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{district.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm">{district.code}</code>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {district.province}
                    </TableCell>
                    <TableCell>
                      {district.population.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {district.incidenceRate !== null
                        ? `${district.incidenceRate} per 100k`
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {district.riskLevel ? (
                        <Badge
                          variant={
                            district.riskLevel === "High"
                              ? "destructive"
                              : district.riskLevel === "Medium"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {district.riskLevel}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {district.predictedCases ?? "—"}
                    </TableCell>
                    <TableCell>
                      <TrendCell trend={district.weeklyTrend} />
                    </TableCell>
                    <TableCell>{district.activeTasks}</TableCell>
                    <TableCell>{district.phiCount}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <ChevronRight className="h-4 w-4" />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Map Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>District Map</CardTitle>
          <CardDescription>
            Geographic visualization of risk levels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[400px] bg-muted/20 rounded-lg border-2 border-dashed">
            <div className="text-center text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Interactive map visualization coming soon</p>
              <p className="text-sm mt-2">
                Will display district boundaries and risk heatmap
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* District detail drawer */}
      <DistrictDetailSheet
        district={selectedDistrict}
        onClose={() => setSelectedDistrict(null)}
      />
    </div>
  );
}
