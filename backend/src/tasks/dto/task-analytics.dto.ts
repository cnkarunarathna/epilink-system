export class TaskAnalyticsQueryDto {
  districtId?: number;
  from?: string;
  to?: string;
  period?: 'day' | 'week' | 'month';
}

export class NationalSummaryDto {
  total: number;
  pending: number;
  assigned: number;
  inProgress: number;
  submitted: number;
  verified: number;
  completed: number;
  rejected: number;
  overdue: number;
  completionRate: number;
  avgCompletionHours: number | null;
  activePhi: number;
  activeSupervisors: number;
}

export class DistrictTaskSummaryDto {
  districtId: number;
  districtName: string;
  total: number;
  completed: number;
  pending: number;
  assigned: number;
  inProgress: number;
  submitted: number;
  rejected: number;
  overdue: number;
  completionRate: number;
}

export class StatusDistributionDto {
  status: string;
  count: number;
}

export class TypeDistributionDto {
  type: string;
  count: number;
  completed: number;
}

export class PriorityDistributionDto {
  priority: string;
  count: number;
  completed: number;
}

export class TaskTrendPointDto {
  period: string;
  created: number;
  completed: number;
}

export class SupervisorMetricsDto {
  supervisorId: string;
  name: string;
  district: string;
  tasksCreated: number;
  completed: number;
  pending: number;
  rejected: number;
  overdue: number;
  completionRate: number;
}

export class PhiMetricsDto {
  phiId: string;
  name: string;
  district: string;
  isActive: boolean;
  assigned: number;
  completed: number;
  rejected: number;
  overdue: number;
  completionRate: number;
  avgCompletionHours: number | null;
}

export class OverdueTaskDto {
  id: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  dueDate: string;
  districtId: number;
  districtName: string;
  phiId: string | null;
  phiName: string | null;
  hoursOverdue: number;
  severity: 'warning' | 'critical';
}

export class EvidenceReviewDistrictDto {
  districtId: number;
  districtName: string;
  total: number;
  approved: number;
  rejected: number;
  pending: number;
  approvalRate: number;
}

export class EvidenceReviewSummaryDto {
  national: {
    total: number;
    approved: number;
    rejected: number;
    pending: number;
    approvalRate: number;
  };
  byDistrict: EvidenceReviewDistrictDto[];
}
