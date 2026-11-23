import {
  Controller,
  Get,
  Param,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { takeUntil, timer } from 'rxjs';
import type { Observable } from 'rxjs';
import type { AuthenticatedRequest } from '../auth/auth.guard';
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
    @Req() request: AuthenticatedRequest,
  ): Promise<Observable<MessageEvent>> {
    await this.tenantContext.runInTenantContext(orgId, user.id, (tx) =>
      this.authorization.verifyMembership(tx, orgId, user.id));
    // Bound connection lifetime so EventSource reconnects through AuthGuard and
    // membership checks. Do not keep a transaction open for the stream lifetime.
    const lifetime = Math.max(0, Math.min(30_000, request.session!.expiresAt.getTime() - Date.now()));
    return this.eventStreamService.getStreamForOrganization(orgId).pipe(takeUntil(timer(lifetime)));
  }

  @Sse('telemetry/events/stream')
  async streamTelemetryEvents(
    @Param('orgId') orgId: string,
    @CurrentUser() user: User,
    @Req() request: AuthenticatedRequest,
  ): Promise<Observable<MessageEvent>> {
    await this.tenantContext.runInTenantContext(orgId, user.id, (tx) =>
      this.authorization.verifyMembership(tx, orgId, user.id));
    // Bound connection lifetime so EventSource reconnects through AuthGuard and
    // membership checks. Do not keep a transaction open for the stream lifetime.
    const lifetime = Math.max(0, Math.min(30_000, request.session!.expiresAt.getTime() - Date.now()));
    return this.eventStreamService.getStreamForOrganization(orgId).pipe(takeUntil(timer(lifetime)));
  }
}
