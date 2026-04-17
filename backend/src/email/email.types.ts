export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  template: string;
  context: Record<string, any>;
  relatedEntityType?: string;
  relatedEntityId?: string;
  triggeredByUserId?: string;
  notificationCategory?: string;
}

export interface EmailJobPayload {
  to: string; // single recipient per job
  subject: string;
  template: string;
  context: Record<string, any>;
  relatedEntityType?: string;
  relatedEntityId?: string;
  triggeredByUserId?: string;
  notificationCategory?: string;
}
