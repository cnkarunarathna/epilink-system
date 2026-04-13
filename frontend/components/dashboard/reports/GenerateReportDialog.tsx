"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, FileText } from "lucide-react";
import { generateReport, WeeklyReport } from "@/services/reports.service";

interface Props {
  open: boolean;
  onClose: () => void;
  onGenerated: (report: WeeklyReport) => void;
}

function isoWeekDateRange(
  year: number,
  week: number,
): { start: string; end: string } {
  const jan4 = new Date(year, 0, 4);
  const dow = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dow + 1 + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return { start: fmt(monday), end: fmt(sunday) };
}

function currentIsoWeek(): number {
  const now = new Date();
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const dow = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dow + 1);
  const diff = now.getTime() - monday.getTime();
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
}

export default function GenerateReportDialog({
  open,
  onClose,
  onGenerated,
}: Props) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [week, setWeek] = useState(currentIsoWeek());
  const [loading, setLoading] = useState(false);

  const dateRange = isoWeekDateRange(year, week);

  async function handleGenerate() {
    setLoading(true);
    try {
      const report = await generateReport(year, week);
      toast.success(`Report generated for Week ${week}, ${year}`);
      onGenerated(report);
      onClose();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ?? err?.message ?? "Failed to generate report";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];
  const weekOptions = Array.from({ length: 52 }, (_, i) => i + 1);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Generate Weekly Report
          </DialogTitle>
          <DialogDescription>
            Select the epidemiological week to generate a PDF surveillance
            report. The system will collect live forecast and alert data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Year</Label>
              <Select
                value={String(year)}
                onValueChange={(v) => setYear(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Week</Label>
              <Select
                value={String(week)}
                onValueChange={(v) => setWeek(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {weekOptions.map((w) => (
                    <SelectItem key={w} value={String(w)}>
                      Week {w}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md bg-muted/50 border px-4 py-3 text-sm">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">
              Reporting Period
            </p>
            <p className="font-semibold">
              {dateRange.start} &mdash; {dateRange.end}
            </p>
          </div>

          <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 px-4 py-3 text-xs text-blue-700 dark:text-blue-400 space-y-1">
            <p className="font-semibold">What will be included:</p>
            <ul className="list-disc list-inside space-y-0.5 text-blue-600 dark:text-blue-500">
              <li>District-wise case forecasts &amp; trend analysis</li>
              <li>Top-10 predicted districts bar chart</li>
              <li>Active outbreak alerts with recommendations</li>
              <li>AI-generated national situation summary</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Generate &amp; Save to S3
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
