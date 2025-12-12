"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, TrendingUp, BarChart3 } from "lucide-react";

export default function ViewerDashboard() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Public Overview</h2>
        <p className="text-muted-foreground">
          Dengue risk monitoring across Sri Lanka
        </p>
      </div>

      {/* National Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2,845</div>
            <p className="text-xs text-muted-foreground">This week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Districts Monitored
            </CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">25</div>
            <p className="text-xs text-muted-foreground">Across Sri Lanka</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Risk Trend</CardTitle>
            <BarChart3 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">-12%</div>
            <p className="text-xs text-muted-foreground">vs last week</p>
          </CardContent>
        </Card>
      </div>

      {/* District Risk Levels */}
      <Card>
        <CardHeader>
          <CardTitle>District Risk Levels</CardTitle>
          <CardDescription>Current week predictions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { name: "Colombo", risk: "Medium", cases: 458 },
              { name: "Gampaha", risk: "High", cases: 521 },
              { name: "Kalutara", risk: "Medium", cases: 312 },
              { name: "Kandy", risk: "Low", cases: 189 },
              { name: "Galle", risk: "Medium", cases: 267 },
            ].map((district) => (
              <div
                key={district.name}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{district.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {district.cases} cases
                    </p>
                  </div>
                </div>
                <Badge
                  variant={
                    district.risk === "High"
                      ? "destructive"
                      : district.risk === "Medium"
                      ? "default"
                      : "secondary"
                  }
                  className={district.risk === "Low" ? "bg-green-500" : ""}
                >
                  {district.risk}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
