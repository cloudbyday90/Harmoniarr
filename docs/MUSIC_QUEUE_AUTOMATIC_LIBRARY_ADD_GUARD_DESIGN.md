# Music Queue automatic library-add guard design

Status: Accepted for implementation
Research date: October 8, 2026
Baseline: `04fdbce692db2b90e65d6c5397513f943892e710`, main

## Problem and bounded scope

Completed-transfer reconciliation moves a candidate to `import_pending` and
calls `import-candidate-auto-apply-run-service.js`. Its `download_completed`
starter uses generic apply acceptance. That acceptance checks maintenance,
active work and candidate readiness, but does not rebuild current Music Queue
participant authority and quality policy. The shared worker resolver currently
guards explicit add/recheck sources and passes this automatic source through.

Extend the previous [guarded Add to library](MISSING_MUSIC_ADD_TO_LIBRARY_OUTCOME.md)
owners to automatic Music Queue additions. Automatic authority comes from saved
acquisition intent and current eligible recipients; it does not come from an
explicit command's consent marker. Preserve original physical request ownership.
Non-Music-Queue completed-download imports retain their existing generic
contract. No new route, UI command, queue, dependency or schema is proposed.

## Official research and applicability

URLs were discovered through MCP/web search and official navigation, then opened
on October 8. Consultation date is distinct from publication date. These sources
guide the design; application behavior needs executed evidence.

