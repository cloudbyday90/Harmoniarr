# Local Docker schema drift outcome — October 26, 2026

## Image and preserved application

A disposable fresh-builder `--pull --no-cache --load` build produced
`sha256:50d449db7c63f7e0f4a10eca673643fe2cd60e9bf49d28695124bf5f6a17733e`,
replacing local baseline
`sha256:35b15ff5898fffb3dbe2498f1f3ec290575c806cde3e37e5802d989aedc8686e`.
The builder retired with absence verified. No image publication or release occurred.

The existing walkthrough is healthy at `http://127.0.0.1:47956`, read-only at its
root filesystem, running Node 24.22.1 on Linux x64 as uid 1000. Existing-admin
login/readiness passed; bootstrap recognized the existing administrator and its
helper retired. Temporary password material was removed. Startup verified 115
applied migrations, zero pending and zero migration replay.

Administrator/data and all five actual bind source/destination/RW records were
preserved: `/app/data`, `/data/downloads`, `/data/music`, `/data/staging` and
`/data/transcode-temp`. The existing downloads override was retained.

## Runtime and scope

The image contains 986 server, 156 client and 13 shared files. Only the seven
expected server modules differ: the new entrypoint, observer store/owner, drift
service/report policy and shared anchor comparison modules. Other server files,
client/shared bytes and all 110 runtime npm / 151 OS package records match the
baseline. Root metadata matches source; package changes only add the command.
Historical migration SQL, raw snapshot and expected anchor contract are unchanged.

The five native fixture groups selected for this change cover the new diagnostic,
the shared snapshot comparison, preparation serialization, existing migration CLI
readers and concurrent observation. Private detailed evidence is under
`.tmp/schema-drift-2026-10-26/`; it is not committed.

The previous 18 container-replacement and seven entrypoint preparation cases are
retained evidence from the baseline qualification, not reruns here. Their writer,
recovery, entrypoint, fixture, dependency and native-runtime identities are
unchanged; the comparison refactor is qualified separately through the snapshot
rerun. This distinction avoids presenting historical evidence as a new execution.

All five selected native groups passed on the immutable image and their containers
retired with absence verified. The new diagnostic fixture passed 12 cases and
retired its two databases/role. Snapshot passed 17 scenarios, preparation
serialization passed six, existing CLI readers passed 12 cohorts, and observation
retained 20 concurrent reads plus three encrypted backup artifacts. All six mapped
native binary/library hashes and the entrypoint match the baseline. The owned
configured data-bind probe retired. Live old/new CLI checks report current state
and preserve the complete ledger/UUID-function identity.

The final audit binds 3,674 source files, all 11 changed code files, static/build
results and 6,198 server / 4,497 client / 703 script tests to this candidate. It
checks unchanged history/artifacts, retained-evidence scope, resource retirement
and documentation links before committing all project changes on main. No PRs,
including Dependabot PRs, were open to apply or clean up.

See [validation design](LOCAL_DOCKER_SCHEMA_DRIFT_DESIGN.md),
[implementation outcome](SCHEMA_DRIFT_OUTCOME.md) and
[official research](SCHEMA_DRIFT_RESEARCH.md). No browser, manual AT/device or
hardware power-loss acceptance is claimed.
