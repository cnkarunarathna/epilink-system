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
 * Upload evidence for a task (URL-based, kept for compatibility)
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

/**
 * Upload an image file to S3 and record evidence for a task.
 * @param taskId  - The task to attach evidence to
 * @param fileUri - Local file URI from expo-image-picker (e.g. file:///...)
 * @param mimeType - MIME type of the image (e.g. "image/jpeg")
 * @param notes   - Optional notes
 * @param latitude  - Optional GPS latitude
 * @param longitude - Optional GPS longitude
 * @param onProgress - Optional upload progress callback (0–100)
 */
export const uploadEvidenceFile = async (
  taskId: string,
  fileUri: string,
  mimeType: string = "image/jpeg",
  notes?: string,
  latitude?: number,
  longitude?: number,
  onProgress?: (percent: number) => void,
): Promise<Evidence> => {
  // Step 1: upload the file to S3 via the backend upload endpoint
  const filename = fileUri.split("/").pop() ?? "evidence.jpg";

  const fileFormData = new FormData();
  fileFormData.append("file", {
    uri: fileUri,
    name: filename,
    type: mimeType,
  } as any);

  const uploadResponse = await apiClient.post<{ url: string; key: string }>(
    "/upload/evidence",
    fileFormData,
    {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: onProgress
        ? (e) => {
            const percent = e.total
              ? Math.round((e.loaded * 100) / e.total)
              : 0;
            onProgress(percent);
          }
        : undefined,
    },
  );

  // Store the S3 key — the server signs it on every read
  const imageUrl = uploadResponse.data.key;

  // Step 2: record the evidence with the returned S3 URL
  const evidenceResponse = await apiClient.post<Evidence>(
    `/tasks/${taskId}/evidence`,
    { imageUrl, notes, latitude, longitude },
  );

  return evidenceResponse.data;
};
