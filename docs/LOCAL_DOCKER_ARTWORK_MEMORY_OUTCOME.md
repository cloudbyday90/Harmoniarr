# Local Docker artwork memory outcome

Completed October 22, 2026 using [the local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md).
The memory [design](ARTWORK_MEMORY_DESIGN.md), [research](ARTWORK_MEMORY_RESEARCH.md)
and [validation outcome](ARTWORK_MEMORY_OUTCOME.md) are separate documents.

## Rebuild and preserved state

A fresh owned Buildx builder performed a pull/no-cache/load build from the pinned
Node 24.22.1/Alpine 3.23 Dockerfile into `harmoniarr:walkthrough-local`.

- Before image: `sha256:dd2f73141850eab710d3692cea569805ff5d08dc98f07ed647656a6f03fa6b91`.
- Rebuilt image: `sha256:4f8ede42dfa69b9e174a3987b8713ef650fb66dfb51c9559b2559ec9f0b0e0e7`.

Compose startup used `up -d --wait --no-build`. The walkthrough remains one deployed
app/PostgreSQL container, healthy at `http://127.0.0.1:47956`, read-only and UID 1000.
All five actual bind mounts, including the existing completed-download override,
were compared before/after and preserved. No walkthrough data was reset. The
one-shot bootstrap reported the existing admin and retired its helper container.

Startup applied zero migrations and verified 112 applied/zero pending. Readiness-only
browser validation passed with the existing provider/path mapping configuration.
It submitted no searches/transfers and does not establish accepted media downloads.
Its temporary password-only file lived outside the repository and was removed.
Existing provider attention remains an operational status, not decoder validation.

## Packaged runtime comparison

All six changed/new server files exactly match the source hashes. The remaining
server/shared files match the prior image. The image contains 898 server files,
11 shared files and 155 unchanged client artifacts. All 110 production npm package
versions, root package metadata and the actual Node binary remained unchanged.

The expected APK additions were exactly:

- `util-linux-misc-2.41.6-r1`
- `setarch-2.41.6-r1`
- `libfdisk-2.41.6-r1`
- `libsmartcols-2.41.6-r1`

All existing APK versions were unchanged; the OS package count is now 151.
The actual prlimit binary links musl/libsmartcols. The maintained package owns its
binary/dependency provenance; no privileged daemon or copied custom limiter exists.
Node remains 24.22.1, npm 12.0.2, Sharp 0.35.5 and libvips 8.18.7 on Linux amd64.

Packaged default ingestion and the separate Linux compatibility/worker/memory
lanes passed as detailed in the owning outcome. Temporary qualification containers
and the fresh builder were removed, with absence checked. No release or tag was
created. Readiness, actual native memory refusal and arbitrary host-OOM survival
remain distinct claims.

The next follow-up is diverse image/depth memory qualification and aggregate
admission sizing within this existing application, keeping the deployment topology.
