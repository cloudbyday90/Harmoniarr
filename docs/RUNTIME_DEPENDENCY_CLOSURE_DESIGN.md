# Runtime dependency closure design

Date: 2026-10-19. Follow the [Node baseline outcome](NODE_24_BASELINE_OUTCOME.md).
The Node security patch remains announced for October 21; it is not published
as of this consultation. Progress the independently actionable runtime closure
finding while retaining the explicit security-release follow-up.

## Owner and change

Harmoniarr builds the Vue/Router client into static assets in a dedicated Docker
builder. The Node server copies its ESM source and serves those assets; server
and shared source do not import Vue or Router. Both client packages are currently
production dependencies, retaining compiler, Router plugin and bundler packages
through npm's peer graph even with npm ci --omit=dev.

Move vue and vue-router to devDependencies without changing their ranges or
installed versions. Regenerate classification metadata with installed npm 12.0.2
and refuse unrelated artifact/version/resolution/integrity changes. Keep all
five server production dependencies, both builder installs, existing runtime
npm ci --omit=dev and Node/Alpine pins. Do not delete individual node_modules
directories, omit all optional/peer packages or change the browser architecture.

No application service, route, dependency registry or extra production checker
is needed for this manifest correction. Keep validation at the actual artifact
boundary rather than adding tests that merely repeat package.json wording.

Packaged validation subsequently exposed an independent first-install service
worker reload that erased login input. The [reload design](PWA_SERVICE_WORKER_RELOAD_DESIGN.md)
owns that narrow correction and its native browser test. Preserve the earlier
package-only artifact comparison separately from the final changed browser code.

## Evidence and applicability

Inventory physical packages in the retained qualified Linux/amd64 baseline image
and the new image using an owned disposable container, separate from logical npm
ls output. Record exact image identity, installed package paths/versions, missing
build-tool imports, app node_modules allocated size and client asset hashes.
The baseline is a negative control for an absent-build-tools assertion.

Require unchanged package artifact identities, complete client builds, focused
existing packaging tests and the final fast gate. Execute selected native HTTP
and built-browser cases; build the new app image and verify actual packaged UI,
fresh/restart, persistence, backup/restore and cleanup using existing fixtures.
Compare before/after source and package bytes. Do not equate package reduction
with demonstrated exploitability, image CVE remediation or whole-CI speedup.

Fresh random PR 50 selection has the same immutable head already rejected under
the same Node/Vue/Playwright versions. Record that it is inapplicable unchanged;
do not repeat an identical installation or merge a known failing candidate.
The [research](RUNTIME_DEPENDENCY_CLOSURE_RESEARCH_2026_10.md) and
[outcome](RUNTIME_DEPENDENCY_CLOSURE_OUTCOME.md) detail decisions and actual scope.
