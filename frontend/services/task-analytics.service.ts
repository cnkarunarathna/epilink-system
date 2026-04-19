import axios from "axios";

axios.defaults.withCredentials = true;

const RAW_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const API_BASE = RAW_BASE.endsWith("/api") ? RAW_BASE : `${RAW_BASE}/api`;
const BASE = `${API_BASE}/tasks/analytics`;

export interface NationalSummary {
  total: number;
  pending: number;
  assigned: number;
  inProgress: number;
  submitted: number;
  verified: number;
  completed: number;
  rejected: number;
  overdue: number;
  completionRate: number;
  avgCompletionHours: number | null;
  activePhi: number;
  activeSupervisors: number;
}

export interface DistrictSummary {
  districtId: number;
  districtName: string;
  total: number;
  completed: number;
  pending: number;
  assigned: number;
  inProgress: number;
  submitted: number;
  rejected: number;
  overdue: number;
  completionRate: number;
}

export interface StatusPoint {
  status: string;
  count: number;
}

export interface TypePoint {
  type: string;
  count: number;
  completed: number;
}

export interface PriorityPoint {
  priority: string;
  count: number;
  completed: number;
}

export interface TrendPoint {
  period: string;
  created: number;
  completed: number;
}

export interface SupervisorMetrics {
  supervisorId: string;
  name: string;
  district: string;
  tasksCreated: number;
  completed: number;
  pending: number;
  rejected: number;
  overdue: number;
  completionRate: number;
}

export interface PhiMetrics {
  phiId: string;
  name: string;
  district: string;
  isActive: boolean;
  assigned: number;
  completed: number;
  rejected: number;
  overdue: number;
  completionRate: number;
  avgCompletionHours: number | null;
}

export interface OverdueTask {
  id: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  dueDate: string;
  districtId: number;
  districtName: string;
  phiId: string | null;
  phiName: string | null;
  hoursOverdue: number;
  severity: "warning" | "critical";
}

export interface EvidenceReviewSummary {
  national: {
    total: number;
    approved: number;
    rejected: number;
    pending: number;
    approvalRate: number;
  };
  byDistrict: {
    districtId: number;
    districtName: string;
    total: number;
    approved: number;
    rejected: number;
    pending: number;
    approvalRate: number;
  }[];
}

export async function fetchNationalSummary(districtId?: number): Promise<NationalSummary> {
  const params = districtId ? { districtId } : {};
  const { data } = await axios.get<NationalSummary>(`${BASE}/national-summary`, { params });
  return data;
}

export async function fetchByDistrict(from?: string, to?: string): Promise<DistrictSummary[]> {
  const { data } = await axios.get<DistrictSummary[]>(`${BASE}/by-district`, {
    params: { from, to },
  });
  return data;
}

export async function fetchByStatus(districtId?: number): Promise<StatusPoint[]> {
  const { data } = await axios.get<StatusPoint[]>(`${BASE}/by-status`, {
    params: districtId ? { districtId } : {},
  });
  return data;
}

export async function fetchByType(districtId?: number): Promise<TypePoint[]> {
  const { data } = await axios.get<TypePoint[]>(`${BASE}/by-type`, {
    params: districtId ? { districtId } : {},
  });
  return data;
}

export async function fetchByPriority(districtId?: number): Promise<PriorityPoint[]> {
  const { data } = await axios.get<PriorityPoint[]>(`${BASE}/by-priority`, {
    params: districtId ? { districtId } : {},
  });
  return data;
}

export async function fetchTrend(
  period: "day" | "week" | "month" = "day",
  from?: string,
  to?: string,
  districtId?: number,
): Promise<TrendPoint[]> {
  const { data } = await axios.get<TrendPoint[]>(`${BASE}/trend`, {
    params: { period, from, to, ...(districtId ? { districtId } : {}) },
  });
  return data;
}

export async function fetchSupervisorMetrics(districtId?: number): Promise<SupervisorMetrics[]> {
  const { data } = await axios.get<SupervisorMetrics[]>(`${BASE}/supervisors`, {
    params: districtId ? { districtId } : {},
  });
  return data;
}

export async function fetchPhiMetrics(districtId?: number): Promise<PhiMetrics[]> {
  const { data } = await axios.get<PhiMetrics[]>(`${BASE}/phis`, {
    params: districtId ? { districtId } : {},
  });
  return data;
}

export async function fetchOverdueTasks(districtId?: number): Promise<OverdueTask[]> {
  const { data } = await axios.get<OverdueTask[]>(`${BASE}/overdue`, {
    params: districtId ? { districtId } : {},
  });
  return data;
}

export async function fetchEvidenceReview(districtId?: number): Promise<EvidenceReviewSummary> {
  const { data } = await axios.get<EvidenceReviewSummary>(`${BASE}/evidence-review`, {
    params: districtId ? { districtId } : {},
  });
  return data;
}

export interface PhiMonthlyTrend {
  month: string;
  completed: number;
}

export interface PhiProfile {
  phiId: string;
  name: string;
  district: string;
  isActive: boolean;
  memberSince: string;
  assigned: number;
  completed: number;
  rejected: number;
  overdue: number;
  completionRate: number;
  avgCompletionHours: number | null;
  evidenceTotal: number;
  evidenceApproved: number;
  evidenceRejected: number;
  evidencePending: number;
  evidenceApprovalRate: number;
  statusBreakdown: { status: string; count: number }[];
  monthlyTrend: PhiMonthlyTrend[];
}

export interface PhiTaskItem {
  id: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  assignedAt: string | null;
  completedAt: string | null;
  dueDate: string | null;
  districtName: string;
}

export interface PhiTasksPage {
  tasks: PhiTaskItem[];
  total: number;
  page: number;
  limit: number;
}

export async function fetchPhiProfile(phiId: string): Promise<PhiProfile> {
  const { data } = await axios.get<PhiProfile>(`${BASE}/phi-profile`, { params: { phiId } });
  return data;
}

export async function fetchPhiTasks(
  phiId: string,
  page: number = 1,
  limit: number = 20,
  status?: string,
  type?: string,
  from?: string,
  to?: string,
): Promise<PhiTasksPage> {
  const { data } = await axios.get<PhiTasksPage>(`${BASE}/phi-tasks`, {
    params: { phiId, page, limit, status, type, from, to },
  });
  return data;
}
