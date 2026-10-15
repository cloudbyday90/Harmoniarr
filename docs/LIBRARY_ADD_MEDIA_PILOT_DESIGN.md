# Canonical library-add media pilot design

Date: 2026-10-15. Scope: test infrastructure for one reusable canonical cohort.

## Problem and decision

`missing-music-add-to-library.test.js` starts a fresh Docker container for each
ffprobe inspection. The owned inspection executor already supports a bounded
local Engine GET reader, but reusable app scenarios previously lacked safe
directory lifetime authority. That prerequisite is now implemented in the
[workspace design](REUSABLE_WORKSPACE_CLEANUP_DESIGN.md).

Pilot that existing executor explicitly in this one cohort. Preserve the
per-command default, local tools, all actual media generation and every existing
business assertion. Do not change production services, SQL, concurrency, pool
size, deadlines, inspection frequency or delivery verification.

## Ownership and modules

`testing/integration/library-add-media-scenario.js` provides stable media
adapters for the app factory and seed helper, and owns a fresh fixture/executor
for each returned scenario. Its options resolver rejects unknown modes and an
imageless `owned-api` selection before PostgreSQL startup. It refuses overlapping
scenarios because this cohort's app/module adapters are serially scoped.

Each callback receives the actual fresh child directory from `app-runtime.js`.
That exact directory is the executor root. Generating audio still uses the
existing writable per-command fixture. Every ffprobe call uses the existing
inspection service through the scoped fixture; there is no metadata cache.
An executor exists only for an opted-in scenario and its native owner starts
lazily on the first admitted inspection. SQL-only scenarios create no media
container.

The runtime first finishes the scenario, HTTP server, workers, shutdown drain
and pool. Its child cleanup predicate then awaits the adapter's one canonical
executor close. Only verified executor safety and an exactly-true caller
predicate permit deletion. A fallback close also runs if the runtime returns
without reaching that predicate. `withWorkerTaskCleanup` preserves the original
Error/null through close failure. Existing workspace ownership makes unsafe
retention sticky through later siblings and outer runtime cleanup.

Do not close inside the business callback: returned app work can still be
draining afterward. Do not clear the active adapter until the actual returned
isolated-database tail settles. The executor keeps its reviewed two-admission,
serial-execution policy; this wrapper introduces no work queue or retries.

## Security and evidence boundaries

Reuse immutable image resolution, local endpoint pinning, private daemon/version
matching, exact owner/configuration checks, read-only nonrecursive media mount,
network-none container and bounded GET reader. Exec/lifecycle mutations remain
CLI operations. The privileged local daemon connection is confined to trusted
host test infrastructure; media containers receive no Docker socket.

Unknown cleanup retains evidence. Directory identity checks are cooperating
fixture checks, not an atomic deletion capability against arbitrary host writes.
The per-command comparator retains its existing short-lived Docker behavior;
this slice does not certify a new cancellation contract for that older path.

Optional diagnostics emit only selected mode, generation/inspection counts,
monotonic scenario/close durations, cleanup safety and existing fixed transport
aggregates. No paths, IDs, SQL, private responses, credentials or ffprobe output
enter this summary. Sink failure cannot replace work/close outcomes.

## Validation and rollout

Use the same literal file and canonical real-file test with reversed-order
per-command/API pairs. Keep authorization, CSRF, paging, idempotent replay,
worker completion, codec and exact delivered-byte/source-removal assertions.
Run the complete six-case cohort in both modes to retain rollback, current
policy/provenance, shared-recipient, low-quality, collision, staging and reuse
refusals. Focused controls cover held close, serial admission, database-tail
reuse refusal, failed close/primary Error/null and child/parent retention.

Use unchanged pool max two, checkout ten seconds and scenario ninety seconds.
Keep larger matrices explicit. A faster focused cohort is not whole-CI evidence
and does not diagnose older incomplete large workloads. See the separate
[research](LIBRARY_ADD_MEDIA_PILOT_RESEARCH_2026_10.md) and
[outcome](LIBRARY_ADD_MEDIA_PILOT_OUTCOME.md) for alternatives and measurements.
