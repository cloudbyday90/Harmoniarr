# Local Docker migration transaction outcome

October 26, 2026. See the separate
[implementation outcome](MIGRATION_TRANSACTIONS_OUTCOME.md) and
[design](MIGRATION_TRANSACTIONS_DESIGN.md).

## Image and preserved deployment

The successful build used a fresh disposable Buildx builder with
`--pull --no-cache --load`; the builder was removed and absence verified.
The first build attempt failed resolving Docker's registry CDN before compilation.
Its logs and builder-retirement record were retained. Host/container DNS and the
frontend pull then succeeded; the same frozen source built successfully without
Dockerfile, dependency or test changes.

- Before: `sha256:92204831fecb437961082293b8b08f7e42d4b8d1f377fee3d70e701ae7a5537c`.
- Current: `sha256:cf3f9171cae82e79093fa52ca1926b541e947688a1857c828e84d183b4007460`.
- Healthy at `http://127.0.0.1:47956`, read-only root, Linux x64, UID 1000.
- Existing administrator authenticated; readiness passed; bootstrap helper and
  temporary password file were retired. No data reset occurred.
- All five actual bind sources, destinations and read/write flags matched before
  and after: `/app/data`, `/data/downloads`, `/data/music`, `/data/staging`,
  `/data/transcode-temp`.

## Runtime comparison

Five server files changed: the migration orchestrator and four new ESM modules
for lexical slicing, transaction policy, transaction execution and ledger writes.
The image contains 970 server, 156 client and 13 shared files. All other server
and shared bytes/modes match the baseline; client bytes match both baseline and
the local build. Root package metadata matches source. All 110 runtime npm and
151 OS package records are unchanged.

Node remains 24.22.1, npm 12.0.2, OpenSSL 3.5.9 and undici 7.30.1; the Node
binary is unchanged. PostgreSQL remains 18.6. No dependency, schema snapshot or
historical migration SQL changed.

## Qualification

The new packaged-runtime transaction fixture passed all five real PostgreSQL
scenarios, including the two protocol COMMIT cuts. Its container retired with
absence verified. The packaged CLI, observation, startup recovery and direct
fresh-writer fixtures also passed and retired their containers. Fresh execution
applied all 115 migrations and replayed zero with unchanged ledger bytes; the
acknowledged fixture database was dropped and absence verified.

CLI coverage retained 12 reader cohorts, six startup refusals, seven preparation
refusals, normal pending upgrade and explicit failed retry. Observation retained
20 concurrent reads during backup and restore without schema writes. Live
migration/checksum/diagnostic commands left all 115 ledger rows and catalog
identity unchanged. Six loaded native binary files matched the established
baseline; packaged entrypoint bytes/modes matched source. The configured data-bind
backup probe passed and removed only its owned fixture files.

All seven production-entrypoint preparation scenarios passed, including ordinary
upgrade and explicit retry on the same owned volume. All 15 containers and seven
volumes were removed with absence verified. The full 18-checkpoint container
replacement matrix passed with production startup/background services enabled:
exit 137 without OOM, WAL redo, same-volume recovery, pre-crash record verification,
repeated recovery and current artifact/catalog verification. All owned containers,
probes and the matrix volume retired. This tests process/container crashes, not
hardware power loss or filesystem durability beyond the measured environment.

The frozen source passed static checks, build, 6,166 server, 4,497 client and
700 script tests; the focused set passed 50. No gate failures/cancellations/skips
or production npm audit vulnerabilities were reported. The full serial
integration suite and new manual UI/assistive-technology acceptance were not run.
The initial native development failure and registry DNS build failure remain
recorded separately from successful final qualification.

Private local evidence is retained under
`.tmp/migration-transactions-2026-10-26/`: frozen source/code hashes, gate logs,
build and inventory records, native TAP/results and exact retirement records.
These private artifacts are not a published release or CI evidence pack.
