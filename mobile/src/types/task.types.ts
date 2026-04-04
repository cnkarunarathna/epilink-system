/**
 * Type definitions for Task entity
 */

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

export interface District {
  id: number;
  name: string;
}

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
  district: District;
  districtId: number;
  assignedPhi: {
    id: string;
    name: string;
    email: string;
  } | null;
  assignedPhiId: string | null;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  createdById: string;
  assignedAt: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  evidence?: Evidence[];
}

export interface Evidence {
  id: string;
  imageUrl: string;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  status: "pending" | "approved" | "rejected";
  rejectionReason: string | null;
  submittedAt: string;
  verifiedAt: string | null;
  taskId: string;
  submittedById: string;
  verifiedById: string | null;
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

export interface UpdateTaskStatusRequest {
  status: TaskStatus;
  rejectionReason?: string;
}

export interface RouteLeg {
  distanceMeters: number;
  durationSecs: number;
}

export interface RouteResult {
  orderedTaskIds: string[];
  legs: RouteLeg[];
  totalDistanceMeters: number | null;
  totalDurationSecs: number | null;
  /** Road-snapped coordinates as [lng, lat] pairs */
  polyline: [number, number][];
  routingUnavailable: boolean;
  tasksWithoutLocation: string[];
}

export interface CreateEvidenceRequest {
  imageUrl: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
}
