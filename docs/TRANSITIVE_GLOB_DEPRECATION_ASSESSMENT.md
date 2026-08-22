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

## Decision

Do not add an incompatible forced `glob@13` override solely to suppress this
warning. `archiver-utils@5.0.2` explicitly depends on the 10.x line, so a
major-version override would replace a tested transitive contract without an
upstream compatibility guarantee. The latest published
`@testcontainers/postgresql@12.1.0` currently resolves the same dependency
chain; there is no compatible direct upgrade to apply.

Continue to retain the root `glob@13.0.6`, lock dependencies with `npm ci`,
and monitor the Testcontainers/Archiver release chain for an upstream fix.
Reassess when the upstream package changes its declared dependency or when an
advisory affects the transitive version. The current warning is technical-debt
noise, not a reported vulnerability or runtime inclusion.

## Options

| Option | Benefits | Risks | Decision |
| --- | --- | --- | --- |
| Force `glob@13` with `overrides` | Removes the warning now | Crosses a declared major-version boundary and can break Testcontainers archive behavior | Reject |
| Remove Testcontainers | Removes the dependency chain | Loses container-backed integration coverage | Reject |
| Update Testcontainers | Preferred upstream remediation | Current latest release retains the chain | No change available |
| Keep root Glob current and monitor upstream | Preserves verified integration behavior and production dependency boundary | Build-time warning remains visible | Implemented |

## Security Outcome

`npm run validate:security` reports zero vulnerabilities. `npm audit
signatures` verifies 468 registry signatures and 87 provenance attestations in
the locked dependency tree. These checks are stronger evidence than treating a
deprecation message as an automatic reason to force an unverified semver-major
override.

## Official Sources

Sources accessed on 2026-08-22:

- [npm package.json: overrides](https://docs.npmjs.com/files/package.json/)
- [npm audit documentation](https://docs.npmjs.com/cli/audit/)
- [@testcontainers/postgresql package](https://www.npmjs.com/package/@testcontainers/postgresql)
- [Testcontainers package versions](https://www.npmjs.com/package/testcontainers?activeTab=versions)
- [Archiver package versions](https://www.npmjs.com/package/archiver?activeTab=versions)
- [archiver-utils package](https://www.npmjs.com/package/archiver-utils)
