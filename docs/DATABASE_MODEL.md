# Harmoniarr Database Model

## Purpose

This document defines the initial PostgreSQL data model for Harmoniarr.

It is a planning baseline. Column names, constraints, and indexes should be refined during implementation, but this should be the default shape unless implementation discoveries require changes.

## Design Principles

### Surrogate Keys

Use surrogate keys for primary keys wherever possible.

Default rule:

```sql
id uuid primary key
```

Natural identifiers should not be primary keys. MusicBrainz IDs, slskd IDs, Soulseek usernames, paths, and provider IDs should be stored as ordinary columns with unique indexes where appropriate.

Reasons:

- Provider identifiers can merge, redirect, disappear, or be corrected.
- Some rows are local workflow concepts with no natural external ID.
- Foreign keys stay stable even when provider metadata changes.
- Manual overrides and historical events can preserve old external identifiers without breaking relationships.

Preferred ID strategy:

- UUIDv7 for new rows.
- Prefer application-generated UUIDv7 if the app has a stable library.
- PostgreSQL 18's built-in `uuidv7()` is acceptable as a database default for tables where database-side ID generation is simpler.
- If UUIDv7 is not adopted immediately, ordinary UUIDs are acceptable as an implementation fallback.
- Do not require a non-core PostgreSQL extension only to generate IDs.

Natural key examples:

```text
metadata_artists.musicbrainz_artist_id
metadata_release_groups.musicbrainz_release_group_id
metadata_releases.musicbrainz_release_id
metadata_recordings.musicbrainz_recording_id
soulseek_users.username
library_files.canonical_path
```

These should receive unique indexes where the business rules require uniqueness, but foreign keys should reference the local surrogate `id`.

### PostgreSQL 18 Features To Use

PostgreSQL 18 should be treated as the initial target. Use its new features where they make the schema more reliable or easier to operate.

Recommended early usage:

- Use native `uuidv7()` when database-generated surrogate IDs are useful. UUIDv7 keeps UUID semantics while improving index locality compared with fully random UUIDs.
- Keep PostgreSQL 18's default data checksums enabled for new clusters. This helps detect storage corruption that would otherwise be silent.
- Use `pg_stat_statements` for query observability. It requires `shared_preload_libraries` and a server restart, so it must be configured by the entrypoint before Postgres starts.
- Use richer `EXPLAIN ANALYZE` output during performance work, especially buffer, WAL, and read statistics.
- Use BRIN indexes for large append-mostly event tables keyed by time, such as audit, worker events, provider request logs, transfer events, and search result snapshots.
- Use `pg_trgm` for fuzzy artist, album, track, filename, and folder matching once matching queries are implemented.

Useful but should wait for real query pressure:

- Tune PostgreSQL 18 asynchronous I/O through `io_method`, `io_workers`, and `io_max_concurrency` only after testing on the target Docker/Alpine runtime.
- Let PostgreSQL 18's skip-scan improvements help multi-column B-tree indexes, but still design indexes around known query predicates.
- Use virtual generated columns for cheap derived values that are read often and do not need storage. Use stored generated columns only when indexing, replication, or repeated compute cost justifies storage.
- Consider temporal constraints later for time-bound uniqueness, such as non-overlapping active policy windows or source-user trust periods.

Avoid for v1 unless a clear need appears:

- OAuth database authentication. Harmoniarr's embedded database should not be exposed as a user-facing service.
- Required `pgvector`. Keep vector search optional until an embeddings feature exists.
- Database-level row-level security as the first authorization boundary. The API should enforce authorization; database RLS can be revisited for multi-user hardening later.

### PostgreSQL Runtime Isolation

Harmoniarr should follow the Classifarr embedded database pattern:

- The standard container exposes only the Harmoniarr HTTP port.
- PostgreSQL port `5432` is not published to the host.
- PostgreSQL listens on loopback and a Unix socket inside the container.
- The application connects from inside the same container.
- If Harmoniarr ever splits Postgres into a sidecar service, that service should use Docker-internal networking only and must not publish `5432` through `ports`.
- The database directory lives under the mounted app data volume.
- The database cluster directory is owned by the runtime app UID/GID and should be `0700` inside the container.
- The socket directory should be owned by the runtime app UID/GID and should be group-scoped, for example `0770`.
- The container should run the app and Postgres as a non-root runtime user after entrypoint setup.
- The compose file should use an internal Docker network and should not define a separate published database service for the default deployment.

Local Classifarr observations from the current machine:

- `docker-compose.yml` publishes only `21324:21324` for the web app.
- The running container has port bindings only for `21324/tcp`.
- No host binding exists for `5432`.
- Inside the container, Postgres listens on `127.0.0.1:5432` and `::1:5432`.
- `/app/data/postgres` is owned by `classifarr:classifarr` with `drwx------` permissions.
- `/run/postgresql` and `/var/run/postgresql` are owned by `classifarr:classifarr` with `drwxrwx---` permissions.
- The running process identity is `uid=1000(classifarr) gid=1000(classifarr)`.

Harmoniarr should copy the security shape, but update the data directory layout for PostgreSQL 18:

```text
/app/data/postgres/18/data
```

The parent `/app/data/postgres` may exist for version routing, backups, and future major-version upgrade staging, but the live cluster directory should be version-specific.

### Database Defensibility

The database should be defensible by default, especially because users will usually not connect to it directly.

Startup guards:

- Refuse to start if the on-disk `PG_VERSION` does not match the packaged PostgreSQL major version.
- Refuse to start if the data directory is writable by broad users inside the container.
- Refuse to start if the database port is configured to listen on non-loopback addresses in the default deployment.
- Report checksum state, server version, data directory version, extension availability, and migration status in startup logs and the authenticated system health UI.
- Check that required extensions are installed and active. `pg_stat_statements` needs both `shared_preload_libraries` and `CREATE EXTENSION`.
- Check that required schema migrations match the expected application version.

Connection defensibility:

- Use a bounded pool size.
- Use connection acquisition timeouts so pool exhaustion fails visibly.
- Use per-statement timeouts for API and worker queries.
- Use transaction timeouts or explicit guardrails for long-running maintenance transactions.
- Keep health-check errors generic on unauthenticated endpoints.
- Log slow queries without recursively persisting slow-query warnings into the same database path.

Schema defensibility:

- Prefer `not null`, `check`, `unique`, and foreign-key constraints over app-only validation.
- Name important constraints so errors can be mapped to clear API responses.
- Use partial unique indexes for active-row uniqueness where soft deletes are used.
- Use append-only event tables for decision history.
- Keep raw external payloads separate from normalized relational state.
- Keep destructive cleanup behind retention policies with audit events.

Migration defensibility:

- Use timestamped migrations only.
- Run each migration in a transaction unless it contains an operation that cannot run inside one.
- Migrations should be idempotent where practical.
- Fresh installs may load a schema snapshot, then run normal migration verification.
- Failed migrations must be visible in logs and the UI.
- Never auto-repair a failed migration by dropping user data.

### Database Self-Healing

Self-healing should mean safe, explainable recovery from known operational problems. It should not mean silent data rewriting.

Allowed automatic recovery:

- Remove a stale `postmaster.pid` after verifying no Postgres process owns the data directory.
- Recreate missing runtime directories such as `/run/postgresql`.
- Reapply expected ownership and permissions to app-owned data and runtime directories when the container starts as root for setup.
- Start Postgres, wait for readiness, and retry readiness checks with bounded backoff.
- Resume pending migrations after a previous startup failed before completion.
- Requeue jobs left in transient states when the app crashed, using advisory locks so only one process performs recovery.
- Mark stale downloads, imports, or worker jobs as needing reconciliation rather than deleting them.
- Run retention cleanup for append-only logs based on configured policy.
- Run `ANALYZE` after large migrations or bulk imports when planner statistics are likely stale.

Blocked automatic recovery:

- Do not auto-run PostgreSQL major upgrades.
- Do not delete or recreate the database cluster to recover startup.
- Do not run `VACUUM FULL`, `REINDEX`, or destructive cleanup automatically without an explicit maintenance mode or operator action.
- Do not weaken database authentication or file permissions to make startup pass.
- Do not expose `5432` for troubleshooting in the default compose file.

