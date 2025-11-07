import api from "@/lib/api";

export interface DatabaseStatus {
  status: string;
  database: string;
  connected: boolean;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  database: DatabaseStatus;
}

export const healthService = {
  /**
   * Get system health status
   * @returns Promise with health data
   */
  getHealth: async (): Promise<HealthResponse> => {
    const response = await api.get<HealthResponse>("/health");
    return response.data;
  },
};

export default healthService;
