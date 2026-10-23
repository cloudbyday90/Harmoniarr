# Deployment memory qualification design

Decision date: October 22, 2026. Follows the deployment-sizing item in the
[aggregate outcome](ARTWORK_AGGREGATE_OUTCOME.md). See separate
[research](DEPLOYMENT_MEMORY_RESEARCH.md) and [outcome](DEPLOYMENT_MEMORY_OUTCOME.md).

## Measure the shared deployment

Add an explicit native qualification lane using one disposable instance of the
existing image and embedded PostgreSQL. It has no host data mounts, published
ports, external network or Docker socket. The existing app is not its target.
Require a declared Linux cgroup profile and a fixture-only database before any
database work. No production service, memory setting or admission limit changes.

Compose the actual application in the measured Node process, with real artwork
stores, fetch/ingestion services, native worker and file publication. Replace only
provider metadata and the transport's destination with a fixed local TLS fixture.
Keep the production DNS/public-address and TLS verification assertions. Periodic
workers and unrelated media jobs do not run: this is selected workload evidence,
not a benchmark of every production activity or an operator sizing guarantee.

Exercise ordinary provider images, maximum-pixel images and a 100 MiB download with independently
retained caller buffers and two actual PostgreSQL materialized-sort queries.
Hold database statements at a server-observed advisory lock before launching
artwork, then release and drain them during cleanup. Prove query/artwork overlap,
real saved asset/assignment rows, output hashes, original reservation settlement
and child close. Do not infer overlap from adjacent timestamps or fixed sleeps.

## Keep memory meanings separate

Read version-specific cgroup current/peak/stat/events, process RSS/heap/external/ArrayBuffer
observations and the logical artwork reservation counters separately. Require
finite numeric controls; missing controls fail qualification. Sampling must not
overlap or accumulate pending reads, and a sampling failure fails the lane.

Kernel peak covers the container's entire lifetime, including initdb, schema
preparation, fixture generation and previous cases. Phase sample peaks are sampled
observations. They cannot recover unobserved peaks or establish exact causal
increments. Never subtract historical kernel peaks to claim phase memory use.
`arrayBuffers` is included in `external`; v2 `shmem` is included in the file category.
For v1, usage is explicitly approximate, hierarchical category names are retained,
and the unavailable OOM-event counter is null. Failcnt and OOM kills are separate.
Do not add overlapping counters or sum PostgreSQL process RSS across shared pages.

Record PostgreSQL's actual buffer/work-memory/connection settings and distinguish
the fixed sort workload from real library query concurrency. Keep numeric evidence
and fixture hashes; omit credentials, source metadata, SQL text, host paths and
process dumps. Preserve original Error/null while attempting every owned cleanup.

## Decision after measurement

Use measured container headroom to describe only the executed profile. Retain the
2 GiB logical artwork policy and actual per-child DATA limit. Do not auto-tune from
free-memory snapshots or expose an operator slider based on a small corpus. Size
additional concurrent providers/media/database workloads before making a deployment
minimum or changing the built-in defaults.

## Reproduce the explicit lane

`npm run validate:native-deployment-memory` is the in-container command. It
deliberately refuses an ordinary host, an undeclared cgroup profile or a live data
mount. From the repository root in PowerShell, use one owned container per profile:

```powershell
$image = (docker image inspect harmoniarr:walkthrough-local --format '{{.Id}}').Trim()
if ($LASTEXITCODE -ne 0 -or $image -notmatch '^sha256:[a-f0-9]{64}$') { throw 'Resolve the validated local image first' }
$fixtureArgs = @('create', '--network', 'none', '--read-only', '--cap-drop', 'ALL',
  '--security-opt', 'no-new-privileges:true', '--user', '1000:1000',
  '--pids-limit', '256', '--cpus', '2', '--memory', '3g', '--memory-swap', '3g',
  '--shm-size', '128m', '--workdir', '/app',
  '--tmpfs', '/app/data:rw,nosuid,nodev,size=512m,uid=1000,gid=1000',
  '--tmpfs', '/tmp:rw,nosuid,nodev,size=256m,mode=1777',
  '--tmpfs', '/run/postgresql:rw,nosuid,nodev,size=32m,mode=0770,uid=1000,gid=1000',
  '--env', 'POSTGRES_DB=harmoniarr_memory_qualification',
  '--env', 'PGDATA=/app/data/postgres/18/data', '--env', 'HARMONIARR_MEMORY_PROFILE_GIB=3',
  '--env', 'HARMONIARR_ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000')
foreach ($relative in @('src/server', 'src/shared', 'testing/server',
    'testing/fixtures/provider-https', 'test/native/deployment-memory.test.js')) {
  $fixtureSource = (Resolve-Path $relative).Path
  $fixtureArgs += @('--mount', "type=bind,source=$fixtureSource,target=/app/$relative,readonly")
}
$fixtureId = (docker @fixtureArgs $image node --test --test-concurrency=1 --test-reporter=tap test/native/deployment-memory.test.js).Trim()
if ($LASTEXITCODE -ne 0 -or $fixtureId -notmatch '^[a-f0-9]{64}$') { throw 'Fixture creation failed' }
try {
  docker start --attach $fixtureId
  if ($LASTEXITCODE -ne 0) { throw 'Qualification failed; preserve its log' }
  $fixtureExit = docker inspect --format '{{.State.ExitCode}}' $fixtureId
  if ($fixtureExit -ne '0') { throw 'Fixture did not exit successfully' }
} finally {
  docker rm --force --volumes $fixtureId
  if ($LASTEXITCODE -ne 0) { throw 'Fixture removal failed' }
  $remaining = docker ps --all --quiet --no-trunc --filter "id=$fixtureId"
  if ($LASTEXITCODE -ne 0 -or $remaining) { throw 'Fixture retirement was not verified' }
}
```

For the second profile change both memory flags to `2g` and the declared profile
to `2`, using a fresh container. Keep all other workload and control settings the
same. The ordinary and maximum-pixel cases each publish two images; the maximum-
byte case publishes one. The public encryption key in this disposable command is
fixture-only; it is not a production secret. The fixture's public test VAPID material supports app
composition only; no notification is sent. Controlled metadata replaces a live
provider account, while actual image TLS still uses the public test CA and normal
certificate verification. It is not live-provider metadata acceptance evidence.
