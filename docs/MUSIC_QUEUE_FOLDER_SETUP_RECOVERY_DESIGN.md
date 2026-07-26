# Music Queue Folder Setup Recovery

Status: **Implemented - 2026-07-26**

## Goal

Resume safe automatic Music Queue work promptly after an administrator saves a
valid download-folder configuration. The recovery must be targeted: it may
requeue releases that were stopped only because automatic download handoff
could not safely use configured folders, but it must not disturb quality,
policy, provider, or terminal search decisions.

## Problem

The automatic folder-readiness gate correctly prevents unsafe candidate
selection and provider enqueue. It records one of two safe reasons in the
discovery request:

- `missing_download_folder`
- `download_folder_unavailable`

Those requests remain on their ordinary automatic cooldown. Without a
targeted recovery, a person can finish folder setup in Settings but wait for a
later discovery heartbeat before the release receives another automatic
search.

## Research

- [Docker bind mounts](https://docs.docker.com/engine/storage/bind-mounts/)
  documents that bind mounts couple containers to host filesystem state and
  are writable by default. A saved path string is therefore not sufficient;
  the application must validate the container-visible mount before changing
  automation state.
- [Docker storage](https://docs.docker.com/engine/storage/) distinguishes
  persistent mounted data from a disposable container writable layer. Recovery
  should be driven by the configured, validated mount contract rather than by
  a container-local fallback path.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends server-side syntactic and semantic validation. The client never
  supplies a release id, reason code, or filesystem path for this recovery.
- [Node.js file system APIs](https://nodejs.org/api/fs.html) cautions that a
  separate access check cannot guarantee a later filesystem operation. The
  readiness check therefore gates automatic handoff, while the worker still
  handles real filesystem errors at execution time.

## Options Considered

### Wait For The Normal Cooldown

Keep the folder gate and wait for the next scheduled heartbeat.

Pros: smallest implementation; preserves all existing timing.

Cons: recovery feels broken after a successful Settings repair; users may
manually intervene in a workflow that can safely resume itself.

### Requeue Every Waiting Release

Make all unresolved releases immediately eligible whenever Settings saves.

Pros: fast apparent recovery.

Cons: bypasses quality stops, policy decisions, terminal search exhaustion,
provider recovery pacing, and normal cooldown limits. It creates avoidable
provider pressure and makes unrelated state transitions harder to reason
about.

### Targeted, Bounded Folder-Gate Recovery

After a relevant folder-settings save passes the existing server-side
readiness check, release only automatic requests whose current evidence is the
folder gate. Clear that stale evidence, set their next search time to now, and
start at most one normal discovery run.

Pros: prompt self-recovery; no client-controlled queue mutation; preserves
normal worker ownership; uses row locking to avoid duplicate concurrent
releases; bounded by the existing discovery batch setting.

Cons: releases beyond the batch wait for the normal heartbeat; an active or
temporarily unavailable dispatcher can defer the immediate run. Both cases
are safe because the released requests remain eligible for the heartbeat.

## Final Recommendation Stack

1. Run recovery only when Settings changes `paths.downloads`, `paths.staging`,
   `paths.music`, or `paths.downloadMappings`.
2. Reuse `automatic-download-folder-readiness-service.js`; require its
   server-side result to be ready before any queue mutation.
3. In one `FOR UPDATE SKIP LOCKED` store query, select no more than
   `library.discoveryBatchSize` automatic requests that are currently
   `automatic_cooldown`, have no download-recovery marker, and carry only one
   of the two folder-gate reasons.
4. Set those rows to `ready` and due now; remove only
   `lastSearchResult.autoDownloadReadiness`; retain all other search evidence
   and record a small `folderSetupRecovery` evidence marker.
5. Request one standard `folder_setup_recovery` discovery run. If dispatch is
   already active or cannot start temporarily, retain the ready work for the
   normal heartbeat and keep the Settings save successful.
6. Return a compact recovery summary to the authenticated Settings caller;
   never return filesystem paths, mount details, provider errors, or release
   identifiers in the normal Settings response.

## Design And Outcome

`library-discovery-folder-setup-recovery-service.js` owns the orchestration:
it resolves the existing bounded batch setting, invokes the request store, and
starts one standard discovery run. It treats an active dispatcher or a
temporary dispatch-start failure as a safe deferral, not a failed Settings
save.

`library-discovery-request-store.js` owns the atomic SQL transition. It
matches only `automatic` requests in `cooldown` with
`blocked_reason = automatic_cooldown`, folder-gate evidence, and no
download-recovery marker. It neither resets search counters nor changes
quality/policy/exhaustion state.

`settings-service.js` owns the post-commit trigger. It invokes recovery only
for relevant path updates after the existing readiness service reports ready.
`app.js` wires that trigger to the Library module without giving Settings
routes direct data-store access.

## Security And Reliability

- The recovery is initiated only after an authenticated Settings mutation has
  passed existing CSRF, authorization, patch validation, mapping validation,
  and filesystem readiness checks.
- The browser cannot choose which releases to wake or submit a folder-gate
  reason. Both predicates are fixed server-side allow-lists.
- The store uses `FOR UPDATE SKIP LOCKED`, deterministic ordering, and the
  configured batch limit, so concurrent Settings saves do not duplicate the
  same release transition or create an unbounded provider burst.
- Only the stale safe readiness key is removed. Existing candidate evidence,
  search counters, quality stops, download-recovery state, and terminal
  decisions remain intact.
- Real execution-time filesystem failures still flow through the worker. This
  recovery reduces stale setup state; it does not mistake validation for a
  filesystem guarantee.

## Validation

- Store tests prove the exact automatic/cooldown/folder-gate predicate,
  bounded lock-safe query, and removal of only stale readiness evidence.
- Service tests prove one bounded release batch starts one run, no release
  starts no run, and an already-active dispatch safely defers to the
  heartbeat.
- Settings tests prove the trigger runs only after a relevant path update
  passes readiness and does not run when validation remains unavailable.

## Next High-Value Item

Add a concise Settings save confirmation and Docker-backed browser proof for
the full recovery path: `Set up folders` -> validated save -> Music Queue
returns to automatic search. The confirmation should state only the released
count and that automatic searching has resumed; it should not expose paths,
provider diagnostics, or candidate internals.
