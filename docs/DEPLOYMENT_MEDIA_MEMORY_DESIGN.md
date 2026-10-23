# Concurrent media memory qualification design

Decision date: October 23, 2026. Follows the media/scan item in the
[deployment outcome](DEPLOYMENT_MEMORY_OUTCOME.md). See separate
[research](DEPLOYMENT_MEDIA_MEMORY_RESEARCH.md) and
[outcome](DEPLOYMENT_MEDIA_MEMORY_OUTCOME.md).

Extend the explicit shared-container lane with a bounded synthetic catalogue:
64 short tracks across FLAC, MP3, Opus and WAV, plus a 120-second stereo PCM source
for actual FFmpeg encoding. Generate only owned fixture files under disposable
app storage. Record source hashes and assert they survive scanning/preflight.

Use the real scan worker, guarded catalogue/tag writers, matching/reconciliation
services and durable run/lease stores. Inspection and transcode workers use real
stores and FFprobe/FFmpeg; their candidate selection and previews are controlled
fixture inputs. This proves those execution paths, not live acquisition eligibility.
The current transcode path encodes into the null muxer as preflight. It does not
produce a converted media file; adding conversion is outside this qualification.

A test-only tag-stage gate coordinates scan lifetime with actual encoder/probe
spawn events. Require a started encoder awaiting close, a spawned probe and an active scan worker
before releasing the scan, plus a later artwork spawn while encoder/scan lifetimes
still overlap. These are two separate observations, not a claim that all four
components reached maximum work at one instant. Preserve actual command arguments, deadlines, output
bounds and normal stdio/process close. No synthetic delay or paused child is used
to claim native work. Lifecycle overlap does not establish simultaneous maximum
CPU use or simultaneous component memory peaks.

Compose these owners inside the existing artwork/caller-buffer/PostgreSQL memory
workload through one test-only companion callback. Keep the original three cases
as regression coverage. Use fresh 2/3 GiB containers, no external network/ports,
read-only root and disposable app/database tmpfs. There is no new deployed service,
privileged cgroup writer, runtime memory setting or production policy change.

Drain actual worker completions, lease release and native child close before
cleanup. Release held gates on failure while preserving original Error/null.
Refuse a missing/failed native-overlap observation. Project numeric counts, hashes,
version strings and separately scoped kernel/process/logical counters; omit source
paths, catalogue tags, SQL text, credentials and process dumps.

The catalogue is a selected four-format fixture, not a populated production
library distribution. Other periodic jobs, real provider accounts, storage I/O
behavior and large catalogue cardinalities remain outside the sizing claim.
Kernel peaks include initialization, fixture generation and earlier cases through
the recorded checkpoint; v1 usage remains approximate. Do not infer a whole-app
minimum or auto-tune admission from this evidence alone.

## Reproduce

Use the owned-container PowerShell command in the
[preceding design](DEPLOYMENT_MEMORY_DESIGN.md), retaining its read-only root,
disposable app/database tmpfs, two CPUs, 256 PIDs and equal memory/swap flags.
Add `test/native/deployment-media-memory.test.js` to its read-only source mount
list alongside `test/native/deployment-memory.test.js`. Invoke:

```text
node --test --test-concurrency=1 --test-reporter=tap test/native/deployment-memory.test.js test/native/deployment-media-memory.test.js
```

The in-container alias is `npm run validate:native-deployment-media-memory`.
It executes the three preceding cases and the new media case. Use a fresh
container for each declared 2/3 GiB profile, retain the log on failure and verify
removal of that exact container. Fixture generation, final source-hash verification
and earlier cases are part of the container's lifetime peak. Phase samples do
not establish an isolated cost for the media jobs.
