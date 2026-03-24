import axios from "axios";
import { ACCESS_TOKEN_KEY } from "@/lib/tokenUtils";

const RAW_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const API_BASE = RAW_BASE.endsWith("/api") ? RAW_BASE : `${RAW_BASE}/api`;

function getAuthHeaders() {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem(ACCESS_TOKEN_KEY)
      : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface DistrictLatest {
  district: string;
  predicted_cases: number;
  year: number;
  week: number;
  latitude: number;
  longitude: number;
  temperature: number | null;
  precipitation: number | null;
}

export async function fetchLatestPerDistrict(): Promise<DistrictLatest[]> {
  const res = await axios.get(`${API_BASE}/analytics/districts/latest`, {
    headers: getAuthHeaders(),
  });
  return res.data;
}

export async function fetchTimeseries(district: string) {
  const res = await axios.get(
    `${API_BASE}/analytics/districts/${encodeURIComponent(district)}/timeseries`,
    { headers: getAuthHeaders() },
  );
  return res.data;
}

export async function fetchBulkPredictions() {
  const res = await axios.get(`${API_BASE}/analytics/predict/bulk`, {
    headers: getAuthHeaders(),
  });
  return res.data;
}

export async function fetchDashboardSummary() {
  const res = await axios.get(`${API_BASE}/analytics/summary`, {
    headers: getAuthHeaders(),
  });
  return res.data;
}

export async function fetchTrends(weeks: number = 12) {
  const res = await axios.get(`${API_BASE}/analytics/trends?weeks=${weeks}`, {
    headers: getAuthHeaders(),
  });
  return res.data;
}

export async function fetchHistoricalRange(
  startYear?: number,
  startWeek?: number,
  endYear?: number,
  endWeek?: number,
) {
  const params = new URLSearchParams();
  if (startYear) params.append("startYear", startYear.toString());
  if (startWeek) params.append("startWeek", startWeek.toString());
  if (endYear) params.append("endYear", endYear.toString());
  if (endWeek) params.append("endWeek", endWeek.toString());

  const res = await axios.get(
    `${API_BASE}/analytics/historical/range?${params.toString()}`,
    { headers: getAuthHeaders() },
  );
  return res.data;
}

export async function fetchCompareDistricts(districts?: string[]) {
  const params =
    districts && districts.length > 0
      ? `?districts=${districts.join(",")}`
      : "";
  const res = await axios.get(
    `${API_BASE}/analytics/historical/districts/compare${params}`,
    { headers: getAuthHeaders() },
  );
  return res.data;
}

export async function fetchYearlySummary(year?: number) {
  const params = year ? `?year=${year}` : "";
  const res = await axios.get(
    `${API_BASE}/analytics/historical/yearly-summary${params}`,
    { headers: getAuthHeaders() },
  );
  return res.data;
}

export async function fetchWeatherCorrelation() {
  const res = await axios.get(
    `${API_BASE}/analytics/advanced/weather-correlation`,
    { headers: getAuthHeaders() },
  );
  return res.data;
}

export async function fetchGrowthRate(weeks: number = 4) {
  const res = await axios.get(
    `${API_BASE}/analytics/advanced/growth-rate?weeks=${weeks}`,
    { headers: getAuthHeaders() },
  );
  return res.data;
}

export async function fetchHotspots() {
  const res = await axios.get(`${API_BASE}/analytics/advanced/hotspots`, {
    headers: getAuthHeaders(),
  });
  return res.data;
}

export async function fetchOutbreakAlerts() {
  const res = await axios.get(
    `${API_BASE}/analytics/advanced/outbreak-alerts`,
    { headers: getAuthHeaders() },
  );
  return res.data;
}

export async function fetchWeeklyForecast() {
  const res = await axios.get(
    `${API_BASE}/analytics/advanced/weekly-forecast`,
    { headers: getAuthHeaders() },
  );
  return res.data;
}

export interface ExplainInsightResponse {
  district: string;
  risk_level: "low" | "moderate" | "high" | "critical";
  summary: string;
  key_drivers: string[];
  recommendations: string[];
  caveats: string[];
  references: string[];
  implementation_phase: string;
  _fallback?: boolean;
  _error?: string;
  error?: string;
}

export async function fetchExplainableInsight(
  district: string,
): Promise<ExplainInsightResponse> {
  const res = await axios.get(
    `${API_BASE}/analytics/explain/${encodeURIComponent(district)}`,
    { headers: getAuthHeaders() },
  );
  return res.data;
}
