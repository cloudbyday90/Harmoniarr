# External intake planning lifetime outcome

Implemented and validated October 11, 2026 on main, following the
[design](EXTERNAL_INTAKE_LIFETIME_DESIGN.md) and
[official research](EXTERNAL_INTAKE_LIFETIME_RESEARCH_2026_10.md).

## Delivered behavior

The planner now returns queued acknowledgement with actual completion and a
canonical terminal close through the shared ESM task owner. Duplicate IDs remain
coalesced through captured lease release; close seals admission and waits for
planning, durable execution queue handoff, admitted renewal and release. Cleanup
attempts release after renewal-drain failure and preserves earlier escaped
Error/null. Unexpected acquisition failures become observable without unowned
failure writes; expected empty/unavailable/lost acquisition and guarded mark
refusals retain policy. A null planning failure has a fixed diagnostic message.

The worker still forwards returned normalized source, original actor and request
identity, with planning_complete handoff trigger and cancellation checks before
and after queueing. Empty plans do not queue execution. The actual planning
service reloads the active stored request and renormalizes its URL; the execution
queue service retains its maintenance/active-request guard. No route, schema,
provider retry, transport or requester-authority contract changes.

Application drainage captures intake/discovery/execution/inspection/transcode/
apply/organize/scan before awaiting, preserves receivers and attempts every
selected owner after failure. Startup and both app fixtures use that selection.
Planning unit fixtures now await actual completion instead of three fixed waits
(10, 10 and 20 ms); planning cancellation tests await it too. The still-detached
provider execution fixtures retain their earlier observer boundary explicitly.

## Executed evidence

The retained original-source regression fails with two acquisitions during held
release (`2 !== 1`). The implemented version passes with one acquisition and a
shared completion. All eight JavaScript candidate files were frozen in the index
before the complete gates; publication checks compare working/index SHA256.

| Validation | Result |
| --- | --- |
| Focused `node --test --test-concurrency=4 --test-reporter=tap` with 16 verified literal files | 190/190; zero failures/cancellations/skips |
| New native lifetime probe | 4/4; retained separately, repeated in affected group |
| `npm run validate:fast` | 9,733/9,733: 4,797 server, 4,384 client, 552 scripts; zero failures/cancellations/skips; both builds pass |
| Affected `node --test --test-concurrency=1 --test-reporter=tap` with seven verified native files | 54/54; six suites plus standalone pool tests; zero failures/cancellations/skips |
| Scoped ESLint and complete fast lint/hygiene/ESM/schema/migration/image/compose/copyright checks | Pass |
| `npm run validate:security:npm` | Zero reported vulnerabilities |
| Standards source/installed and testing skill quick validation | All three pass; all four installed standards files match source SHA256 |

Focused selection includes planner/service/run store, active request and
cancellation, provider planning/execution services, source parser, handlers,
dispatcher/task/owner lifecycle, acquisition policy, app drainage and startup.
Native selection comprises external-intake-worker-lifetime,
library-external-request-target-ownership, library-external-request-collection,
library-external-request-discovery-review, discovery-worker-lifetime,
operation-dispatcher-lifetime and database-pool-lifecycle test files.

The four new native cases run both functional and reusable app fixtures, each
with success and original scenario-null plus cleanup-Error precedence. They use
real planning, request, ingest and operation stores, native claim/lease writes,
and real queue service with its default maintenance adapter; existing affected
authority cases provide separate production journey coverage. Parent-visible
checks establish normalized stored source rather than launch metadata, actor and
recipient ownership, one pending execution, running/completed planning, held
handoff/release and live database/environment/workspace before teardown.
Cleanup then restores environment and removes owned workspace. No provider
request is executed by this new lifetime fixture.

Observed host: Node 24.18.1, npm 12.0.2, pg 8.23.0, pg-pool 3.14.0 and
Testcontainers PostgreSQL 12.1.0. Existing media image was inspected as
sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2
and supplied through a scoped/restored environment variable; this is not evidence
that every selected test uses media tooling. Native TAP duration 107.94 seconds,
wrapper 108.03; fast wrapper 132.84 seconds. These gates overlap, are not additive
or matched benchmarks, and do not establish an exhaustive-suite speedup. The
separate four-case probe is not four additional unique cases in the 54-case group.

Raw red/probe/focused/fast/native logs, selections, gate results, frozen candidate
and MCP responses remain privately in .tmp/external-intake-lifetime-2026-10-11/.
Expected controlled scenario-null diagnostics appear in native logs; the passing
fixtures preserve those original failures. Historical SQL-reset causes remain
unconfirmed. The [fresh PR assessment](OPEN_PR_APPLICABILITY_EXTERNAL_INTAKE_LIFETIME_2026_10_OUTCOME.md)
finds no eligible unreplayed patch. No PR was changed or merged; no release or new
branch was created.

## Skill maintenance and next recommendation

The practical web-standards skill now maps WHATWG parsing, OWASP destination
policy, IETF uncertainty, TC39 completion, Node timing/database ownership and W3C
elapsed observation to this concrete owner and its adverse evidence. Installed
references are synchronized. Entry point, metadata and invocation policy remain;
this is narrow maintenance, not a new blind trial or conformance certification.

Next: own library-provider-ingest-execution-worker completion through returned
provider/collection work, progress persistence and renewal/release. It still
queues detached launch and clears its active marker before release. Preserve
active request/recipient authority, per-row failed outcomes, collection cursor
policy, cancellation and provider transport uncertainty. Place its captured drain
after its planner when that owner is implemented. Other workers and periodic
producers remain; retain the 150 ms app-fixture delay until they are audited.
Local planning completion proves durable intent and cleanup, not queued child
completion, remote operation completion, full-app quiescence, full native
coverage, SSRF prevention or WCAG/security certification.
