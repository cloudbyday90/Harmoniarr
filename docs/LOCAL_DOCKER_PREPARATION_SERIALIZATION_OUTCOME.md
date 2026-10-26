# Local Docker preparation serialization outcome

October 26, 2026.
See the separate [design](PREPARATION_SERIALIZATION_DESIGN.md) and
[implementation outcome](PREPARATION_SERIALIZATION_OUTCOME.md).

## Image and preserved deployment

A fresh disposable Buildx builder completed `--pull --no-cache --load`. The
builder was removed and absence verified.

- Before: `sha256:cf3f9171cae82e79093fa52ca1926b541e947688a1857c828e84d183b4007460`.
- Current: `sha256:f3a1b9c9c2398fb4bf39c6808c2a5d626a35131de150e6f3637b5e38df00a2c3`.
- Healthy at `http://127.0.0.1:47956`; read-only root, Linux x64, UID 1000.
- Existing administrator authenticated and readiness passed. Bootstrap helper and
  temporary password file retired. No user-data reset occurred.
- All five actual bind sources/destinations/read-write flags match before and
  after: `/app/data`, `/data/downloads`, `/data/music`, `/data/staging`,
  `/data/transcode-temp`.

## Runtime comparison

Six server files changed: preparation orchestration, migration orchestration,
snapshot bootstrap, migration status and the two new ESM ownership/store modules.
The image contains 972 server, 156 client and 13 shared files. Other server/shared
bytes and modes match baseline. Client bytes match baseline and the local build;
package metadata matches source. All 110 runtime npm and 151 OS package records
are unchanged.

Node remains 24.22.1, npm 12.0.2, OpenSSL 3.5.9 and undici 7.30.1; the Node
binary is unchanged. PostgreSQL remains 18.6. Historical SQL and the schema
snapshot remain byte-for-byte unchanged.

## Packaged qualification

The new serialization fixture passed all six native scenarios on the immutable
image without source overlays. It exercised max-1 ownership, three direct busy
entry points, two real busy CLI children, an actual lock wait across migration
commits, database isolation, backend termination, inherited ownership and lost
acquisition/unlock replies. Two acknowledged owned databases were retired with
absence verified, along with the fixture container.

The existing five-scenario transaction fixture, CLI readers/preparation, read-only
observation, startup recovery and direct fresh writer all passed and retired
their containers. The fresh writer applied 115 migrations and replayed zero
with unchanged ledger bytes. CLI coverage retained 12 reader cohorts, six startup
refusals, seven preparation refusals, normal pending upgrade and explicit failed
retry. Observation retained 20 concurrent reads during backup and restore without
schema writes. Live diagnostic commands preserved ledger/catalog identity at
115 applied migrations.

Six loaded native binary files matched the established baseline. Packaged
entrypoint bytes/modes matched source. The configured data-bind backup probe
passed and removed only its owned files. All seven production-entrypoint
preparation scenarios passed; their 15 containers and seven volumes retired with
absence verified.

All 18 process/container crash replacement checkpoints passed with production
startup and background services enabled. Every checkpoint verified exit 137
without OOM, WAL redo, same-volume recovery, pre-crash record preservation,
repeated recovery and current artifact/catalog state. Owned containers, probes
and matrix volume retired with absence verified. Hardware power loss was not
tested.

The frozen source passed 58 focused tests plus static checks, build, 6,174 server,
4,497 client and 700 script tests, with no gate failures/cancellations/skips or
production npm audit vulnerabilities. The full serial integration suite and new
manual UI/assistive-technology checks were not run. The development fixture's
incorrect status-after-disconnect assertion remains recorded separately from
the successful final native qualification.

Private local evidence is retained in
`.tmp/preparation-serialization-2026-10-26/`: frozen source/code hashes, focused
and complete gate logs, build/runtime comparison, native TAP/results and exact
retirement records. This is local validation, not a release evidence pack.
