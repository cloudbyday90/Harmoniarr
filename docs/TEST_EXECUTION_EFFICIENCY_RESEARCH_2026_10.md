# Test execution efficiency research

Client date: **October 10, 2026, America/New_York**. Consultation began at
13:24:41 UTC; host observation was 2026-10-10T09:24:40.9718562-04:00.
This read-only research supports the separate [design](TEST_EXECUTION_EFFICIENCY_DESIGN.md)
and [outcome](TEST_EXECUTION_EFFICIENCY_OUTCOME.md). The root owns implementation
and benchmarks; this reviewer ran no tests, PostgreSQL, containers or Git actions.

## Versions and primary sources

Observed host Node: **v24.18.1**. Lockfile Testcontainers and
@testcontainers/postgresql: **12.1.0**; installed Testcontainers also reports
12.1.0. No dependency, image or runtime upgrade is implied.

Fresh GitHub MCP discovery/navigation reopened the previously resolved Node
24.18.1 commit `9623d9ad85d37d2f0610ec4a82b48182cf2c6061`, discovered its
doc/api files through returned trees and verified src/node_version.h as
24.18.1. A floating Node24 page returned 24.21.0; it was orientation, not the
authority for installed-version controls.

Testcontainers repository/release metadata returned v12.1.0, published
2026-08-04T10:08:49Z, resolving to
`cdd8c898420c59747aa9390d97284e038e44e0fb`. Its returned tree supplied the
immutable documentation paths below. Publication and consultation dates differ.

