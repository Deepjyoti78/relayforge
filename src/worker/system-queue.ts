import { z } from 'zod';

// Operational probes only. Business events will enter through a transactional outbox.
export const SYSTEM_QUEUE = 'system';
export const HEALTH_JOB = 'health.ping';
export const healthProbeSchema = z.object({ probeId: z.uuid() }).strict();
export type HealthProbe = z.infer<typeof healthProbeSchema>;
export interface HealthResult {
  probeId: string;
  instanceId: string;
  version: string;
}