Operational recovery should be recorded in database events when the database is available and in startup logs when it is not. If the database is unavailable, the app should expose a degraded health response without leaking internal host, path, or credential details to unauthenticated users.

### Common Columns

Most mutable tables should include:

```sql
id uuid primary key
created_at timestamptz not null
updated_at timestamptz not null
deleted_at timestamptz null
```

Append-only event tables should include:

```sql
id uuid primary key
occurred_at timestamptz not null
created_at timestamptz not null
```

External payload snapshot tables should include:

```sql
source_provider text not null
source_identifier text null
fetched_at timestamptz not null
payload_checksum text null
raw_payload jsonb not null
normalized_payload jsonb null
```

### Status Columns

Use `text` plus `CHECK` constraints for status fields in early versions instead of PostgreSQL enum types.

Reason: status values will likely change while the product model is still settling. Text with check constraints is easier to migrate than enum types.

Example:

```sql
status text not null check (status in ('pending', 'running', 'failed', 'completed'))
```

### JSONB Usage

Use JSONB for:

- Raw provider payload snapshots.
- Score factor payloads.
- Worker error details.
- Flexible settings blobs where the shape may change.

Avoid JSONB for core relational state that needs joins, filtering, constraints, or foreign keys.

### Time-Based History

Harmoniarr should keep current-state projection tables and historical event tables.

Examples:

- `wanted_items` is current wanted state.
- `wanted_item_events` explains how it changed.
- `soulseek_users` is current source-user state.
- `soulseek_user_events` explains why trust changed.

This supports explainability without making every screen recompute from raw events.

## SQL Mutation Contracts

This section defines the initial SQL statement patterns and database function contracts for creating, updating, and removing records.

These are not final migration files. They are the contract the implementation should follow when building repository methods, migrations, and optional PostgreSQL functions.

### Mutation Principles

- Prefer explicit column lists in every `insert`, `update`, and `delete`.
- Use `returning *` or explicit returned columns for mutations that affect API state.
- Wrap multi-table workflow changes in one transaction.
- Use `on conflict ... do update` for idempotent provider and scan ingestion.
- Use soft deletion for user-facing domain records.
- Use hard deletion only for retention cleanup, expired sessions/tokens, temporary staging rows, and failed setup artifacts.
- Append an event row whenever a workflow state changes in a way the user may need to understand later.
- Do not let callers update `created_at`.
- `updated_at` should be maintained by a common trigger or by explicit update statements, but not mixed inconsistently.
- Application code must call SQL with bound parameters. Do not build SQL by string interpolation from user input.
- Database functions should default to `security invoker`. Use `security definer` only after a specific security review.
- Avoid dynamic SQL inside database functions. If dynamic SQL becomes necessary for maintenance tooling, identifiers must be quoted with PostgreSQL formatting helpers and values must be passed through `using`.

Recommended helper trigger:

```sql
create or replace function app_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
```

Apply it to mutable tables:

```sql
create trigger set_updated_at
before update on managed_artists
for each row
execute function app_set_updated_at();
```

### Insert Pattern

Use plain inserts for local records that are not naturally idempotent.

Example:

```sql
insert into managed_artists (
  id,
  metadata_artist_id,
  display_name,
  sort_name,
  monitored,
  created_at,
  updated_at
) values (
  coalesce($1, uuidv7()),
  $2,
  $3,
  $4,
  $5,
  now(),
  now()
)
returning *;
```

Recommended function shape:

```sql
create or replace function create_managed_artist(
  p_metadata_artist_id uuid,
  p_display_name text,
  p_sort_name text,
  p_monitored boolean default true
) returns managed_artists
language sql
as $$
  insert into managed_artists (
    id,
    metadata_artist_id,
    display_name,
    sort_name,
    monitored,
    created_at,
    updated_at
  ) values (
    uuidv7(),
    p_metadata_artist_id,
    p_display_name,
    p_sort_name,
    p_monitored,
    now(),
    now()
  )
  returning *;
$$;
```

### Upsert Pattern

Use upserts for provider-sourced identity, scan observations, dependency status, source-user profiles, and settings.

Provider upsert example:

```sql
insert into metadata_artists (
  id,
  source_provider,
  source_artist_id,
  musicbrainz_artist_id,
  name,
  sort_name,
  disambiguation,
  raw_payload,
  fetched_at,
  created_at,
  updated_at
) values (
  uuidv7(),
  $1,
  $2,
  $3,
  $4,
  $5,
  $6,
  $7,
  now(),
  now(),
  now()
)
on conflict (source_provider, source_artist_id)
do update set
  musicbrainz_artist_id = excluded.musicbrainz_artist_id,
  name = excluded.name,
  sort_name = excluded.sort_name,
  disambiguation = excluded.disambiguation,
  raw_payload = excluded.raw_payload,
  fetched_at = excluded.fetched_at,
  updated_at = now()
returning *;
```

Recommended function shape:

```sql
create or replace function upsert_metadata_artist(
  p_source_provider text,
  p_source_artist_id text,
  p_musicbrainz_artist_id uuid,
  p_name text,
  p_sort_name text,
  p_disambiguation text,
  p_raw_payload jsonb
) returns metadata_artists
language sql
as $$
  insert into metadata_artists (
    id,
    source_provider,
    source_artist_id,
    musicbrainz_artist_id,
    name,
    sort_name,
    disambiguation,
    raw_payload,
    fetched_at,
    created_at,
    updated_at
  ) values (
    uuidv7(),
    p_source_provider,
    p_source_artist_id,
    p_musicbrainz_artist_id,
    p_name,
    p_sort_name,
    p_disambiguation,
    p_raw_payload,
    now(),
    now(),
    now()
  )
  on conflict (source_provider, source_artist_id)
  do update set
    musicbrainz_artist_id = excluded.musicbrainz_artist_id,
    name = excluded.name,
    sort_name = excluded.sort_name,
    disambiguation = excluded.disambiguation,
    raw_payload = excluded.raw_payload,
    fetched_at = excluded.fetched_at,
    updated_at = now()
  returning *;
$$;
```

### Update Pattern

Use narrow updates with optimistic guards when a user action depends on current state.

Example:

```sql
update wanted_items
set
  status = $2,
  reason = $3,
  updated_at = now()
where id = $1
  and status = $4
  and deleted_at is null
returning *;
```

Recommended function shape:

```sql
create or replace function transition_wanted_item(
  p_wanted_item_id uuid,
  p_from_status text,
  p_to_status text,
  p_reason text,
  p_actor_user_id uuid default null
) returns wanted_items
language plpgsql
as $$
declare
  v_item wanted_items;
begin
  update wanted_items
  set
    status = p_to_status,
    reason = p_reason,
    updated_at = now()
  where id = p_wanted_item_id
    and status = p_from_status
    and deleted_at is null
  returning * into v_item;

  if not found then
    raise exception 'wanted item % cannot transition from % to %',
      p_wanted_item_id,
      p_from_status,
      p_to_status;
  end if;

  insert into wanted_item_events (
    id,
    wanted_item_id,
    event_type,
    previous_status,
    new_status,
    summary,
    details,
    occurred_at,
    created_at
  ) values (
    uuidv7(),
    p_wanted_item_id,
    'status_changed',
    p_from_status,
    p_to_status,
    p_reason,
    jsonb_build_object('actor_user_id', p_actor_user_id),
    now(),
    now()
  );

  return v_item;
end;
$$;
```

### Soft Delete Pattern

Soft deletion should be the default removal behavior for managed domain records.

Example:

```sql
update managed_artists
set
  deleted_at = now(),
  updated_at = now()
where id = $1
  and deleted_at is null
returning *;
```

Recommended function shape:

```sql
create or replace function soft_delete_managed_artist(
  p_managed_artist_id uuid,
  p_actor_user_id uuid default null,
  p_reason text default null
) returns managed_artists
language plpgsql
as $$
declare
  v_artist managed_artists;
begin
  update managed_artists
  set
    deleted_at = now(),
    updated_at = now()
  where id = p_managed_artist_id
    and deleted_at is null
  returning * into v_artist;

  if not found then
    raise exception 'managed artist % was not found or already deleted',
      p_managed_artist_id;
  end if;

  insert into audit_events (
    id,
    occurred_at,
    actor_user_id,
    actor_type,
    event_type,
    entity_type,
    entity_id,
    summary,
    details,
    created_at
  ) values (
    uuidv7(),
    now(),
    p_actor_user_id,
    case when p_actor_user_id is null then 'system' else 'user' end,
    'managed_artist_deleted',
    'managed_artist',
    p_managed_artist_id,
    'Managed artist soft deleted',
    jsonb_build_object('reason', p_reason),
    now()
  );

  return v_artist;
end;
$$;
```

