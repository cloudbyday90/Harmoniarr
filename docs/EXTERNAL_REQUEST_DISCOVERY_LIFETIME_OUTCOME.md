# External request discovery lifetime outcome

Implemented and validated October 12, 2026 on main, following the
[design](EXTERNAL_REQUEST_DISCOVERY_LIFETIME_DESIGN.md) and
[official research](EXTERNAL_REQUEST_DISCOVERY_LIFETIME_RESEARCH_2026_10.md).

## Delivered behavior

Discovery now returns queued acknowledgement with actual completion and canonical
terminal close through shared ESM task ownership. Duplicate IDs remain coalesced
through returned approved lookup/search/ingestion, admitted renewal and captured
lease release. Close seals admission and retains escaped Error/null. Cleanup
attempts release after renewal-drain failure, preserving an earlier work failure.
Unexpected acquisition failures escape without unowned writes; expected empty/
unavailable/lost acquisition, lost authority and refused marks retain policy.

The distinct acquired-lease unavailable branch remains unmarked and releases
with the already chosen status (normally completed, failed if no-candidate
handling already chose failure). Sanitized generic error text, pause metadata,
cancellation and explicit no-candidate/manual-retry capability remain unchanged.
Current intent/request/target guards and transaction-owned candidate publication
remain at their original services; candidate/file identity stays target-owned and
pending import review. No search retry, automatic download, route/schema change
or new authority is introduced.

Application drainage captures planner/provider/external-request discovery/global
discovery/import execution/inspection/transcode/apply/organize/scan before awaiting,
preserves receivers and attempts all ten after failure. Startup and both app
fixtures share that selection. Unit worker consumers await actual completion.
The native dispatch harness retains each admitted worker's completion promise
beyond claim/tick completion, keeps its 15-second bound, reads status once and
drains dispatcher then worker before resources are disposed. Required assertions
and scenario/suite/connection bounds are preserved.

## Executed evidence and corrected fixture assumption

Original-source regression fails with two acquisitions during held release
(`2 !== 1`). The implementation shares completion with one acquisition. Nine
JavaScript files were frozen before broader gates and final publication checks
compare working/index SHA256.

The first affected native group finished 65/66, with one fixture assertion reading
pending status immediately after a dispatcher tick. Source confirms tick owns
claiming, while launched handler/worker completion is a separate task. The fixture
was corrected to retain the actual worker handle rather than infer completion
from tick. That failed case passes alone, then the full affected group passes.
All other eight JavaScript files match their earlier frozen hashes. Production,
server/client/script test code and builds are unchanged; the complete fast gate
was not repeated for this native-fixture-only correction. Final fixture ESLint
and repository test-hygiene checks pass. The original failure and candidates are
retained privately, not described as a production or PostgreSQL cause.

| Validation | Result |
| --- | --- |
| Focused `node --test --test-concurrency=4 --test-reporter=tap` with 19 verified literal files | 268/268; zero failures/cancellations/skips |
| `npm run validate:fast` before native-fixture-only correction | 9,771/9,771: 4,835 server, 4,384 client, 552 scripts; zero failures/cancellations/skips; both builds pass |
| First affected native group | 65 passed, one fixture assertion failed; zero cancellations/skips; retained |
| Failed native case with explicit test-name pattern after correction | 1/1; zero failures/cancellations/skips |
| Final affected `node --test --test-concurrency=1 --test-reporter=tap` with nine verified native files | 66/66; eight suites plus standalone pool tests; zero failures/cancellations/skips |
| Final fixture ESLint/test hygiene plus complete fast static/schema/migration/ESM/image/compose/copyright checks on unchanged application | Pass |
| `npm run validate:security:npm` | Zero reported vulnerabilities |
| Standards source/installed and testing skill quick validation | All three pass; all four installed standards files match source SHA256 |

Focused selection covers worker/service/run store, review evidence/error, lease
acquisition/heartbeat, task/owner/handler/dispatcher, app/startup, slskd client/
service and candidate ingestion, plus planner/provider lifetime. Earlier 40-case
feedback is a subset, not additional unique coverage. Native selection comprises
external-request-discovery-worker-lifetime, library-external-request-discovery-review,
library-external-request-target-ownership, library-external-request-collection,
provider-ingest-worker-lifetime, external-intake-worker-lifetime,
discovery-worker-lifetime, operation-dispatcher-lifetime and database-pool-lifecycle.
Repeated native groups and the one-case reproduction are separate runs, not 133
unique cases or an exhaustive native gate.

Four new cases exercise functional and reusable app fixtures, each with success
and original scenario-null plus cleanup-Error precedence. Real review approval
creates intent/run/audit; real slskd client/service uses the test-owned loopback
server, and real candidate ingestion persists on its transaction client. Parent
checks establish one POST/one response GET, no candidate before held response,
target/actor/intent/metadata ownership, pending candidate and file, ingestion audit,
completed operation before held release, and live pool/environment/workspace
through finalization. Teardown restores environment and removes owned workspace.

Two additional cases own the worker explicitly inside the functional app fixture.
Cancelling or retargeting the stored request while the response is held prevents
candidate/file/audit publication and yields cancelled status, with no second POST.
These are native controlled HTTP/SQL boundaries, not live Soulseek/slskd-version
compatibility, complete remote search or download proof. Track expectations and
maintenance adapters use fixture defaults; existing affected production approval,
visibility, CSRF/fresh-session, ownership and collection cases provide separate
journey coverage.

Observed host: Node 24.18.1, npm 12.0.2, pg 8.23.0, pg-pool 3.14.0 and
Testcontainers PostgreSQL 12.1.0. Existing media image was inspected as
sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2
and supplied via scoped/restored environment without claiming every case uses
media tooling. Fast wrapper 198.79 seconds; first failed native TAP/wrapper
269.69/269.83; final native TAP/wrapper 181.92/182.10. The first gates overlap and
the corrected rerun is a separate invocation. These are not additive or matched
performance benchmarks; no lifetime-related/exhaustive speedup is established.
Client build passed in 5.60 seconds.

Raw red/focused/fast/native-first/native-final logs, failed-case proof, selections,
gate results, frozen candidates and correction-scope hashes, installed skill
hashes and MCP responses remain privately in
.tmp/external-request-discovery-lifetime-2026-10-12/. Controlled scenario-null
diagnostics are expected fixture evidence. Historical SQL-reset causes remain
unconfirmed. The [fresh PR assessment](OPEN_PR_APPLICABILITY_EXTERNAL_REQUEST_DISCOVERY_LIFETIME_2026_10_OUTCOME.md)
finds no eligible unreplayed patch. No remote PR changed or merged; no release or
new branch was created.

## Skill maintenance and next recommendation

The practical standards skill now maps approved intent/current target guards,
transaction-owned candidate publication/audit and returned lease cleanup to
concrete adverse tests. It distinguishes dispatcher claim completion from actual
worker completion, preserving no-candidate retry and sanitized failures. Installed
references are synchronized. Entry point, metadata and invocation policy remain;
this is narrow maintenance, not a new blind trial or standards/security certification.

Next: metadata-artist-refresh-worker ownership through returned provider refresh,
refresh-schedule persistence and renewal/release. It still launches detached work
and removes the active marker before release. Preserve captured worker context,
lease fencing, cancellation hooks and scheduling semantics; trace its real
downstream handoffs before choosing app order. Other workers/periodic producers
remain, so retain the 150 ms app-fixture delay. Completion does not certify hidden
descendants, remote operation completion, whole-app quiescence, full native
coverage, exhaustive performance improvement or full authorization/WCAG/security
protection.
