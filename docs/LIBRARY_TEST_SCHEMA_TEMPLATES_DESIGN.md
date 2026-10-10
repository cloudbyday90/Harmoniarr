# Measured library test schema templates

October 10, 2026, America/New_York. Baseline main: `d1b8dee`.
The [official research](LIBRARY_TEST_SCHEMA_TEMPLATES_RESEARCH_2026_10.md) precedes
code selection; the separate [outcome](LIBRARY_TEST_SCHEMA_TEMPLATES_OUTCOME.md)
owns executed measurements and adoption decisions.

## Problem and scope

The four-file shared PostgreSQL profile preserves 90 database creations and all
34 native cases. Wanted already prepares one private migration-only source, but
catalogue, release reconciliation and tag snapshot still repeat empty-schema
migrations without directly timing them. Total wall time does not establish
which preparation boundary costs most. Measure before selecting another mode.

Instrument schema preparation, fixture seeding and scenario work/drain through
the existing approved phase observer. Keep its opaque IDs, fixed labels and
monotonic durations without database names, credentials, SQL or error bodies.
The schema helper requires the scenario's explicit getPoolFn; it cannot silently
use the app-global pool. Await actual migration work on cancellation and preserve
its original failure. Timing observation is optional and cannot change work.

The selected adoption candidates are release reconciliation (8 cases/24 variants)
and tag snapshot (8 cases/22 variants). Keep all original assertions, real locks,
fault triggers, native parsing and case deadlines. Catalogue is measured but
retains empty mode. Global runtime defaults and dedicated migration/bootstrap/
recovery/lifecycle-adverse fixtures retain their own preparation paths.

## Reuse the existing owner

Do not create a new cache or template engine. The existing ESM owner prepares
only migrations, verifies captured ordered filename/key/checksum/status lineage
and the actual server/encoding/locale profile, closes the preparation pool, seals
connections and verifies zero sessions/current-role OID before clone admission.
Source fingerprints are checked after preparation and on every clone. Parent
reserve/CREATE/OID acknowledgement, fresh pool configuration and strict positive
ownership cleanup remain mandatory; uncertain creation cannot authorize DROP.

Each scenario receives its own database/pool and runs the actual idempotent
`applyPendingMigrations({getPoolFn})` call before fresh seeds. This call checks
filenames; it is not a substitute for the owner's complete lineage verification.
No workspace/media/row/run/lease/fault trigger is copied into a source. Database
settings/GRANTs are not assumed inherited. Keep cooperative scope/after-drain
lease cleanup and refreshed monitoring reads unchanged.

A narrow pure policy accepts only `empty` or `migration_template` for named
release/tag domains through separate environment overrides. Unknown values fail
before resource startup rather than falling back. Begin with explicit template
selection; promote a candidate's default only after equivalent unchanged cases,
adverse ownership/isolation proof and measured costs support it. Retain an explicit
empty comparison mode. Other domains cannot select these modes accidentally.

## Options and recommended stack

| Option | Benefit | Cost / limitation | Selection |
| --- | --- | --- | --- |
| Instrument existing empty preparation | Direct cost evidence with current semantics | Adds observation only | First |
| Per-file verified migration-only sources + fresh clones | Removes repeated schema application while retaining real commits/races | Source preparation, lineage/clone checks and copying | Assess for release/tag |
| One mutable database or copied seeded baseline | Less setup | State leakage and altered concurrency oracle | Reject |
| Persistent cross-run cache or glob-wide selection | Potential speed | Stale inputs/unproven owners and invalidation cost | Defer |
| Fewer assertions, longer deadlines or more workers | Small configuration change | Does not repair ownership or demonstrate equivalent coverage | Reject |

Recommended stack: Node ESM policy/measurement helpers; existing isolated native
file runner and shared owned server; verified private per-file migration sources;
fresh scenario pools/seeds; captured-role/OID capability registry; focused
development feedback followed by one stable complete serial gate. Apply relevant
Node/pg/PostgreSQL vendor contracts and OWASP evidence/privacy practices. W3C/
WHATWG/IETF govern applicable app journeys; this test-only slice adds no browser
conformance claim or production schema change.

## Acceptance and comparison

First measure the same four-file order/reporters/server profile with release/tag
empty and timings enabled. Compare source preparation, per-case schema spans,
seeding/work and clone admission separately; nested spans cannot be summed twice
or substituted for wall time. Repeat the unchanged 34 cases under explicit
release/tag template selection; report actual database/source counts and cleanup.
Host/cache effects and a local pair cannot prove CI or whole-gate speedup.

Add bounded policy/measurement controls and one separate actual tag clone suite
showing row/trigger/run/lease/media independence after a failed clone, genuine
native parse success in a later clone, and refusal before seeding on source drift.
Reuse existing template fingerprint/session/collision/replacement/sibling controls;
do not duplicate them. Keep dedicated untemplated bootstrap/migration proof,
security checks and all original scheduling/deadlines. Work stays on main with
commit/push, without branch, release, tag, deployment or PR merge.
