import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { TaskMessage } from './task-message.entity';
import { User } from '../../entities/user.entity';

@Entity('message_reads')
@Unique(['messageId', 'userId'])
export class MessageRead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'message_id' })
  messageId: string;

  @ManyToOne(() => TaskMessage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message: TaskMessage;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ name: 'read_at' })
  readAt: Date;
}
