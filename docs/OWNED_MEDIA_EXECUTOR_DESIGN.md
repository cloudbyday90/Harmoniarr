# Scenario-owned read-only media executor design

The [seed phase outcome](WANTED_SEED_PHASE_OUTCOME.md) measured forty retained
inspections in a largest selection. Each currently starts a fresh media container.
Introduce one lazy, scenario-owned read-only ffprobe container for this explicit
workload, retaining every actual inspection and all canonical guards. Generation
continues through the existing network-none per-command path.

## Ownership and security

Split ESM path/argument policy, Docker transport and executor lifetime. Pin the
existing local image to its inspected immutable ID. A successful create response
must acknowledge a complete container ID; never infer ownership from a name or
prefix. Bind only the accepted existing scenario directory read-only, disable
networking/restarts, make the root filesystem read-only and drop capabilities.
Override the application entrypoint with sleep and disable its inherited health
check, verifying both in effective configuration.
Validate the effective container configuration and immutable ownership on reads.
Restrict commands to the reviewed ffprobe JSON inspection argv and a contained
current regular file; preserve current root identity and decline symlink escapes.

Bound admission to the canonical preview's two simultaneous file inspections,
execute them serially and preserve the current thirty-second/output bounds.
Use argv, not string-built shell commands. A successful host CLI completion also
needs an owned container inspection with no active exec IDs. A failed/aborted
command seals admission, stops the entire acknowledged container, and verifies
stopped state before considering its process work quiescent. Close admission
before drainage; share one close promise and remove only the acknowledged stopped
container. No fallback/retry can turn a failed owned command into a passing one.

An unacknowledged creation or failed stop remains uncertain. The owning workload
must retain its workspace if executor cleanup cannot certify safe removal. Add a
current root-identity check after owner removal; a replacement workspace stays
retained even when the container is safely gone. Use a
narrow guard in the functional app fixture for each invocation, retaining
original Error/null through guard refusal. Other fixtures remain on their current
path; reusable-app adoption needs its own scope audit.

## Pilot and evidence

Forward an optional inspection executor through the first and later seed media
factories. The explicit distinct/source CLI records owned versus per-command
mode. Keep per-command as the default during this pilot; compare on one bounded
largest selection. Broader adoption requires real isolation, changed-file reinspection, nonzero
exit/timeout retirement, close/late-admission and canonical receipt/comparator
proof. Keep native controls separate from full-matrix performance claims.

Use `--media-execution owned` with `--distinct-bindings` or `--source-noops`;
`--media-execution per-command` preserves the comparator. When no media image is
configured, both selections retain the existing local-tool execution path. The
recorded mode is requested policy, not a claim that Docker ran. Ownership starts
lazily after command/path authorization. Close timing is a separate approved
seed phase; startup remains inside the first actual inspection. Only the owned
executor controls are shell-injected for a native timeout test; production argv
accepts the seven-argument ffprobe JSON inspection only.

## Tradeoffs and recommendation

Pros: one inspection-container startup per scenario, current commands still run,
and explicit failure ownership. Cons: state/cleanup complexity, stricter supported
argv/image contract and retained artifacts after uncertain cleanup. Retaining a
container does not authorize caching inspection, enlarging deadlines or parallel
fixture SQL. Recommended stack: accepted private root/image -> acknowledged
read-only owner -> bounded serial current inspection -> verified stop/drain ->
workspace removal. See the separate [research](OWNED_MEDIA_EXECUTOR_RESEARCH_2026_10.md)
and [outcome](OWNED_MEDIA_EXECUTOR_OUTCOME.md).
