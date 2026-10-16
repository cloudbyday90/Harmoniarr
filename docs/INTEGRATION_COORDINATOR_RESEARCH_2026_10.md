# Integration coordinator research and recommendation

Consulted 2026-10-15 through MCP search/open and GitHub repository discovery.
Host: Node 24.18.1/npm 12.0.2. No dependency or engine upgrade is selected.

| Official source/status | Relevant contract | Project application |
| --- | --- | --- |
| [Node 24 filesystem glob](https://nodejs.org/download/release/v24.20.0/docs/api/fs.html), maintainer documentation | Built-in asynchronous glob is stable in Node 24; newer optional surfaces need version checks | Discover the same integration glob with installed-compatible options; canonicalize and validate every result |
| [Node 24 child processes](https://nodejs.org/download/release/v24.21.0/docs/api/child_process.html), maintainer documentation | Argument arrays and shell policy are explicit; close follows process termination and stdio closure | Reuse the pinned shell-free owned adapter and its separate output callback drain |
| [W3C High Resolution Time 3](https://www.w3.org/TR/hr-time-3/), Working Draft 2026-09-01 | Monotonic durations avoid wall-clock adjustments; separate executions have distinct origins | Reuse process-local monotonic elapsed measurements; do not add overlapping phase durations |
| [OWASP OS Command Injection Defense](https://cheatsheetseries.owasp.org/cheatsheets/OS_Command_Injection_Defense_Cheat_Sheet.html), informative security guidance | Separate executable/arguments and validate their meaning; shell escaping alone does not prevent argument injection | Discover contained test paths, accept no arbitrary CLI test options and reuse shell:false with a pinned Node executable |
| [Docker inspect](https://docs.docker.com/reference/cli/docker/inspect) and [running containers](https://docs.docker.com/engine/containers/run/), maintainer documentation | Inspect exposes object metadata; configured entrypoint/command determines execution | Image identity/OS is distinct from binary capability; verify the reader's Node and Docker CLI before a long collection |
| [PostgreSQL 18 LOCK](https://www.postgresql.org/docs/18/sql-lock.html) and [BEGIN](https://www.postgresql.org/docs/18/sql-begin.html), versioned maintainer documentation | Table locks require a transaction block; ordinary statements otherwise run in autocommit | Let the existing metadata store own its write transaction instead of passing an autocommit pool as a borrowed client in fixture setup |

These contracts inform the local design; exact coverage, credentials and strict
release requirements are project conventions. W3C's draft does not certify
test-runner security, accessibility or this orchestration strategy. No browser
interaction or HTTP mutation changes here require a new WCAG/ARIA flow.

## Options and tradeoffs

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Existing serial glob only | Established default and native output | Audited files still repeat server startup | Retain default as comparator |
| Opt-in coordinator using existing owners | Exact full-file coverage, bounded evidence and one fresh shared server for seven audited files | Grouped file order, stricter prerequisite refusals and larger shared failure scope | Select |
| Switch the default immediately | Immediate adoption | Unproved complete orchestration and prerequisite behavior | Defer until separate full-gate evidence/review |
| Share all files or increase concurrency | Potential larger savings | Unaudited raw resources/workers, contention and changed isolation | Reject for this slice |
| Permanent test database or new Docker engine | Independent operational configuration | Adds state/maintenance without reserving host capacity | Keep disposable current ownership |

Recommended stack: complete discovery → canonical exact-once plan → sanitized
environment snapshot → existing fresh shared parent → remaining isolated serial
processes → native root evidence → strict owner release/output drain → awaited
progress → verified complete result.

Opening and final GitHub MCP collection reads found zero open PRs; no random or
stale PR was available to implement/rebase, and no PR merge occurred.
See [design](INTEGRATION_COORDINATOR_DESIGN.md) and
[outcome](INTEGRATION_COORDINATOR_OUTCOME.md).
