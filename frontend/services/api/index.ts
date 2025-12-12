import {
  User,
  RiskPrediction,
  Task,
  District,
  WeeklyReport,
  DashboardStats,
  ApiResponse,
  PaginatedResponse,
  Notification,
} from "@/lib/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

// Generic fetch wrapper
async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const token = localStorage.getItem("auth_token");

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options?.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message || "An error occurred",
      };
    }

    return {
      success: true,
      data: data.data || data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

// Authentication
export const authService = {
  async login(
    email: string,
    password: string
  ): Promise<ApiResponse<{ user: User; token: string }>> {
    const response = await fetchApi<{ user: User; token: string }>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }
    );

    if (response.success && response.data) {
      localStorage.setItem("auth_token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));
    }

    return response;
  },

  async logout(): Promise<void> {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");
  },

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem("user");
    return userStr ? JSON.parse(userStr) : null;
  },
};

// Dashboard
export const dashboardService = {
  async getStats(role: string): Promise<ApiResponse<DashboardStats>> {
    return fetchApi<DashboardStats>(`/dashboard/${role}/stats`);
  },

  async getNotifications(): Promise<ApiResponse<Notification[]>> {
    return fetchApi<Notification[]>("/notifications");
  },

  async markNotificationRead(id: string): Promise<ApiResponse<void>> {
    return fetchApi<void>(`/notifications/${id}/read`, { method: "PATCH" });
  },
};

// Predictions
export const predictionService = {
  async getRiskPredictions(
    districtId?: string
  ): Promise<ApiResponse<RiskPrediction[]>> {
    const query = districtId ? `?district=${districtId}` : "";
    return fetchApi<RiskPrediction[]>(`/predictions${query}`);
  },

  async getLatestPrediction(
    districtId: string
  ): Promise<ApiResponse<RiskPrediction>> {
    return fetchApi<RiskPrediction>(`/predictions/latest/${districtId}`);
  },

  async getPredictionHistory(
    districtId: string
  ): Promise<ApiResponse<RiskPrediction[]>> {
    return fetchApi<RiskPrediction[]>(`/predictions/history/${districtId}`);
  },
};

// Tasks
export const taskService = {
  async getTasks(filters?: {
    status?: string;
    assignedTo?: string;
    district?: string;
  }): Promise<ApiResponse<PaginatedResponse<Task>>> {
    const params = new URLSearchParams(filters as Record<string, string>);
    return fetchApi<PaginatedResponse<Task>>(`/tasks?${params}`);
  },

  async getTaskById(id: string): Promise<ApiResponse<Task>> {
    return fetchApi<Task>(`/tasks/${id}`);
  },

  async createTask(task: Partial<Task>): Promise<ApiResponse<Task>> {
    return fetchApi<Task>("/tasks", {
      method: "POST",
      body: JSON.stringify(task),
    });
  },

  async updateTask(
    id: string,
    updates: Partial<Task>
  ): Promise<ApiResponse<Task>> {
    return fetchApi<Task>(`/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  },

  async uploadEvidence(
    taskId: string,
    file: File,
    notes?: string
  ): Promise<ApiResponse<Task>> {
    const formData = new FormData();
    formData.append("file", file);
    if (notes) formData.append("notes", notes);

    const token = localStorage.getItem("auth_token");
    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/evidence`, {
      method: "POST",
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    const data = await response.json();
    return {
      success: response.ok,
      data: response.ok ? data : undefined,
      error: !response.ok ? data.message : undefined,
    };
  },
};

// Districts
export const districtService = {
  async getDistricts(): Promise<ApiResponse<District[]>> {
    return fetchApi<District[]>("/districts");
  },

  async getDistrictById(id: string): Promise<ApiResponse<District>> {
    return fetchApi<District>(`/districts/${id}`);
  },

  async updateDistrict(
    id: string,
    updates: Partial<District>
  ): Promise<ApiResponse<District>> {
    return fetchApi<District>(`/districts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  },
};

// Users
export const userService = {
  async getUsers(role?: string): Promise<ApiResponse<PaginatedResponse<User>>> {
    const query = role ? `?role=${role}` : "";
    return fetchApi<PaginatedResponse<User>>(`/users${query}`);
  },

  async getUserById(id: string): Promise<ApiResponse<User>> {
    return fetchApi<User>(`/users/${id}`);
  },

  async createUser(user: Partial<User>): Promise<ApiResponse<User>> {
    return fetchApi<User>("/users", {
      method: "POST",
      body: JSON.stringify(user),
    });
  },

  async updateUser(
    id: string,
    updates: Partial<User>
  ): Promise<ApiResponse<User>> {
    return fetchApi<User>(`/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  },

  async deleteUser(id: string): Promise<ApiResponse<void>> {
    return fetchApi<void>(`/users/${id}`, { method: "DELETE" });
  },
};

// Reports
export const reportService = {
  async getWeeklyReports(): Promise<ApiResponse<WeeklyReport[]>> {
    return fetchApi<WeeklyReport[]>("/reports/weekly");
  },

  async getLatestReport(): Promise<ApiResponse<WeeklyReport>> {
    return fetchApi<WeeklyReport>("/reports/weekly/latest");
  },

  async generateReport(
    weekNumber: number,
    year: number
  ): Promise<ApiResponse<WeeklyReport>> {
    return fetchApi<WeeklyReport>("/reports/generate", {
      method: "POST",
      body: JSON.stringify({ weekNumber, year }),
    });
  },

  async downloadReportPdf(reportId: string): Promise<Blob | null> {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`${API_BASE_URL}/reports/${reportId}/pdf`, {
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!response.ok) return null;
      return await response.blob();
    } catch {
      return null;
    }
  },
};
