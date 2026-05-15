import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { CacheController } from './cache.controller';
import { CacheService } from './cache.service';
import { CACHE_CLIENT } from './cache.tokens';

export { CACHE_CLIENT };

@Global()
@Module({
  controllers: [CacheController],
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
    CacheService,
  ],
  exports: [CACHE_CLIENT, CacheService],
})
export class CacheModule {}
