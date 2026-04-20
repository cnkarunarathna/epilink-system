import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Shield } from "lucide-react";

interface Props {
  riskLevel?: "high" | "moderate" | "low";
}

const TIPS = {
  high: {
    heading: "High risk in your area — act now",
    items: [
      "Use mosquito repellent (DEET-based) every day, especially morning and evening",
      "Wear long-sleeved shirts and long trousers at dawn and dusk",
      "Empty, cover, or throw away any containers holding standing water",
      "Sleep under a mosquito net — even during the day",
      "See a doctor immediately if you develop fever, headache, or body pain",
      "Alert your neighbours to check their properties for standing water",
    ],
  },
  moderate: {
    heading: "Moderate risk — stay cautious",
    items: [
      "Check and empty standing water (flower pots, buckets, old tyres) every week",
      "Apply mosquito repellent when going outdoors",
      "Keep doors and windows screened or closed at peak mosquito times",
      "Monitor yourself and family for fever or flu-like symptoms",
    ],
  },
  low: {
    heading: "Low risk — stay prepared year-round",
    items: [
      "Do a quick inspection of your home for standing water monthly",
      "Use repellent when visiting forested or low-lying areas",
      "Know the symptoms: sudden high fever, severe headache, pain behind the eyes",
      "Dengue is always present in Sri Lanka — good habits protect year-round",
    ],
  },
} as const;

const STYLE = {
  high: {
    border: "border-red-300 dark:border-red-800",
    header: "bg-gradient-to-r from-red-50 to-red-100/50 dark:from-red-950/50 dark:to-red-900/30",
    icon: "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/50",
  },
  moderate: {
    border: "border-amber-300 dark:border-amber-700",
    header: "bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-950/50 dark:to-amber-900/30",
    icon: "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50",
  },
  low: {
    border: "border-green-300 dark:border-green-800",
    header: "bg-gradient-to-r from-green-50 to-green-100/50 dark:from-green-950/50 dark:to-green-900/30",
    icon: "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/50",
  },
} as const;

export default function PreventionChecklist({ riskLevel = "low" }: Props) {
  const t = TIPS[riskLevel];
  const s = STYLE[riskLevel];

  return (
    <Card className={`shadow-lg border-2 ${s.border}`}>
      <CardHeader className={s.header}>
        <CardTitle className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${s.icon}`}>
            <Shield className="h-5 w-5" />
          </div>
          How to protect yourself
        </CardTitle>
        <CardDescription>{t.heading}</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <ul className="space-y-3">
          {t.items.map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm">
              <span className="text-green-600 dark:text-green-400 font-bold shrink-0 mt-0.5">
                ✓
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            🦟 Dengue is spread by the <em>Aedes aegypti</em> mosquito, which
            breeds in clean standing water. Eliminating breeding sites is the
            single most effective prevention measure.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
