# Music Queue fallback recovery design

Status: Accepted for implementation
Research date: October 8, 2026
Baseline: `d405771b430f1271445f94e07443de836409ed85`, main

## Problem and scope

Recovery currently commits terminal history, attempt count, promotion and follow-up
queueing separately. Its context helper uses null coalescing for consent, so an
explicit `qualityOverride: null` can re-inherit the saved override. Caller
arguments cannot carry a complete fresh floor/format/participant context.
Promotion guards competing selections and saved context, but not current exact
recipient authority. Delayed retry jobs can outlive the policy that selected them.

The shipped [automatic-add guard](MUSIC_QUEUE_AUTOMATIC_LIBRARY_ADD_GUARD_OUTCOME.md)
already refuses incompatible recovery handoffs. This design does not claim a
revocation bypass through that protected path. It makes recovery itself consume
current authority, so legitimate changed requirements can be handled safely.

Cover persisted Music Queue download failure, quality failure, import blocker
and rejected-transfer recovery. Preserve generic unowned behavior and existing
queues, leases, attempt budgets, delays, media verification and filesystem guards.
Malformed owned context must refuse rather than fall through to generic recovery.
No new user command, broad policy-engine migration or release is proposed.

## Discovered official research

MCP/web search and official navigation discovered the URLs below; they were
opened on October 8. Consultation date is distinct from publication date.
Framework guidance and normative specifications do not establish project
behavior without executed evidence.

