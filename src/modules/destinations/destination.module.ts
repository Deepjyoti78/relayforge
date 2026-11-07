import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { DestinationController } from './destination.controller';
import { DestinationService } from './destination.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [DestinationController],
  providers: [DestinationService],
  exports: [DestinationService],
})
export class DestinationModule {}
