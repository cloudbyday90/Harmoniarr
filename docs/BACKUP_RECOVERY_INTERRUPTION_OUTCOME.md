# Backup recovery job interruption outcome

October 26, 2026. Implements the next item from
[startup recovery](BACKUP_STARTUP_RECOVERY_OUTCOME.md). See the separate
[design](BACKUP_RECOVERY_INTERRUPTION_DESIGN.md),
[official-source research and tradeoffs](BACKUP_RECOVERY_INTERRUPTION_RESEARCH.md)
and [local rebuild outcome](LOCAL_DOCKER_BACKUP_RECOVERY_INTERRUPTION_OUTCOME.md).

The shipped worker now records `progressMayBeIncomplete` after stranded-run
recovery or an interrupted admitted page. The status module exposes only that
safe boolean, and the existing atomic Recovery message explains it. Current
unfinished and confirmation counts still come from the journal. No new endpoint,
deployment, migration, dependency or per-file accounting ledger was added.

The qualification demonstrated why that distinction matters: a worker was killed
after its first completed publication but before its batch checkpoint. After the
replacement finished, 29 files had recovered while the saved completion
observations recorded 28. The scan reported four unfinished entries, one needing confirmation.
It does not invent an exact historical total. Killing after a committed continuation
preserves the cursor and all 29 completion observations.

Seven isolated scenarios exercise actual PostgreSQL and native files:

| Scenario | Required result |
| --- | --- |
| Crash with open handle and held fsync-result delivery | Actual SIGKILL/close/backend retirement; active acquisition refuses takeover; real 30-second expiry then fresh-process recovery |
| Crash after publication, before saved batch observations | Completed file remains durable; replay caveat is true; live unfinished counts remain correct |
| Crash after committed continuation, before release | Exact cursor and observations survive; replacement resumes after actual lease expiry |
| Cancellation with held handle | No early lease release; handle closes before cancellation finishes; a later fresh job recovers remaining work |
| Replacement acquisition with held handle | Stale worker cannot complete its run or release the replacement lease; subsequent recovery succeeds |
| Maintenance with held handle | Work pauses safely, then resumes with the production pause delay after maintenance is released |
| Dispatcher/application-owner shutdown with held handle | Actual drain APIs remain pending until admitted work and close settle; later process resumes pending continuation |

Every scenario checks private file content, journal phases, 29 inventory entries,
four unfinished operations, one confirmation hold, no recreated missing tree,
released job leases and retired backend sessions. Owned children are drained before
exact fixture database/file cleanup; fixture-root absence is checked. IPC binds
finite case/run/process identities, enforces exact fields and bounded output, and
requires native close after termination. Bad identities, escaping roots, malformed
proof and protocol/output failures have focused refusal tests.

The fixture uses the packaged production modules with narrow injected boundaries.
The sync gate holds delivery after real fsync; it is not a stalled kernel syscall.
The live-takeover case deliberately expires its exact fixture acquisition; the
three crash cases separately wait for actual production lease expiry. A fixture
retry backoff of 1 ms avoids an unrelated retry delay after crash expiry; production
retry timing is unchanged. Shutdown proof covers the dispatcher and application
worker-owner APIs, not the entire production OS-signal/HTTP/database teardown chain.
No hardware power-loss durability or minimum memory requirement is claimed.

The controlled real-browser scenario verifies the caveat in the stable status
region, preserved refresh focus and a 390 px layout. Manual screen-reader and
physical-device checks remain deferred. Private evidence is under
`.tmp/backup-recovery-interruption-2026-10-26/`.

The stable fast gate passed 6,117 server, 4,489 client and 700 script tests, plus
lint, copyright, migration/schema, ESM, Compose and build checks. Nineteen focused
recovery/presentation checks and the real-browser regression passed. The final
immutable no-cache image passed all seven native worker cases, with actual
process/stdio close, file/lease/backend retirement and exact owned cleanup.
The packaged normal-startup check also passed, followed by all 18 automatic
container replacement cases on 19 production containers with background services
enabled. All owned containers, probes and the persistent test volume were retired
and absence verified. The preceding unexplained health HTTP 500 did not recur.

Runtime comparison verified the three changed recovery server modules and rebuilt
client against source. All other server/shared code, dependencies and mapped native
binary identities matched. The unchanged manual-backup filesystem, SQL/producer
crash and media/codec matrices were retained from the preceding qualification;
their owning implementations did not change. Current worker/status behavior uses
fresh native proof rather than inheriting those earlier results. No dependency
changes were made and npm audit reported zero vulnerabilities.

GitHub MCP checks found no open PRs in `cloudbyday90/Harmoniarr`; random local PR
implementation and stale-PR cleanup were inapplicable. Work stays on main with no
release, tag, PR merge or branch creation.

Recommended stack: existing durable queue → acquisition-fenced recovery worker →
pinned backup filesystem ownership → bounded journal/file reconciliation → live
journal counts and explicit replay status. This reuses the qualified authority
and deployment, while accepting that saved batch totals are observations. An exact
outcome ledger remains a separate product/schema decision.

Next recommended item: investigate and improve bounded, sanitized diagnostics for
readiness failures. The preceding qualification observed an unexplained HTTP 500
from `/healthz`; its cause remains unknown. Capture a safe failure reason and
attribution before changing readiness policy or blaming host load. Preserve fatal
schema/startup checks and keep internal paths/errors out of public responses.
