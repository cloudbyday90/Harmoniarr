# Node security maintenance research — November 2026

Researched November 14 through MCP search, opened official pages and GitHub PR
metadata. See the separate [design](NODE_SECURITY_2026_11_DESIGN.md).

The November 11 Node 24.22.3 release fixes HTTP/2 and TLS issues and updates
embedded Undici, llhttp and Brotli. This includes the intervening 24.22.2 V8
backports and parked-write async-context change. Package audit does not inventory
Node's embedded libraries. Adoption is justified without asserting an application
exploit or claiming every disclosed vulnerability was independently reproduced.
[24.22.3 release](https://nodejs.org/en/blog/release/v24.22.3/),
[November advisory](https://nodejs.org/en/blog/vulnerability/november-2026-security-releases/),
[24.22.2 release](https://nodejs.org/en/blog/release/v24.22.2).

Node 26 is now LTS. Staying on supported Node 24 limits this change to patch
maintenance; a major upgrade needs its own application/native compatibility
decision. The current official image library lists 24.22.3-alpine3.23, allowing
the existing libc family to remain consistent across build and runtime.
[Official image metadata](https://github.com/docker-library/official-images/blob/master/library/node).

Docker recommends digest pins for reproducible inputs while acknowledging that
pins require active security maintenance. Resolve the actual index and architecture
manifest, execute the base, then compare the packaged binary and components.
The tag alone is insufficient. Preserve scoped container restrictions and retire
owned resources rather than pruning this shared engine.
[Docker build guidance](https://docs.docker.com/build/building/best-practices/).

W3C Secure Contexts treats loopback as potentially trustworthy for development;
that exception is not evidence of encrypted production transport. Keep default
certificate verification and real trusted/mismatched/untrusted TLS controls.
The opened specification is a Candidate Recommendation Draft, not a claim of
complete application conformance.
[W3C Secure Contexts](https://www.w3.org/TR/secure-contexts/).

Random selection from five opening PRs chose Dependabot #68's ten-update dev
group. Its two-file delta changes Vue/Router, Vite/Rolldown, Playwright, lint and
language-server consumers, including transitive JSON-RPC and optional WASI
fallback packages. Development classification does not make these irrelevant to
the built client. Test actual compiler/server protocols, Windows and musl builds,
and built browser journeys before adoption; preserve the exact PR head separately
from the subsequent root engine-floor changes.
[Selected PR](https://github.com/cloudbyday90/Harmoniarr/pull/68),
[Vue tooling changes](https://github.com/vuejs/language-tools/blob/master/CHANGELOG.md),
[Vite releases](https://github.com/vitejs/vite/releases),
[Playwright releases](https://github.com/microsoft/playwright/releases).

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Retain 24.22.1 | Avoid rebuild | Omits published security fixes; rejected |
| Patch to 24.22.3 with exact pins | Supported line; smaller migration; reviewed vendor fixes | Runtime and native proof must be refreshed; selected |
| Move application to Node 26 LTS | Longer support horizon | Larger compatibility change; separate future work |
| Change only version strings | Small diff | Leaves lock/runner drift and no execution proof; rejected |
| Adopt selected dev group after actual consumer proof | Maintained tooling and client dependencies | Wider build/browser/protocol scope; conditional on checks |

Recommended stack: verified Node 24.22.3, npm 12.0.2, matching Alpine 3.23
digest pins, shared baseline checks, existing ESM services, default TLS identity,
fresh packaged consumers and scoped cleanup. Preserve historical measurements
as historical; do not transfer 24.22.1 speed or retained-memory claims.

The final audit retains nine moderate development-tool findings, also present in
the opening lockfile, with zero production and no high/critical findings. Passing
the high-severity gate does not mean vulnerability-free. Glob cancellation and
minimatch amplification need separate reviewed toolchain/override maintenance;
do not force npm's suggested major changes or Testcontainers downgrade here.
[Glob advisory](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4),
[minimatch advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249).
