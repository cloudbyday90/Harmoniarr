# Missing Music library-add recheck design

Status: Accepted for implementation
Research date: October 3, 2026
Baseline: `af7336013e58ebd3524e2e08c11b6009380335bc`, main

## Problem and bounded journey

The canonical worklist advertises **Check the files again**, but the Missing Music
inspector exposes no library-add recovery command. Existing acquisition recheck
supports repaired source folders and interrupted audio verification. It currently
reopens the candidate in one transaction, audits afterward, and starts apply in
another transaction. A queue/maintenance conflict can leave reopened work without
the intended operation. Apply start also checks for an active run before creating
one without an atomic absent-row coordination boundary.

Settings automatically invokes that legacy actor-owned recheck after a healthy
folder save. That cannot complete an administrator's handoff for another
recipient. Complete this journey instead: inspect bounded recovery guidance,
repair the prerequisite, return to the same recipient's decision, explicitly
recheck, then see truthful queued/current state. Keep the existing safe-add worker
as the final measured-quality and filesystem authority.

This slice covers only `source_path_unavailable` and `media_verification` with
`audio_check_failed`. Collision, unsafe plans, low quality, suspicious lossless,
generic verification/add failure, and manual **Add to library** are separate
decisions. No bypass, quality override, second queue, or new schema is proposed.

## Official research and applicability

Official URLs were discovered via MCP/web search, source metadata, and official
navigation and opened on October 3. Consultation date does not imply publication
date. The web-standards skill supplies the applicability/evidence method.

