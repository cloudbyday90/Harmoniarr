# Missing Music Add to library design

Status: Accepted for implementation
Research date: October 3, 2026
Baseline: `fddad7becf6e4fed3422752b7b512451905e1ea4`, main

## Problem and bounded journey

The canonical worklist can label a prepared download **Add to library**, but
the decision inspector has no matching command or permission. Its broad
`ready_to_add` state is also excluded from the default action worklist. An
unused legacy client workflow is not evidence of a completed canonical journey.

The existing release manual-safe-add service actually queues `safe_auto`; it
does not authorize a quality bypass. It verifies a prepared candidate, file plan,
and measured audio before calling the generic apply starter. It lacks the newer
current recipient/policy snapshot and guarded worker checks between preflight,
queue acceptance, and filesystem mutation.

Complete one journey: find an eligible prepared download, review release and
recipient context, explicitly confirm **Add to library**, accept a guarded
durable command, and refresh truthful queued/current state. Preserve physical
shared-library effects. Collision decisions, unsafe plans, quality exceptions,
failed prerequisite recovery, and protected bulk/manual import remain separate.

## Official research and applicability

Primary URLs below were discovered through MCP/web search and official
navigation and opened on October 3. Consultation date is not publication date;
guidance does not establish project behavior without executed evidence.

