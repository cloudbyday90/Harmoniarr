# Local Docker spectral admission outcome

Recorded October 23, 2026 after the preserved-state
[local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). The separate
[implementation outcome](SPECTRAL_ADMISSION_OUTCOME.md) records race proof,
validation, tradeoffs and the next recommendation.

## Rebuild and preserved state

A fresh owned Buildx builder ran `--pull --no-cache --load` for
`harmoniarr:walkthrough-local`; builder removal and absence were verified. The
existing Compose service restarted through `up -d --wait --no-build`.

- Image: `sha256:26b513c240ed924d3c34d78c9e5a674103259379d99aa268b0a89f5913d43dc9`.
- Healthy at **http://127.0.0.1:47956**, Linux amd64, UID 1000, read-only root.
- All **five actual bind mounts** match before/after, including the real
  completed-download override. Administrator and application data were preserved;
  bootstrap reused the existing admin and its helper retired.
- Startup applied **zero migrations**, verifying **112 applied and zero pending**.
- Authenticated readiness-only browser validation passed. It submitted no search,
  download or transfer command, and establishes no new provider acceptance. Its
  temporary password-only file outside the repository was removed.

## Exact runtime comparison

Against preceding image
`sha256:d85f94f19ba210b1c578f04a4ed5091c702beca7b60b7964928bfb2c5937608f`,
only `activity/source-user-spectral-admission-store.js` and
`activity/source-user-spectral-job-store.js` changed. The first is new. All other
906 server files, 11 shared files and 155 client artifacts retain their bytes.
The resulting image has **908 server files**. Root metadata matches the local
candidate; its only package change is the explicit native admission script.

Node 24.22.1, npm 12.0.2, the Node binary hash, all 110 production npm packages and
all 151 operating-system package versions remain unchanged. Packaged tools retain
Sharp 0.35.5/libvips 8.18.7, FFmpeg/FFprobe 8.0.1 and PostgreSQL 18.6. The lockfile,
Dockerfile and Compose manifest are unchanged; app version is unchanged.

## Affected packaged checks

This immutable image passed all **ten shared spectral admission cases**, querying
actual PostgreSQL **18.6** before execution, and **two native spectral interruption
cases**. The admission adapter uses the same assertions as isolated integration
tests and requires the existing guarded disposable deployment profile. Native
checks use read-only source/test mounts whose production bytes match the image,
private tmpfs application/PostgreSQL storage, no network, no published ports,
read-only root, UID 1000, two CPUs, 256 PIDs and 3 GiB memory/swap limits.

Each owned native container was removed and absence verified. The live service
remains healthy. Integration's separate 16-case run used cached PostgreSQL 18.3;
that result is not relabeled as packaged 18.6 evidence.

Unchanged native media/image admission and allocation implementations, exact
dependency/runtime comparison and the narrow SQL-only production change support
retaining the preceding two-/three-GiB memory qualification without rerunning it.
This round establishes no new memory minimum, RSS limit, classification accuracy
or whole-application quiescence. Its affected native process check separately
confirmed measured spectral metadata, real cancellation and actual close.

Build, inventory, readiness, frozen code/source, native results and retirement
records remain private under `.tmp/spectral-admission-2026-10-23/`. No release or
tag is created. Next: reproduce the post-commit advisory reputation-delivery gap
and design an idempotent durable outbox if that proof warrants it.
