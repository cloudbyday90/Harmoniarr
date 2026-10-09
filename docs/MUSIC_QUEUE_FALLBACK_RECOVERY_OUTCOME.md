# Music Queue fallback recovery outcome

Status: Implemented and validated
Recorded: October 8, 2026
Design: [MUSIC_QUEUE_FALLBACK_RECOVERY_DESIGN.md](MUSIC_QUEUE_FALLBACK_RECOVERY_DESIGN.md)
Baseline: `d405771b430f1271445f94e07443de836409ed85`, main

The first worker review identified a positive-result rediscovery handoff outside
the private execution boundary. The accepted design addendum is implemented:
search acceptance, current context, selection and one exact typed execution child
commit together. Twelve actual PostgreSQL execution/positive scenarios pass;
zero-result controls alone did not establish that handoff.

## Selected recommendation and stack

Retain Vue, Express/Node 24 ESM, PostgreSQL and existing durable workers. Narrow
Music Queue recovery policy/service/store owners share current scope and quality
rules; the owning transaction coordinates observation, one attempt and scoped
execution/rediscovery intent. Delayed consumers recheck current requirements.
Generic unowned behavior remains separately bounded.

| Recommended layer | Benefit | Cost or limit |
| --- | --- | --- |
| Fresh complete requirement and explicit null semantics | Revoked consent and every valid floor survive the handoff | Invalid scope/policy remains conservative; no media-verification bypass |
| Source-run/candidate episode ledger | Competing/repeated observations cannot create two acquisition decisions | Historical work without stable origin cannot receive inferred authority |
| Scoped owning transaction and durable child | Failure/audit/attempt/selection/queue roll back together | Compatible writer coordination and sorted locks must be maintained |
| Atomic positive rediscovery continuation | Preserves automatic recovery after awaited ingestion/readiness | Requires confident current selection and the exact typed child in the same commit |
| Exact delayed execution/rediscovery guards | Current membership and policy govern provider handoff | External side effects are not atomic with later database policy changes |
| Existing canonical status/commands | Truthful stopped/queued/running states without a new command | Browser roles do not establish actual assistive-technology speech |

The separate design records official URL discovery, authority, alternatives and
the final stack. OWASP and W3C Understanding are practice guidance; versioned
PostgreSQL documentation guides the transaction boundary. Their guidance does
not itself demonstrate application behavior or whole-system security.

## Implementation and evidence

Runtime source is frozen and the complete gate passes. Policy/adapter evidence
remains distinct from SQL, worker and provider-boundary evidence below.

Final `npm.cmd run validate` passes **8,880 tests**: **3,788 server**, **4,348
client**, **513 script** and **231 integration**, zero failures/skips. Copyright,
migration/schema, ESM, image/topology, lint and test-hygiene checks pass, as do
both client/server builds. The rebuilt browser module separately passes **21/21**.
`npm.cmd run validate:security` reports **zero vulnerabilities at every severity**.
Final logs are `validate-final.log` and `security-final.log` in the ignored
evidence directory. The PostgreSQL portion ran serially without parallel
reproductions, using the local media fixture where required.

The main broad commands are `npm.cmd run validate` with
`HARMONIARR_INTEGRATION_MEDIA_IMAGE=harmoniarr-quality-fallback:local` and
`npm.cmd run validate:security`. Focused PostgreSQL controls use the separate
transaction, execution, positive-handoff, discovery, retention and projection
test files. The final broad gate will include every new owner and fixture.

| New owner | Responsibility |
| --- | --- |
| `music-queue-recovery-policy.js` and recovery service/store | Complete current requirements, exact identity, one episode and atomic failure/attempt/intent |
| Recovery execution policy, lifecycle and execution observation services | Final provider checks, conditional retirement and accepted current-origin phase transitions |
| `library-music-queue-recovery-discovery-service.js` | One reserved target, deadline, current scope and post-preparation search check |
| Recovery discovery handoff service/store | Atomic new-search acceptance, current confident selection and typed execution child |
| Library wanted recovery progress store/policy | Exact current job/receipt/selection facts, canonical and legacy privacy |

