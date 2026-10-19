# Node baseline recommendations, October 2026

Consulted 2026-10-19 using MCP search/open, GitHub metadata and live Docker image
metadata. Separate dated vendor guidance, W3C draft timing and local policy.

| Official source | Applicable practice |
| --- | --- |
| [Node 24.22.0 release](https://nodejs.org/uk/blog/release/v24.22.0) | Published October 14 LTS release; obtain the Windows binary from its actual release link and compare its listed SHA-256 before execution. A checksum comparison does not claim independent PGP verification. |
| [October security announcement](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases?trk=public_post_comment-text) | Announces a Node 24 release on or shortly after October 21, highest severity high. On October 19 its final version/advisory details are future; do not call 24.22.0 the fix for it. |
| [Docker build guidance](https://docs.docker.com/build/building/best-practices/?trk=article-ssr-frontend-pulse_little-text-block) | Exact digest gives reproducible base identity but requires maintained updates. --pull and --no-cache cover different layers. Pin the real multi-architecture index, then execute the actual target platform. |
| [Node official Docker repository](https://github.com/nodejs/docker-node) | Alpine uses musl and has architecture/support differences. Windows success does not qualify a copied Linux binary. Match the builder/runtime Alpine family and execute the packaged image. |
| [setup-node guidance](https://github.com/actions/setup-node/blob/main/README.md?plain=1) | node-version-file selects .nvmrc; an explicit node-version would take precedence. Keep existing pinned action and shared setup rather than duplicate version constants in workflows. |
| [OWASP Node Docker guidance](https://cheatsheetseries.owasp.org/cheatsheets/NodeJS_Docker_Cheat_Sheet.html) | Informative security guidance: explicit image identity, deterministic dependency install, production dependency scope and non-root runtime. Retain existing controls; audit success does not certify the whole image. |
| [W3C High Resolution Time](https://www.w3.org/TR/2026/WD-hr-time-3-20260901/) | September 1 Working Draft: monotonic durations support descriptive measurements. It does not certify a Node distribution, image security or a CI speedup. No unrelated UI/WCAG change is needed. |

Live registry inspection found node:24.22.0-alpine3.23 index
sha256:e44c87c7dd212720eb00469aeac89504ca2be77b8f0d6dbffb30665d5fcc59e1,
with linux/amd64 and linux/arm64 manifests. Presence does not prove both execute.
Image source annotation identifies nodejs/docker-node revision
f27125230b3c367dcf63043ea3fe286fb3d0914c, path 24/alpine3.23.
The separately inspected alpine:3.23 index is
sha256:85fe1e81d6758c208f3e1eed4338a1997e19d4be002d4dd32d3100c9a8c010a0.
Its amd64 member matches the Node image's annotated Alpine base digest.

## Alternatives and recommendation stack

| Option | Pros | Cons |
| --- | --- | --- |
| Float Node 24/latest image tags | Automatically takes new patches | Different host/build bytes and unreviewed updates; poor attribution |
| Keep 24.21.0 repo and 24.18.1 host | No new qualification work | Existing drift persists and published maintenance is deferred |
| Exact canonical 24.22.0 plus engine range and drift guard | Reproducible local/CI/Docker baseline; unsupported validation is explicit | Intentional newer patches require a pin update; digest maintenance remains |
| Move to a new Node major or Debian now | Could change support/base tradeoffs | Larger compatibility/package change than this fix; defer |
| Wait for October 21 before any work | Could qualify one later patched candidate | Leaves current drift unresolved; final release/version is not yet known |

Recommend Node 24.22.0 ESM for canonical validation and pinned Alpine 3.23 builds,
npm 12.0.2, the existing Vue/Express/PostgreSQL 18 platform and current modular
test/lifecycle owners. Support later Node 24 versions through the package range,
but update the exact validation pin before claiming canonical evidence. Keep
project-scoped Windows qualification separate from OS-wide installation state.
Recheck and qualify the announced security patch promptly when actually published;
do not invent its pin today. Review retained production build-tool peers next,
after closing the announced-runtime follow-up.
