import { randomUUID } from 'node:crypto';
import { Queue, QueueEvents } from 'bullmq';
import { withDeadline } from '../common/deadline';
import type { Environment } from '../modules/config/environment';
import { HEALTH_JOB, SYSTEM_QUEUE } from './system-queue';
import type { HealthProbe, HealthResult } from './system-queue';

export async function probeWorker(environment: Environment): Promise<HealthResult> {
  if (!environment.redisUrl) throw new Error('Worker Redis configuration is missing');
  const options = {
    connection: {
      url: environment.redisUrl,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      connectTimeout: 2000,
    },
    prefix: environment.queuePrefix,
  };
  const queue = new Queue<HealthProbe, HealthResult>(SYSTEM_QUEUE, options);
  const events = new QueueEvents(SYSTEM_QUEUE, {
    ...options,
    connection: { ...options.connection, maxRetriesPerRequest: null },
  });
  // Errors are returned through readiness/deadline promises, without unhandled emitters.
  queue.on('error', () => undefined);
  events.on('error', () => undefined);
  try {
    await withDeadline(Promise.all([queue.waitUntilReady(), events.waitUntilReady()]), 2500);
    const probeId = randomUUID();
    const job = await withDeadline(queue.add(HEALTH_JOB, { probeId }, {
      jobId: probeId,
      attempts: 1,
      removeOnComplete: { age: 60, count: 100 },
      removeOnFail: { age: 3600, count: 20 },
    }), 2000);
    const result = await job.waitUntilFinished(events, 4000);
    if (result.probeId !== probeId || !result.instanceId) throw new Error('Invalid worker response');
    return result;
  } finally {
    await withDeadline(Promise.allSettled([events.close(), queue.close()]), 2000);
  }
}
