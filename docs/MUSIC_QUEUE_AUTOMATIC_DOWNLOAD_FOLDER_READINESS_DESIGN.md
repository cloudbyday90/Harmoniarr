# Music Queue Automatic Download Folder Readiness

Status: **Implemented - 2026-07-26**

## Goal

Prevent Harmoniarr from automatically selecting a match or starting a Soulseek
download when the configured download, staging, library, or source-path mapping
setup cannot support the later add-to-library step.

Search results remain useful evidence. Harmoniarr can still discover matches,
but it must not turn a match into a selected transfer until folder setup is
safe.

## Problem

The automatic flow previously performed these steps in this order:

1. search Soulseek;
2. ingest and score matches;
3. select the strongest match;
4. create an execution run;
5. let the worker enqueue the provider transfer.

Folder validation existed as a Settings read model, but it was not an
automation gate. A missing or unreachable mount could therefore be discovered
only after a selected candidate and execution state already existed. That was
unsafe and also left a release looking as though it were progressing when no
safe library-add path existed.

## Research

- [Docker bind mounts](https://docs.docker.com/engine/storage/bind-mounts/)
  confirms that bind mounts are writable by default and are coupled to the host
  filesystem. Harmoniarr must verify the application-visible mounted paths; a
  container path alone is not proof that the host folder is usable.
- [Docker storage](https://docs.docker.com/engine/storage/) distinguishes
  persistent mounted data from the disposable container writable layer. Music
  and staging state must therefore rely on configured mounts, not an assumed
  container-local path.
- [Node.js file system APIs](https://nodejs.org/api/fs.html) provide the
  asynchronous filesystem operations used by the existing path validator.
  Node also cautions that a separate permission precheck cannot guarantee a
  later write will succeed, so the worker must continue to handle real
  filesystem failures.
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
  recommends least privilege for filesystem access. The application should
  keep paths server-configured and avoid exposing host paths or error details
  in normal product views.

## Options Considered

### Settings-Only Warning

Show a warning in Settings but continue automatic selection and enqueue.

Pros: no workflow change.

Cons: unsafe transfer state can still be created; the user learns about the
problem after work has begun; does not meet the automation safety boundary.

### Gate Only Execution Start

Check folders after automatic selection but before creating an execution run.

Pros: directly prevents provider enqueue.

Cons: an automatically selected candidate can be left in selected state when
setup is incomplete, which makes later recovery ambiguous.

### Gate Automatic Selection And Execution Start

Check folder readiness after search ingestion and before automatic selection;
repeat the check immediately before execution-run creation.

Pros: no selected candidate is created while setup is incomplete; repeated
check reduces configuration-change races; existing scheduled discovery retries
resume automation after setup is corrected; no provider call or filesystem
detail reaches the normal Music Queue surface.

Cons: searches can still produce match evidence while downloads are blocked;
the next automatic attempt follows the normal discovery cadence rather than
forcing an immediate provider call.

## Final Recommendation Stack

1. Use a dedicated server-side folder-readiness service rather than a client
   warning or a route-level condition.
2. Require a configured, validated downloads root, staging root, library root,
   and at least one reachable explicit slskd-to-Harmoniarr download mapping.
3. Run this gate before automatic selection and again before execution-run
   creation. Manual diagnostic and review workflows remain available.
4. Persist only the allow-listed readiness result in discovery evidence:
   `missing_download_folder` or `download_folder_unavailable`.
5. Project those codes to the existing `Needs setup` Music Queue state with the
   `Set up folders` action. Never project raw paths, mount names, permission
   errors, or provider responses.
6. Keep the execution worker as the authority for candidate-specific planning
   and actual file operations. Readiness checks reduce unsafe starts; they do
   not replace real operation-time failure handling.

## Design And Outcome

`src/server/paths/automatic-download-folder-readiness-service.js` is the new
small policy boundary. It reuses the existing path-validation service and
returns only a boolean readiness result, a stable setup reason, and safe copy.

`import-candidate-auto-download-run-service.js` exposes
`checkAutomaticDownloadReadiness()` and uses the same check before it creates
an execution run. `library-discovery-dispatch-service.js` calls that method
before auto-selection, so unavailable folders leave newly ingested candidates
as evidence rather than changing one to `selected`.

The dispatcher persists the safe readiness record with the search result.
`acquisition-pipeline-service.js` translates it into the already-established
release-centered `Needs setup` status and `Set up folders` action. This gives
the user one clear recovery path without exposing infrastructure detail.

## Security

- Folder roots and mappings remain Settings-controlled server data. No client
  request supplies a filesystem path for this decision.
- The normal Music Queue response includes a static, allow-listed message only.
  It excludes raw filesystem errors, resolved paths, mount topology, source
  usernames, and credentials.
- The check is fail-closed for automatic work: validation failure, unavailable
  validation, invalid mappings, or missing required roots prevent automatic
  selection and provider enqueue.
- The existing worker still performs its candidate-specific validation and
  handles failures at the mutation point, avoiding an unsafe assumption that a
  previous permission probe guarantees a later write.

## Validation

- Unit tests cover ready folders, missing configuration, unavailable roots,
  inaccessible mappings, and the absence of raw path/error leakage.
- Automatic-start tests prove provider status and execution-run creation are
  not called when the folder gate fails.
- Discovery-dispatch tests prove candidates are retained as evidence while
  automatic selection and start are deferred.
- Music Queue tests prove the persisted safe code becomes `Needs setup` with
  the `Set up folders` action and does not expose an injected filesystem error.

## Next High-Value Item

After successful folder validation is saved in Settings, schedule a bounded
Music Queue rediscovery for eligible releases currently stopped by this folder
gate. That shortens recovery without polling the provider or retrying releases
that are stopped for quality, policy, or terminal-match reasons.
