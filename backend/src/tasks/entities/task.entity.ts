import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../entities/user.entity';
import { District } from '../../entities/district.entity';

export enum TaskType {
  CLEANUP = 'cleanup',
  FOGGING = 'fogging',
  INSPECTION = 'inspection',
  INVESTIGATION = 'investigation',
}

export enum TaskStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  SUBMITTED = 'submitted',
  VERIFIED = 'verified',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: TaskType,
    default: TaskType.INSPECTION,
  })
  type: TaskType;

  @Column({
    type: 'enum',
    enum: TaskStatus,
    default: TaskStatus.PENDING,
  })
  status: TaskStatus;

  @Column({
    type: 'enum',
    enum: TaskPriority,
    default: TaskPriority.MEDIUM,
  })
  priority: TaskPriority;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', nullable: true })
  address: string | null;

  @Column('decimal', { precision: 10, scale: 7, nullable: true })
  latitude: number | null;

  @Column('decimal', { precision: 10, scale: 7, nullable: true })
  longitude: number | null;

  @Column({ name: 'due_date', type: 'timestamp', nullable: true })
  dueDate: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  // Relations
  @ManyToOne(() => District, { nullable: false })
  @JoinColumn({ name: 'district_id' })
  district: District;

  @Column({ name: 'district_id' })
  districtId: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_phi_id' })
  assignedPhi: User | null;

  @Column({ name: 'assigned_phi_id', nullable: true })
  assignedPhiId: string | null;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @Column({ name: 'created_by_id' })
  createdById: string;

  @OneToMany('Evidence', 'task')
  evidence: any[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'assigned_at', type: 'timestamp', nullable: true })
  assignedAt: Date | null;

  @Column({ name: 'submitted_at', type: 'timestamp', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;
}
