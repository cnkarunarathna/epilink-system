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
import { ClipboardCheck, Upload, MapPin, Camera } from "lucide-react";

export default function PHIDashboard() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">My Tasks</h2>
        <p className="text-muted-foreground">
          Field assignments and evidence submission
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assigned</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div>
            <p className="text-xs text-muted-foreground">Tasks to complete</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Upload className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
            <p className="text-xs text-muted-foreground">Currently working</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">28</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Tasks */}
      <Card>
        <CardHeader>
          <CardTitle>Active Tasks</CardTitle>
          <CardDescription>Tasks requiring your attention</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              {
                id: "T-045",
                type: "Cleanup Operation",
                location: "Galle Road, Colombo 3",
                priority: "High",
                dueDate: "Today",
              },
              {
                id: "T-046",
                type: "Fogging",
                location: "Baseline Road, Colombo 9",
                priority: "Medium",
                dueDate: "Tomorrow",
              },
              {
                id: "T-047",
                type: "Inspection",
                location: "Duplication Road, Colombo 4",
                priority: "Low",
                dueDate: "Dec 15",
              },
            ].map((task) => (
              <div key={task.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold">{task.id}</p>
                      <Badge
                        variant={
                          task.priority === "High"
                            ? "destructive"
                            : task.priority === "Medium"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {task.priority}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium">{task.type}</p>
                    <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {task.location}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Due: {task.dueDate}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1">
                    <Camera className="mr-2 h-4 w-4" />
                    Upload Evidence
                  </Button>
                  <Button size="sm" variant="outline">
                    View Map
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
