# Music Queue Manual Safe Add Confirmation Design

Status: **Implemented.**

Date: 2026-08-01.

## 1. Problem

Automatic library adds are the normal Music Queue path. A completed download
can still remain `Ready to add` when automatic work has not yet started or was
deferred by an active apply run. The remaining manual path must let a household
user continue that one release without reintroducing candidate-first Import
Review controls.

The action is a filesystem mutation, so it must not trust a client-side
``ready`` state, a candidate identifier supplied by the browser, or an earlier
preview.

The normal-path contract is:

`Ready to add -> review release -> confirm -> fresh safe preview -> queued library add`

## 2. Official Sources Reviewed

The following official sources were researched on 2026-08-01 against the
requested June 2026 baseline.

| Source | Design input |
| --- | --- |
| [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Every request that changes a release must authorize that specific object; an opaque or UUID identifier is not authorization. |
| [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html) | Treat every client field and prior response as untrusted; re-check whether the user may act on this release in its current state. |
| [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) | Cookie-authenticated state changes require server-side CSRF validation. |
| [W3C WAI-ARIA APG Alert Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/) | A confirmation that interrupts work should be a real modal dialog with an accessible name and description. |
| [W3C WAI-ARIA APG Modal Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | For an action that is difficult to reverse, focus starts on the least destructive option and returns to the invoking control on close. |

## 3. Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Send the selected candidate ID from the browser to Import Review apply | Smallest apparent change. | Recreates candidate-first navigation and permits object-reference tampering. | Reject. |
| Start a generic manual apply run from Music Queue | Reuses the existing worker. | Can include unrelated or warning candidates and makes the release button misleading. | Reject. |
| Add a release-scoped confirmation that runs a fresh safe preview before queuing one `safe_auto` run | Keeps the normal workflow release-first, preserves the strict worker gate, and contains the mutation to one authorized release. | Requires a focused route, service, API client, and browser coverage. | Adopt. |

## 4. Final Recommendation Stack

### User Experience

- Show **Add to library** only in a release detail currently projected as
  `ready_to_add`.
- Explain that Harmoniarr checks the completed files again and starts only if
  the plan is still safe.
- Use the existing modal confirmation host with a single acknowledgement
  checkbox. The cancel button remains first in tab order.
- Keep collision, source-path, audio-verification, lossy, suspicious-lossless,
  and unsafe-plan stops in **Needs help**. They never expose this button.

### Server Boundary

- Use a release-only route, fresh session, CSRF check, and the authenticated
  app-user ID. The browser supplies no import-candidate ID or quality decision.
- Re-load the release within the app-user scope and derive the only
  `import_pending` candidate from that release's own match evidence.
- Re-load that candidate, verify it still belongs to the release, create a new
  apply preview, and run the existing strict safe-auto quality gate.
- Queue exactly that candidate through the existing `safe_auto` apply service.
  The worker repeats the preview and quality gate before it moves any files.
- Map an already-active run or maintenance lock to a bounded deferred result;
  do not broaden the action into an unscoped apply run.

### Observability And Privacy

- Preserve the existing operation-run audit trail and trigger source.
- Return only bounded outcomes and the refreshed release projection. Do not
  expose raw file paths, peer names, provider payloads, ffprobe output, or
  spectral evidence in normal Music Queue feedback.

## 5. Implementation Outcome

- `POST /api/v1/acquisition/releases/:wantedReleaseId/add-to-library` is
  release-scoped, fresh-session protected, and CSRF protected.
- The new manual-safe-add service revalidates candidate ownership, current
  import state, apply preview, and the safe-auto quality gate before queuing a
  single candidate. It recognizes the current and legacy persisted Music Queue
  release-context shapes during that ownership check.
- Music Queue details provide the one bounded confirmation path for a
  `Ready to add` release; unsafe states keep their existing `Needs help`
  recovery action.
- Focused service, route, client API, presentation, composable, and browser
  tests prove the boundary and confirmation behavior.

## 6. Acceptance

- A signed-in user can add only their own `ready_to_add` release.
- The endpoint rejects an out-of-scope release, stale/non-pending candidate,
  mismatched release association, blocked preview, or failed quality gate
  without queuing a run.
- A valid confirmation queues only one `safe_auto` operation run and records
  `music_queue_manual_add` as its trigger source.
- The action is unavailable for every add blocker and normal UI feedback stays
  release-scoped and free of raw diagnostic data.

## 7. Next Step

Run a compact visual-consistency pass across the remaining Settings and
Activity control groups, reducing repeated helper copy and reserving strong
actions for the one next step that changes a user's system.
