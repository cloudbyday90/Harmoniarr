# Scan receipt invalidation outcome

October 12, 2026. Baseline main `4e3ee28`. Separate
[design](SCAN_RECEIPT_INVALIDATION_DESIGN.md) and
[official research](SCAN_RECEIPT_INVALIDATION_RESEARCH_2026_10.md) own alternatives,
current primary sources and scope limits.

## Implemented behavior

Four small ESM policy/store/file/service modules capture eligible private receipt
revisions before a complete walk and publish only current missing observations.
Capture capabilities stay in a private WeakMap, bound to the original run,
acquisition and canonical root. Catalogue publication checks unchanged receipts,
private roots, actual ENOENT and contained existing ancestors, including final
checks after required events. Candidate locks precede receipt locks.

The additive migration gives each projected receipt a UUID revision and indexed
path. A negative row references that exact revision and scan/root acquisition;
replacement/deletion cascades obsolete observations. Catalogue, negative row and
required bounded candidate event share one transaction. Historical receipt JSON
is retained. Migration replay preserves existing revisions/observations; generated
columns/defaults can rewrite the ledger, so startup locking remains an accepted
cost. Migration and snapshot include 107 migrations and 133 critical anchors.

Production module wiring now captures before its actual worker walk. One missing
private copy produces one negative row and reopens only that owner's source and
Wanted requirement through existing current-byte reconciliation. Event correlation
requires the current scan run/acquisition. Restoring the same bytes removes Wanted
work even while the historical negative row remains. Later direct reconciliation
cannot claim that old scan's correlation. No provider dispatch or new consent is
authorized by an observation. New/replaced receipts and restored files cannot be
marked by an older captured walk.

Observed membership uses a host-normalized set; capture resolves each owner's
root once, while publication rechecks current roots. Windows lookup selects both
drive-qualified and process-drive-rooted spellings before host containment.
Private scan-invalidation DTOs are excluded from public control-plane projection.
Maintenance during the new capture/publication path uses the existing pause kind.

## Executed evidence and retained candidates

- Final focused checked literal manifest: 125/125 across ten server files, no
  failures/cancellations/skips. Controls cover opaque/stale acquisition, changed
  revision, observed/restored paths, changed roots, late restoration/lease refusal,
  malformed history, uncertain I/O, LIKE escaping, maintenance pause and exact
  run/acquisition correlation, plus existing owning module/Wanted/recovery guards.
- Reviewed native candidate: 9/9 across scan invalidation and receipt-ledger files.
  It proves actual worker observations, required-event/lease rollback, snapshot
  installation, real production-module media/source/Wanted behavior and unchanged
  ledger upgrade/lookup. Final additional new-receipt/root/cancel/replay controls
  and maintenance/correlation review are owned by the frozen broader native gate.
- Snapshot generation applies 107 migrations on a fresh owned PostgreSQL source;
  source/snapshot shape validation checks 133 anchors. Final native snapshot proof
  exercises revision/FK installation, beyond text comparison.

Ignored evidence lives in `.tmp/scan-receipt-invalidation-2026-10-12/` and the
initial root-level snapshot/unit logs. Retain the first missing fixture role,
incorrect fixture private-root layout, and the production Windows path lookup
failure separately. The layout now follows the existing `users/` boundary and
positive preconditions prevent vacuous refusal tests. The Windows mismatch was
a real lookup defect exposed only by production paths; both spellings are now
selected and host containment remains required. Diagnostic native subsets are
not complete passing gates. Healthy PostgreSQL snapshots do not establish the
cause or repair of historical connection resets.

The first fast candidate passed before the final maintenance/correlation review.
It is retained as `fast-initial.log`, not presented as final frozen evidence.
No skip, retry, pool/deadline increase or parallel promotion masks a failed run.

Five skill structural validators pass and seven installed standards/scoped files
match source SHA-256 hashes. This is reference maintenance without a new blind
evaluation. `npm audit --json` reports zero vulnerabilities; this registry result
does not establish a complete security audit.

Final frozen `npm run validate:fast` passes 10,007 cases (5,069 server, 4,384 client,
554 scripts), with no failures/cancellations/skips, static checks and both builds.
Command elapsed 197.171s; this is a local validation observation, not a speed
benchmark. All 19 changed JavaScript files and both migration/snapshot SQL
artifacts remain identical to the frozen candidate in working tree and Git index.

Final frozen affected native cohort passes 109/109 across sixteen checked literal
files, with zero failures/cancellations/skips. It includes scan invalidation,
catalogue and scan lifetime, receipt ledger, delivery recovery, catalog/consent/
publication authority, Wanted/release reconciliation, metadata/reconciliation/
apply lifetimes, import/media operations, Music Queue recovery and Missing Music
fallback. New-receipt, restored/replaced revision, changed-root/cancellation,
required-event/late-lease rollback, exact production correlation, direct rebuild,
restored-byte and migration replay controls all pass. TAP elapsed 614.710s;
command elapsed 614.845s. This is the affected
cohort, not a new complete integration execution or speed comparison.

Media checks use the existing `harmoniarr-quality-fallback:local` image at
`sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`,
observed ffprobe 8.0.1 and network-disabled owned media workspaces. PostgreSQL
observations report 18.3; Node/npm remain 24.18.1/12.0.2. Pool max two, ten-second
checkout and existing scenario bounds remain unchanged.

## Recommendations and next item

Keep original scan authority → opaque pre-walk revision capture → complete walk
→ current private-root/absence checks → atomic catalogue/negative/event → live
byte verification and owner-specific source reconciliation. Benefits: durable
missing evidence, retained history and protection for newer publications. Costs:
extra capture/checks/storage and synchronous migration; filesystem and SQL remain
separate resources. External writers can race after an observation, so it never
overrides current bytes or grants positive availability. No speedup or broad
security/accessibility certification is claimed.

Next, instrument Wanted receipt verification with bounded counts, bytes and phase
durations, then measure repeated hashing on representative local media. Use those
results before choosing batched verification or a positive availability cache.
Broader unions and changed-scope source intake remain separate. The
[PR assessment](OPEN_PR_APPLICABILITY_SCAN_RECEIPT_2026_10_OUTCOME.md) finds no
eligible unreplayed revision. Main only; no release or PR merge.
