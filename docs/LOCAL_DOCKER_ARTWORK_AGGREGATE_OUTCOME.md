# Local Docker aggregate artwork outcome

Completed October 22, 2026 following the preserved-state rebuild path in the
[local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). See the separate aggregate
[design](ARTWORK_AGGREGATE_DESIGN.md), [research](ARTWORK_AGGREGATE_RESEARCH.md) and
[validation outcome](ARTWORK_AGGREGATE_OUTCOME.md).

A fresh owned Buildx builder performed a pull/no-cache/load build from the pinned
Node 24.22.1/Alpine 3.23 Dockerfile into `harmoniarr:walkthrough-local`.

- Prior image: `sha256:ab5005df4b6574e7d0f91f08deec391693ba9cd1a9b4ce20d37e2f2cd0b2c04b`.
- Rebuilt image: `sha256:380e8269d6cdfa651d0cd31ccebbe5b2907d072ec139fadf6e8f3e8c587b68b1`.

Compose startup used `up -d --wait --no-build`. The existing app/PostgreSQL
container is healthy at `http://127.0.0.1:47956`, read-only, Linux amd64 and UID
1000. All five actual bind mounts, including the completed-download override,
matched before/after. Existing data/admin remained intact. The one-shot bootstrap
confirmed the existing admin and its helper retired. Startup applied zero
migrations and verified 112 applied, zero pending.

Readiness-only browser validation passed using the existing provider/path mapping.
No search/download commands were submitted; this is not a new accepted transfer.
The temporary password-only file was outside the repository and removed. Provider
attention is an operational status separate from artwork qualification.

Runtime comparison found exactly ten changed/new server modules: the reservation,
protocol and child-session modules and their existing admission/ingestion/worker
owners. The image contains 901 server files, 11 shared files and 155 client
artifacts. Other server/shared files and all client artifacts are unchanged and
match the validated source/build. Node binary, package metadata, all 110 production
npm versions and all 151 APK versions are unchanged. Runtime remains Node
24.22.1/npm 12.0.2/Sharp 0.35.5/libvips 8.18.7.

Against this exact immutable image, the focused Linux cohort passed 111 cases,
native lifecycle passed seven, native memory passed four, the native corpus
passed seven and the packaged default-ingestion probe passed. These overlapping
checks establish behavior under their recorded profiles, not whole-app memory
containment. In particular, the 2 GiB active reservation is logical accounting;
the existing 1 GiB child DATA limit remains the actual allocation control.

All owned qualification containers and the fresh builder were removed with
absence checked. The existing application remains running; no second deployed
service, release, tag or version bump was created.

Next: measure deployment headroom alongside actual provider/parent/PostgreSQL
work before adding operator-facing memory-budget configuration. Keep the
existing application topology and preserve admin/data for subsequent rebuilds.
