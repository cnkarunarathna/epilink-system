import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async checkHealth() {
    const dbStatus = await this.appService.checkDatabaseConnection();
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
      database: dbStatus,
    };
  }
}