Existing workers/modules receive adapters. SQL remains in stores/lock stores;
provider/media IO remains outside owning transactions. No schema, route, new
queue, public status enum or client markup migration is introduced. Ordinary
and global retention preserve unretired authority with null-safe pruning, and
discovery upserts preserve owning-marker generation. Generic raw Music Queue
presence cannot bypass its required owner.

```powershell
node --test test/server/music-queue-recovery-policy.test.js test/server/library-discovery-quality-context-service.test.js
```

The final pure-policy/shared-quality suite passes **19/19**, zero failures/skips. It
covers whole recipient eligibility, physical/source/file drift, legitimate
selected-to-downloading phase changes, ordinary discovery claim freshness,
durable classification after mutable context loss and preservation of a newer
selection during known-undispatched retirement. Real quality evaluation and
format scoring retain a sibling's valid 320 floor, clear revoked shared consent
and preserve chosen-candidate/durable baseline minima. Scoped test lint passes.
This is policy evidence, not PostgreSQL locking or actual provider acceptance.
The final focused log is `recovery-policy-baseline.log` under
`.tmp/fallback-recovery-2026-10/`.

After adding the actual staging/measured-media floor regression and adapting the
changed owner handoffs, the six-file policy/adapter suite passes **59/59**, zero
failures/skips, with scoped lint. It includes the two files above plus
`import-candidate-recovery-service.test.js`, `import-candidate-module.test.js`,
`import-candidate-music-queue-auto-safe-add-service.test.js` and
`import-candidate-apply-worker.test.js`. The final log is
`recovery-adapters-final.log`; these counts overlap the complete server suite.

The adapter checks all four owned handlers, missing-owner refusal before generic
writes and original execution/media observation handoff. Old malformed owned
fixtures no longer exercise the generic loop. Generic caller consent cannot be
grafted onto an unowned successor; explicit null/omission use strict evaluation.
The first new generic test assumed such caller consent could make that successor
eligible. The existing retention guard correctly refused it; the fixture
expectation was corrected after source tracing, then the smallest 16-test file
and complete 59-test focused command passed without changing runtime behavior.
The original failure and reproduction logs are retained separately. These are
adapter/policy controls, not transaction or provider proof.

```powershell
node --test --test-concurrency=1 test/integration/music-queue-recovery-transaction.test.js
```

The direct owning transaction suite passes **9/9**, zero failures/skips, using
real isolated migrated PostgreSQL, the production coordinator/store, execution
and discovery run stores, maintenance guard, transaction runner and required
audit writer. SQL fault triggers prove whole-decision rollback for required
audit, child queue and final episode-event rejection, including delayed discovery
budget/deadline. Concurrent rejected/download observations create one episode,
attempt and child; a later retry source owns another episode. A running parent
can queue the exact eligible older-search child under a valid shared 320 floor.

Current disabled/unlinked/late scope or a newer ordinary dispatch records only
genuine stopped history. Stale/applied provenance and a real observed parent-lock
wait preserve newer state without stop events or audits. Missing-origin history
does not authorize acquisition or mask a later identified decision. Revoked
sibling consent cannot select saved lossy fallback. The normalized execution
child read omits the private accepted authority and participant set.

The first new fixture omitted the required execution item's `status_message`;
database setup refused before recovery ran. The fixture was corrected, the
smallest parent scenario passed, and the complete eight-scenario file passed.
The ninth observed-lock scenario then passed with the complete nine-scenario
file. Independent review sharpened no-event/audit, NULL-origin and normalized
child-run privacy assertions; all three affected scenarios passed. Shared graph
and service-context setup was extracted into
`testing/integration/music-queue-recovery-fixtures.js`; the same three real
scenarios and scoped lint pass after extraction. No runtime assertion or timeout
was relaxed. Original/reproduction/final/review/shared-fixture logs are retained
under `.tmp/fallback-recovery-2026-10/`.

