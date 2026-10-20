# Docker smoke port outcome

Date: 2026-10-19. The [design](DOCKER_SMOKE_PORT_DESIGN.md) and
[official recommendations](DOCKER_SMOKE_PORT_RESEARCH_2026_10.md) define the scope.

## Implemented behavior

compose.smoke.yaml replaces the entire published-port list with one dynamically
allocated 127.0.0.1 TCP binding. The small ESM docker-smoke-endpoint.js module
resolves one concrete project service container and validates its inspected port
map before HTTP. Fresh/restart and baseline/upgrade each resolve again after
start, use current-port sessions and retain phase endpoint evidence. Runtime
hooks receive the inspected endpoint and their compatible HARMONIARR_PORT view.
Normal orchestration keeps Compose port interpolation zero; the complete port
override remains authoritative for hook-issued Compose commands too.

The old host socket allocator/injection is removed from this harness. Canonical
and walkthrough deployment ports, app code, dependency pins, deadlines, resource
bounds and cleanup policy are unchanged. Other validators are not migrated here.

## Final-source validation

3,049 source/configuration files, SHA-256
152ef2d25379220c993ea4bce0b47bcc587809697c8084461423682c1e9eaa2a.
A separate five-file manifest binds the override, endpoint/orchestration modules
and both changed/new test files. Native collection retains matching before/after
source, and staged bytes are checked against that manifest.

| Gate | Observed result |
| --- | --- |
| Focused endpoint, lifecycle, cleanup and redaction | 31 pass, zero skips/cancellations; 0.19s descriptive local observation |
| Final validate:fast | 10,548 pass: server 5,463, client 4,388, scripts 697; lint, policy checks and both builds pass; 112.9s |
| Actual Compose 5.6.0 merged config | Exactly one loopback TCP target 3000, no fixed published port; original mapping removed |
| Restored language tooling | Actual TypeScript/Vue bridge, hover/document requests, shutdown and process close pass after rejecting PR 48 |
| Native fresh/restart and upgrade | Four runtime phases pass; both strict disposable-project cleanups verified |

Unit controls refuse missing/multiple identities, nonzero CLI results, malformed,
unassigned, remote or extra bindings without echoing private input. They preserve
thrown Error/null, prove current-port HTTP/session creation, and refuse a wider
binding in either phase before further HTTP while still attempting cleanup.
A first focused lint check caught a test-only shadowed loop variable; it was
corrected before the final source freeze and successful gates.

## Native packaged result

Reuse the qualified immutable Linux/amd64 images because all Dockerfile COPY
inputs and package bytes remain unchanged. No app rebuild is necessary for this
host-side harness change. Final host-built client assets still match all 151
previously qualified hashes; this is unchanged-image evidence, not a new image.

Baseline image:
sha256:2d86bbf5dbd3435f60748873671b8e80803dabd8c53aacfbc4c8d2a4746f20de.
Candidate image:
sha256:f68b2d9230d8d982a64e51a465d873abf53a1ac37f96430c3964f2106c58e0ed.

| Phase | Inspected loopback port | Additional browser proof |
| --- | --- | --- |
| Fresh install | 56901 | Login and lazy settings navigation |
| Existing-data restart | 64235 | Login and lazy settings navigation |
| Baseline | 51391 | HTTP/session/settings proof; no browser claim |
| Upgraded candidate | 51527 | Login and lazy settings navigation |

Each phase acknowledges a concrete container and checks actual image identity,
Node 24.22.0/Linux/x64/uid 1000. The candidate browser contexts enable service
workers and report no script/asset errors or navigation reload. Fresh/restart
also passes database persistence, backup export/restore lock refusal and apply,
delegated request flow, media tools, migrations and deliberate invalid-startup
refusal. Baseline/upgrade preserves authenticated settings on the new port.
Owned containers, networks, volumes and temporary bind data are verified removed.

## PR, reusable practice and follow-up

The [fresh PR 48 evaluation](OPEN_PR_48_DOCKER_PORT_EVALUATION.md) applies the exact
refreshed two-file patch locally. TypeScript 7.0.2 still fails current language
server initialization; the original pair is restored byte-for-byte and its
Vue/TypeScript bridge passes. No candidate dependency bytes are retained and no
PR is merged, closed or rebased.

The testing skill now routes smoke networking to a focused ownership reference;
the web-standards skill maps official Docker/OWASP/W3C practices to these owners
and evidence. Repository/installed standards copies match and skill validation
passes. Private raw package/probe/native evidence remains ignored under
.tmp/docker-port-2026-10-19.

Next: remove server-builder's unnecessary npm ci after proving identical copied
ESM output and packaged behavior. Qualify the announced October 21 Node security
patch when actually published. Managed-provider smoke's separate allocators need
their own rollout evidence. This is local Docker/Desktop proof, not a guarantee
against daemon compromise, custom routing, remote Docker contexts, all operating
systems, every integration scenario, image CVEs or whole-CI performance.
No release, tag, new branch or image publication is created.
