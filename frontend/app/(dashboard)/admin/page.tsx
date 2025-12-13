"use client";

import Link from "next/link";
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
  Users,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  FileText,
  TrendingUp,
  ArrowRight,
} from "lucide-react";

export default function AdminDashboard() {
  // Mock data
  const stats = {
    totalDistricts: 25,
    highRiskAreas: 8,
    activeUsers: 547,
    tasksCompleted: 1234,
  };

  const recentDistricts = [
    { name: "Colombo", risk: "High", cases: 245, trend: "+15%" },
    { name: "Gampaha", risk: "High", cases: 198, trend: "+12%" },
    { name: "Kalutara", risk: "Medium", cases: 145, trend: "+8%" },
    { name: "Kandy", risk: "Medium", cases: 132, trend: "-3%" },
    { name: "Galle", risk: "Low", cases: 87, trend: "-12%" },
  ];

  const recentActivity = [
    { title: "Weekly prediction completed", time: "2 hours ago", icon: TrendingUp },
    { title: "12 new PHI accounts created", time: "5 hours ago", icon: Users },
    { title: "Weekly report generated", time: "1 day ago", icon: FileText },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard Overview</h2>
        <p className="text-muted-foreground">
          Monitor national dengue risk and system activity
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Districts
            </CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDistricts}</div>
            <p className="text-xs text-muted-foreground">Across Sri Lanka</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              High Risk Areas
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {stats.highRiskAreas}
            </div>
            <p className="text-xs text-muted-foreground">
              Requires immediate action
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeUsers}</div>
            <p className="text-xs text-muted-foreground">+12 from last week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tasks Completed
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.tasksCompleted}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/admin/analytics">
          <Card className="cursor-pointer hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Analytics
                <ArrowRight className="h-4 w-4" />
              </CardTitle>
              <CardDescription>
                View trends and ML predictions
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/users">
          <Card className="cursor-pointer hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                User Management
                <ArrowRight className="h-4 w-4" />
              </CardTitle>
              <CardDescription>
                Manage system users and roles
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/districts">
          <Card className="cursor-pointer hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Districts
                <ArrowRight className="h-4 w-4" />
              </CardTitle>
              <CardDescription>
                Configure district boundaries
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/reports">
          <Card className="cursor-pointer hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Weekly Reports
                <ArrowRight className="h-4 w-4" />
              </CardTitle>
              <CardDescription>
                View and approve reports
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/settings">
          <Card className="cursor-pointer hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Settings
                <ArrowRight className="h-4 w-4" />
              </CardTitle>
              <CardDescription>
                System configuration
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* Content Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* District Risk Overview */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>District Risk Overview</CardTitle>
              <CardDescription>Top risk districts this week</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/districts">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentDistricts.map((district, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        district.risk === "High"
                          ? "bg-red-500"
                          : district.risk === "Medium"
                          ? "bg-yellow-500"
                          : "bg-green-500"
                      }`}
                    />
                    <div>
                      <p className="font-medium">{district.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {district.cases} cases
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
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
                    <p
                      className={`text-sm ${
                        district.trend.startsWith("+")
                          ? "text-red-500"
                          : "text-green-500"
                      }`}
                    >
                      {district.trend}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest system updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-start gap-2">
                  <activity.icon className="h-4 w-4 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">{activity.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {activity.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
