# Provider callback error Docker qualification design

October 28, 2026. See [policy design](PROVIDER_CALLBACK_ERRORS_DESIGN.md) and the
separate [Docker outcome](LOCAL_DOCKER_PROVIDER_CALLBACK_ERRORS_OUTCOME.md).

Freeze reviewed source, execute the full fast gate and build a candidate through
a disposable pull/no-cache builder. Compare packaged server/shared/client files,
root metadata and runtime/dependency identity with the preceding provider-route
image. Only the callback policy and provider route should change at runtime.
Preserve the existing walkthrough administrator, five bind sources, read-only
UID 1000, readiness and loopback port. No additional deployed app/service or
maintenance job is required.

Run native tests against exact immutable application packaging, without server/
client overlays: fresh PostgreSQL/media tmpfs, no external network or ports,
read-only UID 1000, two CPUs and 3 GiB memory/equal swap. A dedicated callback
entry uses controlled completion faults through the existing provider module
composition; missing cookies must refuse before completion. Check actual redirect
headers/body, private-field refusal, captured descriptors, exact binding/state
arguments, fixed fallback and later controlled success. Snapshot settings,
encrypted secrets, settings audit and operations around callback reads/refusals.

Existing native OAuth and Plex owner-link entries separately verify actual
state/browser/expiry/administrator checks and guarded token publication with real
PostgreSQL. Keep their provider responses controlled and distinguish those
mutation fixtures from the read-only callback-fault fixture. Await exact helper
retirement and verify absence, preserving failed logs. Retain unrelated SQL/media/
provider transport evidence only after exact source/test/package comparison.

Verify healthy preserved walkthrough callbacks with invalid state and no binding
cookie without starting provider flows. No user credentials or live authorization
code are needed. Browser/manual accessibility acceptance and minimum RAM claims
are outside this route-output qualification. Evidence stays private under
`.tmp/provider-callback-errors-2026-10-28/`.
