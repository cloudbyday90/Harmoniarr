# Local Docker artwork corpus outcome

Completed October 22, 2026 following the preserved-state rebuild path in the
[local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). See the separate corpus
[design](ARTWORK_CORPUS_DESIGN.md), [research](ARTWORK_CORPUS_RESEARCH.md) and
[validation outcome](ARTWORK_CORPUS_OUTCOME.md).

A fresh owned Buildx builder performed a pull/no-cache/load build from the pinned
Node 24.22.1/Alpine 3.23 Dockerfile into `harmoniarr:walkthrough-local`.

- Prior image: `sha256:4f8ede42dfa69b9e174a3987b8713ef650fb66dfb51c9559b2559ec9f0b0e0e7`.
- Rebuilt image: `sha256:ab5005df4b6574e7d0f91f08deec391693ba9cd1a9b4ce20d37e2f2cd0b2c04b`.

Compose startup used `up -d --wait --no-build`. The existing app/PostgreSQL container
is healthy at `http://127.0.0.1:47956`, read-only and UID 1000. All five actual bind
mounts, including the completed-download override, matched before/after. Existing
data/admin remained intact. The one-shot bootstrap confirmed the existing admin
and retired its helper. Startup applied zero migrations and verified 112 applied,
zero pending.

Readiness-only browser validation passed with the existing provider/path mapping.
It submitted no search/download commands and does not establish a new accepted
transfer. The temporary password-only file was outside the repository and removed.
Provider attention remains an operational status separate from decoder evidence.

The image's 898 server files, 11 shared files and 155 client artifacts exactly match
the preceding image. Node binary, all 110 production npm package versions and all
151 APK versions are unchanged. The updated root package file contains only the
additional explicit corpus-validation script; the lockfile and app version are
unchanged. Runtime remains Node 24.22.1/npm 12.0.2/Sharp 0.35.5/libvips 8.18.7 on
Linux amd64.

The packaged corpus command passed seven cases, the existing memory lane passed
three cases, and the packaged default-ingestion probe passed. Temporary qualification
containers and the fresh builder were removed with absence checked. No second
deployed service, release or tag was created.

Next: staged aggregate memory reservations within this app, based on the lifecycle
design in the owning outcome, rather than reducing limits from moderate-image peaks.
