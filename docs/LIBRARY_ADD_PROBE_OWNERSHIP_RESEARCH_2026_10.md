# Library-add prerequisite ownership official research

Consulted: 2026-10-19 using MCP search, repository metadata and opened primary
sources. Actual host Node is 24.18.1 and Docker Engine 29.8.2/API 1.56; the current
Node documentation is 24.22.0. Use stable APIs supported by the installed runtime.

| Primary source and status | Applicable practice | Project decision |
| --- | --- | --- |
| [Node child processes](https://r2.nodejs.org/docs/latest-v24.x/api/child_process.html), runtime documentation | Close follows process termination and stdio closure; killed indicates signal delivery, not termination | Await actual close after termination requests and preserve original failure |
| [Docker create](https://docs.docker.com/reference/cli/docker/container/create/), runtime documentation | Creation and start are separate; never-pull and read-only root controls are explicit | Reuse the existing acknowledged probe and validate confinement before start and cleanup |
| [W3C High Resolution Time](https://www.w3.org/TR/2026/WD-hr-time-3-20260901/), September 2026 Working Draft | Monotonic durations describe elapsed work within a clock domain | Keep setup/retirement timing descriptive; changed probe work is not an equal-work optimization or conformance claim |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative security guidance | Minimize sensitive data and keep logging failure from disrupting operations | Keep bounded phase records and unavailable messages; retain raw failure evidence privately |

These sources support the ownership design; they do not mandate these modules
or certify a security audit. Random PR evaluation is recorded separately in
[the PR outcome](OPEN_PR_46_LOCAL_EVALUATION_OUTCOME.md).