### Hard Delete Pattern

Hard deletes should be explicit retention operations, not normal user actions.

Example retention cleanup:

```sql
delete from provider_request_log
where occurred_at < $1
returning id;
```

Recommended function shape:

```sql
create or replace function purge_provider_request_log_before(
  p_cutoff timestamptz
) returns integer
language plpgsql
as $$
declare
  v_deleted_count integer;
begin
  delete from provider_request_log
  where occurred_at < p_cutoff;

  get diagnostics v_deleted_count = row_count;

  insert into database_maintenance_runs (
    id,
    maintenance_type,
    status,
    started_at,
    finished_at,
    rows_affected,
    details,
    created_at
  ) values (
    uuidv7(),
    'provider_request_log_retention_cleanup',
    'completed',
    now(),
    now(),
    v_deleted_count,
    jsonb_build_object('cutoff', p_cutoff),
    now()
  );

  return v_deleted_count;
end;
$$;
```

### Workflow Function Inventory

Initial SQL functions or repository methods should be defined around workflow boundaries rather than one generic function per table.

Metadata ingestion:

- `upsert_metadata_artist`
- `upsert_metadata_artist_alias`
- `upsert_metadata_release_group`
- `upsert_metadata_release`
- `upsert_metadata_media`
- `upsert_metadata_recording`
- `upsert_metadata_track`
- `insert_metadata_provider_snapshot`
- `record_metadata_refresh_run`

Managed library:

- `create_managed_artist`
- `set_artist_monitoring`
- `upsert_managed_album`
- `upsert_managed_track`
- `soft_delete_managed_artist`
- `soft_delete_managed_album`
- `soft_delete_managed_track`
- `upsert_library_root`
- `create_library_scan_run`
- `upsert_library_file`
- `match_library_file_to_track`
- `mark_library_file_removed`

Missing and wanted:

- `upsert_wanted_item`
- `transition_wanted_item`
- `record_wanted_item_event`
- `refresh_missing_item_projection`
- `ignore_missing_item`
- `unignore_missing_item`

Soulseek source users:

- `upsert_soulseek_user`
- `record_soulseek_user_event`
- `set_soulseek_user_trust_state`
- `block_soulseek_user`
- `unblock_soulseek_user`
- `record_soulseek_user_score_snapshot`

Search and candidates:

- `create_search_job`
- `record_search_attempt`
- `insert_search_result_file`
- `create_source_candidate`
- `insert_candidate_file`
- `insert_candidate_score_factor`
- `record_manual_correlation`
- `reject_source_candidate`
- `select_source_candidate_for_download`

Downloads and imports:

- `create_download_job`
- `transition_download_job`
- `upsert_download_file`
- `record_transfer_event`
- `create_import_review`
- `upsert_import_review_file`
- `record_import_validation_run`
- `accept_import_review`
- `reject_import_review`
- `record_import_operation`

Quality and fingerprints:

- `upsert_audio_fingerprint`
- `record_acoustid_lookup_run`
- `insert_acoustid_lookup_result`
- `upsert_quality_profile`
- `record_library_quality_snapshot`
- `record_quality_upgrade_decision`

Release detection:

- `record_release_detection_run`
- `record_release_detection_event`
- `upsert_release_redirect`
- `apply_release_detection_decision`

Background jobs and health:

- `enqueue_background_job`
- `claim_background_job`
- `complete_background_job`
- `fail_background_job`
- `requeue_stale_background_jobs`
- `upsert_dependency_status`
- `record_dependency_event`
- `upsert_provider_rate_limit_state`
- `record_provider_request`
- `record_database_health_check`
- `record_database_self_healing_event`

Logging:

- `record_error_log`
- `resolve_error_log`
- `reopen_error_log`
- `record_error_log_event`
- `record_app_log`
- `purge_error_log_before`
- `purge_app_log_before`

### Transaction Boundaries

Some functions should always run inside a transaction because they modify multiple related records.

Examples:

```text
metadata refresh:
  metadata_refresh_runs
  metadata_provider_snapshots
  metadata_* upserts
  release_detection_runs
  release_detection_events

candidate selection:
  source_candidates status update
  download_jobs insert
  download_files insert
  wanted_item_events insert

import acceptance:
  import_reviews status update
  library_files upsert
  library_file_matches upsert
  wanted_items status update
  import_operations insert
  audit_events insert
```

Workers should use advisory locks or row-level claiming to prevent duplicate work. Queue claims should use `for update skip locked` where multiple workers can safely compete for ready work.

Example job claim:

```sql
with next_job as (
  select id
  from background_jobs
  where status = 'pending'
    and scheduled_for <= now()
  order by priority asc, scheduled_for asc, created_at asc
  for update skip locked
  limit 1
)
update background_jobs job
set
  status = 'running',
  locked_by = $1,
  locked_at = now(),
  started_at = coalesce(started_at, now()),
  attempt_count = attempt_count + 1,
  updated_at = now()
from next_job
where job.id = next_job.id
returning job.*;
```

## Error Logging Service

Harmoniarr should include a central error logging service similar in shape to Classifarr's logger.

The service should provide:

- `createLogger(module)` for module-scoped logging.
- `logger.error(message, data, options)`.
- `logger.warn(message, data, options)`.
- `logger.info(message, data, options)`.
- `logger.debug(message, data, options)`.
- `setLoggerDb(db)` or dependency injection so the logger can persist to Postgres after startup.
- `sanitizeLogData(data)` for recursive redaction.
- `getSystemContext()` for runtime diagnostics.
- `getRequestContext(req)` for authenticated API error context.
- `cleanupOldLogFiles()` for file log retention.

The service should write to:

- Console, so Docker logs remain useful.
- Rotated files under `/app/data/logs`, so users can inspect logs without database access.
- `error_log` for `ERROR` and `WARN` records by default.
- `app_log` for general app events only if we decide database-backed app logs are worth the write volume.

Classifarr currently persists `ERROR` and `WARN` rows to `error_log`, writes file logs, and supports a `skipDbPersist` option. Harmoniarr should preserve that recursion guard.

### Logger Options

Expected options:

```text
req
error
skipDbPersist
dedupeKey
dedupeWindowMs
domain
operation
entityType
entityId
jobId
correlationId
reasonCode
recoverable
durationMs
```

Rules:

- `skipDbPersist` must be available for database logging failures, slow-query warnings, log cleanup jobs, and any path where persisting the log could recursively trigger another log write.
- `dedupeKey` should suppress repeated noisy warnings for a short window.
- `correlationId` should connect API requests, background jobs, provider calls, transfer events, and import reviews.
- `reasonCode` should be stable enough for filtering, aggregation, tests, and documentation.
- `recoverable` should distinguish transient operational errors from defects requiring code or configuration changes.

### Redaction

The logger must sanitize data before writing to file or database.

Redact keys containing:

```text
password
token
api_key
apikey
api-key
secret
authorization
auth
jwt
session
cookie
access_token
refresh_token
private_key
slskd_password
slskd_api_key
acoustid_api_key
```

Path and media metadata need special handling:

- Full local paths should be allowed in authenticated logs only when needed for troubleshooting.
- Unauthenticated API responses must never expose full paths.
- Manual bug-report export should warn that logs may contain local artist, album, filename, and path information.
- Downloaded Soulseek usernames should be treated as operational data, not secrets, but still avoid exposing them to unauthenticated users.

### Error Handler Integration

The Express error middleware should:

- Treat malformed JSON as a normal `400` without creating noisy error rows.
- Persist unexpected `5xx` errors as `ERROR`.
- Persist expected operational `4xx` errors as `WARN` only when useful.
- Return a public `errorId` for `5xx` responses when persistence succeeds.
- Hide internal error messages in production.
- Include stack traces only in development responses.

The public response shape should be:

```json
{
  "error": "Internal Server Error",
  "message": "Internal Server Error",
  "errorId": "uuid-when-available"
}
```

### Log API And UI

