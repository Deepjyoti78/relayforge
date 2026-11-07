import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { RuntimeConfig } from '../config/config.module';
import { httpLoggerOptions } from './logging';

@Module({
  imports: [LoggerModule.forRootAsync({
    inject: [RuntimeConfig],
    useFactory: (config: RuntimeConfig) => ({ pinoHttp: httpLoggerOptions(config.values) }),
  })],
  exports: [LoggerModule],
})
export class ObservabilityModule {}
