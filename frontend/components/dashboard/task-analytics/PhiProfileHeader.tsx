"use client";

import { UserCircle, MapPin, Calendar, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { PhiProfile } from "@/services/task-analytics.service";

interface Props {
  profile: PhiProfile | null;
  loading?: boolean;
}

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function PhiProfileHeader({ profile, loading }: Props) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-5 flex items-center gap-5">
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!profile) return null;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 shrink-0">
            <UserCircle className="h-8 w-8 text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="text-lg font-semibold leading-tight">{profile.name}</h2>
              <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                PHI
              </Badge>
              <Badge
                variant="outline"
                className={
                  profile.isActive
                    ? "bg-green-500/10 text-green-700 border-green-500/20"
                    : "bg-muted text-muted-foreground"
                }
              >
                {profile.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>

            <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {profile.district || "—"}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Member since {fmt(profile.memberSince)}
              </span>
              <span className="flex items-center gap-1">
                <Activity className="h-3.5 w-3.5" />
                {profile.completionRate}% completion rate
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
