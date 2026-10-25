# Local Docker structured filesystem failure outcome

October 25, 2026. Follows the [local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md).
See separate [design](STRUCTURED_FILESYSTEM_FAILURE_DESIGN.md),
[research](STRUCTURED_FILESYSTEM_FAILURE_RESEARCH.md) and
[implementation outcome](STRUCTURED_FILESYSTEM_FAILURE_OUTCOME.md).

Built with a fresh disposable BuildKit builder and `--pull --no-cache --load`:

`sha256:16a1cecb3120342143bda2b64a405a583c91fc4f0e243c754cf505079fb0f119`

Preceding baseline:

`sha256:880e40e38f31953ac99fa39dd5f3397c64f9d6feca179f135492c2259f407a4e`

Only three server modules differ: the new filesystem failure policy, restore
apply and import apply-operation services. All other server files, all 12 shared
modules and all 155 client files match. The image contains 940 server modules.
Root package metadata, Node/runtime versions, 110 npm packages, 151 APK packages
and six actually loaded native binary hashes match the baseline. Dependencies,
lockfile, version and schema are unchanged.

Compose ran `up -d --wait --no-build` and the existing-administrator bootstrap
helper. Authenticated readiness passed; temporary password material was removed.
Administrator/data and all five actual bind sources/access modes are preserved:
`/app/data`, `/data/downloads`, `/data/music`, `/data/staging` and
`/data/transcode-temp`. The app is healthy at `http://127.0.0.1:47956`, with
loopback-only publication and a read-only root. Retained data was not reset.

Startup verified 115 applied migrations, zero pending and zero newly applied.
Runtime remains Linux amd64, UID 1000, Node 24.22.1/npm 12.0.2, PostgreSQL 18.6,
Sharp 0.35.5/libvips 8.18.7/libwebp 1.6.0.

Two final opt-in packaged checks pass in separate disposable, networkless,
read-only containers with tmpfs databases (3 GiB, two CPUs). The new producer
test proves actual restore-read/import filesystem failures and real persistence,
followed by authenticated historical diagnostics after a settings change. The
existing configured-root regression also passes. Neither contacts a provider or
claims full restore/apply-worker success. Native fixture scope is detailed in the
owning outcome; positive provider/file-backed evidence is retained, not rerun.

The final focused/full gate and enhanced Recovery browser check are recorded in
the owning outcome. Unrelated workload/native tests, 42 SQL checks, ten other
recent diagnostics/authority browser checks and nine earlier review browser checks
are retained through source/package review. They are not counted as fresh tests.
No transfer/import acceptance is inferred from authenticated readiness.

Builders, bootstrap, inventory/identity and native helpers were removed and
absence checked. Browser cleanup completed. Private fingerprints, logs, mount
comparisons, inventories, readiness and audit artifacts are under
`.tmp/structured-filesystem-failure-2026-10-25/`. No release was created.
