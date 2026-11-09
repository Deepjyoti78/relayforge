import { Controller, Get } from '@nestjs/common';
import { RuntimeConfig } from '../modules/config/config.module';

@Controller()
export class AppController {
  constructor(private readonly config: RuntimeConfig) {}

  @Get()
  root() {
    return {
      name: 'RelayForge Enterprise Webhook Gateway',
      version: this.config.values.version,
      status: 'operational',
      health: '/health/ready',
    };
  }
}
