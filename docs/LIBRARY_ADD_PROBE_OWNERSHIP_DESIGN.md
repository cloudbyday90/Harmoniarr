# Library-add prerequisite ownership design

Date: 2026-10-19. Follow-up to the
[setup timing outcome](LIBRARY_ADD_SETUP_TIMING_OUTCOME.md).

## Boundary and implementation

Replace unbounded prerequisite execution with a narrow testing-only ESM command
owner. It observes the actual spawned process and stdio close, bounds output,
requests SIGKILL termination on timeout/cancellation. Preserve
the first Error/null through cleanup; exit or signal delivery alone cannot
certify close. No shell, detached helper window or arbitrary process ID is used.

The image-backed helper inspects the existing local image before creation,
requires a complete immutable Linux identity and no declared volumes, and binds
all subsequent work to that identity. Reuse integration-tool-probe for its fixed
ffprobe version command, acknowledged full container ID, per-owner token,
configuration validation and stopped-state/removal proof. Cancellation does not
abort create before its acknowledgement; cleanup uses uncancelled bounded
commands and never guesses an uncertain container identity. No image is pulled.

Use a 30-second termination deadline and a 2 MiB output cap, matching existing preflight
policy. Local ffprobe/ffmpeg version commands use the same close owner, serially.
Preserve null success and the existing bounded unavailable reason on failure;
no command or container failure can turn into successful availability. Keep
original failure identity inside owners and retain uncertain native artifacts.
The deadline requests termination; it never substitutes for actual close or
promises successful cleanup when the operating system/daemon cannot prove it.
The optional existing timing observer covers complete retirement as part of
media_version. Command work changes, so no equal-work speed claim is made.

## Options and recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Timeout the old docker run client | Small patch | Cannot prove remote retirement or safe cleanup target | Reject |
| Reuse acknowledged integration probe plus close-owned commands | Existing confinement/identity rules; bounded normal operations | More setup CLI work and adverse controls | Implement |
| New container owner | Tailored policy | Duplicates reviewed identity/cleanup code | Avoid |
| Cache verification, enlarge bounds or skip on ambiguous state | Faster apparent result | Weakens availability and ownership proof | Reject |

Recommended stack: close-owned bounded command, inspected local immutable image,
existing integration probe, actual uncancelled retirement, existing optional
phase observer and unchanged native application assertions. No production,
schema, scheduling, execution-default or release change follows from this work.
See [official research](LIBRARY_ADD_PROBE_OWNERSHIP_RESEARCH_2026_10.md) and
[outcome](LIBRARY_ADD_PROBE_OWNERSHIP_OUTCOME.md).
