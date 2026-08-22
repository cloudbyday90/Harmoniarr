# Supply-Chain Install-Script Policy and Build-Action Pin Refresh

## Finding

The Docker builders use npm 12. A clean build reported three transitive
install-time lifecycle scripts as unreviewed:

- `cpu-features@0.0.10` compiles an optional native CPU-feature binding.
- `ssh2@1.17.0` attempts to compile an optional native cryptography binding.
- `protobufjs@7.6.5` checks whether a consuming project follows its preferred
  dependency-version scheme and only writes a warning when it does not.

All three packages are reached through the development-only Testcontainers
tooling. The application, its test suite, and the image build already succeed
with these scripts blocked. They are therefore not required for a correct
Harmoniarr installation.

The repository also had Dependabot PR #24 open. It proposed advancing
`docker/build-push-action` from v7.1.0 to v7.2.0. The official Docker release
page now identifies v7.3.0 as the current release and its verified full commit
SHA. Applying the stale PR as-is would leave the action behind the current
stable release.

## Implemented Design

1. Record explicit denials for the three reviewed package identities in
   `package.json`'s `allowScripts` field.
2. Add project-scoped `strict-allow-scripts=true` in `.npmrc`. Any future
   dependency with an unreviewed install script now fails installation instead
   of merely producing a warning; explicitly denied scripts remain silently
   blocked.
3. Copy the non-secret `.npmrc` into each Docker dependency-install stage, so
   local and image builds enforce the same policy.
4. Apply the intent of Dependabot PR #24 locally, without merging it: replace
   the previous v7.1.0 `docker/build-push-action` SHA with the current,
   verified v7.3.0 full SHA.

No application runtime code changes, CommonJS modules, broad script approval,
or secrets are introduced. This policy only controls dependency lifecycle
scripts executed during installation.

## Options Considered

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Allow all three scripts | Removes build notices and enables optional native acceleration | Executes unneeded third-party code during install | Reject |
| Continue with npm's default warning-only blocking | Safe for the current tree | A new unreviewed script can be missed in routine build output | Reject |
| Explicitly deny reviewed scripts and fail closed for new ones | Preserves the verified build path and makes script review mandatory | A future dependency script requires an intentional review/update | Implemented |
| Merge PR #24 unchanged | Incorporates its action update | Pins a now-superseded v7.2.0 release | Reject |
| Apply PR #24 locally and advance to current v7.3.0 pinned SHA | Keeps the Dependabot change local, current, and reproducible | Requires release-SHA verification | Implemented |

## Security Controls

- npm denies install-time dependency scripts by default unless they are reviewed
  and allowlisted. This repository records explicit denials for the reviewed
  nonessential scripts and treats any newly introduced script as a failure.
- `.npmrc` contains only the policy flag, no registry endpoint or credential.
- Docker applies the policy in client, server, and production dependency
  installation stages.
- The GitHub Action remains pinned to an exact 40-character commit SHA, not a
  mutable tag. The release source verifies the selected v7.3.0 commit.
- `npm audit` and registry-signature validation remain required checks; script
  denial is a complement to, not a replacement for, dependency vulnerability
  review.

## Validation Plan and Outcome

Completed on 2026-08-22:

- A clean `npm ci` completed without lifecycle-script warnings. `npm config get
  strict-allow-scripts` returned `true`, and `npm install-scripts ls --json`
  returned an empty allowlist, confirming there are no pending scripts.
- The focused release workflow contract (`node --test
  test/scripts/release-image-workflow-contract.test.js`) passed all 10 tests.
- `npm run validate` passed, including copyright, migration, schema snapshot,
  ESM, image-tag, lint, unit, client, script, integration, and production-build
  checks. The database integration segment passed all 31 tests.
- `npm run validate:security` reported zero npm audit vulnerabilities. `npm
  audit signatures` verified 453 package signatures and 88 attestations.
- `docker compose -f compose.walkthrough.yaml build harmoniarr` completed using
  the Dockerfile stages that copy `.npmrc`; `up -d --wait --no-build` reported
  the recreated service healthy; and the walkthrough bootstrap completed with
  its existing local administrator recognized.

## Official Sources

Sources accessed on 2026-08-22:

- [npm configuration: allow-scripts and strict-allow-scripts](https://docs.npmjs.com/using-npm/config/)
- [npm install-scripts](https://docs.npmjs.com/cli/v11/commands/npm-install-scripts/)
- [GitHub Actions security hardening](https://docs.github.com/en/code-security/tutorials/secure-your-organization/protect-against-threats)
- [Docker build-push-action releases](https://github.com/docker/build-push-action/releases)
