# Apple signing Docker qualification design

October 28, 2026. Qualifies [signing policy](APPLE_SIGNING_DESIGN.md) in the existing
application, with [outcome](LOCAL_DOCKER_APPLE_SIGNING_OUTCOME.md) kept separate.

Freeze source/test/workflow bytes and run the complete fast gate on pinned Node.
Build the walkthrough with a disposable fresh BuildKit builder, pull/no-cache,
and compare packaged source, dependency, OS, Node binary and client/shared bytes
against the preceding image. Preserve the administrator, five bind sources,
read-only root and loopback 47956. No manual schema refresh or release workflow.

Use the existing guarded Apple native test in a fresh 3 GiB equal memory/swap,
two-CPU, non-root, read-only, network-isolated Linux container with disposable
PostgreSQL/media tmpfs. Public test trust and a fixture-only loopback reroute
preserve original Host/SNI and normal TLS identity verification. Verify new TTL
and real signatures on requests, default saved-key collection access, all catalogue
methods and typed refusal of malformed/RSA/wrong-curve/public saved keys with no
network call. Restore valid material and require healthy recovery. Preserve prior
TLS/body/DNS/cancellation/admission/shutdown controls in that same entry.

Clock/cache boundaries are deterministic focused tests; changing native system
time is unnecessary. Retain unrelated provider/OAuth/Plex/session/media/artwork
qualification only after exact code/test/package/runtime comparison. The prior
unexplained linked-login failure remains a separate record. This task does not
establish a deployment memory minimum or live Apple account acceptance.

For PR #59, verify upstream v4.4.1 tag equals the full pinned SHA and review its
actual main/post bundle. Execute against an owned Buildx builder with inputs that
avoid selecting it as the host default, use an existing CLI and private temporary
configuration, build a local scratch artifact without registry publication, and
verify action cleanup plus builder/container absence. Do not change unrelated
containers, Docker credentials, global configuration or release permissions.

Live readiness/login/automatic diagnostics, bind-write cleanup and reviewed desktop/
mobile screenshots retain ordinary walkthrough behavior. Every fixture, builder
and temporary password file must retire. Raw evidence stays private under
`.tmp/apple-signing-2026-10-28/`.
