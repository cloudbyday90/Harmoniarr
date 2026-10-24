# Minimal read-only review scope outcome

October 24, 2026. Completed the chooser/detail follow-up from
[minimal qualification facts](QUALIFICATION_CANDIDATE_FACTS_OUTCOME.md). The separate
[design](QUALITY_REVIEW_READ_SCOPE_DESIGN.md) owns the boundary and
[research](QUALITY_REVIEW_READ_SCOPE_RESEARCH.md) records official guidance,
alternatives and tradeoffs.

## Implemented behavior

The alternative-page service now uses the same minimal owned-review and failed-
candidate policy reader as restart qualification. Both share the canonical scope
calculation. The existing full scope and child locks remain on selected-candidate
commands. The `readQualificationScope` entry point remains compatible with callers;
no new public route, cache, schema, dependency or application service was added.

Each chooser/detail read avoids the redundant failed full-row/file collection.
Current household/recipient access, active qualification, candidate revisions,
signed cursor context, eligible scan budget and public presentation retain their
existing ownership. GET leaves domain work/evidence unchanged. Selection and
restart still reauthorize at their existing mutation boundaries.

## Validation and scope

- Seventeen focused reader/store/cursor/scan cases passed. The completed stable
  fast gate passed 11,114 tests: 5,934 server, 4,480 client and 700 scripts, plus
  lint, repository policies and production builds. Code stayed frozen afterward.
- Forty-two PostgreSQL cases across ten files passed: new read scope, shared
  policy parity, paging/shortlist/bounded scans, selected commands, restart,
  qualification locks and initial preflight review.
- Actual full/minimal pages with one navigation key/clock match exactly in each
  direction. A large failed candidate has unrelated payload and 2,048 extra files;
  two real HTTP page GETs emit exactly two minimal failed-candidate fact queries,
  with no full row/files/decisions/raw payload or mutation locks in that subread.
  Public review/choices remain safe, and runs, audits, events and discovery
  evidence do not change. An initial test assertion incorrectly equated reverse
  navigation metadata with first-page metadata; it now compares their candidate
  lists, while full/minimal comparison still checks each complete directional page.
- HTTP proof retains owner access, foreign-target refusal, actor-bound cursor
  refusal, legacy 640 kbps floor, stale continuation, malformed track marker and
  disabled shared-recipient refusal.
- The shared 27-case SQL fixture now compares cursor-context digests alongside
  quality, search requirement and durable progress. It retains five explicit
  malformed/stale refusals and 2,048 files/2,048 decisions. Host PostgreSQL 18.3
  returns at most 921 minimal versus at least 1,188,240 full serialized bytes.
  The same updated fixture passed on packaged PostgreSQL 18.6.
- Nine browser cases across six suites passed, including checking/reload/queued,
  continuation, keyboard/focus, stale refresh, selection and preflight feedback.
- Updated standards/testing skills pass their validator. The practical
  [read-scope reference](../.agents/skills/harmoniarr-web-standards/references/quality-review-read-scope.md)
  records access, exact cursor parity, GET observation and independent commands.

The [Docker outcome](LOCAL_DOCKER_QUALITY_REVIEW_READ_SCOPE_OUTCOME.md) owns the
preserved-state no-cache rebuild and packaged verification. Unchanged query-plan,
revision and fence native component evidence is retained after exact source/test/
runtime comparison rather than rerunning unrelated benchmarks. No schema changed.
GitHub MCP found no open PRs at selection or final recheck, so no random PR, merge,
stale cleanup or rebase applied. Human screen-reader/device checks remain deferred.

## Recommendation and next item

Adopt authenticated target resolution, minimal SQL policy facts, current active-run/
revision checks, signed bound cursors, bounded scans and existing status/focus
behavior. Benefits are smaller failed-candidate results and fewer irrelevant
allocations; costs are the explicit field contract and remaining outer projection,
required-array and JSONB decompression work. No whole-request RSS, I/O or latency
improvement is asserted from fixture bytes.

Next: **qualify bounded mixed review and media workloads in the packaged single
application container**. Exercise overlapping detail pagination/restart and actual
scan/media work using existing admission/lease owners. Capture cgroup usage/peak,
OOM counters, process memory and request latency separately, prove actual overlap
and retirement, and keep original bytes intact. Use those measurements to choose
the next memory control before further speculative query or deployment changes.
