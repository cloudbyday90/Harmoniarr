# Local Docker concurrent media memory outcome

Completed October 23, 2026 using the preserved-state path in the
[local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). See separate
[design](DEPLOYMENT_MEDIA_MEMORY_DESIGN.md), [research](DEPLOYMENT_MEDIA_MEMORY_RESEARCH.md)
and [qualification outcome](DEPLOYMENT_MEDIA_MEMORY_OUTCOME.md).

A fresh owned Buildx builder completed `--pull --no-cache --load` from the pinned
Node 24.22.1/Alpine 3.23 Dockerfile into `harmoniarr:walkthrough-local`.

- Prior image: `sha256:d79580498e265a0e74f3330bf48e03210b14fec5538ea220dbf03f754ca62ac3`.
- Rebuilt image: `sha256:e65fd0c8a2be6a3e4f190674d65614ffb713ded41e021b95d72dca1bc9be2e73`.

Compose used `up -d --wait --no-build`. The existing app/PostgreSQL container is
healthy at `http://127.0.0.1:47956`, read-only, Linux amd64 and UID 1000. All five
actual bind mounts, including the completed-download override, matched before/
after. Existing admin/data was preserved. Bootstrap confirmed the existing admin
and retired its helper. Startup applied zero migrations and verified 112 applied,
zero pending.

Readiness-only browser validation passed with existing provider/path mappings.
It submitted no new search/download and does not establish an accepted transfer.
The password-only temporary file was outside the repository and removed. Provider
attention is separate from controlled native memory qualification.

All 901 server files, 11 shared files and 155 client artifacts are unchanged and
match validated source/build. Node binary, 110 production npm versions and 151 APK
versions match the preceding image. Package metadata adds the explicit media lane;
lockfile and app version are unchanged. Runtime remains Node 24.22.1/npm 12.0.2,
Sharp 0.35.5/libvips 8.18.7, FFmpeg/FFprobe 8.0.1 and PostgreSQL 18.6.

Final mounted qualification source passed all four cases in each fresh 2/3 GiB
profile against this exact image. It proves real scan/tag persistence, FFprobe/
encode preflight, source preservation, overlap and actual retirement. A fixture
publication-hold correction after rebuilding affects excluded `testing` code;
packaged runtime bytes remained unchanged.

Owned qualification containers retired with absence checked and the fresh builder
was removed. The application remains running. No second deployed service, release,
tag or version bump was created.

Next: shared bounded admission for canonical FFmpeg/FFprobe commands, retaining
capacity through actual close and covering every affected caller.
