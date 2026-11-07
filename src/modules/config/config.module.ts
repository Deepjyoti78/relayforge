import { Global, Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { config } from 'dotenv';
import { parseEnvironment } from './environment';
import type { Environment, ProcessRole } from './environment';

export class RuntimeConfig {
  constructor(readonly values: Environment) {}
}

@Global()
@Module({})
export class ConfigurationModule {
  static forRoot(role: ProcessRole): DynamicModule {
    return {
      module: ConfigurationModule,
      providers: [{
        provide: RuntimeConfig,
        useFactory: () => {
          config({ path: process.env.ENV_FILE ?? '.env', quiet: true });
          return new RuntimeConfig(parseEnvironment(role, process.env));
        },
      }],
      exports: [RuntimeConfig],
    };
  }
}
