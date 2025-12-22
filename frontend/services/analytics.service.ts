import axios from "axios";

const RAW_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const API_BASE = RAW_BASE.endsWith("/api") ? RAW_BASE : `${RAW_BASE}/api`;

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
  const res = await axios.get(`${API_BASE}/analytics/districts/latest`);
  return res.data;
}

export async function fetchTimeseries(district: string) {
  const res = await axios.get(
    `${API_BASE}/analytics/districts/${encodeURIComponent(district)}/timeseries`
  );
  return res.data;
}

export async function fetchBulkPredictions() {
  const res = await axios.get(`${API_BASE}/analytics/predict/bulk`);
  return res.data;
}

export async function fetchDashboardSummary() {
  const res = await axios.get(`${API_BASE}/analytics/summary`);
  return res.data;
}

export async function fetchTrends(weeks: number = 12) {
  const res = await axios.get(`${API_BASE}/analytics/trends?weeks=${weeks}`);
  return res.data;
}
