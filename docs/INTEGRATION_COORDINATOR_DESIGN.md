# Opt-in complete integration coordinator design

Date: 2026-10-15. Scope: a new opt-in complete integration command, on main,
without changing the default serial glob or creating a release/tag/branch.

## Plan and ownership

Discover the same `test/integration/**/*.test.js` population as the default gate
with Node's filesystem glob. Resolve every file against the canonical workspace;
refuse escaped paths, aliases, duplicate discoveries, non-files and a missing
member of the reviewed seven-file PostgreSQL cohort before native allocation.
Freeze a deterministic plan: the audited cohort in its existing reviewed order,
then all remaining files in lexical order. Grouping changes global file order;
it preserves the relative order of all isolated files. Flattening the plan must
cover exactly the discovered set, once each. The CLI accepts only the complete
run or `--plan`; neither path supports a hidden partial selection.

Use the existing `runSharedPostgresTests` once, with its current registration,
OID identity, worker-absence, reconciliation and awaited server cleanup. Reuse
`runPostgresTestFile` for every actual file, including isolated files. Retain
its pinned serial Node invocation, early failures, actual close/output drainage
and owned-tree cancellation. Add no registry, process terminator, schema cache,
concurrency, database sharing across runs or lifecycle implementation.

## Completion and evidence

Reuse the existing native cohort reporter and bounded evidence validator for
every file. Require a successful native root summary, nonzero cases and no
failure/cancellation/skip/TODO. Missing or duplicate evidence and signalled exits
refuse success. A zero process exit alone does not establish coverage.

Verify shared dispatch order and exact once-only invocation; await shared owner
release and check completed-file/registration/release/zero-reaping totals before
publishing that step as completed. Await each progress sink before admitting
another step. Preserve original Error/null from native or observer failures;
stop later admission after failure/cancellation. Complete means every selected
file passed and all owning steps returned, not that an aborted plan ran every
file. The failure report retains completed coverage and marks the remainder
incomplete. Cancellation delegates to the current owner and awaits its result.

## Environment and security

Snapshot/copy environment values; remove inherited PG/POSTGRES and parent-control
credentials, NODE_OPTIONS and NODE_TEST_CONTEXT, including case variants. Force
cross-run container reuse off. Retain explicit image/tool prerequisites and
existing resource/schema/diagnostic controls. Each isolated file receives a fresh
copy of the base snapshot, never the shared child's private credentials.
Do not change pools, timeouts, native assertions or production modules.

The plan publishes relative file paths; progress publishes bounded counts and
digests, never credentials or raw exception messages. Native output remains
independent and must be captured privately when retaining evidence. A disposable
test container isolates state, not host CPU capacity. Missing media/Linux
prerequisites must remain visible refusals; do not silently skip or retry them.
The Linux socket reader requires both Node 24 and the Docker CLI, as supplied by
the existing [reader fixture](../testing/docker/media-linux-socket.Dockerfile).
An image identity/OS check alone does not establish those capabilities. Inspect
`--plan` and verify the existing image/tool prerequisites before a long run.
The startup-server controls require the reviewed PostgreSQL 18 Alpine reference;
the existing capability policy recognizes `postgres:18-alpine@sha256:...`.
Resolve a digest-qualified reference from actual image metadata and verify its
current ID/OS. A bare opaque image ID does not enable that logging capability.
Do not loosen image admission or diagnostic assertions to make a control pass.

## Validation

Use pure and temporary-workspace selection tests, duplicate/escaped-alias and
missing-cohort refusals, held native/shared cleanup/progress controls, Error/null
and cancellation tests, environment canaries and actual native reporter/process
coverage. Freeze code before the full fast gate and the new complete command.
Compare the plan to an independent filesystem inventory and retain all executed
file digests/counts. Existing adverse parent/process controls remain authoritative.
Keep failures, later collections and unchanged-code evidence separate; no default
promotion or whole-CI speed claim follows from one successful local run.

See [official research/options](INTEGRATION_COORDINATOR_RESEARCH_2026_10.md)
and [outcome](INTEGRATION_COORDINATOR_OUTCOME.md).

## Discovered fixture contract repair

The remainder run exposes an existing discography-page fixture passing a pool
as a borrowed transaction to upsertOperatorTrackOverride. The production metadata
write owner correctly rejects its LOCK in autocommit. Remove only that seed
argument so the existing store opens/commits its own guarded transaction. Keep
all page hydration, query-count, actor isolation and HTTP assertions. Freeze
this final fixture revision separately; reuse earlier evidence only for unchanged
files and retain both failed scopes rather than repeating already-passed work.
