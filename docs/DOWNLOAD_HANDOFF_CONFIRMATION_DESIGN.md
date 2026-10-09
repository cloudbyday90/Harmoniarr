# Attempt-owned download confirmation design

Accepted implementation design, 8 October 2026 (research consulted 9 October UTC).
Baseline: main at `33ad042a2042399fcbf12650330e607c43683026`, Node 24.18.1,
npm 12.0.2, checked-in slskd example 0.25.1. No release or provider upgrade is
part of this change. Outcomes and executed evidence belong in the separate
[outcome document](DOWNLOAD_HANDOFF_CONFIRMATION_OUTCOME.md).

## Problem and invariant

The legacy handoff matcher joins retained transfer history by peer, filename and
coerced size. An older completed transfer or an ID-less row can therefore make a
new interrupted request look accepted. A partial match can also appear completed
in diagnostics. The write service already refuses another POST while acceptance
is unresolved; presentation must agree with that guard.

Only durable evidence owned by the exact execution attempt may confirm it.
Persist an internal UUID, candidate/run ownership, unchanged source observation
and immutable requested manifest before sending the POST. Persist explicit,
validated provider receipts for that attempt. A later read may follow those exact
receipt identities; it must never discover ownership from filename history.
Unknown legacy requests without a receipt remain unresolved. Absence is not
proof of rejection, and no new POST follows from a missing or unavailable row.

## Official practices and applicability

URLs were discovered with MCP search and opened through official navigation.
These are bounded applications of the sources, not a whole-platform certification.

| Source and status | Application |
| --- | --- |
| [IETF RFC 9110, section 9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html), normative HTTP specification | A non-idempotent request needs known safe semantics or proof it was not applied before automatic retry. Keep uncertain dispatch and the existing no-second-POST guard. |
| [OWASP Business Logic Security](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html), informative engineering guidance | Derive ownership server-side, enforce explicit workflow states, and make sensitive check/write sections atomic. Receipt identity cannot overwrite another execution's link. |
| [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html) and [application consistency](https://www.postgresql.org/docs/18/applevel-consistency.html), database documentation | Lock the current owning rows and compare the durable attempt before linking receipts and confirming the checkpoint. Roll back all related writes on conflicts. Do provider I/O outside transactions. |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/), W3C Recommendation dated 12 December 2024; [Understanding status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages), informative guidance updated 11 May 2026 | Keep asynchronous confirmation distinct from downloading/completion. Existing polite status and review controls should reflect unresolved work without stealing focus. DOM checks do not establish screen-reader conformance. |

The provider version is a separate contract. Fresh official provider source
research identifies caller-ID download batches in slskd 0.26.0; it does not
establish that the checked-in 0.25.1 deployment exposes that API. Immutable
provider-source references and their exact evidence are recorded in the separate
[provider research](SLSKD_TRANSFER_CONFIRMATION_RESEARCH_2026_10.md).
Do not repeat the blanket claim that every slskd version
lacks caller request IDs.

## Alternatives, pros and cons

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Filename/size or timestamp history matching | Works with older providers; inexpensive | Historical, ID-less or concurrent external transfers can falsely confirm; provider timestamps are not a caller receipt | Remove as acceptance proof |
| Pre-POST stable-ID baseline | Excludes IDs already observed | A new ID still cannot identify the writer; malformed/incomplete snapshots and provider changes weaken attribution | Do not claim causal confirmation from a baseline |
| Durable explicit receipt plus exact attempt ownership | Compatible with pinned provider; rejects old and malformed evidence; small internal JSON contract | A lost response with no durable receipt requires review and may remain unresolved | Implement now |
| Caller-ID batches with exact per-file batch ownership | Provider-assisted attribution; duplicate batch ID is refused | Requires newer provider/capability policy; batch existence alone does not prove full enqueue; retention and incomplete batches need controls | Recommended next slice |

## Final recommendation stack and implementation contract

1. Use narrow ESM attempt/receipt policy modules. Validate a nonempty peer,
   positive safe integer sizes, unique normalized file identities and nonempty
   unique provider GUID transfer IDs, normalized for case. Reject conflicting peers/files, duplicate identities,
   malformed and empty success responses. Never coerce invalid sizes into proof.
   If direction is present, require the supported provider's `Download` enum text;
   absent direction remains tolerated for the existing adapter contract.
   Contradictory envelopes retain no arbitrary receipt subset; a consistent
   partial response may retain its admitted identities without confirming all files.
2. Save the attempt before provider work and preserve its original source and
   manifest on resume. A full exact receipt can confirm; partial acceptance keeps
   attention and blocks resubmission. Retain known accepted identities privately
   so they cannot be mistaken for whole-request completion.
3. Reuse one transaction owner for receipt links and confirmation. Compare the
   current checkpoint/attempt and physical source; stale observations must not
   advance or overwrite a newer attempt. Preserve Music Queue provenance and
   phase/audit ownership. No provider calls while database rows are locked.
   Initial item creation must preserve existing checkpoints, and the candidate
   lock must exclude unresolved handoffs in another run. Check the acquired
   lease owner/acquisition time and interruption gate again before POST. These
   guards do not redesign generic lease renewal or distributed scheduling.
4. Keep unresolved items durable across global and per-type ledger pruning.
   Poll older unresolved items through a bounded owning read, rather than relying
   only on the newest run. Legacy items without attempt receipts fail closed.
5. Derive private current-handoff facts for canonical permissions and review
   status, including terminal runs. Suppress misleading Start download controls.
   Exclude new attempt UUIDs, receipt manifests and provider evidence from public
   projections and execution API extensions; expose only bounded status/counts.
6. Verify malformed/historical/partial/full/stale evidence, no second POST,
   PostgreSQL rollback/conflict/retention, DTO privacy and background UI refresh.
   Run repository validation and a fresh dependency security check before commit.

Provider-assisted batches are the next recommendation. This slice deliberately
does not promise resolution of legacy lost responses or external exactly-once
execution. Manual/operator resolution remains limited by the existing safe
recovery contract; no new destructive provider command is introduced.

An accepted local receipt is distinct from live completion. If only a subset of
its exact transfer IDs is currently visible, withhold whole-request completion.
For new attempt-owned requests, disappearance remains observational uncertainty;
do not follow a replacement ID by filename or infer a safe re-POST. Existing legacy
confirmed-item grace behavior is a separate compatibility path, not evidence that
an unknown request was never applied.

If an older POST has already started when a newer run is merely allocated, keep
the exact older receipt in its still-owned checkpoint. Preserve the current-origin
phase guard and leave the conflict in review; a newer allocation is not permission
for another POST. Polling and presentation must retain the older unresolved work.
This bounded behavior avoids silently changing every downstream origin rule.
