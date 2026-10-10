# Audited shared PostgreSQL cohort adoption

October 10, 2026, America/New_York. Baseline main: `e1ce82a`.
The separate [official research](SHARED_POSTGRES_COHORT_ADOPTION_RESEARCH_2026_10.md)
was drafted before implementation; the [outcome](SHARED_POSTGRES_COHORT_ADOPTION_OUTCOME.md)
owns executed results rather than proposed acceptance.

## Problem and selected scope

Release reconciliation and tag snapshot tests use the isolated database runtime,
but their older readiness/resume/lease-release promises do not observe every
operation's actual settlement or cooperate with case cancellation. A worker can
finish before reaching a checkpoint; a failed assertion can leave held work active
while scenario resources close. Passing ordinary cases is not proof of that
adverse lifetime. Audit the owning paths before expanding the launcher allowlist.

Adopt the existing fixture lifecycle and observed scan-worker adapter. Keep all
original assertions, data variants, native case deadlines, real PostgreSQL locks,
rows and independently owned transaction clients. Do not change production
services, migrations, UI behavior, default complete scheduling or file concurrency.

## Ownership and narrow modules

One small ESM fixture-work module owns controlled gate release registration and
lazy direct-task admission. Register task completion before invoking its callback;
refused late registration or pre-aborted scope launches nothing. Signal-bound
gates reject with the accepted reason, including null. Register cleanup before
returning the gate. This is cooperative work, not universal SQL/I/O cancellation.

Each domain has a narrow fixture-worker module using
`startLibraryScanFixtureWorker`. It retains native service callbacks, acquisition
capture, downstream observations and the actual lease-release outcome. Register
completion before worker creation/start; race readiness against its settlement.
The observed completion is not permission to drop another database or signal a
reported worker PID. Parent capability/OID resource ownership remains unchanged.

Wrap each scenario callback in `withFixtureLifecycle({signal:t.signal})` inside
the isolated database and before workspace/database teardown. Track direct
reconciliation and lock-holder tasks before launch. Release controlled holds,
then await actual tracked worker/task settlement before closing the pool or
removing guarded test-owned files. Preserve primary failure over cleanup fallout.

The creation trace must cover `runIsolatedDatabase` -> temporary helper ->
parent reserve -> successful CREATE/current-role OID commit -> scenario pool ->
owned cleanup -> verified release. No raw Dockerized or manually created sibling
database is admitted by inference. Parent maintenance queries stay serialized;
independent lock participants keep separate clients.

Deferred lease finalizers belong to the fixture-work scope's `onAfterDrain`,
not sequential early gate release callbacks: a SQL release can wait for rows held
by the very transaction a later gate must unblock. `withRollbackFixtureClient`
rolls back and releases a checked-out lock holder even if either callback fails.
After failed BEGIN/ROLLBACK it discards the client through the documented pool
release API; removal/disconnection request is distinct from observed server-side
session/lock cessation. Existing owned database drainage supplies separate evidence.
An observer can use an explicitly paused holder's otherwise idle client after its
SQL checkpoint; it cannot overlap statements on that client or silently depend
on spare pool capacity. `withFixtureWorkspace` verifies its temporary-directory
target immediately after creation and removes it after realpath/work failure,
preserving the first failure and refusing unowned targets.

Native tag parsing keeps genuine parser failure persistence. Record fixture-hook
failure separately and reject at the write wrapper outside the parser catch;
generic cancellation/assertion errors must not become writable failed snapshots
or permit artwork/downstream effects. The fixture completion must expose that
original hook failure after the actual worker drains.

## Options and recommendation stack

| Choice | Benefit | Cost / limitation |
| --- | --- | --- |
| Existing lifecycle + narrow domain fixtures | Reuses proved lifetime boundaries; preserves production semantics | Explicit task/gate ownership must be complete |
| Named four-file serial shared-server profile | Amortizes startup while preserving per-file process and database isolation | Parent control/admission machinery and bounded cohort |
| Complete unchanged serial gate | Broad regression coverage and comparable native counts | Long final feedback cycle |
| Glob-wide sharing or more workers now | Potential throughput | Unknown resource owners/capacity; rejected pending evidence |
| Longer deadlines or fewer assertions | May hide symptoms | Does not repair ownership; rejected |

Recommended stack: Node ESM factories and native isolated runners; existing
cooperative fixture lifecycle/observed workers; fresh PostgreSQL databases/pools;
parent authenticated bounded control and current OID/role checks; phase evidence;
focused development tests followed by the complete final gate. Apply relevant
vendor contracts and OWASP practices; W3C/WHATWG/IETF govern applicable application
journeys separately. No new browser or accessibility conformance claim follows.

## Proof and measurement

Retain bounded red/green controls for unreachable readiness, rejected release,
pre-abort/late admission, failing startup and cancellation while held. Real
PostgreSQL proof must verify original transaction rollback/lock assertions, no
work after held cancellation, completed release before database teardown and
independent sibling data preserved. Don't weaken original deadlines or predicates.

Measure a four-file baseline before fixture edits through the same explicit
per-file native adapter and order as the eventual profile: Wanted, catalogue,
release reconciliation, tag snapshot. Use the same reporter flags and timing
setting. Compare normal counts, wall/startup/stop and registration phases; separate
cooperative fixture changes and host/cache variability from causal speed claims.
Only after complete ownership and passing unchanged cases expand the named
allowlist. Then run its public CLI, affected controls, and one stable complete
validation gate. No branch, release, tag, deployment or PR merge is authorized.
