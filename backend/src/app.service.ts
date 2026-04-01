import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class AppService {
  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  async checkDatabaseConnection(): Promise<{
    status: string;
    database: string;
    connected: boolean;
  }> {
    try {
      const isConnected = this.dataSource.isInitialized;
      return {
        status: isConnected ? 'OK' : 'DISCONNECTED',
        database: this.dataSource.options.database as string,
        connected: isConnected,
      };
    } catch (error) {
      return {
        status: 'ERROR',
        database: 'unknown',
        connected: false,
      };
    }
  }

  async checkPredictionService(): Promise<{
    status: string;
    url: string;
    connected: boolean;
    responseTime?: number;
    service?: string;
    version?: string;
    modelLoaded?: boolean;
  }> {
    const predictionServiceUrl =
      process.env.ML_SERVICE_URL || 'http://localhost:8000';
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(`${predictionServiceUrl}/health`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        return {
          status: data.status === 'healthy' ? 'OK' : 'ERROR',
          url: predictionServiceUrl,
          connected: true,
          responseTime,
          service: data.service,
          version: data.version,
          modelLoaded: data.model_loaded,
        };
      } else {
        return {
          status: 'ERROR',
          url: predictionServiceUrl,
          connected: false,
          responseTime,
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        status: 'DISCONNECTED',
        url: predictionServiceUrl,
        connected: false,
        responseTime,
      };
    }
  }
}
