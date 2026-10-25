# Local Docker admitted WebP rebuild

October 25, 2026. Follows the applicable preserved-state steps in
[LOCAL_DOCKER_WALKTHROUGH.md](LOCAL_DOCKER_WALKTHROUGH.md). See the separate
[qualification outcome](WEBP_ADMITTED_BOUNDARY_OUTCOME.md). The strict WebP
publication failure remains separate from passing containment checks.

## Rebuild and preserved state

Built with `--pull --no-cache --load` using a disposable builder, then started
Compose with `--no-build --wait`. Immutable image:

`sha256:df9a8b4042683f70b8791e9a802dfa1568dc42ba7b2bea8baf3a4c59d4df050d`

The app is healthy at `http://127.0.0.1:47956`; `/healthz` returns 200.
Authenticated readiness passes, bootstrap confirms the existing administrator,
and all 115 migrations verify with zero applied/pending. Existing provider
attention conditions remain; this is not new live-provider acceptance evidence.
All five actual bind sources/destinations/read-write flags match before/after:
application data, downloads, music, staging and transcode temp. Reset does not apply.

Linux amd64, UID 1000, read-only root and loopback-only port remain unchanged.
Runtime: Node 24.22.1/npm 12.0.2, PostgreSQL 18.6, Sharp 0.35.5/libvips 8.18.7/
libwebp 1.6.0. Builder, bootstrap helper and temporary readiness password retire.

## Exact comparison and qualification

All 933 server modules, 11 shared modules, 155 client artifacts, 110 npm dependencies,
151 OS packages and the Node/native binaries match the preceding image. Client
artifacts also match the local build. Root package metadata matches current source;
only the opt-in characterization command is added, without a version/dependency/
lockfile change. No application runtime code changes in this round.

Native entries mount frozen candidate source/tests and fixed prepared inputs
read-only against this rebuilt runtime. Qualification uses disposable constrained
containers without network, published ports or walkthrough data. The walkthrough
runs the independently compared built application. Final containment and failed
publication results are recorded separately in the implementation outcome.

No release, tag or new branch is created. The next item is structured native
encoder/allocation evidence for the same fixed candidate.
