import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { User } from '../../generated/prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  DestinationService,
  type CreateDestinationInput,
  type UpdateDestinationInput,
} from './destination.service';

@Controller('v1/organizations/:orgId/destinations')
@UseGuards(AuthGuard)
export class DestinationController {
  constructor(private readonly destinationService: DestinationService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createDestination(
    @Param('orgId') orgId: string,
    @CurrentUser() user: User,
    @Body() body: CreateDestinationInput,
  ) {
    return this.destinationService.createDestination(orgId, user.id, body);
  }

  @Get()
  async listDestinations(
    @Param('orgId') orgId: string,
    @CurrentUser() user: User,
  ) {
    return this.destinationService.listDestinations(orgId, user.id);
  }

  @Get(':destinationId')
  async getDestination(
    @Param('orgId') orgId: string,
    @Param('destinationId') destinationId: string,
    @CurrentUser() user: User,
  ) {
    return this.destinationService.getDestination(orgId, user.id, destinationId);
  }

  @Patch(':destinationId')
  async updateDestination(
    @Param('orgId') orgId: string,
    @Param('destinationId') destinationId: string,
    @CurrentUser() user: User,
    @Body() body: UpdateDestinationInput,
  ) {
    return this.destinationService.updateDestination(orgId, user.id, destinationId, body);
  }

  @Delete(':destinationId')
  async deleteDestination(
    @Param('orgId') orgId: string,
    @Param('destinationId') destinationId: string,
    @CurrentUser() user: User,
  ) {
    return this.destinationService.deleteDestination(orgId, user.id, destinationId);
  }
}
