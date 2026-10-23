# Concurrent media memory outcome

Completed October 23, 2026 on `main`. See separate
[design/reproduction](DEPLOYMENT_MEDIA_MEMORY_DESIGN.md),
[official research/tradeoffs](DEPLOYMENT_MEDIA_MEMORY_RESEARCH.md) and
[Docker outcome](LOCAL_DOCKER_DEPLOYMENT_MEDIA_MEMORY_OUTCOME.md).

## Delivered lane

`npm run validate:native-deployment-media-memory` retains the three preceding
deployment-memory cases and adds one real scan/inspection/encoding case. Both
fresh 2 GiB and 3 GiB profiles passed all four cases on rebuilt image
`sha256:e65fd0c8a2be6a3e4f190674d65614ffb713ded41e021b95d72dca1bc9be2e73`.
Each profile uses two CPUs, 256 PIDs, no additional swap, read-only root, UID 1000,
no external network/ports and disposable app/database tmpfs.

The new case uses 64 one-second tracks across FLAC, MP3, Opus and WAV, plus a
120-second, 96 kHz, 24-bit stereo PCM source. Actual FFmpeg 8.0.1 generates the
fixtures offline. The real scan worker uses guarded catalogue/tag persistence,
matching and reconciliation. Actual FFprobe inspection and FFmpeg Opus encoding
run through existing services and durable operation/lease stores. Candidate
selection and previews are controlled, not live acquisition/import eligibility.

The transcode path encodes to the null muxer as preflight and creates no converted
file. Every original file's hash and the complete original file set are checked
after worker completion. Generated Opus container bytes can vary, so each run
preserves its own source projection digest; this is not a matched-input performance
comparison. Other periodic jobs, HTTP serving, real provider accounts, populated
catalogues and bind-mount I/O behavior are outside the lane. Native adapters use
the real command implementation with observed spawn injection; runtime-monitor
listener behavior is not under test here.

Both final profiles proved:

- **64 catalogue rows and 64 parsed artist tags**, four successful inspections,
  one passed encode preflight and five normal native command closes.
- **Three completed runs, three captured released leases and zero active leases**.
  Released leases can retain future expiry; `released_at` is the release authority.
- A probe spawn while encoder close remained pending and the scan was active;
  then an artwork spawn while scan/encoder lifetimes still overlapped. These are
  separate observations, not simultaneous maximum CPU/memory evidence.
- At most two concurrent media-command lifetimes in this workload. FFmpeg used
  **four threads** under the two-CPU quota, reflecting current app configuration.
- Two real 8192² artwork jobs and provider-image TLS requests, two actual held
  PostgreSQL sort statements and a retained **256 MiB caller buffer**. Artwork
  reached one child at a time, preserved its expected hash and ended with zero
  reserved bytes.

## Recorded memory and limits

Values below are MiB, rounded to one decimal. This host uses cgroup v1, whose
usage counter is approximate. Kernel peak includes initialization, generation and
prior work through the recorded point. The media case runs before the three
preceding cases; later cases inherit its historical peak. Do not subtract peaks
to claim a component's cost or add overlapping process/category counters.

| Limit | Media sampled container peak | Kernel peak after fixture verification/cleanup | Node RSS sample peak | Observed headroom |
| --- | ---: | ---: | ---: | ---: |
| 3 GiB | 1419.3 | 1421.8 | 420.9 | 1650.2 |
| 2 GiB | 1403.4 | 1412.8 | 408.1 | 635.2 |

Corresponding kernel peaks were **1,490,882,560 bytes** and **1,481,388,032 bytes**.
Every final case retained zero limit-hit/OOM-kill counters; the unavailable v1
OOM-event count remains null. Physical usage, Node fields and the 2 GiB logical
artwork budget are separate observations. Tmpfs cache and source-hash verification
affect memory. No forced GC, peak reset, paused child or new memory setting was
used. The passing 2 GiB subset does not establish a general deployment minimum or
reserve its approximately 635 MiB of observed headroom for another job.

## Validation and corrections

**14 focused tests passed**: five native-observer cases, six existing memory/
database-cleanup cases and three runtime-resource cases. Negative tests refuse
missed overlap, a failed command after positive observation, absent artwork overlap
and late launches. Cleanup waits for actual close and preserves Error/null.

Each final native profile passed **four cases**. Repeated scopes overlap and are
not unique tests to sum. Scoped lint, Node baseline, copyright, ESM and repository
test hygiene passed. Both updated project skills passed the skill-creator validator
and include practical preflight, lease-release and idempotent-publication guidance.

Eight JavaScript files were frozen with 3,344 source files, fingerprint
`11cd7ecb309f69552862d769f01f0a146d16359edb5b76b42aa01be731ab4298`.
No production runtime code changed. All 901 server files, 11 shared files,
155 client artifacts, Node binary, 110 production npm versions and 151 APK
versions match the preceding image. Package metadata adds only the explicit lane;
lockfile/version are unchanged. Unrelated full server/client/script, browser and
PostgreSQL matrices were not repeated.

The combined suite exposed a fixture assumption: a later maximum-pixel job reused
an existing asset, bypassing an insert-only hold. The hold now applies after real
asset lookup and before file publication for new and existing assets. Final
combined runs exercise that repeated-asset path. This fixture-only correction
followed rebuilding; `test`/`testing` are excluded from the image. Final mounted
qualification source is verified separately from unchanged packaged runtime bytes.

An earlier assertion incorrectly counted future-expiry released leases as active;
it now checks captured released rows and completed status. Failed logs and initial
passing TAP with a runner post-processing error were retained privately, separately
from successful final command results. All owned qualification containers retired
with absence checked. GitHub MCP found no open PRs at selection and before
publication, so no applicable random/stale PR was implemented, rebased or closed.
No PR was merged. Work stays on `main`; no release, tag or version bump is created.

## Recommendation and next item

Retain container, artwork admission, native DATA, time and output bounds. Use real
run/lease owners and actual spawn/completion/close before publishing numeric
evidence. Keep thread count, process count and physical memory distinct. Do not
expose a memory slider or lower limits from this selected catalogue.

The [shared media admission follow-up](MEDIA_COMMAND_ADMISSION_OUTCOME.md) now
implements the app-owned FIFO and actual-close retirement across canonical
callers. It also records a supporting artwork phase deadline correction and new
constrained qualification. **Next:** propagate durable-worker cancellation through
readiness and media commands, retaining actual close and lease release. Admission
remains a count bound, not a whole-app memory ceiling or deployment minimum.
