import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import type Redis from 'ioredis';
import { Observable, Subject, interval, map, merge } from 'rxjs';
import { RedisService } from '../redis/redis.service';
import { safeError } from './logging';

export interface RealtimeTelemetryEvent {
  type:
    | 'webhook.ingested'
    | 'delivery.attempt'
    | 'workflow.step'
    | 'workflow.completed'
    | 'dlq.routed'
    | 'ping';
  organizationId: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class EventStreamService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(EventStreamService.name);
  private subClient: Redis | null = null;
  private readonly eventSubject = new Subject<RealtimeTelemetryEvent>();
  private isSubscribed = false;

  constructor(private readonly redisService: RedisService) {}

  async onModuleInit(): Promise<void> {
    try {
      this.subClient = this.redisService.connection.duplicate({
        lazyConnect: true,
      });

      await this.subClient.connect();

      // Subscribe to all organization telemetry channels
      await this.subClient.psubscribe('relayforge:org:*:events');
      this.isSubscribed = true;

      this.subClient.on('pmessage', (_pattern, channel, message) => {
        try {
          const parsed = JSON.parse(message) as RealtimeTelemetryEvent;
          this.eventSubject.next(parsed);
        } catch {
          // Ignore malformed messages
        }
      });

      this.logger.log({ event: 'event_stream_subscriber_ready' });
    } catch (err: unknown) {
      this.logger.warn({
        event: 'event_stream_subscriber_init_failed',
        error: safeError(err),
      });
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.subClient) {
      try {
        if (this.isSubscribed) {
          await this.subClient.punsubscribe('relayforge:org:*:events');
        }
        await this.subClient.quit();
      } catch {
        // Ignore on shutdown
      } finally {
        this.subClient.disconnect();
        this.subClient = null;
      }
    }
  }

  /**
   * Publishes an operational event to the organization's Redis pub/sub channel.
   * Both API and Worker processes can publish events.
   */
  async publishEvent(event: RealtimeTelemetryEvent): Promise<void> {
    try {
      const channel = `relayforge:org:${event.organizationId}:events`;
      await this.redisService.connection.publish(channel, JSON.stringify(event));
    } catch (err: unknown) {
      this.logger.error({
        event: 'publish_telemetry_event_error',
        orgId: event.organizationId,
        error: safeError(err),
      });
    }
  }

  /**
   * Creates an Observable SSE stream for a specific organization.
   * Merges matching tenant events with periodic 15-second keep-alive pings.
   */
  getStreamForOrganization(organizationId: string): Observable<MessageEvent> {
    // Filter subject for this tenant
    const orgEvents$ = new Observable<MessageEvent>((subscriber) => {
      const sub = this.eventSubject.subscribe({
        next: (ev) => {
          if (ev.organizationId === organizationId) {
            subscriber.next({
              data: ev,
              type: ev.type,
            });
          }
        },
        error: (err) => subscriber.error(err),
        complete: () => subscriber.complete(),
      });
      return () => sub.unsubscribe();
    });

    // 15-second heartbeat ping to prevent connection drops
    const keepAlive$ = interval(15000).pipe(
      map(
        (): MessageEvent => ({
          type: 'ping',
          data: {
            type: 'ping',
            organizationId,
            timestamp: new Date().toISOString(),
            payload: { status: 'connected' },
          },
        }),
      ),
    );

    return merge(orgEvents$, keepAlive$);
  }
}
