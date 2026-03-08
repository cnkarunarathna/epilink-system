/**
 * Task API service
 */

import apiClient from "./client";
import {
  Task,
  TaskStats,
  TaskStatus,
  UpdateTaskStatusRequest,
} from "../types/task.types";

/**
 * Get all tasks for the authenticated PHI
 */
export const getTasks = async (filters?: {
  status?: TaskStatus;
  assignedPhiId?: string;
}): Promise<Task[]> => {
  const params: Record<string, string> = {};
  if (filters?.status) {
    params.status = filters.status;
  }
  if (filters?.assignedPhiId) {
    params.assignedPhiId = filters.assignedPhiId;
  }

  const response = await apiClient.get<Task[]>("/tasks", { params });
  return response.data;
};

/**
 * Get task by ID
 */
export const getTaskById = async (taskId: string): Promise<Task> => {
  const response = await apiClient.get<Task>(`/tasks/${taskId}`);
  return response.data;
};

/**
 * Update task status
 */
export const updateTaskStatus = async (
  taskId: string,
  data: UpdateTaskStatusRequest,
): Promise<Task> => {
  const response = await apiClient.patch<Task>(`/tasks/${taskId}/status`, data);
  return response.data;
};

/**
 * Get task statistics
 */
export const getTaskStats = async (): Promise<TaskStats> => {
  const response = await apiClient.get<TaskStats>("/tasks/stats");
  return response.data;
};
