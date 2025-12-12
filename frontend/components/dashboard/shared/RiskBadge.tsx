"use client";

import { Badge } from "@/components/ui/badge";
import type { RiskLevel } from "@/lib/types";

interface RiskBadgeProps {
  level: RiskLevel;
  className?: string;
}

export function RiskBadge({ level, className }: RiskBadgeProps) {
  const variants = {
    High: "destructive",
    Medium: "default",
    Low: "secondary",
  } as const;

  const colors = {
    High: "",
    Medium: "bg-yellow-500 hover:bg-yellow-600",
    Low: "bg-green-500 hover:bg-green-600",
  };

  return (
    <Badge
      variant={variants[level]}
      className={`${level !== "High" ? colors[level] : ""} ${className || ""}`}
    >
      {level}
    </Badge>
  );
}
