import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  ADMIN = 'admin',
  SUPERVISOR = 'supervisor',
  PHI = 'phi',
  VIEWER = 'viewer',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  name: string;

  @Column()
  password: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.VIEWER,
  })
  role: UserRole;

  @Column({ nullable: true })
  district: string;

  @Column({ default: true })
  isActive: boolean;

  /** FCM device token for mobile push notifications (nullable — set by mobile app on login) */
  @Column({ name: 'fcm_token', type: 'varchar', length: 512, nullable: true })
  fcmToken: string | null;

  @Column({ name: 'password_reset_otp', type: 'varchar', nullable: true })
  passwordResetOtp: string | null;

  @Column({ name: 'password_reset_expiry', type: 'timestamptz', nullable: true })
  passwordResetExpiry: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
