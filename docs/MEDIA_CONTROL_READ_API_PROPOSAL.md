# Read-only media container inspection API proposal

This proposal is now implemented as an explicit local-only pilot; see its
[design](MEDIA_INSPECTION_API_DESIGN.md), [research](MEDIA_INSPECTION_API_RESEARCH_2026_10.md)
and [outcome](MEDIA_INSPECTION_API_OUTCOME.md). Broader/default adoption remains
separate. The original [transport phase evidence](MEDIA_TRANSPORT_PHASE_OUTCOME.md) identifies
twenty-five container inspection reads in a completed ten-inspection selection.
They took 3,433.852 ms of returned CLI time. A persistent local connection could
remove host CLI startup while preserving each actual current-state read.

Start with the container inspection read only. Keep image lookup, create/start,
ffprobe exec, stop and removal on the existing bounded CLI path. Split endpoint/
version policy, bounded HTTP reader and reader lifetime into ESM modules; provide
an explicit opt-in selector with CLI as comparator. No automatic fallback/retry
should turn a failed read into passing ownership evidence.

Resolve the effective Docker endpoint from acknowledged CLI context metadata and
explicit environment precedence. Support only reviewed local named-pipe/Unix
socket contexts initially; refuse unsupported TCP/TLS/SSH contexts before container
creation. Privately compare daemon identity/API capability against the CLI target,
never assume localhost, the default context or a version from documentation.
Own a per-scenario connection/agent; never enable an exposed unauthenticated socket.

Requests must be read-only, versioned and limited to the complete acknowledged
container ID. Bound total request lifetime and response bytes; preserve original
Error/null through abort, stream close and agent disposal. Validate every current
image/label/config/mount/network/running/exec field with the same policy. A
successful HTTP response alone does not authorize cleanup. Failure retains the
existing whole-owner retirement and uncertain-workspace contract; mismatch never
authorizes a guessed cleanup target.

Prove fragmented/oversized/malformed responses, stalled connection/body, early
close, abort, wrong daemon/owner and disposal drainage with controlled streams.
Then compare exact native CLI/API inspect results on the same acknowledged owner,
including stopped and active-exec controls. Retain changed-file reinspection,
read-only denial, real command-timeout retirement and canonical byte/receipt/
result guards. Collect reversed-order selected measurements before promotion.

Pros: targets measured read cost and avoids adding exec multiplexing authority.
Cons: context/platform handling, owned agent/stream cleanup, and benefit remains
unproved. Keep full exec/API lifecycle work separate; preserve pool/deadline policy,
generation isolation, main-only work and no release.
