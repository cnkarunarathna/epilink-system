import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class ChatbotService {
  private readonly chatbotServiceUrl =
    process.env.CHATBOT_SERVICE_URL || 'http://localhost:8002';

  async createSession() {
    const response = await axios.post(
      `${this.chatbotServiceUrl}/session`,
      null,
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );
    return response.data;
  }

  async chat(payload: { message: string; session_id?: string }) {
    const response = await axios.post(
      `${this.chatbotServiceUrl}/chat`,
      payload,
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );
    return response.data;
  }

  async health() {
    const response = await axios.get(`${this.chatbotServiceUrl}/health`);
    return response.data;
  }
}
