import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplication } from '@nestjs/common';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  constructor(app: INestApplication) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const redisOptions = {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
      ...(process.env.REDIS_USERNAME && { username: process.env.REDIS_USERNAME }),
    };

    const pubClient = new Redis(redisOptions);
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) =>
      console.error('[Redis pub] connection error:', err.message),
    );
    subClient.on('error', (err) =>
      console.error('[Redis sub] connection error:', err.message),
    );

    // Wait for both clients to be ready before creating the adapter
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        pubClient.once('ready', resolve);
        pubClient.once('error', reject);
      }),
      new Promise<void>((resolve, reject) => {
        subClient.once('ready', resolve);
        subClient.once('error', reject);
      }),
    ]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
