# Astra review — November Node security maintenance

Astra performed a read-only review of current official releases, runtime owners,
application transports, package deltas and published tooling implementations.
The primary agent owns implementation and executed results in the separate
[outcome](NODE_SECURITY_2026_11_OUTCOME.md).

The recommendation is Node 24.22.3/npm 12.0.2 on matching Alpine 3.23 pins.
Node 26 is now LTS; staying on 24 limits migration scope rather than implying
that 26 is unsupported. Include 24.22.2's V8 and parked-write context changes.
No production HTTP/2 or TLS-server entry was identified. Fresh fixed-policy
HTTPS agents reduce the applicability of cross-policy session reuse, but do not
establish immunity. Vendor adoption and selected consumer proof are distinct.

Accepted gaps: check root lock engines and the independent canonical-media image
through the existing ESM baseline policy, and remove the signal lane's escaped
version regex authority. Preserve stricter canonical execution admission,
Error/null identity, cancellation and actual container retirement.

The #68 published review found JSON-RPC 10 queue/close/buffer changes without a
removed stdio API used here; changed Volar error handling can return empty values
after logging. Probe meaningful symbols/types, unexpected stderr and real close.
Vue's changed template typing requires script Ref versus unwrapped template hover,
an invalid member diagnostic and correction through an incremental CRLF edit.
Initialization or constant hover alone misses those paths.

Rolldown can fall back to WASI after native load failure. Record the actual loaded
Windows and Alpine-musl native target/version and relevant NAPI_RS overrides;
a successful build alone does not identify the binding. New optional beta WASI
dependencies are not thereby qualified. Vite's changed published HTML parsing
also warrants actual built lazy-router/requester/folder browser journeys with
the updated Playwright browser.

No static blocker was found; adoption remains conditional on executed consumers.
Refresh packaged HTTP/provider/artwork transport, PostgreSQL TLS/write attribution,
parser/media, folder and signal proof. Inventory changed OS components separately.
Keep prior timings and immediate-GC observations historical. Preserve the stopped
walkthrough and private mounts, and perform no release or rollout.
