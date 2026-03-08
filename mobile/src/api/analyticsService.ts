/**
 * Analytics API service
 * Provides access to dengue risk and dashboard data for PHI
 */

import apiClient from "./client";

export interface DistrictLatest {
  districtName: string;
  cases: number;
  riskLevel: string;
  weekNumber: number;
  year: number;
  temperature?: number;
  precipitation?: number;
}

export interface DashboardSummary {
  totalCases: number;
  totalDistricts: number;
  highRiskDistricts: number;
  weekOverWeekChange: number;
  latestWeek: number;
  latestYear: number;
}

/**
 * Get latest dengue data per district
 */
export const getDistrictLatest = async (): Promise<DistrictLatest[]> => {
  const response = await apiClient.get<DistrictLatest[]>(
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
