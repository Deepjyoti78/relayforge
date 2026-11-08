import {
  Controller,
  Get,
  Param,
  Sse,
  UseGuards,
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { User } from '../../generated/prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { EventStreamService } from './event-stream.service';
import { MetricsService, OrganizationMetrics } from './metrics.service';

@Controller('v1/organizations/:orgId')
@UseGuards(AuthGuard)
export class TelemetryController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly eventStreamService: EventStreamService,
  ) {}

  @Get('metrics')
  async getMetrics(
    @Param('orgId') orgId: string,
    @CurrentUser() user: User,
  ): Promise<OrganizationMetrics> {
    return this.metricsService.getOrganizationMetrics(orgId, user.id);
  }

  @Sse('events/stream')
  streamEvents(
    @Param('orgId') orgId: string,
  ): Observable<MessageEvent> {
    return this.eventStreamService.getStreamForOrganization(orgId);
  }

  @Sse('telemetry/events/stream')
  streamTelemetryEvents(
    @Param('orgId') orgId: string,
  ): Observable<MessageEvent> {
    return this.eventStreamService.getStreamForOrganization(orgId);
  }
}
