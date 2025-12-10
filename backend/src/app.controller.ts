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
    const predictionStatus = await this.appService.checkPredictionService();

    // Overall status is OK only if all services are OK
    const overallStatus =
      dbStatus.status === 'OK' && predictionStatus.status === 'OK'
        ? 'OK'
        : 'DEGRADED';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      database: dbStatus,
      predictionService: predictionStatus,
    };
  }
}
