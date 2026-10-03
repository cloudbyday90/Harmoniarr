# October dependency security update outcome

Implemented October 3, 2026. See the separate
[design](DEPENDENCY_SECURITY_UPDATE_2026_10_DESIGN.md) for discovered official
advisories, dependency paths, alternatives, and the selected approach.

## Changes

| Package | Previous installed version | Final installed version | Resolution |
| --- | --- | --- | --- |
| `@grpc/grpc-js` | 1.14.4 | 1.14.5 | Compatible transitive lockfile update |
| `brace-expansion` | 5.0.9 | 5.0.12 | Raise the existing exact override |
| `undici` | 8.10.0 | 8.11.2 | Compatible transitive lockfile update |

The final manifest/lockfile diff contains only these three packages and the
existing override change. No new override, top-level dependency range change,
major upgrade, first-party CommonJS file, runtime upgrade, or advisory
suppression was introduced. All remain development dependencies.

## Commands and evidence

```powershell
npm.cmd audit --json
npm.cmd ls @grpc/grpc-js brace-expansion undici
npm.cmd audit fix --dry-run --json
npm.cmd pkg set overrides.brace-expansion=5.0.12
npm.cmd audit fix
npm.cmd run validate:security
```

The initial security command failed with three high-severity advisory-bearing
packages. The raw audit additionally identified minimatch as a dependency
effect of brace-expansion. The non-forced fix changed exactly three packages
and reported zero vulnerabilities across 454 audited packages.

The final security gate passed with zero reported vulnerabilities. Both
Compose image-tag and single-node topology checks passed. `npm ls` confirmed
the patched packages under Testcontainers/Dockerode/Archiver and ESLint.
Registry engine metadata is compatible with the verified local Node
`v24.18.1` and the supported repository range. Combined application, lint,
PostgreSQL integration, and build results are recorded in the
[Missing Music outcome](MISSING_MUSIC_SEARCH_AGAIN_OUTCOME.md).
`npm.cmd run validate` passed 8,623 tests with zero failures/skips, all
policy/lint checks, and both builds, exercising the updated development/test
tooling against the application and real PostgreSQL sessions.

## Recommendation and limits

Retain this narrow compatible update and continue running the current security
gate before substantial commits. Remove or reconsider the existing brace
override when all parent constraints naturally admit a patched version; it
still requires compatibility ownership across its consumers.

An audit is a time-bound registry advisory check. This result does not prove
that no vulnerabilities exist, establish runtime exploit reachability, audit
Node's bundled HTTP client, or audit historical third-party action bundles
used in the local PR replay. No release or published image was created.
