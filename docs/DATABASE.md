# Database Configuration Guide

## Overview

This backend uses TypeORM with PostgreSQL (Neon.tech) for database management.

## Database Connection

### Environment Variables

The database configuration is stored in `.env`:

```env
PGHOST=ep-sweet-lab-a1la2jjy-pooler.ap-southeast-1.aws.neon.tech
PGDATABASE=neondb
PGUSER=neondb_owner
PGPASSWORD=npg_mRoMWJ2wCQ7h
PGPORT=5432
```

## Project Structure

### Configuration Files

- `src/config/database.config.ts` - Database configuration using @nestjs/config
- `src/database/database.module.ts` - Database module setup
- `src/data-source.ts` - TypeORM DataSource for migrations

### Entities

- `src/entities/user.entity.ts` - Example User entity

## Features

### Auto-sync

- **Development**: `synchronize: true` - Automatically syncs database schema
- **Production**: `synchronize: false` - Use migrations only

### SSL Configuration

SSL is enabled with `rejectUnauthorized: false` for Neon.tech compatibility.

### Logging

Database queries are logged in development mode.

## Available Scripts

### Development

```bash
npm run start:dev    # Start development server with hot reload
```

### Migrations

```bash
npm run migration:generate -- src/migrations/MigrationName   # Generate migration
npm run migration:run                                         # Run migrations
npm run migration:revert                                      # Revert last migration
```

## Health Check

Test the database connection:

```bash
curl http://localhost:3000/health
```

Response:

```json
{
  "status": "OK",
  "timestamp": "2025-11-07T...",
  "database": {
    "status": "OK",
    "database": "neondb",
    "connected": true
  }
}
```

## Creating New Entities

1. Create entity file in `src/entities/`:

```typescript
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('table_name')
export class EntityName {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;
}
```

2. The entity will be automatically loaded (via `entities: [__dirname + '/../**/*.entity{.ts,.js}']`)

## TypeORM Features Used

- **Decorators**: @Entity, @Column, @PrimaryGeneratedColumn
- **Timestamps**: @CreateDateColumn, @UpdateDateColumn
- **Relations**: @OneToMany, @ManyToOne, @ManyToMany (add as needed)
- **Validation**: Can be combined with class-validator

## Notes

- Database synchronization is enabled in development for rapid prototyping
- For production, always use migrations
- SSL is configured for Neon.tech serverless PostgreSQL
- Connection pooling is handled automatically by TypeORM