Log routes should be authenticated and rate limited.

Planned endpoints:

```text
GET    /api/logs
GET    /api/logs/stats
GET    /api/logs/error/:errorId
GET    /api/logs/error/:errorId/report
POST   /api/logs/error/:errorId/resolve
POST   /api/logs/error/:errorId/reopen
POST   /api/logs/cleanup
GET    /api/logs/export
```

Filtering should support:

- Level.
- Module.
- Domain.
- Operation.
- Entity type.
- Entity ID.
- Job ID.
- Correlation ID.
- Reason code.
- SQL state.
- Resolved state.
- Date range.

The UI should appear under Settings or Activity diagnostics. It should show unresolved errors, error trends, top modules, and recent warnings. It should not expose logs before authentication.

### Retention And Cleanup

Seed settings:

```text
log_level = INFO
file_logging_enabled = true
log_retention_days = 30
error_log_retention_days = 90
max_log_export_limit = 5000
```

Cleanup should:

- Delete old `error_log` rows in batches.
- Delete old `app_log` rows in batches if `app_log` is enabled.
- Delete old rotated log files by age and total size.
- Record cleanup in `database_maintenance_runs` or `app_log`.
- Use `skipDbPersist` if cleanup logging itself fails.

Batch cleanup example:

```sql
delete from error_log
where id in (
  select id
  from error_log
  where created_at < now() - ($1 || ' days')::interval
  order by created_at asc
  limit $2
);
```

### Error Logging SQL Functions

Recommended function shapes:

```sql
create or replace function record_error_log(
  p_level text,
  p_module text,
  p_message text,
  p_stack_trace text default null,
  p_request_context jsonb default null,
  p_system_context jsonb default null,
  p_metadata jsonb default null,
  p_domain text default null,
  p_operation text default null,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_job_id uuid default null,
  p_correlation_id uuid default null,
  p_reason_code text default null,
  p_sql_state text default null,
  p_duration_ms integer default null,
  p_recoverable boolean default true
) returns error_log
language sql
as $$
  insert into error_log (
    id,
    error_id,
    level,
    module,
    message,
    stack_trace,
    request_context,
    system_context,
    metadata,
    domain,
    operation,
    entity_type,
    entity_id,
    job_id,
    correlation_id,
    reason_code,
    sql_state,
    duration_ms,
    recoverable,
    created_at
  ) values (
    uuidv7(),
    uuidv7(),
    p_level,
    p_module,
    p_message,
    p_stack_trace,
    p_request_context,
    p_system_context,
    p_metadata,
    p_domain,
    p_operation,
    p_entity_type,
    p_entity_id,
    p_job_id,
    p_correlation_id,
    p_reason_code,
    p_sql_state,
    p_duration_ms,
    coalesce(p_recoverable, true),
    now()
  )
  returning *;
$$;
```

```sql
create or replace function resolve_error_log(
  p_error_id uuid,
  p_actor_user_id uuid,
  p_resolution_notes text
) returns error_log
language plpgsql
as $$
declare
  v_log error_log;
begin
  update error_log
  set
    resolved = true,
    resolved_at = now(),
    resolved_by_user_id = p_actor_user_id,
    resolution_notes = p_resolution_notes
  where error_id = p_error_id
  returning * into v_log;

  if not found then
    raise exception 'error log % not found', p_error_id;
  end if;

  insert into error_log_events (
    id,
    error_log_id,
    event_type,
    actor_user_id,
    summary,
    details,
    occurred_at,
    created_at
  ) values (
    uuidv7(),
    v_log.id,
    'resolved',
    p_actor_user_id,
    'Error marked as resolved',
    jsonb_build_object('notes', p_resolution_notes),
    now(),
    now()
  );

  return v_log;
end;
$$;
```

## Relationship Overview

```text
managed_artists
  -> managed_albums
      -> managed_tracks
          -> library_files through library_file_matches

metadata_artists
  -> metadata_release_groups
      -> metadata_releases
          -> metadata_media
              -> metadata_tracks
                  -> metadata_recordings

wanted_items
  -> managed_artist / managed_album / managed_track
  -> search_jobs
      -> search_attempts
          -> search_result_files
      -> source_candidates
          -> candidate_files
          -> candidate_score_factors
          -> download_jobs
              -> download_files
                  -> import_reviews

soulseek_users
  -> search_result_files
  -> source_candidates
  -> download_jobs
  -> soulseek_user_events
  -> soulseek_user_score_snapshots
```

## Core System Tables

### `schema_migrations`

Tracks migration execution.

Columns:

- `id uuid primary key`
- `migration_key text not null unique`
- `filename text not null unique`
- `description text null`
- `checksum text not null`
- `status text not null`
- `started_at timestamptz null`
- `finished_at timestamptz null`
- `duration_ms integer null`
- `error_message text null`
- `application_version text null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

### `app_users`

Application login users.

Columns:

- `id uuid primary key`
- `username text not null unique`
- `password_hash text not null`
- `role text not null`
- `is_disabled boolean not null default false`
- `last_login_at timestamptz null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Initial roles:

```text
admin
user
```

### `api_keys`

Scoped API keys for automation or integrations.

Columns:

- `id uuid primary key`
- `name text not null`
- `key_hash text not null unique`
- `encrypted_key_preview text null`
- `scope text not null`
- `last_used_at timestamptz null`
- `expires_at timestamptz null`
- `is_revoked boolean not null default false`
- `created_by_user_id uuid null references app_users(id)`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

### `encrypted_secrets`

Encrypted integration secrets and credentials.

Columns:

- `id uuid primary key`
- `secret_type text not null`
- `name text not null`
- `encrypted_value bytea not null`
- `encryption_key_version text not null`
- `metadata jsonb null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Examples:

```text
slskd_api_key
slskd_password
acoustid_api_key
```

### `audit_events`

Security and high-impact action audit log.

Columns:

- `id uuid primary key`
- `occurred_at timestamptz not null`
- `actor_user_id uuid null references app_users(id)`
- `actor_type text not null`
- `event_type text not null`
- `entity_type text null`
- `entity_id uuid null`
- `summary text not null`
- `details jsonb null`
- `ip_address inet null`
- `user_agent text null`
- `created_at timestamptz not null`

### `app_log`

General application log rows for authenticated diagnostics.

This table should mirror the useful parts of Classifarr's `app_log` while using Harmoniarr's UUID key convention.

Columns:

- `id uuid primary key`
- `level text not null check (level in ('ERROR', 'WARN', 'INFO', 'DEBUG'))`
- `module text not null`
- `message text not null`
- `metadata jsonb null`
- `correlation_id uuid null`
- `created_at timestamptz not null`

### `error_log`

Structured error and warning records for support, bug reports, and the Settings or Activity diagnostics UI.

This table should be treated as active product infrastructure. Do not drop it during cleanup migrations.

Columns:

- `id uuid primary key`
- `error_id uuid not null unique`
- `level text not null check (level in ('ERROR', 'WARN', 'INFO', 'DEBUG'))`
- `module text not null`
- `message text not null`
- `stack_trace text null`
- `request_context jsonb null`
- `system_context jsonb null`
- `metadata jsonb null`
- `domain text null`
- `operation text null`
- `entity_type text null`
- `entity_id uuid null`
- `job_id uuid null`
- `correlation_id uuid null`
- `reason_code text null`
- `sql_state text null check (sql_state is null or sql_state ~ '^[A-Z0-9]{1,10}$')`
- `duration_ms integer null`
- `recoverable boolean not null default true`
- `resolved boolean not null default false`
- `resolved_at timestamptz null`
- `resolved_by_user_id uuid null references app_users(id)`
- `resolution_notes text null`
- `created_at timestamptz not null`

Domain examples:

```text
api
database
metadata
slskd
search
download
import
fingerprint
quality
release_detector
worker
security
```

Reason code examples:

```text
provider_rate_limited
slskd_unreachable
database_timeout
import_path_blocked
fingerprint_mismatch
candidate_validation_failed
download_stalled
unexpected_exception
```

### `error_log_events`

History for operator actions against error records.

Columns:

- `id uuid primary key`
- `error_log_id uuid not null references error_log(id)`
- `event_type text not null`
- `actor_user_id uuid null references app_users(id)`
- `summary text not null`
- `details jsonb null`
- `occurred_at timestamptz not null`
- `created_at timestamptz not null`

Examples:

```text
resolved
reopened
annotated
exported
retention_deleted
```

## Settings And Health Tables

### `app_settings`

General settings that are not secret.

Columns:

- `id uuid primary key`
- `namespace text not null`
- `setting_key text not null`
- `setting_value jsonb not null`
- `updated_by_user_id uuid null references app_users(id)`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Unique:

- `(namespace, setting_key)`

### `dependency_status`

Current dependency health projection.

Columns:

- `id uuid primary key`
- `dependency_key text not null unique`
- `dependency_type text not null`
- `status text not null`
- `last_success_at timestamptz null`
- `last_failure_at timestamptz null`
- `next_check_at timestamptz null`
- `last_error_class text null`
- `last_error_message text null`
- `details jsonb null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Examples:

