import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
} from '@nestjs/common';
import axios from 'axios';
import { ChatbotService } from './chatbot.service';

@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Get('health')
  async health() {
    return this.forward(
      () => this.chatbotService.health(),
      'chatbot health proxy',
    );
  }

  @Post('session')
  async session() {
    return this.forward(
      () => this.chatbotService.createSession(),
      'chatbot session proxy',
    );
  }

  @Post()
  async chat(@Body() body: { message: string; session_id?: string }) {
    return this.forward(() => this.chatbotService.chat(body), 'chatbot proxy');
  }

  private async forward<T>(
    call: () => Promise<T>,
    context: string,
  ): Promise<T> {
    try {
      return await call();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          throw new HttpException(
            error.response.data,
            error.response.status ?? HttpStatus.BAD_GATEWAY,
          );
        }
      }

      console.error(`[${context}] upstream error:`, error);
      throw new HttpException(
        { error: 'Chatbot service unavailable' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
