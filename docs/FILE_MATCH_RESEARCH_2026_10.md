# File-match persistence research

Consulted October 9 local / October 10 UTC, 2026, beginning at 03:18 UTC.
The parent supplied clean-main baseline `95cae70`; its baseline verification
remains separate from this read-only research. Host observations at
2026-10-09T23:18:44-04:00: Node v24.18.1 and npm 12.0.2. PostgreSQL 18 below is
the documentation version consulted, not proof of the running database version.

## Observed boundary and recommended owner

Baseline `library-file-matcher-service.js` awaits the metadata lookup before
reading the caller's file/tag objects. `library-file-match-store.js` then
upserts matches by file UUID without acquisition or source guards. This is
source inspection, not an executed stale-write reproduction.

Capture every original observed file's UUID, root/path, size, nullable mtime,
tag payload, optional relevant release scope and original acquisition before
the lookup await. Keep the existing metadata lookup and matching strategies
outside SQL locks. Require the guarded owner for production persistence.

The accepted project direction is one short transaction: maintenance →
running scan → advisory lease key/row → captured root → sorted file rows.
Compare current source and the original acquisition, refreshing authoritative
time after waits, before persistence and before commit. Guard the whole batch;
a refused or incomplete write must not continue into reconciliation. Preserve
current successful empty-batch behavior without deriving success from an
incomplete nonempty batch.

Derive relevant scope from the locked run's current `summary.releaseHints`
using the existing `applyLibraryScanReleaseHints` with the file's old scope
cleared. Compare this derived optional scope with the captured scope; do not
require full-summary equality. Tag comparison uses normalized JSON object-key
semantics in JavaScript and JSONB `IS NOT DISTINCT FROM` in SQL. Those are
project choices whose actual agreement still needs focused and PostgreSQL
evidence. Metadata candidate/version consistency is outside this guard;
sidecar capture already precedes matching.

## Official evidence already verified

| Discovered and opened source | Classification / consulted version | Applicable finding |
| --- | --- | --- |
| [Explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html) | PostgreSQL 18 database documentation; reached through the current page's 18 link | Locked rows are held through the transaction; waiting `FOR UPDATE` obtains the current row or no row. Consistent lock order reduces deadlocks. |
| [Application consistency](https://www.postgresql.org/docs/18/applevel-consistency.html) | PostgreSQL 18 database documentation | A prior general read is insufficient for application invariants; explicit blocking locks and correctly timed authoritative reads matter. |
| [Transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html) | PostgreSQL 18 database documentation | Group related database changes in one commit/rollback boundary. |
| [Date/time functions](https://www.postgresql.org/docs/18/functions-datetime.html) | PostgreSQL 18 database documentation | Transaction-start time differs from actual current time; use fresh clock evidence for expiry after waits. |
| [UPDATE](https://www.postgresql.org/docs/18/sql-update.html) | PostgreSQL 18 database documentation | Returned rows represent rows actually updated; require the intended identities/cardinality rather than assuming a write succeeded. |
| [JSON functions/operators](https://www.postgresql.org/docs/18/functions-json.html) | PostgreSQL 18 database documentation | JSONB supports comparison operators. SQL NULL and JSON null are distinct; extraction can return SQL NULL for an absent/wrong structure. Define nullable source comparison deliberately. |
| [JSON types](https://www.postgresql.org/docs/18/datatype-json.html) and [comparison predicates](https://www.postgresql.org/docs/18/functions-comparison.html) | PostgreSQL 18 documentation; reached through links on the JSON functions page | JSONB does not preserve object-key order or insignificant whitespace; duplicate keys retain the last value. IS NOT DISTINCT FROM gives an explicit Boolean comparison for nullable values. Equality remains distinct from JSONB containment, which discards some array-order/multiplicity distinctions. |
| [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Informative security guidance | Deny by default and validate current authority at the server boundary. Applying that principle to the captured worker acquisition is a project inference, not an OWASP lease protocol. |
| [WCAG 2.2](https://www.w3.org/TR/2024/REC-WCAG22-20241212/) and [status explanation](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html?trk=article-ssr-frontend-pulse_little-text-block) | W3C Recommendation dated 12 December 2024, reached through the opened current page's This version link; informative Understanding guidance | Status semantics are relevant to existing job reporting. This backend-only slice introduces no control, dialog, live-region change, speech test or full-conformance claim. |

These source-specific findings support the transaction and comparison choices;
they do not themselves prove the implementation. No source prescribes the
project's exact acquisition token or matching policy.

## Required evidence and limits

Hold metadata lookup, replace acquisition or change source/tag/scope, then
resume the old body: no match overwrite and no downstream reconciliation.
Use current positive controls, equivalent reordered JSON object keys, genuine
tag differences, nullable tags/mtime, ignored/deleted/root/path/size drift,
cancellation/maintenance, real row-lock waits crossing expiry, zero/incomplete
returned identities and final-guard rollback. Include concurrent catalogue,
tag and organize writers with the agreed root-first order.

No parser, database, provider, browser or test was executed for this research.
Source snapshots compare the catalogue inputs; they do not prove physical byte
identity, metadata lookup snapshot consistency, artwork atomicity or external
exactly-once behavior. Installed host versions do not establish container or
database versions. The read-only research does not replace the root's separate
baseline verification and validation.

## Retained evidence and PR applicability

The research draft was saved before the new match runtime changes. Its actual MCP responses
remain in official-research-draft.json, SHA256
`b522645ba16642dc2f00b93252ff08c9fd0e91dbd00c9bf2370e406ff64ff78d`.
Final fresh discovery/navigation/read responses and host/source observations
are retained under `.tmp/file-match-2026-10/`:

| Evidence | SHA256 |
| --- | --- |
| official-research.json | 57c284477d16388ce5575df12bd1ac6b043fae5a696e7d7f3a54387c618b43a0 |
| official-final-semantics.json | 3bee0919c7bf44e7c031f71eb7e97afda6433ec49f233ae2faf1484574a3f0b0 |
| host-and-source-observation.json | e20c2072d3977d669ff2aea59a38678a5143b21166b5d09bfd530aef7a1ad0fa |

Official-source consultation is separate from publication dates and observed
installed versions. The retained numeric UPDATE count paragraph confirms that
a zero-row update is not itself a SQL error; rejecting it is the owning
application contract. A preliminary literal-word search for zero returned no
match and was followed by the actual paragraph read; its raw response remains
retained. No failed application test is implied.

The separate [PR applicability design](OPEN_PR_APPLICABILITY_FILE_MATCH_2026_10_DESIGN.md)
and [outcome](OPEN_PR_APPLICABILITY_FILE_MATCH_2026_10_OUTCOME.md) record fresh
repository discovery, complete observed pages and full immutable/file comparisons.
Only previously replayed unchanged PRs 23, 24 and 40 were observed. Eligible
set: empty; random selection: N/A.
