# Local Docker WebP canvas rebuild

October 25, 2026. Follows the complete applicable preserved-state procedure in
[LOCAL_DOCKER_WALKTHROUGH.md](LOCAL_DOCKER_WALKTHROUGH.md), including no-cache
build, existing administrator bootstrap check and authenticated readiness.
See the separate [implementation outcome](WEBP_CANVAS_MEMORY_OUTCOME.md).

## Rebuild and preserved state

Built with `--pull --no-cache --load` using a disposable Docker builder, then
started Compose with `--no-build --wait`. Immutable local image:

`sha256:5129c00aa8f34deaff8d9d4ae580dc284556f7adea9f046bda08b25a98609f69`

The application is healthy at `http://127.0.0.1:47956`; `/healthz` returns 200.
Bootstrap confirms the existing administrator, and authenticated readiness passes.
Provider readiness still reports attention conditions; this is not a new live
provider acceptance run. All 115 database migrations verify, with zero applied
and zero pending. All five actual bind sources, destinations and read/write flags
match before/after: application data, downloads, music, staging and transcode temp.
Existing data is preserved; reset instructions do not apply to this run.

The container remains Linux amd64, UID 1000, read-only root, loopback port only,
Node 24.22.1/npm 12.0.2 and PostgreSQL 18.6. Sharp 0.35.5/libvips 8.18.7/libwebp
1.6.0 and the native/Node binaries are unchanged. The disposable builder,
bootstrap helper and temporary readiness password file were retired.

## Runtime comparison

Of 933 server modules, only `artwork/artwork-worker-memory.js` changes. The other
932 server modules, 11 shared modules, 155 client artifacts, 110 npm dependencies
and 151 OS packages match the preceding image. Client artifacts also match the
local fast-gate build. Root package metadata matches current source; script aliases
change without a version/dependency/lockfile change.

Native tests mount the frozen candidate source/tests read-only against this
rebuilt runtime. The built server output is independently compared with that
source; the walkthrough runs the built application. Disposable qualification
profiles have no network or published ports and do not use walkthrough data.
Final affected native results are in the implementation outcome.

No release, tag or new branch is created. The next qualification is the admitted
WebP boundary described in the implementation outcome.
