# Strict shared PostgreSQL database release design

Date: 2026-10-15. Scope: shared empty-schema fixtures and their existing helper.

## Problem and selected change

The shared runtime calls `withTemporaryPostgresDatabase` without selecting its
existing strict cleanup policy. After a successful scenario, a failed pool end,
backend drain, database DROP or admin close can therefore resolve success. The
preceding server-stop fix addresses a different resource boundary.

Select `strictCleanup: true` at the shared runtime's empty-schema delegation.
Keep the ESM helper's existing cleanup owner and compatibility default. Template
clones and parent-owned fixtures already select strict behavior. No new service,
dependency, migration, timeout, retry or fixture mode is needed for this change.

## Contract and authority

The helper awaits pool close, backend drain, owned database DROP and admin close,
continuing later cleanup after a failure. A prior scenario/setup Error or null
remains primary; otherwise its first cleanup failure is returned. The functional
wrapper still attempts owned server stop and preserves that earlier failure.

Only acknowledged database creation grants cleanup authority. A failed CREATE
must not terminate sessions or drop an existing database with the same name.
Borrowing an external server grants no authority to stop it, change its roles or
touch unrelated databases. The existing parent OID/registration contract stays
intact. Strict propagation is not a new identity fence or proof that a failed
DROP eventually succeeded.

Database release and workspace quiescence remain separate. Existing app lifetime
owners drain actual returned database tails; workspace predicates still decide
whether app/media files are safe to remove. A database error does not grant file
deletion authority or erase a previously retained child.

## Evidence and efficient validation

Use a dedicated container-free contract file that composes the actual helper
with the shared runtime. Inject each cleanup-stage Error/null for both owned and
borrowed server paths. Prove all remaining stages execute, held final release
keeps completion pending, earlier failures survive, normal values are returned,
and failed creation grants no destructive authority.

For native evidence, use one fresh PostgreSQL owner and two isolated cases. Make
the actual DROP run under a temporary unprivileged role so PostgreSQL produces a
real permission refusal. One scenario succeeds; the other throws null before
cleanup. Hold the admin-close tail, verify pending completion and retained target
identity, then check exact rejection and continued sibling/server availability.
Only the test owner may separately reap its captured resources afterward.

Run the affected existing runtime/helper/app/workspace contracts, the prior
native stop-failure cases and normal template cases. Freeze JavaScript before
the complete fast gate. Avoid repeating unrelated media/scaling matrices.

See [official research and tradeoffs](POSTGRES_DATABASE_RELEASE_RESEARCH_2026_10.md)
and [executed outcome](POSTGRES_DATABASE_RELEASE_OUTCOME.md).
