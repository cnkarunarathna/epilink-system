import api from "@/lib/api";

export interface DatabaseStatus {
  status: string;
  database: string;
  connected: boolean;
}

export interface PredictionServiceStatus {
  status: string;
  url: string;
  connected: boolean;
  responseTime?: number;
  service?: string;
  version?: string;
  modelLoaded?: boolean;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  database: DatabaseStatus;
  predictionService: PredictionServiceStatus;
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