| Source | Authority and selected practice |
| --- | --- |
| [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | Informative APG: deliberate initial focus, modal Tab containment, Escape/Cancel and meaningful focus return. Reuse native dialog behavior and existing focus helpers. |
| [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) and [focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) | Informative WCAG explanations: persistent progress feedback and visible interaction-owned focus in the actual application shell. Modal inertness matters to where pending feedback is exposed. |
| [WHATWG form elements, developer edition](https://html.spec.whatwg.org/dev/form-elements.html) | Official developer edition of the living HTML standard: native explicitly typed command buttons avoid accidental form submission. |
| [WHATWG dialog](https://html.spec.whatwg.org/multipage/interactive-elements.html#the-dialog-element) | Normative living specification, resolved again through its official form-elements navigation: native modal/inert/focus behavior. Closing on confirmed command start is the chosen product timing, not a specification requirement. |
| [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) and [CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) | Security practice guidance: current server object authority and session-bound mutation protections; confirmation and browser visibility are not authorization. |
| [IETF RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) | Standards-track HTTP semantics: explicit POST; uncertain retries require the existing application durable intent contract because POST is not intrinsically idempotent. |
| [PostgreSQL 18 locking](https://www.postgresql.org/docs/18/explicit-locking.html) and [application consistency](https://www.postgresql.org/docs/18/applevel-consistency.html) | Versioned database guidance: short owning transactions, current reads after consistent locks, and coordinated absent-row apply creation. All relevant producers must participate. |
| [Node 24 ESM](https://nodejs.org/download/release/latest-v24.x/docs/api/esm.html) | Versioned runtime guidance: explicit ESM imports/exports and narrow factories. The consulted documentation reports 24.21.0; actual local validation runs on 24.18.1 with npm 12.0.2. |

APG and WCAG Understanding are informative guidance, not independent conformance
certification. Keep the existing stronger 44-pixel mobile targets. Existing
exclusive file operations do not establish measured identity of alternate bytes;
retain the previous slice's safe-auto staging/reuse refusal.

## Alternatives and recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Render a button calling the legacy client endpoint | Small UI addition | Missing canonical recipient/replay contract and current worker policy | Reject |
| Treat confirmation as permission for permissive manual apply | Broad recovery reach | Conflates review with quality/collision bypass and shared consent | Reject |
| Add a second queue or worker | Separate lifecycle | Duplicates leases, file authority, activity, retry and cancellation | Reject |
| Canonical command using shared guarded safe-add owners | Complete scoped journey; current policy, atomic audit/queue, existing measured/file gate | Requires snapshot coordination and real database/file/browser evidence | Adopt |
| Hide ready adds only behind the Ready to add filter | Preserves broad historical grouping | Eligible commands remain absent from the default decision worklist | Reject for eligible prepared adds |

Retain Vue, Express, Node 24 ESM, PostgreSQL, and the existing durable workers.
Add a narrow prepared-add policy and current-candidate facts store, a canonical
command adapter, presentation/composable, and extracted confirmation panel.
Generalize the existing recheck preparation/transaction/worker policy owners only
where both commands share the same invariant. Avoid copying another recovery
or queue implementation into a large singleton.

## Eligibility and bounded command

Add `POST /api/v1/missing-music/decisions/:decisionId/add-to-library`, body `{}`,
fresh session, CSRF, existing mutation limiter, and durable scope
`missing-music.decisions.add-to-library`. Fingerprint decision identity only.
Resolve target through the canonical server resolver: requester/operator own
scope and administrator household scope; disabled history is read-only.
Do not accept candidate IDs, recipient IDs, paths, safety modes or quality fields.

A pure policy drives direct detail permission, projected action state, and
owning write. Require active, nonignored missing/partial wanted state with
positive missing count and a current discovery link. Require exactly one
current-search Music Queue-owned `import_pending` candidate with positive
persisted files, no other active candidate for the same search or metadata, and
exact acquired/current eligible participant membership. A completed provider
transfer or old stop event alone is insufficient. Prepared adds need no stop
history; failed prerequisite repair remains the recheck command.

Expose only `permissions.canAddToLibrary` and the existing bounded decision
status/action. Eligible prepared adds become canonical `action` state with
`add_to_library`; suppress an unavailable broad legacy add action. Existing
bounded keyset identity scanning then filters the same projection, so action
discovery must work beyond initial pages without a separate SQL state policy.
Raw candidate paths, provider data, participants' preferences and diagnostics
remain private.

Action shape is exactly `{ code: 'add_to_library', decisionId, targetUserId,
outcome, runId }`. Outcomes: `queued`, `already_queued`, `still_needs_review`,
`not_available`, and `deferred`. Run identity is nullable and populated only for
queued/exact existing guarded work. Queued means accepted work, not completed
library addition. Same-key replay retains its original response; new keys for
the same current work coalesce.

## Preparation, acceptance and worker authority

Prepare outside write locks: current candidate/files/decisions and participant
policies, a positive nonempty all-ready file plan, and measured quality. Retain
the downloaded requirement plus stricter current participant floors and valid
target-scoped consent. Preserve Any semantics without accepting an empty plan.
Keep original physical request ownership and the valid primary wanted identity.

Use the existing maintenance -> sorted participant/target accounts -> wanted
releases/discovery/links -> global apply advisory -> candidate/files/decisions
lock order. Re-read exact current candidate/provenance, membership, policy and
decisions before saving fresh context and queuing. Prepared add does not reopen
status or emit a prerequisite recovery audit. Save context, one scoped
`safe_auto` move operation and required operation-start audit in one transaction;
audit or queue failure rolls all writes back.

`already_queued` requires exact current guarded manual-add/recheck membership,
valid owning target marker, pending/running run and safe-auto mode. Unguarded
automatic, generic, manual-mode or unrelated active work returns `deferred`;
do not adopt it or promise this command's current-policy guarantees. Preserve
the existing generic apply conflict contract.

The legacy one-release manual-safe-add service delegates the same guarded owner.
Its supplied candidate identity is only an expected value compared with the
server-selected current scope, not an alternate authorization path.

For guarded manual-add and recheck jobs, refresh participant eligibility/consent
and current quality and capture provenance before awaited preview preparation,
then compare its snapshot again
after checkpoint persistence immediately before each filesystem mutation.
Reuse existing exclusive destination checks and refuse unverified older staging,
checkpoint recovery and alternate reusable inputs in safe-auto mode. No database
locks span media probes, user confirmation or filesystem IO. These checks do not
make later policy changes atomic with a started file operation or prevent
arbitrary external replacement of original/fresh staging bytes.

New guarded manual-add jobs persist `libraryAddRequestedForWantedReleaseId`;
rechecks retain `recheckRequestedForWantedReleaseId`. Older unmarked manual-add
jobs are refused before file work rather than granted inferred current consent.
No marker backfill or data migration is introduced.

## Confirmation, feedback and refresh

Render a native typed **Add to library** button only with strict server permission.
Extract its panel/dialog rather than growing the inspector's download modal.
Confirmation names release, artist and recipient and explains that the worker
checks audio/file plans before moving prepared files. It grants no policy bypass.
Use initial Cancel focus, native modal behavior, existing Tab helper and Escape.
Cancel/close makes no POST; restore the invoker while connected and appropriate.

Explicit confirmation starts the seventh shared per-decision mutation command
and closes the dialog immediately. Establish one persistent status region in
the inspector, outside inert/busy content, so pending feedback is exposed after
closure. Track command focus before closing; failed/uncertain results and
successful refreshed status respect interaction ownership. Background refresh
and user-moved focus/scroll stay unchanged. Pause reads while confirmation is
open, clear route/disposal state, retain intent keys after uncertain acceptance,
and refresh both displayed detail and worklist after bounded results.

## Evidence and completion

Prove shared policy/read/write agreement, no-stop-history prepared candidates,
default action paging, own/household/disabled scope, session/CSRF/body guards,
durable replay, exact coalescing and unguarded-work deferral. Use real PostgreSQL
for queue/audit rollback and candidate/decision/policy/link/maintenance races.
Run actual test-owned media through canonical queue/worker addition, tightened
quality or revoked consent refusal, and collision/staging/reuse adverse cases.
Distinguish physical file execution from simulated timing or controlled probes.

Browser proof covers explicit confirmation, Cancel/Escape without mutation,
keyboard/Tab/focus, exposed pending status after closure, all five outcomes,
seven-command exclusion, uncertain same-key retry, permissions, route/disposal,
detail/worklist refresh, and preserved user/background focus and scroll.
Inspect both themes at three widths. Follow focused validation with independent
bounded review and full repository/security gates on stable source. Record
executed results and limits in a separate outcome document.

Fresh open-PR applicability has its own design/outcome. Operate on main and
commit/push completed changes. No branch, PR merge, release, tag, hosted workflow
dispatch or image publication is part of this slice.
