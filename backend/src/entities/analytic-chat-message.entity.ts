import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { AnalyticChatSession } from './analytic-chat-session.entity';

@Entity('analytic_chat_messages')
export class AnalyticChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => AnalyticChatSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chat_session_id' })
  chatSession: AnalyticChatSession;

  @Column({ length: 20 })
  role: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'tool_calls', type: 'jsonb', nullable: true })
  toolCalls: string[] | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
