# Node LTS Runtime Policy — August 2026

Status: Implemented and validated
Date: 2026-08-22
Owner: Platform engineering

## Purpose

Harmoniarr previously constrained local and container development to Node
25.4.0. That line reached end of life on 2026-03-31, so it no longer receives
security fixes. The stale range also produced an npm `devEngines` warning on
the available Node 24.18.1 LTS shell.

This document replaces the retired runtime policy with an LTS-aligned,
ESM-compatible baseline while keeping npm 12.0.2 as the repository package
manager.

## Official Source Review

- [Node.js releases](https://nodejs.org/en/about/previous-releases) lists Node
  24 (Krypton) as LTS, Node 25 as end of life, and identifies Node 24.19.0 as
  the latest LTS release at the time of review. Node.js recommends production
  applications use Active or Maintenance LTS lines.
- [Node.js EOL guidance](https://nodejs.org/en/about/eol) explains that EOL
  lines receive no more security fixes and can become vulnerable as ecosystem
  support moves on.
- [npm CLI v12.0.2 release notes](https://github.com/npm/cli/releases?after=v7.5.3)
  identify 12.0.2 as the current stable npm release. npm does not use a
  separate LTS channel; its lifecycle follows the Node.js runtime it ships
  with or is installed alongside.
- The [Node 24.19.0 archive](https://nodejs.org/en/download/archive/v24)
  documents the bundled npm 11.17.0. Harmoniarr must therefore install its
  explicitly pinned npm 12.0.2 in the Node builder stage rather than silently
  falling back to the base image's npm major.

## Options Considered

### A. Retain Node 25.4

Pros:

- No immediate image or configuration edits.

Cons:

- Node 25 is EOL and has no future security fixes.
- It rejects the supported local LTS shell and creates misleading tooling
  warnings.

Decision: rejected.

### B. Move directly to Node 26 Current

Pros:

- Newest runtime features and patches.

Cons:

- Node 26 does not enter LTS until October 2026.
- A production platform should not make its primary compatibility guarantee on
  a Current release when an actively maintained LTS exists.

Decision: deferred until Node 26 becomes LTS and compatibility evidence is
collected.

### C. Use Node 24 LTS with npm 12.0.2

Pros:

- Receives LTS security and maintenance support.
- Compatible with npm 12's documented Node 24 support range.
- Matches the available local development runtime without suppressing a real
  warning.
- Keeps all application and tooling code ESM-only.

Cons:

- Node 24.19.0's base image bundles npm 11.17.0, so Docker must explicitly
  install the repository's pinned npm 12.0.2.
- Requires a planned Node 26 LTS migration later.

Decision: accepted.

## Implemented Stack

1. `engines.node` and `devEngines.runtime.version` permit the npm 12-compatible
   Node 24 LTS range: `>=24.15.0 <25.0.0`.
2. `.nvmrc`, the Docker builder image, and the controlled-provider fixture pin
   Node 24.19.0 as the exact current LTS target.
3. The shared Docker `node-base` stage installs `npm@12.0.2` exactly with
   lifecycle scripts disabled. Client and server builder stages inherit that
   package manager, and the runtime stage copies the same global npm
   installation with Node.
4. `packageManager` remains `npm@12.0.2`; no standalone `npx` package is
   added because `npx` is supplied by npm.
5. Node 26 is the next runtime review item when it enters LTS in October 2026.

## Security Constraints

- Do not run a Node EOL line in production.
- Pin the Docker base to an explicit LTS patch release; Dependabot remains the
  review mechanism for future base-image updates.
- Install the exact npm version in Docker instead of relying on the image's
  bundled package manager major.
- Continue to use `npm ci`, committed lockfiles, zero-vulnerability audit
  checks, and blocked unreviewed lifecycle scripts.

## Outcome

Implemented and validated on 2026-08-22.

- The Node 24.18.1 development shell now satisfies the declared engines and
  emits no `devEngines` runtime warning while npm remains 12.0.2.
- The polling-state regression test passed three consecutive focused runs.
- `npm run validate` passed all 4,076 unit/client tests, 30 serial integration
  tests, the production builds, and every structural check.
- The Node 24.19 Alpine `client-builder` and hardened `node-base` Docker
  targets both built successfully; the latter verified the explicit npm 12.0.2
  installation with lifecycle scripts disabled.
