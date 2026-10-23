# Shared media command admission outcome

Completed October 23, 2026 on `main`. See separate [design/reproduction](MEDIA_COMMAND_ADMISSION_DESIGN.md),
[official research/tradeoffs](MEDIA_COMMAND_ADMISSION_RESEARCH.md),
[artwork correction](ARTWORK_REWRITE_DEADLINE_OUTCOME.md) and
[Docker outcome](LOCAL_DOCKER_MEDIA_COMMAND_ADMISSION_OUTCOME.md).

## Delivered behavior

The app-owned media command service now shares the existing FIFO implementation
across tooling checks, inspection, preflight encoding and spectral analysis.
Built-in defaults are **two active commands, 16 waiting commands and a 15-second
queue wait**. Runtime configuration reports these numeric defaults. No operator
setting, new service, dependency, database migration or release was introduced.

Admission policy, request validation and native process execution are separate
ESM modules. Bounded string arguments are copied/frozen before queueing. Invalid,
already-aborted, full and expired requests refuse before spawn. Capacity errors
omit private arguments/paths; existing consumers retain their failed/unavailable
result contracts. Queue time is separate from execution time. Internal callers
can still explicitly disable the execution timer with zero; canonical callers
continue using positive deadlines.

Every returned child remains owned through actual process/stdio close. Child
error, exit, abort, output refusal, timeout and kill return do not release the
slot. First child Error/null survives later errors; escalation remains installed
while a live child needs termination. Synchronous spawn failure has no returned
child to drain. Optional diagnostic callbacks cannot orphan native work. The
existing allowlist, shell-disabled arguments and bounded output capture remain.

Concurrent qualification exposed an artwork rewrite-phase refusal. The supporting
correction allows ten seconds for rewriting within the unchanged 15-second child
deadline and existing 1 GiB DATA, input/output, count/reservation and pixel limits.
The separate artwork outcome records the private timeout control and retained
failed candidates; original generic failures are not retrospectively classified.

## Executed validation

- **72 focused tests passed**, covering the owning FIFO/process boundary, all
  canonical app wiring, media consumers and affected worker completion paths.
- Final `validate:fast` passed: **5,826 server, 4,470 client and 697 script tests**,
  static/lint/ESM/hygiene checks and both builds. The first fast gate also passed;
  it was repeated after the supporting runtime correction, not as a timing sample.
- **10 PostgreSQL worker-lifetime integration tests passed**, including actual
  controlled Node command close and durable finalization. Their isolated fixture
  used PostgreSQL 18.3; the packaged shared-container profiles below use 18.6.
- **Two Linux command cases passed** on the final image: actual exit before
  descendant-held stdio close, and all four actual FFmpeg/FFprobe consumers queued
  behind one owned fixture process. Five waiting codec/tool commands then execute
  serially through a one-slot control, preserve the original WAV and end at zero
  active/queued commands. The production default remains two slots.
- **18 artwork native checks passed** across seven lifecycle, seven corpus and
  four allocation/reservation cases, with their distinct declared profiles.
- Both project skills passed the skill-creator validator. The standards skill
  now routes to a practical native-command ownership reference.

These scopes overlap; they are not unique tests to add together. The Windows
descendant-pipe setup did not retain handles and was replaced by portable native
cancellation plus explicit Linux pipe evidence. Private runner failures and
provisional native failures remain separate from final passing command results.

## Shared-container memory

All **four cases passed in each fresh 3 GiB and 2 GiB profile** on image
`sha256:2cf5917edef018c3b4629b39d9ce7427a2bc5b84a4817515e003c294f4e3ad36`.
The selected concurrent case retains the 64-track four-format catalogue, real
scan/tag persistence, four FFprobe inspections, one FFmpeg null-output preflight,
two 8192² artwork jobs, actual provider-image TLS, two held PostgreSQL sorts and
a retained 256 MiB caller buffer. Encoder/probe workers now share one command
service. Each run recorded three completed runs, three released leases, zero
active leases and zero final artwork reservation.

| Limit | Sampled container peak, MiB | Kernel peak after fixture cleanup, MiB | Sampled Node RSS peak, MiB | Observed headroom, MiB |
| --- | ---: | ---: | ---: | ---: |
| 3 GiB | 1404.7 | 1413.7 | 422.0 | 1658.3 |
| 2 GiB | 1406.9 | 1409.7 | 409.9 | 638.3 |

Corresponding kernel peaks: **1,482,387,456** and **1,478,217,728 bytes**. All final
cases retained zero limit-hit/OOM-kill counters; the unavailable v1 OOM-event
count remains null. This host's cgroup v1 usage is approximate. Kernel peaks
include startup, generation, hash verification and prior work; later cases inherit
the media case's historical peak. Do not add overlapping process/category counts.

Overlap is actual lifecycle evidence, not simultaneous maximum CPU/memory. FFmpeg
uses four threads under the two-CPU profile. Preflight produces no converted file.
Controlled selection, 64 files and tmpfs exclude populated catalogue distributions,
real provider accounts, other periodic jobs and bind-mount I/O. Generated Opus
bytes vary between runs, so this is not a matched-input performance comparison.
The passing 2 GiB subset does not establish a deployment minimum or reserved RAM.

Fourteen JavaScript files and 3,349 source files were frozen with fingerprint
`52398111d906e3d0f5fde41fbb1393488dbd79861a3c69753d1d939e31c2b170`.
The final fast gate's production bytes match the final candidate. Subsequent
test-only diagnostic changes were scoped-linted and exercised by native lanes.

## Recommendation and next item

Retain container/artwork controls → one shared bounded command FIFO → per-command
time/output/input bounds → termination escalation → actual close and lease release.
The benefit is bounded aggregate commands and fair handoff. Costs include queue
delay, temporary unavailable results under saturation and potentially more rewrite
CPU inside the existing child deadline. Count limits do not isolate codec memory,
threads, descendants or unrelated PostgreSQL/Sharp work.

**Next:** propagate durable-worker cancellation through readiness checks and media
commands, proving queued cancellation avoids spawn and active cancellation retains
actual close plus lease release. Current canonical consumers do not uniformly
forward a signal; the command boundary alone does not prove whole-worker abort.
Broader operational measurements remain necessary before tuning defaults or
publishing deployment sizing guidance.

GitHub MCP found no open PRs at selection and before publication, so no applicable
random/stale PR was implemented, rebased or closed. No PR was merged. Changes stay
on `main`; lockfile/app version are unchanged and no release or tag was created.
