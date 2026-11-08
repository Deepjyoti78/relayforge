import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { User } from '../../generated/prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { DeliveryService } from './delivery.service';

@Controller('v1/organizations/:orgId')
@UseGuards(AuthGuard)
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Get('deliveries')
  async listDeliveries(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @CurrentUser() user: User,
    @Query('destinationId') destinationId?: string,
    @Query('eventId') eventId?: string,
    @Query('status') status?: 'SUCCESS' | 'FAILED',
    @Query('limit') limit?: string,
  ) {
    const filters: {
      destinationId?: string;
      eventId?: string;
      status?: 'SUCCESS' | 'FAILED';
      limit?: number;
    } = {};

    if (destinationId) filters.destinationId = destinationId;
    if (eventId) filters.eventId = eventId;
    if (status) filters.status = status;
    if (limit) {
      const parsedLimit = parseInt(limit, 10);
      if (!Number.isNaN(parsedLimit)) {
        filters.limit = parsedLimit;
      }
    }

    return this.deliveryService.listDeliveryAttempts(orgId, user.id, filters);
  }

  @Post('destinations/:destinationId/test')
  @HttpCode(HttpStatus.OK)
  async testDestinationPing(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('destinationId', ParseUUIDPipe) destinationId: string,
    @CurrentUser() user: User,
  ) {
    return this.deliveryService.testDestinationPing(orgId, user.id, destinationId);
  }
}
