# Runtime dependency closure outcome

Date: 2026-10-19. Implements the [design](RUNTIME_DEPENDENCY_CLOSURE_DESIGN.md)
and [official recommendations](RUNTIME_DEPENDENCY_CLOSURE_RESEARCH_2026_10.md).

## Implemented ownership correction

Move vue ^3.5.44 and vue-router ^5.2.0 from dependencies to devDependencies.
Keep their installed versions and all other package artifact
identities unchanged. The five production roots remain Express, music-metadata,
pg, sharp and web-push. Existing full builder installs and runtime omit=dev use
the corrected lock graph without directory deletion or broad peer/optional flags.

npm 12.0.2 regenerated the lock in 790ms. All 511 package entries remain; 104
entries change only dev/devOptional classification. The initial review assumed
only dev could change; actual resolver output also replaces devOptional with dev
where ownership becomes exclusively developmental. A strict second review
permits those two classification fields and proves every other package field,
including versions, resolved URLs, integrity, dependency/peer constraints and
platform/optional metadata, unchanged. Root metadata changes only the two owners.

The manifest correction itself changes no application source. Its separate
package-only artifact comparison precedes the [service worker reload fix](PWA_SERVICE_WORKER_RELOAD_OUTCOME.md)
exposed by packaged validation. No service boundary, Node/Alpine pin, database
schema, build/install command or install-script permission changes.
The existing host install already contains the exact reviewed artifacts; fresh
Docker full/production installs provide install-consumption evidence. No extra
unit test is added just to mirror the reversible manifest edit.

## Evidence

Package-only source/configuration: 3,045 files, SHA-256
f6242618002ec3aa1d95b1883713daee6b1462b5fef3bf37c33f2453506c312e.
The separate two-file manifest binds that package-only collection. Final source,
including the reload fix and regression cases: 3,046 files, SHA-256
0667a3f55fd9fa420d84c0d9986112c4d2f83ba80cc4308bcd29cbdb2609e5b8.
The final five-file manifest includes both package files, registration module,
unit file and native browser file. Collections retain before/after fingerprints;
final staged bytes are checked against the final manifest.

Retained qualified baseline image:
sha256:2d86bbf5dbd3435f60748873671b8e80803dabd8c53aacfbc4c8d2a4746f20de.
Its physical /app/node_modules inventory contains 189 packages, occupies 120,720
allocated KiB and resolves Vue, Router, Vite, Rolldown, Unplugin and compiler-sfc.
An absent-build-tools assertion must refuse this baseline. Inventory uses an
owned, network-disabled, read-only container and acknowledges its removal.

| Executed gate | Result |
| --- | --- |
| Existing focused packaging/toolchain tests | 30 pass, no failures/skips/cancellations |
| Package-only validate:fast | 10,533 pass: server 5,463, client 4,384, scripts 686; lint/policy checks and client/server builds pass |
| Final validate:fast, including reload fix | 10,537 pass: server 5,463, client 4,388, scripts 686; lint/policy checks and both builds pass |
| npm audit | Zero reported vulnerabilities; not complete platform/image certification |
| Package-only selected native HTTP/session/CSRF | Four pass with strict cumulative evidence and no listener warning |
| Package-only selected built Chromium | Default-CSRF settings submission and lazy nested/history navigation both pass; 151 built-asset hashes unchanged during collection |
| Final selected native HTTP/session/CSRF | Four pass, no skips/cancellations/listener warnings, 8.9s |
| Final selected Chromium | Three pass: real enabled-worker lifecycle, default-CSRF settings submission and lazy nested/history navigation; source and all 151 host-built assets unchanged during collection |

Both successful fast gates took 90.9s; the package-only selected HTTP work took 9.7s.
These are descriptive observations, not a matched speed comparison or full
integration inventory. Runtime Node/TLS/driver implementations are unchanged;
unrelated unchanged TLS cohorts are not repeated.

## Physical artifact result

The package-only Linux/amd64 image built with --pull --no-cache --load:
sha256:e18e7e71dcaa0e2811669d40acc8e22e5a3a925018c77a0e75d780b2e120e7a8.
Fresh full-builder and production-only installs consumed the corrected package pair.
Physical app packages decrease from 189 to 110: all 79 omitted package paths are
now dev-classified, every retained package path/version matches the baseline,
and all five production roots remain. No new runtime package is added.

