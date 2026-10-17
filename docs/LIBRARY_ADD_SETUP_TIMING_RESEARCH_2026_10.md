# Library-add setup timing official research

Consulted: 2026-10-17 using MCP search and opened primary sources. Host Node is
24.18.1; Docker Engine is 29.8.2/API 1.56. Apply stable APIs, not features inferred
from the current documentation's newer patch version.

| Primary source and status | Applicable practice | Implementation decision |
| --- | --- | --- |
| [Node 24 child processes](https://r2.nodejs.org/docs/latest-v24.x/api/child_process.html), runtime docs, currently 24.22.0 | Process close includes stdio completion; killed indicates signal delivery rather than termination; execFile avoids a shell by default | Await the existing returned commands; do not equate timeout/client exit with verified container retirement |
| [Node 24 performance](https://nodejs.org/download/release/v24.21.0/docs/api/perf_hooks.html), versioned runtime docs | performance.now yields process-relative high-resolution milliseconds | Reuse the existing monotonic observer; measure original operations through settlement |
| [W3C High Resolution Time](https://www.w3.org/TR/2026/WD-hr-time-3-20260901/), September 1, 2026 Working Draft | Elapsed measurements use a monotonic clock; values from separate executions need origin care | Publish durations and opaque correlations; distinguish nested timing from parent wall time; make no W3C conformance claim |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative security guidance | Exclude secrets and unnecessary sensitive data; observation failure must not disrupt normal behavior | Retain fixed phase labels/scalars and original results/failures; no command, credentials, private path or media payload output |
| [Docker run](https://docs.docker.com/reference/cli/docker/container/run/) and [attach](https://docs.docker.com/reference/cli/docker/container/attach/), runtime docs | CLI attachment and container execution have distinct lifetimes and signal behavior | Treat remote retirement as an owned container-state proof, not a consequence of terminating the local CLI |

The timing-first design is a project inference from these practices and the
previous variable comparison. Neither a draft nor informative guidance mandates
these exact phase names or certifies test speed. Opening GitHub MCP repository
discovery/PR collection found no open PR to select and apply locally.
