import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('notification_preferences')
export class NotificationPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId: string;

  @Column({ name: 'task_assigned', default: true })
  taskAssigned: boolean;

  @Column({ name: 'task_status_changed', default: true })
  taskStatusChanged: boolean;

  @Column({ name: 'task_reminder', default: true })
  taskReminder: boolean;

  @Column({ name: 'task_overdue', default: true })
  taskOverdue: boolean;

  @Column({ name: 'evidence_review', default: true })
  evidenceReview: boolean;

  @Column({ name: 'report_ready', default: true })
  reportReady: boolean;

  @Column({ name: 'weekly_digest', default: true })
  weeklyDigest: boolean;

  @Column({ name: 'risk_alerts', default: true })
  riskAlerts: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
