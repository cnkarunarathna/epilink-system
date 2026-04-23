import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../entities/user.entity';

export enum ReportStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  ARCHIVED = 'archived',
}

@Entity('weekly_reports')
export class WeeklyReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'integer' })
  year: number;

  @Column({ name: 'week_number', type: 'integer' })
  weekNumber: number;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: ReportStatus.PENDING,
  })
  status: ReportStatus;

  @Column({ name: 'total_predicted_cases', type: 'integer', default: 0 })
  totalPredictedCases: number;

  /** Historical reports: sum of actual surveillance cases for the target week. */
  @Column({ name: 'total_actual_cases', type: 'integer', nullable: true })
  totalActualCases: number | null;

  /** Predicted reports: sum of model-generated case counts for the target week. */
  @Column({ name: 'total_forecast_cases', type: 'integer', nullable: true })
  totalForecastCases: number | null;

  @Column({ name: 'total_districts', type: 'integer', default: 0 })
  totalDistricts: number;

  @Column({ name: 'high_risk_districts', type: 'integer', default: 0 })
  highRiskDistricts: number;

  @Column({ name: 'report_type', type: 'varchar', length: 20, default: 'predicted' })
  reportType: 'historical' | 'predicted';

  @Column({ name: 'total_current_cases', type: 'integer', nullable: true })
  totalCurrentCases: number | null;

  @Column({ name: 'report_data', type: 'jsonb' })
  reportData: Record<string, any>;

  @Column({ name: 's3_key', type: 'varchar', length: 500, nullable: true })
  s3Key: string | null;

  @CreateDateColumn({ name: 'generated_at' })
  generatedAt: Date;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'approved_by_id' })
  approvedBy: User | null;

  @Column({ name: 'approved_by_id', type: 'uuid', nullable: true })
  approvedById: string | null;

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User | null;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;
}
