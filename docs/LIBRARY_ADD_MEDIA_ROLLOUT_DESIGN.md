# Canonical media rollout decision and module design

Date: 2026-10-15. This follows the
[explicit pilot](LIBRARY_ADD_MEDIA_PILOT_OUTCOME.md).

## Decision boundary

Repeat the complete six-case cohort in the reverse order, per-command then owned
API, on unchanged pilot code. Require identical generation/inspection counts,
passing canonical assertions and verified owner cleanup. Keep command/setup
duration distinct from scenario work. Record host load instead of claiming an
unobserved quiet window; an initial CPU sample was 81%.

The existing workflow runs general validation on Ubuntu without configuring a
media image or proving this API-backed canonical cohort there. The reader
deliberately refuses unreviewed Engine versions/endpoints. Local performance
evidence cannot establish that all existing callers can use it. Keep the cohort's
per-command default and the explicit owned-api option while those gaps remain.

## Concrete modular improvement

The pilot adapter imports `library-add-media-fixtures.js` to get media tools.
That file also imports settings, operation queues, candidate and metadata SQL
fixtures. A fresh native import probe observed 75 project modules, including
27 production server modules, merely to resolve an empty options object.
This is unnecessary database coupling in media-only and pure selection tests.

Extract the unchanged media fixture into `library-add-media-tools.js`, containing
only Node built-ins. Keep path conversion there and preserve legacy named exports
from the database fixture, whose actual seed/worker helpers remain in place.
The adapter imports the new media module directly. Extract options into the pure
`library-add-media-options.js` policy and preserve its existing adapter export.
This does not change execution defaults, child-process arguments, timeouts,
mounts, generation, inspection frequency or lifetime authority.

Use a fresh-process native module-resolution guard to prove the tools/options
and scoped adapter cannot import database/application modules. The adapter may
retain its small shared Error/null-preserving cleanup utility. Verify local
command execution, exact inspection delegation and pre-dispatch path refusal.
Existing native legacy-import consumers prove the re-export compatibility path.
An import-count reduction is a boundary result, not a whole-suite speed estimate.

## Security and validation

Retain every app authorization, CSRF, replay, rollback, current policy/provenance,
codec, delivery-byte and refusal assertion. Keep actual close after app drainage,
strict cleanup predicates, returned database-tail ownership and sticky child/
parent retention. Privileged Docker access stays in trusted test infrastructure.
No production API/schema, CI concurrency or resource limits change.

Separate the unchanged-code measurement pair from final extracted-code proof.
Run focused native module/routing controls, the complete canonical cohort in both
modes and the existing native owned-media controls, followed by the appropriate
fast gate. Keep all timings qualified by scope/load. No new branch, release,
tag or PR merge is required. Separate
[research](LIBRARY_ADD_MEDIA_ROLLOUT_RESEARCH_2026_10.md) and
[outcome](LIBRARY_ADD_MEDIA_ROLLOUT_OUTCOME.md) own sources and evidence.
