# CI npm Toolchain Alignment — Outcome

**Status:** Local validation complete; remote confirmation pending
**Date:** 2026-08-29

## Delivered result

Harmoniarr's dependency-installing CI jobs now share one local ESM-tested npm
toolchain action. It configures the existing Node 24 LTS target and npm cache,
then installs the already-declared exact npm 12.0.2 before `npm ci`.

The root install-script policy now explicitly denies the optional `fsevents`
install script. Strict enforcement remains enabled, so any future dependency
script without a recorded decision still fails installation.

## Validation record

Remote GitHub Actions confirmation will be added after the implementation
commit is pushed. The local validation will cover both the previously failing
Node 24/npm 11 strict-policy path and the selected Node 24/npm 12 CI path,
plus the repository's focused contracts and standard validation suite.

## Open PR assessment

No open PR is applicable to this change:

- PR #24 is stale because `main` already pins a newer
  `docker/build-push-action` release.
- PR #40 moves a controlled fixture to Node 26, outside Harmoniarr's supported
  Node 24 range.
- PR #41's dependency revisions are already present on `main`.

No PR was merged or applied locally.

## Next recommended item

After a successful fresh Browser Validation run, collect and review evidence
from ten representative successful runs before considering any browser-worker
concurrency change.
