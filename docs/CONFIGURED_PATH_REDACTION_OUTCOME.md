# Configured-path redaction outcome

October 25, 2026. Implements the follow-up from
[Recovery diagnostic events](RECOVERY_DIAGNOSTIC_EVENTS_OUTCOME.md). See separate
[design and tradeoffs](CONFIGURED_PATH_REDACTION_DESIGN.md),
[official research](CONFIGURED_PATH_REDACTION_RESEARCH.md) and
[no-cache Docker outcome](LOCAL_DOCKER_CONFIGURED_PATH_REDACTION_OUTCOME.md).

## Delivered behavior

Recovery, queue diagnostics and support exports now construct an immutable shared
redactor from current saved settings. A small ESM matcher handles configured
downloads/music/staging/transcode roots, download mappings and application-data
storage alongside the existing structured-key, credential and known-root policy.
It preserves POSIX spelling, handles Windows/UNC case/separator variants, escapes
regex metacharacters and respects root component boundaries. Quoted paths may
contain spaces, apostrophes, commas and Unicode. Unquoted path tails are removed
conservatively to avoid exposing remaining filename components.

The new matcher avoids public URL/API tokens. Existing known-root regex behavior
remains; this is not a blanket guarantee about every URL, path or secret. Queue
messages/runtime data, Recovery audit summaries and nested export passthrough
fields receive the shared policy. Stored rows are unchanged. Subsequent requests
use newly saved settings; no mutable singleton, root history or per-event database
read was introduced. Composite exports still invoke nested readers and therefore
perform a fixed number of settings reads. Missing settings fail the request.

## Validation and boundaries

- 22 focused checks pass, including adversarial path syntax, existing secret
  policy, fixed settings-read counts, subsequent saves and settings failure.
- Final stable fast gate: 11,197 passing tests (6,012 server, 4,485 client and
  700 scripts), lint, repository checks and production build. Source fingerprint:
  3,520 files, `c39fde195e632f183ea136c5c3312fe0fa537dde5ee4e24c24bd7bca351dd3e0`.
- All 11 browser checks pass. A service-derived custom Unicode path is absent
  from the Recovery cards; HTML remains escaped, rows stay distinct and refresh
  focus survives. The 390px screenshot was inspected. Real screen-reader/device
  acceptance remains deferred as requested.
- Packaged PostgreSQL/HTTP checks and final runtime comparison are recorded in
  the Docker outcome. Existing SQL/native/media/provider evidence is retained
  through exact source/package review, not represented as new executions.

The first candidate was rebuilt again after review found legal literal POSIX
backslashes being normalized as Windows separators. Final focused/full checks
and the final image include the correction. Failed/provisional evidence remains
private rather than being overwritten. Native tests remain opt-in; the fast gate
gains only cheap matcher/service checks, and the existing browser scenario is reused.

GitHub MCP returned zero open PRs on both checks for `cloudbyday90/Harmoniarr`.
No random PR could be applied, merged, rebased or closed. Work stays on `main`;
no release, version, dependency or schema change is part of this commit.

## Next recommended item

Move filesystem failures at their producer boundaries toward a safe error code,
operation context and explicitly path-owned fields. Start with restore and
import/reconciliation failures. This preserves useful explanation without guessing
unquoted path endings and protects historical failures after configured roots
change. Do not build an unbounded cache of old private roots.

A separate test-efficiency follow-up should profile the two slow server unit
fixtures observed during the fast gate: canonical naming and import-candidate
service tests. The final server suite took 69.6 seconds while the focused boundary
checks took under a second. Investigate implicit I/O/timeouts before changing
concurrency or weakening checks; idle process observations alone do not establish
the cause. Keep native/media matrices opt-in and reuse exact unchanged evidence.