Allocated /app/node_modules space decreases from 120,720 to 28,628 KiB. Both
inventories run network-disabled/read-only and acknowledge container retirement.
The baseline fails the absent-build-tools gate; the candidate passes. Vue,
Router, Vite, Rolldown, Unplugin and compiler-sfc cannot resolve from the candidate
app, and its physical inventory contains no @vue packages. All 151 client asset
paths/hashes exactly match the retained baseline image. This removes installed
server packages while preserving the bundled browser runtime.

The first packaged lifecycle collection stopped at Docker port binding, before
application validation: the host-probed ephemeral port 53708 could not bind on
0.0.0.0. Strict cleanup removed the owned project. Preserve that failure; it is
not a reproduced package regression. Subsequent collections use a separately
checked 0.0.0.0 port 41475, outside the host's dynamic/exclusion ranges, without
changing application source, resources, deadlines or assertions. The exact
occupant/cause of the original transient bind conflict is not established.

Those collections then reproduced a first-install login failure. Diagnostic
evidence showed a native invalid username after a service worker reload, despite
direct HTTP login succeeding. Fix that independent application bug and repeat
validation on the separately frozen final source. Earlier exact asset equality
applies to the package-only image; final browser assets intentionally change for
the reload correction. Historical failures and strict cleanup remain recorded.

Final image from the walkthrough Compose --pull --no-cache build:
sha256:f68b2d9230d8d982a64e51a465d873abf53a1ac37f96430c3964f2106c58e0ed.
Its 110 physical package path/version pairs and absent-tool probes exactly match
the package-only candidate. All 151 assets match the final host-built assets
used by the selected browser collection. Allocated app node_modules remains
28,628 KiB; this is not a compressed image-size or CVE result.

That final image passes disposable packaged fresh install and restart, actual
browser login/lazy navigation with workers enabled, first-claim document
retention, PostgreSQL persistence, backup/restore, request flow and strict
cleanup. Node 24.22.0/Linux/x64/uid 1000 and current image identity are checked in
both phases. The [walkthrough rebuild outcome](LOCAL_DOCKER_RUNTIME_CLOSURE_OUTCOME.md)
records the subsequent preserved-state update and passing readiness-only check;
provider attention remains separate from these code/packaging changes.

## Open PR and reusable workflow

[Random PR 50 review](OPEN_PR_50_RUNTIME_CLOSURE_REVIEW.md) selected the same
immutable candidate already rejected on this Node/Vue/Playwright tuple. No
applicable new candidate bytes are available, so the historical local failure
and passing control are retained without another identical installation.
No PR is merged, closed or rebased.

Existing testing/web-standards skills now distinguish browser code in a static
bundle from Node-installed dependencies, logical graph output from physical
inventory, and installed software reduction from a demonstrated vulnerability
fix. Keep source-build and SSR assumptions explicit, preserving native optional
capability and actual cleanup. No new runtime policy registry is introduced.

Private ignored evidence is under .tmp/runtime-closure-2026-10-19: package
backups, logical graphs, strict lock review, artifact inventories/comparison,
focused/fast/audit logs, native/browser reports and packaged validation. Raw
fixture data, ephemeral credentials and generated tooling are not committed.

## Recommendation and limits

Retain the static Vue/Router build plus existing Node 24 ESM, npm 12.0.2, Express
and PostgreSQL 18 stack with production-only app packages. Source builds must
install development dependencies; this does not remove Vue from delivered
browser code or qualify SSR. App package inventory excludes global npm/OS tools,
and allocated KiB is not compressed image size, process memory or CI speed.

Fresh official metadata still returns Node 24.22.0 as the latest published Node
24 release. Recheck and qualify the announced October 21 security patch when it
is actually published; this change does not mitigate its undisclosed issues.
The next immediately actionable validation improvement is Docker-owned loopback
port allocation in the smoke harness, replacing its probe/release/bind race.
Separately remove server-builder npm ci only after proving byte-identical copied
ESM output and packaged behavior. No release, tag, new branch or image publication.
