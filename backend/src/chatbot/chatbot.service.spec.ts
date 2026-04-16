import axios from 'axios';
import { ChatbotService } from './chatbot.service';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ChatbotService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.CHATBOT_SERVICE_URL;
  });

  it('should create a chatbot session', async () => {
    process.env.CHATBOT_SERVICE_URL = 'http://chatbot:9000';
    mockedAxios.post.mockResolvedValueOnce({ data: { session_id: 's1' } });
    const service = new ChatbotService();

    const result = await service.createSession();

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://chatbot:9000/session',
      null,
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );
    expect(result).toEqual({ session_id: 's1' });
  });

  it('should send chat payload and return response body', async () => {
    process.env.CHATBOT_SERVICE_URL = 'http://chatbot:9000';
    mockedAxios.post.mockResolvedValueOnce({
      data: { response: 'Hello!', session_id: 's1' },
    });
    const service = new ChatbotService();

    const result = await service.chat({ message: 'Hi', session_id: 's1' });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://chatbot:9000/chat',
      { message: 'Hi', session_id: 's1' },
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );
    expect(result).toEqual({ response: 'Hello!', session_id: 's1' });
  });

  it('should use default URL for health check when env var is missing', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { status: 'ok' } });
    const service = new ChatbotService();

    const result = await service.health();

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'http://localhost:8002/health',
    );
    expect(result).toEqual({ status: 'ok' });
  });
});
