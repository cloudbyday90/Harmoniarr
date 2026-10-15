# Recovery schema timing and template adoption design

Date: 2026-10-15. Scope: the nine-case Music Queue recovery transaction suite,
whose current fourteen scenarios each own a fresh database.

## Decision and implementation

Reuse the shared PostgreSQL runtime and its migration-only prepared template.
Introduce a small recovery schema policy and a reusable recovery scenario adapter.
The adapter delegates to the existing pool-bound schema preparation helper, then
measures actual scenario work while forwarding the test signal and the same
database configuration. It constructs fresh recovery services and seed state for
each scenario. The canonical suite and native adoption controls use this adapter.

Initially retain empty-schema startup while comparing explicit empty and
migration_template modes. HARMONIARR_INTEGRATION_RECOVERY_SCHEMA_MODE selects a
reviewed mode; invalid values refuse startup. Promote only this suite's default
if native isolation and both-order comparison support it. Keep explicit empty
mode available, global runtime defaults unchanged, and dedicated untemplated
migration/bootstrap acceptance independent.

No recovery assertion, SQL guard, lease/cancellation behavior, scenario database,
pool limit, deadline, registration protocol, worker count or production service
is removed. Template preparation copies schema/migrations only; it must not copy
scenario users, candidates, discovery state, runs, events or clone-local faults.
The current sealed identity/fingerprint checks remain the admission authority.

## Evidence plan

Unit controls cover explicit/default mode validation, forwarding the actual pool
and signal, held preparation/scenario completion, exact Error/null propagation
and refusal before context/scenario work after failed preparation.

Run the complete unchanged nine-case suite in empty/template/template/empty order
on identical instrumented source. Compare native case/outcome digests, fourteen
schema/scenario spans and unchanged scenario database count. Report the extra
template create/drop and its one preparation separately; do not require equal
CREATE counts when the design intentionally adds a template. Source checks,
native completion and zero skips are prerequisites to comparing elapsed time.
Inclusive phase spans are not additive wall-time components.

Native adoption controls use the canonical adapter with real recovery commits,
events, fault triggers and Error/null, then prove a fresh clone has none of that
state. Inspect distinct database identities, current migrations and configured
pool bounds. Reopen the source template and prove admission refuses before
schema/context/scenario work with no empty fallback. Retain existing template
acceptance controls for schema drift, source identity and cleanup.

If promoted, preserve the explicit-mode comparison as candidate evidence, freeze
the final source separately and validate the default canonical suite plus shared
cohort, native adoption controls and the complete fast gate. Do not relabel a
pre-promotion fingerprint as the final source.

## Limits and security

Keep native connection, candidate, database and actor identities private; publish
bounded phase/count summaries and case digests. A sealed template is not a
security boundary against a privileged administrator. PostgreSQL database-level
settings and permissions are not copied automatically; use the existing runtime
connection/pool policy rather than assuming inheritance. Await all returned work
and disposal; no abort race, shared mutable scenario database, retry or release.

See [official research/options](RECOVERY_SCHEMA_TEMPLATE_RESEARCH_2026_10.md)
and [executed outcome](RECOVERY_SCHEMA_TEMPLATE_OUTCOME.md).
