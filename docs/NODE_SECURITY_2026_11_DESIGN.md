# Node security maintenance design — November 2026

Follow the [official research and tradeoffs](NODE_SECURITY_2026_11_RESEARCH.md).
Implement on main without a release, deployment or new application service.

## Coordinated owners

Align .nvmrc, package and root lock engine floors, the application Node image,
canonical-media runner and native signal/folder assertions to 24.22.3. Keep npm
12.0.2 and Alpine 3.23. Verify the official Windows binary checksum and actual
OCI manifests before selecting immutable inputs; use a repository-local PATH
instead of changing the machine installation.

Extend the existing small ESM baseline policy to require lockfile root-floor and
canonical-media image agreement. The signal lane should consume that policy's
canonical image instead of maintaining a second escaped version regex. Preserve
its cancellation, error identity, ownership and retirement behavior.

Qualification exposed an existing observer gap: the admission wrapper is not the
bare pg connect method. Recognize only its privately owned data descriptor and
native delegate, keeping admission active. Reject foreign, replaced, accessor
and borrowed wrappers. Verify busy refusals do not invent queue/client attribution
and restoration preserves admission. Use controlled clocks and explicit gates
for synthetic deadline tests; leave production timeout policy unchanged.

Adopt #68's exact reviewed package delta only after verifying its immutable head
against current main. Preserve all production npm resolutions. Apply the Node
engine-floor edits separately and record both changes. Inspect published packages
and transitive protocol/bundler owners; retain scripts-disabled installation where
practical. No bot PR is merged, and closing an implemented PR follows the main push.

## Qualification boundaries

Run focused stale-floor/image drift refusals, signal ownership, runtime DNS/Brotli,
TLS fixtures and HTTP/request context tests. Exercise actual language-server
initialize/document/tsserver bridge/shutdown/close, lint and compiler builds.
Freeze source and package hashes for one complete fast gate and affected native
work. Verify selected paths before execution; do not count silently ignored globs.

Rebuild the application through its canonical Dockerfile and execute fresh/restart
startup, schema health, protected request and backup/restore controls in disposable
data. Compare actual Node binary, component and npm inventories with the reviewed
base and source. A changed OS package or static client must be reported, not hidden
under an unchanged-runtime assertion.

Refresh real provider HTTPS and PostgreSQL TLS acceptance/refusal/socket-close,
pg query/startup/request attribution, HTTP session/CSRF, built browser journeys,
packaged parser/cover and native Linux signals. Include native folder success,
paging/refusal/cancellation on the new runtime. Retain previous performance
percentages only as historical; a new compatibility run is not a matched speedup
study or long-running memory plateau.

Preserve the existing stopped walkthrough's identity, state, image, ports and five
private mounts. Use owned disposable fixtures, restrictive inspected resource
limits, immutable image IDs and acknowledged retirement. Remove only verified
task-owned intermediates; keep one current candidate, protected baseline and
compact reproduction/failure evidence. Network/NAS and physical assistive checks
remain deferred by the user.

After qualification, the next component work is repeated browse/cancel cycles in
one persistent built-in service, checking capacity reuse, idle handles and retained
memory over time. No second daemon, automatic tuning or forced GC policy is added.
