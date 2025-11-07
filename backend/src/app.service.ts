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
}
