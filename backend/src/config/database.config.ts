import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export default registerAs('database', (): TypeOrmModuleOptions => {
  const useSsl = (process.env.PGSSL || 'false').toLowerCase() === 'true';

  return {
    type: 'postgres',
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT || '5432', 10),
    username: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    migrationsRun: true, // Automatically run migrations on startup
    synchronize: false, // Never use synchronize - use migrations instead
    logging: process.env.NODE_ENV === 'development',
    ssl: useSsl
      ? {
          rejectUnauthorized: false, // Required for providers like Neon.tech
        }
      : false,
  };
});
