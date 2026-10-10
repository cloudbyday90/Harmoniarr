# Practical web standards skill design

Status: Accepted for implementation
Research date: October 3, 2026

## Purpose

Create `harmoniarr-web-standards` to turn relevant standards and official practice
guidance into concrete implementation decisions and evidence for Harmoniarr web
commands and forms. The user requested W3C and similar practices as a practical,
structural, methodical AI skill. The current Find matches journey provides a real
application across browser semantics, HTTP, authorization, and queue races.

## Practice families

| Family | Purpose | Source status |
| --- | --- | --- |
| W3C WCAG/WAI-ARIA | Keyboard, focus, status, labels, and operable targets | Distinguish normative criteria from informative Understanding/APG/techniques. |
| WHATWG HTML | Native browser controls and form behavior | Living specification; inspect the relevant element rather than adding custom ARIA reflexively. |
| OWASP | Object authorization, CSRF, and bounded public errors | Security practice guidance, not automatic certification. |
| IETF HTTP | Read/mutation semantics and safe uncertain retries | RFC 9110 semantics; project replay/response conventions are explicit local decisions. |
| PostgreSQL | Transaction state, locking, coalescing, and rollback | Versioned product guidance, not a standards-body requirement. |
| Vue/Playwright | Framework integration and observable browser evidence | Official implementation/testing guidance; automation covers only part of accessibility. |

The discovered and opened official source URLs are recorded in the skill's
practice reference and the [Find matches design](MISSING_MUSIC_FIND_MATCHES_DESIGN.md).
Consultation date does not imply a source was published then. Revalidate changing
documentation when applying the skill later.

## Structure and tradeoffs

| Option | Benefit | Cost | Decision |
| --- | --- | --- | --- |
| A broad standards encyclopedia | Many topics in one place | Expensive context, stale facts, and irrelevant mandatory checks | Reject |
| A W3C-only checklist | Clear accessibility focus | Misses authority, HTTP retry, and persistence boundaries | Reject |
| Put every standard into canonical-actions | One entry point | Loads standards detail for unrelated product actions | Reject |
| Narrow entry point with conditional practice/evidence references | Cheap discovery and standards-to-consumer traceability | References need maintenance and the agent must choose applicable rows | Adopt |

Maintain `SKILL.md`, quoted Codex UI metadata, a short dated official-practice
reference, and a project evidence map under `.agents/skills/harmoniarr-web-standards`.
Install the identical files in the user's local Codex skills directory, matching
the existing project skill arrangement. No executable helper or new testing
dependency is needed solely to create the skill.

## Method and limits

Trace one requested journey and select the few relevant practice families.
Discover/open official URLs, record authority/version/date, and connect each
chosen rule to its actual consumer, failure case, and verification. Reuse current
project command, UI, and testing boundaries. Keep project conventions separate
from standard requirements, particularly WCAG AA's 24-pixel target criterion and
the project's stronger 44-pixel mobile convention.

Collect real evidence for meaningful boundaries: keyboard/focus/status behavior,
authoritative object checks, uncertain mutation retries, SQL concurrency/rollback,
and safe refreshed output. Avoid source-wording tests, invented certification,
unsolicited repository-wide audits, and unrelated framework/security migrations.
Preserve the user's main/no-release/no-merge instructions.

Validate skill structure, installed/source identity, and reference links. An
independent bounded scenario should receive only the skill, a realistic request,
and minimal raw artifacts without expected findings. Record actual decisions,
evidence limits, and any justified instruction correction in a separate outcome.

## Attempt-owned confirmation maintenance, October 8 local

Extend the existing evidence map with the observed provider receipt boundary.
The [confirmation design](DOWNLOAD_HANDOFF_CONFIRMATION_DESIGN.md) requires
supported-version research before selecting a replay contract, exact durable
receipt ownership and truthful partial/current transfer evidence. Similar
history, a new baseline-relative ID and a batch record are each insufficient
causal or whole-manifest proof on their own. Maintain this as conditional project
guidance, with no new broad audit, invocation policy or duplicate skill.

## Batch and operator adoption maintenance, October 9

