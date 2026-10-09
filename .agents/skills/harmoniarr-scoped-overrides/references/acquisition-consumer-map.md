# Acquisition override consumer map

Use this map when the task concerns an acquisition exception. Confirm current
callers and data shapes with source search before editing.

| Boundary | Source area | Question to answer |
| --- | --- | --- |
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
