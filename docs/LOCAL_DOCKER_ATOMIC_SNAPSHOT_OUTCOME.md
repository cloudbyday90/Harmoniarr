# Local Docker atomic snapshot outcome

October 26, 2026.
See [design](ATOMIC_SNAPSHOT_DESIGN.md) and
[implementation outcome](ATOMIC_SNAPSHOT_OUTCOME.md).

## Image and preserved deployment

A fresh disposable Buildx builder completed `--pull --no-cache --load`; the
builder was removed and absence verified.

The final staged whitespace check caught an extra blank line at the extracted
renderer's EOF before any commit/push. That source-only formatting issue was
corrected; focused tests, the complete gate, no-cache build and packaged
qualification were refreshed against the normalized source. Earlier evidence is
retained separately under `pre-eof-normalization/` in the private evidence root.

- Before: `sha256:f3a1b9c9c2398fb4bf39c6808c2a5d626a35131de150e6f3637b5e38df00a2c3`.
- Current: `sha256:ebd7f3f396f5542dabfbc5544ee46df2460fdb91c2326605a52667dc8fdf36c9`.
- Healthy at `http://127.0.0.1:47956`; read-only root, Linux x64, UID 1000.
- Existing administrator authenticated and readiness passed. Bootstrap helper and
  temporary password file retired. No user-data reset occurred.
- All five actual bind sources/destinations/read-write flags match before and
  after: `/app/data`, `/data/downloads`, `/data/music`, `/data/staging`,
  `/data/transcode-temp`.

## Runtime comparison

Six server files changed: snapshot bootstrap, migration receipt policy and four
new ESM modules for the shared transaction protocol, renderer, snapshot plan and
snapshot execution. The image contains 976 server, 156 client and 13 shared files.
Other server/shared bytes and modes match baseline. Client bytes match baseline
and local build; root package metadata matches source. All 110 runtime npm and
151 OS package records are unchanged.

Node remains 24.22.1, npm 12.0.2, OpenSSL 3.5.9 and undici 7.30.1, with the same
Node binary. PostgreSQL remains 18.6. All historical SQL and committed snapshot
bytes remain unchanged. The development script now imports/re-exports the shared
renderer; its exact artifact output passes the existing snapshot check.

## Packaged qualification

The seven-case atomic snapshot fixture passed on the immutable image without
source overlays. It covers full-corpus visibility, backend termination, SQL and
lineage rollback, artifact refusal and actual COMMIT dispatch/reply loss. It
retired seven acknowledged fixture databases and its container with absence
verified. Full receipt-row hashes survive reviewed replay after a lost successful
commit reply.

The six-case preparation-owner, five-case migration transaction, CLI, observation,
startup recovery and direct fresh-writer fixtures all passed and retired their
containers. Fresh execution applied 115 migrations without a snapshot and replayed
zero with unchanged ledger bytes. CLI coverage retained 12 reader cohorts, six
startup refusals, seven preparation refusals, normal pending upgrade and explicit
failed retry. Observation retained 20 concurrent reads during backup and restore
without schema writes. Live diagnostics preserved the 115-row ledger/catalog.

Six loaded native binary files matched the established baseline. Packaged
entrypoint bytes/modes matched source. The configured data-bind backup probe
passed and removed only its owned files.

All seven production-entrypoint preparation scenarios passed; their 15 containers
and seven volumes retired with absence verified. All 18 process/container crash
replacement checkpoints passed with production startup/background services enabled:
exit 137 without OOM, WAL redo, same-volume recovery, pre-crash record preservation,
repeated recovery and current artifact/catalog verification. Owned containers,
probes and matrix volume retired. Hardware power loss was not tested.

The frozen source passed 75 focused tests plus static checks, build, 6,183 server,
4,497 client and 700 script tests, with zero final gate failures/cancellations/
skips or production npm audit vulnerabilities. The full serial integration suite
and new manual UI/assistive-technology acceptance were not run.

Private local evidence lives under `.tmp/atomic-snapshot-2026-10-26/`: frozen
source/code hashes, gate/build logs, inventories, native TAP/results and exact
retirement records. This is local validation, not a release evidence pack.