Extend the two references with the observed batch/receipt and operator decision
boundaries from the [batch design](BATCH_DOWNLOAD_HANDOFF_DESIGN.md). Locate
the pinned protocol owner, exact receipt reads and existing atomic adoption
transaction. Map incomplete admission, startup replacement IDs, stale authority,
foreign links, uncertain replay and native dialog feedback to meaningful adverse
evidence. Preserve a separately attributed operator choice and original unknown
dispatch; no filename inference or uncertainty-clearing shortcut is justified.
Document the freshly checked Idempotency-Key draft status separately from local
and provider contracts. Keep the entry point and invocation policy unchanged.

## Origin resolution maintenance, October 9

Extend the existing references with the observed boundary from the
[resolution design](DOWNLOAD_ORIGIN_RESOLUTION_DESIGN.md): a cancelled/newer
job cannot be ignored without local non-dispatch proof, and an existing row lock
alone does not fence a future allocation. Map reciprocal ownership, current
authority, late source and newer snapshots, actual module exports, retention and
private polling to meaningful adverse tests. Keep the entry point and invocation
policy unchanged; no duplicate skill or new blanket compliance workflow is needed.

## Explicit refusal maintenance, October 9

Map the observed future-only preparation protocol from the
[refusal design](PRE_PROVIDER_REFUSAL_DESIGN.md) to the final native send,
irreversible crossing, complete epoch comparisons, retry leases, audit and
retention. Distinguish a local negative certificate from historical absence or
provider admission. Include raw snapshot aliases in privacy evidence instead of
assuming canonical-field sanitization is sufficient. Preserve entry point and
invocation policy; the maintenance teaches actual ownership and evidence choices.

## Abandoned preparation closure maintenance, October 9

Maintain the two references around the distinct system owner in
[the closure design](ABANDONED_PREPARATION_DESIGN.md). Cancellation and expiry
permit inspection, not certification. Map exact future preparing state, a fresh
closure lease, time after lock waits, reciprocal parent/epoch records, immutable
captured identity and permanent reactivation fences to their actual owners and
adverse evidence. Keep administrator restoration and its authorization separate.
The public closed flag only inhibits retry; private proof and snapshot aliases
remain hidden. Preserve entry point, UI metadata and invocation policy. Validate
structure and synchronize the existing four installed files; do not describe
reference maintenance as a new behavioral skill trial.

## Lease acquisition maintenance, October 9

Extend the two references around the [lease design](LEASE_ACQUISITION_DESIGN.md).
Map stable diagnostic identity versus private acquisition authority, captured
callback inputs, complete worker/bridge/heartbeat/cleanup participation, false
lifecycle outcomes, authoritative time and historical evidence compatibility to
their actual owners. Include migrated/fresh snapshot and anchor checks, private
DTO allowlists, mixed-binary rollout limits and external-effect boundaries.
Keep the entry point, metadata and invocation policy unchanged. Validate and
sync the existing four installed files; structural checks and focused application
tests do not constitute a new blind behavioral skill trial or conformance claim.

## Organize mutation maintenance, October 9

Extend the two references around the [organize design](ORGANIZE_MUTATION_DESIGN.md).
Map original acquisition and immutable file/root/plan capture, awaited native
preflight and verification, guarded fallback, interruption propagation and the
short catalogue CAS to their actual owners. Separate zero-effect refusal from
post-copy partial effects and current-owned success notification. Preserve
generic transport defaults and the existing operator confirmation; no new UI or
filesystem/database atomicity claim is needed. Keep entry point, metadata and
invocation policy unchanged. Validate structure and synchronize the four existing
installed files; this maintenance is not a new blind behavioral skill trial.

## Scan catalogue maintenance, October 9

Extend the two references around the [scan design](SCAN_CATALOGUE_DESIGN.md).
Map immutable observation/token capture, requested versus resolved root identity,
same-client maintenance and ownership, compatible root/file locking, awaited
batch/tombstone guards and final rollback to their actual owners. Preserve current
empty-scan success and distinguish it from stale empty observations. Keep later
tag, artwork and reconciliation ownership outside this bounded guarantee. Entry
point, metadata and invocation policy remain unchanged; validate and synchronize
the existing four installed files without claiming a new behavioral skill trial.

## Tag snapshot maintenance, October 9 local / October 10 UTC

Extend the two references around the [tag design](TAG_SNAPSHOT_DESIGN.md).
Map immutable source/acquisition capture before parsing, payload copy, same-client
ownership and source CAS, atomic history/current-file writes, final rollback and
parser-error separation to their actual owners. Keep source stamps distinct from
authorization predicates and preserve nullable mtime and platform filename
identity. Artwork starts after accepted persistence and remains a separate owner.
Entry point, metadata and invocation policy stay unchanged; validate and sync the
four installed files without claiming a new behavioral trial or media-byte proof.

