# Random PR #40 local replay design

Research date: October 3, 2026
Status: Accepted for exact local replay and maintained Node 24.21 fixture pin

## Selection and scope

The fresh random draw used the two eligible open PRs, #40 and #24, excluding
the already replayed #23. Index zero selected
[PR #40](https://github.com/cloudbyday90/Harmoniarr/pull/40), immutable head
`649659f1e199d48d55cc8d5cccf9f079dc235d86`. GitHub MCP returned the complete
patch and one changed filename: `compose.controlled-provider-fixture.yaml`.
Its only change is `node:24.19.0-alpine` to `node:26.7.0-alpine` for the
controlled-provider fixture. This does not upgrade the application Dockerfile.

The historical PR head still uses an environment-variable provider key. Current
main has since adopted a secret-file mount and a separate linkage verifier.
Apply only the reviewed image-line change to the current fixture contract;
replacing the historical file wholesale would regress those later changes.

## Runtime boundaries and official research

The fixture server is standalone ESM. It imports Node filesystem, HTTP, path,
and crypto builtins plus its local synthetic catalog. It does not install the
application package or use its native dependencies. Application engines remain
Node `>=24.15.0 <25.0.0`, and the main Dockerfile currently obtains Node from
`node:24.19.0-alpine`. A separate Node 26 fixture can therefore be tested without
claiming application Node 26 support.

| Official source | Relevant evidence |
| --- | --- |
| [Node release schedule](https://github.com/nodejs/Release/blob/main/schedule.json) | Node 24 is LTS; Node 26 is Current on the research date, with its LTS transition scheduled for October 28. Both release lines remain supported. |
| [Node 26.7 release](https://nodejs.org/en/blog/release/v26.7.0) and [its bundled Undici manifest](https://github.com/nodejs/node/blob/v26.7.0/deps/undici/src/package.json) | The exact PR version was released August 5 and bundles Undici 8.9.0. |
| [Node 24.19 bundled Undici manifest](https://github.com/nodejs/node/blob/v24.19.0/deps/undici/src/package.json) | The current image baseline bundles Undici 7.29.0. |
| [Undici maintainer advisory](https://github.com/nodejs/undici/security/advisories/GHSA-w293-vg96-wgc3) | The affected BalancedPool ranges include those two versions; patched baselines are 7.29.1 and 8.10.2. Exploitation requires BalancedPool with function-valued custom TLS/connector options. |
| [Node 24.21 release](https://github.com/nodejs/node/releases/tag/v24.21.0) and [Node 26.8.2 release](https://github.com/nodejs/node/releases/tag/v26.8.2) | September releases update bundled Undici to 7.29.1 and 8.10.2 respectively. |
| [Node 26.10 release](https://github.com/nodejs/node/releases/tag/v26.10.0) | Official release metadata lists the newer Current release, published September 22. |

GitHub MCP supplied the PR patch, changed paths, immutable head file, official
release list, schedule, and bundled manifests. The web tool opened the official
Node and Undici sources. This is release/component research, not an image
vulnerability scan or a demonstrated application exploit.

The fixture's HTTP server makes no outbound provider request. Its healthcheck
fetches plain HTTP on its own loopback interface. The inspected fixture does
not use BalancedPool or custom TLS verification. The known advisory therefore
supports refreshing old bundled components; it does not establish that this
fixture exposes the advisory's attack path. A clean npm dependency audit also
does not inspect Node's bundled HTTP client or Alpine packages.

## Options and recommendation

| Option | Benefit | Cost or limit | Recommendation |
| --- | --- | --- | --- |
| Track the exact Node 26.7 PR pin | Reproduces the requested version and exercises a newer major | Older patch/component baseline, Current line, and diverges from application LTS | Replay locally; do not recommend as the maintained pin |
| Keep Node 24.19 indefinitely | Avoids a major change and matches the current Dockerfile | Also predates the published bundled Undici fix | Do not describe as security-current |
| Refresh the fixture to Node 24.21 LTS | Preserves application-major alignment and includes the verified Undici fix | Separate from the exact historical PR; tag identity must be recorded | Adopt for the maintained fixture pin |
| Use current Node 26.10 for the fixture | Exercises a newer supported major with later fixes | No application Node 26 compatibility proof and another runtime to maintain | Optional compatibility comparison |

Any application Dockerfile/runtime refresh is a separate root-owned scope
decision with its own build and runtime evidence. No package engine expansion
is needed for this fixture replay. The root accepted the Node 24.21 fixture
successor and three-image execution; the optional Node 26.10 lane is deferred.

## Local implementation and validation plan

Before execution, retain the MCP patch and immutable historical file under
`.tmp/random-pr-40-local-replay/`. Stage exact current server/catalog source,
hash the files, and derive an isolated Compose service preserving the current
secret-file, non-root user, read-only root, healthcheck, dropped capabilities,
no-new-privileges, and temporary-directory contracts. Add `network_mode: none`
and task-owned download/secret mounts. Use a generated disposable fixture key;
no operator, GitHub, registry, Soulseek, or provider credential is an input.

Execute the actual server in the exact PR image and baseline image, with probes
inside the same container against loopback. Verify actual runtime and image
identity, health, authentication refusal, session/application responses,
all catalog search shapes, delayed polling, locked files, no-response behavior,
primary/fallback transfer outcomes, copied bytes, and fixture evidence counters.
Synthetic byte fixtures test filesystem transfer behavior; they do not prove
audio validity or application safe-add behavior. Compare normalized results
across images without random UUIDs or timestamps. Record resolved image IDs,
digests, Node/Undici versions, source hashes, settings, and executed checks.

Run the existing focused controlled-provider Compose, secret, runner-input,
linkage-verifier, and evidence regressions. These complement actual Docker
execution; static contract tests alone cannot prove an image starts.

Record actual failures and limitations in a separate outcome. Clean up only
task-owned Compose containers/networks; retain local replay evidence. No branch,
PR merge/comment, release, tag, workflow dispatch, image build/push, or live
provider operation is part of this work. Exact fixture replay is narrower than
the full Harmoniarr controlled-provider pipeline or published-image acceptance.
