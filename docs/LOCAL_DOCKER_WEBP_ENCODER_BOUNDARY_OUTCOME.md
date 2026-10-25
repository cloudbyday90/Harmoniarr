# Local Docker WebP encoder boundary rebuild

October 25, 2026. Follows the applicable preserved-state steps in
[LOCAL_DOCKER_WALKTHROUGH.md](LOCAL_DOCKER_WALKTHROUGH.md). See separate
[implementation outcome](WEBP_ENCODER_BOUNDARY_OUTCOME.md).

## Rebuild and preserved state

Built with `--pull --no-cache --load` using a disposable builder, then started
Compose with `--no-build --wait`. Immutable local image:

`sha256:1a250054ba0aba04083cd14bfd1a30cb0089b29fe5489e2f672c83e89928eaec`

The app is healthy at `http://127.0.0.1:47956`; `/healthz` returns 200.
Authenticated readiness passes and bootstrap confirms the existing administrator.
All 115 migrations verify, with zero applied/pending. Provider attention conditions
remain; this is not a new live-provider acceptance run. All five actual bind
sources/destinations/read-write flags match: application data, downloads, music,
staging and transcode temp. Reset does not apply.

Linux amd64, UID 1000, read-only root and loopback-only port remain unchanged.
Runtime is Node 24.22.1/npm 12.0.2, PostgreSQL 18.6, Sharp 0.35.5/libvips 8.18.7/
libwebp 1.6.0. Builder, bootstrap helper and temporary password file retire.

## Runtime comparison and qualification

The 934 server modules include one added WebP policy module and the two expected
processing/accounting changes. The other 931 modules, 11 shared modules, 155 client
artifacts, 110 npm dependencies and 151 OS packages match the preceding image.
Client output matches the local build; root metadata/lockfile match current source.
An independent loaded-file comparison verifies all six Node/Sharp/native/runtime
library files against the original baseline and corrected diagnostic image.

The diagnostic image remains separate; GDB, strace, debug packages and tracing
configuration are absent from the deployed application. Native entries mount
frozen candidate source/tests and pinned inputs read-only against the rebuilt
runtime. Disposable profiles have no network, published ports or walkthrough data.
The walkthrough runs the independently compared built application. Results are in
the implementation outcome.

No release, tag or new branch is created. Next is an explicit low-memory WebP
capability/quality/runtime evaluation using the same fixed candidate.
