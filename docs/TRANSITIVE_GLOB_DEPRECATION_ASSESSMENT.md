# Transitive Glob Deprecation Assessment

## Finding

The local walkthrough image build emits a deprecation warning for
`glob@10.5.0`. Dependency inspection traces it to the development-only test
container stack:

```text
@testcontainers/postgresql@12.1.0
  -> testcontainers@12.1.0
  -> archiver@7.0.1
  -> archiver-utils@5.0.2
  -> glob@10.5.0
```

Harmoniarr already directly uses `glob@13.0.6`. The deprecated copy is not in
the production runtime image because production installation uses
`npm ci --omit=dev`; it appears only in the server-builder stage that installs
development dependencies to build the server. The same local build completed
with zero audit vulnerabilities.

## Research and Compatibility Assessment

Research was refreshed on 2026-08-22 using the official npm documentation and
registry package pages. `glob@13.0.6` is the current stable release. Its
documented CommonJS interface retains the `glob.sync()` alias used by
`archiver-utils@5.0.2`, so this consumer is compatible with the resolved API.

The preferred upstream upgrade path is not currently safe to force. The
current Testcontainers package continues to declare `archiver@^7.0.1`, and its
published JavaScript imports Archiver through CommonJS. Archiver 8 is ESM-only,
so overriding that intermediate major would risk breaking the test container
archive path. We must not replace it merely to remove a warning.

## Implemented Decision

Add a root-level, nested npm override that applies only to the affected edge:

```json
"overrides": {
  "archiver-utils": {
    "glob": "13.0.6"
  }
}
```

The exact version prevents an accidental downgrade within the override. npm
supports root-level overrides for transitive dependencies; keeping this rule at
the root lets `npm ci` create a deterministic, reviewed lockfile. A clean
lockfile regeneration resolves the graph as:

```text
@testcontainers/postgresql@12.1.0
  -> testcontainers@12.1.0
  -> archiver@7.0.1
  -> archiver-utils@5.0.2
  -> glob@13.0.6 (deduplicated)
```

This repository is ESM (`"type": "module"`). No application module is
converted to CommonJS; the compatibility check deliberately verifies the one
CommonJS third-party consumer retained by Testcontainers.

## Options

| Option | Benefits | Risks | Decision |
| --- | --- | --- | --- |
| Scoped `archiver-utils > glob@13.0.6` override | Removes the deprecated dependency and preserves the known `glob.sync()` interface | A temporary major-version exception needs revalidation when Testcontainers changes | Implemented |
| Force Archiver 8 | Uses the newest Archiver release | Current Testcontainers requires Archiver through CommonJS; Archiver 8 is ESM-only | Reject |
| Remove Testcontainers | Removes the dependency chain | Loses container-backed integration coverage | Reject |
| Update Testcontainers | Preferred upstream remediation when it removes the old Archiver chain | Current latest release retains the chain | Monitor |

## Recommendation Stack

1. Keep the scoped override and the reviewed lockfile.
2. Run `npm ci` in CI and retain dependency signature/audit validation.
3. Reassess on each Testcontainers update; remove the override when its
   supported Archiver line no longer needs it.
4. Do not force Archiver 8 until Testcontainers publishes an ESM-compatible
   release and its archive path passes integration testing.

## Security Outcome

`npm ci --ignore-scripts` completes with no Glob 10 deprecation warning and
`npm ls glob` resolves the Testcontainers path to `glob@13.0.6`. An ESM import
check confirms both the Archiver Utils file-expansion API and Testcontainers'
`GenericContainer` remain available. `npm run validate` completes successfully,
including the ESM guard, lint, test, integration, and production-build stages.
`npm run validate:security` reports zero vulnerabilities, while `npm audit
signatures` verifies 453 registry signatures and 88 provenance attestations.
The rebuilt walkthrough Compose image is healthy and its bootstrap check
completes successfully.

## Official Sources

Sources accessed on 2026-08-22:

- [npm package.json: overrides](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#overrides)
- [npm audit documentation](https://docs.npmjs.com/cli/audit/)
- [@testcontainers/postgresql package](https://www.npmjs.com/package/@testcontainers/postgresql)
- [Testcontainers package versions](https://www.npmjs.com/package/testcontainers?activeTab=versions)
- [Archiver package versions](https://www.npmjs.com/package/archiver?activeTab=versions)
- [archiver-utils package](https://www.npmjs.com/package/archiver-utils)
- [Glob package](https://www.npmjs.com/package/glob)
