/**
 * Evidence API service
 */

import apiClient from "./client";
import { Evidence } from "../types/evidence.types";
import { CreateEvidenceRequest } from "../types/task.types";

/**
 * Get evidence for a task
 */
export const getTaskEvidence = async (taskId: string): Promise<Evidence[]> => {
  const response = await apiClient.get<Evidence[]>(`/tasks/${taskId}/evidence`);
  return response.data;
};

/**
 * Upload evidence for a task
 */
export const uploadEvidence = async (
  taskId: string,
  data: CreateEvidenceRequest,
): Promise<Evidence> => {
  const response = await apiClient.post<Evidence>(
    `/tasks/${taskId}/evidence`,
    data,
  );
  return response.data;
};
