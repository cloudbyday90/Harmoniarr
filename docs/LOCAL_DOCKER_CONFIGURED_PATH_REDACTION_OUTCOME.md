# Local Docker configured-path redaction outcome

October 25, 2026. Follows the [local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md).
See separate [design](CONFIGURED_PATH_REDACTION_DESIGN.md),
[research](CONFIGURED_PATH_REDACTION_RESEARCH.md) and
[implementation outcome](CONFIGURED_PATH_REDACTION_OUTCOME.md).

Final image, built with a fresh disposable BuildKit builder and
`--pull --no-cache --load`:

`sha256:880e40e38f31953ac99fa39dd5f3397c64f9d6feca179f135492c2259f407a4e`

Source/package comparison uses the original main baseline image:

`sha256:4e8633cee1f82847d3f77beca4cb2f3cd188b572a9ed8a6ed3789b73048daf3c`

An interim no-cache candidate (`sha256:d558a63b71c499dff40ac4f25224002fa55826fee4dbfb86f4724b0e58a5166a`)
preceded the final literal-POSIX-backslash correction. It is not final evidence.

Only four server modules differ from the original baseline: the new configured
matcher and the shared redaction, Recovery diagnostics and export services. All
other server files, all 12 shared modules and all 155 packaged client files match.
The final image contains 939 server modules. Root package metadata, Node/runtime
versions, 110 npm packages, 151 APK packages and six actually loaded native binary
hashes match the baseline. Dependencies, lockfile, version and schema are unchanged.

Compose ran `up -d --wait --no-build`, then the existing-administrator bootstrap
helper. Authenticated readiness passed; temporary password material was removed.
Administrator/data and all five actual bind sources/access modes are preserved:
`/app/data`, `/data/downloads`, `/data/music`, `/data/staging` and
`/data/transcode-temp`. The app is healthy at `http://127.0.0.1:47956`, with
loopback-only publication and a read-only root. Reset instructions were not used
against retained data.

Startup verified 115 applied migrations, zero pending and zero newly applied.
Runtime is Linux amd64, UID 1000, Node 24.22.1/npm 12.0.2, PostgreSQL 18.6,
Sharp 0.35.5/libvips 8.18.7/libwebp 1.6.0.

Two final opt-in packaged-runtime checks pass in separate disposable, networkless,
read-only containers with tmpfs databases (3 GiB, two CPUs). The new composed
HTTP test saves actual settings, reads Recovery/queue/download routes, verifies
unauthorized refusal/no-store, proves new roots apply after a save and confirms
durable error text is untouched. The existing artwork-admission diagnostics test
also passes with the updated redaction boundary and its real held gate/cached
process sample. No provider is contacted and no media work is launched.

The 11 host browser regressions and focused/full gate are recorded in the owning
outcome. The unchanged native/media workloads, 42 SQL checks, unrelated review
browser checks and controlled-provider/file-backed evidence are retained through
source/package comparison, not claimed as fresh executions. No new provider
transfer or import acceptance is inferred from readiness.

Builders, bootstrap, inventory/identity and native helpers were removed and
absence checked. Browser cleanup completed. Private source fingerprints, logs,
inventories, mount comparisons, readiness and audit artifacts live under
`.tmp/configured-path-redaction-final-2026-10-25/`; provisional records remain in
`.tmp/configured-path-redaction-2026-10-25/`. No branch or release was created.
