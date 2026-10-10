# Official practices by boundary

Consulted October 3, 2026. URLs were discovered through web search, official
navigation, and GitHub MCP and opened for review. Revalidate changing guidance
when applying this reference. Read only the rows relevant to the requested work.
This is an applicability map, not a compliance catalog.
Authorization, business-logic, PostgreSQL transaction and status-message guidance
was freshly discovered/opened October 8 for scoped recovery. Other rows retain
their earlier consultation date; consultation is not publication.

## Browser controls and feedback

| Source | Status | Decision it informs |
| --- | --- | --- |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and [WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/) | Normative W3C Recommendations | Consult the applicable criterion/role/state for precise requirements; busy state can defer updates and status implies polite/atomic semantics. These URLs were independently opened during the skill trial. |
| [WHATWG HTML form elements](https://html.spec.whatwg.org/multipage/form-elements.html) | Living specification | Specify button types: ordinary commands use `button`; intentional form confirmation can use `submit` with its owning submit handler. Avoid accidental submission or custom keyboard emulation. |
| [WHATWG dialog](https://html.spec.whatwg.org/multipage/interactive-elements.html#the-dialog-element) and [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | Normative living specification and informative APG; refreshed October 3 for Add to library | Native modal behavior makes outside content inert. Select where pending feedback remains exposed: inside an open modal or outside after closure. Deliberate initial/return focus and Tab/Escape behavior need browser evidence; timing is a product choice. |
| [W3C keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard) and [focus visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible) | Informative explanation of WCAG criteria | Test actual keyboard activation and the rendered focus indicator. |
| [W3C focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) | Informative explanation of WCAG 2.2 AA | Test controls/focus destinations in the actual scrolling shell, including sticky chrome and narrow layouts. |
| [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) and [ARIA22 technique](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22) | Informative explanation/optional sufficient technique; status explanation refreshed October 8 | Establish a status container before updates; explicit atomic semantics are useful. Require truthful current work evidence; pending matches alone do not establish queued/running work. A DOM role alone does not prove announcement. |
| [W3C button pattern, official mirror](https://w3c.github.io/wai-website/ARIA/apg/patterns/button/) | Informative APG | Enter/Space activation, accessible names/descriptions, and action-appropriate focus. The mirror was readable when the canonical host rate-limited. |
| [W3C target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) | Informative explanation of WCAG 2.2 AA | The criterion uses 24 CSS pixels with exceptions. Harmoniarr's 44-pixel mobile target is a stronger local convention, not the AA requirement. |
| [Vue accessibility](https://vuejs.org/guide/best-practices/accessibility) | Framework guidance | Use semantic structure and deliberate focus across rendered route/state changes. |
| [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing) | Testing guidance | Combine automation with manual/inclusive checks; do not infer full conformance from an automated pass. |

WCAG Understanding pages, techniques, and APG are guidance, not the normative
standard themselves. Follow their official links to the applicable normative
criterion/specification when a precise conformance interpretation is needed.
Do not require every documented technique or attach a full conformance claim to
a small feature's passing tests.

## HTTP, authority, and durable work

| Source | Status | Decision it informs |
| --- | --- | --- |
| [IETF RFC 9110 HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110.html) | Standards-track RFC | Separate reads from commands; do not assume a non-idempotent method can be retried safely. Application durable replay and response shapes are explicit project contracts. |
| [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) and [authorization patterns](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Patterns_Cheat_Sheet.html) | Security practice guidance; refreshed October 8 | Authorize the selected object/recipient using current server-side relationship authority; UI visibility or an old delayed intent is insufficient. |
| [OWASP business logic security](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html) | Security practice guidance; consulted October 8 | Keep workflow state server-owned and coordinate authoritative check/write decisions. A database transaction does not make provider work atomic; preserve uncertain dispatch and conditionally retire known-undispatched refused intent. |
| [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) | Security practice guidance | Preserve session-bound mutation protections; a new UI command does not justify bypassing CSRF. |
| [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html) and [application consistency](https://www.postgresql.org/docs/18/applevel-consistency.html) | Versioned database guidance; refreshed October 8 | Row/advisory locks, short transactions, fresh reads after locks and consistent acquisition order support transaction-owned concurrency. All relevant writers must participate; avoid provider/media IO while holding locks. |
| [PostgreSQL 18 SELECT](https://www.postgresql.org/docs/18/sql-select.html) | Versioned database guidance | Queue-oriented skipping has a different consistency purpose from an authoritative command read. |
| [Node 24 ESM](https://nodejs.org/download/release/latest-v24.x/docs/api/esm.html) | Versioned runtime guidance | Keep explicit imports/exports and module-compatible file specifiers; third-party examples may use a different module format. |

These sources do not require a new queue, database isolation migration, UI
framework, idempotency-header protocol, or security-scanner installation. Choose
the narrow existing boundary that satisfies the requested behavior. General
security review and dependency hygiene complement these practices but do not
constitute a security certification.

## Provider receipt contract maintenance, October 8 local / October 9 UTC

RFC 9110, OWASP business logic, PostgreSQL 18 locking/application consistency,
normative WCAG 2.2 and its informative status explanation were freshly
discovered/opened for attempt-owned confirmation. Provider-specific source is
separate from those standards: the checked-in slskd 0.25.1 legacy POST and
slskd 0.26.0 caller-ID batch API have different attribution contracts. Inspect
the exact supported release and per-file evidence rather than applying a blanket
claim that a provider has no caller-ID API. The repository's
`docs/SLSKD_TRANSFER_CONFIRMATION_RESEARCH_2026_10.md` records immutable source
URLs, admission/retention/restart limits and the batch alternative. Its saved
links are starting points for future fresh research.

## Batch and operator decision maintenance, October 9

Fresh MCP discovery/opening covered RFC 9110, OWASP business-logic and
[transaction authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html),
PostgreSQL 18 locking/application consistency, WCAG 2.2/status messages,
[H102 native dialog guidance](https://www.w3.org/WAI/WCAG22/Techniques/html/H102)
and WHATWG dialog for this follow-up. H102 is an informative technique, not
a separate normative requirement. Preserve whole reviewed transaction data,
reauthorize after awaited reads and keep provider I/O outside row locks.

The [Idempotency-Key document status](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/)
was also freshly opened: revision 07 is an expired/archived Internet-Draft,
not an RFC as consulted. Keep Harmoniarr's existing durable command contract
separate from a provider's supported key. The inspected slskd 0.26.0 provider
uses a request-body UUID; an invented header is no replay guarantee.

The repository's `docs/SLSKD_BATCH_HANDOFF_RESEARCH_2026_10.md` records fresh
immutable release, wire schema, enum and startup/shutdown evidence. A batch
record has no complete-admission marker; local queue persistence precedes
scheduled work. Restart may create new IDs without batch ownership. Apply
exact manifest/ID/peer/size/direction/BatchId and positive state checks, rather
than generalizing from record existence or timestamps. Explicit operator
adoption is a new consent decision with separate provenance; it must preserve
original dispatch uncertainty and refuse automatic recovery based on absence.

## Origin resolution maintenance, October 9

Fresh MCP discovery/opening for `docs/ORIGIN_RESOLUTION_RESEARCH_2026_10.md`
rechecked OWASP authorization/transaction/business logic, RFC 9110, PostgreSQL 18
locking/consistency, W3C publication history/status/H102 and WHATWG dialog. The
[frozen WCAG 2.2 Recommendation](https://www.w3.org/TR/2024/REC-WCAG22-20241212/)
was reached through W3C history. Earlier provider research is explicitly inherited,
not a new certification of changing provider versions.

An explicit ownership resolution is an application inference from these sources.
A row lock on existing work does not reserve an absent future allocation; its
creation/association must participate in the same parent fence. A cancelled run
may already have dispatched. Keep the exact locally proved unused job separate
from older positive provider evidence, preserve paired authority across all
writers/readers and recheck current significant data before commit. Verify native
sequential modal focus and expose pending results after closure; a DOM pass is
not evidence of assistive-technology speech.

## Explicit refusal maintenance, October 9

Fresh MCP research in `docs/PRE_PROVIDER_REFUSAL_RESEARCH_2026_10.md` rechecked
OWASP authority/transaction/business logic, RFC 9110, PostgreSQL 18 locking and
consistency, the frozen WCAG Recommendation/status/H102 and WHATWG dialog.
Provider contracts remain explicitly inherited from prior immutable release
ledgers; this is no new upgrade/capability certification.

The application inference is an explicit future-only local preparation protocol.
Refusal proof must come from its exact conditional pre-dispatch state; provider
absence, an old version-read failure or a missing historical checkpoint cannot
substitute. After the irreversible crossing, even commit-ack loss or zero-POST
local failure remains unknown. Keep complete state comparisons, required audits,
current lease and bounded public feedback at their actual owners, and validate
real transaction races rather than source wording.

## Abandoned preparation maintenance, October 9

The root's fresh primary-source ledger in
`docs/ABANDONED_PREPARATION_RESEARCH_2026_10.md` records PostgreSQL 18
locking/consistency and time functions, OWASP authority/workflow, RFC 9110 and
W3C/WHATWG feedback guidance. Documentation version and consultation are
separate from the running database/provider version; earlier provider ledgers
remain inherited. This maintenance does not independently re-verify those URLs.

The application inference is a distinct system closure owner for an exact idle
future preparing epoch, followed separately by any authorized restoration.
Cancellation requests and cancelled status do not certify non-dispatch or cancel
a remote transfer. Recheck current state and fresh authoritative time after lock
waits; transaction-start NOW is not a final expiry clock. Preserve the original
captured lease and require reciprocal parent/epoch closure plus permanent writer
fences. Closure-first must stop the old final native callback; crossing-first
retains uncertainty. Required audit failure rolls back closure. A public closed
flag can inhibit retry without exposing the private proof or granting permission
to restore. These are bounded project decisions, not a standardized lease
algorithm, new operator screen or whole-platform conformance claim.

## Lease acquisition maintenance, October 9

The root's fresh ledger in `docs/LEASE_ACQUISITION_RESEARCH_2026_10.md` records
official locking, conditional-update, UUID/time/migration and workflow guidance.
The exact captured-token contract is an application inference. Preserve the
stable diagnostic row ID while minting a private UUID for each successful
acquisition; same-owner live reacquisition and timestamp-only comparison are
insufficient. A stale callback must use its original captured identity, never
the newest token read from storage. Compare current ownership and fresh time
under the owning locks; treat a missing renewal or false lifecycle write as
ownership loss rather than successful work.

Rollout requires all producers, bridges, heartbeats, finalizers and cleanup SQL
to participate. Historical captured frames remain evidence and receive no
retroactive authority from migration backfill. Additive default/backfill work
still takes a migration lock; stop old key-only worker processes before rollout.
Keep tokens out of public diagnostics and nested records. Existing final
side-effect guards remain necessary: a local token cannot atomically cancel
provider or filesystem work already in progress. This reference maintenance
does not independently re-open the ledger's URLs or certify distributed
exactly-once behavior.

## Organize mutation maintenance, October 9

The root's fresh ledger in `docs/ORGANIZE_MUTATION_RESEARCH_2026_10.md` records
official PostgreSQL locking, clock and conditional-update guidance, the exact
local Node 24.18.1 tagged filesystem documentation, and workflow/status sources.
The callback placement and captured-token contract are application inferences;
this reference maintenance does not independently re-open the ledger's URLs.

An earlier ownership check cannot authorize a mutation after awaited path or
destination inspection. Recheck the immutable prepared file and original
acquisition immediately before each new mkdir, destination copy/link and source
removal, with fresh authoritative time after lock waits. Preserve the guard
through transport fallback and propagate pause/cancellation to their worker
owners. Exclusive copy and verified source removal do not make filesystem and
catalogue state atomic: a separate current-owned old-path/root CAS must affect a
row before counting success or notifying. Keep locks out of long filesystem I/O,
retain partial bytes on later refusal, and preserve unrelated transport defaults.
Compare lock acquisition against existing writers, including ordinary catalogue
upserts: explicitly lock the root before its files. A joined row-lock query can
create reciprocal waits despite short transactions; prove coexistence with real
blocked writers rather than assuming row-mark order.
Injected callback tests establish order and refusal; actual PostgreSQL and
test-owned files establish the claimed race and transport evidence. No new UI,
in-flight cancellation, symlink-race immunity or content-hash proof is implied.

## Scan catalogue maintenance, October 9

The separate `docs/SCAN_CATALOGUE_RESEARCH_2026_10.md` ledger owns current
primary-source discovery. Applying database transaction, lock-order and fresh
clock guidance to the observed scan writer is a project inference; this
maintenance does not independently re-open those sources or add a UI standard.

A completed filesystem walk is an observation, not current write authority or
a filesystem snapshot. Capture the original acquisition and immutable scalar
observations, keeping the requested root distinct from its resolved root. Use
one current-owned catalogue transaction and the same client for maintenance,
parent/lease checks, root, batches and tombstones. Await each write guard and
recheck fresh time after waits and at the final boundary; a late refusal rolls
back provisional catalogue changes. A legitimate empty successful observation
can tombstone old files, whereas stale work must not. Preserve standalone writer
transactions and batching. Focused callback tests establish orchestration;
actual PostgreSQL owns locking, rollback and one-connection evidence. A guarded
catalogue commit does not fence later tag, artwork or reconciliation work, make
the filesystem walk atomic, or guarantee ownership through commit acknowledgement.
Validate actual parent path components using the selected platform's separator,
preserving legitimate contained double-dot names and literal POSIX backslashes.
Include positive filename cases beside traversal refusals; a broad prefix or
cross-platform separator rewrite can incorrectly reject a successful walk.

## Tag snapshot maintenance, October 9 local / October 10 UTC

The separate `docs/TAG_SNAPSHOT_RESEARCH_2026_10.md` ledger owns current
primary-source discovery. Applying transaction, conditional-write and current
workflow guidance to tag persistence is a project inference; this maintenance
does not independently re-open those sources or add a browser requirement.

An accepted size/mtime stamp is evidence about parser input, not current write
authority. Capture immutable source and acquisition before parsing, then persist
history and the current file together under maintenance, run/lease/root/file
ownership with the same transaction client. Compare path, root, size, nullable
mtime and observed/nondeleted state at the guarded source CAS. Check exact
returned identities and refresh time after waits and at the final boundary;
zero-row writes and later refusal roll back both changes. Distinguish genuine
parser failure from ownership/source/database failure instead of converting all
errors into a second failed snapshot. Artwork follows successful persistence as
a separate owner. Preserve actual platform filename semantics and source stamps
on current parser failure. Focused doubles establish orchestration; actual SQL
and native parser fixtures establish database/media evidence. Same-size/same-mtime
physical changes, later artwork and commit acknowledgement remain bounded limits.

## File match maintenance, October 9 local / October 10 UTC

The separate `docs/FILE_MATCH_RESEARCH_2026_10.md` ledger owns current primary
source consultation. Applying current-state transactions and structured-value
comparison to file matching is a project inference; this maintenance does not
independently re-open those sources or require a new UI audit.

Capture source, tags and decision-relevant scope before awaited metadata lookup.
Preserve SQL NULL versus an empty JSON object; ignore object key order while
retaining array order and scalar distinctions. Current tag stamps cannot replace
comparison of the actual tag payload. Derive relevant scope from the saved run
hint without treating unrelated summary edits as a different match intent. Use
one client and compatible locks for an atomic match batch, then recheck source,
authority and fresh time before SQL and before commit. Returned identities and
source/tag predicates must cover both inserts and conflict updates; one stale
sibling or missing row refuses the batch. Preserve matching strategies rather
than converting a refusal into unmatched success. Database ownership does not
freeze physical bytes or metadata candidates, undo earlier tag/artwork work, or
grant later reconciliation authority. Focused doubles and actual PostgreSQL
evidence remain separate from structural skill validation and UI conformance.

## Release reconciliation maintenance, October 10, America/New_York

The saved `docs/RELEASE_RECONCILIATION_RESEARCH_2026_10.md` ledger owns fresh
primary-source discovery. Choosing serialized projection replacement with
repeated READ COMMITTED aggregate comparison is a bounded project decision;
this maintenance does not independently re-open the ledger's sources.

Capture original scan authority before awaiting admission, then compute global
coverage inside the owning transaction after waits. Set snapshot semantics
explicitly: a lock acquired after an older snapshot does not refresh that
snapshot. Recheck the full mapped aggregate, authority and fresh time before
DELETE, bulk upsert and the final boundary; source drift or incomplete returned
identities rolls back all projection writes. Keep valid empty cleanup and existing
coverage/status calculations. Use the same advisory admission key in standalone
and owning replacers, with one transaction client and no cached aggregate replay.

The key serializes participating projection writers, not metadata/file/match
producers. Other-root inserts and new metadata rows belong in freshness proof,
but changes after the final query can await another pass. Do not claim strict
commit-fresh state, phantom prevention, or universal deadlock freedom. A broader
stable-input barrier needs a coordinated producer/snapshot/lock-order design and
actual interleaving evidence. Focused doubles establish orchestration; PostgreSQL
owns waits, rollback and query-snapshot claims. No UI change, media-byte or
external atomicity guarantee follows from this derived read-model boundary.
