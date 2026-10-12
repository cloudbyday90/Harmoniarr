# Library organize apply lifetime design

October 11, 2026. The worker clears its active marker before lease release and
launches unobserved work. After persisted moves it also launches notification and
Activity callbacks without retaining their returned promises. Actual filesystem
and canonical-path writes already belong to the guarded organize mutation owner.

## Selected boundaries

Reuse the ESM task lifecycle, work/cleanup precedence, advisory task owner and
lease drainage. Queued start returns actual completion; duplicate run IDs share
it through all finalization. Terminal close seals admission before awaiting
registered work and retains escaped failures including null.

Await preview, exclusive-plan preparation, guarded mutation and progress/terminal
persistence as before. Drain returned notification/Activity callbacks under
best-effort outcome policy, then admitted renewal and captured lease release.
Attempt release after drain failure and preserve escaped work Error/null over
cleanup fallout. Unexpected acquisition errors become observable; empty acquisition,
expected unavailable acquisition and lease-lost behavior retain policy. Preserve
the organize worker's failed lease-release status for stale authority, rejected
persisted marks, pause and cancellation mark failures. Null domain failure gets
a fixed fallback message.

Advisory callback adapters accept plain returns and synchronous throws as well as
promises, using the shared best-effort owner. This deliberately prevents a
synchronous diagnostic adapter failure from converting an already persisted move
into a workflow failure. Required guarded mutation/persistence remains required.
Keep partial-move result breakdowns, not-attempted remainder and notification
eligibility unchanged; callbacks are admitted only after the existing terminal
mark succeeds and at least one move is recorded.

Preserve every filesystem/SQL authority and verification boundary in the existing
mutation, store and filesystem services. No overwrite, rollback, locking, path
containment or retry protocol is rewritten. Completion owns returned local work;
it does not certify notification delivery or hidden callback descendants.

Extend ordered application selection to execution/inspection/transcode/apply/
organize/scan. Capture concrete owners before awaiting, preserve receivers, attempt
each despite failure and retain the first Error/null. Apply has a scan-producing
handoff; organize's traced callbacks broadcast notifications and record Activity,
with no direct scan launch. Other ordering is conservative. Startup and both app
fixtures share this adapter. Keep residual waits for remaining workers/periodic work.

## Alternatives and recommendation stack

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Shared completion and advisory/lease owners | Consistent coalescing and resource lifetime | Cooperative waits; selected |
| More sleep or terminal-status polling | Small edit | Cannot establish mutation/callback finalization; reject |
| Await the entire job from start | Simple caller shape | Changes queued acceptance and dispatcher scheduling; reject |
| Make notifications required writes | Stronger delivery semantics | Changes domain outcome after persisted movement; separate design |
| Rewrite filesystem/SQL atomicity here | Wider recovery model | Large unverified protocol change; preserve current guarded owner |

Stack: durable queue and captured lease authority; guarded exclusive verified
movement; small ESM completion/advisory services; renewal/release finalizers;
ordered application owners; native pool lifetime; focused and affected real
filesystem/PostgreSQL validation. See [official research](ORGANIZE_APPLY_LIFETIME_RESEARCH_2026_10.md).

## Evidence plan and scope

Retain a held-release duplicate acquisition red before changing runtime code.
Gate mutation, canonical persistence, callbacks, renewal and release separately.
Verify canonical handles, late admission, null/Error precedence, callback value/
throw behavior and partial-move notifications. Replace native mutation fixture
release observation with the actual completion handle. Exercise both app fixtures
with real PostgreSQL and test-owned files through a guarded verified move and
held finalization, retaining byte/path state until cleanup. Include existing stale
authority/collision/maintenance/cancellation mutation cases and other owned-worker
consumers in one stable affected group. Preserve original deadlines/assertions;
run complete fast validation against frozen source. No new branch, release or PR
merge. Normal successful movement is not a global filesystem/SQL atomicity proof,
full application quiescence or historical SQL-reset remediation.
