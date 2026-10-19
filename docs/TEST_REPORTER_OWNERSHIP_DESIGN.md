# Test reporter ownership design

Date: 2026-10-19. Follow the [CSRF outcome](CSRF_DEFAULT_PROTECTION_OUTCOME.md)
by removing the repeated TestsStream listener warning at its actual owner.

The installed Node 24.18.1 CLI composes each configured reporter against one
root TestsStream. A two-test, database-free fixture with spec, early-failure and
cohort reporters reproduces 11 end listeners and a pipeline/compose warning.
This establishes configuration fan-out, not an accumulating application leak or
a PostgreSQL cause. Do not remove Node-owned listeners or raise warning limits.

## Selected architecture

Keep native spec on stdout. For cohort-enabled processes, use one custom async
generator on stderr that both emits early bounded failure records and accumulates
the existing cohort result. Extract the existing cohort event accumulator into a
small ESM module; share it with the standalone cohort reporter. Keep the existing
early formatter as the only failure-record formatter. Non-cohort commands keep
their current spec plus early-failure configuration.

The combined reporter consumes each event once. It yields early failures before
asking for a later event, applies existing case/path/phase framing bounds and
emits exactly one final cohort record only after source exhaustion. Source error,
early consumer return or accumulator refusal must not publish a final record.
Parent admission retains strict record/count/result validation.
Do not add tee queues, private Node hooks, detached drains or another event bus.

Native subprocess ownership remains with postgres-file-process.js: preserve
serial execution, separate output destinations, original errors/cancellation,
output backpressure, process close and verified termination. Cohort admission
still rejects skips, duplicate/missing summaries, nonzero exit and signals.

## Validation and dependency evaluation

Prove one-pass consumption, early output before a held later event, exact cohort
equivalence, EOF gating, Error/null identity and source finalization on return.
Exercise native spec plus combined reporting on passing/skipped/failing fixtures:
retain counts/digests/phases, strict refusal, native failure exit and unchanged
warning limits, with no listener warning. Keep normal spec output independent.
Run existing process/coordinator/cancellation/reporting tests, selected real
PostgreSQL files, and the fast gate on stable final source.

Random PR 45's nine development-tool updates are a separate local candidate.
Record immutable base/head and opening/candidate package bytes, then install
without lifecycle scripts. Qualify lint/build, actual PostgreSQL/TLS lifecycle,
Chromium application and language-server consumers before retaining the group.
Reject or explicitly narrow a failing/unqualified candidate rather than merging
the PR. No branch, tag or release is created; implementation stays on main.
