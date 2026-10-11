# Transcode orchestration lifetime design

October 11, 2026. The current worker clears its active marker before lease release
and launches detached orchestration. Its production execution dependency performs
ffmpeg decode/encode preflight with null output. Actual file mutation belongs to
separate apply/organize owners; no direct child-worker launch was found here.

## Selected implementation

Reuse existing ESM task lifecycle, work/cleanup precedence and lease drainage.
Queued start returns a completion handle without waiting for the job. Duplicate
run IDs share that handle through every finalizer. Terminal close seals admission
before awaiting registered work and retains escaped failures including null.

Own returned selected-summary, preview and per-file preflight promises. Drain
admitted renewal before releasing the captured lease, attempting release after a
drain failure. Preserve an escaped work Error/null over cleanup fallout. Expected
lease-unavailable acquisition and lease-lost outcomes retain their policies;
unexpected acquisition errors become observable. Preserve ordinary domain pause,
cancellation and failure outcomes, including lease-coded dependency errors after
acquisition. Null domain failure gets a fixed fallback message.

Keep file/candidate filtering, counters and the existing preflight-only execution
service: binary allowlist, shell-free argv, null output, timeout, output cap and
normal command/stdout closure. No transcode output files, automatic apply/scan
launches, provider retries or new Activity policy are introduced.

Add a narrow ordered worker-owner drain helper. Snapshot the ordered concrete
owners before any await, preserve method receivers, attempt each after failures
and retain the first Error/null. Application selection becomes execution,
inspection, transcode, apply, scan. Apply has a verified scan-producing handoff;
other ordering is conservative. Startup and both app fixtures already use this
selection. Retain residual waits until remaining workers/periodic work are owned.

## Alternatives and recommendation stack

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Reuse shared queued completion and lease owners | Consistent coalescing and teardown | Cooperative waits for unfinished work; selected |
| Await the full job from start | Simple caller | Changes durable acceptance and dispatcher scheduling; reject |
| Increase sleeps or poll completed status | Small edit | Cannot establish finalization; reject |
| Keep nesting application cleanup callbacks | No new helper | Harder to extend/review each additional owner; use a narrow ordered helper |
| Enable file-writing transcode in this round | Larger feature | Requires independent mutation/consent/rollback design; outside this fix |
| Rewrite subprocess cancellation | Wider process controls | Separate error/descendant policy and evidence required; defer |

Recommended stack: durable queue/lease authority; modular ESM task ownership;
returned preview/preflight completion; renewal/release finalizers; captured ordered
application owners; native pool lifetime; focused and affected PostgreSQL/process
validation. [Official research](TRANSCODE_LIFETIME_RESEARCH_2026_10.md) separates
specifications and guidance from these project decisions.

## Evidence plan and limits

Retain held-release duplicate acquisition as a controlled red. Gate queued
acceptance, preview/preflight, renewal and release independently; exercise
canonical close, late refusal, domain policy and Error/null precedence. Prove
normal command exit versus stdio close through the real preflight service, and
keep null output arguments visible. Test captured ordered drainage after multiple
failures and mutation of the source owner list. Exercise both app fixtures and a
controlled native process with real PostgreSQL, plus existing consumers, in one
stable affected group. Preserve original deadlines and checks; run the complete
fast gate against frozen source. No new branch, release or remote PR merge.
Normal-close evidence does not certify command-error/hidden descendants, complete
app quiescence, file-writing transcode or historical SQL-reset remediation.
