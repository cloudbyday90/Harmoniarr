# Provider ingest execution lifetime outcome

Implemented and validated October 11, 2026 on main, following the
[design](PROVIDER_INGEST_LIFETIME_DESIGN.md) and
[official research](PROVIDER_INGEST_LIFETIME_RESEARCH_2026_10.md).

## Delivered behavior

The executor now returns queued acknowledgement with actual completion and a
canonical terminal close through the shared ESM task owner. Duplicate IDs stay
coalesced through returned provider/collection work, admitted renewal and captured
lease release. Close seals admission before waiting and retains escaped Error/null.
Cleanup attempts release after renewal-drain failure, preserving an earlier work
failure. Unexpected acquisition failure escapes without unowned writes; expected
empty/unavailable/lost acquisition, lost authority and refused marks retain policy.
Null worker domain failure has a fixed diagnostic message.

Keep original actor/request/trigger forwarding, cancellation and maintenance
metadata. Handled row failures still allow operation completion with nonzero
failedCount; collection preparation can remain preparing after one bounded batch.
The service, provider transports, collection protocol, routes, schema and target
authorization are unchanged. Cancellation tests now await executor completion
beyond the earlier release observer.

Application drainage captures planner/provider/discovery/import execution/
inspection/transcode/apply/organize/scan before awaiting, preserves receivers and
attempts all nine after failure. Startup and both app fixtures share that selection.
The new small native fixture module seeds through real request/plan/queue owners,
reads durable state, and supplies a test-owned loopback transport for actual
provider clients without changing their production endpoints.

## Executed evidence

Original-source held-release regression fails with two acquisitions (`2 !== 1`).
The implementation shares actual completion with one acquisition. Eight JavaScript
candidate files were frozen in the index before complete gates; publication checks
compare working/index SHA256. A scoped lint run rejected two test variable shadows;
they were renamed and lint passed before freeze. No assertions or deadlines were
weakened.

| Validation | Result |
| --- | --- |
| Focused `node --test --test-concurrency=4 --test-reporter=tap` with 20 verified literal files | 234/234; zero failures/cancellations/skips |
| `npm run validate:fast` | 9,752/9,752: 4,816 server, 4,384 client, 552 scripts; zero failures/cancellations/skips; both builds pass |
| Affected `node --test --test-concurrency=1 --test-reporter=tap` with eight verified native files | 60/60; seven suites plus standalone pool tests; zero failures/cancellations/skips |
| Scoped ESLint and complete fast lint/hygiene/ESM/schema/migration/image/compose/copyright checks | Pass after the pre-freeze shadow correction |
| `npm run validate:security:npm` | Zero reported vulnerabilities |
| Standards source/installed and testing skill quick validation | All three pass; all four installed standards files match source SHA256 |

Focused selection covers provider worker/service and planning, collection
service/store/adapters/clients, bounded transport and cancellation, YouTube client,
lease acquisition/heartbeat, task/owner/handler/dispatcher, app/startup and planner
lifetime. Earlier 35-case worker feedback is a subset, not additional unique
coverage. Native selection comprises provider-ingest-worker-lifetime,
external-intake-worker-lifetime, library-external-request-target-ownership,
library-external-request-collection, library-external-request-discovery-review,
discovery-worker-lifetime, operation-dispatcher-lifetime and database-pool-lifecycle.
The stable native group was run once; no separate new-file probe was repeated.

Four new native cases run functional and reusable app fixtures, each with success
and original scenario-null plus cleanup-Error precedence. Real Spotify client and
bounded JSON request service validate their fixed official URL, then an injected
transport performs native HTTP against the test's loopback server. Parent-visible
checkpoints establish one GET, refused redirects in options, running/planned
state before response, actor/recipient ownership, returned response persisted,
request evidence/audit and completed operation before held release. Database,
environment and workspace stay available through actual finalization; teardown
restores environment and removes the owned workspace afterward.

Two additional native cases run a separately owned executor inside the functional
app fixture, using real YouTube client, tracked collection service, locks and
transactions. A held response either publishes one page/item and ready state or,
after stored request cancellation, leaves work planned and publishes no item.
Both await completion and lease cleanup. These are controlled transport/SQL tests,
not live Spotify/YouTube service, quota, authentication or catalog correctness
proof. New fixture maintenance adapters use their default no-op; existing affected
production authority/collection cases provide separate journey evidence.

Observed host: Node 24.18.1, npm 12.0.2, pg 8.23.0, pg-pool 3.14.0 and
Testcontainers PostgreSQL 12.1.0. Existing media image was inspected as
sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2
and supplied via a scoped/restored environment variable, without claiming every
selected case uses media tooling. Native TAP duration 165.52 seconds, wrapper
165.61; fast wrapper 148.94. Gates overlap and are not additive or matched
benchmarks. Client build passed in 3.65 seconds with a plugin-timing advisory;
its Vue transform row reports 1.8 seconds over 250 calls. That advisory does not
establish a regression cause or lifetime-related speedup.

Raw red/focused/fast/native logs, selections, gate results, frozen candidate,
installed skill hashes and MCP responses remain privately in
.tmp/provider-ingest-lifetime-2026-10-11/. Controlled scenario-null diagnostics
are expected fixture evidence. Historical SQL-reset causes remain unconfirmed.
The [fresh PR assessment](OPEN_PR_APPLICABILITY_PROVIDER_INGEST_LIFETIME_2026_10_OUTCOME.md)
finds no eligible unreplayed patch. No remote PR changed or merged; no release or
new branch was created.

## Skill maintenance and next recommendation

The practical standards skill now locates actual bounded catalog clients,
request/target guards, returned row/collection work and captured lease drainage.
It distinguishes local batch completion, collection readiness, remote work and
hidden post-abort settlement. Installed references are synchronized. Entry point,
metadata and invocation policy remain; this is narrow reference maintenance, not
a new blind trial or standards/security certification.

Next: library-external-request-discovery-worker completion through approved-intent
lookup, candidate persistence and lease finalization. Its current launch is
detached and it removes the active marker before release. Preserve request/intent
authority, target eligibility, no-candidate failure/retry and cancellation rules;
trace actual queue-producing handoffs before choosing application order. Other
workers and periodic producers remain, so retain the 150 ms app-fixture delay.
Returned completion does not certify hidden injected work after request abort,
complete collection preparation, remote downloads, whole-app quiescence, full
native coverage, exhaustive performance improvement or complete SSRF/WCAG/security
protection.
