# Missing Music download-start design

**Status:** implemented — explicit, release-scoped download preparation

**Created:** 2026-08-26

## Purpose

This document defines the explicit handoff from a manually selected Missing
Music match to the existing Downloader workflow. It completes the intentional
two-step decision model:

1. **Use this match** records a choice without contacting a provider.
2. **Start download** asks an administrator to confirm that one selected
   release should enter download preparation.

It does not merge Downloader into Missing Music. Missing Music remains where a
household decides what it wants and which match to use. Downloader remains the
specialist surface for transfers once Harmoniarr has submitted them.

## Problem and safety boundary

A manually selected match is durable intent, but it is not permission to send
a provider request silently. The previous implementation deliberately stopped
at selection. The next action must be explicit, attributable, and restricted
to the exact selected candidate for the exact target release.

The existing generic execution-run service records `selectedCandidateId` in a
run summary, but its worker historically loaded the entire selected-candidate
queue. That is safe only for the explicit global Downloader command; it is not
safe for a release-scoped Missing Music action. The targeted path must make
that identifier operational in both the run service and the worker.

## Options considered

### 1. Start the transfer when a match is selected

- **Pros:** one click.
- **Cons:** turns a comparison choice into an external side effect; weakens
  review, audit clarity, and recovery from a mistaken selection.

### 2. Reuse the global Downloader execution command

- **Pros:** no new route or UI.
- **Cons:** it can enqueue unrelated selected candidates and gives the
  browser no release-scoped authorization boundary.

### 3. Add a release-scoped confirmation and reuse a constrained execution run

- **Pros:** one clear final decision, preserves the established durable
  execution worker, safely scopes work to one selected candidate, and retains
  an auditable actor/target/release chain.
- **Cons:** adds one concise confirmation step and a small command boundary.

## Recommendation stack

Adopt option 3 with these layers, in order:

1. A server-issued `canStartDownload` permission controls whether the action
   is presented. Only an active target account, a selected match, and an
   administrator can satisfy it.
2. A native HTML `<dialog>` explains the release and the actual effect before
   the final **Start download** button. It includes a visible **Cancel**
   action and does not expose peer names, paths, transfer IDs, or provider
   diagnostics.
3. `POST /api/v1/missing-music/decisions/:decisionId/start-download` accepts
   no candidate or user identifier from the browser. The server resolves the
   decision from the current session and obtains its unique selected match.
4. The command requires a fresh administrator session, CSRF validation,
   idempotency, and a dedicated rate limit. It repeats authorization and
   target-account checks in the service; hiding a control is never an access
   control.
5. The existing execution service verifies that exactly that candidate remains
   selected. It creates a one-candidate operation run, and the worker obtains
   only that candidate initially. A run-wide conflict or pending provider
   confirmation remains a safe `409` rather than a duplicate request.
6. The command records the administrator as the actor and the target release
   in the operation/audit context. Activity records that preparation was
   requested; the existing worker continues to record **Download started**
   only after slskd accepts the transfer.

## Roles and multi-user behavior

| Role | May choose a match in own scope | May start download | May inspect Downloader |
| --- | --- | --- | --- |
| Admin | Yes, including a selected household user | Yes | Yes |
| Operator | Yes, for own allowed decision | No | No |
| Requester | Yes, for own allowed decision | No | No |

The administrator can act for a household member, but the client submits only
the opaque decision ID. The target account is resolved by the server. Disabled
account history remains readable and cannot start a new transfer.

## Command contract

```text
POST /api/v1/missing-music/decisions/:decisionId/start-download
Headers:
  X-CSRF-Token: <session-bound token>
  Idempotency-Key: <client-generated retry key>
Body: {}
```

Successful responses use `202 Accepted` because the provider call is made by
the durable execution worker. The response communicates that download
preparation was requested, not that files have already been accepted by
slskd. The UI reloads the authorized decision and returns focus to **Current
status**. It does not navigate away automatically.

The operation run stores the selected candidate ID and the source wanted
release ID. The execution service validates that the selected candidate is
still uniquely selected; the worker applies the same ID when it builds its
initial queue. This is defence in depth against stale UI, a crafted request,
or accidentally starting every selected candidate.

## W3C interaction requirements

The native `<dialog>` is intentional rather than a custom ARIA overlay. W3C
documents that a modal HTML dialog moves focus into the dialog, keeps page
content inert, supports Escape, and returns focus to the invoking control on
close. The confirmation has a visible heading, an explicit explanation of the
effect, and a visible Cancel button. When the command finishes, the
application deliberately focuses the updated status heading because the
completed task changes the release workflow.

Controls use concrete labels—**Start download** and **Cancel**—rather than
generic terms such as "Confirm". A `role="status"` message reports the
accepted preparation request once; provider state is not repeatedly announced.

## Security requirements

- Deny the command unless the current server session is a fresh administrator
  session.
- Validate authorization and the decision-to-user relationship on every
  request; do not trust route state, a candidate ID, or a target user ID from
  the browser.
- Require the existing session-bound CSRF token and an idempotency key, and
  rate limit the external-effect command separately.
- Return the same safe not-found response for a missing or out-of-scope
  decision, and bounded conflict messages for a stale selection or active run.
- Keep activity and audit payloads release-scoped. Do not send provider
  usernames, filesystem paths, tokens, or raw provider errors to Missing Music.

## Sources checked 2026-08-26

- [W3C: H102 — Creating modal dialogs with the HTML dialog element](https://www.w3.org/WAI/WCAG22/Techniques/html/H102)
- [W3C: ARIA Authoring Practices — Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP Cross-Site Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)

## Verification plan

1. Unit-test the command’s role, target, disabled-history, stale-selection,
   audit/activity, and exact-candidate behavior.
2. Unit-test the execution service and worker with two selected candidates to
   prove a targeted run handles only the selected one.
3. Exercise route fresh-session, CSRF, idempotency, request payload, and rate
   limit wiring.
4. Test the client API/composable and use Playwright to verify native-dialog
   keyboard/focus behavior, cancellation, and the confirmation request.
5. Run focused tests, client lint/build, the relevant server suite, and the
   repository validation before committing.

## Implemented outcome

The implementation adds the permission, native confirmation, guarded command,
and one-candidate execution boundary described above. The browser sends only a
decision ID; the service resolves the target household account and the unique
selected match. The command returns `202 Accepted` after creating the durable
operation run, while the worker alone contacts the provider.

Focused server and client tests cover permission, disabled-history, stale
selection, CSRF, idempotency, activity/audit context, and target-candidate
scoping. The browser acceptance scenario verifies the visible native dialog,
Cancel path, Start path, accepted-state wording, and focus return to **Current
status**. Lint and the client build also pass.

## Next item

The next recommended slice is the Missing Music **View in Downloader**
transition: preserve the same release and target-user context in a safe
administrator-only Downloader filter without exposing provider-private
identifiers.
