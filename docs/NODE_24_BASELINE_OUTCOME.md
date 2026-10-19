# Node 24 baseline outcome

Date: 2026-10-19. Implements the [design](NODE_24_BASELINE_DESIGN.md) using
[official research and tradeoffs](NODE_24_BASELINE_RESEARCH_2026_10.md).

## Implemented boundaries

.nvmrc now pins 24.22.0, selected by existing CI setup-node steps. Package engines
and devEngines begin their supported Node 24 range at 24.22.0. Dockerfile pins
node:24.22.0-alpine3.23 and alpine:3.23 by inspected multi-platform index digests.
No application API, PostgreSQL version, npm pin, scheduling, warning threshold,
release trigger or provider setting changes.

New modular ESM node-baseline-policy.js and check-node-baseline.js verify the
active canonical validation version, package floors, explicit image defaults,
immutable Node digest and matching Alpine family. validate/validate:fast run the
check first; the shared npm setup action adds it after the existing npm check.
Later supported Node 24 versions can run the application, but do not claim the
exact canonical validation baseline until its pin is updated and qualified.

The Windows qualification executable lives under ignored
.tmp/node-baseline-2026-10-19/toolchain/node.exe. Its SHA-256 matches the official
release's listed win-x64/node.exe value:
ba93f9a70bd86fce3ebbb39ec758501458453467aa92a34a0a3602d1e3fc2b9c.
PATH is scoped to each validation invocation, with installed npm 12.0.2 copied
alongside it. The OS-wide C:/Program Files/nodejs installation remains 24.18.1;
this work does not silently replace another project's toolchain. A real direct
invocation of that old executable exits 1 through the new check. Select .nvmrc's
version before running canonical validation; README documents that requirement.

## Validation and retained evidence

Final code/configuration source: 3,045 files, SHA-256
c4622609a2fd37e85aaf0277cd07c9e2456491d0f92551345ff8c9aeb18db9e6.
The separate eight-file changed-code manifest includes .nvmrc, which the existing
cohort source glob does not include. Final source/lock and changed-file bytes are
checked against the tested manifests; native/browser collections compare their
own before/after source and built-asset identities.

The first focused collection had 39 passes and one CI contract failure: changing
the npm verification step to a block removed its required literal command form.
Preserve that evidence. Restore the existing npm step and add the Node step
separately; all 40 focused policy/reporter/process/CI tests then pass. The seven
new policy cases test real drift/refusal and loader behavior, not prose matching.

Final validate:fast passed 10,533 tests: server 5,463, client 4,384 and scripts
686, plus lint/policy checks and client/server builds. Duration was 155.1 seconds
on this host; this is not a matched performance comparison. npm audit reports
zero vulnerabilities, not proof of complete image or platform security.

| Selected additional evidence | Result |
| --- | --- |
| Real PostgreSQL | HTTP/session/default-CSRF 4, native TLS identity 5 and pg driver contracts 2 all pass serially; strict cumulative records, no skips or listener warning |
| Built Chromium journeys | Default-CSRF settings submission, lazy child/history navigation and requester action all pass; 151 asset hashes unchanged |
| Vue/TypeScript tooling | Actual script/template type hovers, Vue symbols/HTML hover, real tsserver bridge, both shutdowns and process closes pass |
| Old system Node | Direct 24.18.1 invocation refuses canonical validation with exit 1 |

Native process-plus-output-drain observations are 12.3s, 26.6s and 5.2s; browser
observations are 10.3s, 13.1s and 9.4s. These selected collections are not the
complete integration/browser inventory or evidence of faster whole-CI execution.
The browser is installed Chromium via Playwright 1.64.1; other engines remain
unqualified. Hosted CI was not dispatched; local configuration/contract checks
do not establish a completed hosted run.

The Linux/amd64 application image built successfully with --pull --no-cache and
--load from the final frozen working source. Local image/index ID:
sha256:2d86bbf5dbd3435f60748873671b8e80803dabd8c53aacfbc4c8d2a4746f20de.
The disposable canonical Compose smoke ran that exact ID, verified by inspecting
the actual service container at fresh install and existing-data restart. Both
phases execute Linux x64 Node 24.22.0 and npm 12.0.2 as uid 1000.

The existing packaged validation passed read-only-rootfs/media tooling, schema/
migration readiness, protected request flow, backup/restore, existing-data restart,
embedded PostgreSQL persistence and configured invalid-startup refusal. It used
fresh fixture VAPID keys and isolated data/project identity, then strict cleanup
verified removal of the owned containers, networks, volumes and temporary data.
Existing walkthrough and other application containers were not restarted.
Build cache mounts remain npm caches with lock-integrity checks; --no-cache is
not a fully hermetic build or proof that external package repositories cannot
change. No image was pushed or released. Arm64 is present in base metadata but
was not built/executed here; image vulnerability scanning and live-provider
acceptance are outside this collection.

[Random PR 50](OPEN_PR_50_NODE_BASELINE_EVALUATION_OUTCOME.md) was applied with
JSON conflict refusal while retaining this slice's metadata. Its exact published
Router 5.4.0 pair still raises the getRootNode exception in the upstream-shaped
Chromium composition; the wrapping-element control passes. Both opening package
files and Router 5.2.0 were restored before final application qualification.
Do not conflate a closed upstream issue with repaired published bytes.

Private ignored evidence is under .tmp/node-baseline-2026-10-19: checksum-verified
host binary, registry metadata, immutable PR/package manifests and retained
candidate/control, install, failed/passing focused, broad, audit, native/browser,
language-tooling and packaged-image collections. No private production credentials
or raw local artifacts are committed.

## Recommendation and limits

Retain the Node 24 ESM, Vue, Express and PostgreSQL 18 architecture, npm 12.0.2,
matching pinned Alpine bases and existing process/lifecycle ownership. Exact
pins improve reproducibility and detect drift; they require active patch/digest
maintenance. This policy checks canonical defaults, not arbitrary Docker build
overrides, every Dockerfile grammar or all supported package-range versions.
It requires the Node digest and matching Alpine minor; the current final Alpine
digest is pinned and reviewed, but its presence is not independently required
by this Node-specific guard. Neither digest is a freshness/advisory oracle.

The October 21 Node security release remains announced future work as of this
October 19 consultation. This is not its mitigation. Recheck its actual published
version/advisories and qualify the Node 24 patch as the next priority. Afterwards
review the production build-tool peers retained through Router/unplugin.
No release, tag, new branch or PR merge is created.