```text
slskd
musicbrainz
cover_art_archive
acoustid
postgres
ffmpeg
ffprobe
chromaprint
clamav
```

### `dependency_events`

Historical dependency state changes.

Columns:

- `id uuid primary key`
- `dependency_key text not null`
- `previous_status text null`
- `new_status text not null`
- `event_type text not null`
- `message text null`
- `details jsonb null`
- `occurred_at timestamptz not null`
- `created_at timestamptz not null`

### `provider_rate_limit_state`

Current rate-limit projection per provider.

Columns:

- `id uuid primary key`
- `provider text not null unique`
- `minimum_interval_ms integer not null`
- `last_request_at timestamptz null`
- `next_allowed_at timestamptz null`
- `backoff_until timestamptz null`
- `last_status_code integer null`
- `details jsonb null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

### `provider_request_log`

Provider request history for debugging and rate-limit analysis.

Columns:

- `id uuid primary key`
- `provider text not null`
- `request_method text not null`
- `request_path text not null`
- `status_code integer null`
- `duration_ms integer null`
- `rate_limited boolean not null default false`
- `error_class text null`
- `occurred_at timestamptz not null`
- `created_at timestamptz not null`

### `database_runtime_state`

Current embedded database runtime projection.

Columns:

- `id uuid primary key`
- `singleton_key text not null unique default 'default'`
- `server_version text not null`
- `server_major integer not null`
- `data_directory text not null`
- `data_directory_major integer not null`
- `checksums_enabled boolean null`
- `listen_addresses text null`
- `port integer null`
- `unix_socket_directories text null`
- `shared_preload_libraries text null`
- `active_extensions text[] not null default '{}'`
- `last_started_at timestamptz null`
- `last_ready_at timestamptz null`
- `last_checked_at timestamptz not null`
- `details jsonb null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

This row is a UI/status projection. Startup must still read the actual filesystem and server state before trusting it.

### `database_health_checks`

Historical database health observations.

Columns:

- `id uuid primary key`
- `check_type text not null`
- `status text not null`
- `duration_ms integer null`
- `server_version text null`
- `migration_status text null`
- `pool_total integer null`
- `pool_idle integer null`
- `pool_waiting integer null`
- `error_class text null`
- `error_message text null`
- `details jsonb null`
- `occurred_at timestamptz not null`
- `created_at timestamptz not null`

Examples:

```text
connectivity
migration_status
extension_status
permission_status
pool_status
checksum_status
```

### `database_maintenance_runs`

Database maintenance job history.

Columns:

- `id uuid primary key`
- `maintenance_type text not null`
- `status text not null`
- `started_at timestamptz not null`
- `finished_at timestamptz null`
- `duration_ms integer null`
- `target_relation text null`
- `rows_affected bigint null`
- `details jsonb null`
- `error_class text null`
- `error_message text null`
- `created_at timestamptz not null`

Examples:

```text
analyze_after_bulk_import
brin_summarize
log_retention_cleanup
queue_stale_state_recovery
migration_snapshot_verify
```

### `database_self_healing_events`

Audit-style record of safe automatic recovery actions.

Columns:

- `id uuid primary key`
- `event_type text not null`
- `status text not null`
- `summary text not null`
- `details jsonb null`
- `occurred_at timestamptz not null`
- `created_at timestamptz not null`

Examples:

```text
runtime_directory_recreated
ownership_repaired
stale_pid_removed
pending_jobs_reconciled
extension_configuration_detected
startup_guard_failed
```

### `database_backup_runs`

Logical backup and schema snapshot history.

Columns:

- `id uuid primary key`
- `backup_type text not null`
- `status text not null`
- `started_at timestamptz not null`
- `finished_at timestamptz null`
- `duration_ms integer null`
- `artifact_path text null`
- `artifact_size_bytes bigint null`
- `checksum text null`
- `retention_expires_at timestamptz null`
- `error_class text null`
- `error_message text null`
- `created_at timestamptz not null`

## Metadata Tables

### `metadata_artists`

Cached provider artist identity.

Columns:

- `id uuid primary key`
- `source_provider text not null`
- `source_artist_id text not null`
- `musicbrainz_artist_id uuid null`
- `name text not null`
- `sort_name text null`
- `disambiguation text null`
- `country text null`
- `artist_type text null`
- `begin_date text null`
- `end_date text null`
- `raw_payload jsonb null`
- `fetched_at timestamptz null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Unique:

- `(source_provider, source_artist_id)`
- `musicbrainz_artist_id` where not null

### `metadata_artist_aliases`

Artist aliases used for search and matching.

Columns:

- `id uuid primary key`
- `metadata_artist_id uuid not null references metadata_artists(id)`
- `alias text not null`
- `locale text null`
- `is_primary boolean not null default false`
- `created_at timestamptz not null`

Unique:

- `(metadata_artist_id, alias, locale)`

### `metadata_release_groups`

Cached MusicBrainz release-group identity.

Columns:

- `id uuid primary key`
- `metadata_artist_id uuid not null references metadata_artists(id)`
- `source_provider text not null`
- `source_release_group_id text not null`
- `musicbrainz_release_group_id uuid null`
- `title text not null`
- `primary_type text null`
- `secondary_types text[] not null default '{}'`
- `first_release_date text null`
- `disambiguation text null`
- `raw_payload jsonb null`
- `fetched_at timestamptz null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Unique:

- `(source_provider, source_release_group_id)`
- `musicbrainz_release_group_id` where not null

### `metadata_releases`

Cached specific release/edition identity.

Columns:

- `id uuid primary key`
- `metadata_release_group_id uuid not null references metadata_release_groups(id)`
- `source_provider text not null`
- `source_release_id text not null`
- `musicbrainz_release_id uuid null`
- `title text not null`
- `status text null`
- `release_date text null`
- `country text null`
- `barcode text null`
- `disambiguation text null`
- `track_count integer null`
- `medium_count integer null`
- `raw_payload jsonb null`
- `fetched_at timestamptz null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Unique:

- `(source_provider, source_release_id)`
- `musicbrainz_release_id` where not null

### `metadata_media`

Release discs/media.

Columns:

- `id uuid primary key`
- `metadata_release_id uuid not null references metadata_releases(id)`
- `position integer not null`
- `title text null`
- `format text null`
- `track_count integer null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Unique:

- `(metadata_release_id, position)`

### `metadata_recordings`

Canonical recording cache.

Columns:

- `id uuid primary key`
- `source_provider text not null`
- `source_recording_id text not null`
- `musicbrainz_recording_id uuid null`
- `title text not null`
- `length_ms integer null`
- `artist_credit text null`
- `raw_payload jsonb null`
- `fetched_at timestamptz null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Unique:

- `(source_provider, source_recording_id)`
- `musicbrainz_recording_id` where not null

### `metadata_tracks`

Track appearance on a release medium.

Columns:

- `id uuid primary key`
- `metadata_medium_id uuid not null references metadata_media(id)`
- `metadata_recording_id uuid null references metadata_recordings(id)`
- `position integer not null`
- `number_text text null`
- `title text not null`
- `length_ms integer null`
- `artist_credit text null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Unique:

- `(metadata_medium_id, position)`

### `metadata_provider_snapshots`

Raw provider response snapshots.

Columns:

- `id uuid primary key`
- `provider text not null`
- `entity_type text not null`
- `entity_id uuid null`
- `source_identifier text null`
- `payload_checksum text null`
- `raw_payload jsonb not null`
- `normalized_payload jsonb null`
- `fetched_at timestamptz not null`
- `created_at timestamptz not null`

