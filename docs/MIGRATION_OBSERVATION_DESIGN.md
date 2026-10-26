# Prepared migration observation design

October 26, 2026. Follows the next item in the
[readiness diagnostics outcome](READINESS_DIAGNOSTICS_OUTCOME.md).
See separate [research/tradeoffs](MIGRATION_OBSERVATION_RESEARCH.md) and
[outcome](MIGRATION_OBSERVATION_OUTCOME.md).

The system overview already uses schema-migration-status-service.js. Change the
default dependency in onboarding-summary-service.js, backup-export-service.js and
backup-restore-preview-service.js to that same reader. Preserve the injectable
getMigrationStatusFn contract and its available/applied/pending data shape. Add no
new singleton, pool, deployment service, schema table, migration or cache.

The reader observes packaged filenames and applied migration rows through the
existing store. It does not create or replace schema objects. Preparation remains
owned by startup/CLI paths. A missing table propagates as a database failure;
onboarding retains its existing attention fallback, while export and preview
retain their failure behavior. Do not convert an unavailable read into success or
repair schema from these services. Existing fallback wording is outside this patch.

Backup export remains an explicit fresh-admin, CSRF-protected, idempotent POST
that publishes an encrypted/plaintext artifact according to current configuration.
Only its migration observation changes. Its recovery, filesystem, manifest, audit
and journal authority remain intact. Restore preview still reads/validates bytes,
checks current migration compatibility and reports maintenance locks; preview does
not grant new restore authority. Restore apply independently rechecks its existing
requirements. Pending migration counts and artifact migration levels retain their
current meaning.

Set no-store after administrator authorization on onboarding and restore-preview
GET responses. Keep route payloads and client behavior stable. This is a cache
policy for operational snapshots, not a new authorization or transport mechanism.

Qualification uses a guarded disposable packaged PostgreSQL database. After
normal preparation, install a fixture-only ddl_command_start trigger that rejects
supported schema writes. Verify the guard by rejecting the legacy preparing
helper, then exercise production-default reader selection through real HTTP routes.
Controlled provider status avoids live network dependencies; database, auth,
filesystem, encryption, idempotency, audit and journal work remain real.

Check a READ ONLY transaction, concurrent onboarding/preview reads overlapping
backup creation, pending-state compatibility, missing-schema refusal and the
original UUID-function catalog identity. Verify encrypted bytes/hashes and actual
restore apply under the guard. The guard's enable/disable row is fixture-only;
the test creates no production bypass. Renaming the migration table or changing
a row status is restricted to this guarded tmpfs database and restored before
cleanup. Shared-object DDL and all domain writes are outside the guard's claim.

The opt-in test/native/migration-observation.test.js entry requires the existing
deployment-memory profile guard. Use the immutable image's /app/server-dist and
/app/shared, network disabled, UID 1000, read-only root, 3 GiB/2 CPU/256 PIDs,
disposable tmpfs /app/data and the standard /tmp, PostgreSQL socket and four /data
roots. Mount the test and testing/server fixtures read-only. Never mount preserved
walkthrough data into this qualification. The profile is a test limit, not a
minimum-memory recommendation.

Retain unchanged startup, backup publication/recovery and codec qualification only
after exact source/package comparison. The native test owns the changed service
composition. A Windows directory-fsync failure must remain a failed checkpoint;
Linux validation does not establish Windows filesystem support.
