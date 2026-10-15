# Local media inspection API design

The measured next step from the [proposal](MEDIA_CONTROL_READ_API_PROPOSAL.md)
is an opt-in read adapter for existing scenario-owned media containers. This is
test infrastructure; application routes, SQL, hashing and acquisition policy do
not change. The original per-command default and owned CLI comparator remain.

## Boundaries and authority

`media-docker-endpoint-policy.js` resolves Docker's effective environment/context
once. A context environment override wins over a host override; otherwise an
explicit host wins over the selected context. Context inspection must acknowledge
the requested name and a local endpoint without TLS material. Windows named pipes
and absolute Unix sockets are the only accepted transports. Remote TCP/SSH,
cross-platform endpoints, TLS and explicit API-version overrides refuse before
image lookup or container creation. The captured CLI environment is pinned to
that endpoint, clears the context override and selects reviewed API 1.56.

`media-docker-inspection-reader.js` checks the pinned CLI server's Linux/API
capability, then privately compares its version/range and daemon ID against
versioned HTTP version/info reads. A mismatch grants no container authority.
This deliberately requires support for reviewed API 1.56, rather than guessing
that an older or future response contract is equivalent.

`media-docker-json-reader.js` owns one keep-alive agent and admits one GET at a
time. Its path allowlist permits only version/info bootstrap and inspection of
a complete 64-hex container ID. There is no arbitrary URL, POST, redirect,
compression, retry or automatic CLI fallback. Each request has a 30-second total
deadline, 16 KiB response-header limit and 2 MiB body limit. Complete UTF-8 JSON,
HTTP 200 and JSON content type are required. Early close, malformed/oversized
body, stalls and abort refuse. Failed reads destroy and await socket closure;
canonical close seals new reads, drains the admitted operation, destroys the
agent and awaits every owned socket's close.

The existing transport uses the same validation block for CLI and API JSON.
Image ID, random owner label, entrypoint/command/disabled healthcheck, network,
read-only root, restart/privilege/capabilities/security options and both declared
and effective mount/ExecIDs shapes remain current checks. Every actual ffprobe
still has before/after reads and running/no-active-exec checks. Image lookup,
create/start, exec, stop and removal remain bounded non-shell CLI operations.

The executor disposes its reader even when retirement fails, preserving primary
Error/null. A bootstrap failure before creation admission permits unchanged-root
cleanup after disposal. Unknown creation, changed ownership, failed retirement
or changed root keeps the workspace. HTTP success alone grants no cleanup.

## Selection and evidence

Use `--media-execution owned --media-inspection api` with explicit distinct/source
workloads and an existing local media image. Missing image refuses this API
selection before PostgreSQL startup. `--media-inspection cli` is the comparator;
the omitted selector also means CLI. `--media-diagnostics on` records version-two
snapshots with seventeen fixed phases. Five bootstrap categories distinguish
CLI context/version/identity reads from API version/identity reads; existing
inspection phase names now describe the selected reader's returned operation.
`docker_hybrid` distinguishes API reads from `docker_cli` summaries. Counts of
all phases are operations, not exclusively spawned CLI processes.

Keep private daemon IDs, endpoint paths, container IDs, mount paths, labels and
response/error payloads out of public artifacts. Preserve the existing exact
canonical result, receipt, digest, byte and work-count comparators. Selected
timings describe their captured process/seed/close scopes; they do not diagnose
historical timeouts or prove whole-CI improvement.

## Recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Existing per-command/owned CLI | Established lifecycle and broad platform behavior; useful comparator | Repeated host process/control overhead | Keep current defaults |
| Owned CLI mutations plus local API inspection | Removes repeated inspection CLI launches; preserves each current read | Bootstrap cost, version/platform policy and socket lifetime | Implement as explicit pilot |
| Full Engine API exec/lifecycle | Could remove more launches | Adds exec framing, cancellation and mutation authority | Defer pending separate evidence |

Prioritize correctness controls, then reversed-order small canonical selections,
then the previously incomplete largest noise selection and native Linux socket
proof before broader/default adoption. Do not increase pools/deadlines, remove
checks, cache media inspection or create a release to obtain a passing result.
Research and executed outcomes live in [separate research](MEDIA_INSPECTION_API_RESEARCH_2026_10.md)
and [outcome](MEDIA_INSPECTION_API_OUTCOME.md) documents.