### `metadata_refresh_runs`

Metadata refresh job history.

Columns:

- `id uuid primary key`
- `target_type text not null`
- `target_id uuid null`
- `provider text not null`
- `status text not null`
- `started_at timestamptz not null`
- `finished_at timestamptz null`
- `error_message text null`
- `summary jsonb null`
- `created_at timestamptz not null`

## Managed Library Tables

### `managed_artists`

User-managed artist records.

Columns:

- `id uuid primary key`
- `metadata_artist_id uuid null references metadata_artists(id)`
- `display_name text not null`
- `sort_name text null`
- `monitored boolean not null default true`
- `monitoring_rule_id uuid null`
- `quality_profile_id uuid null`
- `added_by_user_id uuid null references app_users(id)`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `deleted_at timestamptz null`

Unique:

- `metadata_artist_id` where not null

### `managed_albums`

User-managed album/release-group records.

Columns:

- `id uuid primary key`
- `managed_artist_id uuid not null references managed_artists(id)`
- `metadata_release_group_id uuid null references metadata_release_groups(id)`
- `selected_metadata_release_id uuid null references metadata_releases(id)`
- `display_title text not null`
- `release_year integer null`
- `album_type text null`
- `monitored boolean not null default true`
- `library_status text not null default 'unknown'`
- `quality_profile_id uuid null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `deleted_at timestamptz null`

Unique:

- `(managed_artist_id, metadata_release_group_id)` where `metadata_release_group_id` is not null

### `managed_tracks`

User-facing song rows under a managed album.

Columns:

- `id uuid primary key`
- `managed_album_id uuid not null references managed_albums(id)`
- `metadata_track_id uuid null references metadata_tracks(id)`
- `metadata_recording_id uuid null references metadata_recordings(id)`
- `disc_number integer not null default 1`
- `track_number integer not null`
- `title text not null`
- `duration_ms integer null`
- `monitored boolean not null default true`
- `library_status text not null default 'unknown'`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `deleted_at timestamptz null`

Unique:

- `(managed_album_id, disc_number, track_number)`

### `artist_monitoring_rules`

Artist release monitoring preferences.

Columns:

- `id uuid primary key`
- `managed_artist_id uuid not null references managed_artists(id)`
- `monitor_albums boolean not null default true`
- `monitor_eps boolean not null default true`
- `monitor_singles boolean not null default false`
- `monitor_live boolean not null default false`
- `monitor_compilations boolean not null default false`
- `monitor_future_releases boolean not null default true`
- `auto_wanted_new_releases boolean not null default true`
- `rules jsonb null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Unique:

- `managed_artist_id`

## Library File Tables

### `library_roots`

Configured library root folders.

Columns:

- `id uuid primary key`
- `name text not null`
- `path text not null`
- `canonical_path text not null unique`
- `is_enabled boolean not null default true`
- `quality_profile_id uuid null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

### `library_scan_runs`

Existing library scan history.

Columns:

- `id uuid primary key`
- `library_root_id uuid null references library_roots(id)`
- `status text not null`
- `started_at timestamptz not null`
- `finished_at timestamptz null`
- `files_seen integer not null default 0`
- `files_matched integer not null default 0`
- `files_unmatched integer not null default 0`
- `summary jsonb null`
- `error_message text null`
- `created_at timestamptz not null`

### `library_files`

Observed files in the managed library.

Columns:

- `id uuid primary key`
- `library_root_id uuid not null references library_roots(id)`
- `canonical_path text not null unique`
- `relative_path text not null`
- `filename text not null`
- `extension text not null`
- `size_bytes bigint not null`
- `modified_at timestamptz null`
- `audio_codec text null`
- `bitrate_kbps integer null`
- `sample_rate_hz integer null`
- `bit_depth integer null`
- `channels integer null`
- `duration_ms integer null`
- `tag_payload jsonb null`
- `file_state text not null default 'observed'`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `deleted_at timestamptz null`

### `library_file_matches`

Current mapping between files and managed tracks.

Columns:

- `id uuid primary key`
- `library_file_id uuid not null references library_files(id)`
- `managed_artist_id uuid null references managed_artists(id)`
- `managed_album_id uuid null references managed_albums(id)`
- `managed_track_id uuid null references managed_tracks(id)`
- `match_status text not null`
- `confidence text not null`
- `score numeric(6,2) null`
- `matched_by text not null`
- `evidence jsonb null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Unique:

- `(library_file_id, managed_track_id)` where `managed_track_id` is not null

## Missing And Wanted Tables

### `wanted_items`

Durable acquisition intent.

Columns:

- `id uuid primary key`
- `wanted_type text not null`
- `managed_artist_id uuid null references managed_artists(id)`
- `managed_album_id uuid null references managed_albums(id)`
- `managed_track_id uuid null references managed_tracks(id)`
- `target_metadata_release_id uuid null references metadata_releases(id)`
- `quality_profile_id uuid null`
- `status text not null`
- `reason text not null`
- `priority integer not null default 100`
- `monitored boolean not null default true`
- `next_search_after timestamptz null`
- `last_search_at timestamptz null`
- `cooldown_until timestamptz null`
- `blocked_reason text null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `deleted_at timestamptz null`

Wanted types:

```text
album
track
upgrade
manual
future_release
```

### `missing_items`

Current projection for the Missing page.

Columns:

- `id uuid primary key`
- `wanted_item_id uuid null references wanted_items(id)`
- `missing_type text not null`
- `managed_artist_id uuid not null references managed_artists(id)`
- `managed_album_id uuid null references managed_albums(id)`
- `managed_track_id uuid null references managed_tracks(id)`
- `reason text not null`
- `status text not null`
- `monitored boolean not null default true`
- `quality_profile_id uuid null`
- `last_search_at timestamptz null`
- `next_search_after timestamptz null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

This table is a projection. It can be rebuilt from library state, monitoring state, wanted state, and quality state.

### `wanted_item_events`

History for wanted and missing state changes.

Columns:

- `id uuid primary key`
- `wanted_item_id uuid not null references wanted_items(id)`
- `event_type text not null`
- `previous_status text null`
- `new_status text null`
- `summary text null`
- `details jsonb null`
- `occurred_at timestamptz not null`
- `created_at timestamptz not null`

## Soulseek Source User Tables

### `soulseek_users`

Current source-user projection.

Columns:

- `id uuid primary key`
- `username text not null unique`
- `trust_state text not null default 'new'`
- `presence text null`
- `is_blocked boolean not null default false`
- `is_ignored boolean not null default false`
- `is_trusted boolean not null default false`
- `last_seen_at timestamptz null`
- `last_browsed_at timestamptz null`
- `average_speed_bytes_per_second bigint null`
- `average_wait_seconds integer null`
- `successful_download_count integer not null default 0`
- `failed_download_count integer not null default 0`
- `accepted_import_count integer not null default 0`
- `rejected_import_count integer not null default 0`
- `score numeric(6,2) null`
- `score_label text null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

### `soulseek_user_events`

Historical source-user events.

Columns:

- `id uuid primary key`
- `soulseek_user_id uuid not null references soulseek_users(id)`
- `event_type text not null`
- `related_entity_type text null`
- `related_entity_id uuid null`
- `summary text null`
- `details jsonb null`
- `occurred_at timestamptz not null`
- `created_at timestamptz not null`

### `soulseek_user_notes`

User-authored notes.

Columns:

- `id uuid primary key`
- `soulseek_user_id uuid not null references soulseek_users(id)`
- `note text not null`
- `created_by_user_id uuid null references app_users(id)`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

### `soulseek_user_score_snapshots`

Explainable source-user score history.

Columns:

- `id uuid primary key`
- `soulseek_user_id uuid not null references soulseek_users(id)`
- `score numeric(6,2) not null`
- `label text not null`
- `factors jsonb not null`
- `created_at timestamptz not null`

## Search And Candidate Tables

### `search_jobs`

Managed search jobs.

Columns:

- `id uuid primary key`
- `wanted_item_id uuid null references wanted_items(id)`
- `manual_search_context_id uuid null`
- `search_type text not null`
- `status text not null`
- `requested_by_user_id uuid null references app_users(id)`
- `started_at timestamptz null`
- `finished_at timestamptz null`
- `error_message text null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

