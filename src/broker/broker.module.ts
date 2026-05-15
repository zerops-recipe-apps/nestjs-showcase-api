import { Global, Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { connect, NatsConnection } from 'nats';
import { QueueController } from './queue.controller';
import { BROKER_CLIENT } from './broker.tokens';

export { BROKER_CLIENT };

class BrokerHolder implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Broker');
  public nc: NatsConnection | null = null;

  async onModuleInit() {
    try {
      this.nc = await connect({
        servers: `${process.env.NATS_HOST}:${process.env.NATS_PORT}`,
        user: process.env.NATS_USER,
        pass: process.env.NATS_PASSWORD,
        name: 'api',
        reconnect: true,
        maxReconnectAttempts: -1,
      });
      this.logger.log(`Connected to NATS at ${process.env.NATS_HOST}:${process.env.NATS_PORT}`);
    } catch (err) {
      this.logger.error(`NATS connect failed: ${(err as Error).message}`);
      this.nc = null;
    }
  }

  async onModuleDestroy() {
    if (this.nc) {
      try {
        await this.nc.drain();
      } catch {
        /* ignore */
      }
    }
  }
}

@Global()
@Module({
  controllers: [QueueController],
  providers: [
    {
      provide: BROKER_CLIENT,
      useClass: BrokerHolder,
    },
  ],
  exports: [BROKER_CLIENT],
})
export class BrokerModule {}
