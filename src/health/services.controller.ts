import { Controller, Get, Inject } from '@nestjs/common';
import type { NatsConnection } from 'nats';
import type Redis from 'ioredis';
import type { MeiliSearch } from 'meilisearch';
import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { Pool } from 'pg';
import { PG_POOL } from '../db/db.module';
import { CACHE_CLIENT } from '../cache/cache.module';
import { BROKER_CLIENT } from '../broker/broker.module';
import { STORAGE_BUCKET, STORAGE_CLIENT } from '../storage/storage.module';
import { SEARCH_CLIENT } from '../search/search.module';

interface ServiceStatus {
  name: string;
  status: 'ok' | 'down';
  detail?: string;
}

@Controller('services')
export class ServicesController {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(CACHE_CLIENT) private readonly cache: Redis,
    @Inject(BROKER_CLIENT) private readonly broker: { nc: NatsConnection | null },
    @Inject(STORAGE_CLIENT) private readonly s3: S3Client,
    @Inject(STORAGE_BUCKET) private readonly bucket: string,
    @Inject(SEARCH_CLIENT) private readonly search: MeiliSearch,
  ) {}

  @Get('state')
  async state(): Promise<{ services: ServiceStatus[] }> {
    const services = await Promise.all([
      probe('api', async () => 'ok'),
      probe('db', async () => {
        await this.pool.query('SELECT 1');
        return 'ok';
      }),
      probe('cache', async () => {
        const reply = await this.cache.ping();
        return reply === 'PONG' ? 'ok' : `ping=${reply}`;
      }),
      probe('broker', async () => {
        if (!this.broker.nc) throw new Error('not connected');
        return this.broker.nc.isClosed() ? 'closed' : 'ok';
      }),
      probe('storage', async () => {
        await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
        return 'ok';
      }),
      probe('search', async () => {
        const h = await this.search.health();
        return h.status === 'available' ? 'ok' : h.status;
      }),
    ]);
    return { services };
  }
}

async function probe(
  name: string,
  fn: () => Promise<string>,
): Promise<ServiceStatus> {
  try {
    const detail = await fn();
    if (detail === 'ok') return { name, status: 'ok' };
    return { name, status: 'ok', detail };
  } catch (err) {
    return { name, status: 'down', detail: (err as Error).message };
  }
}
