# Zerops x NestJS Showcase API

<!-- #ZEROPS_EXTRACT_START:intro# -->
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
zerops:
  - setup: prod
    build:
      base: nodejs@22
      buildCommands:
        - npm ci
        - npm run build
        - npm prune --omit=dev
      deployFiles:
        - ./dist
        - ./node_modules
        - ./package.json
      cache:
        - node_modules
    deploy:
      readinessCheck:
        httpGet:
          port: 3000
          path: /api/health
    run:
      base: nodejs@22
      initCommands:
        - zsc execOnce ${appVersionId}-migrate --retryUntilSuccessful -- node dist/scripts/migrate.js
        - zsc execOnce ${appVersionId}-seed --retryUntilSuccessful -- node dist/scripts/seed.js
      ports:
        - port: 3000
          httpSupport: true
      envVariables:
        NODE_ENV: production
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
        SEARCH_PUBLIC_KEY: ${search_defaultSearchKey}
      start: node dist/main.js
      healthCheck:
        httpGet:
          port: 3000
          path: /api/health

  - setup: dev
    build:
      base: nodejs@22
      buildCommands:
        - npm install
      deployFiles: ./
      cache:
        - node_modules
    run:
      base: nodejs@22
      os: ubuntu
      ports:
        - port: 3000
          httpSupport: true
      envVariables:
        NODE_ENV: development
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
        SEARCH_PUBLIC_KEY: ${search_defaultSearchKey}
      initCommands:
        - zsc execOnce ${appVersionId}-migrate --retryUntilSuccessful -- npx ts-node src/scripts/migrate.ts
        - zsc execOnce ${appVersionId}-seed --retryUntilSuccessful -- npx ts-node src/scripts/seed.ts
      start: zsc noop --silent
```
<!-- #ZEROPS_EXTRACT_END:integration-guide# -->

<!-- #ZEROPS_EXTRACT_START:knowledge-base# -->

### Gotchas

<!-- #ZEROPS_EXTRACT_END:knowledge-base# -->
