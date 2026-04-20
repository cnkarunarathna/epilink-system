import { CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const GUIDANCE = {
  "Very High": {
    Icon: AlertTriangle,
    iconClass: "text-red-600 dark:text-red-400",
    cardClass:
      "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40",
    titleClass: "text-red-800 dark:text-red-200",
    heading: "Very High Dengue Risk — Take precautions now",
    steps: [
      "Use mosquito repellent (DEET-based) every day",
      "Wear long sleeves and pants during dawn and dusk",
      "Empty any standing water around your home immediately",
      "Use mosquito nets at night",
      "Seek medical attention right away if you develop a fever",
    ],
  },
  High: {
    Icon: AlertTriangle,
    iconClass: "text-orange-600 dark:text-orange-400",
    cardClass:
      "border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/40",
    titleClass: "text-orange-800 dark:text-orange-200",
    heading: "High Dengue Risk — Stay alert",
    steps: [
      "Apply mosquito repellent when going outdoors",
      "Remove standing water from containers, tyres, and drains",
      "Wear protective clothing at dawn and dusk",
      "See a doctor promptly if you have fever with body aches",
    ],
  },
  Moderate: {
    Icon: ShieldCheck,
    iconClass: "text-amber-600 dark:text-amber-400",
    cardClass:
      "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40",
    titleClass: "text-amber-800 dark:text-amber-200",
    heading: "Moderate Dengue Risk — Stay cautious",
    steps: [
      "Check for and remove standing water around your home weekly",
      "Use repellent when spending time outdoors",
      "Monitor yourself and family members for fever symptoms",
    ],
  },
  Low: {
    Icon: ShieldCheck,
    iconClass: "text-yellow-600 dark:text-yellow-500",
    cardClass:
      "border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/40",
    titleClass: "text-yellow-800 dark:text-yellow-300",
    heading: "Low Dengue Risk — Normal vigilance",
    steps: [
      "Carry out regular home inspections for standing water",
      "Use repellent when in forested or low-lying areas",
      "Be aware of dengue symptoms: fever, headache, joint pain",
    ],
  },
  Minimal: {
    Icon: ShieldCheck,
    iconClass: "text-green-600 dark:text-green-400",
    cardClass:
      "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/40",
    titleClass: "text-green-800 dark:text-green-300",
    heading: "Minimal Dengue Risk — Situation is calm",
    steps: [
      "Keep up regular home inspections for standing water",
      "Use repellent in forested or outdoor areas as a precaution",
      "Remember: dengue is always present in Sri Lanka year-round",
    ],
  },
};

interface Props {
  level: string;
  district?: string;
}

export default function ActionGuidance({ level, district }: Props) {
  const config =
    GUIDANCE[level as keyof typeof GUIDANCE] ?? GUIDANCE["Minimal"];
  const { Icon } = config;

  return (
    <Card className={`border-2 ${config.cardClass}`}>
      <CardHeader className="pb-2">
        <CardTitle className={`text-sm flex items-center gap-2 ${config.titleClass}`}>
          <Icon className={`h-4 w-4 shrink-0 ${config.iconClass}`} />
          {district ? `What to do in ${district}` : "What to do"}
        </CardTitle>
        <p className={`text-xs font-semibold leading-snug ${config.titleClass}`}>
          {config.heading}
        </p>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5">
          {config.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-green-600 dark:text-green-400" />
              <span>{step}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
