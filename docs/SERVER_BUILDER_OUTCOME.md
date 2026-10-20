# Server builder outcome

Date: 2026-10-20. Implements the [design](SERVER_BUILDER_DESIGN.md) and
[official recommendations](SERVER_BUILDER_RESEARCH_2026_10.md).

## Implemented boundary

Dockerfile is the only changed non-Markdown repository file. server-builder
starts directly from the existing pinned Node image, retains explicit ESM
package scope and runs the existing builtin-only copy script with RUN
--network=none. It no longer copies the unused lockfile, npmrc or shared input,
installs project dependencies, or inherits global npm setup. Client/runtime
installs and final shared-source ownership retain their existing behavior.

Original and candidate server targets were built without instruction cache.
The candidate target also used the build command's network=none option. Actual
stage inspection proves all 852 output paths, SHA-256 values and file modes
equal the original and source. The original fails the absent-project-packages
assertion; the candidate passes, with node_modules, lockfile, npmrc and unused
shared input absent. Both inventory containers were acknowledged and removed.

## Final image and validation

The final no-cache Linux/amd64 build produced local immutable image
sha256:9f193ccda73356730c879ae96e1979fb8590bc451f13198e4512ec222e7c6b90.
Against the previously qualified image
sha256:f68b2d9230d8d982a64e51a465d873abf53a1ac37f96430c3964f2106c58e0ed,
complete path/hash/mode comparison matches 852 server files, 151 client assets
and six shared files. All 110 physical app package paths/versions and 147 OS
package entries match. The final server output also equals the candidate stage.
These comparisons do not claim identical whole-image bytes.

The focused policy/managed-provider/dispatch group passes 44 tests. On canonical
Node 24.22.0/npm 12.0.2, validate:fast passes 10,548 tests: server 5,463, client
4,388 and scripts 697, plus lint, policy checks and client/server builds. That
local invocation takes 134.3 seconds; it is not a before/after speed benchmark.

The final image passes isolated fresh install and existing-data restart with
PostgreSQL persistence, 108 applied/zero pending migrations, ffmpeg/ffprobe,
backup/restore lock refusal and apply, delegated request flow and expected
startup refusal. Both phases use their inspected Docker-assigned loopback
endpoint. The subsequent upgrade-only collection passes persisted-settings
verification from the reconstructed original baseline to the final image.
Fresh/restart/upgrade browser contexts allow real service workers and verify
UI login, lazy Connections navigation, first-claim document retention and no
script/asset errors. All four runtime observations execute Node 24.22.0 on
Linux/x64 as uid 1000; all successful smoke projects verify strict cleanup.

Source is frozen at 3,049 files with SHA-256
0ef7ebd04c880ed1d58317aae92829935b4e6d25013b82f7771e489580bbe0f1.
Private inventories, logs and native collections are retained under
.tmp/server-builder-2026-10-20, outside the commit.
The [walkthrough outcome](LOCAL_DOCKER_SERVER_BUILDER_OUTCOME.md) records the
subsequent healthy preserved-state deployment and readiness-only check.

## Retained failure and scope

The initial packaged collection passes fresh/restart behavior, then its upgrade
phase fails before app startup: rebuilding the mutable walkthrough tag makes
the old local manifest reference unavailable. Cleanup leaves no resources for
that failed upgrade project. The old running walkthrough is preserved while
the original saved Dockerfile reconstructs a separately tagged baseline at
sha256:3433187c8c58facd50619753ee00d3b6dfa06bde17043e6244dd26c8935038df.
Its complete artifact, package and OS inventories equal the recorded original.
The subsequent upgrade-only collection uses that reconstructed baseline; it
does not turn the original failed collection into a pass.

RUN isolation does not make image resolution or the other stages offline.
No-cache does not clear npm cache mounts, so the local builds are not matched
installation-speed measurements. No production dependency reduction, security
patch, hosted CI, ARM qualification, complete integration inventory or release
is claimed by this Docker edit.

## Follow-up

Random [PR 51 evaluation](OPEN_PR_51_SERVER_BUILDER_EVALUATION.md) is separate:
both actual provider versions fail download preparation, demonstrating a
baseline wire-version gap. The overlay is restored. Qualify exact stable wire
forms, batch admission and receipts with strict durable attempt binding next.
Recheck the announced October 21 Node security patch when actually published.
