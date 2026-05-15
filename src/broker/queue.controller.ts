import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JSONCodec, NatsConnection } from 'nats';
import { BROKER_CLIENT } from './broker.tokens';
import { CacheService } from '../cache/cache.service';

interface PublishBody {
  kind?: unknown;
  payload?: unknown;
  message?: unknown;
}

@Controller('queue')
export class QueueController {
  constructor(
    @Inject(BROKER_CLIENT) private readonly broker: { nc: NatsConnection | null },
    private readonly cache: CacheService,
  ) {}

  @Post('publish')
  async publish(@Body() body: PublishBody) {
    if (!this.broker.nc) {
      throw new ServiceUnavailableException('Broker connection not established');
    }
    const kind = typeof body.kind === 'string' && body.kind ? body.kind : 'sample';
    const message =
      typeof body.message === 'string'
        ? body.message
        : `Job triggered at ${new Date().toISOString()}`;
    const payload =
      body.payload && typeof body.payload === 'object'
        ? (body.payload as Record<string, unknown>)
        : { message };
    if (!kind.match(/^[a-z0-9-]+$/i)) {
      throw new BadRequestException('kind must match /^[a-z0-9-]+$/i');
    }
    const subject = `showcase.jobs.${kind}`;
    const codec = JSONCodec();
    const envelope = {
      kind,
      payload,
      issuedAt: new Date().toISOString(),
    };
    this.broker.nc.publish(subject, codec.encode(envelope));
    await this.broker.nc.flush();
    return { ok: true, subject, envelope };
  }

  @Get('state')
  async state() {
    return this.cache.queueStats(5);
  }
}
