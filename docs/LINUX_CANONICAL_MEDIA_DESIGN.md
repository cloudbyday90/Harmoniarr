# Explicit Linux canonical media validation design

Date: 2026-10-15. Scope: the existing six-case Add to library cohort, selected
explicitly rather than an automatic scaling matrix or a new execution default.

## Admission and evidence

`validate:linux-canonical-media` accepts no file overrides or filters. Its pure
policy requires Linux/Node 24, a complete immutable local image ID, fresh default
PostgreSQL 18 ownership, pool max two, checkout ten seconds and scenario ninety
seconds. Borrowed PostgreSQL/parent registrations, reuse and contradictory media
selections refuse before PostgreSQL starts. Read-only preflight verifies local
CLI/API daemon identity and reviewed API 1.56 support, checks the actual image
identity/Linux OS and awaits reader disposal. No image is implicitly pulled.

The lane pins its child environment to that acknowledged local endpoint. The
canonical executor still performs its own bootstrap/configuration checks. The
standalone lane temporarily owns/restores its complete environment, rejects
overlapping ownership and consumes the native Node TestsStream for exactly the
literal canonical file. No force-exit or extra parallelism is introduced.
Eval/print/input-type entrypoints, including combined short `-pe`, refuse before
preflight because the native runner can inherit those execution arguments.

The bounded evidence accumulator discards unrelated test output. It requires one
successful cumulative summary with six passed tests, one suite and zero failures,
cancellations, skips or TODOs. Six ordered media records must retain generation/
inspection pairs 1/4, 0/0, 0/0, 0/0, 3/11 and 4/12. Every fixed transport phase
must complete the expected actual count with no failed/pending/untimed/clipped
work. Three created owners must be removed and every cleanup predicate true.
Missing, malformed, oversized or contradictory evidence permanently refuses.

After evidence failure, the lane drains the returned native event stream before
restoring its environment and rejecting. Original Error/null survives later
stream/reader cleanup fallout. Existing app/worker/database/workspace owners
retain their actual completion and uncertain-artifact contracts. The public
result contains only fixed aggregate counts, selected platform/runtime/API and
monotonic elapsed duration; no SQL, credentials, private paths or payloads.

## Modular implementation and CI

- `linux-canonical-media-policy.js`: selection and bounded evidence rules.
- `linux-canonical-media-preflight.js`: existing local reader plus image checks.
- `linux-canonical-media-lane.js`: environment ownership, native stream drainage.
- `scripts/validate-linux-canonical-media.js`: standalone signal/error/result CLI.
- Manual-only `linux-canonical-media.yml`: read-only checkout, capability check
  before install/build, local immutable media image and complete lane execution.

The workflow deliberately fails if its selected runner lacks reviewed Engine
capability; it does not install an unreviewed daemon or silently downgrade to
CLI. No workflow dispatch, hosted-CI success, release or image publication is
implied by a local replay. Existing general validation/default media mode stays.

## Local Linux replay from Docker Desktop

The fixture Dockerfile builds a trusted Linux Node runner using a discovered
immutable Node image and locked npm dependencies. Its specific ignore file
admits only required source/test/package paths, never `.git`, host credentials,
data or `.tmp`. The normal production Dockerfile/context policy is unchanged.

A trusted runner needs the daemon socket and connectivity to its fresh PostgreSQL
sibling. This is privileged test infrastructure, not a sandbox. Media containers
still have no socket, network access or writable inspection mount. Keep Testcontainers'
normal reaper enabled and preserve the real app/worker teardown.

For Desktop replay, create an exactly labeled local volume and inspect its
acknowledged daemon Mountpoint. Mount that volume into the runner at the exact
same Linux absolute path and use that path as TMPDIR. Nested media bind sources
then exist at the same daemon/runner path. A generic `/fixtures` mount would not
establish this. Verify stopped runner identity before removal; on failed or
uncertain proof retain the workspace volume. Never delete or guess another
fixture's storage. Native Linux hosts can run the npm command directly.

See separate [research](LINUX_CANONICAL_MEDIA_RESEARCH_2026_10.md) and
[outcome](LINUX_CANONICAL_MEDIA_OUTCOME.md) for trade-offs and executed evidence.
