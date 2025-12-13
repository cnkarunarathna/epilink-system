"use client";

import { useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MapPin,
  Plus,
  Search,
  Edit,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

export default function DistrictsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const districts = [
    {
      id: "1",
      name: "Colombo",
      code: "COL",
      mohAreas: 15,
      risk: "High",
      cases: 245,
      trend: "+15%",
    },
    {
      id: "2",
      name: "Gampaha",
      code: "GAM",
      mohAreas: 18,
      risk: "High",
      cases: 198,
      trend: "+12%",
    },
    {
      id: "3",
      name: "Kalutara",
      code: "KAL",
      mohAreas: 14,
      risk: "Medium",
      cases: 145,
      trend: "+8%",
    },
    {
      id: "4",
      name: "Kandy",
      code: "KAN",
      mohAreas: 20,
      risk: "Medium",
      cases: 132,
      trend: "-3%",
    },
    {
      id: "5",
      name: "Galle",
      code: "GAL",
      mohAreas: 19,
      risk: "Low",
      cases: 87,
      trend: "-12%",
    },
    {
      id: "6",
      name: "Matara",
      code: "MAT",
      mohAreas: 16,
      risk: "Low",
      cases: 65,
      trend: "-8%",
    },
    {
      id: "7",
      name: "Hambantota",
      code: "HAM",
      mohAreas: 12,
      risk: "Low",
      cases: 54,
      trend: "-5%",
    },
    {
      id: "8",
      name: "Jaffna",
      code: "JAF",
      mohAreas: 15,
      risk: "Medium",
      cases: 98,
      trend: "+4%",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            District Management
          </h2>
          <p className="text-muted-foreground">
            Manage districts and MOH area boundaries
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add District
        </Button>
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
              MOH Areas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">341</div>
            <p className="text-xs text-muted-foreground">
              Medical Officer of Health areas
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
            <div className="text-2xl font-bold text-red-500">8</div>
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Districts</CardTitle>
              <CardDescription>
                View and manage district configurations
              </CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search districts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-[250px]"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>District</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>MOH Areas</TableHead>
                <TableHead>Risk Level</TableHead>
                <TableHead>Cases (This Week)</TableHead>
                <TableHead>Trend</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {districts.map((district) => (
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
                  <TableCell>{district.mohAreas}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        district.risk === "High"
                          ? "destructive"
                          : district.risk === "Medium"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {district.risk}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {district.cases}
                  </TableCell>
                  <TableCell>
                    <div
                      className={`flex items-center gap-1 ${
                        district.trend.startsWith("+")
                          ? "text-red-500"
                          : "text-green-500"
                      }`}
                    >
                      {district.trend.startsWith("+") ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      <span className="text-sm font-medium">
                        {district.trend}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
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
