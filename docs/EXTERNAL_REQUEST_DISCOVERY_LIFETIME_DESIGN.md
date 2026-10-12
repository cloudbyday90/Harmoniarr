# External request discovery lifetime design

October 12, 2026. The worker launches detached work and removes its active marker
before captured lease release. Its service already awaits approved-intent lookup,
track expectations, search and candidate ingestion. Ingestion awaits response/
enrichment, transaction-owned candidate/file writes and audit. Actual completion
must retain these returned promises through admitted renewal and release.

## Selected design

Reuse shared ESM task lifecycle, work/cleanup precedence and lease drainage.
Start retains queued acceptance and returns `{ completion }`; duplicate run IDs
share completion through release. Canonical close seals admission and drains all
admitted work, preserving escaped Error/null. Drain admitted renewal before
captured release; attempt release after drain failure and retain an earlier work
failure. Unexpected acquisition failures escape without unowned writes. Empty or
expected unavailable/lost acquisition, lost lease and refused marks retain policy.

Preserve the existing acquired-lease unavailable branch: it makes no terminal
mark and retains the status already chosen before the exception (normally
completed). Do not normalize that distinct behavior during a lifetime change.
Keep sanitized generic failure text, pause/retry metadata, cancellation gates and
the explicit no-candidate failure code/manual retry capability. Completion owns
local returned work and cleanup; it does not certify remote search completion,
hidden descendants or automatic acquisition.

Keep approved-intent/request relationship, current target eligibility and
maintenance/cancellation checks at the service owner. Candidate publication still
uses the request lock and guard on its actual transaction client. Result candidates
remain pending import review, with target-owned identity and captured metadata
expectations. No automatic download or new executor launch was found in the
traced ingestion body. No provider POST replay, forced cancellation or transport
policy change is introduced.

Application captures planner/provider/external-request discovery before global
discovery and the six existing downstream owners. Snapshot concrete receivers
before awaiting, attempt all ten after failure and preserve first Error/null.
Startup and both app fixtures share this selection; other workers/periodic work
keep the residual fixture delay. Native dispatch fixtures retain the concrete
worker handle beyond claim/tick completion, read status once and drain the harness
before disposal.

## Alternatives and recommendation stack

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Shared completion and captured lease drainage | Deterministic ownership and observable failure | Waits for admitted dependencies; selected |
| Poll terminal status or add sleep | Small edit | Earlier than lease/returned-work drainage; reject |
| Await the job directly from start | Simpler call site | Changes queued acceptance and scheduling; reject |
| Abort or replay search on close | Potentially shorter wait | Needs unknown-acceptance and cancellation policy; defer |
| Rewrite authority/acquired-unavailable policy | Broader consistency | Requires separate domain decision and adverse evidence; defer |

Stack: approved intent/current target authority; existing provider request and
bounded result policy; guarded candidate/file persistence plus audit; shared ESM
completion; admitted renewal and captured release; ordered concrete app drainage;
focused and affected native evidence. See
[official research](EXTERNAL_REQUEST_DISCOVERY_LIFETIME_RESEARCH_2026_10.md).

## Evidence plan

Retain original held-release duplicate acquisition as a controlled red. Gate
lookup/search/ingestion, renewal and release; preserve no-candidate retry,
sanitized failure and all lease/mark policies. Test accepted start, canonical
handles, late refusal, inputs and Error/null cleanup precedence. Exercise both
app fixtures through native HTTP response, real candidate transaction and held
release; prove publication refusal after cancellation/retargeting. Include
existing requester visibility, approval/replay/rollback and dispatcher/pool cases
in one stable affected PostgreSQL group. Freeze source after focused review, then
run complete fast and affected native once. No release, branch or PR merge; no
whole-app quiescence, exhaustive speedup or security/WCAG certification claim.
