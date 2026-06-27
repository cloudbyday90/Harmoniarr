# Docker Schema Generation Design

Status: Implemented
Last updated: 2026-06-27
Owner: App architecture + release validation

## Purpose

Schema generation and database-backed schema validation now use disposable Docker
PostgreSQL instances instead of an ambient local database.

The prior scripts could validate the rendered migration snapshot quickly, but
database-backed commands still depended on whatever `PG*` environment happened
to exist on the developer machine. In practice this failed when credentials were
missing or malformed, and it made schema drift checks depend on mutable local
state instead of a clean migration replay.

## Official Source Review

Reviewed official sources as of June 2026:

- Testcontainers for Node.js PostgreSQL module:
  `https://node.testcontainers.org/modules/postgresql/`
- Testcontainers for Node.js container lifecycle and runtime behavior:
  `https://node.testcontainers.org/features/containers/`
- Docker CLI container run reference, including ephemeral container cleanup
  behavior such as `--rm`:
  `https://docs.docker.com/reference/cli/docker/container/run/`
- PostgreSQL `pg_dump` reference, including schema-only dumps:
  `https://www.postgresql.org/docs/current/app-pgdump.html`
- Docker Official PostgreSQL image reference:
  `https://hub.docker.com/_/postgres`

## Recommendation

Use Testcontainers-managed PostgreSQL for every database-backed schema command:

- `npm run update:schema-snapshot`
- `npm run db:dump-schema`
- `npm run validate:schema-bootstrap`
- `npm run db:check-schema`

Keep `npm run check:schema-snapshot` as a fast, no-Docker text check because it
only compares the deterministic migration-rendered snapshot with the committed
file.

## Options Considered

### Ambient Local PostgreSQL

Pros:

- fastest when a developer already has the right database available
- no container runtime required

Cons:

- depends on mutable local credentials and database contents
- can pass against stale or manually modified schemas
- failed in this repo when `PGPASSWORD` was not a valid string
- poor fit for release evidence because the database provenance is unclear

Decision: rejected for database-backed schema generation and validation.

### Docker Compose PostgreSQL Service

Pros:

- explicit service image and volume behavior
- close to deployed topology

Cons:

- heavier lifecycle for one-shot schema checks
- needs project-level service naming and cleanup coordination
- easier to accidentally reuse a persistent volume

Decision: keep for deployment smoke validation, not one-shot schema checks.

### Testcontainers PostgreSQL

Pros:

- creates a fresh PostgreSQL instance per schema command
- binds random local ports and avoids hardcoded credentials
- owns startup waiting and cleanup lifecycle in test/script code
- works with the existing ESM Node script and test infrastructure
- supports image override through `HARMONIARR_SCHEMA_POSTGRES_IMAGE`

Cons:

- requires Docker or a compatible local container runtime
- first run may pull the PostgreSQL image
- slower than the text-only snapshot check

Decision: selected.

### Replace Snapshot With Raw `pg_dump`

Pros:

- PostgreSQL-native schema serialization
- useful for ad hoc inspection and external comparison

Cons:

- current snapshot intentionally includes migration replay metadata and
  checksum evidence, not just physical DDL
- raw dumps can include version-specific ordering or formatting noise
- would not by itself prove the committed bootstrap snapshot applies cleanly

Decision: defer. Keep the current deterministic migration snapshot and use
Docker-backed databases to prove it.

## Final Stack

- `testing/postgres-docker-database.js` owns disposable PostgreSQL creation,
  environment projection, `pg.Pool` construction, and `finally` cleanup.
- `scripts/schema-snapshot.js` prepares a Docker source database, applies all
  pending migrations, asserts migration state is current, and then writes or
  validates the committed snapshot.
- `scripts/schema-bootstrap-validation.js` boots the committed snapshot into a
  fresh Docker PostgreSQL database by default.
- `scripts/schema-anchor-validation.js` compares critical anchors between a
  migrated Docker source database and a freshly bootstrapped snapshot database.
- `src/server/migrations.js` accepts injected `getPoolFn` functions so scripts
  can run migration logic against Docker-managed pools without mutating global
  process database configuration.

Default image:

```text
postgres:18-alpine
```

Override:

```powershell
$env:HARMONIARR_SCHEMA_POSTGRES_IMAGE='postgres:18-alpine'
npm run db:check-schema
```

## Security And Reliability Notes

- Container credentials are generated for the temporary schema database only and
  are not read from app production secrets.
- The helper always closes the `pg.Pool` and stops the container in `finally`.
- The scripts do not mount application media or backup volumes into the schema
  container.
- Migration execution still uses the same production migration runner, so schema
  validation exercises the real migration path.
- Snapshot bootstrap and anchor comparison run against clean databases, which
  catches missing migration rows, stale checksums, and accidental snapshot drift.

## Validation

Focused validation completed:

```text
node --test test/scripts/postgres-docker-database.test.js test/scripts/schema-snapshot.test.js test/scripts/schema-bootstrap-validation.test.js test/scripts/schema-anchor-validation.test.js
npm run lint:scripts
npm run validate:schema-bootstrap
npm run db:check-schema
npm run update:schema-snapshot
```

Live Docker results:

- `validate:schema-bootstrap`: 80 of 80 migrations applied from the committed
  snapshot.
- `db:check-schema`: Docker source database current, committed snapshot current,
  fresh snapshot bootstrap valid, and 77 critical anchors matched.
- `update:schema-snapshot`: regenerated the committed snapshot from 80
  migrations and captured the pending Artist Policy activity-event migration.

## Outcome

Schema generation is now Docker-backed for the database paths that need real
PostgreSQL behavior. The fast no-Docker snapshot comparison remains available
for cheap local and CI checks, while release-grade schema validation now has a
fresh, disposable PostgreSQL source of truth.
