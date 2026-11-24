import { OutboxWorkerService } from '../src/worker/outbox-worker.service';
import type { DatabaseService } from '../src/modules/database/database.service';
import type { DeliveryService } from '../src/modules/delivery/delivery.service';
import type { RateLimiterService } from '../src/modules/delivery/rate-limiter.service';
import type { EventStreamService } from '../src/modules/observability/event-stream.service';
import type { WorkflowEngineService } from '../src/modules/workflows/workflow-engine.service';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

function fixture(claimed: unknown[], recovery = Promise.resolve()) {
  const query = jest.fn<Promise<unknown>, [TemplateStringsArray, ...unknown[]]>()
    .mockImplementation(async (sql) => {
      if (sql.join('').includes('claim_pending_outbox_messages')) return claimed;
      if (sql.join('').includes('renew_outbox_lease')) return [{ renew_outbox_lease: true }];
      await recovery;
      return [{ reclaim_stale_outbox_leases: 0 }];
    });
  const dispatch = jest.fn<Promise<void>, [unknown]>();
  const worker = new OutboxWorkerService(
    { client: { $queryRaw: query } } as unknown as DatabaseService,
    {} as DeliveryService,
    {} as RateLimiterService,
    {} as EventStreamService,
    { processWorkflowOutbox: dispatch } as unknown as WorkflowEngineService,
  );
  return { worker, query, dispatch };
}

describe('outbox worker graceful shutdown', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('waits for active dispatch and leaves unstarted leases for recovery', async () => {
    const started = deferred();
    const release = deferred();
    const { worker, query, dispatch } = fixture([
      { id: 'first', channel: 'workflow' }, { id: 'second', channel: 'workflow' },
    ]);
    dispatch.mockImplementation(async () => { started.resolve(); await release.promise; });
    worker.onModuleInit();
    await started.promise;
    let closed = false;
    const closing = Promise.resolve(worker.onModuleDestroy()).then(() => { closed = true; });
    try {
      await Promise.resolve();
      expect(closed).toBe(false);
    } finally {
      release.resolve();
      await closing;
    }
    expect(dispatch).toHaveBeenCalledTimes(1);
    const queryCount = query.mock.calls.length;
    await jest.advanceTimersByTimeAsync(30000);
    expect(await worker.sweepPendingOutbox()).toBe(0);
    expect(await worker.sweepStaleLeases()).toBe(0);
    expect(query).toHaveBeenCalledTimes(queryCount);
  });

  it('waits for an active lease-recovery query before closing', async () => {
    const release = deferred();
    const { worker, query } = fixture([], release.promise);
    worker.onModuleInit();
    let closed = false;
    const closing = Promise.resolve(worker.onModuleDestroy()).then(() => { closed = true; });
    try {
      await Promise.resolve();
      expect(closed).toBe(false);
    } finally {
      release.resolve();
      await closing;
    }
    const queryCount = query.mock.calls.length;
    await jest.advanceTimersByTimeAsync(30000);
    expect(query).toHaveBeenCalledTimes(queryCount);
  });
});