| Source | Authority and applicable practice |
| --- | --- |
| [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) and [authorization patterns](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Patterns_Cheat_Sheet.html) | Security practice guidance: enforce current object/relationship authority close to the protected operation. Applying this to delayed system recovery is this design's inference; an old scoped exception is not current consent. |
| [OWASP business logic security](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html) | Practice guidance: server-owned workflow state, atomic check/write sections, durable intent and actual ordering/concurrency tests. A database transaction cannot make a provider side effect atomic. |
| [IETF RFC 9110 HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110.html) | Standards-track RFC, section 9.2.2: a non-idempotent request needs known idempotent semantics or evidence it was never applied before automatic retry. Retain uncertain enqueue reconciliation; the local recovery episode ledger does not prove provider exactly-once execution. |
| [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html) and [application consistency](https://www.postgresql.org/docs/18/applevel-consistency.html) | Versioned database guidance: short transactions, compatible lock order and fresh reads after locks. Relevant writers must participate; absent-row intent creation needs coordination. |
| [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Informative WCAG explanation: present truthful waiting/result text with existing programmatic semantics without background focus theft. Pending matches alone do not demonstrate work in progress. No new announcement for every internal event is required. |

Retain explicit ESM imports/exports, narrow injectable factories and current
runtime support. Local tools report Node 24.18.1/npm 12.0.2; current first-party
code and validation remain ESM. This slice does not require a runtime upgrade.

## Alternatives and final recommendation stack

| Option | Benefits | Costs or failure mode | Decision |
| --- | --- | --- | --- |
| Keep preflight-only compatibility refusal | Smallest change; current automatic add remains conservative | Does not fix legacy null/floor semantics or split recovery writes | Retain as boundary until owning guards replace it |
| Add more caller arguments without owning coordination | Carries fresh values | State/policy can drift and promotion can outlive queue failure | Reject as complete fix |
| Hold database locks across provider/media IO | One long decision window | Long contention, external failure and no distributed atomicity | Reject |
| New recovery queue or global policy engine | Separate lifecycle | Duplicates leases, cancellation, audit and policy ownership | Reject |
| Shared scoped recovery coordinator, transaction and delayed worker guards | Current authority, explicit consent removal, atomic durable intent and bounded replay | Requires compatible producer locks and private job identity | Adopt |

Retain Vue, Express/Node 24 ESM, PostgreSQL and the existing discovery/execution/
apply workers. Add narrow Music Queue recovery policy, service and store owners;
delegate the existing four handler names to them for owned candidates. Keep SQL
in stores and pure identity/quality rules in policies. Existing large services
receive adapters/hooks rather than another large orchestration singleton.

## Terminal observation and current acquisition authority

Separate observed failure from permission to start new acquisition. A genuine
terminal provider/media observation can remain stopped history when recipients
are disabled or unlinked. Invalid current scope cannot increment acquisition
attempts, promote another match, retry or request rediscovery. Stale observations
must not fail a candidate whose source/provenance has changed.

Capture trusted source operation/candidate provenance before awaited provider or
media work. Forward the originating execution run through completed-download
blocker preflight, rather than inventing identity after the await. Missing stable
origin permits only a conservative stopped observation, not new acquisition.

Resolve primary identity, physical request ownership and exact acquired/current
membership from persisted source facts. Require all original recipients enabled,
linked, missing/partial, nonignored and with positive missing count for new work;
reject unlinked/late/disabled/malformed scope without dropping a recipient.
Require current failed search/metadata and no competing active selection.

Rebuild a complete effective requirement from original failed/chosen candidate
verification baselines and current recipient policy. Retain the highest applicable
numeric floor and format preferences through existing shared-profile semantics;
a preferred format is not an invented hard whitelist. Saved 320 minima must not become
a profile-name-only 256 requirement. Recompute valid wanted-bound consent; do not
copy an exception between different acquired sets or trust caller profile values
as recipient authority. Search broadening does not waive later media/spectral/
safe-add checks.

Normalization distinguishes omission from explicit null: omitted override retains
the helper's legacy inheritance semantics; explicit `qualityOverride: null`
clears it. Guarded ownership dominates raw `musicQueue`/`musicQueueContext`
presence, including malformed values. Correct production wiring therefore does
not expose that saved-context inheritance through an unowned generic path.
Generic caller values cannot graft another target's consent onto an unowned
replacement. A missing required owner fails before generic recovery side effects.
Owned recovery uses the complete freshly derived context, including null, instead
of falling back to saved consent. Invalid raw policy is conservative while valid
default/partial account preference objects retain their existing semantics.

Include every valid participant exception's numeric floor, even when both
account profiles are Lossless and a representative shared exception is 256.
A sibling's saved valid 320 floor still controls selection and delayed consumers.

Same-search replacements are preferred. Older-search candidates are eligible
only for the same metadata and exact acquired primary/participant/physical scope,
with their own known stricter baseline retained and current consent rebuilt.
Unowned historical replacements and mismatched scopes refuse; no new authority
is assigned to them. External approval-owned candidates remain excluded.
Preserve the selected candidate's own search/provenance. The child pins that
candidate/search plus the accepted failed-source discovery context; an older
selected search does not become the current failed search by inference.

## Owning transaction and episode replay

Inspect scope/candidates outside locks. Commit through one short transaction:
maintenance -> sorted participant accounts -> wanted/current discovery/links ->
relevant operation-creation coordination -> all touched candidate parents in
sorted ID order -> files/event episode/run-item rows as needed. Re-read exact
provenance, membership, policy and candidate selection. Quality evaluation of
persisted advertised evidence is pure; no provider or media IO belongs inside.

Eligible recovery commits terminal transition/event/required audit, one attempt,
fresh context, retry or promotion, and scoped durable child run/required start
audit together. No eligible next match may instead commit guarded delayed
rediscovery request/deadline/budget plus scoped discovery run and required audit
in the same transaction. Required event/audit/queue failure rolls the eligible
decision back. Invalid scope may commit only genuine stopped history once.
Best-effort notifications and external dispatch occur after commit.

Use existing event details as a durable episode ledger under the parent lock
unless implementation evidence requires a schema change. A stable source-run/
candidate attempt identifies the episode. Competing rejected-transfer and
download-failed observations for that same attempt cannot increment twice or
create retry plus promotion. Kind, mutable timestamp or incremented count alone
is not the deduplication key. A later child retry has a new source run/episode;
diagnostic updates do not authorize a second acquisition decision.

New Music Queue recovery always queues a scoped child, including callers that
previously appended into the current worker. Its result marks durable ownership
so the original worker does not also enqueue it inline. Generic append behavior
remains unchanged. A child must queue while its failing parent is still running;
existing same-type lease/dispatcher serialization governs execution. Creation
coordination/coalescing must not strand a promoted candidate through generic
global-active refusal.

## Delayed execution and rediscovery

Persist exact selected candidate/search identity, a distinct recovery source and
private bounded accepted primary/participant/physical authority in the owning
child run. Preserve baseline verification/numeric requirements as a lower bound;
current preferences and consent remain live. Classification survives mutable
candidate context removal. Generic/unrelated runs cannot adopt a candidate owned
by this private recovery job; old unmarked Music Queue recovery work refuses
instead of receiving inferred authority.

Original canonical download jobs with durable `missing_music_manual` source and
target identity can also refuse if candidate context is lost. Some historical
global/generic jobs have no durable acquired-domain identity; total old context
loss cannot be reconstructed. Do not claim universal historical classification
or backfill consent for those jobs.

Use durable run reservation rather than only mutable candidate markers for that
exclusion. A delayed recovery rediscovery run similarly reserves its one target;
ordinary claims cannot consume it on behalf of another run. Scoped discovery
skips unrelated global reconciliation/artwork, claims only accepted metadata,
and checks after awaited preparation immediately before search. Preserve one
shared search and existing lease serialization.

Before provider checkpoint/enqueue, verify the exact owning active run, current
candidate and all recipients, then evaluate current effective requirements.
Recheck after awaited checkpoint preparation immediately before provider enqueue.
No database locks span the network call. Refused authority is not a new provider
failure and must not initiate a recovery cascade. Existing apply guards still
verify actual downloaded media before library mutation.

Guard delayed rediscovery against the accepted failed-source/participant scope
before touching discovery/provider work. Existing dispatch already rebuilds
current format/floor preferences; its filtering alone does not prove unchanged
acquired membership. Preserve one shared discovery intent and scope the guarded
run to its intended request, with stale/newer-search and active-work refusal.
Do not claim external atomicity or instantaneous revocation after an operation
has begun.

Known pre-provider authority refusal must leave a usable stopped/review state,
not permanent selected work reserved by a terminal job. Retire/demote only the
still-owned intent through conditional guarded writes; do not change newer
selection or release an uncertain dispatch. An accepted/unknown provider
dispatch retains its reconciliation boundary rather than becoming a new failure.

Scoped rediscovery refusal must similarly stop or quarantine its still-owned
ready request and stale automatic-progress evidence. Ordinary reconciliation/
claims must not silently reactivate that refused intent. A newer legitimate
request must remain untouched; an explicit fresh canonical action can establish
new authority. Status suppression alone does not prevent provider work.

## Positive rediscovery continuation addendum

Accepted October 8 after the first guarded worker review. A scoped search with
results still called ordinary auto-selection/download after awaited ingestion
and folder readiness, using the pre-search requirement. The ordinary
`auto_selection` job had no recovery reservation. The zero-result search controls
did not prove this positive handoff; checking before search alone cannot authorize
the later download POST.

Preserve automatic recovery through a narrow owning continuation. Reuse existing
confidence evaluation and settings/readiness semantics through a proposal/read
boundary; keep provider/media work outside transactions. After awaited ingestion
and readiness, lock/re-read the owning scoped run/claim, complete acquired/current
recipient and physical scope, original baseline and relevant candidates using
the established order. Rebuild current complete requirements and evaluate the
chosen persisted evidence. Refuse supersession, missing/changed scope and newer
active work without assigning new authority.

Commit successful current search evidence/marker completion, eligible selection,
fresh candidate context, exact typed recovery execution child and required audit
together. The child's current accepted discovery/search is the newly observed
search; preserve original causality separately. Retain the highest original,
current and chosen-candidate baseline. Do not increment the already-decided
failure attempt or research budget again. Scoped positive work must not also
create an ordinary `auto_selection` job. Existing disabled automatic settings,
unavailable readiness or insufficient confidence can leave pending reviewable
matches; they must not leave an unowned automatic selection.

| Continuation option | Benefit | Cost/limit | Decision |
| --- | --- | --- | --- |
| Keep ordinary automatic handoff | Least code | Loses the scoped authority boundary after awaited work | Reject |
| Add only a post-ingest preflight | Fresh at one moment | Selection/queue can diverge and delayed download still lacks durable authority | Reject |
| End every scoped result at manual review | Conservative and small | Changes the platform's automatic recovery behavior | Use only existing readiness/settings/confidence review cases |
| Narrow atomic scoped continuation and existing execution guard | Preserves automation with fresh requirements and durable scope | Requires a proposal boundary and transactional success/selection/queue coordination | Adopt |

Prove positive persisted ingestion under controlled provider responses, one exact
guarded child, current shared floors/consent and refusal after awaited drift.
Required audit/queue rejection must roll back search acceptance, selection and
intent. Exercise the real execution worker for the resulting child; distinguish
controlled search/enqueue adapters from live provider/transport acceptance.

Unmarked legacy recovery still requires **Find matches** and a newly valid match;
repeating **Start download** on its old cascade does not reconstruct authority.
Modern typed safely retired reservations support the separately tested explicit
handoff. Keep those compatibility paths distinct in status and documentation.

## Public outcomes and meaningful evidence

Distinguish stopped observation, refused new work, selected match, durable queued
intent and running work. Pending matches alone must not say **Trying another
match**. Reuse existing canonical status/commands, polite atomic current status
and owned focus. Omit private authority, consent, participants, paths and provider
diagnostics from canonical list/detail/Activity projections.

Verified current scoped child intent controls queued/preparing feedback. A
known unretired protected selection with invalid authority or uncertain handoff
uses existing **Needs help / View recovery** until safe retirement or confirmed
transfer evidence resolves it. A held reviewable candidate alone is not a
selected **Start download** intent. Current provider-confirmed facts are tied to
the accepted candidate/run, including a permitted older-search child; broad
historical sibling links cannot establish current transfer progress.

Prove explicit-null/omission, floors/formats, shared/revoked consent, below-floor
and claimed-lossless decisions, disabled/unlinked/late/stale scope, competing
terminal kinds, same-episode replay, later retry episode, parent-active child
creation and no inline duplicate, queue/audit rollback, sorted-parent races,
delayed checkpoint drift, private job/candidate-context loss and truthful public
projection. Use real PostgreSQL for transactional/queue claims and controlled
provider adapters for actual boundary calls; do not claim live providers from
fixtures. Actual media/library restrictions remain verified by existing focused
regressions when affected. Browser evidence is appropriate for changed visible
states; DOM roles do not establish screen-reader speech.

Run focused tests and independent bounded review before complete repository and
current security gates on frozen source. Record executed results and limitations
in a separate outcome. Fresh PR applicability has its own design/outcome.
Work remains on main; commit/push all completed changes without a branch, PR
merge, tag, release, hosted workflow dispatch or image publication.
