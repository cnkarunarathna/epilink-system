import axios from "axios";

const RAW_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const API_BASE = RAW_BASE.endsWith("/api") ? RAW_BASE : `${RAW_BASE}/api`;
const PUBLIC_BASE = `${API_BASE}/public/analytics`;

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

export async function fetchPublicLatestPerDistrict(): Promise<
  DistrictLatest[]
> {
  const res = await axios.get(`${PUBLIC_BASE}/districts/latest`);
  return res.data;
}

export async function fetchPublicTimeseries(district: string) {
  const res = await axios.get(
    `${PUBLIC_BASE}/districts/${encodeURIComponent(district)}/timeseries`,
  );
  return res.data;
}

export async function fetchPublicDashboardSummary() {
  const res = await axios.get(`${PUBLIC_BASE}/summary`);
  return res.data;
}

export async function fetchPublicTrends(weeks: number = 12) {
  const res = await axios.get(`${PUBLIC_BASE}/trends?weeks=${weeks}`);
  return res.data;
}

export async function fetchPublicWeatherCorrelation() {
  const res = await axios.get(`${PUBLIC_BASE}/advanced/weather-correlation`);
  return res.data;
}

export async function fetchPublicGrowthRate(weeks: number = 4) {
  const res = await axios.get(
    `${PUBLIC_BASE}/advanced/growth-rate?weeks=${weeks}`,
  );
  return res.data;
}

export async function fetchPublicHotspots() {
  const res = await axios.get(`${PUBLIC_BASE}/advanced/hotspots`);
  return res.data;
}

export async function fetchPublicOutbreakAlerts() {
  const res = await axios.get(`${PUBLIC_BASE}/advanced/outbreak-alerts`);
  return res.data;
}
