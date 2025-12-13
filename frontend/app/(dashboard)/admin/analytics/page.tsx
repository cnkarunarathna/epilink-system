"use client";

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
  BarChart3,
  TrendingUp,
  TrendingDown,
  Download,
  Calendar,
} from "lucide-react";

export default function AnalyticsPage() {
  const weeklyData = [
    { week: "Week 44", cases: 1234, prediction: "Medium", accuracy: "92%" },
    { week: "Week 45", cases: 1456, prediction: "High", accuracy: "89%" },
    { week: "Week 46", cases: 1389, prediction: "High", accuracy: "94%" },
    { week: "Week 47", cases: 1567, prediction: "High", accuracy: "91%" },
    { week: "Week 48", cases: 1789, prediction: "High", accuracy: "88%" },
  ];

  const districtTrends = [
    { district: "Colombo", current: 245, previous: 213, change: "+15%" },
    { district: "Gampaha", current: 198, previous: 177, change: "+12%" },
    { district: "Kalutara", current: 145, previous: 134, change: "+8%" },
    { district: "Kandy", current: 132, previous: 136, change: "-3%" },
    { district: "Galle", current: 87, previous: 99, change: "-12%" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
          <p className="text-muted-foreground">
            National dengue trends and predictions
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Calendar className="mr-2 h-4 w-4" />
            Select Period
          </Button>
          <Button>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Cases (This Week)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,789</div>
            <p className="text-xs text-red-500 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              +14% from last week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Prediction Accuracy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">91%</div>
            <p className="text-xs text-green-500 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              +2% improvement
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
            <div className="text-2xl font-bold">8</div>
            <p className="text-xs text-red-500">Immediate action required</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average Cases/District
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">71.6</div>
            <p className="text-xs text-muted-foreground">Across 25 districts</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Weekly Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Case Trend</CardTitle>
            <CardDescription>
              Past 5 weeks case count and predictions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {weeklyData.map((week, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{week.week}</p>
                      <p className="text-sm text-muted-foreground">
                        {week.cases} cases
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={
                        week.prediction === "High"
                          ? "destructive"
                          : week.prediction === "Medium"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {week.prediction}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {week.accuracy} accuracy
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* District Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>District Case Trends</CardTitle>
            <CardDescription>Week-over-week comparison</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {districtTrends.map((district, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{district.district}</p>
                    <p className="text-sm text-muted-foreground">
                      {district.previous} → {district.current} cases
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-medium ${
                        district.change.startsWith("+")
                          ? "text-red-500"
                          : "text-green-500"
                      }`}
                    >
                      {district.change}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ML Model Performance */}
      <Card>
        <CardHeader>
          <CardTitle>ML Model Performance</CardTitle>
          <CardDescription>
            Risk prediction model accuracy metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Overall Accuracy
              </p>
              <p className="text-3xl font-bold">91.2%</p>
              <div className="h-2 w-full bg-secondary rounded-full">
                <div className="h-full w-[91%] bg-primary rounded-full" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                High Risk Detection
              </p>
              <p className="text-3xl font-bold">94.5%</p>
              <div className="h-2 w-full bg-secondary rounded-full">
                <div className="h-full w-[94%] bg-green-500 rounded-full" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                False Positive Rate
              </p>
              <p className="text-3xl font-bold">8.8%</p>
              <div className="h-2 w-full bg-secondary rounded-full">
                <div className="h-full w-[9%] bg-yellow-500 rounded-full" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
