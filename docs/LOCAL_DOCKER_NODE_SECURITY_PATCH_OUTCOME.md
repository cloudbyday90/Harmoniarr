# Local Docker Node security patch outcome

Completed October 21, 2026 following the preserved-installation path in
[LOCAL_DOCKER_WALKTHROUGH.md](LOCAL_DOCKER_WALKTHROUGH.md), with separate
disposable canonical packaged qualification. No image was published or released.

Previous local image:

```text
sha256:5bdf56a9b9811c22cf76bab8243a980952301ad7dc5c9b7db83236d8de6ec5bf
```

Current local image:

```text
sha256:de1675ac7882d8684a667afa11872c162cae3e61904f9fa5717b30a54f0ca66c
```

An invocation-owned BuildKit builder rebuilt the pinned Dockerfile using
`--pull --no-cache --load`, then was removed and retirement verified. Read-only,
network-disabled inventory containers were also retired. A temporary collector
syntax failure before build was retained separately; it did not recreate the app.

## Preserved installation

Compose recreated the walkthrough app using `up -d --wait --no-build`. The app is
healthy, read-only, Linux x64/UID 1000 and bound to `127.0.0.1:47956`. Its actual
runtime is **Node 24.22.1**, with npm **12.0.2**, OpenSSL **3.5.9** and bundled
Undici **7.30.1**. The Node binary SHA-256 is
`569128f3066ac7be59b10b9a0adef708def642ee37cbf9d560a9bdb68f872108`, matching
an independently executed container from the pinned official Node base index.

All five bind mount source/destination/access records match, including the actual
completed-download host override. Existing admin/data were retained. The one-shot
bootstrap helper confirmed the existing admin and was removed. Startup applied
**zero migrations**, verified **112 applied and zero pending**.

Readiness-only browser validation passed with provider/path prerequisites
retained. The temporary password-only file was removed and absence verified.
No provider search, transfer, import or recovery arm was submitted. The existing
local CSRF opt-out remains a walkthrough configuration limit; default-required
protection was qualified separately in native and built-client fixtures.

All **872 server, 155 client and 11 shared** application files and their modes
match the preceding image. Client/shared bytes match the final local build/source.
Root package/lock metadata match the changed source and contain the new engine
floor. The npm dependency inventory remains 110 packages with matching versions;
147 OS package versions also match. The runtime executable and root metadata
changes are distinct from application-code or npm-resolution changes.

## Disposable packaged proof

The exact image ID above was tested through the existing canonical fresh-install
validator with strict cleanup, protected request flow, backup/restore and
existing-data restart enabled. Fresh and restarted service-container inspection
verified that image ID, Linux x64, Node 24.22.1, npm 12.0.2 and UID 1000.
Read-only/media tooling, migration readiness, persisted settings and configured
invalid-startup refusal retained their existing validator checks.

The fixture used separate project/data identity and generated VAPID material.
Its containers, networks, volumes and temporary data were retired through strict
cleanup; an additional project-container lookup was empty. The preserved
walkthrough installation was not used for destructive fixture operations.

This is local packaged evidence, not registry provenance, hosted CI, arm64
execution, live-provider acceptance, a complete image vulnerability scan or a
release qualification. See the [owning outcome](NODE_24_SECURITY_PATCH_OUTCOME.md)
for the final source, DNS reproduction, native TLS/HTTP and browser checks.

Next, qualify the actual provider HTTPS client against an isolated trusted and
untrusted identity fixture, including redirect/compressed-response behavior and
bounded error handling. See [research](NODE_24_SECURITY_PATCH_RESEARCH_2026_10.md)
and [design tradeoffs](NODE_24_SECURITY_PATCH_DESIGN.md).
