import axios from "axios";

const RAW_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const API_BASE = RAW_BASE.endsWith("/api") ? RAW_BASE : `${RAW_BASE}/api`;

// Enums
export enum TaskType {
  CLEANUP = "cleanup",
  FOGGING = "fogging",
  INSPECTION = "inspection",
  INVESTIGATION = "investigation",
}

export enum TaskStatus {
  PENDING = "pending",
  ASSIGNED = "assigned",
  IN_PROGRESS = "in_progress",
  SUBMITTED = "submitted",
  VERIFIED = "verified",
  COMPLETED = "completed",
  REJECTED = "rejected",
}

export enum TaskPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent",
}

export enum EvidenceStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
}

// Interfaces
export interface Task {
  id: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  title: string;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  dueDate: string | null;
  notes: string | null;
  rejectionReason: string | null;
  districtId: number;
  assignedPhiId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  assignedAt: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  district?: {
    id: number;
    name: string;
  };
  assignedPhi?: {
    id: string;
    name: string;
    email: string;
  };
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface Evidence {
  id: string;
  imageUrl: string;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  status: EvidenceStatus;
  taskId: string;
  submittedById: string;
  verifiedById: string | null;
  submittedAt: string;
  verifiedAt: string | null;
}

export interface TaskStats {
  total: number;
  pending: number;
  assigned: number;
  inProgress: number;
  submitted: number;
  completed: number;
  rejected: number;
  overdueCount: number;
}

export interface TaskFilters {
  districtId?: number;
  status?: TaskStatus;
  type?: TaskType;
  priority?: TaskPriority;
  assignedPhiId?: string;
}

export interface CreateTaskDto {
  title: string;
  type: TaskType;
  priority?: TaskPriority;
  description?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  districtId: number;
  assignedPhiId?: string;
  dueDate?: string;
  notes?: string;
}

export interface UpdateTaskDto {
  title?: string;
  type?: TaskType;
  status?: TaskStatus;
  priority?: TaskPriority;
  description?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  districtId?: number;
  assignedPhiId?: string;
  dueDate?: string;
  notes?: string;
  rejectionReason?: string;
}

// API functions
export async function fetchTasks(filters?: TaskFilters): Promise<Task[]> {
  const token = localStorage.getItem("accessToken");
  const params = new URLSearchParams();
  if (filters?.districtId)
    params.append("districtId", filters.districtId.toString());
  if (filters?.status) params.append("status", filters.status);
  if (filters?.type) params.append("type", filters.type);
  if (filters?.priority) params.append("priority", filters.priority);
  if (filters?.assignedPhiId)
    params.append("assignedPhiId", filters.assignedPhiId);

  const res = await axios.get(`${API_BASE}/tasks?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function fetchTask(id: string): Promise<Task> {
  const token = localStorage.getItem("accessToken");
  const res = await axios.get(`${API_BASE}/tasks/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function createTask(data: CreateTaskDto): Promise<Task> {
  const token = localStorage.getItem("accessToken");
  const res = await axios.post(`${API_BASE}/tasks`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function updateTask(
  id: string,
  data: UpdateTaskDto,
): Promise<Task> {
  const token = localStorage.getItem("accessToken");
  const res = await axios.patch(`${API_BASE}/tasks/${id}`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function updateTaskStatus(
  id: string,
  status: TaskStatus,
  rejectionReason?: string,
): Promise<Task> {
  const token = localStorage.getItem("accessToken");
  const res = await axios.patch(
    `${API_BASE}/tasks/${id}/status`,
    { status, rejectionReason },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.data;
}

export async function assignTask(id: string, phiId: string): Promise<Task> {
  const token = localStorage.getItem("accessToken");
  const res = await axios.patch(
    `${API_BASE}/tasks/${id}/assign`,
    { assignedPhiId: phiId },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.data;
}

export async function deleteTask(id: string): Promise<void> {
  const token = localStorage.getItem("accessToken");
  await axios.delete(`${API_BASE}/tasks/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function fetchTaskStats(districtId?: number): Promise<TaskStats> {
  const token = localStorage.getItem("accessToken");
  const params = districtId ? `?districtId=${districtId}` : "";
  const res = await axios.get(`${API_BASE}/tasks/stats${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function fetchPhisByDistrict(
  districtName: string,
): Promise<{ id: string; name: string; email: string }[]> {
  const token = localStorage.getItem("accessToken");
  const res = await axios.get(
    `${API_BASE}/tasks/phis/${encodeURIComponent(districtName)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.data;
}

// Evidence API
export async function fetchTaskEvidence(taskId: string): Promise<Evidence[]> {
  const token = localStorage.getItem("accessToken");
  const res = await axios.get(`${API_BASE}/tasks/${taskId}/evidence`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function addEvidence(
  taskId: string,
  data: {
    imageUrl: string;
    notes?: string;
    latitude?: number;
    longitude?: number;
  },
): Promise<Evidence> {
  const token = localStorage.getItem("accessToken");
  const res = await axios.post(`${API_BASE}/tasks/${taskId}/evidence`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function verifyEvidence(
  evidenceId: string,
  approved: boolean,
  rejectionReason?: string,
): Promise<Evidence> {
  const token = localStorage.getItem("accessToken");
  const res = await axios.patch(
    `${API_BASE}/tasks/evidence/${evidenceId}/verify`,
    { approved, rejectionReason },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.data;
}

// Helper to get status color
export function getStatusColor(status: TaskStatus): string {
  const colors: Record<TaskStatus, string> = {
    [TaskStatus.PENDING]: "bg-gray-100 text-gray-800",
    [TaskStatus.ASSIGNED]: "bg-blue-100 text-blue-800",
    [TaskStatus.IN_PROGRESS]: "bg-yellow-100 text-yellow-800",
    [TaskStatus.SUBMITTED]: "bg-purple-100 text-purple-800",
    [TaskStatus.VERIFIED]: "bg-green-100 text-green-800",
    [TaskStatus.COMPLETED]: "bg-green-500 text-white",
    [TaskStatus.REJECTED]: "bg-red-100 text-red-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
}

// Helper to get priority color
export function getPriorityColor(priority: TaskPriority): string {
  const colors: Record<TaskPriority, string> = {
    [TaskPriority.LOW]: "text-gray-500",
    [TaskPriority.MEDIUM]: "text-blue-500",
    [TaskPriority.HIGH]: "text-orange-500",
    [TaskPriority.URGENT]: "text-red-500",
  };
  return colors[priority] || "text-gray-500";
}
