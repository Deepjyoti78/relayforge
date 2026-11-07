import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthorizationService } from './authorization.service';
import { GitHubOAuthService } from './github-oauth.service';
import { SessionService } from './session.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [
    GitHubOAuthService,
    SessionService,
    AuthorizationService,
    AuthGuard,
  ],
  exports: [
    SessionService,
    AuthorizationService,
    AuthGuard,
  ],
})
export class AuthModule {}
