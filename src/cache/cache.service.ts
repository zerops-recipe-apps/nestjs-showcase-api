import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { CACHE_CLIENT } from './cache.tokens';

const HITS_KEY = 'showcase:cache:hits';
const MISSES_KEY = 'showcase:cache:misses';
const EVENTS_KEY = 'showcase:queue:events';
const EVENTS_PROCESSED_KEY = 'showcase:queue:processed';
const PAYLOAD_KEY = 'showcase:cache:payload';

const PAYLOAD_TTL_SECONDS = 60;

export interface CacheStats {
  hits: number;
  misses: number;
}

export interface QueueEvent {
  subject: string;
  payload: unknown;
  receivedAt: string;
}

export interface QueueStats {
  processed: number;
  events: QueueEvent[];
}

@Injectable()
export class CacheService {
  constructor(@Inject(CACHE_CLIENT) private readonly client: Redis) {}

  get redis(): Redis {
    return this.client;
  }

  async fetchDemoPayload(): Promise<{
    payload: { greeting: string; generatedAt: string; computedMs: number };
    cacheHit: boolean;
    elapsedMs: number;
  }> {
    const started = Date.now();
    const cached = await this.client.get(PAYLOAD_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as {
        greeting: string;
        generatedAt: string;
        computedMs: number;
      };
      await this.client.incr(HITS_KEY);
      return {
        payload: parsed,
        cacheHit: true,
        elapsedMs: Date.now() - started,
      };
    }
    // Simulate an expensive computation so the cache-miss path is
    // visibly slower than the cache-hit path even at LAN latency.
    const computeStart = Date.now();
    await sleep(120);
    const payload = {
      greeting: 'hello from postgres + valkey',
      generatedAt: new Date().toISOString(),
      computedMs: Date.now() - computeStart,
    };
    await this.client.set(
      PAYLOAD_KEY,
      JSON.stringify(payload),
      'EX',
      PAYLOAD_TTL_SECONDS,
    );
    await this.client.incr(MISSES_KEY);
    return {
      payload,
      cacheHit: false,
      elapsedMs: Date.now() - started,
    };
  }

  async stats(): Promise<CacheStats> {
    const [hits, misses] = await Promise.all([
      this.client.get(HITS_KEY),
      this.client.get(MISSES_KEY),
    ]);
    return {
      hits: parseIntOrZero(hits),
      misses: parseIntOrZero(misses),
    };
  }

  async resetDemo(): Promise<void> {
    await this.client.del(PAYLOAD_KEY, HITS_KEY, MISSES_KEY);
  }

  async queueStats(limit = 5): Promise<QueueStats> {
    const [processed, raw] = await Promise.all([
      this.client.get(EVENTS_PROCESSED_KEY),
      this.client.lrange(EVENTS_KEY, 0, limit - 1),
    ]);
    const events: QueueEvent[] = raw
      .map((entry) => {
        try {
          return JSON.parse(entry) as QueueEvent;
        } catch {
          return null;
        }
      })
      .filter((e): e is QueueEvent => e !== null);
    return {
      processed: parseIntOrZero(processed),
      events,
    };
  }
}

function parseIntOrZero(value: string | null): number {
  if (!value) return 0;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
