# Transactional request lifecycle outcome

Recorded September 12, 2026. The separate [design document](TRANSACTIONAL_REQUEST_LIFECYCLE_DESIGN.md) contains official-source research, alternatives, and the commit/locking model.

## Result

Cancellation and reassignment now use a dedicated ESM lifecycle service. The existing transaction runner passes one client through request locks, state changes, private history, required audit records, generic household Activity, and the final request read. The API returns success after commit. Any required persistence failure rolls back all these records, and unexpected errors use a fixed safe message in individual and bulk responses.

The implementation uses strict same-database Activity insertion rather than an outbox: the feed reads the committed row directly. This provides immediate visibility without a queue, relay, retry scheduler, or migration. The obsolete optional lifecycle publisher is removed; request creation keeps its separate best-effort publication behavior.

Conflicting lifecycle writers lock and reread current request state and ownership. Administrator cancellation locks actual children in stable identifier order and writes their real previous states, including `needs_review`. Cascades retain one parent Activity event. Target account reads use the transaction client's shared user lock, so local disable changes are checked after a conflicting update completes. Canonical database user identifiers prevent alternate UUID spellings from recording false reassignment changes. Household projection and authorized private detail boundaries remain intact.

## Validation

Real PostgreSQL coverage includes rollback at each of history, audit, and Activity for both actions; successful retry; concurrent duplicate mutations; continuous ownership history under distinct concurrent reassignments; whole-family rollback; correct child previous states; safe bulk errors; ownership checks after waiting for a request lock; local target disable checks after a user lock; immediate Activity visibility; and existing authentication, CSRF, fresh-session, and privacy checks.

- Focused service/store validation passed 73 tests.
- `node --test --test-concurrency=1 test/integration/media-request-lifecycle-activity.test.js` passed all 17 real PostgreSQL scenarios with zero skips, including final UUID regressions.
- `npm run validate:security` passed image/topology policies and npm audit with zero reported vulnerabilities.
- `npm run validate` passed repository policies, lint, all 8,114 tests (3,417 server, 4,205 client, 378 script, 114 integration; zero failures or skips), and client/server production builds.

Independent review found and verified the alternate-UUID no-op correction, and found no remaining concrete blocker in the inspected transaction, privacy, or cross-module lock order. It identified the separate Plex profile eligibility race listed below. This is not a claim that every platform concurrency path has been exhaustively proven.

No schema changes are needed; the snapshot remains at 99 migrations. No live provider call or new immutable-image acceptance was performed by this slice. A lost HTTP response after commit is not replay idempotency; clients must refresh current state. Historical missing Activity remains missing. Cancellation changes request intent and does not claim media deletion or termination of completed transfers.

## PR disposition

GitHub MCP returned the same three open PRs on September 12. Complete patches were reviewed; none applies, and none was merged or applied locally.

| PR | Reviewed head | Decision |
| --- | --- | --- |
| [#40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` | Node 26 fixture change does not match the retained Node 24 LTS platform. |
| [#24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` | Proposed build/push action 7.2 is superseded by local 7.3. |
| [#23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` | Proposed metadata action 6.1 is superseded by local 6.2. |

## Next five priorities

| Priority | Recommendation | Benefit | Cost or limitation |
| --- | --- | --- | --- |
| 1 | Unify recipient-eligibility locking across Plex profile refresh and transactional request mutations. | Closes the remaining race where provider eligibility changes in a separate profile row after the account lookup. | Requires consistent lock order across profile writers and request creation/reassignment; avoid inventing a new eligibility policy. |
| 2 | Run final immutable candidate acceptance using published digests, provenance, and an accepted baseline. | Connects release evidence to the artifact users install. | Requires registry access, a selected baseline, and supported-platform runs. |
| 3 | Complete live provider acceptance with saved eligible connections and a public test playlist. | Verifies real access, pagination, and provider behavior. | Depends on provider credentials, permissions, and quotas. |
| 4 | Complete operator recovery acceptance for the final candidate. | Demonstrates recoverable request/library state in the shipped runtime. | Needs an isolated rehearsal and retained evidence. |
| 5 | Measure large-library queries and retention under representative load. | Establishes release performance budgets rather than relying on fixture size. | Requires representative data and explicit thresholds. |

## Recommended stack and tradeoff

Retain Node 24 LTS, modular native ESM service/store factories, the existing PostgreSQL transaction runner, PostgreSQL 18 row locks and constraints, strict transactional Activity persistence, the shared privacy projection, and existing Vue/native W3C-aligned controls. No client behavior or ARIA role changed.

Direct transactional Activity is recommended because all affected records share one database. Its benefit is an immediate all-or-nothing result; its cost is that Activity persistence becomes required for these actions. Introduce an outbox only when a future delivery target crosses the database transaction boundary, using the existing operation workers and idempotent consumption. The next code item is recipient-eligibility locking consistency; the next release evidence gate remains final immutable candidate acceptance.
