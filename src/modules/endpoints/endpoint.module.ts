import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { EndpointController } from './endpoint.controller';
import { EndpointService } from './endpoint.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [EndpointController],
  providers: [EndpointService],
  exports: [EndpointService],
})
export class EndpointModule {}