Additional frozen-source controls pass with zero failures/skips:

| Check | Executed result |
| --- | --- |
| Backend focused | 112 server tests and scoped lint |
| Automatic readiness preparation | 10 tests: original flag/folder/provider semantics, no queue mutation, existing start parity |
| Actual execution/reconciliation and positive continuation PostgreSQL | 12 scenarios: seven execution cases plus five persisted-ingestion/scoring/handoff cases |
| Discovery worker/adapter focused | 78 tests and scoped lint |
| Actual discovery PostgreSQL | 9 scenarios: current scope, deadline, quarantine, uncertainty and canonical supersession/generation |
| Actual retention PostgreSQL | 2 scenarios: ordinary/retired reclamation, protected retention and preview/mutation parity |
| Public projection | 83 server tests and 30 client tests |
| Actual reader/canonical PostgreSQL | 7 scenarios: persisted jobs/receipts, latest origins, retired/legacy review, later intent and privacy |
| Rebuilt browser | 21 scenarios and six regenerated 390/800/1280 light/dark status captures |

Positive controls use actual normalization/default scoring, PostgreSQL and the
dispatcher/execution worker. They prove one typed new-search child, atomic
queue/selection/success/audit rollback, no second failure/research budget charge,
same-child replay, awaited-drift refusal and later consent revocation before
enqueue. Disabled automation/readiness or insufficient confidence leaves pending
matches rather than an unowned automatic selection. Ordinary automatic selection
and start are bypassed for this scoped continuation.

Execution controls prove actual failed-enqueue atomic rollback without premark
or inline duplicate, older-search shared 320 handling, private-record/context/
metadata/provenance refusal, exact known-not-dispatched checkpoint cleanup that
preserves newer intent, accepted phase updates and unknown POST confirmation
without another POST. The confirmation adapter is controlled and does not prove
attempt attribution against retained provider history.

Both canonical and legacy acquisition responses omit the new private read facts.
Pending matches alone do not imply work. Current confirmed transfer facts win;
uncertain, unmarked legacy and retired selections without a newer immutable
choice use existing review guidance. Browser evidence checks list/detail
agreement, privacy, focus/scroll ownership and identical-text DOM stability.
All six bounded status-card captures were inspected by the browser owner; root
also inspected narrow light and wide dark wrapping/clearance.

Providers are controlled in-process search/enqueue/confirmation adapters. These
checks do not establish live Soulseek/HTTP transport, provider exactly-once,
instant revocation after begun IO, new positive strict spectral/library-add
acceptance, production-scale performance or screen-reader speech. Existing media
and filesystem protections remain in the complete regression suite.

The first broad gate passed 3,788 server, 4,348 client and 513 script tests;
integration ran 231 tests, with 225 passing, six failures and no skips. Its
failures include a legacy generic-recovery fixture, missing completed-transfer
origin and an old quality-recovery handoff assertion, plus PostgreSQL connection
timeouts and one pre-migration `ECONNRESET`. Focused migration/triage and the
complete final rerun are recorded below. Original logs are preserved; no timeouts,
guards or skips are relaxed. Parallel database reproductions were paused after
bootstrap connection timeouts.

The old fallback fixture now invokes the owning coordinator with stable source
run/item/observation and retains scope, fresh 320 and strict verification
assertions; its isolated case and complete seven-scenario file pass. The old
automatic-add fixture now supplies the actual originating completed-transfer
item and delegates genuine quality stops to the real recovery owner, asserting
stopped history without new acquisition. Its two changed controls and complete
eight-scenario media file pass. Initial migration also corrected a fixture-only
missing summary `statusMessage`. Both timed-out automatic cases pass in the
exclusive database window. The artist case passes unchanged in isolation after
its pre-migration connection reset. These outcomes do not prove the precise
external cause of the initial connection failures; original logs remain intact.
The final full gate passes every test and both builds without concurrent
PostgreSQL reproductions. No application runtime change was needed for this
triage; fixtures now model the guarded contract. The initial connection failures'
precise external cause is not established by later passing checks.

