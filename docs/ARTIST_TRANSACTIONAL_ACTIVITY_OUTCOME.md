# Transactional artist Activity outcome

## Delivered contract

Artist policy saves now write required `artist_policy_saved` and `artist_monitored` events through a dedicated ESM service using the save's existing PostgreSQL transaction client. Inserts run sequentially before COMMIT. There is no detached Activity callback, second pool connection, outbox, migration, or additional worker for this same-database destination.

The existing policy-change summary determines whether to record a policy event; the existing unmonitored-to-monitored transition determines whether to record a monitored event. Actor, artist, change-count, snapshot, and reconciliation fields retain their existing presentation contract. An unchanged intent does not generate duplicate policy or transition events.

Required Activity failure now rejects the save before commit and rolls back monitoring, selections, snapshot, queued reconciliation, and any earlier Activity insert. After commit, notification, immediate metadata refresh, and projection failures remain best effort with safe structured evidence; they cannot undo Activity or repeat the save. The external notification is still sent only after a successful monitored transition.

## Validation

Focused transaction tests passed. They exercise failure after the first Activity row, complete rollback with no external callbacks, default successful persistence with snapshot/run correlation, stale revision replay, unchanged intent, and a pre-commit uniqueness retry without duplicate rows. The revised post-save PostgreSQL test also passed with two durable Activity rows and exactly three later failure warnings. Focused save/identity tests passed 26 tests. After full validation, final removal of the obsolete startup callback passed 12 module/notification wiring tests, scoped ESLint, and a fresh server build. `npm run validate` passed: repository checks, lint, 3,483 server tests, 4,287 client tests, 500 script tests, 147 integration tests (8,417 total), and both builds. `npm run validate:security` passed with zero reported vulnerabilities.

Docker was rebuilt following LOCAL_DOCKER_WALKTHROUGH.md with existing configuration/data preserved. Image `sha256:0b0ee10fea7696ac42852077acf32d07cf9929099c67bec05194bdc696f71516` is healthy, bootstrap completed successfully, and live `/healthz` returned 200. No live artist policies were mutated for failure injection. No UI behavior changed or new browser run was required.

## Operational outcome and limits

The existing Activity feed reads the committed events immediately; it does not wait for a worker. A lost HTTP response followed by an old-revision replay is rejected with 409, rather than creating duplicate events. This is revision conflict protection, not an idempotent HTTP success replay or an exactly-once external delivery claim.

Required event persistence now shares the save's availability: an Activity schema/storage failure prevents a new save from committing. Existing events are still subject to deployment backup and retention behavior. Historical missing events are not backfilled. No extra user, provider, credential, or notification payload fields were added to household Activity. Notification delivery remains a separate best-effort contract.

## Final recommendation and next step

Keep the existing save lock/revision check, PostgreSQL transaction, narrow Activity writer, Activity store, and Activity feed. This removes the dual-write gap without queue complexity. Use an outbox only when delivery must cross a separate resource boundary.

Next address notification delivery guarantees explicitly: persist required dispatch intent with idempotent consumers and bounded recovery only if the product requires eventual delivery. The overlapping reads in the artist save transaction have now been replaced with sequential awaits; see [query-ordering outcome](ARTIST_TRANSACTION_QUERY_OUTCOME.md).

See the [design, alternatives, official September 2026 research, and PR disposition](ARTIST_TRANSACTIONAL_ACTIVITY_DESIGN.md).
