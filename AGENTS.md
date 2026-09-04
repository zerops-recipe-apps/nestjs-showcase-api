# nestjs-showcase-api

NestJS 12 HTTP API for the showcase recipe. Exposes a global `/api` prefix with REST endpoints for items CRUD plus per-service demo routes for Postgres, Valkey cache, NATS, S3-compatible storage, and Meilisearch.

## Zerops service facts

- HTTP port: `3000`
- Siblings: `db`, `cache`, `broker`, `storage`, `search` — env aliases: `DB_*`, `CACHE_*`, `NATS_*`, `S3_*`, `SEARCH_*`
- Runtime base: `nodejs@22`

## Zerops dev

`setup: dev` idles on `zsc noop --silent`; the agent starts the dev server.

- Dev command: `npm run start:dev`
- In-container rebuild without deploy: `npm run build`

**All platform operations (start/stop/status/logs of the dev server, deploy, env / scaling / storage / domains) go through the Zerops development workflow via `zcp` MCP tools. Don't shell out to `zcli`.**

## Notes

- Prod build: `npm ci`, `npm run build`, `npm prune --omit=dev`.
- Migrations and seed run via `zsc execOnce ${appVersionId}-migrate` / `-seed` before `start`.
- `GET /api/health` is the readiness and health endpoint — shallow check, no downstream fan-out.
- Never create `.env` files — Zerops injects env vars at the OS level.
