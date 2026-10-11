# First app-fixture checkout diagnostics

October 11, 2026, America/New_York. The [catalogue outcome](CATALOGUE_TEST_LIFECYCLE_OUTCOME.md)
retains two first-checkout failures whose underlying causes remain unreproduced.
This slice adds evidence at that boundary; it does not guess a shutdown fix or
change pool scheduling. Current primary guidance is in the separate
[research ledger](APP_FIXTURE_CHECKOUT_DIAGNOSTICS_RESEARCH_2026_10.md).

## Boundary and records

Use the existing `prepareDatabase({ getPoolFn })` injection, which passes that
factory only to snapshot bootstrap. A fixture-local connect-only adapter binds
the real pool's promise checkout. It observes only the first checkout in that
preparation scope; migrations and application services retain the original pool.
Do not patch `Pool.prototype`, the shared singleton, client release or SQL calls.
The returned client/error identity and native acquisition bounds remain.

Two narrow ESM files own record projection and observation/preparation. Default
`HARMONIARR_INTEGRATION_POOL_DIAGNOSTICS=failures` emits one bounded failed
checkout record. `all` also emits first-start/success for controlled investigation;
`off` disables observation. Reject invalid settings before fixture allocation.
Keep phase timing independent and correlate through the existing observer's
validated opaque correlation ID.

Record approved source/phase labels, pre-request/dispatched/settled pool counters,
selected numeric limits, observed driver closing flags, monotonic duration and
at most three approved error-class/code entries. Unknown/unreadable fields are
null. Never serialize error prose, stack, host/port, database/user, password,
connection strings, SQL, pool objects, client IDs or arbitrary error properties.
Observer/clock/sink failures cannot replace the original operation result/error.

`lastServerPhase=isolated_database_admitted` means the fixture already admitted
its scenario database. It is not a new server-health probe at failure time.
`ending/ended` are observations of the installed pg-pool implementation, not
public cleanup certificates. A successful checkout is not completed schema
preparation, query success or safe teardown. Native output streams remain separate
from this bounded diagnostic contract.

## Recommendations and tradeoffs

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Print full error/options/server logs | Immediate detail | Credential/SQL disclosure; reject |
| Increase timeout or retry | Can mask a transient failure | Changes evidence/semantics; reject |
| Probe another connection | New liveness observation | Extra I/O changes the investigated path; defer |
| Scoped first-checkout observer | Prompt safe cause/counter evidence | Small instrumentation overhead and interpretation limits; selected |
| Rework singleton shutdown now | Could prevent pool recreation | No reproduced causal evidence; defer |

Stack: existing pg pool and preparation APIs; narrow fixture-only projection/
observer; immutable bounded records correlated with phase timing; native checkout
controls and owning app-fixture consumers; complete fast validation after freeze.
No new runtime logger, release, branch or PR merge.

Verify client/error/throw-null identity, throwing getters/clock/sinks, cause cycles,
off/default/all modes, receiver binding and single observation. Native controls
must distinguish a saturated healthy pool from a refused TCP destination, retain
driver failures, and exercise both app-fixture entry points and cleanup. Focus
real database coverage on these owners and the original failing consumers;
whole-gate scheduling/performance remains a separate promotion task.