Fresh audit also identified a compatible music-metadata parser update. Its
separate [design](MUSIC_METADATA_SECURITY_UPDATE_2026_10_DESIGN.md) and
[outcome](MUSIC_METADATA_SECURITY_UPDATE_2026_10_OUTCOME.md) record the single
package change, real tag/service controls and bounded malformed-input evidence.
Combined application validation uses the patched dependency. Final security
validation passes with zero reported vulnerabilities at every severity in
`security-final.log`.

The implementation distinguishes recordable terminal history from new acquisition
authority. Explicit null clears consent; current recipients' valid floors and
formats apply without dropping a participant. Each scoped recovery child keeps
durable identity independent of mutable candidate context. Parent workers do not
also enqueue owned child candidates inline. Scoped rediscovery reserves its
accepted target rather than allowing an unrelated global claim to consume it.

## PR applicability and next item

The [scoped-overrides skill](../.agents/skills/harmoniarr-scoped-overrides/SKILL.md)
consumer map now locates null removal, every valid participant floor and durable
attempt semantics through delayed recovery. Repository/installed structure and
three-file SHA-256 identity pass. This is reference maintenance, not a new blind
behavioral trial.
Both maps also cover the positive post-ingest handoff: a pre-search guard or
zero-result fixture does not authorize a later ordinary download. Final source/
installed structure and identity pass after that reference synchronization.

The practical [web-standards skill](../.agents/skills/harmoniarr-web-standards/SKILL.md)
also maps delayed recovery, conditional known-undispatched retirement and truthful
current progress to actual project owners. Repository/installed structure and
four-file SHA-256 identity pass. Its invocation policy remains unchanged; no new
blind behavioral trial or whole-application conformance claim is made.

Unmarked legacy recovery requires **Find matches** and a newly valid match;
repeating **Start download** on its old cascade does not reconstruct authority.
Modern typed safely retired reservations retain the tested fresh canonical
handoff. Total old generic identity loss remains unreconstructible.

Fresh GitHub MCP repository discovery, collection pagination, full heads/bases
and changed-file comparisons found no eligible unreplayed patch. The same three
open PRs retain their earlier local replay identities; explicit page two is empty.
No random draw, redundant replay, downgrade or merge is applicable. See the
separate [PR design](OPEN_PR_APPLICABILITY_RECOVERY_2026_10_DESIGN.md) and
[PR outcome](OPEN_PR_APPLICABILITY_RECOVERY_2026_10_OUTCOME.md).

The next recommendation is **attempt-specific transfer confirmation**. Current
`slskd-download-handoff-reconciliation-service.js` matches username, normalized
remote filename and size over `includeRemoved: true` retained history. An older
identical transfer can therefore satisfy a newer uncertain enqueue. This is a
separate provider-attempt identity boundary from the local source-run/candidate
episode ledger; it is identified by source review, not a new live-provider proof.

The existing worker persists `dispatching` before POST. A thrown POST stays
uncertain and the run fails without immediately cascading; later work checks
matching transfers before another enqueue. Definitive returned rejection can
recover. Preserve that distinction. Fresh official discovery/review of
[RFC 9110, section 9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html) supports
requiring evidence before automatic non-idempotent retry.

Recommend inspecting actual supported provider transfer identity/time contracts,
retaining a bounded attempt observation before POST, and proving that old
same-file history, partial acceptance and lost responses do not confirm a new
attempt or trigger blind duplication. Reuse the current handoff/reconciliation
services and review state. The benefit is stronger acceptance evidence; the cost
is handling partial responses, history retention and unavailable provider proof.
Keep ambiguous outcomes in review rather than claiming external exactly-once
execution. That follow-up is not implemented by this scoped recovery slice, which
also does not claim to guard every ordinary non-recovery acquisition path.

Development remains on main. No separate branch, tag, release, PR merge,
hosted workflow dispatch or image publication is performed by this slice.
