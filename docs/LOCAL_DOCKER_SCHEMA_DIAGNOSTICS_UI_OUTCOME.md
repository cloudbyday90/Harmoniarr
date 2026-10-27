# Local Docker schema diagnostics UI outcome — October 26, 2026

## No-cache image and preserved walkthrough

A fresh disposable Buildx builder using `--pull --no-cache --load` produced
`sha256:4d5147e24382811bf606af94563a81ceff11825341b3b322d617c7ae4ad9bbe1`,
replacing local baseline
`sha256:50d449db7c63f7e0f4a10eca673643fe2cd60e9bf49d28695124bf5f6a17733e`.
The builder retired and absence was checked. No image publication, release or tag
was created.

The existing application remains healthy at `http://127.0.0.1:47956`, with a
read-only root filesystem, Linux x64 Node 24.22.1 process and uid 1000. Existing
administrator login/readiness passed; bootstrap recognized that administrator,
its helper retired and temporary password material was removed. Startup verified
115 applied, zero pending and zero replayed migrations.

Administrator/data and all five inspected bind source/destination/RW records match
before and after: `/app/data`, `/data/downloads`, `/data/music`, `/data/staging` and
`/data/transcode-temp`. The existing downloads override was retained.

## Runtime and current evidence

The image contains 988 server, 156 client and 13 shared files. Exactly six expected
server files differ: app composition, route inventory, system module, system route
registration, the new route module and summary service. Other server/shared files
match the baseline. Fifty-six client output paths differ through the updated
bundle/import graph; the complete output matches the tested local build.
All 110 runtime npm and 151 OS package records, the entrypoint and six mapped
native binary/library identities match prior qualification. Root package metadata
and dependency versions are unchanged.

All three selected native fixtures passed and their containers retired with
absence verified: real administrator HTTP authorization/admission/privacy,
the 12-case underlying drift observer and concurrent observation with 20 reads /
three encrypted artifacts. The latter two retain their own resource retirement
proof. The configured data-bind probe removed its owned workspace.

Live status/checksum/lineage/structural CLI commands preserve complete ledger and
UUID-function identity. A real browser logged in as the existing administrator,
opened the updated section without a scan and explicitly refreshed current/164
data with no-store. Refresh focus survived; the actual mobile panel had no overflow.
The controlled browser cohort separately passed all three selected tests and its
desktop/mobile light/dark screenshots were reviewed.

The final audit binds the 3,685-file source fingerprint, 17 changed code files,
6,205 server / 4,501 client / 703 script tests, screenshots and immutable runtime
to this candidate. It verifies raw migration/snapshot/contract identity, resource
retirement and Markdown links. Private evidence is in
`.tmp/schema-diagnostics-ui-2026-10-26/` and is not committed.

## Retained scope

The preceding 17 snapshot and six preparation-serialization scenarios, seven
entrypoint preparation cases and 18 container-replacement checkpoints are
retained evidence, not reruns in this task. Their owning preparation, migration,
comparison, recovery, fixture and runtime dependencies remain byte-identical;
new HTTP/current-startup and concurrent-observation proof covers app composition.
No browser speech, physical-device or hardware power-loss claim is made.

See [validation design](LOCAL_DOCKER_SCHEMA_DIAGNOSTICS_UI_DESIGN.md),
[implementation outcome](SCHEMA_DIAGNOSTICS_UI_OUTCOME.md) and
[official research](SCHEMA_DIAGNOSTICS_UI_RESEARCH.md). GitHub found no open PRs,
including Dependabot PRs, to apply or clean up. All project changes stay on main;
no release or PR merge is involved.
