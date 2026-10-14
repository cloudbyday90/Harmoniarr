# Owned media executor official research, October 2026

Consulted October 14, 2026. URLs were discovered through MCP search, opened through
the service and followed from official navigation. GitHub MCP search and repository
metadata supplied the pulls collection. Source status and host versions are
separate from consultation dates.

| Source/status | Applied practice | Benefit | Limit |
| --- | --- | --- | --- |
| [Docker bind mounts](https://docs.docker.com/engine/storage/bind-mounts/), platform documentation | Read-only accepted workspace; verify effective mounts. | Inspection cannot write fixture media. | Daemon/host path mapping differs on Desktop; submount and replacement behavior still needs proof. |
| [Docker none network](https://docs.docker.com/engine/network/drivers/none/), platform documentation | No container networking beyond loopback. | Isolates fixture execution from providers. | Does not replace command/path authorization. |
| [Docker Engine API 1.56](https://docs.docker.com/reference/api/engine/version/v1.56/), platform documentation | Its linked OpenAPI specification defines ExecIDs as running exec instances and Running as lifecycle state. | Supports explicit stopped-state/identity checks. | MCP discovered the specification link; a local download read the YAML after the renderer declined its content type. Host Engine is 29.8.2/API 1.56. Native inspect evidence verifies tested fields. |
| [Docker run](https://docs.docker.com/reference/cli/docker/container/run) and [exec](https://docs.docker.com/reference/cli/docker/container/exec), platform documentation | Read-only root, dropped capabilities, no privilege escalation; exec work belongs to its running container. | Narrows fixture authority and supports whole-owner retirement. | CLI search briefly failed; web search found these official pages and MCP subsequently opened them. These settings do not defend a compromised daemon or authorize arbitrary commands. |
| [Node 24 child processes](https://r2.nodejs.org/docs/latest-v24.x/api/child_process.html), runtime documentation | Await process/stdio completion and retain existing timeout/output limits. | Host command ownership and bounded output. | Closing or killing a Docker CLI is not proof that an in-container process stopped. Opened docs are 24.21.0; host is 24.18.1. |
| [W3C High Resolution Time](https://www.w3.org/TR/2026/WD-hr-time-3-20260901/), September 1, 2026 Working Draft | Separate monotonic executor/seed/service windows. | Stable scoped observations. | Draft, not a Recommendation or application certification; one pair is descriptive. |
| [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative guidance | Approved counts/states and safe original-failure records; no private output. | Useful evidence without leaking inspection metadata. | Raw stdout/stderr remains private; diagnostic failure cannot replace the primary failure. |
| [Testcontainers lifecycle](https://node.testcontainers.org/features/containers/), maintainer guidance | Review acknowledged startup/stop and exec ownership. | Existing repository lifecycle reference. | Installed exec adapter buffers unbounded output and offers no command deadline; reuse its guidance, not that exec implementation for this bounded owner. |

The executor is a project inference from those sources and actual installed code.
No source mandates a persistent container or permits skipping current inspection.

## Alternatives and final stack

Per-command containers remain a conservative comparator: simple lifetime, high
startup cost. A read-only inspection owner avoids repeated startup with a narrow
command contract but requires retirement and workspace retention after uncertainty.
A shared read-write generator/inspector or global reused container enlarges
authority/lifetime; defer it. Inspection caching removes current verification and
is rejected here. Recommend the narrow scenario owner only after native proof,
with generation unchanged and no cross-scenario reuse. Keep the resource policy
and existing guarded comparisons. See [design](OWNED_MEDIA_EXECUTOR_DESIGN.md)
and [outcome](OWNED_MEDIA_EXECUTOR_OUTCOME.md).

This is a Linux-container pilot on Docker Desktop. The accepted HostConfig mount
source is compared to the captured Windows root; effective mount destination and
read-only state are checked separately. Nonrecursive binding excludes submounts.
The local trusted image must provide sleep and ffprobe. Root identity and real
containment checks do not provide transactional protection against a malicious
host writer replacing paths between checks and execution. The workspace owner
and daemon remain trusted. W3C UI/HTTP guidance needs no UI changes in this slice.
