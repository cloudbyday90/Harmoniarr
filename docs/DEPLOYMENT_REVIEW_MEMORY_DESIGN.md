# Mixed review and media memory design

October 24, 2026. Implements the next item from the
[read-scope outcome](QUALITY_REVIEW_READ_SCOPE_OUTCOME.md). Keep the deployed
application and its current memory controls; add a guarded, explicit qualification
lane rather than a second production service.

## Composition and bounds

Reuse the existing app/artwork/SQL memory workload, media fixture and scan/probe/
encode workers without changing their implementation. Serve that app's Express
listener on container loopback. Bootstrap/authenticate a disposable owner before
media launch, seed controlled quality-review evidence and use real detail GETs,
CSRF-protected restart POST, queue claims, exact lease owners and completion.
Synthetic failed acquisitions establish review state; they do not claim measured
provider/audio provenance. Existing media workers still inspect/encode real audio.

New narrow ESM helpers separate catalogue seeding, overlap/latency observation and
HTTP/owned-work orchestration. No route, schema, dependency, production admission
limit or operator setting changes. The new package alias is explicit native work.

The selected workload has two failed candidates, 4,096 failed file rows, 1,001 weak
alternatives and thirteen eligible choices. Bulk SQL setup verifies the resulting
counts. Navigate two incomplete 200-fact windows, twelve choices, the final choice
and reverse navigation. Restart the other target through checking, three actual
worker claims and queued status, retaining one audit/intent and final lease release.
Only that owned run's next-attempt time is advanced as a fixture scheduling control.

Review joins 64 real scan/tag files in four formats, four FFprobe inspections,
120-second source encoding to FFmpeg's null muxer, two maximum-dimension artwork
jobs, 256 MiB retained parent bytes and two actual 100,000-row PostgreSQL sorts.
Existing tag/SQL/publication gates coordinate lifetimes. Require an actual detail
response beginning and completing while scan and a spawned encoder remain active;
adjacent launch times or a probe alone cannot satisfy it. Preserve original files.
Lifecycle overlap does not establish simultaneous maximum CPU or component peaks.

## Evidence and retirement

Run a fresh container for each 2/3 GiB profile, two CPUs, 256 PIDs, equal memory/swap
flags, read-only root, no network/published ports and disposable data/database tmpfs.
The existing native guard refuses ordinary hosts/live mounts before a pool is
created. Verify PostgreSQL and the measured process share a cgroup. Record actual
database settings and pool maximum.

Keep cgroup lifetime peak, sampled current peak, process RSS/heap/external/
ArrayBuffers, logical reservations and individual operation durations separate.
Kernel peak includes startup, fixture generation and preparation. V1 usage is
approximate and has no fabricated v2 OOM-event counter. Never add ArrayBuffers to
external or sum overlapping PostgreSQL/shared-memory categories. Report bounded
samples, not latency SLOs or whole-platform sizing.

The observer admits at most 24 fixed operation labels. Retain no cookies, passwords,
paths, source metadata, SQL or process dumps in measurements. Reject unavailable
numeric evidence. Drain sibling work after failure; preserve the first Error/null
through timing and cleanup failures. Close the actual HTTP listener, log out, drain
the owned worker, native close and leases, then remove owned fixture storage and
verify container retirement. No review traffic reaches the preserved walkthrough.

## Reproduce

Use the isolated container controls and source mounts from
[the deployment design](DEPLOYMENT_MEMORY_DESIGN.md), adding read-only mounts for
`testing/integration/metadata-fixtures.js` and
`test/native/deployment-review-memory.test.js`. Invoke this entry alone in a fresh
container so previous cases do not inflate its lifetime peak:

```text
npm run validate:native-deployment-review-memory
```

Run each declared profile separately. The alias intentionally refuses an ordinary
host. The separate [outcome](DEPLOYMENT_REVIEW_MEMORY_OUTCOME.md) records actual
profiles, versions, measurements, qualification limits and follow-up.
