---
name: harmoniarr-workspace-hygiene
description: Maintain Harmoniarr development disk hygiene for temporary artifacts, validation Docker images and builder cache. Use for cleanup requests, disk-growth reviews and closing resource-heavy build or test work.
---

# Harmoniarr workspace hygiene

Prevent completed development work from accumulating disposable files and images.
This is developer workspace maintenance, not an application background service.
Read `docs/WORKSPACE_HYGIENE_DESIGN.md` and `docs/WORKSPACE_HYGIENE_OUTCOME.md`
from the Harmoniarr Git root for repository-specific retention boundaries and
previous measurements. Resolve those paths from the repository, not from an
installed copy of this skill.

## When to act

Before a large build/profile, check available disk and existing resource usage.
At the end of resource-heavy work, retire that task's owned containers, fixtures
and generated outputs after actual completion. During sustained development,
review accumulation weekly or when growth is reported; this is a work-session
habit, not authorization to create a scheduled task or daemon.

An explicit cleanup request authorizes removal of reviewed, proven disposable
Harmoniarr resources. Continue within that scope without repeated confirmation.
Ordinary feature work authorizes cleanup of its own temporary resources, not
unrelated historical data or a shared Docker host. Preserve uncertain candidates
and explain what evidence is missing rather than inventing ownership.

## Inventory and retention

Inspect Git status, tracked/ignored boundaries, directory sizes without following
junctions, active worktrees/jobs, Docker context/builders, all containers including
stopped ones, image references, mounts and volume labels. Start with
`docker system df` and the selected builder's `docker buildx du --format=json`.
Parse newline-delimited Docker JSON and tolerate missing inventory entries by
excluding them from removal. Never print raw container environments or credentials.

Protect source/uncommitted files, `.git`, active worktrees, `.env*`,
`docker/walkthrough.env`, `.data`, music/downloads, databases, backups and secrets.
Ignored files and an old timestamp alone do not establish deletion authority.
An old database can live under `.tmp`; preserve it unless its disposable purpose
and retirement are established. Leave the current pinned Node toolchain and
installed dependencies available for subsequent validation.

Retain the live walkthrough image, one deliberate rollback, current named native/
media/reader/encoder tools and any currently required immutable pins. Preserve
compact source/hash manifests, raw results and summaries supporting current
qualification. Generated encodes, duplicate toolchains and unpacked replay
dependencies may be removed when reproducible from retained archives/recipes;
record that regeneration is now needed. Keep unresolved failure evidence.

Expired per-run validation tags may be candidates after seven days and verified
job completion. This is a review threshold, not an automatic deletion rule.
Do not retain every historical app image merely because an old report cites it;
separate historical provenance from the current reproduction/rollback set.

## Apply narrowly

Create a bounded manifest of exact paths, immutable image IDs/tags and cache IDs,
with a reason and protected set. Check present identity and references again
immediately before removal. Stop or skip a candidate that gained an owner.
If Docker disconnects, retain partial receipts and recheck engine health and
references before a bounded resume. Repeated interruptions stop deletion for
diagnosis; never force removal or restart shared services to get a clean result.

- Files: require canonical containment in the intended workspace, no reparse
  points or nested repositories, no tracked content and no active mount/process
  owner. On Windows, use one shell end-to-end, `Remove-Item -LiteralPath`, and
  verify every resolved absolute target before recursive deletion.
- Images: require Harmoniarr-specific image metadata or a reviewed validation
  tag contract; a generic `/app` workdir is insufficient. Check running and
  stopped container references. Remove exact reviewed tags/IDs without force;
  preserve newly added tags and deliberately retained images.
- Volumes: no references does not prove disposable data. Remove only known
  synthetic fixture volumes with matching ownership labels and proven retirement.
  Never apply a blanket volume prune or Compose volume removal to the walkthrough.
- Cache: the default and desktop-linux builders can address the same shared
  engine. Use an explicitly selected builder and reviewed record IDs with
  project provenance. Generic COPY/RUN descriptions or an age alone cannot prove
  Harmoniarr ownership. Shared cache may free only metadata until image references
  retire. Do not change global GC budgets or restart Docker during project cleanup.

Avoid host-wide `docker system prune`, broad `image prune -a`, global
`git clean -fdx`, manual Docker data-directory removal and VHDX/WSL compaction.
Do not bypass an uncertain fixture cleanup guard by retrying later: a separately
authorized orphan reclamation needs fresh ownership/quiescence evidence and its
own receipt, not a fabricated passing result for the original run.

## Verify and report

Confirm selected resources are absent, protected pins still resolve and live
containers retain their image, health, ports and mounts. Verify source status and
retain a small cleanup receipt outside the deletion set. Report actual removals,
skips and before/after usage; do not add shared image/cache sizes or equate logical
Docker reclaim with Windows VHDX shrinkage. No destructive probe is needed to test
this skill: use plan-only review against retained inventory and protected controls.

Run skill structural/link checks for instruction-only changes. Run focused tests
and real safe controls if executable cleanup tooling changes; unrelated media/
database matrices are not necessary for a documentation-only maintenance change.
Install/update the user-discoverable copy of this repository skill and verify
byte parity. Honor the session's commit/push instructions; cleanup grants no
separate release, registry deletion or PR merge authority. Return to the user's
previously queued next item after cleanup rather than starting it implicitly.
