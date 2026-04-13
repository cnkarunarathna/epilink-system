"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Download,
  Calendar,
  Loader2,
  Construction,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function ReportsPage() {
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const supervisorDistrict = user?.district || "Colombo";

  const handleGenerateReport = async () => {
    setGenerating(true);
    // Placeholder - would call report generation API
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setGenerating(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Reports</h2>
        <p className="text-muted-foreground">
          {supervisorDistrict} District Reports
        </p>
      </div>

      {/* Coming Soon Notice */}
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Construction className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">Reports Coming Soon</h3>
          <p className="text-muted-foreground text-center max-w-md">
            The report generation feature is currently under development. Soon
            you'll be able to generate weekly summaries, task completion
            reports, and export data to PDF.
          </p>
        </CardContent>
      </Card>

      {/* Report Options Preview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="opacity-60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Weekly Summary
            </CardTitle>
            <CardDescription>Overview of weekly activities</CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Generate
            </Button>
          </CardContent>
        </Card>

        <Card className="opacity-60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Monthly Report
            </CardTitle>
            <CardDescription>Detailed monthly analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Generate
            </Button>
          </CardContent>
        </Card>

        <Card className="opacity-60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Task Completion
            </CardTitle>
            <CardDescription>PHI performance report</CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Generate
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
