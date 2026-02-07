---
description: How to manage database migrations with TypeORM
---

# Database Migrations Workflow

This project uses TypeORM migrations to manage database schema changes. Migrations provide version-controlled, reproducible database changes that work across all environments.

## Quick Reference

// turbo-all

### Run pending migrations

```bash
cd backend && npm run migration:run
```

### Create a new empty migration

```bash
cd backend && npm run migration:create --name=AddNewTable
```

### Generate migration from entity changes

```bash
cd backend && npm run migration:generate --name=AddNewColumn
```

### Revert last migration

```bash
cd backend && npm run migration:revert
```

### Show migration status

```bash
cd backend && npm run migration:show
```

---

## Creating New Tables

When you need to add a new table to the system:

### Step 1: Create the Entity

Create a new entity file in `src/entities/`:

```typescript
// src/entities/example.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

@Entity("examples")
export class Example {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @CreateDateColumn()
  created_at: Date;
}
```

### Step 2: Generate the Migration

Run the generate command - TypeORM will compare your entities with the database and create a migration:

```bash
npm run migration:generate --name=CreateExamplesTable
```

This creates a file like `src/migrations/1704391200000-CreateExamplesTable.ts`

### Step 3: Review the Migration

**Always review the generated migration!** TypeORM might detect differences in existing tables that you don't want to change.

### Step 4: Run the Migration

Migrations run automatically on application startup (`migrationsRun: true`), or you can run manually:

```bash
npm run migration:run
```

---

## Best Practices

1. **Never use `synchronize: true` in production** - It can cause data loss
2. **Always review generated migrations** - Remove unwanted changes to existing tables
3. **Use `IF NOT EXISTS`** - For idempotent migrations that can be re-run safely
4. **Keep migrations small** - One logical change per migration
5. **Test migrations locally** - Before deploying to production
6. **Never modify a migration that's been deployed** - Create a new migration instead

---

## Handling External Tables

Tables like `districts`, `dengue_cases`, and `weather_data` are managed by the ML Python service.

- These tables have corresponding TypeORM entities for querying
- Migrations should NOT attempt to modify these tables
- Use `IF NOT EXISTS` to safely skip existing tables

---

## Migration File Structure

```
src/
  migrations/
    1704391200000-InitialSchema.ts      # Baseline migration
    1704391300000-AddNewFeature.ts      # Feature migrations
    ...
```

Each migration has:

- `up()` - Applied when running migrations
- `down()` - Applied when reverting migrations
