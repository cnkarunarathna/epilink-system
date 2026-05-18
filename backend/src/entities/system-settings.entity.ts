import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('system_settings')
export class SystemSettings {
  @PrimaryGeneratedColumn()
  id: number;

  // General
  @Column({ default: 'Ministry of Health, Sri Lanka' })
  organization: string;

  @Column({ default: 'Asia/Colombo' })
  timezone: string;

  @Column({ name: 'maintenance_mode', default: false })
  maintenanceMode: boolean;

  @Column({ name: 'public_dashboard', default: true })
  publicDashboard: boolean;

  // Notifications
  @Column({ name: 'notify_high_risk_alerts', default: true })
  notifyHighRiskAlerts: boolean;

  @Column({ name: 'notify_weekly_reports', default: true })
  notifyWeeklyReports: boolean;

  @Column({ name: 'admin_email', default: 'admin@health.lk' })
  adminEmail: string;

  // Security
  @Column({ name: 'session_timeout_enabled', default: true })
  sessionTimeoutEnabled: boolean;

  @Column({ name: 'session_timeout_minutes', default: 30 })
  sessionTimeoutMinutes: number;

  @Column({ name: 'login_audit_logs', default: true })
  loginAuditLogs: boolean;

  @Column({ name: 'min_password_length', default: 8 })
  minPasswordLength: number;

  // Data & ML
  @Column({ name: 'auto_scrape_pdfs', default: true })
  autoScrapePdfs: boolean;

  @Column({ name: 'weather_integration', default: true })
  weatherIntegration: boolean;

  @Column({ name: 'auto_run_predictions', default: true })
  autoRunPredictions: boolean;

  @Column({ name: 'auto_model_retraining', default: true })
  autoModelRetraining: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
