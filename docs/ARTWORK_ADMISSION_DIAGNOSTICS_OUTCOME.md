# Artwork admission diagnostics outcome

October 25, 2026. Implements the [design](ARTWORK_ADMISSION_DIAGNOSTICS_DESIGN.md)
and [official-source research/recommendations](ARTWORK_ADMISSION_DIAGNOSTICS_RESEARCH.md).
The [Docker outcome](LOCAL_DOCKER_ARTWORK_ADMISSION_DIAGNOSTICS_OUTCOME.md)
documents the separate no-cache rebuild and preservation evidence.

## Delivered behavior

Existing administrator-only system overview, queue diagnostics and diagnostics
export now include a fixed projection of the actual ingestion gate. The snapshot
contains active/queued jobs, queued input bytes, logical reservation/budget bytes
and configured concurrency, queue count/input and wait limits. One synchronous
owner read supplies the counters; no queue entries, paths, URLs, payloads, peer
details, errors or history are exposed. Export applies the same explicit allowlist.
All three delivery routes now declare no-store.

The ingestion service exposes its own admission snapshot and app/system wiring
passes that service through unchanged. Small ESM modules own numeric validation,
runtime projection, binary-unit presentation and the rendered panel. Missing,
invalid or failed observations remain unavailable rather than becoming idle zeroes.
This introduces no gate, timer, collector, schema or tuning policy.

Recovery diagnostics shows live admission and the existing monitor's cached web-
process sample with separate timestamps. Logical reservations are not measured
RSS. The web-process sample excludes artwork child workers, FFmpeg and PostgreSQL;
ArrayBuffers overlap external memory and are not an additive total. Values use
MiB; small nonzero inputs display `<0.1 MiB` rather than rounded zero.

The existing manual-refresh/load request supplies the panel, with no additional
HTTP request, SQL query, provider-health check or native launch for queue
diagnostics. Overview/export retain their existing health checks. A persistent
polite status reports loading/completion and an alert reports errors; the whole
metric panel is not a live region. Refresh retains focus using aria-disabled plus
an activation guard while pending. No focus is moved on completion. The adjacent
queue overview now reads real nested queueState fields, with Pending/Running/
Failed/Tracked values instead of obsolete fields that silently displayed zero.

Recommended stack remains actual gate ownership → fixed numeric projection →
administrator/no-store transport and export allowlist → separate logical/process
labels and clocks → existing refresh lifecycle with quiet status feedback.
The benefit is bounded, useful visibility; the limit is that snapshots have
different observation times and establish no container-wide capacity guarantee.

## Fresh validation

- 64 focused projection, gate ownership, ingestion, composition, runtime monitor,
  route and export checks passed. Actual gate tests cover queued cancellation,
  active abort retaining ownership until settlement, detached snapshots and final
  zero reservation. Invalid numbers, inconsistent state and unknown properties
  cannot become serialized observations.
- One stable fast gate passed 11,184 tests: 6,003 server, 4,481 client and 700 scripts,
  plus required lint, ESM, copyright, migration/schema, topology, hygiene and builds.
- One guarded native HTTP/PostgreSQL test passed on the rebuilt image in a fresh
  3 GiB/two-CPU/no-swap/256-PID disposable profile. Actual app/system/artwork
  composition observed one active and one queued owner, 800 queued input bytes
  and 1,350,566,688 reserved bytes. Overview/export agreed; subsequent reads showed
  zero active, queued, input and reserved values. Cached process sampling was
  independent. Queue reads made zero provider checks; overview/export made their
  existing two checks. No image worker was launched and no asset row was created.
- Ten browser tests passed: the new panel scenario plus nine existing settings
  authority checks. They cover initial held loading and blocked repeat activation,
  populated/unavailable/error/retry states, refresh focus, correct nonzero queue
  values, filtered private fields and separate sample times. Existing real-session
  barriers, anonymous/operator/requester refusal, legacy links and revocation
  behavior remain correct.

The browser used controlled numeric responses for the new panel; the native test
separately proves real delivery/composition. Held native-test tasks are logical
owners, not image encodes or physical allocation of the reserved bytes. This is
not a new codec/memory-performance qualification. At a 390-pixel viewport the
document width was 390 and the panel occupied x=29…361 without overflow; captured
mobile viewport rendering was inspected. Browser automation does not replace
screen-reader/physical-device acceptance; previously deferred human checks remain
pending.

Preflights caught an incorrect expectation about the export's existing health
checks, a fixture locator error and the actual native-disabled Refresh focus
loss. Those were corrected before the stable gate; failed logs are retained and
excluded from final passing counts. Both development native containers and the
final native container were retired, as were builder/bootstrap/inventory/identity
helpers. Browser runtimes completed awaited cleanup.

## Scope and retained evidence

Existing worker allocation, reservation policy, FIFO admission, encoder deadlines,
source sanitization, framing and publication/cancellation logic are unchanged.
The gate/ingestion edits add read-only accessors. Six native binary hashes and all
dependencies match. The preceding 43 artwork/mixed native checks, 42 SQL and nine
unrelated review browser checks, controlled-provider and file-backed chains are
retained historical evidence after source/driver/runtime review, not fresh runs.
Current native HTTP and settings browser proof address the changed composition
and delivery boundaries. No new deployment minimum, throughput increase, live
provider transfer or manual accessibility acceptance is claimed.

Private evidence lives under `.tmp/artwork-admission-diagnostics-2026-10-25/`.
The stable 3,513-file source fingerprint is
`c749af281dfaa5b54f8f1a3d0284b2d187e0b1a19a8247012618c2adb50a0c7d`.
No code changed after the stable gate or rebuild. Existing CRLF/mixed file endings
were preserved; Git whitespace checks accept CR line endings while still checking
trailing spaces. GitHub MCP searches at start/final review found no open PRs.
All project changes are committed/pushed on main without a release or branch.

## Next recommendation

Continued in the [Recovery diagnostic event outcome](RECOVERY_DIAGNOSTIC_EVENTS_OUTCOME.md),
with separate [design](RECOVERY_DIAGNOSTIC_EVENTS_DESIGN.md) and
[research](RECOVERY_DIAGNOSTIC_EVENTS_RESEARCH.md). The recommendation below
records the display-contract gap identified at the end of this implementation.

Correct the remaining Recovery diagnostics field mappings for recent failures and
privileged actions. The service returns errorMessage/finishedAt/eventType, while
the view still expects recentFailureMessage/recentFailureAt/eventName in those
adjacent sections. Use a small presentation module and actual service-shaped
fixtures, preserve redaction/authorization, and verify meaningful messages and
timestamps. This is an existing display-contract gap, separate from the completed
admission projection; no memory reservation reduction is recommended.
