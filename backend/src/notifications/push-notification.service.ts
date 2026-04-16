import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

interface FirebaseAdmin {
  messaging: (app?: any) => {
    send: (message: any) => Promise<string>;
  };
  credential: { cert: (serviceAccount: any) => any };
  initializeApp: (options: any) => any;
}

@Injectable()
export class PushNotificationService implements OnModuleInit {
  private readonly logger = new Logger(PushNotificationService.name);
  private admin: FirebaseAdmin | null = null;
  private firebaseApp: any = null;

  onModuleInit() {
    const credentialsJson = process.env.FIREBASE_CREDENTIALS_JSON;
    if (!credentialsJson) {
      this.logger.warn(
        'FIREBASE_CREDENTIALS_JSON not set — push notifications disabled',
      );
      return;
    }
    try {
      // Dynamic require so missing firebase-admin package doesn't crash the app
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.admin = require('firebase-admin') as FirebaseAdmin;
      const credentials = JSON.parse(credentialsJson);
      this.firebaseApp = this.admin.initializeApp({
        credential: this.admin.credential.cert(credentials),
      });
      this.logger.log('Firebase Admin SDK initialized');
    } catch (err) {
      this.admin = null;
      this.logger.error(
        `Failed to initialize Firebase Admin: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /**
   * Send a chat message push notification to a device FCM token.
   * Silently skipped when Firebase is not configured.
   */
  async sendChatNotification(params: {
    fcmToken: string;
    senderName: string;
    content: string;
    taskId: string;
    taskTitle: string;
  }): Promise<void> {
    if (!this.admin || !this.firebaseApp) return;

    const preview =
      params.content.length > 100
        ? `${params.content.slice(0, 97)}...`
        : params.content;

    try {
      await this.admin.messaging(this.firebaseApp).send({
        token: params.fcmToken,
        notification: {
          title: `${params.senderName} sent a message`,
          body: preview,
        },
        data: {
          type: 'chat_message',
          taskId: params.taskId,
          taskTitle: params.taskTitle,
        },
        android: { priority: 'high' } as any,
        apns: { payload: { aps: { sound: 'default' } } } as any,
      });
    } catch (err) {
      // Non-fatal — push delivery failure must never break message send
      this.logger.warn(
        `Push notification failed for token ...${params.fcmToken.slice(-6)}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
