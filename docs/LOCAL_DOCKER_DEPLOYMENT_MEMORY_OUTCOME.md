# Local Docker deployment memory outcome

Completed October 22, 2026 using the preserved-state path in the
[local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). See the separate
[design](DEPLOYMENT_MEMORY_DESIGN.md), [research](DEPLOYMENT_MEMORY_RESEARCH.md)
and [qualification outcome](DEPLOYMENT_MEMORY_OUTCOME.md).

A fresh owned Buildx builder completed `--pull --no-cache --load` from the pinned
Node 24.22.1/Alpine 3.23 Dockerfile into `harmoniarr:walkthrough-local`.

- Prior image: `sha256:380e8269d6cdfa651d0cd31ccebbe5b2907d072ec139fadf6e8f3e8c587b68b1`.
- Rebuilt image: `sha256:d79580498e265a0e74f3330bf48e03210b14fec5538ea220dbf03f754ca62ac3`.

The first build stopped before compilation because Docker's resolver could not
resolve its registry CDN. Its log was retained and builder removed. Resolution
recovered; a second fresh builder completed the same pinned, no-cache build.
TLS verification, Dockerfile pins and host resolver settings were not changed.

Compose used `up -d --wait --no-build`. The existing app/PostgreSQL container is
healthy at `http://127.0.0.1:47956`, read-only, Linux amd64 and UID 1000. All five
actual bind mounts, including the completed-download override, matched before/
after. Existing admin/data was preserved. Bootstrap confirmed the existing admin
and retired its helper. Startup applied zero migrations and verified 112 applied,
zero pending.

Readiness-only browser validation passed using existing provider/path mappings.
No new search/download was submitted; this does not establish a newly accepted
transfer. The password-only temporary file was outside the repository and removed.
Provider attention remains separate from qualification of the memory workload.

All 901 server files, 11 shared files and 155 client artifacts match the preceding
image and validated source/build. Node binary, all 110 production npm versions
and all 151 APK versions are unchanged. Root package metadata adds only the
explicit native memory command; lockfile and app version are unchanged. Runtime
remains Node 24.22.1/npm 12.0.2/Sharp 0.35.5/libvips 8.18.7.

Against this exact image, three native shared-container cases passed in a fresh
3 GiB profile and again in a fresh 2 GiB profile. Their database, TLS/native child,
publication and memory evidence are scoped in the owning outcome. Each fixture
used its own disposable app/database storage and retired with absence checked.
Both owned builders were removed; the application remains running. No second
deployed service, release or tag was created.

Next: qualify concurrent scanning and actual media inspection/transcoding before
deriving a whole-deployment minimum or adding operator memory configuration.
