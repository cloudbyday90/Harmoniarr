# Node 24 security patch design

The October 21, 2026 Node 24.22.1 security release supersedes the project's
24.22.0 validation baseline. Update the runtime without changing application
frameworks, npm, database schema, provider policy or release behavior.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Node 24.22.1, checksum-verified local executable and digest-pinned Alpine image | Published security fixes within the existing LTS line; small compatibility scope | Requires native consumer qualification and explicit future patch maintenance | Adopt |
| Floating Node 24/LTS image | Automatically follows published tags | Build drift can escape reviewed source/evidence | Reject |
| Move to Node 26 | Another patched release line | Adds major-version and packaging changes unrelated to this fix | Defer |
| Add application workarounds or relax TLS checks | Could hide a compatibility symptom | Does not replace the vendor patch; weakens identity or duplicates core behavior | Reject |

Recommended stack: Node 24.22.1 + npm 12.0.2; matching Alpine 3.23 families with
immutable image defaults; existing modular ESM services and PostgreSQL 18; default
TLS verification; authoritative runtime/policy checks and selected native tests.

## Pin and artifact owners

`.nvmrc` remains the exact canonical validation pin. Package engines/devEngines
and lockfile root metadata raise their supported floor to that patch. Existing
CI setup-node consumers already read `.nvmrc`; their workflows and pinned actions
need no unrelated edits. The Node baseline guard must reject 24.22.0 explicitly.
The application engines range is metadata; it is not a new startup enforcement
mechanism for every direct invocation.

The Docker Node index digest is discovered through actual registry inspection,
with amd64/arm64 manifests distinguished from attestations. Preserve the Alpine
runtime family and existing pinned runtime image. Executing the rebuilt runtime
proves its version; tags alone do not. Local Windows validation uses a separate
ignored, release-checksum-verified executable and an unchanged npm 12.0.2 copy.
No OS-wide Node installation is replaced.

The isolated Linux signal runner and its checkpoint assertions contain an exact
reviewed Node patch and must move together. Retain its network isolation, resource
limits, mounted-file ownership and verified cleanup.

## Qualification

Freeze code/configuration and package-lock bytes before final tests. Preserve
old/new controlled results. The new DNS regression uses an owned loopback UDP
resolver and requires rejection before dispatch; no external DNS traffic.
Repeated valid Brotli HTTP responses exercise bundled fetch/decompression with
actual response consumption. These tests do not establish every advisory's
exploitation conditions or reproduce a malformed Brotli exploit.

Use existing real PostgreSQL TLS DNS/IP acceptance, mismatch and untrusted-CA
refusal, driver serialization and HTTP/session/CSRF consumers. Preserve default
verification and prove native connection/socket retirement. Built UI checks cover
actual protected submission and lazy navigation. Run the explicit isolated Linux
signal lane. Finish one stable fast gate and compare its rebuilt client assets.

Rebuild Docker without cache following the preserved walkthrough. Compare app
bytes/modes and dependency inventories, verify actual Node/npm, retain admin/data
and all mounts. A separate disposable canonical packaged proof covers fresh
installation, protected requests, backup/restore and existing-data restart.
Do not infer hosted CI, arm64 execution, live-provider compatibility, full WCAG
conformance or complete image security from these selected checks.

See [official research](NODE_24_SECURITY_PATCH_RESEARCH_2026_10.md) and
[outcome](NODE_24_SECURITY_PATCH_OUTCOME.md).
