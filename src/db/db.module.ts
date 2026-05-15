import { Global, Module } from '@nestjs/common';
import { Pool } from 'pg';

export const PG_POOL = 'PG_POOL';

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: (): Pool => {
        const pool = new Pool({
          host: process.env.DB_HOST,
          port: parseInt(process.env.DB_PORT ?? '5432', 10),
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
          max: 10,
          idleTimeoutMillis: 30_000,
        });
        pool.on('error', (err) => {
          // eslint-disable-next-line no-console
          console.error('Postgres pool error', err);
        });
        return pool;
      },
    },
  ],
  exports: [PG_POOL],
})
export class DbModule {}
