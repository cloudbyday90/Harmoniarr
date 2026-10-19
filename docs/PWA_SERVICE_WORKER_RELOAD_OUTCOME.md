# Service worker reload outcome

Date: 2026-10-19. Implements [reload ownership](PWA_SERVICE_WORKER_RELOAD_DESIGN.md)
discovered during [runtime closure](RUNTIME_DEPENDENCY_CLOSURE_OUTCOME.md).

The registration factory now requires its own applyUpdate request before a
controller change reloads the document. Initial claim and sibling-tab activation
preserve form state; an explicit update still reloads once. A failed postMessage
preserves its original failure and does not authorize a later unrelated reload.

## Reproduction and evidence

The package-only image passed builds, physical inventory and selected host browser
checks, but three packaged login collections stopped before a login request.
The diagnostic collection found direct HTTP login 200, two GET /login loads,
an empty username, a populated password and native invalid on username. No
JavaScript or asset error explained the missing submission. Source tracing found
unconditional reload after first clients.claim. Normal host browser app fixtures
block service workers and therefore could not cover this lifecycle.

Updated unit cases fail against the original behavior. The native Chromium
control with the original registration bytes fails because first claim destroys
the document execution context. The fixed implementation preserves the document
marker, draft and focus through a held first installation and an actual update
activated by a sibling; the requesting tab reloads. The fixture uses the real
worker source with a test-only version comment, a controlled shell-precache gate
and a minimal page. It does not claim full application or cross-browser coverage.

The focused PWA/cache/manifest/composable set plus native browser case passed
72 cases before the lint-only fixture correction. The first broader gate caught a
shadowed fixture variable and unqualified browser document references; these
test-only lint issues were corrected before the final source freeze.

Final source: 3,046 source/configuration files, SHA-256
0667a3f55fd9fa420d84c0d9986112c4d2f83ba80cc4308bcd29cbdb2609e5b8.
The final fast gate passes 10,537 cases with lint, policy checks and both builds.
The native lifecycle case passes in 2.0s, alongside default-CSRF submission and
nested lazy/history navigation in the selected three-case browser collection.
Four native HTTP/session/CSRF cases pass separately. Every selected collection
retains unchanged final source and browser-asset hashes, with no skips or
cancellations. These are selected gates, not the complete integration/browser
inventory or a measured CI speed improvement.

The final no-cache Linux/amd64 image passes actual packaged browser login and
lazy settings navigation in fresh-install and existing-data-restart phases,
with service workers enabled. Both retain the same document through first
claim and report no script or asset errors. The collection preserves native
form requirements; it neither blocks workers nor waits for readiness before
filling credentials. The [local rebuild outcome](LOCAL_DOCKER_RUNTIME_CLOSURE_OUTCOME.md)
records image identity, lifecycle/persistence/cleanup and walkthrough readiness.

## Boundaries

No credential draft is saved to storage and no browser validation is bypassed.
This fixes unintended reload, not cache-version compatibility, offline login or
service-worker update coordination across old/new releases. Safari, Firefox,
screen readers and incompatible future worker migrations are not qualified.
The reusable standards skill now calls out service-worker-enabled controls and
local reload intent, with source/status/evidence links.
