import { NEVER } from 'rxjs';
import { TelemetryController } from '../src/modules/observability/telemetry.controller';
import type { MetricsService } from '../src/modules/observability/metrics.service';
import type { EventStreamService } from '../src/modules/observability/event-stream.service';
import type { TenantContextService } from '../src/modules/database/tenant-context.service';
import { AuthorizationService } from '../src/modules/auth/authorization.service';
import type { AuthenticatedRequest } from '../src/modules/auth/auth.guard';
import type { User } from '../src/generated/prisma/client';

describe('SSE authorization lifetime', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });
  it.each(['streamEvents', 'streamTelemetryEvents'] as const)('%s reconnects within 30 seconds and never runs past session expiry', async (method) => {
    const tenant = { runInTenantContext: jest.fn().mockResolvedValue({ role: 'VIEWER' }) };
    const controller = new TelemetryController({} as MetricsService,
      { getStreamForOrganization: () => NEVER } as unknown as EventStreamService,
      tenant as unknown as TenantContextService, new AuthorizationService());
    for (const duration of [100, 120000]) {
      const req = { session: { expiresAt: new Date(Date.now() + duration) } } as AuthenticatedRequest;
      const stream = await controller[method]('org-1', { id: 'user-1' } as User, req);
      const complete = jest.fn();
      stream.subscribe({ complete });
      const lifetime = Math.min(duration, 30000);
      await jest.advanceTimersByTimeAsync(lifetime - 1);
      expect(complete).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(1);
      expect(complete).toHaveBeenCalledTimes(1);
    }
    expect(tenant.runInTenantContext).toHaveBeenCalledTimes(2);
  });
});
