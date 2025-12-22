import axios from "axios";

// Create axios instance for Python ML service
const mlApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_ML_API_URL || "http://localhost:8000",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

export interface DenguePredictionInput {
  district: string;
  cases_lag1: number;
  cases_lag2: number;
  cases_lag3: number;
  cases_mean_4w: number;
  temperature_2m_mean: number;
  precipitation_sum: number;
}

export interface BulkPredictionInput {
  cases_lag1: number;
  cases_lag2: number;
  cases_lag3: number;
  cases_mean_4w: number;
  temperature_2m_mean: number;
  precipitation_sum: number;
}

export interface DistrictFeatures {
  district: string;
  cases_lag1: number;
  cases_lag2: number;
  cases_lag3: number;
  cases_mean_4w: number;
  temperature_2m_mean: number;
  precipitation_sum: number;
}

export interface BulkDistrictInput {
  districts: DistrictFeatures[];
}

export interface PredictionResult {
  district: string;
  predicted_cases: number;
}

export interface BulkPredictionResult {
  total_districts: number;
  total_predicted_cases: number;
  predictions: PredictionResult[];
}

const dengueService = {
  // Predict for a single district
  async predictSingleDistrict(
    input: DenguePredictionInput
  ): Promise<PredictionResult> {
    const response = await mlApi.post<PredictionResult>("/predict", input);
    return response.data;
  },

  // Predict for all districts with same features
  async predictAllDistricts(
    input: BulkPredictionInput
  ): Promise<BulkPredictionResult> {
    const response = await mlApi.post<BulkPredictionResult>(
      "/predict/all",
      input
    );
    return response.data;
  },

  // Predict for multiple districts with district-specific features
  async predictBulkDistricts(
    input: BulkDistrictInput
  ): Promise<BulkPredictionResult> {
    const response = await mlApi.post<BulkPredictionResult>(
      "/predict/bulk",
      input
    );
    return response.data;
  },

  // Health check
  async healthCheck(): Promise<{ status: string; service: string }> {
    const response = await mlApi.get("/health");
    return response.data;
  },
};

export default dengueService;
