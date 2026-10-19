# Runtime dependency recommendations, October 2026

Consulted 2026-10-19 through MCP search/open and GitHub metadata. Installed npm
is 12.0.2; current online npm 12 guidance may describe 12.2.0. Apply the public
classification contract and verify the installed resolver's actual output.

| Official source | Applicable practice |
| --- | --- |
| [npm package classification](https://docs.npmjs.com/cli/configuring-npm/package-json/) | Build-only tools belong in devDependencies; production dependencies are what the deployed Node application needs. Vue remains browser runtime code inside the built bundle. |
| [npm ci](https://docs.npmjs.com/cli/commands/npm-ci/) | Deterministic lock-based install and omit=dev remove development packages from the on-disk production install while retaining them in the lockfile. Preserve existing install-script policy. |
| [npm ls](https://docs.npmjs.com/cli/v12/commands/npm-ls/) | Reports the logical dependency graph, not a physical filesystem inventory. Do not infer package absence from this command alone. |
| [Vue production deployment](https://vuejs.org/guide/best-practices/production-deployment.html) and [Vite build guidance](https://vite.dev/guide/build.html) | Vite creates production client bundles suitable for static serving. Preserve the actual browser bundle and validate lazy navigation; an SSR application would need a different dependency decision. |
| [OWASP Node Docker guidance](https://cheatsheetseries.owasp.org/cheatsheets/NodeJS_Docker_Cheat_Sheet.html) | Informative guidance: production-only installs, multi-stage builds and non-root execution reduce unnecessary deployed software. This is not evidence of a particular vulnerability being fixed. |
| [W3C High Resolution Time](https://www.w3.org/TR/2026/WD-hr-time-3-20260901/) | September Working Draft informs descriptive monotonic measurements. It does not determine npm classification or certify security/accessibility; no unrelated UI rewrite is needed. |
| [Node security announcement](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases?trk=public_post_comment-text) | Node 24's October 21 security release is future work on October 19. Do not invent an available patch or claim this dependency change mitigates it. |
| [Docker Compose ports](https://docs.docker.com/reference/compose-file/services/), [publishing](https://docs.docker.com/engine/network/port-publishing/) and [Compose ps](https://docs.docker.com/reference/cli/docker/compose/ps/) | Follow-up: let Docker allocate the published port, bind explicitly to loopback, then read the acknowledged mapping. Preserve cleanup and base-URL/session contracts. A host socket probe released before Docker binds cannot reserve the port. |

Fresh official Node release metadata still lists
[24.22.0](https://github.com/nodejs/node/releases/tag/v24.22.0), published October
14, as the latest returned Node 24 release. No newer published Node 24 patch was
available in that collection during this check.

## Alternatives and final stack

| Option | Pros | Cons |
| --- | --- | --- |
| Classify Vue/Router as client build dependencies | Uses existing npm/Docker boundaries; no manual package pruning; versions and client behavior can remain identical | Source builds require development dependencies; SSR would require re-evaluation |
| Omit all peer/optional packages | Potentially smaller tree | Can discard unrelated required/native capability; wrong ownership boundary |
| Delete specific package directories after install | Immediate visible absence | Fragile transitive allowlist and broken package/lock contracts |
| Retain the current production graph | No classification change | Ships unused browser build tooling and its maintenance surface |

Recommend the existing Node 24 ESM/npm 12.0.2, Vue/Router static build, Express and
PostgreSQL 18 platform, with Vue/Router classified at build time and five server
production dependencies retained. Keep pinned multi-stage Alpine builds and
current serial/resource owners. Trade a smaller deployed package surface for
an explicit requirement to install development dependencies when building from
source. The announced Node security patch remains the next priority when it is
actually published; integrate broader artifact policy only if future changes
justify a maintained acceptance contract.

Packaged checks exposed an independent first-install reload. The separate
[service worker design](PWA_SERVICE_WORKER_RELOAD_DESIGN.md) records current W3C
draft and Chrome guidance, alternatives and per-page update intent. Retain that
small factory correction with enabled-worker proof. Prioritize the smoke-port
allocation follow-up next; remove the unnecessary server-builder install in a
separate output-equivalence slice. Neither replaces the pending Node security
release qualification.
