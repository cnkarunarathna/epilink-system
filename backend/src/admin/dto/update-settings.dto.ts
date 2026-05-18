import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  organization?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @IsOptional()
  @IsBoolean()
  publicDashboard?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyHighRiskAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyWeeklyReports?: boolean;

  @IsOptional()
  @IsEmail()
  adminEmail?: string;

  @IsOptional()
  @IsBoolean()
  sessionTimeoutEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(480)
  sessionTimeoutMinutes?: number;

  @IsOptional()
  @IsBoolean()
  loginAuditLogs?: boolean;

  @IsOptional()
  @IsInt()
  @Min(6)
  @Max(32)
  minPasswordLength?: number;

  @IsOptional()
  @IsBoolean()
  autoScrapePdfs?: boolean;

  @IsOptional()
  @IsBoolean()
  weatherIntegration?: boolean;

  @IsOptional()
  @IsBoolean()
  autoRunPredictions?: boolean;

  @IsOptional()
  @IsBoolean()
  autoModelRetraining?: boolean;
}
