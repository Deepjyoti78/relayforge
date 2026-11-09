import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({ path: process.env.ENV_FILE ?? '.env', quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    // Generation works without a live database; migrations require this variable.
    url: process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL ?? '',
  },
});
