# Local Docker snapshot anchor outcome — October 26, 2026

## Image and preserved walkthrough

The disposable fresh-builder `--pull --no-cache --load` build produced:

`sha256:35b15ff5898fffb3dbe2498f1f3ec290575c806cde3e37e5802d989aedc8686e`

It replaced local baseline
`sha256:ebd7f3f396f5542dabfbc5544ee46df2460fdb91c2326605a52667dc8fdf36c9`.
The builder was removed and its absence checked. No image was published and no
release or tag was created.

The existing walkthrough is healthy at `http://127.0.0.1:47956`, with its read-only
root filesystem, Linux x64 Node 24.22.1 process and uid 1000. Existing-admin login
and readiness passed; bootstrap recognized the existing administrator and retired
its helper. The temporary password file was removed. Startup verified 115 applied
migrations, zero pending and zero replayed. Administrator and data were preserved.

All five inspected bind source/destination/RW records match before and after:
`/app/data`, `/data/downloads`, `/data/music`, `/data/staging` and
`/data/transcode-temp`. The existing downloads override was carried forward.

## Runtime provenance

The image contains 981 server, 156 client and 13 shared files. Eight expected
server files differ: four new catalog/contract modules, the JSON contract, the
existing anchor list, bootstrap and snapshot transaction policy. Other server
files and all client/shared bytes match the baseline and local build as applicable.
Root package metadata matches source; only script definitions changed.

All 110 runtime npm package records and 151 OS package records match the prior
image. npm 12.0.2, OpenSSL 3.5.9, undici 7.30.1 and PostgreSQL 18.6 remain unchanged.
The entrypoint matches source; all six mapped native binary/library identities
match prior qualification. The configured data-bind publication/readiness probe
removed its owned directory after verifying existing filesystem behavior.

## Native validation

All seven compiled-image fixture containers passed and retired with absence
verified: 17 snapshot scenarios, preparation serialization, migration transactions,
CLI readers, concurrent observation, startup recovery and a fresh migration-only
writer. The fresh writer applied 115 migrations without a snapshot, replayed zero
and preserved ledger-row hashes. Live migration/checksum/diagnostic commands
preserved the existing 115-row ledger and catalog identity.

The snapshot fixture uses ten deliberately missing/altered-anchor tails with
otherwise matching history. Every case refused before COMMIT, rolled back the
whole fresh schema/ledger and permitted reviewed retry after owner retirement.
All 17 acknowledged fixture databases retired. Real backend termination and
COMMIT dispatch/acknowledgement loss retained conservative recovery behavior.

All seven production-entrypoint preparation scenarios passed: incompatible
checksum/key/unknown/failed/missing history refused before DDL/application startup,
ordinary pending migration upgraded healthy, and failed work required explicit
reviewed retry. Their 15 containers and seven volumes retired with absence checked.

All 18 process/container replacement checkpoints passed on an owned persistent
volume with production startup/background services enabled. Each checkpoint
verified abrupt exit without OOM, old-container retirement, same-volume WAL redo,
HTTP/schema readiness, preserved pre-crash record, repeated recovery and current
artifact/catalog state. Containers, probes and matrix volume retired with
absence verified.

The final local audit checks frozen source/runtime identity, the 6,191 server /
4,497 client / 703 script fast-gate results, all native cohorts, unchanged raw
115-file migration history/snapshot, resource retirement and documentation links.
Private detailed evidence lives in `.tmp/snapshot-anchors-2026-10-26/` and is not
part of the commit. GitHub MCP found no open PRs to apply or clean up; all project
changes stay on main, with no release or PR merge.

See [implementation outcome](SNAPSHOT_ANCHORS_OUTCOME.md),
[research](SNAPSHOT_ANCHORS_RESEARCH.md) and
[validation design](LOCAL_DOCKER_SNAPSHOT_ANCHORS_DESIGN.md). This is local
qualification, not a release, hardware power-loss test or manual AT/device result.
