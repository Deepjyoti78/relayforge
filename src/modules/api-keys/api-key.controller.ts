import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { User } from '../../generated/prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ApiKeyService, CreateApiKeyInput } from './api-key.service';

@Controller('v1/organizations/:orgId/api-keys')
@UseGuards(AuthGuard)
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createApiKey(
    @Param('orgId') orgId: string,
    @CurrentUser() user: User,
    @Body() body: CreateApiKeyInput,
  ) {
    return this.apiKeyService.createApiKey(orgId, user.id, body);
  }

  @Get()
  async listApiKeys(
    @Param('orgId') orgId: string,
    @CurrentUser() user: User,
  ) {
    return this.apiKeyService.listApiKeys(orgId, user.id);
  }

  @Delete(':keyId')
  async revokeApiKey(
    @Param('orgId') orgId: string,
    @Param('keyId') keyId: string,
    @CurrentUser() user: User,
  ) {
    return this.apiKeyService.revokeApiKey(orgId, user.id, keyId);
  }
}
