# Spectral admission implementation outcome

Recorded October 23, 2026. The [design](SPECTRAL_ADMISSION_DESIGN.md) owns the
invariant and alternatives; the [official practice review](SPECTRAL_ADMISSION_RESEARCH.md)
owns discovered sources and the recommendation stack. The separate
[Docker outcome](LOCAL_DOCKER_SPECTRAL_ADMISSION_OUTCOME.md) records deployment.

## Implemented behavior

Both spectral enqueue paths now share transaction admission in a small ESM
`source-user-spectral-admission-store.js`. READ COMMITTED is explicit, the
five-second local lock timeout is bounded, and the capacity/dedup INSERT runs
after lock acquisition on the same client. The existing runner owns commit,
rollback and client release. No native work or reputation callback holds this lock.

Apply returns the same backlog-full result; retroactive batches retain their
per-file commits and enqueued/skipped counts. Pending and active count together;
terminal history permits re-admission. Apply jobs remain independent evidence.
Claim generations, SKIP LOCKED consumption and atomic cache/job publication remain
separate ownership boundaries.

Baseline PostgreSQL 18.3 reproduced three races using the actual prior store:
apply/apply cap one yielded two jobs; apply/retroactive cap one yielded two jobs;
retroactive/retroactive at cap ten yielded two open jobs for the same library UUID.
The original source hash and private records are retained. Earlier fixture-only
connection-pool and UUID errors are retained separately and excluded from proof.

## Validation

Focused store/cache/sidecar/retroactive unit selection passed **31 tests**,
including five admission ordering/failure cases. The strengthened PostgreSQL run
passed **16 tests**: ten admission cases and six existing spectral interruption
cases. Admission covers all four producer directions at the final slot, duplicate
UUID with spare capacity, Error/null rollback handoff, active/terminal capacity,
independent apply work, per-file partial progress, actual worker progress while
admission is held and SQLSTATE 55P03 timeout refusal. Both contender sessions
default to REPEATABLE READ while owned insertion verifies READ COMMITTED.

The ten admission cases use one registrar shared by the integration and explicit
`validate:native-spectral-admission` adapters. The native adapter refuses host/live
storage and requires the existing disposable deployment profile before checkout.
This reduces duplicated assertions without folding native checks into the fast
gate. The stable full fast gate passed **11,039 tests**: 5,872 server, 4,470 client
and 697 script tests, with static checks and both builds passing. No skipped,
cancelled or failed cases or selected runtime/deprecation warnings were found.

The rebuilt image passed the same **ten admission cases against actual packaged
PostgreSQL 18.6**, plus **two native spectral interruption cases**. The latter
proved held Linux SIGTERM close with replacement ownership intact, and actual
FFmpeg measurement of 188 frames followed by cancellation with both native commands
closed, original bytes unchanged and no cache publication. Disposable native
containers were removed and absence verified. These are selected database/process
checks, not the complete integration suite or a new memory sizing experiment.

The final eight JavaScript artifacts and source cohort were frozen before the
full fast gate: 3,369 cohort files, SHA-256
`dbcfc017fcd85fe3f2ec6def32826528b50eeadb4d53b7ef57272e6cd7178944`.
Exact code hashes and client artifact comparisons remained unchanged afterward.
Private evidence is in `.tmp/spectral-admission-2026-10-23/`, including the
initial 15-case candidate before strengthening both isolation defaults, worker
progress and shared registration. Those candidate counts are not added to final
gate totals. No host/full-suite performance improvement is claimed.

## Reusable skill

The repository standards skill now routes queue changes to a focused
[admission reference](../.agents/skills/harmoniarr-web-standards/references/queue-admission.md).
It covers writer inventories, actual-store reproduction, constraints versus
cooperating admission, same-statement stale snapshots, isolation defaults, bounded
waiting and independent lock observers. The testing skill links the same workflow;
the spectral ownership reference makes future count-increasing writers explicit.
Both skill frontmatter validators pass. The real contention cases exercise the
workflow's invariants; no independent subagent forward-test was performed.

## Recommendation and remaining limits

Recommend the existing PostgreSQL queue, short shared admission store, current
claim/publication fences and bounded native/memory controls. Advantages are one
existing app, a narrow persistence change and normal transaction rollback. Costs
are serialized producer critical sections and extra SQL round trips. The lock
protects cooperating producers; arbitrary SQL or older binaries can bypass it.
It preserves old duplicates/over-cap rows, and differing instance caps do not
define one consistent maximum. Five seconds bounds each lock acquisition, not
pool checkout, total statement/transaction time or a whole retroactive request.

Next: design durable, idempotent delivery of confirmed spectral reputation
evidence. `publishJob` currently commits cache/job completion before invoking the
advisory reputation callback, whose failure is logged. A crash or callback failure
can leave completed analysis without that evidence. Reproduce this gap before
choosing an outbox; preserve event identity and retroactive exclusion, and prove
replay without duplicate penalties. This is a source-level follow-up, not a crash
reproduction or an exactly-once guarantee established by this round.

GitHub MCP returned no open PRs at selection and again before publication. There
was no applicable random/stale PR to implement, rebase or close; no PR was merged.
Work stays on main; app version and lockfile are unchanged. No release or tag is
created.