| Source | Authority and implementation decision |
| --- | --- |
| [W3C keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard), [status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages), and [focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) | Informative WCAG guidance: native keyboard command, persistent feedback outside busy ancestors, meaningful visible focus with no background/user-moved focus stealing. |
| [W3C link purpose](https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context) | Informative guidance: describe the folder-repair destination and canonical return, preserving the user's context. |
| [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) and [CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) | Security guidance: current server object/recipient authority and session-bound mutation protections; browser permission and Settings context are not authority. |
| [OWASP redirects](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html) | Security guidance: keep existing bounded internal named-route recovery context, not an arbitrary client return URL. |
| [IETF RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) | Standards-track HTTP semantics: use an explicit POST command and existing durable intent keys for uncertain retries; POST itself is not intrinsically idempotent. |
| [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html) | Versioned database guidance: consistent transaction lock order, current-state revalidation and advisory coordination for absent active-run rows. All relevant producers must participate. |
| [Node 24 ESM](https://nodejs.org/download/release/latest-v24.x/docs/api/esm.html) | Versioned runtime guidance: retain modular explicit imports/exports and the current supported runtime. |
| [Node 24 file operations](https://nodejs.org/download/release/latest-v24.x/docs/api/fs.html) | Versioned runtime guidance: exclusive destination creation refuses an existing target; it does not make copying atomic or establish the measured identity of later-selected input bytes. |

These sources support relevant practices, not a full WCAG or security certification.
The recovery allowlist, response fields, shared physical effects, and audit/queue
contracts are project decisions. Retain existing stronger 44-pixel mobile targets.

## Alternatives and recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Add an inspector button calling the legacy route | Small UI change | Actor scope breaks household handoff; nonatomic reopen/start remains | Reject |
| Make Settings save automatically recheck a selected recipient | Fewer clicks | Conflates configuration with acquisition and needs another durable command lifecycle | Reject |
| Queue a second recovery worker | Independent workflow | Duplicates operation, quality and filesystem ownership | Reject |
| Explicit canonical recheck through one repaired owning service | Preserves existing safety/operation infrastructure; current scoped authority | Needs guarded snapshots, atomic acceptance and real concurrency evidence | Adopt |
| Expose manual add in the same slice | Completes another advertised action | Adds distinct confirmation and eligibility boundaries before recheck is proven | Defer |

Retain Vue, Express, Node 24 ESM, PostgreSQL and existing durable workers. Add
narrow policy, command, transaction/store and UI modules. Reuse the existing
quality gate, file plan, staging, mutation/retry gate, feedback and focus owners.

## Command, policy and atomic acceptance

Add `POST /api/v1/missing-music/decisions/:decisionId/recheck-library-add`, body
`{}`, fresh session, CSRF, mutation limiter, durable scope
`missing-music.decisions.recheck-library-add`, and a decision-ID fingerprint.
Server target resolution preserves requester/operator own scope and administrator
household scope; disabled recipient history is read-only. Do not accept candidate,
recipient, path, safety-mode, or quality fields from the browser.

One pure policy drives detail permission, canonical action classification, and
guarded write. Require an active recipient's nonignored missing/partial wanted
release, the current scoped failed recovery candidate and allowed prerequisite,
and no newer conflicting candidate/handoff. A broken prerequisite may leave
recheck available, but the command must then return a truthful no-write outcome.
Historical snapshots alone cannot establish current ownership or eligibility.

Preparation reads the current recovery candidate, files and saved decisions,
checks tooling where applicable, regenerates a positive nonempty ready plan, and
runs the existing measured gate outside write locks. Preserve intentional profile
semantics, including Any; it still requires a nonempty safe plan. Preflight does
not authorize later filesystem mutation.

The short owning transaction obtains maintenance -> target account eligibility ->
owned wanted/shared discovery/link -> global apply-start advisory -> candidate
-> existing file/decision locks. File-decision writers acquire the parent candidate
before fresh status validation and child mutation, avoiding the opposite child ->
parent order. Batch ingestion prelocks its already-existing candidate parents in
ID order before provider-order file replacement. Default recovery promotion
uses the existing discovery selection guard in a short owning transaction before
its conditional candidate update; it refuses another active selection. The guard
also coordinates older searches and metadata-only recovery through the trusted
discovery/ownership metadata identity. Reread
current recovery/selection evidence and target policy. Validate
prepared candidate status/version/context and file/decision snapshots; changed
state refuses acceptance. Verify policy/preferences relevant to the prepared gate
have not changed, or rerun the owning current policy before accepting. Inspect
conflicting writers and keep existing lock order.

Recompute shared requirements from current participant policies while retaining
the downloaded candidate's saved requirement and any stricter numeric floor.
Compare current discovery membership with the acquired recipient scope under the
discovery guard; refuse a changed set rather than silently expanding consent or
checking only historical participants. The worker must refresh the relevant
participant policy again, so queue acceptance cannot preserve revoked consent or
an outdated quality floor until later file mutation. Compare that policy and
eligibility snapshot again after measured/spectral preparation and before entering
the apply operation; refuse intervening drift. Do not hold a database transaction
open across media probes or filesystem IO, or claim atomic policy changes once the
filesystem operation has already begun.

Commit failed -> import_pending, its existing recovery event, required recovery
audit, one scoped `safe_auto`/move operation, and required operation-start audit
together. Queue or audit failure rolls back every write. Add queryable support at
the narrow existing resume/queue boundaries; do not read uncommitted state through
a separate pool or perform a post-commit queue start.

All apply producers share the owning start transaction/advisory lock and current
state check. Preserve the existing in-progress conflict for general apply calls.
For recheck, unrelated/global active apply returns `deferred` without reopening.
Only a pending/running safe-auto run containing this exact currently scoped
import-pending candidate qualifies as `already_queued`; no duplicate audit/run.
The worker must repeat current preview, quality, staging and exclusive filesystem
checks before applying files. Independent source review found that preview-source
verification alone does not cover an existing staging file or reusable library
file selected by the operation. Safe-auto apply must verify the actual selected
finalization/reuse bytes, or conservatively refuse alternate inputs. Prove the
existing-staging/reuse adverse case at that owning worker/operation boundary;
command preflight and exclusive destination creation alone are insufficient.
For this slice, conservatively refuse preexisting staging and reusable library
inputs in safe-auto mode, while allowing fresh staging from the checked download.
Manual operation behavior remains owned by its existing review contract. This
avoids adding another probe/identity system, at the cost of leaving those
alternate-input recovery cases for explicit review. Do not claim protection
against arbitrary external replacement of the original or freshly staged bytes.

Return bounded action facts `code: recheck_library_add`, decisionId, targetUserId,
outcome, and nullable runId. Outcomes are queued, already_queued,
prerequisite_not_ready, still_needs_review, not_available, and deferred. Queued
means durable operation acceptance, not completed library addition. Same-key
replay preserves the original response; different keys coalesce current work.

## Public projection and UI

Expose only bounded current recovery category and matching active-run facts;
keep raw candidates, file paths, provider bodies and probe/SQL errors private.
Before the worker creates new items, old blocked items must not mask a newly
queued safe add. Project canonical progress and remove recheck permission/action
after acceptance. If broad legacy projection advertises recheck but strict policy
denies it, canonical nextAction is null.

Use `permissions.canRecheckLibraryAdd` and `canRepairFolders` for an extracted
recovery panel. Reuse the shared decision command gate, uncertain retry intent,
persistent polite/atomic feedback and interaction-owned refresh/focus. Render a
typed native **Check the files again** button with recipient explanation. All
outcomes have fixed bounded text; none promises completion.

The public `libraryAddRecovery` projection contains only `reasonCode`, `queued`,
and nullable `runId`. Allowlisted reasons are `source_path_unavailable` and
`audio_check_failed`; queued facts require exact current safe-auto membership.

Show a folder-repair Settings link only for that category and an authorized
administrator. Use the existing internal `missing_music_decision` context and
decision identity. A healthy save supplies a return link; it makes no automatic
legacy recheck request. Returning mounts current canonical detail and requires an
explicit action. Interrupted media checks explain that deployment tools must be
repaired; do not invent a Media & storage control for installing those tools.

## Evidence and completion

Prove pure policy/read/write agreement, requester/admin scope, disabled/maintenance,
fresh-session/CSRF/body guards, paging beyond retained-list limits, same-key replay,
different-key coalescing, unrelated-run deferral with no reopen, both required audit
rollbacks, queue failure, stale context/files/decisions, and worker/account races.
Use real PostgreSQL for owning locks/atomicity. Exercise actual test-owned media
and folder repair through queue/worker add, plus measured-quality, alternate
staging/reuse and collision refusals; distinguish controlled probes from real
measured/file execution.

Browser evidence covers all bounded outcomes, six-command exclusion, uncertain
retry, route/disposal, keyboard, focus ownership/background, refreshed worklist,
and Settings save -> same decision -> explicit recheck with no legacy POST.
Inspect both themes at three responsive widths, using production-aligned fixtures.
Run focused tests, independent source review, then the full repository/audit gates
on stable source. Record actual evidence and limits in a separate outcome.

Fresh PR applicability has separate design/outcome documents. Operate on main;
commit/push all completed changes without a new branch, merge, tag, release,
hosted workflow dispatch, or image publication.
