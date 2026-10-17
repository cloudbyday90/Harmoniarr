# Automatic library-add media official research

Consulted: 2026-10-17 through MCP search and official navigation. Use actual
installed tool/image versions in the outcome, applying only stable Node 24 APIs.

| Official source and status | Applicable practice | Project decision |
| --- | --- | --- |
| [Docker run reference](https://docs.docker.com/reference/cli/docker/container/run/), runtime documentation | Read-only root and bind mounts are separate controls; Docker socket access grants daemon authority | Preserve the existing confined inspection transport and trusted local endpoint policy; generation keeps its required writable scope |
| [Docker container execution](https://docs.docker.com/engine/containers/run/), runtime documentation | Container networking and process configuration require explicit choices | Retain reviewed no-network execution and existing immutable image/tool preflight |
| [Node 24 child processes](https://r2.nodejs.org/docs/latest-v24.x/api/child_process.html), runtime documentation | Process close includes stdio completion, while exit may precede it; execFile avoids a shell by default | Reuse owned command/reader drainage and original failure handling; do not treat exit or a terminal job row as complete cleanup |
| [ffprobe](https://ffmpeg.org/ffprobe.html), tool documentation | Selected sections/fields and output writers define the inspection result contract | Keep the actual ffprobe arguments and complete result interpretation; do not narrow metadata or cache current inspections to obtain a faster result |
| [W3C High Resolution Time](https://www.w3.org/TR/hr-time-3/), September 1, 2026 Working Draft | Monotonic clocks support elapsed measurements within one execution domain | Keep scenario, close and command timing distinct; do not sum overlapping measurements or claim W3C conformance |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative security guidance | Minimize sensitive output and preserve operation behavior through observation failure | Publish only bounded counts/durations/cleanup state; retain raw paths, media metadata, credentials and assertion payloads privately |

The proposed reuse is a project inference, not a recommendation from these
standards to adopt a particular executor. Existing ownership and confinement
controls remain the authority. A local counterbalanced comparison can inform
this fixture's costs but cannot certify hosted Ubuntu capability or whole-suite
performance. Opening GitHub MCP discovery found no open PRs to apply locally.
