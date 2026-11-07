import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { RuntimeConfig } from '../config/config.module';
import { DatabaseService } from '../database/database.service';

@Controller('health')
export class HealthController {
  constructor(private readonly config: RuntimeConfig, private readonly database: DatabaseService) {}

  @Get('live')
  live() {
    return { status: 'ok', service: 'relayforge-api', version: this.config.values.version };
  }

  @Get('ready')
  async ready() {
    try {
      await this.database.ping();
    } catch {
      throw new ServiceUnavailableException({
        status: 'unavailable',
        checks: { postgres: 'unavailable' },
      });
    }
    // API acceptance depends on PostgreSQL, not queue availability.
    return { status: 'ok', checks: { postgres: 'ok' } };
  }
}
