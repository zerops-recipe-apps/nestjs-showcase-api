import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  // Trust X-Forwarded-* headers — Zerops's L7 balancer terminates SSL and
  // forwards via reverse proxy; without this Express misreports req.ip and
  // req.protocol.
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', true);

  // CORS allow-list from project envs (dev + stage frontend slots).
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.DEV_FRONTEND_URL,
  ].filter((s): s is string => Boolean(s));
  app.enableCors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    credentials: true,
    // Custom response headers must be enumerated in exposedHeaders for
    // cross-origin JS to read them. Browsers hide every non-CORS-
    // safelisted header by default; curl ignores this list, but the
    // SPA's cache panel needs X-Cache + X-Cache-Elapsed-Ms to decide
    // hit-vs-miss styling.
    exposedHeaders: ['X-Cache', 'X-Cache-Elapsed-Ms'],
  });

  app.setGlobalPrefix('api');

  const port = parseInt(process.env.PORT ?? '3000', 10);
  // Bind 0.0.0.0 explicitly — Nest defaults to 127.0.0.1 which is unreachable
  // from the L7 balancer's VXLAN route into the container.
  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`API listening on 0.0.0.0:${port}`);

  // SIGTERM drain — accept the signal, stop accepting new connections, exit
  // cleanly so rolling deploys don't drop in-flight requests.
  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}, draining…`);
    try {
      await app.close();
    } catch (err) {
      logger.error(`Shutdown error: ${(err as Error).message}`);
    }
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Bootstrap failure', err);
  process.exit(1);
});
