# Local Docker no-cache rebuild research

October 10, 2026, America/New_York. Consultation: **22:39:48–22:44:21 UTC /
18:39:48–18:44:21 EDT**. User-authorized rebuild follows completion of the current
slice; root owns commit/push, Docker actions and executed evidence. This is a
read-only source/guide ledger, not proof that a rebuild or validator ran.

## Applicable walkthrough path

The complete [Local Docker Walkthrough](LOCAL_DOCKER_WALKTHROUGH.md) was read.
Its no-cache path is:

```powershell
docker compose -f compose.walkthrough.yaml build --no-cache harmoniarr
docker compose -f compose.walkthrough.yaml up -d --wait --no-build harmoniarr
docker compose -f compose.walkthrough.yaml --profile bootstrap run --rm --no-deps walkthrough-bootstrap
```

Keep the existing configured walkthrough and its repo-local bind data. The
walkthrough Reset is explicitly for brand-new state; a rebuild does not make that
conditional step applicable. The current bootstrap helper reads bootstrap status
and returns when an admin already exists; it also accepts the competing
`bootstrap_unavailable` response. This is source evidence, not a new execution.
No additional permission flow is inferred: the user authorized this rebuild.

## What no-cache and wait establish

[Compose build](https://docs.docker.com/reference/cli/docker/compose/build/) exposes
`--no-cache` and a separate `--pull`. The [build specification](https://docs.docker.com/reference/compose-file/build/)
limits no-cache to Dockerfile image layers; [build best practices](https://docs.docker.com/build/building/best-practices/)
confirms it does not itself refresh a base image. It is neither data reset nor
pruning. Actual image availability/digests remain owning execution evidence.

The Dockerfile has three `RUN --mount=type=cache,target=/root/.npm` instructions.
The [Dockerfile reference](https://docs.docker.com/reference/dockerfile) documents
mount-cache persistence across builder invocations independently of instruction
cache invalidation. Re-executing a RUN does not establish that its npm cache starts
empty. Dependencies also remain governed by the lockfile/`npm ci`; no-cache is not
a dependency-version upgrade guarantee.

[Compose up](https://docs.docker.com/reference/cli/docker/compose/up/) documents
running/healthy waiting, detached mode and recreation after image/config changes
while preserving mounted volumes. `--wait-timeout` bounds that wait; it does not
establish provider acceptance, download completion or import readiness. The
Dockerfile healthcheck requests `/healthz`. [Startup ordering](https://docs.docker.com/compose/how-tos/startup-order)
distinguishes running from dependency health. [Compose down](https://docs.docker.com/reference/cli/docker/compose/down/)
separates ordinary teardown from volume removal; no unconditional down/reset is
needed to apply the rebuilt walkthrough image.

## Stronger prior-cache isolation option

For a build free of a prior builder's layer/npm-mount state, root may use one
new invocation-owned `docker-container` builder without importing cache, followed
by the guide's no-cache build. The [driver contract](https://docs.docker.com/build/builders/drivers/docker-container/)
uses a dedicated BuildKit state volume. [Driver loading](https://docs.docker.com/build/builders/drivers/)
documents `default-load=true` for Buildx **0.14.0 and later**; other explicit output
formats can override default loading. Root must verify installed capability and
that the resulting tag/image reaches the local Engine image store.

The [create CLI](https://docs.docker.com/reference/cli/docker/buildx/create/) supports
`--name`, `--driver docker-container`, `--driver-opt default-load=true`; omitting
`--use` avoids changing selected global builder state. Compose build supports
`--builder`; [build variables](https://docs.docker.com/build/building/variables/)
documents scoped `BUILDX_BUILDER` selection. The [Compose example](https://docs.docker.com/build-cloud/usage/)
also lists both selectors, but its 0.37.0 prerequisite is cloud-specific and is
not applied as a local container-driver prerequisite. Preserve/restore any scoped
environment selection and remove only the created builder, without `--keep-state`,
after actual build settlement. Global builder selection/pruning is unnecessary.

This stronger choice is a project inference about **previous invocation state**.
Stages may reuse npm data newly populated within this same build. It does not
promise every cache directory stays empty, fresh remote registry/package data,
or zero external network access. Costs include an extra BuildKit container/state
volume, possible image pulls and slower dependency retrieval; ordinary guide
no-cache preserves the builder's existing mount cache. Root chooses after local
capability checks and records actual builder/image cleanup.

## Validation paths and evidence boundaries

| Walkthrough branch | Applicable evidence | Boundary |
| --- | --- | --- |
| Existing configured walkthrough after rebuild | Health/bootstrap preservation; `validate:docker-provider-acceptance -- -- --readiness-only` | Requires saved provider/mapping; signs in and may read provider status; no searches, transfer commands, provider configuration changes or acceptance claim |
| Managed-provider smoke | `validate:managed-slskd-smoke` | Separate temporary project/disposable secrets/private API; no real Soulseek login/search/download |
| File-backed Music Queue proof | `validate:docker-file-backed-music-queue` | Temporary mounts/real generated FLAC, repaired mapping and quality/collision stops; does not use the configured provider/library |
| Canonical deployment-path alternative | `validate:docker-deployment-path` with isolated project/evidence | Fresh install, restart, backup/restore and Request Music HTTP checks; existing walkthrough state preserved |
| Fresh walkthrough browser smoke | `validate:docker-browser-smoke` plus evidence validation on an independently fresh target | Expects setup_required/disabled Downloader/no notifications; does not fit configured walkthrough state |
| Strict accepted transfer / Music Queue linkage | Guide's explicit strict provider-acceptance flags | Conditional on an intentionally existing provider run; not a rebuild prerequisite |
| Release/upgrade rehearsal | Optional image/baseline refs | No requested new release image, publication or upgrade rehearsal |

Readiness-only includes sign-in/session writes and may read status from the
configured provider. Its command boundary excludes searches, transfer commands
and provider configuration changes; it neither requires nor claims acceptance.

The guide explicitly offers canonical isolated deployment validation instead of
deleting a walkthrough to meet fresh-browser assumptions. Current deployment-path
orchestration does not automatically call the separate Playwright browser-smoke
validator; retain the distinct HTTP and browser claims. A browser check on a
separate fresh target needs its own evidence. Use a password-only file outside the
repository when applicable, never a password argument or a resolved environment
secret dump. Keep bounded readiness artifacts and separately classify unrelated
background worker activity; no universal no-provider-I/O claim follows from the
readiness probe.

## Versions, classifications and retained evidence

Fresh read-only Dockerfile observation: defaults `node:24.21.0-alpine` and
`alpine:3.23`. Host Node 24.18.1/npm 12.0.2 are inherited current host observations,
not built-image versions. Docker/Compose/Buildx versions and running image values
were not queried by this researcher. Root supplied the current walkthrough's
healthy/loopback/read-only/capability/bind observations; this ledger does not
independently certify them or assume the tagged base image is available.

Docker CLI/specification references are current vendor contracts; best practices
are informative guidance. Guide/source mappings and the fresh-builder choice
are separately identified project observations/inferences. Consultation is not
publication, installed-capability proof or execution. This rebuild research
introduces no UI, accessibility-conformance, provider-upgrade or release claim.
The previously verified W3C applicability distinction remains in
[catalogue research](CATALOGUE_TEST_LIFECYCLE_RESEARCH_2026_10.md); privacy guidance
is applied narrowly to evidence/secret handling rather than a broad security scan.

Initially consulted guide SHA256, before root's wording correction:
`7ae476ccb2895d23f9a088c941ee697d2a708e1b6bf07518942431f19d04c8b6`.
Raw official search/open/navigation responses and bounded local source reads:
`.tmp/local-docker-rebuild-2026-10/official-research.json`.
SHA256: `ce0d0d84705cb5344db5e6cfdb90707c60dfd087c257fc00a60d33235b3ce5ff`.
Recorded **22:45:12 UTC**. The guide's disposable plaintext credentials were not
copied into that artifact. No Docker/PostgreSQL/tests/Git/runtime changes or
external writes by this researcher. Actual rebuild and validation belong to root.

Local source update observed **22:47:12 UTC / 18:47:12 EDT**, October 10: root
corrected the guide's readiness wording after the product agent traced sign-in
writes and configured slskd GETs. The current guide SHA256 is
`7f2df84c87abf2d1e11b39ab4083c63b334bd1e48eb0b406407313f04d15a729`.
This is a read-only guide/source observation, not a new online consultation or an
execution by this researcher. The initial raw artifact and its hash are unchanged.
