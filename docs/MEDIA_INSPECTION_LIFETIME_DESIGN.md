# Media inspection lifetime design

October 11, 2026. Follow the execution-lifetime outcome. Media inspection currently
launches detached work and clears its active marker before captured lease release.
Terminal run status is earlier than local execution completion. Returned Activity
fanout is best-effort but also needs an owner through settlement.

## Selected boundaries

Reuse the existing ESM task lifecycle, advisory owner, work/cleanup precedence
and lease drainage. Queued start returns a completion handle; duplicate run IDs
share it until actual finalization ends. Terminal close seals admission before
awaiting registered work and retains escaped failures including null.

Keep selected-candidate filtering, preview/inspection policy, diagnostics cap,
cancellation/pause, lease-lost and lease-unavailable outcomes. Unexpected acquisition
failures become observable; null domain failure gets a fixed fallback message.
The preview already awaits file inspection, and the media command owner retains
shell-free argv, allowlist, timeout, output cap and normal close handling. Do not
replace these with a second subprocess implementation or equate worker completion
with unreturned descendant work. Command error and reporter behavior remain
separate contracts to audit if evidence warrants it.

Own returned Activity work without promoting diagnostic failure to domain failure.
Drain admitted renewal before captured lease release; attempt release after drain
failure and preserve an escaped work Error/null over cleanup fallout.

Extend the shared application drain with the concrete inspection owner. Capture
execution/inspection/apply/scan before awaiting, drain in that order and attempt all
known owners after failures. Apply has a verified direct scan launch; inspection
has no direct worker launch in the traced body. The ordering of execution and
inspection is conservative, not a new producer dependency. Production startup and
both app fixture entrypoints already share this adapter. Retain the residual delay
until transcode and other workers/periodic work are owned.

## Alternatives and recommendation

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Shared queued completion and terminal close | Consistent coalescing, failure and teardown contract | Cooperative wait for actual work; selected |
| Turn start into a full-job await | Simpler call shape | Changes durable acceptance/scheduling contract; reject |
| More sleep or terminal-status polling | Small implementation | Does not establish media/finalizer drainage; reject |
| Rewrite subprocess cancellation here | Could address separate descendant concerns | Wider policy and platform surface without reproduced need; defer |
| Drain every worker in one pass | Broad ownership | Unverified handoffs and large blast radius; continue bounded slices |

Stack: durable operation/lease guards; narrow ESM completion services; awaited
preview and advisory ownership; renewal/release finalization; captured application
owners; focused gates plus real PostgreSQL and native process checks. See
[official research](MEDIA_INSPECTION_LIFETIME_RESEARCH_2026_10.md).

## Evidence plan and scope

Retain a held-release duplicate-acquisition red before changing runtime code.
Gate queued acceptance, preview, Activity, renewal and release independently;
verify late admission, canonical handles, normal domain outcomes and Error/null
precedence. Test actual media-command close versus process exit without rewriting
its policy. Exercise both app fixtures with real PostgreSQL through held inspection
finalization and include Import Review plus existing owned-worker integration
regressions in one stable affected group. Preserve original deadlines and checks.
Complete the fast gate against frozen source. No new route, schema, dependency,
branch, release or remote PR merge is intended. This is not a full security,
accessibility, application-quiescence or whole-suite performance certification.
