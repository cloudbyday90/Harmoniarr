# Indexed owner receipt outcome

October 12, 2026. Baseline main `e579c47`. Separate
[design](OPERATOR_TRACK_RECEIPT_LEDGER_DESIGN.md) and
[official research](OPERATOR_TRACK_RECEIPT_LEDGER_RESEARCH_2026_10.md) own the
alternatives, primary-source applicability and remaining scan boundary.

## Implemented behavior

Historical receipt lookup now uses an owner/release B-tree index rather than
expanding unrelated applied candidate JSON. A small ESM receipt store retains the
existing owner/release selection DTO and borrowed transaction. Candidate JSON
remains source evidence. An additive migration derives ledger rows from applied
candidate writes and backfills existing supported single/two-owner receipts in
the same protected installation window.

The ledger key is candidate plus owner. UUID keys and a binding constraint retain
the original receipt's owner/release; no current owner/request/catalog reference
is invented or rewritten. Pending checkpoints, unknown versions, malformed IDs,
unsupported envelopes, duplicate owners and cross-release pairs cannot yield a
partial projection. Source replacement, leaving applied status and deletion
update/remove the derived rows. Unrelated payload changes leave them untouched.
Required-event rejection rolls candidate publication and ledger rows back together.

Wanted still verifies current private-root bytes, saved scope and existing source
lifecycle markers. Indexing does not skip hashes, grant consent, dispatch providers
or change scan authority. No new public endpoint, job system, availability cache
or UI flow is introduced. The migration is synchronous and excludes candidate
writes during backfill; storage and startup/write blocking are accepted costs.

## Measurement scope

Before editing, the actual legacy acquisition store on a fresh 10,001-candidate
fixture selected one receipt in 20.477–26.854ms across six process-side calls;
EXPLAIN execution was 19.899ms and touched 2,039 shared blocks. This initial minimal
receipt fixture isolates SQL, not current media verification.

The tracked native comparison uses complete-shaped receipt JSON and the same
seeded database for both legacy and indexed queries. Six pairs alternate order,
verify identical selected DTOs and retain planner-chosen EXPLAIN/buffer results.
Initial complete-shaped observations confirmed owner/release index selection and
three indexed blocks versus over a thousand legacy blocks. Different payloads,
cache state, host load, order and instrumentation preclude comparing the first
minimal fixture directly with that result or claiming a universal speedup.
There is no time threshold assertion or forced index/parallel planner setting.
The final affected cohort owns the final measured result.

| Frozen matched SQL-only observation | Legacy expansion | Indexed selection |
| --- | --- | --- |
| Process-side median, six alternating-order calls | 107.713ms | 1.103ms |
| Process-side observed range | 80.851–127.625ms | 0.795–1.607ms |
| EXPLAIN execution time, separate instrumented call | 121.610ms | 0.147ms |
| Shared hit blocks at root plan | 1,289 | 3 |

Both queries selected the same single owner receipt from 10,001 candidates.
The planner used the owner/release index without forced settings. This is one
local synthetic profile, not a CI or whole-Wanted speedup; repeated byte hashing
and real-library distribution remain outside the measured improvement.

## Executed validation and retained diagnostics

- Focused checked literal manifest: 152/152 across ten server files, no failures,
  cancellations or skips. New store checks prove transaction/DTO preservation,
  empty-set behavior and acquisition delegation.
- Corrected initial native ledger proof: 3/3. It proves a real pending-migration
  upgrade, backfill and idempotent runner; malformed history refusal; owner
  isolation; uncommitted visibility; required-event rollback; replacement,
  leaving applied status, deletion and binding constraint refusal; matched lookup.
  Snapshot behavior was then added to the frozen native candidate.
- `npm run update:schema-snapshot` generated the snapshot from 106 applied
  migrations. `npm run check:schema-anchors` verifies source/snapshot agreement
  across 124 critical anchors. Native snapshot execution also exercises the
  actual projection trigger, beyond table/index shape comparison.
- Five skill structural validators pass; seven installed standards/scoped files
  match source SHA-256 hashes. This is reference maintenance without a new blind
  trial, broad security audit or conformance certification.
- Frozen `npm run validate:fast`: 9,998 passing cases (5,060 server, 4,384 client,
  554 scripts), no failures/cancellations/skips, static checks and both builds.
  Command elapsed 260.538s; this is an observed local gate, not a speed benchmark.
  All seven changed JavaScript files and both migration/snapshot SQL artifacts
  remain identical to the frozen candidate in the working tree and Git index.
- `npm audit --json` reports zero vulnerabilities. This registry observation
  does not establish a complete security audit or replace ownership checks.
- Final frozen affected native cohort: 100/100 across fourteen checked literal
  files, no failures/cancellations/skips. Ledger upgrade/snapshot/rollback/lookup,
  real two-owner recovery, catalogue/consent/publication authority, Wanted/release
  reconciliation, scan catalogue, apply/import/media and worker lifetimes, Music
  Queue recovery and Missing Music fallback all pass. New snapshot proof verifies
  the installed trigger, lineage and idempotent migration. The actual worker
  publishes exactly its two receipts into the ledger, and required-source-event
  failure leaves none. TAP elapsed 365.516s; command elapsed 365.782s. This is an
  affected cohort, not a new complete integration execution or matched gate speedup.

Media checks use the existing `harmoniarr-quality-fallback:local` image at
`sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`,
observed ffprobe 8.0.1, network-disabled owned media workspaces and PostgreSQL 18.3.

Ignored evidence lives in `.tmp/track-receipt-ledger-2026-10-12/`. The first native
run passed 2/3 and failed its upgrade fixture because node-postgres rejects a
multi-command parameterized query. Separate statements correct the fixture;
the failed run and healthy independent PostgreSQL observations are retained.
They do not establish any cause or repair for historical connection resets.
All final gates preserve serial native execution, scenario/checkout/pool bounds,
real media prerequisites and process isolation; no retry, skip or expanded bound
turns the failed candidate into final passing evidence.

## Recommendation and next item

Keep canonical guarded publication → historical candidate JSON → atomic derived
ledger → indexed owner/release lookup → current private-root/hash verification
→ existing owner-specific source reconciliation. Benefit: selection no longer
expands unrelated history and source/event rollback remains atomic. Cost: duplicate
historical storage, trigger maintenance and synchronous backfill; hashing remains.

Next, design and prove scan-owned negative receipt invalidation. Bind complete
root scope, original scan acquisition, exact receipt/path and a final current-state
check so an old walk cannot invalidate a new delivery. Measure hash cost before
proposing a positive availability cache; size/mtime alone cannot fulfill a byte-
backed requirement. Broader unions and changed-scope intake remain separate.
The [PR assessment](OPEN_PR_APPLICABILITY_RECEIPT_LEDGER_2026_10_OUTCOME.md) finds
no eligible unreplayed revision. Main only; no release or PR merge.
