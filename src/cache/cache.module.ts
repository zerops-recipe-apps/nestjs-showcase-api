import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';

export const CACHE_CLIENT = 'CACHE_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: CACHE_CLIENT,
      useFactory: (): Redis => {
        const client = new Redis({
          host: process.env.CACHE_HOST,
          port: parseInt(process.env.CACHE_PORT ?? '6379', 10),
          lazyConnect: false,
          maxRetriesPerRequest: 3,
        });
        client.on('error', (err) => {
          // eslint-disable-next-line no-console
          console.error('Valkey client error', err.message);
        });
        return client;
      },
    },
  ],
  exports: [CACHE_CLIENT],
})
export class CacheModule {}
