# Spectral reputation publication outcome

Recorded October 23, 2026. See the separate [design](SPECTRAL_REPUTATION_DESIGN.md),
[official research](SPECTRAL_REPUTATION_RESEARCH.md) and
[Docker outcome](LOCAL_DOCKER_SPECTRAL_REPUTATION_OUTCOME.md).

## Reproduction and implementation

The baseline actual Node consumer exited after completion committed and before
reputation recording. Its process/stdio closed; the job was done, pending count
zero and outcome ledger empty. A second real PostgreSQL control exercised the
canonical swallowed-ledger failure: snapshot failure count one, ledger zero.
Original source hashes and acknowledged fixture retirement are retained privately.

Confirmed apply-path spectral evidence now commits ledger event, snapshot
counter/history, cache and job completion together. The job UUID becomes the
existing ledger primary key and history identity. No table, migration, dependency,
outbox, new service or app version change was needed. Conflicting identities
refuse the transaction; completed claim replay cannot add another penalty.
Retroactive and non-penalizing classifications create no reputation event.

A new small publication-scope module gives each claimed invocation a unique
queryable facade. Strict evidence requires its current job authority; it cannot
reuse a native client or expired facade as permission. This is an internal
composition boundary, not a sandbox against arbitrary trusted JavaScript.

Shared snapshot SQL moved into a narrow store. Canonical ordinary outcome,
manual override, block, unblock and full replacement cooperate on transaction
admission before reading. Explicit READ COMMITTED preserves fresh state after
waiting. Borrowed spectral publication forwards the same owned queryable and
does not request another pool connection. A five-second local lock timeout bounds
individual lock acquisitions, not total request or rewrite time.

Outcome projection is a reusable policy module. Legacy injected in-memory
adapters retain their contracts, while strict spectral recording requires a
transaction-capable adapter. Legacy non-spectral ledger failure remains best
effort, now recovered through a savepoint so its enclosing snapshot transaction
can continue. This round deliberately does not claim atomic ledger durability
for non-spectral events.

Advisories start after commit. Spectral processing awaits their returned work;
legacy callers retain detached advisory behavior. Neither notification delivery
nor hidden descendants become durable or exactly once. An abort after commit
cannot undo the committed penalty.

## Validation evidence

Focused ownership, snapshot, trust, ledger and spectral tests passed **67 cases**.
The selected PostgreSQL run passed **33 cases**: fifteen new reputation cases,
two actual application fixture entrypoints, ten admission and six interruption
regressions. The reputation registrar includes:

- Actual consumer exits before/after commit, with server-side rollback retirement,
  recovery and completed replay yielding one event and one counter increment.
- Error/null after ledger INSERT, Error/null abort after evidence and actual SQL
  failures at cache, job and snapshot writes, proving no partial publication.
- Duplicate identity refusal, concurrent same/different peers, authentic/suspicious/
  inconclusive/retroactive exclusions and returned post-commit advisory drainage.
- Both admission orders for outcome, override, block, unblock and full replacement:
  ten actual lock handovers grouped into two scenarios. Independent observation
  avoids borrowing a third connection from the occupied two-client fixture pool.
- Legacy SQL ledger refusal recovered through a savepoint, preserving its existing
  snapshot-only policy. Full replacement intentionally replaces counters; its
  serialized order is tested without claiming it preserves replaced history.

The initial focused candidate passed 55/61 before ordinary result-reference and
test-adapter corrections; a later 60/61 candidate still lacked the cache-hit test's
explicit strict sink. The initial database candidate passed 14/15: its advisory
checkpoint was unreachable because that fixture had not enabled the advisory hook.
The corrected canonical module case exercises actual dependency wiring. Failed
candidates are retained separately and are not included in successful gate totals.

The stable full fast gate passed **11,045 tests**: 5,878 server, 4,470 client and
697 script tests, plus static checks and both builds. No cases failed, skipped or
were cancelled; selected listener/runtime/deprecation warning checks were clear.
The rebuilt image passed **15 reputation cases against packaged PostgreSQL 18.6**,
**ten admission cases** and **two native spectral interruption cases**. The latter
retained held Linux close/replacement protection and measured 188 frames before
actual FFmpeg cancellation, with both native commands closed and original bytes
unchanged. Owned native containers were removed and absence verified.

The native registrar shares database scenarios rather than duplicating assertions;
it remains outside the default fast glob and requires guarded disposable storage
before checkout. Isolated integration used cached PostgreSQL 18.3; it is separate
from packaged 18.6 proof. These are selected integration/native checks, not a new
complete integration run, allocation qualification or measured suite speedup.

The final 28 JavaScript artifacts were frozen before the full fast gate. The
3,380-file source cohort SHA-256 is
`4763603b0e01f7bc5e193eceddeb6690a333c87bda369668403b070a9197b52f`.
Code hashes and client artifact comparisons remained unchanged afterward. The
database cohort preceded whitespace/import-order normalization; the final packaged
registrar executed the frozen implementation. Both standards/testing skill
validators passed, and the new [atomic reputation reference](../.agents/skills/harmoniarr-web-standards/references/atomic-reputation.md)
records these concrete ownership and validation rules. No independent subagent
forward-test was performed.

## Recommendation and next work

Recommend same-database atomic publication, stable job/event identity, captured
claim scope and coordinated snapshot mutation, followed by advisory hooks.
Advantages are immediate durable consistency, normal rollback and existing app
infrastructure. Costs are serial snapshot mutations and the existing whole-set
JSON rewrite. Direct SQL, older/nonparticipating writers and intentional restore
remain outside an automatic preservation guarantee. Historical completed jobs
are not backfilled because their old events lack a reliable correlation key.

Next: inventory stable operation identities for non-spectral outcome producers,
then promote those paths from best-effort ledger recording to strict atomic
evidence. Their retained behavior is demonstrated by the savepoint test; changing
it safely needs replay identities for each producer. Separately, normalized
per-peer snapshot persistence could remove the full-rewrite bottleneck, but should
preserve operator overrides, restore behavior and the new ownership proof.

GitHub MCP returned no open PRs at selection and recheck. No random/stale PR was
available to implement, rebase or close; no PR was merged. Work remains on main,
with no release or tag. Private logs, hashes and fixture evidence live in
`.tmp/spectral-reputation-2026-10-23/`.
