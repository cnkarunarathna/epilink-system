import api from "@/lib/api";

export type EmailStatus = "pending" | "sent" | "failed" | "skipped";

export interface EmailLog {
  id: string;
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  templateName: string;
  templateData?: Record<string, any>;
  status: EmailStatus;
  errorMessage?: string;
  messageId?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  triggeredByUserId?: string;
  createdAt: string;
  sentAt?: string;
}

export interface PaginatedEmailLogs {
  data: EmailLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface EmailLogFilters {
  status?: EmailStatus | "";
  template?: string;
  recipientEmail?: string;
  relatedEntityType?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface TemplateStats {
  template: string;
  sent: number;
  failed: number;
  skipped: number;
  pending: number;
}

export interface EmailStats {
  period: string;
  totalSent: number;
  totalFailed: number;
  totalSkipped: number;
  totalPending: number;
  byTemplate: TemplateStats[];
  failureRate: string;
}

const emailService = {
  async getLogs(filters: EmailLogFilters = {}): Promise<PaginatedEmailLogs> {
    const params = new URLSearchParams();
    if (filters.status)           params.set("status", filters.status);
    if (filters.template)         params.set("template", filters.template);
    if (filters.recipientEmail)   params.set("recipientEmail", filters.recipientEmail);
    if (filters.relatedEntityType) params.set("relatedEntityType", filters.relatedEntityType);
    if (filters.from)             params.set("from", filters.from);
    if (filters.to)               params.set("to", filters.to);
    if (filters.page)             params.set("page", String(filters.page));
    if (filters.limit)            params.set("limit", String(filters.limit));

    const response = await api.get<PaginatedEmailLogs>(`/email/logs?${params}`);
    return response.data;
  },

  async getLog(id: string): Promise<EmailLog> {
    const response = await api.get<EmailLog>(`/email/logs/${id}`);
    return response.data;
  },

  async resend(id: string): Promise<{ message: string; jobId?: string }> {
    const response = await api.post<{ message: string; jobId?: string }>(
      `/email/logs/${id}/resend`,
    );
    return response.data;
  },

  async getStats(days = 7): Promise<EmailStats> {
    const response = await api.get<EmailStats>(`/email/logs/stats?days=${days}`);
    return response.data;
  },
};

export default emailService;