## File match evolution, October 9 local / October 10 UTC

Extend the existing practical skill around the [match design](FILE_MATCH_DESIGN.md).
Add one reusable entry-point rule for capturing source before an awaited lookup
and preserving nullable structured values and scope; keep detailed owners and
counterexamples in the two references. Map semantic tag equality, relevant saved
hints, one-client atomic batch/source CAS, exact returned identities and final
rollback without changing matching strategies or implying a metadata snapshot.
Metadata, invocation policy and scope boundaries remain unchanged. Validate and
sync the four installed files; report structural checks separately from actual
application evidence, without a new blind behavioral trial or conformance claim.
Include ordinary catalogue writers in the lock-order trace. A joined row-lock
query must not be treated as proof of compatible acquisition order; test actual
root/file waits with blocking process IDs and retain any reproduced deadlock.

## Release reconciliation maintenance, October 10, America/New_York

Extend the two references around the
[release design](RELEASE_RECONCILIATION_DESIGN.md). Distinguish projection-writer
admission from source coordination and statement snapshots from strict freshness
at commit. Map original context, fresh global reads after waits, whole-aggregate
comparison, empty cleanup, exact deleted/upserted identities and atomic rollback
to their owners. Keep new-row/other-root evidence and late-source limits explicit.
Existing entry-point guidance is sufficient; preserve metadata and invocation
policy. Validate and synchronize the four installed files, reporting structural
checks separately from actual PostgreSQL and application evidence.

## Wanted replacement maintenance, October 10, America/New_York

Extend the two references around the [wanted design](WANTED_RELEASE_RECONCILIATION_DESIGN.md).
Map distinct caller contracts, original optional worker context, same-client nested
reads, immutable decision inputs and both source/output comparison to their actual
owners. Preserve composite user/release keys, raw restore compatibility, required
link rollback and shared admission before parent writes. Keep exact missing-artist
handling and component-snapshot/later-acquisition limits explicit. Existing entry
point guidance is sufficient; preserve metadata and invocation policy. Validate
and synchronize the four installed files without claiming a behavioral trial.

Keep raw restore UUID value identity distinct from input text and strict worker
authority. Add the verified alternate-spelling/canonical-return counterexample
to the references, preserving paired last-value deduplication and exact set
checks. Retain the unit red/green evidence and its SQL-double limit separately
from actual PostgreSQL restoration proof.

Keep transaction-client identity separate from its query scheduling contract.
Extend references with delayed nonreentrant controls across outer artists, policy
reads and actual nested metadata queries. Serial reads must retain immediate
source capture before the next await. No entry-point or invocation-policy change
is needed; structural maintenance is separate from driver/runtime evidence.

## Fixture evidence maintenance, October 10, America/New_York

Map prompt approved failure locations, monotonic safe phase records, first-error
preservation and cooperative release/drain to the new testing modules. Retain
native-output/event-arrival limits, failed verification and creation-owned
destructive cleanup. Keep timing totals separate from whole-gate duration and
testing evidence separate from W3C frontend conformance. Preserve entry point,
metadata and invocation policy; validate/sync maintained references after edits.
Map scan-fixture startup to pre-abort refusal, completion registration before
launch and settled startup failure, so late callbacks cannot invent unowned work.

## Prepared test database maintenance, October 10, America/New_York

Map migration-only input identity, private source sealing/quiescence, independent
clone resources, observed OID/role checks and strict selected-mode cleanup to the
new fixture owners. Keep database settings/GRANT copying, privileged-administrator
and unabortable-I/O limits explicit. Link separate fresh bootstrap and clone
acceptance evidence; do not infer global speed or conformance from a local pair.
Preserve entry point, metadata and invocation policy; validate/sync references.

## Parent-owned launcher maintenance, October 10, 2026

Extend the existing standards skill's evidence references for native process
lifecycle, bounded authenticated loopback control and positively acknowledged
PostgreSQL ownership. Keep its current metadata and invocation policy. W3C covers
applicable UI behavior; Node/PostgreSQL lifecycle contracts and OWASP input/logging
practices own this CLI slice. A benchmark does not grant permission to expand the
cohort or establish complete-gate throughput. Each recommendation must map to its
implementation owner, failure case and executed evidence.
