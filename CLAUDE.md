<!-- #ZEROPS_EXTRACT_START:claude-md# -->

# api

NestJS 10 HTTP API (TypeScript) for the showcase. Exposes a global `/api`
prefix with REST endpoints for items CRUD, plus per-service demo and
state routes that wrap Postgres, Redis-compatible cache, NATS broker,
S3-compatible object storage, and Meilisearch search.

## Build & run

- `npm run build` — compile TypeScript via `nest build` into `dist/`.
- `npm run start` — run the compiled app: `node dist/main.js`.
- `npm run start:dev` — watch mode via `nest start --watch`.
- `npm run migrate` — apply schema (creates `items` table) using ts-node.
- `npm run migrate:prod` — same migration against compiled JS.
- `npm run seed` — seed demo rows via ts-node.
- `npm run seed:prod` — seed against compiled JS.

## Architecture

- `src/main.ts` — Nest bootstrap. Creates the app, sets `trust proxy`,
  enables CORS from `FRONTEND_URL` / `DEV_FRONTEND_URL` (exposing
  `X-Cache` + `X-Cache-Elapsed-Ms`), applies the `/api` global prefix,
  binds `0.0.0.0:PORT`, and wires SIGTERM/SIGINT drain via `app.close()`.
- `src/app.module.ts` — root module. Loads `ConfigModule` (no `.env`
  file) and imports `DbModule`, `CacheModule`, `BrokerModule`,
  `StorageModule`, `SearchModule`, `ItemsModule`. Registers
  `HealthController` and `ServicesController` at the root.
- `src/health/` — `health.controller.ts` returns `{status, uptime,
  timestamp}` at `GET /api/health`; `services.controller.ts` probes
  every backing client in parallel at `GET /api/services/state`.
- `src/items/` — items CRUD module. `items.controller.ts` handles
  `GET/POST/PATCH/DELETE /api/items[/:id]` with `ParseIntPipe` on `:id`
  and request validation inline; mutations fan out to
  `SearchIndexerService` for write-through indexing. `items.service.ts`
  owns the Postgres queries via the injected pool.
- `src/db/` — Postgres connection module. `db.module.ts` provides a `pg`
  `Pool` under `PG_POOL`; `db.tokens.ts` exports the DI token.
- `src/cache/` — Redis-compatible cache module. `cache.controller.ts`
  exposes `GET /api/cache/demo` (sets `X-Cache` HIT/MISS headers),
  `GET /api/cache/state`, and `POST /api/cache/reset`.
  `cache.service.ts` wraps `ioredis` and tracks hit/miss counters used
  by the SPA cache panel.
- `src/broker/` — NATS broker module. `broker.module.ts` hosts a
  `BrokerHolder` provider (`OnModuleInit`/`OnModuleDestroy`) that opens
  a single reconnecting `NatsConnection`. `queue.controller.ts`
  publishes JSON-encoded jobs on `showcase.jobs.<kind>` subjects via
  `POST /api/queue/publish` and reports recent jobs at
  `GET /api/queue/state`.
- `src/storage/` — S3-compatible object-storage module.
  `storage.controller.ts` accepts `POST /api/storage/upload` (hand-rolled
  multipart + raw octet-stream parsing, 5 MiB cap) and lists recent
  uploads at `GET /api/storage/state`. `storage.service.ts` wraps
  `@aws-sdk/client-s3` against the configured bucket.
- `src/search/` — Meilisearch search module (global).
  `search.controller.ts` serves `GET /api/search?q=&limit=` and
  `GET /api/search/state`. `search-indexer.service.ts` owns the `items`
  index, exposing `upsertOne` / `deleteOne` / `search` /
  `indexedCount`, invoked from the items controller after writes.
- `src/scripts/migrate.ts` — standalone `pg` Client script: creates the
  `items` table (`id`, `name`, `description`, `created_at`).
- `src/scripts/seed.ts` — standalone seed script for demo rows.
- `nest-cli.json` — Nest CLI config (`sourceRoot: src`, `deleteOutDir`).
- `tsconfig.json` / `tsconfig.build.json` — TypeScript compile config;
  build output goes to `dist/`.
<!-- #ZEROPS_EXTRACT_END:claude-md# -->
