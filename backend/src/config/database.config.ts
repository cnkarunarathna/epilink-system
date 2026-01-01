import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export default registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'postgres',
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT || '5432', 10),
    username: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: false, // Keep synchronize disabled to prevent schema conflicts
    logging: process.env.NODE_ENV === 'development',
    // ssl: {
    //   rejectUnauthorized: false, // Required for Neon.tech
    // },
  }),
);
