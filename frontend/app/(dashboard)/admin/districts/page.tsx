"use client";

import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { MapPin, Search } from "lucide-react";
import { DISTRICTS, PROVINCES } from "@/lib/constants/districts";
import type { RiskLevel } from "@/lib/types";

const STATIC_RISK: Record<string, RiskLevel> = {
  Colombo: "High",
  Gampaha: "High",
  Kalutara: "Medium",
  Kandy: "Medium",
  Matale: "Low",
  "Nuwara Eliya": "Low",
  Galle: "Low",
  Matara: "Low",
  Hambantota: "Low",
  Jaffna: "Medium",
  Kilinochchi: "Low",
  Mannar: "Low",
  Mullaitivu: "Low",
  Vavuniya: "Low",
  Ampara: "Medium",
  Batticaloa: "Medium",
  Trincomalee: "Low",
  Kurunegala: "Medium",
  Puttalam: "Low",
  Anuradhapura: "Low",
  Polonnaruwa: "Low",
  Badulla: "Low",
  Monaragala: "Low",
  Kegalle: "Low",
  Ratnapura: "Low",
};

export default function DistrictsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [provinceFilter, setProvinceFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return DISTRICTS.filter((d) => {
      const matchesSearch =
        !q ||
        d.name.toLowerCase().includes(q) ||
        d.province.toLowerCase().includes(q);
      const matchesProvince =
        provinceFilter === "all" || d.province === provinceFilter;
      return matchesSearch && matchesProvince;
    });
  }, [searchQuery, provinceFilter]);

  const highRiskCount = DISTRICTS.filter(
    (d) => STATIC_RISK[d.name] === "High"
  ).length;

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
            <p className="text-xs text-muted-foreground">Across Sri Lanka</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Provinces
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">9</div>
            <p className="text-xs text-muted-foreground">Administrative provinces</p>
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
              {highRiskCount}
            </div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Coverage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">100%</div>
            <p className="text-xs text-green-500">Full island coverage</p>
          </CardContent>
        </Card>
      </div>

      {/* District List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle>All Districts</CardTitle>
              <CardDescription>
                {filtered.length} of {DISTRICTS.length} districts
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
                <TableHead>Risk Level</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground py-8"
                  >
                    No districts match your search.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((district) => {
                  const risk = STATIC_RISK[district.name] ?? "Low";
                  return (
                    <TableRow key={district.id}>
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
                      <TableCell>
                        <Badge
                          variant={
                            risk === "High"
                              ? "destructive"
                              : risk === "Medium"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {risk}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
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
    </div>
  );
}
