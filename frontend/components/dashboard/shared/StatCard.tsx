"use client";

import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  /** Tailwind text + bg colour token pair, e.g. "text-primary bg-primary/10" */
  iconColor?: string;
  trend?: {
    value: number;
    label: string;
  };
  loading?: boolean;
  /** Subtle accent bar along the top of the card */
  accent?: "primary" | "success" | "warning" | "danger" | "info";
}

const ACCENT_CLASSES: Record<NonNullable<StatCardProps["accent"]>, string> = {
  primary: "before:bg-primary",
  success: "before:bg-green-500",
  warning: "before:bg-amber-500",
  danger:  "before:bg-destructive",
  info:    "before:bg-sky-500",
};

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  iconColor = "text-muted-foreground bg-muted",
  trend,
  loading = false,
  accent,
}: StatCardProps) {
  const trendPositive = trend && trend.value > 0;
  const trendNeutral  = trend && trend.value === 0;
  const TrendIcon = trendPositive ? TrendingUp : trendNeutral ? Minus : TrendingDown;

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-shadow duration-200 hover:shadow-md",
        accent &&
          `before:absolute before:inset-x-0 before:top-0 before:h-0.5 ${ACCENT_CLASSES[accent]}`,
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {loading ? <Skeleton className="h-4 w-28" /> : title}
        </CardTitle>

        {loading ? (
          <Skeleton className="h-8 w-8 rounded-lg" />
        ) : (
          <span
            className={cn(
              "flex items-center justify-center h-8 w-8 rounded-lg shrink-0",
              iconColor,
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
      </CardHeader>

      <CardContent>
        {loading ? (
          <>
            <Skeleton className="h-8 w-20 mb-1" />
            <Skeleton className="h-3 w-32" />
          </>
        ) : (
          <>
            <div className="text-2xl font-bold tracking-tight">{value}</div>

            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {description}
              </p>
            )}

            {trend && (
              <p
                className={cn(
                  "flex items-center gap-1 text-xs mt-1 font-medium",
                  trendPositive
                    ? "text-green-600 dark:text-green-400"
                    : trendNeutral
                    ? "text-muted-foreground"
                    : "text-destructive",
                )}
              >
                <TrendIcon className="h-3 w-3 shrink-0" />
                {trendPositive ? "+" : ""}
                {trend.value}% {trend.label}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
