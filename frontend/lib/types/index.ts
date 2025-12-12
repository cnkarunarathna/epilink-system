// User and Authentication Types
export type UserRole = "admin" | "supervisor" | "phi" | "viewer";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  district?: string;
  mohArea?: string;
  phone?: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

// Risk and Prediction Types
export type RiskLevel = "Low" | "Medium" | "High";

export interface RiskPrediction {
  id: string;
  districtId: string;
  districtName: string;
  mohArea?: string;
  riskLevel: RiskLevel;
  predictionDate: string;
  weekNumber: number;
  confidence: number;
  casesReported: number;
  casesProjected: number;
  weatherFactors?: {
    rainfall: number;
    temperature: number;
    humidity: number;
  };
  explanations?: ShapValue[];
}

export interface ShapValue {
  feature: string;
  value: number;
  impact: number;
}

// Task and Evidence Types
export type TaskStatus =
  | "Pending"
  | "In Progress"
  | "Completed"
  | "Verified"
  | "Rejected";
export type TaskType =
  | "Cleanup"
  | "Fogging"
  | "Inspection"
  | "Survey"
  | "Other";

export interface Task {
  id: string;
  taskId: string; // e.g., "T-001"
  type: TaskType;
  title: string;
  description: string;
  assignedTo: string; // PHI user ID
  assignedBy: string; // Supervisor user ID
  district: string;
  mohArea: string;
  location: string;
  geoLocation?: {
    lat: number;
    lng: number;
  };
  status: TaskStatus;
  priority: "Low" | "Medium" | "High";
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  verifiedAt?: string;
  evidence?: Evidence[];
  notes?: string;
}

export interface Evidence {
  id: string;
  taskId: string;
  uploadedBy: string;
  fileUrl: string;
  fileType: "image" | "document" | "video";
  geoLocation?: {
    lat: number;
    lng: number;
  };
  timestamp: string;
  notes?: string;
  verified: boolean;
}

// District and Location Types
export interface District {
  id: string;
  name: string;
  code: string;
  province: string;
  population: number;
  mohAreas: MOHArea[];
  currentRiskLevel?: RiskLevel;
  activeTasks: number;
  activePhis: number;
}

export interface MOHArea {
  id: string;
  name: string;
  code: string;
  districtId: string;
  boundaries?: any; // GeoJSON Polygon
}

// Report Types
export interface WeeklyReport {
  id: string;
  weekNumber: number;
  year: number;
  generatedAt: string;
  districtSummaries: DistrictSummary[];
  nationalSummary: {
    totalCases: number;
    highRiskDistricts: number;
    mediumRiskDistricts: number;
    lowRiskDistricts: number;
    tasksCompleted: number;
    activePHIs: number;
  };
  pdfUrl?: string;
}

export interface DistrictSummary {
  districtId: string;
  districtName: string;
  riskLevel: RiskLevel;
  cases: number;
  tasksAssigned: number;
  tasksCompleted: number;
  phiCount: number;
}

// Analytics Types
export interface CaseTrend {
  date: string;
  cases: number;
  district: string;
}

export interface DashboardStats {
  totalDistricts: number;
  highRiskAreas: number;
  activeUsers: number;
  tasksCompleted: number;
  weeklyChange: {
    cases: number;
    tasks: number;
  };
}

// Notification Types
export interface Notification {
  id: string;
  userId: string;
  type: "alert" | "task" | "report" | "system";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
