# Complete integration capability preflight design

Date: 2026-10-15. Scope: the opt-in coordinated integration command on main.

## Decision and alternatives

The previous complete invocation discovered a missing Docker CLI after 58
accepted files. A later startup test refused an opaque PostgreSQL image ID
because the existing logging policy requires a reviewed PostgreSQL 18 Alpine
reference. Both failures remain recorded in the coordinator outcome.

| Option | Advantages | Costs and limits |
| --- | --- | --- |
| Inspect image identity and OS only | Fast, no execution | Cannot establish installed binaries; already insufficient locally |
| Probe on the host or in the application container | Fewer temporary owners | Does not prove the selected images; adds inappropriate application authority |
| Fixed commands in disposable constrained owners | Proves executable/version in the selected bytes before PostgreSQL | Five short container lifetimes; Docker availability remains required |

Select the third option. Keep capability policy, owned probe lifetime, and
preflight orchestration in separate ESM files. Existing process, PostgreSQL,
schema, pool, resource, timeout and reporter owners remain unchanged.
The existing media transport deliberately permits only ffprobe and requires a
private media bind. The Linux socket proof owner deliberately requires its
socket/proof mounts. A small separate version-probe owner avoids broadening
either authority; it reuses the existing first-failure cleanup helper and their
acknowledged-ID/current-inspection pattern, without adding process termination.

## Admission and ownership

Validate the full canonical plan first. Require explicit local media and Linux
reader images and the existing reviewed PostgreSQL reference. Inspect all three
as Linux images. Preserve a supplied PostgreSQL digest reference, or derive a
digest-qualified reference from its actual local RepoDigests and verify that
reference resolves to the same ID. Opaque PostgreSQL IDs remain unsupported.
Pin media/reader children to inspected content IDs. Do not pull or build images.

Execute only postgres --version, ffmpeg -version, ffprobe -version, node --version
and docker --version. PostgreSQL must be 18; Node must satisfy the project's
24.15 minimum and major-24 ceiling. Docker/FFmpeg probes establish parseable
versions, not an arbitrary newly invented version minimum.

Each probe creates one container with a unique private label and acknowledged
complete ID. Verify its image, command and security configuration before start
and before cleanup. Use no network, capabilities, host mounts, Docker socket,
privileged mode or healthcheck; use a non-root user and read-only root. Refuse
unexpected image volumes before create. PostgreSQL's declared data volume is
covered by one bounded temporary filesystem so no anonymous volume is created.
No database server is started by these version commands.

Await attached command closure. On failure, timeout or cancellation, inspect
the acknowledged owner, stop if necessary, verify stopped/no active execs, and
remove it. Cleanup ignores the cancelled work signal. Unknown or changed
ownership never authorizes inferred-name deletion. Await cleanup before any
return; preserve original Error/null over secondary cleanup failures. An
uncertain create remains a refusal requiring diagnosis, never a cleanup guess.

Only a successful preflight returns an immutable copied environment. Retain
explicit resource/schema settings; strip inherited database authority using the
existing environment service. Publish only bounded versions and image IDs, not
raw tool output or Docker environment. --plan remains read-only with no Docker.

## Evidence and boundaries

Container-free controls cover policy, actual command sequencing, ownership
drift, held closure/retirement, first Error/null, cancellation and no database
admission after refusal. Native controls use both the known Node-only reader
and the correct reader. A fresh complete CLI invocation must cover the same
canonical inventory exactly once, zero skipped cases, with shared releases.
Record failed attempts separately; selected/composite evidence cannot substitute
for the requested fresh full invocation.

Recommended stack: existing Node 24 ESM orchestration; local immutable Linux
images with bounded owned probes; existing shared PostgreSQL owner only for its
reviewed seven files; isolated processes for every other file; native evidence
and monotonic timing; focused fast controls plus the complete opt-in command.
This is project test infrastructure guidance, not W3C or security certification.
