/**
 * Analytics API service
 * Provides access to dengue risk prediction and dashboard data
 */

import apiClient from "./client";

export interface DistrictPrediction {
  district: string;
  predicted_cases: number;
  year: number;
  week: number;
  latitude: number;
  longitude: number;
  temperature: number | null;
  precipitation: number | null;
}

export interface DashboardSummary {
  current_week: { year: number; week: number };
  total_cases: number;
  previous_total: number;
  change_percent: number;
  district_count: number;
  high_risk_districts: number;
  avg_temperature: number | null;
}

export interface TimeSeriesEntry {
  year: number;
  week: number;
  cases: number;
  temperature: number | null;
  precipitation: number | null;
}

/**
 * Get latest dengue prediction data per district
 */
export const getDistrictLatest = async (): Promise<DistrictPrediction[]> => {
  const response = await apiClient.get<DistrictPrediction[]>(
    "/analytics/districts/latest",
  );
  return response.data;
};

/**
 * Get dashboard summary
 */
export const getDashboardSummary = async (): Promise<DashboardSummary> => {
  const response = await apiClient.get<DashboardSummary>("/analytics/summary");
  return response.data;
};

/**
 * Get historical timeseries for a specific district
 */
export const getDistrictTimeseries = async (
  districtName: string,
): Promise<TimeSeriesEntry[]> => {
  const response = await apiClient.get<TimeSeriesEntry[]>(
    `/analytics/districts/${encodeURIComponent(districtName)}/timeseries`,
  );
  return response.data;
};

/**
 * Get outbreak alerts
 */
export const getOutbreakAlerts = async () => {
  const response = await apiClient.get("/analytics/advanced/outbreak-alerts");
  return response.data;
};
