import { PushNotificationService } from './push-notification.service';

const mockSend = jest.fn();
const mockMessaging = jest.fn(() => ({ send: mockSend }));
const mockCert = jest.fn((serviceAccount) => serviceAccount);
const mockInitializeApp = jest.fn(() => ({ app: 'firebase-app' }));

jest.mock(
  'firebase-admin',
  () => ({
    messaging: mockMessaging,
    credential: { cert: mockCert },
    initializeApp: mockInitializeApp,
  }),
  { virtual: true },
);

describe('PushNotificationService', () => {
  let service: PushNotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.FIREBASE_CREDENTIALS_JSON;
    service = new PushNotificationService();
  });

  it('should skip initialization when credentials env var is missing', () => {
    const warnSpy = jest
      .spyOn((service as any).logger, 'warn')
      .mockImplementation();

    service.onModuleInit();

    expect(warnSpy).toHaveBeenCalledWith(
      'FIREBASE_CREDENTIALS_JSON not set — push notifications disabled',
    );
  });

  it('should log error when credentials are invalid JSON', () => {
    process.env.FIREBASE_CREDENTIALS_JSON = 'invalid-json';
    const errorSpy = jest
      .spyOn((service as any).logger, 'error')
      .mockImplementation();

    service.onModuleInit();

    expect(errorSpy).toHaveBeenCalled();
    expect((service as any).admin).toBeNull();
  });

  it('should initialize firebase-admin when credentials are valid', () => {
    process.env.FIREBASE_CREDENTIALS_JSON = JSON.stringify({
      project_id: 'epilink',
      client_email: 'svc@example.com',
      private_key: 'abc',
    });

    service.onModuleInit();

    expect(mockCert).toHaveBeenCalledWith(
      expect.objectContaining({ project_id: 'epilink' }),
    );
    expect(mockInitializeApp).toHaveBeenCalled();
  });

  it('should send notification with trimmed preview for long messages', async () => {
    process.env.FIREBASE_CREDENTIALS_JSON = JSON.stringify({
      project_id: 'epilink',
      client_email: 'svc@example.com',
      private_key: 'abc',
    });
    service.onModuleInit();

    const longContent = 'A'.repeat(120);

    await service.sendChatNotification({
      fcmToken: 'device-token-123456',
      senderName: 'Nurse Bot',
      content: longContent,
      taskId: 'task-1',
      taskTitle: 'Follow-up visit',
    });

    expect(mockMessaging).toHaveBeenCalled();
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'device-token-123456',
        notification: {
          title: 'Nurse Bot sent a message',
          body: `${'A'.repeat(97)}...`,
        },
        data: {
          type: 'chat_message',
          taskId: 'task-1',
          taskTitle: 'Follow-up visit',
        },
      }),
    );
  });

  it('should swallow send errors and log warning', async () => {
    process.env.FIREBASE_CREDENTIALS_JSON = JSON.stringify({
      project_id: 'epilink',
      client_email: 'svc@example.com',
      private_key: 'abc',
    });
    service.onModuleInit();

    mockSend.mockRejectedValueOnce(new Error('fcm unavailable'));
    const warnSpy = jest
      .spyOn((service as any).logger, 'warn')
      .mockImplementation();

    await expect(
      service.sendChatNotification({
        fcmToken: 'device-token-123456',
        senderName: 'Nurse Bot',
        content: 'Short message',
        taskId: 'task-2',
        taskTitle: 'Case review',
      }),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Push notification failed for token ...123456'),
    );
  });

  it('should no-op when firebase is not configured', async () => {
    await expect(
      service.sendChatNotification({
        fcmToken: 'token',
        senderName: 'A',
        content: 'B',
        taskId: 'task',
        taskTitle: 'title',
      }),
    ).resolves.toBeUndefined();

    expect(mockSend).not.toHaveBeenCalled();
  });
});
