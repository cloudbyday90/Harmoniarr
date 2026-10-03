# Missing Music quality fallback design

Status: Accepted for implementation
Research date: October 3, 2026

## Problem and scope

The canonical inspector does not expose quality evidence or the existing
fallback action. Source tracing also found disconnected consumption paths:
workers persist quality under `lastSearchResult.autoSelection.quality`, reads
look elsewhere, and wanted-link overrides are neither read by the detail nor
fully honored by shared search preferences. The retained fallback write can
update shared discovery without proving the selected target link exists.

Complete one journey: an eligible person permits the existing bounded fallback
for a selected wanted release, the choice remains target-owned, and later
shared discovery honors the applicable recipients' saved requirements. Keep
the existing base quality profile, inspection, spectral proof, and safe-add
pipeline. Do not add profile editing, arbitrary thresholds, automatic upgrade
work, a new queue, or a verification bypass.

## Official research and recommendation

Sources below were discovered through web search and opened through the web
tool. GitHub MCP discovers repository/PR metadata and immutable changed files.
The date records consultation, not the publication date of each document.

| Official source | Application |
| --- | --- |
| [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Recheck the authenticated actor, selected object, and recipient relationship for every command. |
| [OWASP authorization patterns](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Patterns_Cheat_Sheet.html) | Keep enforcement close to the resource with authoritative current attributes; a UI decision is not write authorization. |
| [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) | Retain session-bound CSRF checks for cookie-authenticated mutations. |
| [PostgreSQL 18 SELECT](https://www.postgresql.org/docs/18/sql-select.html) | Reuse transactions and row locks for current-state decisions; queue-style skipping is distinct from command authorization. |
| [Vue accessibility](https://vuejs.org/guide/best-practices/accessibility) | Use semantic quality facts and labeled controls with deliberate focus handling. |
| [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | Preserve the existing download dialog's keyboard/focus lifecycle while adding a competing command. |
| [Playwright best practices](https://playwright.dev/docs/best-practices) | Verify visible outcomes with isolated fixtures, role locators, and retrying assertions. |
| [Node 24 ESM](https://nodejs.org/download/release/latest-v24.x/docs/api/esm.html) | Use explicit imports/exports and small service/policy/store modules. |

These sources support the control principles. The shared-consent policy below
is a project-specific design derived from Harmoniarr's shared release model.

## Alternatives and tradeoffs

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Expose the legacy endpoint directly | Small UI change | Wrong recipient scope and unguarded shared writes; unread saved choices | Reject |
| Save a global release fallback | Simple worker behavior | One person could lower another recipient's quality requirement | Reject |
| Create independent download pipelines for each recipient | Fully independent policies | Duplicates operation/file ownership and conflicts with the current physical library model | Defer |
| Save target-owned consent and derive conservative shared requirements | Reuses current infrastructure and respects stricter recipients | A recipient's choice may wait for other recipients; needs read/worker/state-race tests | Adopt |
| Change the base profile to High quality | Broadens the query | Also weakens verification for advertised lossless files | Reject |
| Broaden search format preferences separately from base inspection policy | Enables permitted fallback searches while retaining strict lossless checks | Requires an explicit shared quality-context module | Adopt |

## Command and persistence contract

`POST /api/v1/missing-music/decisions/:decisionId/allow-fallback-quality`
accepts `{}`. Resolve the target on the server, retain fresh-session/CSRF
checks, permit requester/operator own scope and administrator household scope,
and deny disabled target mutations. Use durable idempotency scope
`missing-music.decisions.allow-fallback-quality` with a decision-ID fingerprint.

Return a bounded `action`: `code: allow_fallback_quality`, `decisionId`,
`targetUserId`, `fallbackAllowed`, `searchPreparationStarted`,
`overrideAlreadyAllowed`, `restartAlreadyQueued`, `dispatchAlreadyActive`,
and `discoveryRunId`. Saved work is not a completed download or library add.

Eligibility requires a current below-minimum quality choice and a profile for
which the fallback widens the allowed policy. Do not offer an ineffective
override for a profile already allowing that fallback, nor an override for
`needs_verification`. The existing fallback admits MP3/AAC/Opus/Ogg at
256 kbps or higher, while preserving accepted lossless formats. Permitting
fallback does not approve an existing 128 kbps match.

Delegate both canonical and retained legacy fallback commands to one guarded
library write. Reuse maintenance -> target eligibility -> owned wanted ->
discovery/link locking, reread current projection, reject active candidate or
transfer handoffs, and commit the target override, retry intent, and required
audit together. Missing links refuse all writes. Different-key repeated consent
is a no-op without duplicate audit or shared request reset. Post-commit dispatch
failure leaves truthful durable queued work for the existing heartbeat.

## Read and worker contract

Read the selected wanted-link override separately from shared discovery
evidence. Resolve the selected owner's saved preferences and explicit scoped
profile independently of the strictest shared profile. A shared profile describes
the worker's policy and must not become a different owner's preference authority.
Reconstruct current quality facts from actual worker evidence rather
than requiring fields the worker never writes. Do not treat provider-advertised
lossless formats as completed media verification. Once a new retry is queued,
stale prior quality evidence must not mask current progress or permit another
mutation of active work.

Extract a narrow shared quality-context service/policy from the large dispatch
file. Resolve each existing participant's base requirement and valid scoped
consent. Retain the claimed participant set, including disabled-account links;
do not silently drop owners to gain consent. Disabled participants and
missing/unknown preferences conservatively block shared broadening. Disabled
accounts cannot grant new consent. Broaden shared lossy search only when every recipient whose
requirement forbids it has consented. Never copy one user's override into a
sibling's wanted link.

Preserve actual saved minimums, not just profile names. The account's High
minimum promises 320 kbps; a consenting lossless recipient's 256 kbps fallback
cannot lower that other recipient's floor. Derive the maximum effective lossy
bitrate floor across participants and enforce it in candidate quality selection
and downstream context as well as search/format ranking. Public selected-owner
facts must report their effective minimum. These are project preference semantics,
separate from the generic High quality profile's 256 kbps baseline.

Preserve the existing account defaults: a stored preferences object with absent
quality keys (including the migration's default `{}`) means Any/Any, as shown by
the account preferences service. A partially saved object defaults only its
missing key. Do not mistake a legitimate untouched account for unknown policy
and silently impose Lossless. Explicit invalid values, absent/non-object policy,
and failed owner lookup remain conservative.

After the first recipient queues a retry, another unconsented recipient must wait
for fresh stopped quality evidence before granting consent. This conservative
state rule prevents a second command from mutating active work. Already-saved
consent remains a no-op under a different key; consent may accumulate across
stopped cycles without resetting another recipient's in-flight search.

Keep the base quality profile and applicable override in candidate context.
Broaden only effective search format preferences. Lossless candidates retain
inspection/spectral safeguards; lossy candidates still pass media and
filesystem/safe-add gates. Shared searches may remain strict after one
recipient permits fallback, and the UI must describe that limit honestly.

Recovery must retain a compatible candidate's own policy and guard its exact
stored context at promotion; skip weaker or mismatched historical contexts
instead of transplanting consent. Guard strict/default-strict contexts and every
positive effective floor, including the generic High baseline of 256 kbps.
Measured media enforces that baseline and any higher saved floor independently
of spectral proof. Use measured codec/container evidence for lossless exemptions,
including supported PCM WAV and Vorbis/Ogg mappings; a filename alone is not
proof of a lossless codec. Keep strict-profile proof gates unchanged.

## Public detail and UI contract

Detail adds `qualityEvidence` containing only known decision/profile codes,
allowlisted formats, bounded numeric bitrate/minimum bitrate, preferred/minimum
formats, and boolean verification/fallback facts. Flat fields are `code`,
`profileCode`, `formats`, `bitrateKbps`, `preferredFormats`, `minimumFormats`,
`minimumBitrateKbps`, `requiresVerification`, `verifiedLossless`,
`fallbackAllowed`, and `fallbackOverrideActive`. Omit actor IDs, override
timestamps, raw explanations, provider paths/bodies, and spectral internals.

Expose server-derived `permissions.canAllowFallbackQuality`. Use a small pure
quality presenter and an action wrapper through the existing shared mutation
gate/retry-intent lifecycle. Present known tiers as Lossless archive, High
quality, and Any available; unknown facts read Not reported. Render compact
quality facts and Allow fallback quality when permitted, with Search again as
the unchanged-preference alternative. Saved consent applies to the selected
recipient and does not promise an automatic quality upgrade. Existing refresh,
safe feedback, route/disposal, keyboard focus, and dialog pause behavior remain
part of the completed action.

## Validation and adjacent work

Prove actual worker quality projection, target-owned override reads,
own/household authorization, disabled/maintenance/current-state refusals,
same-key replay, different-key no-op, audit rollback, post-commit dispatch
failure, mixed/unanimous shared consent, 128 kbps refusal, and unchanged
lossless checks. Include mixed 256 kbps consent and an unconsented 320 kbps
minimum, checking the actual candidate consumer rather than a ranking score alone.
Use focused tests, real PostgreSQL sessions/transactions,
browser interaction, full repository validation, and dependency-security checks.

Design a separate narrow scoped-policy-overrides skill for the ownership,
effective-consumer, and verification invariants; keep its design/outcome apart
from this action's evidence. Random PR #40 and any compatible runtime security
successor have their own design and outcome records. All work stays on main;
no release, tag, hosted workflow dispatch, or PR merge is authorized by this slice.
