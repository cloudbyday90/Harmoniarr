# PostgreSQL recovery rehearsal outcome

Implementation and verification date: September 11, 2026. Starting baseline: `a05cf59`.

## Result

Harmoniarr now has an executable full PostgreSQL dump/restore rehearsal for request ownership, reviewed collection decisions, retained provider work, encrypted settings, worker leases, and cancellation. A real custom archive round trip passed on PostgreSQL 18.6. The rehearsal also found and fixed automatic stranded-run recovery reviving cancellation-requested work.

The [design document](POSTGRES_RECOVERY_REHEARSAL_DESIGN.md) records the official September research, verified URLs, alternatives, security boundaries, and immutable PR heads. This document records the delivered behavior and evidence. Harmoniarr remains a Docker-first, Soulseek-native music library platform: provider metadata prepares recipient-owned requests and discovery work; a restored database does not itself establish that music acquisition or external transfers completed.

## Delivered implementation

The native ESM entry point, `scripts/validate-postgres-recovery.js`, delegates process execution, disposable runtime ownership, validation orchestration, and evidence projection to separate service modules. Request and operational fixtures have separate seed, store, service, and verification responsibilities under `testing/recovery/`. There is no new dependency, migration, CommonJS module, application restore route, or browser interaction.

The command generates its own data and encryption key, starts an owned local PostgreSQL container, bootstraps the repository schema snapshot, and checks all 97 stored migration checksums. Matching container tools create a full custom archive and restore it into an empty `template0` database. It compares 104 schema anchors and exact domain snapshots before invoking controlled continuation against fixture collaborators.

The runtime pins the registry-resolved PostgreSQL 18.6 image digest documented in the design, performs a bounded pull, rejects older minors and remote Docker endpoints, publishes only to loopback, and uses no host bind mount. Generated credentials stay out of arguments and evidence. The archive remains inside the disposable container. Bounded child processes, queries, connection closure, and verified container ownership govern failure and cleanup. Successful evidence requires verified cleanup.

Evidence accepts only fixed fields containing bounded counts, booleans, versions, image identity, and the archive checksum. CLI errors suppress raw SQL and subprocess details. Evidence paths must be new files; existing artifacts cannot be overwritten. Unsupported database, deployment-container, archive, image, and credential inputs are rejected before resource creation.

Repository Validation now includes an independent `validate-postgres-recovery` job and retains the sanitized JSON artifact for 14 days. The workflow's actual command passed locally. Hosted execution is a separate result to inspect after push.

## Cancellation defect and correction

Previously, automatic recovery of a running job with a missing or expired lease could clear its persisted cancellation request and return it to the runnable queue. Exhausting the retry budget could also record failure instead of the requested cancellation.

Both recovery updates now check the persisted cancellation field atomically in SQL. A cancellation request wins, including when it arrives after the service's initial scan: the job becomes terminally cancelled, retains its actor and request time, clears its worker claim, and receives a cancellation completion timestamp. Recovery reports `cancelledCount` separately from retries and failures. The explicit operator retry path remains responsible for clearing cancellation when a retry is deliberately requested.

Real PostgreSQL regression scenarios exercise cancellation arriving between scan and update for both available and exhausted retry budgets. They also prove that the resulting job cannot be claimed and that an explicit retry remains possible. Active foreign leases retain their existing exclusion behavior.

## Executed restore evidence

The final direct command passed at `2026-09-11T10:06:39.211Z`:

```powershell
node scripts/validate-postgres-recovery.js --evidence-path .tmp/postgres-recovery-final.json
```

| Evidence | Observed result |
| --- | --- |
| PostgreSQL server | `180006` (18.6) |
| Image identity | `sha256:d3e1620b530c944afa6e887d22eb899824da68e19c52024bf98f5220c88a65b2` |
| Generated archive | Custom format, 290,447 bytes |
| Archive SHA-256 | `5e92f0a7877d28d6083e9c3e0adbcacb6265a1ad75d1ba74b36cd0c18539f07c` |
| Schema continuity | 97 migration checksum records and 104 anchors preserved |
| Request ledger | Two requests, two collections, three reviewed decisions, nine provider-work records, one retained intent, six associated operation runs, and 12 audit records preserved |
| Controlled continuation | Four remaining work records resumed; two collections finalized; queued recovery reused; original decisions, recipients, and completed work preserved |
| Constraints and replay | Duplicate identities rejected, retained run protected, replay leaves the final ledger unchanged |
| External key | Original generated key decrypts the restored secret; absent and wrong keys fail |
| Operational recovery | Five runs preserved before recovery; two expired leases released; two cancellation requests become cancelled; one eligible retry queued; active lease and queued work preserved |
| Side effects | Zero provider network requests, zero acquisition operations, no workers started |
| Failed restore | Deliberate table collision aborts the transaction; only the original sentinel table and row remain |
| Cleanup | Owned container removed and absence verified before the artifact reports success |

The checksum identifies this particular generated archive; each run generates fresh identities and bytes. The retained host artifact contains verification results, not the database archive or its generated secrets.