| Source | Authority and applicable practice |
| --- | --- |
| [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Security practice guidance: default refusal, current object/relationship authority and enforcement at the owning resource. Applying this to delayed system work is this design's inference; a past download policy is insufficient current authorization. |
| [OWASP authorization patterns](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Patterns_Cheat_Sheet.html) | Security architecture guidance: keep enforcement near the resource. Shared local policy/service owners suffice; no external policy server or AuthZEN migration is needed. |
| [OWASP business logic security](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html) | Practice guidance: derive security-relevant values on the server, enforce workflow state and test actual ordering/concurrency adverse cases. |
| [OWASP authorization regression testing](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Regression_Testing_Cheat_Sheet.html) | Testing guidance: maintain explicit actor/resource/action cases alongside functional tests. Here the actor is the system; recipients, saved intent and current policy still need adverse coverage. |
| [PostgreSQL 18 locking](https://www.postgresql.org/docs/18/explicit-locking.html) and [application consistency](https://www.postgresql.org/docs/18/applevel-consistency.html) | Versioned database guidance: consistent lock order and current reads within short owning transactions. All relevant producers must participate; row locks do not protect arbitrary later filesystem operations. |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Normative W3C Recommendation plus informative explanation: expose truthful waiting/result states through existing programmatic status semantics without background focus theft. No new announcements or full conformance claim are required by this backend slice. |
| [Node 24 ESM](https://nodejs.org/download/release/latest-v24.x/docs/api/esm.html) | Versioned implementation guidance: explicit ESM imports/exports. Consulted documentation reports 24.21.0; local execution reports Node 24.18.1 and npm 12.0.2. |

The W3C criterion does not require adding status messages for every internal
event. Inspect the existing projection and rendered behavior for the selected
journey. Automated DOM evidence does not establish screen-reader speech.

## Alternatives, pros and cons

| Option | Benefits | Costs or failure mode | Decision |
| --- | --- | --- | --- |
| Keep generic automatic acceptance and its saved context | Smallest change | Current account, relationship or stricter policy can be missed | Reject for Music Queue |
| Guard only when queueing | Current acceptance and bounded work | Delayed execution can outlive policy or provenance | Reject as complete solution |
| Infer explicit manual consent for automatic jobs | Reuses one marker | Conflates system intent with a recipient's explicit command | Reject |
| Duplicate automatic queue/worker/quality logic | Separate lifecycle | Duplicates leases, locks, recovery and file authority | Reject |
| Narrow automatic adapter plus shared preparation, transaction and worker checks | Current system authority, consistent queue/audit rollback and actual measured/file safeguards | More coordination and conservative refusal of stale work | Adopt |

## Final recommendation stack and owners

Retain Vue, Express, Node 24 ESM, PostgreSQL and existing durable workers.

1. Add a narrow `import-candidate-music-queue-auto-safe-add-service.js` adapter.
   Derive the primary wanted identity from the persisted candidate; resolve its
   recipient and exact acquired/current participant membership on the server.
2. Share `import-candidate-release-safe-add-preparation-service.js` for current
   scope, decisions, positive all-ready planning and measured quality.
3. Generalize the guarded acceptance owner's private boolean to explicit
   command modes. Add an automatic wrapper that uses the established locks,
   queue starter and required audit in one transaction.
4. Extend shared queued facts and worker policy to newly guarded automatic Music
   Queue work. Keep public status/permission projection on those same facts.
5. Reuse existing media verification, checkpoint, exclusive file operation and
   maintenance owners. Do not weaken staging/reuse or lossy-plan restrictions.

Narrow injectable ESM factories own each responsibility. Existing large workers
receive wiring/hooks; new business logic belongs in service or policy modules.

## Current system authority and preflight

Detect Music Queue ownership from persisted `musicQueue`/`musicQueueContext`
presence before generic dispatch. Malformed or incomplete owned scope refuses;
it must not fall through to generic acceptance. Require a valid saved primary
wanted identity, exactly one current-search owned prepared candidate, persisted
child files and no conflicting active selection for the search/metadata scope.

Every acquired participant must still exist in the exact current discovery
membership, belong to the same metadata release, be enabled, missing/partial,
nonignored and have positive missing count. A later join, unlink or disabled
recipient cannot be silently dropped. The system actor is null; the original
primary and physical `requestOwnership` remain unchanged.

Prepare outside write locks. Rebuild effective quality from the downloaded
requirement and current participants, keeping saved numeric floors, stricter
requirements and only valid target-owned exceptions. Require a positive,
nonempty all-ready plan and successful measured quality/spectral checks under
their existing policies. Completion of a provider transfer alone is insufficient.

The automatic dispatcher must check current Music Queue authority before any
existing blocker-recovery branch. Its legacy recovery owners and limitations
must be traced separately: automatic-add acceptance does not grant a new
recovery permission or make an unrelated recovery write atomic. Invalid current
scope refuses without recovery. Legitimate existing prerequisites and collision
handling should retain their bounded contract rather than becoming a bypass.

Existing missing-source recovery cannot carry a newly stricter numeric floor or
clear old consent with a null override. Delegate that recoverable retry only
when rebuilt requirements agree with the persisted recovery requirement, after
re-reading exact scope/snapshots immediately before handoff. Changed requirements
refuse. This bounds stale-policy propagation without claiming the legacy
multi-step failure/promotion/rediscovery branch is one guarded transaction.

Apply the same bounded rule to a new automatic worker's quality-failure handoff:
after awaited measured/spectral checks, reassert its queued snapshot and require
compatible current/persisted recovery requirements before invoking legacy quality
recovery. A file-mutation callback alone does not protect this earlier branch.
Changed authority or unrepresentable policy must not select another match using
stale consent. This slice does not redesign the entire recovery cascade.

## Atomic acceptance and delayed execution

Use maintenance -> sorted target/participant accounts -> wanted/discovery/links
-> global apply advisory -> candidate/files/decisions lock order. Re-read exact
current candidate, participants, decisions and scope. Do not hold these locks
over media probes or filesystem IO.

Save fresh context with `automaticLibraryAddForWantedReleaseId`, queue one scoped
`safe_auto` move run with source `music_queue_download_completed` and system actor, and write
the required operation-start audit atomically. Automatic add does not reopen the
candidate or emit explicit recheck history. Queue/audit failure rolls all writes
back. Repeated eligible starters coalesce exact guarded work; generic, unmarked,
manual-mode or unrelated active work remains deferred.

The distinct persisted run source keeps new Music Queue work guarded even when
the candidate's entire Music Queue context is removed before startup. A mutable
candidate-only discriminator would allow that loss to look like a generic job.
Existing queue/run normalization already retains arbitrary trigger strings; no
enum or schema change is needed. The completion adapter's bounded result retains
`download_completed` for its existing reconciliation contract.

New automatic runs also retain a private, bounded accepted authority record for
the primary/acquired participant identities and physical request ownership.
Repeat current primary/physical provenance validation at the worker boundary
and compare it with that run record before preview and each mutation. A current
participant predicate alone permits ownership deletion or redirection to another
participant before snapshot capture; the accepted record must reject those
changes, including owned-versus-shared identity. It does not pin mutable folder
configuration or arbitrary external bytes. Public projections omit this record;
no legacy/manual-run ownership backfill is proposed.

For automatic Music Queue jobs, validate the automatic owning marker, current
scope, exact active run/source and all participants. Capture candidate/policy/
provenance before awaited preview preparation, rebuild current quality, then
compare after checkpoint persistence immediately before every file mutation.
Continue refusing unverified older staging/checkpoint/reuse bytes in safe-auto.

Legacy `download_completed` jobs with retained Music Queue ownership refuse
before file work; no consent
inference or backfill is proposed. Generic non-Music-Queue jobs retain their
contract. Checks before an operation do not make subsequent policy changes
atomic with it or prevent arbitrary external replacement of source/staging bytes.
Historical automatic ownership cannot be reconstructed when every old owning
context has already been removed; do not claim otherwise. New distinct-source
jobs must refuse marker-only and whole-context removal.

## Public outcomes and evidence

Newly marked automatic work must project truthful `adding_to_library` and exact
coalescing; queued work does not mean completed file acquisition. Keep private
candidate paths, trigger/consent markers, participant policy and diagnostics out
of canonical list/detail/action responses. Reuse existing canonical Add/recheck
recovery where applicable and document any refusal that needs a later recovery
slice. No durable automatic retry is inferred: current reconciliation starts on
the transition to `import_pending`.

Prove dispatch selection, malformed-scope refusal, current-search/membership,
stricter floors/valid exceptions, shared coalescing, atomic context/queue/audit
rollback and preflight/write/worker drift. Use real PostgreSQL for transactional
claims and test-owned measured files for worker success and adverse mutations.
Include disabled/unlinked/late recipients, stale search, candidate/decision drift,
unmarked jobs, collision/staging/reuse and source retention. Distinguish actual
queued consent revocation from separately reconstructed quality-consumer tests.

Verify public queued/refused projections and unchanged canonical interaction
semantics at their owning boundaries; use browser evidence when rendered behavior
changes or needs regression coverage. Run focused checks and independent bounded
review, then full repository/security gates on stable source. Record only
executed results in a separate outcome document.

Fresh open-PR applicability has separate design/outcome documents. Work remains
on main; commit and push completed changes without a branch, PR merge, tag,
release, workflow dispatch or image publication.
