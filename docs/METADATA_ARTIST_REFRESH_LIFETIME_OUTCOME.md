# Metadata artist refresh lifetime outcome

Implemented and validated October 12, 2026 on main, following the
[design](METADATA_ARTIST_REFRESH_LIFETIME_DESIGN.md) and
[official research](METADATA_ARTIST_REFRESH_LIFETIME_RESEARCH_2026_10.md).

## Delivered behavior

Artist refresh now returns queued acknowledgement with actual completion and
canonical terminal close through shared ESM task ownership. Duplicate IDs stay
coalesced through returned refresh, schedule persistence, admitted renewal and
captured lease release. Close seals admission and retains escaped Error/null.
Cleanup attempts release after renewal-drain failure, preserving an earlier work
failure. Unexpected acquisition failures escape without unowned writes; empty/
expected unavailable/lost acquisition, lost authority and refused marks retain
existing policy. Null worker domain failure gets a fixed message.

Original artist IDs, trigger, captured workerContext/expected lease, cancellation
hook and summary counters remain intact. Catalog refresh still clones accepted
context before provider awaits and forwards it to wanted projection. Existing
catalog/materialization/wanted authority, durable operator queueing, detection
and scheduler policies are unchanged. Scheduling still rechecks monitoring and
records dates or clears an unmonitored artist's schedule. No new provider retry,
abort, partial-write cancellation, route/schema or acquisition contract change.

Application drainage now captures metadata refresh before the ten existing
library/import owners, snapshots concrete receivers before waiting, attempts all
eleven after failure and retains first Error/null. Startup explicitly passes
metadataModule to the shared adapter; both app fixtures already pass the whole
application. The native wanted-authority consumer now awaits actual metadata/
discovery completion and close beyond its earlier release observation.

## Executed evidence

The retained original-source regression fails with two acquisitions during held
release (`2 !== 1`). The implementation shares completion with one acquisition.
Nine JavaScript candidate files were frozen before complete gates; publication
checks compare working/index SHA256. No production/test JavaScript changed after
the complete passing gates.

| Validation | Result |
| --- | --- |
| Focused `node --test --test-concurrency=4 --test-reporter=tap` with 19 verified literal files | 186/186; zero failures/cancellations/skips |
| `npm run validate:fast` | 9,791/9,791: 4,855 server, 4,384 client, 552 scripts; zero failures/cancellations/skips; both builds pass |
| Affected `node --test --test-concurrency=1 --test-reporter=tap` with seven verified native files | 42/42; five suites plus standalone tests; zero failures/cancellations/skips |
| Scoped ESLint and complete fast static/schema/migration/ESM/image/compose/copyright/hygiene checks | Pass |
| `npm run validate:security:npm` | Zero reported vulnerabilities |
| Standards source/installed and testing skill quick validation | All three pass; all four installed standards files match source SHA256 |

Focused selection includes worker, refresh/scheduler/scheduling/state/start
services, heartbeat/dispatch policy/module, MusicBrainz client, wanted authority,
lease acquisition/heartbeat, task/owner/handler/dispatcher, app/startup. Earlier
36-case feedback is a subset, not extra unique coverage. Native selection comprises
metadata-refresh-worker-lifetime, library-wanted-release-reconciliation,
library-release-reconciliation, operator-artist-reconciliation-recovery,
discovery-worker-lifetime, operation-dispatcher-lifetime and database-pool-lifecycle.
The stable affected group was run once, without repeating a new-file-only probe.

Four new cases exercise functional and reusable app fixtures, each with success
and original scenario-null plus cleanup-Error precedence. They use real metadata
catalog, monitoring, refresh-run and schedule stores, real provider client and an
injected test-owned loopback HTTP transport. Production client HTTPS/host policy
remains intact. Parent-visible checks establish unchanged catalog before held
response, updated artist/group before held schedule publication, recorded dates
and completed operation before held release, and live database/environment/
workspace through actual finalization. Teardown restores environment and removes
the owned workspace. One artist GET and one release-group GET are observed.

The fifth case owns its worker explicitly inside the functional app fixture:
monitoring removed while lookup is held exercises existing schedule clearing.
It publishes the returned catalog, leaves last_refreshed_at unchanged, clears
next_refresh_at and records null nextRefreshAt in the completed run. New fixtures
stub detection and omit optional materialization/wanted/operator queue adapters;
they are normal-response catalog/schedule/resource proof, not all production
side-effect proof. Existing native wanted/current-input/lease fencing and recovery
cases provide separate authority evidence, including captured metadata context.
Controlled HTTP is not live MusicBrainz compatibility, quota or global egress
compliance proof. Existing provider and partial-write cancellation behavior remains.

Observed host: Node 24.18.1, npm 12.0.2, pg 8.23.0, pg-pool 3.14.0 and
Testcontainers PostgreSQL 12.1.0. Existing media image was inspected as
sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2
and supplied through scoped/restored environment without claiming every selected
case uses media tooling. Fast wrapper 179.78 seconds; native TAP/wrapper
160.35/160.52. Gates overlap, are not additive or matched benchmarks, and do not
establish an exhaustive/lifetime-related speedup. Client build passed in 2.71 seconds.

Raw red/focused/fast/native logs, selections, gate results, frozen candidate,
installed skill hashes and MCP responses remain privately in
.tmp/metadata-artist-refresh-lifetime-2026-10-12/. Controlled scenario-null
diagnostics are expected fixture evidence. Historical SQL-reset causes remain
unconfirmed. The [fresh PR assessment](OPEN_PR_APPLICABILITY_METADATA_REFRESH_LIFETIME_2026_10_OUTCOME.md)
finds no eligible unreplayed patch. No remote PR changed or merged; no release or
new branch was created.

## Skill maintenance and next recommendation

The practical standards skill now locates captured authority, returned refresh/
scheduler work and explicit production metadata input for eleven-owner drainage.
It records source status/access limits: MusicBrainz API lookup returned 429, its
FAQ is marked unreviewed, and linked rate guidance references 2012 rules that may
change. Existing request identification, queue and jitter remain; no whole-egress
compliance inference. Installed references are synchronized. Entry point, metadata
and invocation policy remain; this is narrow maintenance, not a new blind trial
or standards/security certification.

Next: operator-artist-reconciliation-worker ownership through captured snapshot,
current operator policy and returned reconciliation/persistence, then renewal/
release. Metadata refresh already queues its durable intent; this worker still
detaches launch and removes its active marker before release. Preserve user/artist/
snapshot revision authority, current-input fencing and recovery/cancellation;
trace actual downstream handoffs before selecting app order. Other workers and
periodic producers remain, so retain the 150 ms app-fixture delay. Returned
completion does not certify executed child reconciliation, hidden post-abort
work, remote operation completion, whole-app quiescence, full native coverage,
exhaustive speedup or full authorization/WCAG/security protection.
