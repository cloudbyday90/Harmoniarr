# Dependency and Toolchain Update — August 2026

Status: Implemented and validated
Date: 2026-08-22
Owner: Platform engineering

## Scope

This record covers the requested npm/npx and `glob` review performed alongside
the Artist Detail SWR-cache work. It also records small, compatible
lockfile-level security remediations found by `npm audit`.

## Authoritative Sources

- [npm exec documentation](https://docs.npmjs.com/cli/npm-exec/) identifies
  npm 12.0.2 as the current documentation version and states that the
  standalone `npx` package was deprecated when its behaviour moved into npm.
- [npm npx documentation](https://docs.npmjs.com/cli/v12/commands/npx/) states
  that `npx` uses the npm it ships with. A separate `npx` dependency would
  therefore create an unnecessary, potentially divergent execution path.
- [glob on npm](https://www.npmjs.com/package/glob) identifies 13.0.6 as the
  current release and documents its native ESM import form.
- [archiver on npm](https://www.npmjs.com/package/archiver?activeTab=versions)
  identifies 8.0.0 as a new major release. It is not a safe implicit upgrade
  for Testcontainers, which currently declares `archiver` 7.x.

## Findings

- The repository already declares and locks the direct `glob` dependency at
  13.0.6, so no direct version increase is available.
- The only deprecated `glob@10.5.0` is transitive:
  `@testcontainers/postgresql` → `testcontainers` → `archiver@7` →
  `archiver-utils@5` → `glob@10`.
- Testcontainers 12.1.0 is the current compatible release and still declares
  `archiver@^7.0.1`. Forcing `glob@13` or `archiver@8` through a global npm
  override would violate an upstream semver contract. `glob` 13 also moves its
  CLI into a separate package, which increases that compatibility risk.
- The audit found three high-severity issues. `brace-expansion` can be fixed
  by its compatible 5.0.9 patch; `nanoid` and the root `minimatch` can advance
  within the ranges already declared by their parents.

## Decision

1. Pin the repository package manager to npm 12.0.2. This also pins the
   bundled `npx`; do not add a standalone `npx` dependency.
2. Express the Node 25.4 and npm 12 compatibility windows with valid semver in
   `engines` and `devEngines`. This preserves the Node target while allowing
   npm to enforce the declared package-manager policy correctly.
3. Keep direct `glob` at its current 13.0.6 release.
4. Do not introduce a semver-violating global override for the transitive
   `glob@10`. Track it for replacement when Testcontainers updates its
   supported archive stack.
5. Update the safe `brace-expansion` override and compatible lockfile entries
   reported by the audit. Do not enable unreviewed lifecycle scripts as part
   of this update.

## Outcome

- `packageManager` now pins npm 12.0.2. The bundled `npx` follows the same
  version without adding a standalone dependency.
- The package-manager and runtime policies use valid semver ranges while
  retaining the existing Node 25.4 support boundary.
- The direct `glob` dependency remains current at 13.0.6. The remaining
  deprecated transitive `glob@10.5.0` is documented and deliberately not
  overridden across Testcontainers' upstream major-version boundary.
- `brace-expansion` is pinned to 5.0.9, and the lockfile advances compatible
  `nanoid` and `minimatch` fixes. `npm ci` and `npm audit` report zero known
  vulnerabilities.
- Full `npm run validate` passed after applying the local, uncommitted changes
  from Dependabot PR #39.

The installation kept three unreviewed lifecycle scripts blocked; no package
was approved merely to silence install output.
