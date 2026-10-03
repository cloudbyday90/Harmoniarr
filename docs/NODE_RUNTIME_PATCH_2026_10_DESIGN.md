# Node runtime patch design — October 2026

Status: Accepted for implementation
Research date: October 3, 2026

## Evidence and scope

The application builder and `.nvmrc` select Node 24.19.0. The controlled-provider
fixture has the same starting pin. The current package engine range remains
Node `>=24.15.0 <25.0.0`, with npm 12.0.2 installed explicitly in Docker.

The independently selected open PR #40 proposes Node 26.7.0 for the standalone
fixture. Its local replay and fixture successor have separate design/outcome
documents. The fixture imports Node builtins and does not inherit the app's
engine restriction; it is inaccurate to call that restriction a mechanical
fixture incompatibility.

Official URLs were discovered through GitHub MCP and then opened for review:

- [Node 24.21.0 release](https://github.com/nodejs/node/releases/tag/v24.21.0)
  identifies the September 8 LTS patch and its bundled Undici 7.29.1 and OpenSSL
  3.5.8 updates.
- [Undici advisory GHSA-w293-vg96-wgc3](https://github.com/nodejs/undici/security/advisories/GHSA-w293-vg96-wgc3)
  describes dropped TLS connection options in BalancedPool; patched thresholds
  are 7.29.1 and 8.10.2. The issue depends on custom TLS options and the pool
  configuration. A plain-HTTP fixture test does not demonstrate exploitability.
- [Node release schedule](https://github.com/nodejs/Release/blob/main/schedule.json)
  keeps Node 24 on LTS; Node 26's LTS transition is scheduled for October 28.

Package audit results do not cover Node's bundled Undici. This is a supported
runtime maintenance update, without claiming a demonstrated application exploit.
The consultation date is not the publication date of each source.

## Alternatives

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep Node 24.19.0 | No rebuild | Retains an older bundled component below the advisory's patched threshold | Reject |
| Adopt PR #40's Node 26.7.0 across the application | Matches the PR fixture image | Outside declared app engines; Current rather than LTS; also below the patched Undici 8 threshold | Reject |
| Adopt a current Node 26 patch | Patched Current runtime; useful future compatibility lane | Requires a separate application migration and native-module evidence | Defer |
| Patch within Node 24 LTS to 24.21.0 | Supported engine range, patched bundled component, smaller compatibility change | Requires a rebuilt package and native/runtime checks | Adopt |

## Implementation and validation

Update the Docker builder's exact Node image and `.nvmrc` to 24.21.0. Keep npm
12.0.2 and the declared Node 24 range. Update the current security baseline and
link the historical August policy to this successor rather than rewriting
historical test evidence. The fixture image change belongs to the PR #40 record.

Validate a local packaged image, reporting its actual Node/bundled Undici/npm
versions, native Sharp behavior, embedded PostgreSQL migrations and startup,
health, restart, request flow and backup/restore using the existing isolated
fresh-install smoke harness. Run repository checks and package audit separately.
No global host runtime update, registry publication, release, tag, PR merge, or
hosted workflow dispatch is part of this work.

## Recommended stack and next item

Use Node 24.21.0 LTS, npm 12.0.2, existing ESM services, PostgreSQL 18 and existing
container restrictions. Revisit Node 26 after its LTS transition with an explicit
compatibility lane and native-module tests. Container-image digest/SBOM review is
an additional supply-chain concern; this patch does not claim a full image scan.
