# Local Docker backup journal failure outcome

October 25, 2026. Follows the [local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md).
See [design](BACKUP_JOURNAL_FAILURE_DESIGN.md), [research](BACKUP_JOURNAL_FAILURE_RESEARCH.md)
and [implementation/validation outcome](BACKUP_JOURNAL_FAILURE_OUTCOME.md).

Final image, built with a fresh disposable BuildKit builder and
`--pull --no-cache --load`:

`sha256:0c26a25c45f20371343b143611f4bb3afff979cca15d59b08b1740a8104e0236`

Baseline:

`sha256:16a1cecb3120342143bda2b64a405a583c91fc4f0e243c754cf505079fb0f119`

Six server modules differ: the new journal policy, shared filesystem failure
policy, shared redactor, journal service/store and system-module wiring. All other
server modules, all 12 shared modules and all 155 client files match. The final
image contains 941 server modules. Root package metadata, runtime versions,
110 npm packages, 151 APK packages and six actually loaded native binary hashes
match the baseline. Schema, dependencies, lockfile and version are unchanged.

Compose ran `up -d --wait --no-build`, then the existing-administrator bootstrap
helper. Authenticated readiness passed, and temporary password material was
removed. Existing administrator/data and all five actual bind sources/access
modes are preserved: `/app/data`, `/data/downloads`, `/data/music`, `/data/staging`
and `/data/transcode-temp`. The app is healthy at `http://127.0.0.1:47956`, with
loopback-only publication and a read-only root. Retained data was not reset.

Startup verified 115 applied migrations, zero pending and zero newly applied.
Runtime remains Linux amd64, UID 1000, Node 24.22.1/npm 12.0.2, PostgreSQL 18.6,
Sharp 0.35.5/libvips 8.18.7/libwebp 1.6.0.

The first build failed before compilation because Docker Hub's anonymous-token
host could not resolve. Its builder was retired, and the running image was not
replaced. Public DNS resolved on the subsequent check; a fresh builder then
completed the entire no-cache build. This does not establish the DNS failure's
cause. Failed and successful evidence directories remain separate.

Final journal and earlier producer native checks pass in separate disposable,
networkless, read-only containers with tmpfs databases (3 GiB/two CPUs). The
journal entry exercises actual permission failures, post-mutation catalog faults,
fresh composed recovery, held mismatches and error-only SQL state preservation.
The producer entry checks real filesystem failures and authenticated historical
diagnostics. Catalog fault injection is explicit; no power-loss/concurrent-owner
or successful full restore claim is made. No provider is contacted.

The owning outcome records the default fast-gate timeout, isolated HTTPS pass and
complete eight-worker server/client/script/build validation. Exact source/runtime
review retains unrelated native/media proof, 42 SQL checks, eleven recent browser
checks, nine earlier review browser checks and provider/file-backed evidence.
They are not new executions, and readiness is not transfer/import acceptance.

Builders, bootstrap, inventory/identity and native helpers were removed and
absence checked. Final logs/inventories/mounts/readiness/audit evidence are under
`.tmp/backup-journal-failure-final-2026-10-25/`; initial/diagnostic failures are
under `.tmp/backup-journal-failure-2026-10-25/`. No branch or release was created.