| Discovered/opened primary source | Classification / applicable finding |
| --- | --- |
| [Node24.18.1 CLI source](https://github.com/nodejs/node/blob/9623d9ad85d37d2f0610ec4a82b48182cf2c6061/doc/api/cli.md) | Exact-version runtime documentation. --test-concurrency limits concurrently executed files. With process isolation disabled it is ignored and concurrency is one. --test-isolation defaults to process. |
| [Node24.18.1 test-runner source](https://github.com/nodejs/node/blob/9623d9ad85d37d2f0610ec4a82b48182cf2c6061/doc/api/test.md) | Exact-version runtime documentation. Files use separate child processes; disabling isolation puts them in one context where they can interact. This does not make concurrent scenarios in one app process safe. |
| [Node global setup control](https://github.com/nodejs/node/blob/9623d9ad85d37d2f0610ec4a82b48182cf2c6061/doc/api/cli.md) | --test-global-setup exists in this version, introduced v24.0.0 with early-development status. A module can provide globalSetup/globalTeardown; it is an option for a future explicit resource owner, not required by the current aliases. |
| [Testcontainers global setup](https://node.testcontainers.org/quickstart/global-setup/) and [12.1.0 source](https://github.com/testcontainers/testcontainers-node/blob/cdd8c898420c59747aa9390d97284e038e44e0fb/docs/quickstart/global-setup.md) | Library guidance illustrates one container owned by setup/teardown. Its Vitest-specific sharing API is not directly a Node test-runner API; adapt serializable connection coordinates deliberately. |
| [Container lifecycle/reuse](https://node.testcontainers.org/features/containers/) and [12.1.0 source](https://github.com/testcontainers/testcontainers-node/blob/cdd8c898420c59747aa9390d97284e038e44e0fb/docs/features/containers.md) | Library guidance covers reuse and explicit stop/removal. Explicit stop retains ordinary removal behavior; reuse flags alone do not provide run-scoped ownership or data isolation. |
| [Testcontainers configuration](https://node.testcontainers.org/configuration/) and [12.1.0 source](https://github.com/testcontainers/testcontainers-node/blob/cdd8c898420c59747aa9390d97284e038e44e0fb/docs/configuration.md) | Library/environment guidance. Cleanup and runtime availability are separate from isolation of database data; do not disable cleanup merely to gain speed. |

These are runtime/library documents, not a standard that certifies suite
independence, deterministic races, CI capacity or measured performance.

## Measured timings versus source inference

The completed warning-preserved wanted gate reports these Node phase durations:

| Phase | Seconds |
| --- | ---: |
| Server | 66.5546 |
| Client | 7.8882 |
| Scripts | 2.8773 |
| PostgreSQL integration | 960.6304 |
| Sum of Node phases | 1,037.9505 |

Integration was **92.6%** of that sum. This excludes static checks, npm/process
overhead and builds; it is not total validate wall time. The largest observed
integration suite was automatic library-add at 70.46s, followed by release
reconciliation at 42.97s and wanted publication at 41.31s. These are suite
durations, not measurements of container start or schema cost.

The root reports the latest serial gate exited 0 at 13:31:54 UTC with 9,659 tests,
including 335 PostgreSQL tests taking 1,123.4720s (18.72min), without the overlapping
client warning. The local parallel benchmark started at 13:32:51 UTC and was
pending when this ledger was saved. Do not attribute differences between gates
to one change without setup/query/teardown spans or claim an unmeasured speedup.

## Existing isolation and cost boundaries

package.json originally serialized integration files with --test-concurrency=1.
The existing runtime can use an externally configured PostgreSQL server or start
Testcontainers. Every scenario gets a separate temporary database; app scenarios
also get owned workspaces and ephemeral HTTP servers.

app-runtime changes process.env and the application global pool, then restores
and closes them. Keep process isolation and sequential scenarios within each
file. Race tests can still coordinate separate clients inside their one isolated
database; sequential fixture execution does not mean removing those races.

App-runtime scenarios already use snapshot bootstrap. The product's classified
source audit identifies **18 raw integration files** replaying migrations per
scenario. A broad static search finds 44 files mentioning applyPendingMigrations;
that reference count is not a count of full-chain executions. Do not claim every
scenario replays all migrations or replace dedicated migration/bootstrap tests.

The Testcontainers path creates/stops a runtime-owned container; external mode
does not own that server. A reuse option exists but cleanup still explicitly
stops the container. Container reuse alone therefore does not remove repeated
lifecycle or schema work. Source inspection identifies possible costs; only spans
can quantify startup, fresh-database creation, bootstrap, application startup,
test work, race waits and cleanup.

## Recommendations and tradeoffs

1. Use focused domain tests while changing code, with real PostgreSQL whenever
   SQL owns the invariant. Inspect warnings and source/caller boundaries before
   the final full gate. Avoid overlapping repeated expensive database groups.
2. Use validate:fast for complete static/unit/client/script/build feedback. It
   excludes PostgreSQL and cannot certify transactions, locks or rollback.
3. Keep the complete population in the final gate. A temporary validate:parallel
   prototype combined fast checks with two isolated PostgreSQL file workers.
   It exposed failures and was not promoted; those prototype aliases were removed.
   Retain validate/test:integration and the explicit serial alias at one. This
   machine has not measured CI capacity; the outcome owns the actual experiment.
4. Instrument lifecycle spans before the next architecture change. A run-owned
   PostgreSQL service, with fresh scenario databases and workspaces, can amortize
   container startup while retaining data separation. Share connection coordinates,
   not a client, mutable database, process globals or test application instance.
   The owner must handle cleanup; each child must only drain/drop its own database.
5. Consider versioned pristine database templates only after lifecycle ownership.
   Cache identity must include schema/migrations/bootstrap inputs, and clones must
   not copy mutable scenario data or workspace-specific configuration. Preserve
   dedicated from-empty migration and snapshot-equivalence proof. Template speed
   remains unmeasured and requires its own design.

Start with two file workers, not an unbounded CPU-derived PostgreSQL population.
Do not parallelize app scenarios in one process or switch to isolation=none:
it weakens current global-state separation and does not enable file concurrency.
Keep deterministic wait observations and barriers in race tests; capacity changes
must not turn positive controls into accidental expiry tests or replace adverse
proof with larger blind sleeps. No container sharing, template caching, test
removal or CI-default change is claimed as implemented here.

## Evidence limits

Installed versions, retained logs and source/helper inspection were read-only.
The root's authored design and fast/serial aliases are implementation evidence;
the rejected parallel aliases existed only for the recorded experiment.
No benchmark or PostgreSQL operation was executed by this reviewer; the outcome
ledger owns measured serial/parallel results. Local throughput does not establish
CI resource capacity, universal deadlock freedom or production performance.
Raw primary-source discovery, immutable files and timing/source observations are
retained under .tmp/test-execution-efficiency-2026-10:

| Evidence | SHA256 |
| --- | --- |
| official-sources.json | da090ef5cb1dd17dbd2904666834c0039ba721c644d2f2a20dd9e5dd25ff0533 |
| runtime-and-timing-observations.json | 6021f7fd014a8cb0691e02df64d3b834709e41b6632b2cf46ede775c4f9f12a9 |
