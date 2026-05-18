import api from "@/lib/api";

export interface SystemSettings {
  id: number;
  // General
  organization: string;
  timezone: string;
  maintenanceMode: boolean;
  publicDashboard: boolean;
  // Notifications
  notifyHighRiskAlerts: boolean;
  notifyWeeklyReports: boolean;
  adminEmail: string;
  // Security
  sessionTimeoutEnabled: boolean;
  sessionTimeoutMinutes: number;
  loginAuditLogs: boolean;
  minPasswordLength: number;
  // Data & ML
  autoScrapePdfs: boolean;
  weatherIntegration: boolean;
  autoRunPredictions: boolean;
  autoModelRetraining: boolean;
  updatedAt: string;
}

export type UpdateSettingsData = Partial<Omit<SystemSettings, "id" | "updatedAt">>;

export interface PublicFlags {
  publicDashboard: boolean;
  maintenanceMode: boolean;
}

const settingsService = {
  async get(): Promise<SystemSettings> {
    const response = await api.get<SystemSettings>("/admin/settings");
    return response.data;
  },

  async update(data: UpdateSettingsData): Promise<SystemSettings> {
    const response = await api.patch<SystemSettings>("/admin/settings", data);
    return response.data;
  },

  async getPublic(): Promise<PublicFlags> {
    const response = await api.get<PublicFlags>("/public/settings");
    return response.data;
  },
};

export default settingsService;