### `manual_search_contexts`

Search-page context for manual searches and Missing handoff.

Columns:

- `id uuid primary key`
- `managed_artist_id uuid null references managed_artists(id)`
- `managed_album_id uuid null references managed_albums(id)`
- `managed_track_id uuid null references managed_tracks(id)`
- `missing_item_id uuid null references missing_items(id)`
- `query_text text null`
- `artist_text text null`
- `album_text text null`
- `song_text text null`
- `release_year integer null`
- `quality_target text null`
- `correlation_target_type text null`
- `correlation_target_id uuid null`
- `created_by_user_id uuid null references app_users(id)`
- `created_at timestamptz not null`

### `search_attempts`

Individual query attempts within a search job.

Columns:

- `id uuid primary key`
- `search_job_id uuid not null references search_jobs(id)`
- `query_text text not null`
- `query_order integer not null`
- `slskd_search_id text null`
- `status text not null`
- `started_at timestamptz null`
- `finished_at timestamptz null`
- `result_count integer not null default 0`
- `error_message text null`
- `created_at timestamptz not null`

### `search_result_files`

Raw observed Soulseek search file results.

Columns:

- `id uuid primary key`
- `search_attempt_id uuid not null references search_attempts(id)`
- `soulseek_user_id uuid not null references soulseek_users(id)`
- `username text not null`
- `folder_path text not null`
- `filename text not null`
- `extension text null`
- `size_bytes bigint null`
- `bitrate_kbps integer null`
- `sample_rate_hz integer null`
- `duration_ms integer null`
- `queue_length integer null`
- `has_free_upload_slot boolean null`
- `upload_speed_bytes_per_second bigint null`
- `raw_payload jsonb null`
- `created_at timestamptz not null`

Indexes:

- `(search_attempt_id)`
- `(soulseek_user_id, folder_path)`
- `(extension)`

### `source_candidates`

Grouped user/folder candidate for a wanted item or manual context.

Columns:

- `id uuid primary key`
- `wanted_item_id uuid null references wanted_items(id)`
- `manual_search_context_id uuid null references manual_search_contexts(id)`
- `soulseek_user_id uuid not null references soulseek_users(id)`
- `username text not null`
- `folder_path text not null`
- `candidate_type text not null`
- `status text not null`
- `identity_score numeric(6,2) null`
- `quality_score numeric(6,2) null`
- `rip_confidence_score numeric(6,2) null`
- `source_score numeric(6,2) null`
- `overall_score numeric(6,2) null`
- `explanation text null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

### `candidate_files`

Files belonging to a candidate.

Columns:

- `id uuid primary key`
- `source_candidate_id uuid not null references source_candidates(id)`
- `search_result_file_id uuid null references search_result_files(id)`
- `filename text not null`
- `folder_path text not null`
- `size_bytes bigint null`
- `extension text null`
- `matched_track_id uuid null references managed_tracks(id)`
- `match_status text not null`
- `match_score numeric(6,2) null`
- `created_at timestamptz not null`

### `candidate_score_factors`

Explainable candidate scoring factors.

Columns:

- `id uuid primary key`
- `source_candidate_id uuid not null references source_candidates(id)`
- `factor_key text not null`
- `factor_group text not null`
- `points numeric(6,2) not null`
- `reason text not null`
- `details jsonb null`
- `created_at timestamptz not null`

### `manual_correlations`

Manual Search correlation and override decisions.

Columns:

- `id uuid primary key`
- `manual_search_context_id uuid null references manual_search_contexts(id)`
- `search_result_file_id uuid null references search_result_files(id)`
- `source_candidate_id uuid null references source_candidates(id)`
- `target_type text not null`
- `target_id uuid not null`
- `previous_target_type text null`
- `previous_target_id uuid null`
- `decision_type text not null`
- `reason text null`
- `created_by_user_id uuid null references app_users(id)`
- `created_at timestamptz not null`

## Download And Transfer Tables

### `download_jobs`

Download request created from a selected candidate.

Columns:

- `id uuid primary key`
- `source_candidate_id uuid null references source_candidates(id)`
- `wanted_item_id uuid null references wanted_items(id)`
- `soulseek_user_id uuid not null references soulseek_users(id)`
- `status text not null`
- `requested_by_user_id uuid null references app_users(id)`
- `started_at timestamptz null`
- `finished_at timestamptz null`
- `error_message text null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

### `download_files`

Files selected for download.

Columns:

- `id uuid primary key`
- `download_job_id uuid not null references download_jobs(id)`
- `candidate_file_id uuid null references candidate_files(id)`
- `remote_folder_path text not null`
- `remote_filename text not null`
- `local_staging_path text null`
- `status text not null`
- `size_bytes bigint null`
- `bytes_transferred bigint null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

### `transfer_events`

Append-only transfer status history.

Columns:

- `id uuid primary key`
- `download_file_id uuid null references download_files(id)`
- `download_job_id uuid null references download_jobs(id)`
- `event_type text not null`
- `status text null`
- `bytes_transferred bigint null`
- `speed_bytes_per_second bigint null`
- `queue_position integer null`
- `message text null`
- `raw_payload jsonb null`
- `occurred_at timestamptz not null`
- `created_at timestamptz not null`

## Import And Validation Tables

### `import_reviews`

Completed download awaiting validation/import decision.

Columns:

- `id uuid primary key`
- `download_job_id uuid null references download_jobs(id)`
- `wanted_item_id uuid null references wanted_items(id)`
- `managed_artist_id uuid null references managed_artists(id)`
- `managed_album_id uuid null references managed_albums(id)`
- `status text not null`
- `confidence text null`
- `summary text null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

### `import_review_files`

File-level import review rows.

Columns:

- `id uuid primary key`
- `import_review_id uuid not null references import_reviews(id)`
- `download_file_id uuid null references download_files(id)`
- `proposed_managed_track_id uuid null references managed_tracks(id)`
- `source_path text not null`
- `destination_path text null`
- `status text not null`
- `confidence text null`
- `audio_validation_status text null`
- `fingerprint_status text null`
- `antivirus_status text null`
- `warnings jsonb null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

### `import_validation_runs`

Validation pass over an import review.

Columns:

- `id uuid primary key`
- `import_review_id uuid not null references import_reviews(id)`
- `status text not null`
- `started_at timestamptz not null`
- `finished_at timestamptz null`
- `summary jsonb null`
- `error_message text null`
- `created_at timestamptz not null`

### `import_validation_factors`

Explainable validation factors.

Columns:

- `id uuid primary key`
- `import_validation_run_id uuid not null references import_validation_runs(id)`
- `import_review_file_id uuid null references import_review_files(id)`
- `factor_key text not null`
- `result text not null`
- `points numeric(6,2) null`
- `reason text not null`
- `details jsonb null`
- `created_at timestamptz not null`

### `import_operations`

Applied move/copy/hardlink operations.

Columns:

- `id uuid primary key`
- `import_review_id uuid not null references import_reviews(id)`
- `operation_type text not null`
- `source_path text not null`
- `destination_path text not null`
- `status text not null`
- `started_at timestamptz null`
- `finished_at timestamptz null`
- `error_message text null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

## Audio Identity And Quality Tables

### `audio_fingerprints`

Cached local audio fingerprints.

Columns:

- `id uuid primary key`
- `library_file_id uuid null references library_files(id)`
- `import_review_file_id uuid null references import_review_files(id)`
- `algorithm text not null`
- `algorithm_version text null`
- `duration_seconds integer null`
- `fingerprint text not null`
- `status text not null`
- `created_at timestamptz not null`

### `acoustid_lookup_runs`

AcoustID lookup job history.

Columns:

- `id uuid primary key`
- `audio_fingerprint_id uuid not null references audio_fingerprints(id)`
- `status text not null`
- `started_at timestamptz not null`
- `finished_at timestamptz null`
- `error_message text null`
- `created_at timestamptz not null`

### `acoustid_lookup_results`

AcoustID returned recordings.

Columns:

- `id uuid primary key`
- `acoustid_lookup_run_id uuid not null references acoustid_lookup_runs(id)`
- `acoustid_id text null`
- `score numeric(8,5) null`
- `metadata_recording_id uuid null references metadata_recordings(id)`
- `musicbrainz_recording_id uuid null`
- `musicbrainz_release_group_id uuid null`
- `match_status text null`
- `raw_payload jsonb null`
- `created_at timestamptz not null`

