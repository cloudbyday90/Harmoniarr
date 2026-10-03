# October dependency security update design

Status: Accepted for implementation
Research date: October 3, 2026

## Trigger and scope

The required `npm run validate:security` gate failed during Missing Music
implementation. Its report identified three high-severity advisory-bearing
packages: `@grpc/grpc-js`, `brace-expansion`, and `undici`. The raw npm audit
also lists `minimatch` as affected through brace-expansion; this is a dependency
effect rather than a fourth independent vulnerable implementation.

`npm ls` places these packages under Testcontainers/Dockerode/Archiver and
ESLint. They are development dependencies. The runtime Docker stage uses
`npm ci --omit=dev`. This inventory does not demonstrate that the advisory
conditions are reachable in Harmoniarr, nor does it audit Node's bundled HTTP
client. Keeping local and CI tooling patched is still part of the security
baseline.

## Official research

Advisory URLs came from npm's audit response. The web tool followed their
maintainer advisory and release links. GitHub MCP fetched the official Undici
release metadata. npm registry metadata confirmed patched versions and their
Node engine requirements; no source URL was invented.

| Official source | Finding and recommendation |
| --- | --- |
| [gRPC maintainer advisory](https://github.com/grpc/grpc-node/security/advisories/GHSA-m9gg-hp2v-232j) | Certain server certificate/auth-context configurations can accept unauthorized certificates. Update the installed 1.14.4 to patched 1.14.5. |
| [brace-expansion maintainer advisory](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-q2hr-2g5m-vwhr) | Crafted brace patterns can stall expansion. Version 5.0.12 closes this advisory as well as the earlier affected versions reported by audit. Raise the existing exact override from 5.0.9. |
| [Undici maintainer advisory](https://github.com/nodejs/undici/security/advisories/GHSA-w293-vg96-wgc3) | BalancedPool can drop custom TLS verification options; the patched 8.x baseline is 8.10.2. |
| [Undici security release](https://github.com/nodejs/undici/releases/tag/v8.10.2) | Also fixes WebSocket termination, cache isolation, and other reported issues. Refresh the installed package within its parent's allowed range. |

The engine floors for gRPC 1.14.5, brace-expansion 5.0.12, and Undici 8.11.2
are compatible with the repository's supported Node 24 runtime. npm's
non-forced audit-fix preview chooses Undici 8.11.2 and gRPC 1.14.5 without
changing top-level dependency ranges.

## Alternatives and decision

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Suppress development advisories | No lockfile change | Leaves local and CI tooling exposed to known defects and fails the existing gate | Reject |
| Force a broad dependency upgrade | Can refresh many packages | Unnecessary compatibility and review scope | Reject |
| Raise the existing brace override and use non-forced compatible audit fixes | Small, reproducible dependency change; preserves parent ranges and runtime support | Existing cross-parent override still needs lint/glob/archive integration evidence | Adopt |
| Add new exact overrides for every transitive package | Explicit versions | Adds long-term override ownership where ordinary dependency resolution already permits the fixes | Defer |

## Validation and outcome boundary

Review the manifest and lockfile diff to confirm only the three intended
packages changed. Run the security gate and all repository validation,
including actual PostgreSQL/Testcontainers integration and both builds.
Those checks exercise the affected tooling contracts rather than reproducing
third-party vulnerability implementations in first-party tests.

Record actual results in a separate outcome document. No release, tag,
published image, runtime upgrade, or PR merge is part of this update.
