# Local Docker artwork-worker rebuild outcome

Completed October 22, 2026, following
[the local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). The separate
[worker outcome](ARTWORK_WORKER_OUTCOME.md) records implementation and isolated
native qualification; readiness is not live-provider acquisition acceptance.

Built using a new disposable Buildx builder, `--pull --no-cache --load`, then
retired the builder and verified its absence. Local image:
`sha256:dd2f73141850eab710d3692cea569805ff5d08dc98f07ed647656a6f03fa6b91`.
Preceding preserved-state image:
`sha256:3bce38540e6c4c6afb7eabc709a09f814b9e337b313e91945b31068193ad8d55`.

Compared exact image inventories before replacing the local application. All
changed/new production files match frozen source; other server/shared files,
production npm identities, OS package identities and the Node executable are
unchanged. All 155 client artifacts match the unchanged local build. The image
contains 897 server files and 11 shared files, with 110 production npm identities
and 147 OS package identities. Node is 24.22.1, npm 12.0.2, Sharp 0.35.5 and
libvips 8.18.7. Inspection of the actual executable found ELF ET_DYN (PIE).

Started Compose without rebuilding and preserved all five actual bind mounts,
including the completed-downloads override. Existing data and admin were retained;
the bootstrap helper reported existing state and was removed. Startup applied zero
migrations and verified 112 applied, zero pending. The application is healthy at
`http://127.0.0.1:47956`, Linux amd64, UID 1000, with a read-only root filesystem.
The readiness-only check passed. Its password-only temporary file lived outside
the workspace and was removed with absence verified; credentials are not evidence.

Separate disposable containers ran 90 Linux compatibility/lifecycle checks, seven
maximum-policy/process checks and an actual packaged ESM probe. They had no external
network or published ports and did not mount walkthrough data. The maximum lane
verified the kernel's one-CPU/1 GiB/no-additional-swap/96-PID controls on this cgroup-v1
host. Whole-container peak was 880,525,312 bytes; this is an observation for these
cases, not worker-specific memory containment. A v2-only preflight failure was
retained and corrected in the native test; production/image bytes did not change.
All owned temporary containers were removed and absence verified.

No registry image was pushed, version bumped, release created or tag published.
Next qualify independent worker OS boundaries and forced-OOM parent survival as
described in the [recommendation](ARTWORK_WORKER_OUTCOME.md#recommendation-and-next-item).