### `quality_profiles`

Quality and upgrade policy.

Columns:

- `id uuid primary key`
- `name text not null unique`
- `is_default boolean not null default false`
- `upgrades_enabled boolean not null default false`
- `upgrade_floor text null`
- `upgrade_ceiling text null`
- `rules jsonb not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

### `library_quality_snapshots`

Current or historical quality classification for a file.

Columns:

- `id uuid primary key`
- `library_file_id uuid null references library_files(id)`
- `import_review_file_id uuid null references import_review_files(id)`
- `quality_profile_id uuid null references quality_profiles(id)`
- `quality_bucket text not null`
- `is_upgradeable boolean not null default false`
- `rip_confidence text null`
- `factors jsonb null`
- `created_at timestamptz not null`

### `quality_upgrade_decisions`

Explainable upgrade eligibility decisions.

Columns:

- `id uuid primary key`
- `wanted_item_id uuid null references wanted_items(id)`
- `managed_track_id uuid null references managed_tracks(id)`
- `library_file_id uuid null references library_files(id)`
- `quality_profile_id uuid not null references quality_profiles(id)`
- `decision text not null`
- `reason text not null`
- `factors jsonb null`
- `created_at timestamptz not null`

## Release Monitoring Tables

### `release_detection_runs`

Scheduled or manual release detection run.

Columns:

- `id uuid primary key`
- `managed_artist_id uuid not null references managed_artists(id)`
- `metadata_refresh_run_id uuid null references metadata_refresh_runs(id)`
- `status text not null`
- `started_at timestamptz not null`
- `finished_at timestamptz null`
- `summary jsonb null`
- `error_message text null`
- `created_at timestamptz not null`

### `release_detection_events`

Detected release changes.

Columns:

- `id uuid primary key`
- `release_detection_run_id uuid not null references release_detection_runs(id)`
- `managed_artist_id uuid not null references managed_artists(id)`
- `metadata_release_group_id uuid null references metadata_release_groups(id)`
- `metadata_release_id uuid null references metadata_releases(id)`
- `event_type text not null`
- `decision text null`
- `details jsonb null`
- `occurred_at timestamptz not null`
- `created_at timestamptz not null`

### `release_redirects`

Provider merge/redirect tracking.

Columns:

- `id uuid primary key`
- `provider text not null`
- `old_source_id text not null`
- `new_source_id text not null`
- `entity_type text not null`
- `detected_at timestamptz not null`
- `created_at timestamptz not null`

## Background Job Tables

### `background_jobs`

Durable Postgres-backed work queue.

Columns:

- `id uuid primary key`
- `job_type text not null`
- `status text not null`
- `priority integer not null default 100`
- `payload jsonb not null`
- `scheduled_for timestamptz not null`
- `started_at timestamptz null`
- `finished_at timestamptz null`
- `attempt_count integer not null default 0`
- `max_attempts integer not null default 3`
- `locked_by text null`
- `locked_at timestamptz null`
- `last_error text null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Indexes:

- `(status, scheduled_for, priority)`
- `(job_type, status)`

### `background_job_events`

Job lifecycle history.

Columns:

- `id uuid primary key`
- `background_job_id uuid not null references background_jobs(id)`
- `event_type text not null`
- `message text null`
- `details jsonb null`
- `occurred_at timestamptz not null`
- `created_at timestamptz not null`

## Planned Future Tables

These are planned but can be deferred until the related feature is implemented.

### Antivirus

- `antivirus_scan_runs`
- `antivirus_scan_results`
- `antivirus_quarantine_items`
- `antivirus_signature_status`

### Transcoding

- `transcode_profiles`
- `transcode_jobs`
- `transcode_job_events`
- `transcode_outputs`

### Advanced Search

- `search_saved_views`
- `search_result_selection_sets`
- `search_result_exports`

## Initial Indexing Strategy

Minimum indexes:

- Every foreign key column.
- Every unique natural provider ID.
- `wanted_items(status, next_search_after)`.
- `missing_items(status, missing_type, managed_artist_id)`.
- `search_jobs(status, created_at)`.
- `search_result_files(search_attempt_id)`.
- `search_result_files(soulseek_user_id, folder_path)`.
- `source_candidates(wanted_item_id, status, overall_score)`.
- `download_jobs(status, created_at)`.
- `import_reviews(status, created_at)`.
- `background_jobs(status, scheduled_for, priority)`.
- `library_files(canonical_path)`.
- `soulseek_users(username)`.
- `database_health_checks(check_type, occurred_at)`.
- `database_maintenance_runs(maintenance_type, started_at)`.
- `database_self_healing_events(event_type, occurred_at)`.
- `database_backup_runs(status, started_at)`.
- `error_log(error_id)`.
- `error_log(level)`.
- `error_log(module)`.
- `error_log(resolved)`.
- `error_log(correlation_id)` where `correlation_id is not null`.
- `error_log(reason_code)` where `reason_code is not null`.
- `error_log(sql_state)` where `sql_state is not null`.
- `error_log_events(error_log_id, occurred_at)`.
- `app_log(level)`.

Optional later indexes:

- BRIN indexes for append-mostly timestamp columns once tables are large enough, especially audit, provider request, dependency event, transfer event, background job event, and database health tables.
- BRIN indexes for `error_log(created_at)` and `app_log(created_at)` once log volume grows.
- Partial B-tree index for unresolved errors, such as `error_log(created_at desc) where resolved = false and level = 'ERROR'`.
- GIN trigram indexes for artist, album, track, filename, and folder matching.
- Full-text indexes for metadata search.
- Partial indexes for active rows where `deleted_at is null`.
- Partial indexes for hot operational queues, such as `status in ('pending', 'running')`.
- Per-table fillfactor and autovacuum settings for high-churn tables after real write patterns are known.

## Open Schema Questions

- Should UUIDv7 be generated by the application, by PostgreSQL 18 `uuidv7()` defaults, or both depending on table?
- Should `missing_items` be a table projection, materialized view, or ordinary view?
- Should status constraints be broad in v1 to reduce migration churn, or strict from the start?
- Should raw provider payload retention be time-limited by default?
- Should library file records use soft deletion or scan-run observations only?
- Should local app users be required in v1, or should first release support a single admin only?
- Should Harmoniarr include an authenticated database maintenance page in v1, or keep maintenance visible only through logs and health endpoints first?

## Sources Reviewed

PostgreSQL 18 official sources:

- [PostgreSQL 18 release announcement](https://www.postgresql.org/about/news/postgresql-18-released-3142/)
- [PostgreSQL 18 release notes](https://www.postgresql.org/docs/18/release-18.html)
- [PostgreSQL 18 UUID type](https://www.postgresql.org/docs/18/datatype-uuid.html)
- [PostgreSQL 18 UUID functions](https://www.postgresql.org/docs/18/functions-uuid.html)
- [PostgreSQL 18 generated columns](https://www.postgresql.org/docs/18/ddl-generated-columns.html)
- [PostgreSQL 18 constraints](https://www.postgresql.org/docs/18/ddl-constraints.html)
- [PostgreSQL 18 initdb](https://www.postgresql.org/docs/18/app-initdb.html)
- [PostgreSQL 18 pg_stat_statements](https://www.postgresql.org/docs/18/pgstatstatements.html)
- [PostgreSQL 18 index types](https://www.postgresql.org/docs/18/indexes-types.html)
- [PostgreSQL 18 BRIN indexes](https://www.postgresql.org/docs/18/brin.html)
- [PostgreSQL 18 explicit locking and advisory locks](https://www.postgresql.org/docs/18/explicit-locking.html)
- [PostgreSQL 18 resource consumption and async I/O settings](https://www.postgresql.org/docs/18/runtime-config-resource.html)
- [PostgreSQL 18 client connection timeout settings](https://www.postgresql.org/docs/18/runtime-config-client.html)

Docker/Postgres container sources:

- [Docker PostgreSQL data persistence guide](https://docs.docker.com/guides/postgresql/immediate-setup-and-data-persistence/)
- [Postgres Docker Official Image](https://hub.docker.com/_/postgres)
- [docker-library Postgres README](https://github.com/docker-library/docs/blob/master/postgres/README.md)
