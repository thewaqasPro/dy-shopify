# Dokploy deployment

## Recommended service shape

Use the included `docker-compose.yml`. It starts four services:

- `web`: Next.js admin UI and API routes
- `worker`: BullMQ sync worker
- `postgres`: relational state and audit logs
- `redis`: queue backend

## Deployment steps

1. Create a Dokploy Compose app.
2. Point it to this repository.
3. Copy `.env.example` into Dokploy environment variables.
4. Replace every secret value.
5. Set your public domain to the `web` service port `3000`.
6. Deploy.
7. Visit `/settings` to confirm runtime configuration.
8. Run a dry-run first.
9. Inspect `/runs/{id}` and `/products`.
10. Run a live sync only after the dry-run counts make sense.

## Backups

Back up the `postgres_data` volume. Redis is useful for queue persistence, but the important historical state is in PostgreSQL.

## Scaling

You can scale `worker` replicas if the Shopify rate limit and Boss Logics endpoint tolerate it. Keep `SYNC_CONCURRENCY` conservative at first.
