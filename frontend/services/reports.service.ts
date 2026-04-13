import axios from "axios";

axios.defaults.withCredentials = true;

const RAW_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const API_BASE = RAW_BASE.endsWith("/api") ? RAW_BASE : `${RAW_BASE}/api`;

export type ReportStatus = "pending" | "approved" | "archived";

export interface WeeklyReport {
  id: string;
  year: number;
  weekNumber: number;
  startDate: string;
  endDate: string;
  title: string;
  status: ReportStatus;
  totalPredictedCases: number;
  totalDistricts: number;
  highRiskDistricts: number;
  reportData: {
    reportType: 'historical' | 'predicted';
    totalCurrentCases?: number;
    forecast: ForecastRow[];
    alerts: OutbreakAlert[];
    hotspots: any[];
    summary: any;
    nationalSummary: any;
  };
  s3Key: string | null;
  generatedAt: string;
  approvedAt: string | null;
  approvedBy: { id: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
  // returned only from generate endpoint
  downloadUrl?: string;
}

export interface ForecastRow {
  district: string;
  current_cases: number;
  avg_4week: number;
  forecast: number;
  trend: "Rising" | "Stable" | "Falling";
  confidence?: string;
}

export interface OutbreakAlert {
  district: string;
  severity: "critical" | "high" | "moderate";
  current_cases?: number;
  message?: string;
  recommendation?: string;
}

export async function listReports(): Promise<WeeklyReport[]> {
  const res = await axios.get(`${API_BASE}/reports`);
  return res.data;
}

export async function getReport(id: string): Promise<WeeklyReport> {
  const res = await axios.get(`${API_BASE}/reports/${id}`);
  return res.data;
}

export async function generateReport(
  year: number,
  weekNumber: number,
): Promise<WeeklyReport & { downloadUrl: string }> {
  const res = await axios.post(`${API_BASE}/reports/generate`, {
    year,
    weekNumber,
  });
  return res.data;
}

export async function approveReport(id: string): Promise<WeeklyReport> {
  const res = await axios.post(`${API_BASE}/reports/${id}/approve`);
  return res.data;
}

export async function getReportDownloadUrl(
  id: string,
): Promise<{ url: string }> {
  const res = await axios.get(`${API_BASE}/reports/${id}/download`);
  return res.data;
}

export async function deleteReport(id: string): Promise<void> {
  await axios.delete(`${API_BASE}/reports/${id}`);
}
