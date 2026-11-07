import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { TenantContextService } from './tenant-context.service';

@Module({
  providers: [DatabaseService, TenantContextService],
  exports: [DatabaseService, TenantContextService],
})
export class DatabaseModule {}
