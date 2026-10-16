# Recovery shared cohort research

Consulted 2026-10-15 through MCP search/open and GitHub repository metadata.
Installed Node 24.18.1/npm 12.0.2 and existing PostgreSQL 18 dependencies remain.

| Official source/status | Applicable practice | Project decision |
| --- | --- | --- |
| [Node 24 child processes](https://nodejs.org/download/release/v24.21.0/docs/api/child_process.html), maintainer documentation, opened 24.21.0 | close follows process end and stdio closure; exit alone can precede closed streams | Retain installed-compatible owned process adapter and output callbacks before parent reconciliation |
| [PostgreSQL 18 CREATE DATABASE](https://www.postgresql.org/docs/18/sql-createdatabase.html), versioned maintainer documentation | Cloning requires no other source sessions; database settings/permissions are not copied | Keep private sealed migration sources and explicit configured clone pools |
| [W3C High Resolution Time 3](https://www.w3.org/TR/hr-time-3/), Working Draft 2026-09-01 | Monotonic durations avoid wall-clock adjustments; separate executions have different origins | Reuse monotonic elapsed/span evidence without adding nested phases or changing domain clocks |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative security guidance | Exclude passwords, connection strings and sensitive identities | Retain private logs/control credentials; publish bounded counts/digests and preserve original Error/null |
| [Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints), maintainer documentation | Containers share host CPU; CPU quotas are ceilings and CPU shares do not reserve capacity | Keep disposable test containers; assess dedicated runner capacity separately from data isolation |
| [Testcontainers Node container lifecycle](https://node.testcontainers.org/features/containers/), maintainer documentation | Explicit reuse can share matching containers across tests | Retain one freshly owned parent per invocation and refuse cross-run reuse |

The allowlist and admission requirements are project engineering decisions
inferred from official contracts and local owner code. W3C's draft does not
endorse this fixture strategy or establish security/accessibility certification.

## Options, pros and cons

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep only five shared files | Existing measured scope | Execution/discovery keep separate fresh server startup costs | Retain historical evidence, expand only after audit |
| Seven audited files on one fresh parent | Amortizes startup while keeping file processes, private templates/databases and real commits | Larger parent failure scope and registration/close audit burden | Select with complete native signatures/release and both-order evidence |
| Allow arbitrary integration files | Less selection maintenance | Unregistered/raw resources and unreviewed workers can outlive file cleanup | Reject |
| Global concurrency/cross-run reuse | Potential wider savings | Adds contention, environment leakage and ownership changes | Defer |
| New registry/runner | Independent tuning | Duplicates mature identity/lifetime contracts | Reject |

## Dedicated test Docker environment

The current runtime already creates disposable PostgreSQL test containers with
random credentials and private scenario databases. It does not borrow the local
application database. A second Docker installation or permanent test database is
unnecessary for this isolation. The current cohort shares only a newly owned test
server within one invocation, then stops it after child and database cleanup.

Another container on this host would still contend for host resources. Limits
can bound consumption but cannot establish reserved capacity or diagnose the
observed startup stall. If repeated measurements remain blocked, prefer a
dedicated runner/host with measured capacity; evaluate VM resource allocation
when applicable. That is an operational follow-up, not an unmeasured quota or
deadline change in this comparison. Unrelated containers remain untouched.

Recommended stack: reviewed allowlist → one fresh parent → private file process →
reserved/committed OID → fresh template/clone/pool → actual worker completion →
strict release → child close/output drain → worker absence → parent reconciliation.

Opening GitHub MCP collection read found zero open PRs; refresh before commit.
See [design](RECOVERY_SHARED_COHORT_DESIGN.md) and
[outcome](RECOVERY_SHARED_COHORT_OUTCOME.md).
