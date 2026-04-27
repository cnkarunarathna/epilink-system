import axios from "axios";
import type { DistrictMeta } from "@/lib/constants/districts";
import type { RiskLevel } from "@/lib/types";

axios.defaults.withCredentials = true;

const RAW_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const API_BASE = RAW_BASE.endsWith("/api") ? RAW_BASE : `${RAW_BASE}/api`;

function getAuthHeaders() {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface DistrictRow extends DistrictMeta {
  riskLevel: RiskLevel | null;
  predictedCases: number | null;
  weeklyTrend: number | null;
  incidenceRate: number | null;
  activeTasks: number;
  completedTasks: number;
  phiCount: number;
  supervisorName: string | null;
}

// 60-second browser-level cache to avoid redundant fetches on tab revisits
let _cache: { data: DistrictRow[]; fetchedAt: number } | null = null;
const BROWSER_TTL_MS = 60_000;

export async function fetchDistrictRows(): Promise<DistrictRow[]> {
  if (_cache && Date.now() - _cache.fetchedAt < BROWSER_TTL_MS) {
    return _cache.data;
  }

  const { data } = await axios.get<DistrictRow[]>(
    `${API_BASE}/admin/districts/summary`,
    { headers: getAuthHeaders() },
  );

  _cache = { data, fetchedAt: Date.now() };
  return data;
}

export function invalidateDistrictCache(): void {
  _cache = null;
}
