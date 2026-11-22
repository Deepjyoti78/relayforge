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
import { AuthorizationService } from '../auth/authorization.service';
import { TenantContextService } from '../database/tenant-context.service';
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
    private readonly tenantContext: TenantContextService,
    private readonly authorization: AuthorizationService,
  ) {}

  @Get('metrics')
  async getMetrics(
    @Param('orgId') orgId: string,
    @CurrentUser() user: User,
  ): Promise<OrganizationMetrics> {
    return this.metricsService.getOrganizationMetrics(orgId, user.id);
  }

  @Sse('events/stream')
  async streamEvents(
    @Param('orgId') orgId: string,
    @CurrentUser() user: User,
  ): Promise<Observable<MessageEvent>> {
    await this.tenantContext.runInTenantContext(orgId, user.id, (tx) =>
      this.authorization.verifyMembership(tx, orgId, user.id));
    return this.eventStreamService.getStreamForOrganization(orgId);
  }

  @Sse('telemetry/events/stream')
  async streamTelemetryEvents(
    @Param('orgId') orgId: string,
    @CurrentUser() user: User,
  ): Promise<Observable<MessageEvent>> {
    await this.tenantContext.runInTenantContext(orgId, user.id, (tx) =>
      this.authorization.verifyMembership(tx, orgId, user.id));
    return this.eventStreamService.getStreamForOrganization(orgId);
  }
}
