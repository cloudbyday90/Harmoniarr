# Server builder recommendations

Consulted 2026-10-20 through MCP search, navigation and immutable PR metadata.
Actual validation uses Node 24.22.0/npm 12.0.2; the OS-wide Node remains 24.18.1.

| Official source and status | Application |
| --- | --- |
| [Docker multi-stage builds](https://docs.docker.com/build/building/multi-stage?trk=public_post_comment-text), product documentation | Give independent assembly only its own inputs; BuildKit skips unrelated stages for a selected target. |
| [Docker RUN networking](https://docs.docker.com/reference/dockerfile), product documentation | RUN --network=none prevents external network access by that command. Frontend/base-image resolution and other stages remain separate network owners. |
| [Docker cache guidance](https://docs.docker.com/build/cache/invalidation/), product documentation | COPY inputs participate in invalidation; remove unused inputs rather than relying on a warm dependency cache. |
| [Node 24 filesystem API](https://r2.nodejs.org/docs/latest-v24.x/api/fs.html), versioned API documentation | Recursive filesystem copying is provided by Node; this assembly script invokes no package compiler. |
| [OWASP Node Docker guidance](https://cheatsheetseries.owasp.org/cheatsheets/NodeJS_Docker_Cheat_Sheet.html), informative guidance | Separate build/runtime dependencies, retain production-only install, non-root execution and context exclusions. Removing a build install is not an image CVE remediation claim. |
| [W3C High Resolution Time](https://www.w3.org/TR/2026/WD-hr-time-3-20260901/), September 1 Working Draft | Use monotonic descriptive measurements; build-stage time is not additive whole-CI speed or security certification. No UI standard change follows from a Docker edit. |
| [Node security announcement](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases?trk=public_post_comment-text), vendor announcement | October 21 remains future work as of October 20. Qualify the actual published Node 24 patch rather than inventing an available version. |

## Options and recommended stack

| Option | Pros | Cons |
| --- | --- | --- |
| Direct pinned Node stage, minimal inputs, network-disabled assembly | Removes unused npm operations and their dependency on client tooling; explicit ESM scope and exact output proof | Future package-dependent build changes require an intentional stage update |
| Retain full npm ci | Supports hypothetical future compilation | Performs an unused install and inherits global npm setup |
| Copy server source directly into runtime | Fewer instructions | Bypasses the existing assembly entrypoint and changes ownership without a current need |
| Add another compiler/bundler | Could support future transformation | Adds dependency and semantic change to a copy-only task |

Recommend retaining Node 24 ESM/npm 12, static Vue/Router, Express and PostgreSQL
18, with dependency-free server assembly and the existing separate client and
production installs. Keep the existing provider pin temporarily: native testing
found that its four-component wire version also fails current download admission.
Fix and qualify that boundary before claiming download readiness or adopting
the selected upgrade. Preserve the exact transport guard; see the dedicated
[PR outcome](OPEN_PR_51_SERVER_BUILDER_EVALUATION.md).
