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
import { EndpointService, type CreateEndpointInput } from './endpoint.service';

@Controller('v1/organizations/:orgId/endpoints')
@UseGuards(AuthGuard)
export class EndpointController {
  constructor(private readonly endpointService: EndpointService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createEndpoint(
    @Param('orgId') orgId: string,
    @CurrentUser() user: User,
    @Body() body: CreateEndpointInput,
  ) {
    return this.endpointService.createEndpoint(orgId, user.id, body);
  }

  @Get()
  async listEndpoints(
    @Param('orgId') orgId: string,
    @CurrentUser() user: User,
  ) {
    return this.endpointService.listEndpoints(orgId, user.id);
  }

  @Delete(':endpointId')
  async deleteEndpoint(
    @Param('orgId') orgId: string,
    @Param('endpointId') endpointId: string,
    @CurrentUser() user: User,
  ) {
    return this.endpointService.deleteEndpoint(orgId, user.id, endpointId);
  }

  @Post(':endpointId/rotate-secret')
  async rotateSecret(
    @Param('orgId') orgId: string,
    @Param('endpointId') endpointId: string,
    @CurrentUser() user: User,
  ) {
    return this.endpointService.rotateSecret(orgId, user.id, endpointId);
  }
}
