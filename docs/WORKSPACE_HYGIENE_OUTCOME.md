# Harmoniarr disk cleanup outcome

October 31, 2026. See the [design and official research](WORKSPACE_HYGIENE_DESIGN.md)
and [AI skill](../.agents/skills/harmoniarr-workspace-hygiene/SKILL.md).

## Removed and retained

The reviewed image plan removed 249 Harmoniarr-derived images: 157 retired
untagged builds and 92 expired images from controlled-provider, file-backed and
managed-slskd validation runs. Image metadata established project identity;
exact tag contracts were checked against the producing scripts. Each batch
rechecked immutable IDs, tags and container references. No force image removal,
registry deletion or host-wide prune was used.

Four orphaned linux-canonical synthetic fixture volumes were removed by exact
name after matching `io.harmoniarr.fixture.linux-canonical` labels and checking
that no container referenced them. The protected image set retains the live
walkthrough, rollback, historical qualification anchors and current named
test/media/reader/encoder tools. Harmoniarr-derived images went from 274 to 25.

Host cleanup removed 26 targets containing 2,405 files, totaling 200,509,124
logical bytes (191.22 MiB): the superseded Node toolchain, five unpacked PR
replay action versions, stale Playwright previews and one duplicate WebP probe.
The removed probe's hash matches a retained full-effort encode. Five action
archives, replay harnesses, patches and evidence remain. Historical action replays
now need their archives unpacked; the old Node baseline needs its checksum-pinned
toolchain restored if it is deliberately revisited.

The current Node toolchain, installed dependencies, build output, current raw
qualification receipts and `.data/walkthrough` were preserved. The old PostgreSQL
state under `.tmp/local-walkthrough` was also preserved: its parent name does
not make it disposable. Source, secrets, music/downloads, backups, Git objects
and active worktrees were outside the deletion plan.

BuildKit review identified 230 records descended from explicit Harmoniarr build
steps. The preview constrained exact IDs to private, immutable, reclaimable
records unused for 48 hours on `desktop-linux`; zero records matched. No cache
prune or global GC configuration change was issued. The shared builder contains
other projects' history, so its aggregate cache is not a Harmoniarr deletion grant.

## Verification and operational limits

Final verification passed: all 249 selected image IDs and four selected volumes
are absent, while all 25 retained Harmoniarr image IDs still resolve. All 26
host targets are absent. The walkthrough is healthy with the same container ID,
image, ports, read-only setting and five mounts; `/healthz` returns 200. Current
tooling, walkthrough data, the older local database and private configuration
remain present. Repository and installed skill bytes match.

Application/package/Compose/test source is unchanged. Its 3,882-file fingerprint
still matches the preceding qualified candidate:
`5e0c274a9f3e58e4f5c1303091289e5bc36536fd7e1f9949699658e645e8ee47`.
The preceding fast/native/browser qualification is retained for unchanged source;
those suites were not rerun merely for this instruction/documentation change.

One Docker API connection ended with EOF during image deletion. The engine
became available again and both live containers were observed recently started
and healthy. This cleanup issued no Docker restart/stop/up/down command. After
fresh inventory, the bounded operation resumed from verified absence receipts;
the result of the interrupted request was rechecked rather than assumed.
An unrelated stopped container also disappeared during reference inspection,
so the resumed reader handled missing records without claiming cleanup authority
over that project. These observations do not establish the interruption's cause
or zero downtime.

Eighty-six non-Harmoniarr image IDs from the initial snapshot were also absent
at final review, outside this cleanup's mutation manifest. This shared-host
activity prevents attributing the aggregate Docker disk-usage change exclusively
to Harmoniarr. The exact project removal counts and file byte manifest above are
the attributable results.

Raw before/after inventories, path/hash manifests, exact image removal receipts
and verification records remain ignored under
`.tmp/harmoniarr-hygiene-2026-10-31/`. Logical file bytes, Docker image sizes and
shared cache figures are different measures. No claim of equivalent Windows
VHDX shrinkage is made; no WSL shutdown or disk compaction was attempted.

## Maintained AI workflow

Created `$harmoniarr-workspace-hygiene` in the repository's skill catalog and
installed an identical user-discoverable copy under
`~/.codex/skills/harmoniarr-workspace-hygiene/`. Normal automatic discovery is
enabled. The skill requests pre-build usage checks, cleanup of owned resources
after actual completion, weekly reviews during sustained development, retention
of current pins/evidence and exact project-scoped deletion. It distinguishes
explicit historical cleanup from ordinary feature-task teardown and stops
repeated Docker interruption retries. No application service or scheduler was added.

The [design](WORKSPACE_HYGIENE_DESIGN.md) records the official Docker, Git and
PowerShell sources, alternatives and recommendation stack. Repository and
installed skill structural checks passed; local document links resolve. No
destructive skill trial or unrelated native/database/browser rerun is claimed.

## Previous next step

The previous next step remains: repeat the mixed-file/first-page Windows-bind
buffer comparison in balanced blocks, preserving the pinned runtime and limits.
The [buffer comparison outcome](FOLDER_BROWSE_BUFFERS_OUTCOME.md) records the
wide buffer-128 range and recommends retaining production buffer 32 meanwhile.
Network storage qualification remains deferred.
