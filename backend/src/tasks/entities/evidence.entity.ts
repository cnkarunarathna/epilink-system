import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Task } from './task.entity';
import { User } from '../../entities/user.entity';

export enum EvidenceStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('evidence')
export class Evidence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'image_url' })
  imageUrl: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column('decimal', { precision: 10, scale: 7, nullable: true })
  latitude: number;

  @Column('decimal', { precision: 10, scale: 7, nullable: true })
  longitude: number;

  @Column({
    type: 'enum',
    enum: EvidenceStatus,
    default: EvidenceStatus.PENDING,
  })
  status: EvidenceStatus;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string;

  // Relations
  @ManyToOne(() => Task, (task) => task.evidence, { nullable: false })
  @JoinColumn({ name: 'task_id' })
  task: Task;

  @Column({ name: 'task_id' })
  taskId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'submitted_by_id' })
  submittedBy: User;

  @Column({ name: 'submitted_by_id' })
  submittedById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'verified_by_id' })
  verifiedBy: User;

  @Column({ name: 'verified_by_id', nullable: true })
  verifiedById: string;

  @CreateDateColumn({ name: 'submitted_at' })
  submittedAt: Date;

  @Column({ name: 'verified_at', nullable: true })
  verifiedAt: Date;
}
