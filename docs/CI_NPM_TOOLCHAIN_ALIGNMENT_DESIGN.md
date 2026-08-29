# CI npm Toolchain Alignment — Design

**Status:** Implemented; remote confirmation pending
**Date:** 2026-08-29

## Finding

The first `Browser Validation` workflow run on Node 24.19.0 stopped during
`npm ci`, before Chromium or browser tests ran. Node bundles npm 11.17.0,
while Harmoniarr pins npm 12.0.2. More importantly, the repository's
fail-closed `.npmrc` exposes two optional macOS `fsevents` packages with
unreviewed install scripts. That is the intended policy behavior, but the
root manifest had not recorded an explicit decision for those scripts.

This is CI-toolchain alignment work. It does not change the self-hosted
application runtime, Compose topology, network exposure, accounts, data, or
browser-test concurrency.

## Decision

1. Keep `strict-allow-scripts=true`; do not weaken it or use npm's broad
   allow-all escape hatch.
2. Record `fsevents: false` in `package.json`'s project-scoped
   `allowScripts` policy. `fsevents` is an optional, platform-specific
   dependency and its install script is not required for Linux CI or the
   Harmoniarr application.
3. Add one local composite action for CI jobs that run `npm ci`. It pins the
   existing Node target through `.nvmrc`, preserves npm dependency caching,
   installs the repository's exact `npm@12.0.2`, and prints only the npm
   version for diagnosability.
4. Use that composite action in the browser validation, supply-chain, npm
   audit, and repository-validation jobs. Jobs that only execute already
   checked-in Node scripts retain their existing Node-only setup.
5. Verify the policy and version relationship with a small ESM contract
   module and test, then validate the fresh GitHub Actions browser run before
   using its evidence in the planned ten-run review.

## Options considered

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Disable strict install-script enforcement | Shortest workflow change | Reopens supply-chain script execution without review | Reject |
| Use `--dangerously-allow-all-scripts` | Avoids review decisions | Explicitly bypasses the security control | Reject |
| Deny `fsevents` but keep bundled npm 11 | Fixes the immediate install block | Leaves CI on a package-manager major outside the declared project baseline | Reject |
| Bootstrap npm 12 independently in each workflow | Aligns versions | Duplicates security-sensitive setup and can drift | Reject |
| Explicitly deny `fsevents` and centralize exact npm 12 setup | Fail-closed, reproducible, one review point | Adds a small local composite action | **Adopt** |

## Security and accessibility scope

The composite action uses the already commit-pinned `actions/setup-node` and
an exact npm version. It preserves `npm ci` and the lockfile, has no token,
does not grant workflow permissions, and does not retain data. Explicitly
denied scripts remain blocked; a newly introduced script still stops the
installation until reviewed.

The change only restores the ability to execute the already-scoped browser
evaluation. In the W3C WCAG-EM model, automated browser checks are evidence
for a defined sample, not a conformance claim; human evaluation of requester
and administrator journeys remains necessary.

## Recommendation stack

1. Use Node 24 LTS and exact npm 12.0.2 for every CI job that installs
   Harmoniarr dependencies.
2. Retain a project-scoped strict allowlist; explicitly deny optional scripts
   that are known not to be required.
3. Use `npm ci` with the committed lockfile and `setup-node`'s npm cache.
4. Require the fresh browser CI run to complete successfully before starting
   the planned ten-run evidence review.
5. Review any new dependency lifecycle script as a supply-chain change, not
   as routine build noise.

## Official sources checked 2026-08-29

- [npm `ci`: allow-scripts and strict-allow-scripts](https://docs.npmjs.com/cli/commands/npm-ci/)
- [npm configuration](https://docs.npmjs.com/cli/using-npm/config/)
- [npm install](https://docs.npmjs.com/cli/install/)
- [GitHub Actions: building and testing Node.js](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs)
- [GitHub Actions dependency caching](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching)
- [W3C WCAG-EM overview](https://www.w3.org/WAI/test-evaluate/conformance/wcag-em/)
- [W3C WCAG-EM 2.0](https://www.w3.org/TR/wcag-em-2/)
