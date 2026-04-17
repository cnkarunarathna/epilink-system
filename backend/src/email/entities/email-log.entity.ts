import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export type EmailStatus = 'pending' | 'sent' | 'failed' | 'skipped';

@Entity('email_logs')
export class EmailLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'recipient_email' })
  recipientEmail: string;

  @Column({ name: 'recipient_name', nullable: true })
  recipientName: string;

  @Column()
  subject: string;

  @Column({ name: 'template_name' })
  templateName: string;

  @Column({ name: 'template_data', type: 'jsonb', nullable: true })
  templateData: Record<string, any>;

  @Column({ default: 'pending' })
  status: EmailStatus;

  @Column({ name: 'error_message', nullable: true, type: 'text' })
  errorMessage: string;

  @Column({ name: 'message_id', nullable: true })
  messageId: string;

  @Column({ name: 'related_entity_type', nullable: true })
  relatedEntityType: string;

  @Column({ name: 'related_entity_id', nullable: true })
  relatedEntityId: string;

  @Column({ name: 'triggered_by_user_id', nullable: true })
  triggeredByUserId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'sent_at', nullable: true })
  sentAt: Date;
}