## Validation

Validation passed on Node 24.18.1 and npm 12.0.2:

| Check | Result |
| --- | --- |
| `npm run validate` | Passed copyright, migration/schema policy, ESM, Compose policy, lint, test hygiene, all Node suites, and both builds |
| Server tests | 3,392 passed |
| Client tests | 4,194 passed |
| Script tests | 346 passed |
| PostgreSQL integration tests | 91 passed |
| Total Node tests | **8,023 passed; zero failures, cancellations, or skips** |
| Focused script safety tests | Nine passed; ESLint passed |
| Focused cancellation/dispatcher server tests | Ten passed |
| Focused operational PostgreSQL scenarios | Eleven passed |
| Focused request-continuity PostgreSQL scenarios | Two passed, including deliberate decision corruption rejected before continuation |
| Final isolated dump/restore command | Passed with evidence above |
| CLI help and unsupported archive input | Help succeeds; unsupported input safely rejects before Docker |
| `npm run validate:security` | Passed; zero dependency vulnerabilities reported |
| CI npm toolchain contract after final workflow adjustment | Passed; artifact upload explicitly includes the single sanitized file under `.tmp` |
| `git diff --check` | Passed |

No UI changed, so this slice adds no browser test or W3C interaction pattern. Existing native recovery controls and authorization remain the UI contract. Migration replay and immutable application-image checks retain their separate validation commands: comparing restored migration records is not replaying migration files.

## Recovery limits

This is generated-fixture proof of database continuity and controlled service behavior. It is not a restore of the operator's database, a production cutover, a packaged Harmoniarr image test, a PostgreSQL deployment upgrade, or a recovery-time/recovery-point measurement. The running deployment was not changed.

The app-managed [settings/wanted backup](BACKUP_RESTORE_DESIGN.md) still excludes the full request and runtime ledger. A real full database archive also contains authentication and session state and needs appropriate protection. This rehearsal intentionally suppresses ownership, ACL, and tablespace restoration; it does not prove recovery of deployment roles, grants, configuration, media volumes, or the operator's encryption key.

Before a real restored deployment resumes work, stop or fence the source workers, validate the protected destination and external key, review restored authentication state, and reconcile provider transfers and file operations that may have completed after the snapshot. These are application-specific consequences of the [PostgreSQL snapshot boundary](https://www.postgresql.org/docs/18/backup-dump.html), not claims that PostgreSQL requires all writers to stop for a consistent logical dump. A trusted archive matters because [restoration can execute source-controlled code](https://www.postgresql.org/docs/18/app-pgrestore.html). Physical backups plus WAL remain a separate choice for point-in-time recovery.

## Recommendations and final stack

| Priority | Next change | Pros | Cons / prerequisite |
| --- | --- | --- | --- |
| 1 | Page broad Music Queue reads and expose preparation progress | Keeps growing request lists responsive and makes retained preparation work understandable | Requires stable ordering/filter contracts, recipient-scoped queries, and accessible client-state coverage |
| 2 | Replay fresh-install and upgrade acceptance against an immutable candidate image | Verifies the packaged application, migration compatibility, and shipped tools | Requires a built candidate digest and an accepted baseline; native rehearsal evidence is insufficient |
| 3 | Capture live multi-page provider access evidence | Establishes actual account entitlement and current provider response behavior | Saved providers remain disabled in the discovered deployment; requires eligible configured access |
| 4 | Define and rehearse operator recovery cutover and external-state reconciliation | Extends database proof to keys, roles, media, sessions, and safe worker resumption | Needs explicit recovery objectives and an operator-controlled isolated environment |
| 5 | Evaluate guarded automatic collection continuation | Reduces repeated preparation actions | Depends on live provider evidence, quota bounds, cancellation, and preserved review decisions |

Recommended stack: Node 24 LTS, small native ESM factories with injected stores and clients, PostgreSQL for durable request and operation state, matching current-minor dump/restore tools, custom archives restored atomically into fresh targets, external protected encryption keys, and fixed-field evidence. Keep the generated rehearsal in CI and the real operator recovery procedure separate. Use existing Vue/native HTML controls with explicit labels and status feedback for the next UI work.

The next independent implementation item is **Music Queue pagination and preparation progress**. Start by measuring the current list queries, define deterministic server paging with recipient authorization applied before pagination, then add client navigation and progress without changing reviewed decisions or automatically starting acquisition.

September 11 follow-up: the [pagination outcome](MUSIC_QUEUE_PAGINATION_OUTCOME.md) implements this item in the canonical Missing Music workspace and external collection review. It records bounded cursor reads, preparation facts, validation, and the next immutable-image release gate.

## Open PR review

GitHub MCP refreshed all three open PRs and their complete patches. No applicable patch remained: #23 and #24 are superseded by newer locally pinned workflow actions; #40 moves only the controlled fixture to Node 26 while the platform remains on Node 24 LTS. The design records the verified links and immutable heads. No PR was applied, changed, or merged.
