# Zerops x NestJS Showcase API

<!-- #ZEROPS_EXTRACT_START:intro# -->

NestJS REST API serving Items CRUD plus cache, queue, object-storage, and search demos backed by Postgres, Valkey, NATS, S3-compatible storage, and Meilisearch.
<!-- #ZEROPS_EXTRACT_END:intro# -->

![nestjs cover](https://github.com/zeropsio/recipe-shared-assets/blob/main/covers/svg/cover-nestjs.svg)

## Deploy to Zerops

Click the deploy button to deploy directly to Zerops.

[![Deploy on Zerops](https://github.com/zeropsio/recipe-shared-assets/blob/main/deploy-button/light/deploy-button.svg)](https://app.zerops.io/recipes/nestjs-showcase?environment=small-production)

## Integration Guide

<!-- #ZEROPS_EXTRACT_START:integration-guide# -->
### 1. Adding `zerops.yaml`

The main configuration file — place at repository root. It tells Zerops how to build, deploy and run your app. This one declares 2 setups (`dev`, `prod`), runs `initCommands` at boot (migrations, seed), and ships readiness + health checks.

```yaml
# Two setups for the api codebase:
# - prod: lean production runtime — compiled JS only, npm prune --omit=dev,
#   readiness gate, rolling-deploy headroom.
# - dev: same wiring on a writable Ubuntu container; the porter SSHs in and
#   runs `npm run start:dev` against the SSHFS-mounted source tree.
zerops:
  - setup: prod
    build:
      # nodejs@22 matches run.base so the compiled dist/ is emitted
      # against the same Node major it runs against.
      base: nodejs@22
      buildCommands:
        # `npm ci` for reproducible, lockfile-pinned installs; `nest build`
        # emits the compiled bundle to `dist/`; `npm prune --omit=dev` strips
        # devDependencies so the runtime container ships only what `node
        # dist/main.js` needs.
        - npm ci
        - npm run build
        - npm prune --omit=dev
      # Narrow deploy set — source TypeScript, tests, and dev tooling
      # don't ship to prod. Anything not listed here is dropped from the
      # runtime filesystem.
      deployFiles:
        - ./dist
        - ./node_modules
        - ./package.json
      # node_modules survives between builds — subsequent deploys skip
      # re-downloading packages that the lockfile hasn't moved.
      cache:
        - node_modules
    deploy:
      # Holds the L7 balancer from routing to the new container until it
      # answers HTTP 200 — prevents 502s during the bootstrap window when
      # Nest is still wiring modules and connecting to managed services.
      # `/api/health` only checks process responsiveness; it does NOT fan
      # out to db/cache/broker, so a managed-service blip doesn't cascade
      # into health-driven restarts.
      readinessCheck:
        httpGet:
          port: 3000
          path: /api/health
    run:
      base: nodejs@22
      # Migrate and seed each gate on `zsc execOnce` with a per-deploy key
      # (`${appVersionId}` resolves to a fresh string every deploy), so
      # each script runs exactly once per deploy across all replicas.
      # `--retryUntilSuccessful` rides out the brief window where Postgres
      # isn't yet accepting connections. Splitting migrate and seed into
      # two keys means a failed seed doesn't burn the migrate key — the
      # next deploy retries the seed but already-applied schema is skipped.
      initCommands:
        - zsc execOnce ${appVersionId}-migrate --retryUntilSuccessful -- node dist/scripts/migrate.js
        - zsc execOnce ${appVersionId}-seed --retryUntilSuccessful -- node dist/scripts/seed.js
      # Port 3000 matches Nest's default and matches `PORT` below.
      # `httpSupport: true` publishes the port to the L7 balancer so the
      # platform mints the zerops.app subdomain on first deploy — without
      # it the api is only reachable on the project network with no public
      # URL and no automatic HTTPS.
      ports:
        - port: 3000
          httpSupport: true
      # Cross-service aliases renamed under your own stable keys — the
      # application code reads `DB_HOST`, `CACHE_HOST`, `NATS_HOST`, etc.
      # rather than the platform-side `${db_hostname}` names. Swapping a
      # managed service later is a one-line yaml edit, no app rebuild.
      # Pick own-key names DIFFERENT from the platform side; declaring
      # `db_hostname: ${db_hostname}` would self-shadow — the literal
      # token wins and `process.env.db_hostname` becomes the string
      # "${db_hostname}".
      # `APP_SECRET`, `FRONTEND_URL`, and `DEV_FRONTEND_URL` are project-
      # level envs and auto-propagate to every container, so they aren't
      # repeated here. Same pattern across the dev setup below.
      envVariables:
        PORT: 3000
        DB_HOST: ${db_hostname}
        DB_PORT: ${db_port}
        DB_USER: ${db_user}
        DB_PASSWORD: ${db_password}
        DB_NAME: ${db_dbName}
        # Valkey on Zerops is unauthenticated; only host + port are
        # injected. Referencing `${cache_user}` or `${cache_password}`
        # would resolve to literal token strings — ioredis would then
        # send garbage `AUTH` on every command.
        CACHE_HOST: ${cache_hostname}
        CACHE_PORT: ${cache_port}
        # NATS Pattern A — host, port, user, pass as separate alias keys.
        # The connection-string alternative double-authenticates (URL
        # credentials + SASL) and the broker rejects the first CONNECT
        # frame with `Authorization Violation`.
        NATS_HOST: ${broker_hostname}
        NATS_PORT: ${broker_port}
        NATS_USER: ${broker_user}
        NATS_PASSWORD: ${broker_password}
        # `${storage_apiUrl}` already carries the `https://` scheme; do
        # NOT compose `http://${storage_apiHost}` — the gateway 301-
        # redirects to https and S3 SDKs don't follow that redirect.
        # `S3_REGION` is inert on the MinIO backend but every S3 SDK
        # demands the field; `us-east-1` is the conventional placeholder.
        S3_ENDPOINT: ${storage_apiUrl}
        S3_BUCKET: ${storage_bucketName}
        S3_REGION: us-east-1
        S3_ACCESS_KEY_ID: ${storage_accessKeyId}
        S3_SECRET_ACCESS_KEY: ${storage_secretAccessKey}
        # `SEARCH_MASTER_KEY` administers indexes — create, delete,
        # document upsert. Never expose it to a browser bundle; any
        # client-side search UI should read `${search_defaultSearchKey}`
        # instead (search-only, safe to ship).
        SEARCH_URL: ${search_connectionString}
        SEARCH_MASTER_KEY: ${search_masterKey}
      # Plain Node executing the compiled bootstrap — works with the
      # pruned production node_modules. Anything heavier (ts-node, nest
      # CLI) is dev-only because it requires devDependencies the build's
      # `npm prune --omit=dev` stripped.
      start: node dist/main.js
      # Long-lived liveness probe pointed at the same endpoint as
      # readiness. A hung process triggers a restart instead of serving
      # errors indefinitely. Same shallow check — no fan-out to managed
      # services, so a downstream blip doesn't restart the api.
      healthCheck:
        httpGet:
          port: 3000
          path: /api/health

  - setup: dev
    build:
      base: nodejs@22
      buildCommands:
        # `npm install` (not `npm ci`) because the dev workflow tolerates
        # lockfile drift while iterating on dependencies.
        - npm install
      # Self-deploy the entire working tree — narrowing this to a
      # `[dist, package.json]` list would wipe the source on the next dev
      # redeploy. Zerops replaces the deployed filesystem with only the
      # listed paths, and the porter's edits live in the rest of the repo.
      deployFiles: ./
      cache:
        - node_modules
    run:
      base: nodejs@22
      # Ubuntu base — gives the porter the standard CLI toolset (apt,
      # git, etc.) when they SSH in to iterate on the source tree.
      os: ubuntu
      ports:
        - port: 3000
          httpSupport: true
      # Same service wiring as prod — only the runtime style differs.
      # If you swap a managed service later, the prod block above needs
      # the matching edit.
      envVariables:
        PORT: 3000
        DB_HOST: ${db_hostname}
        DB_PORT: ${db_port}
        DB_USER: ${db_user}
        DB_PASSWORD: ${db_password}
        DB_NAME: ${db_dbName}
        CACHE_HOST: ${cache_hostname}
        CACHE_PORT: ${cache_port}
        NATS_HOST: ${broker_hostname}
        NATS_PORT: ${broker_port}
        NATS_USER: ${broker_user}
        NATS_PASSWORD: ${broker_password}
        S3_ENDPOINT: ${storage_apiUrl}
        S3_BUCKET: ${storage_bucketName}
        S3_REGION: us-east-1
        S3_ACCESS_KEY_ID: ${storage_accessKeyId}
        S3_SECRET_ACCESS_KEY: ${storage_secretAccessKey}
        SEARCH_URL: ${search_connectionString}
        SEARCH_MASTER_KEY: ${search_masterKey}
      # Dev runs migrations/seeds through `ts-node` against the source
      # tree so the porter doesn't have to compile before the first
      # deploy. Same `execOnce` semantics apply — per-deploy keys,
      # idempotent retries.
      initCommands:
        - zsc execOnce ${appVersionId}-migrate --retryUntilSuccessful -- npx ts-node src/scripts/migrate.ts
        - zsc execOnce ${appVersionId}-seed --retryUntilSuccessful -- npx ts-node src/scripts/seed.ts
      # `zsc noop --silent` keeps the container alive without binding
      # the runtime to a foreground process — the dev container is a
      # remote-development workspace. SSH in and run `npm run start:dev`
      # (Nest's watcher) by hand; source edits over SSHFS rebuild in
      # place, no redeploy.
      start: zsc noop --silent
```

### 2. Bind `0.0.0.0` so the L7 balancer can reach the listener

NestJS's `app.listen(port)` binds `127.0.0.1` by default — fine on a laptop, unreachable on Zerops because the L7 balancer routes from the public subdomain into the container's VXLAN IP. Without an explicit host the platform returns 502 even when [`zerops.yaml`](zerops.yaml) exposes the port with `httpSupport: true`. Pass `'0.0.0.0'` as the second argument and read `PORT` from env so the listener stays in sync with `run.ports[].port`.

```ts
const port = parseInt(process.env.PORT ?? '3000', 10);
await app.listen(port, '0.0.0.0');
```

### 3. Trust the reverse proxy

Zerops terminates TLS at the L7 balancer and forwards traffic via reverse proxy with `X-Forwarded-*` headers. Without telling Express to trust those headers, `req.ip` reports the balancer's IP (breaking rate-limiting and audit logging) and `req.protocol` reports `http` (breaking any redirect that composes its own absolute URL).

NestJS uses Express under the hood, so the canonical config reaches the underlying instance and flips `trust proxy` at bootstrap.

```ts
const expressApp = app.getHttpAdapter().getInstance();
expressApp.set('trust proxy', true);
```

### 4. Drain on `SIGTERM` for rolling deploys

Zerops's rolling deploy stops the old container by sending `SIGTERM`. Without an explicit handler the Node process exits immediately, in-flight HTTP requests get a TCP RST, and pending DB / NATS work aborts mid-call. Wire `SIGTERM` (and `SIGINT` for parity) to `app.close()` so Nest drains the HTTP server, lifecycle hooks shut down providers (pg pool, NATS connection), then the process exits cleanly.

```ts
const shutdown = async (signal: string) => {
  try { await app.close(); } catch (err) { /* log */ }
  process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

Pair with `deploy.readinessCheck` in [`zerops.yaml`](zerops.yaml) so the L7 balancer routes traffic to the new container only after it answers HTTP 200 — together they unlock [zero-downtime deploys with multi-container setups](https://docs.zerops.io/features/scaling-ha).

### 5. Alias platform env vars under your own keys

Zerops auto-injects cross-service references as `${db_hostname}`, `${broker_port}`, `${storage_apiUrl}`, etc. — platform-specific names you don't want hard-coded in application code. Re-export each one under your own stable key in [`zerops.yaml`](zerops.yaml) `run.envVariables`, and have the app read only the own-key names. Swapping a managed service later becomes a yaml-only edit.

```yaml
envVariables:
  DB_HOST: ${db_hostname}
  DB_PORT: ${db_port}
  NATS_HOST: ${broker_hostname}
  NATS_PASSWORD: ${broker_password}
  S3_ENDPOINT: ${storage_apiUrl}
  SEARCH_URL: ${search_connectionString}
```

Pick own-key names DIFFERENT from the platform side. Declaring `db_hostname: ${db_hostname}` self-shadows — the per-service `envVariables` write runs after the auto-inject, the literal `${db_hostname}` token wins, and the OS env var becomes the string `"${db_hostname}"`. The same trap fires for project-level secrets (`APP_SECRET: ${APP_SECRET}`) — those already auto-propagate to every container, so re-declaring them under the same name is never necessary. The [per-key env shape and cross-service aliases](https://docs.zerops.io/zerops-yaml/specification#envvariables-) reference covers the full model.
<!-- #ZEROPS_EXTRACT_END:integration-guide# -->

<!-- #ZEROPS_EXTRACT_START:knowledge-base# -->

### No `.env` file in the deployed tree

Zerops injects every cross-service alias (`DB_*`, `NATS_*`, `S3_*`, `SEARCH_*`, `CACHE_*`) and every project-level secret directly as OS env vars. NestJS's `ConfigModule.forRoot()` defaults to reading `.env` from the working directory and merging keys into `process.env` — if a committed (or build-time generated) `.env` ships empty placeholder values, those values overwrite the platform-injected ones inside the running container. The symptom is silent connection failures: Postgres `getaddrinfo ENOTFOUND ${db_hostname}` or NATS `Invalid URL`. Pass `ignoreEnvFile: true` to disable dotenv loading entirely.

### Custom response headers return `undefined` from the SPA but show up in `curl`

Browsers hide every non-CORS-safelisted response header from cross-origin JS unless the server lists them in the `Access-Control-Expose-Headers` response. `curl` ignores the directive, so a header that prints fine from a shell call returns `null` when the SPA reads `fetch().headers.get('X-Cache')`. The api + spa pair runs on different Zerops subdomains by default, so every fetch IS cross-origin — enumerate every custom header you want the browser to read:

```ts
app.enableCors({
  origin: allowedOrigins,
  credentials: true,
  exposedHeaders: ['X-Cache', 'X-Cache-Elapsed-Ms'],
});
```

### `ListObjectsV2` returns oldest-first, not newest-first

S3-compatible APIs sort results in lexicographic key order, not by recency. With timestamp-prefixed keys (`uploads/<epochMs>-<filename>`) the order is monotonic numeric — but that means the freshest upload lands at the BOTTOM of a paginated response. If the UI contract is newest-first, sort by `LastModified` DESC server-side AFTER the list call and before slicing the top N. Without this sort, every successful upload appears at the bottom of a chip-list and dashboards read yesterday's file as "the latest one".
<!-- #ZEROPS_EXTRACT_END:knowledge-base# -->
