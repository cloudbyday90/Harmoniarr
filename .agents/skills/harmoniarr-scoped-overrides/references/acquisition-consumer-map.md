# Acquisition override consumer map

Use this map when the task concerns an acquisition exception. Confirm current
callers and data shapes with source search before editing.

Negative scan observations now bind the original scan acquisition, private root
and pre-walk receipt revision (docs/SCAN_RECEIPT_INVALIDATION_OUTCOME.md). They
retain historical receipts and do not lower verification or grant provider replay.
Wanted checks current bytes and saved scope; only the currently reconciling scan
run/acquisition can annotate its source reopening. Restored media and new/replaced
revisions cannot be overridden by an old negative observation.

Historical receipt lookup now uses operator-track-receipt-store.js's indexed
candidate-owned projection (docs/OPERATOR_TRACK_RECEIPT_LEDGER_OUTCOME.md).
Backfill and triggers grant no new consent or availability. Preserve current
owner/scope/private-root/byte checks and the reopened-source marker; scan size,
mtime or missing-file observations cannot replace receipt identity verification.

The two-owner slice in docs/OPERATOR_TRACK_UNION_OUTCOME.md supersedes the blanket
different-subset refusal for two distinct disc-one tracks only. Require both
owned requests/Wanted scopes, an exact captured participant set, current private
roots and separate receipts. Recipient-owned subset publication must not be
suppressed by another person's active request or the shared discovery row;
whole-release deduplication retains its prior semantics. Copies retain shared
input, and each destination root owns filesystem containment. Preserve every
quality floor/consent; broader unions stay blocked. Bounded partial delivery
recovery now uses docs/OPERATOR_TRACK_RECOVERY_OUTCOME.md: require a committed
checkpoint bound to both current plans and all accepted participants, current
acquisition authority and unchanged destination bytes. Preview independently
rechecks evidence; it grants no adoption authority. Final receipts/source state
and required events are atomic. Lost current private bytes reopen only the
matching retired owned source; an old receipt cannot suppress that reopened
requirement. Unrecorded copies and changed consent/catalog/root remain review.

| Boundary | Source area | Question to answer |
| --- | --- | --- |
| Exact track requirement | Catalog/scope verification, track file policy/evidence/fulfillment services, request/Wanted context and execution/apply adapters | Does current catalog membership support the exact occurrence and saved owner intent? The first supported subset is one track on disc one: unique numbered file, consistent raw path, exact provider manifest, actual recording/release/position/duration probe and destination-byte receipt. Preserve all owners/nulls and refuse incompatible scopes. Legacy candidates need typed context. Fulfillment is source-owner-specific; Wanted checks current bytes. Multi-track/disc unions and adoption/origin recovery remain conservative. See `docs/OPERATOR_TRACK_SUBSET_OUTCOME.md`; filename scoring and embedded tags are not acoustic identification. |
| Positive rediscovery continuation | `src/server/import-candidates/music-queue-recovery-discovery-handoff-service.js`, handoff store, library discovery dispatcher | A guarded search does not authorize a later ordinary download. After awaited ingestion/readiness, rebuild the complete current requirement and atomically commit search acceptance, confident selection and an exact typed execution child. Prove positive persisted results, rollback and delayed refusal; do not increment the already-decided failure/research budget again. |
| Canonical target and permission | `src/server/missing-music/missing-music-decision-service.js`, fallback quality policy/service | Which selected recipient owns this choice, and is this fresh state eligible? |
| Guarded write | Library fallback quality service, music queue rediscovery store, discovery request store; maintenance lock write guard | Are maintenance, account eligibility, owned wanted row, and discovery/link locks used in the established order? |
| Scoped read | `src/server/library/library-wanted-release-store.js` | Does the detail read this wanted link's override and this owner's preferences? |
| Current quality projection | `src/server/acquisition/acquisition-quality-evidence-policy.js`, acquisition pipeline service | Are `lastSearchResult.autoSelection.quality` observations reevaluated under the selected owner's policy? Are old findings suppressed during a new retry? |
| Shared search | Library discovery dispatch and shared quality-context module | Do all relevant recipients' requirements and valid wanted-bound choices control effective search preferences? |
| Candidate and media gates | Acquisition quality policy, candidate selection, media inspection and spectral proof services | Does the candidate retain its base verification policy after search broadening? |
| Fallback recovery and delayed work | `src/server/import-candidates/music-queue-recovery-policy.js`, recovery service/store, execution/discovery workers | Does explicit null remove consent instead of re-inheriting it? Retain every valid participant floor; tie one acquisition decision to the durable source attempt, commit intent/audit together and recheck before delayed provider work. Different terminal kinds are not different attempts. |
| Completion | Safe-add/library integration services | Are verified media, path containment and durable ownership still required? |
| Client action | `src/client/services/missing-music/`, Missing Music composables and inspector | Does the canonical command refresh current detail/list safely and show the shared-policy limitation? |

Existing lossless fallback allows supported lossy formats at a 256 kbps floor.
That is an implementation fact to confirm, not a general permission to add new
formats or thresholds. Already-fallback-allowing profiles should not receive a
meaningless exception. `needs_verification` does not authorize fallback.

Saved `minimumQuality: high` promises 320 kbps in Account preferences, while the
generic High quality profile's baseline is 256 kbps. Confirm both semantics and
carry the stricter effective floor; profile-name equality alone is insufficient.

The user-preferences migration stores `{}` and the account service defines absent
keys on a stored object as Any/Any. Preserve legitimate default/partial objects;
distinguish these from explicitly invalid values or missing owner/policy data.

The selected person's policy may differ from the strictest shared profile. Use
shared quality output only for bounded observed facts. Keep effective search
format preferences separate from the profile attached to candidate verification.
