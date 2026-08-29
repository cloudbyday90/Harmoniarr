# CI npm Toolchain Alignment — Outcome

**Status:** Toolchain confirmed remotely; browser-suite correction pending remote confirmation
**Date:** 2026-08-29

## Delivered result

Harmoniarr's dependency-installing CI jobs now share one local ESM-tested npm
toolchain action. It configures the existing Node 24 LTS target and npm cache,
then installs the already-declared exact npm 12.0.2 before `npm ci`.

The root install-script policy now explicitly denies the optional `fsevents`
install script. Strict enforcement remains enabled, so any future dependency
script without a recorded decision still fails installation.

## Validation record

Local validation passed both the previously failing Node 24/npm 11 strict
policy path and the selected Node 24/npm 12 CI path, focused contracts, the
full repository validation suite, npm audit, and registry-signature checks.

The first remote Browser Validation run on the implementation commit confirmed
the toolchain correction: pinned Node setup, npm 12.0.2 bootstrap, strict
`npm ci`, and Chromium installation all passed. The job later exposed three
pre-existing browser-suite issues; its evidence summary and artifact were
published successfully. Those browser corrections are documented separately
in [Browser Validation CI Compatibility Design](BROWSER_VALIDATION_CI_COMPATIBILITY_DESIGN.md).

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
