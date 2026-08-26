# Missing Music worklist UI outcome

**Status:** implemented — read-only, server-authorized worklist

**Started:** 2026-08-26

## Purpose

This document records the UI slice that makes **Missing Music** the household's
primary release-decision worklist. It consumes the server-authorized decision
query added in the prior slice, removes the duplicate **Acquisition** primary
navigation item, and leaves **Downloader** focused on submitted transfers.

This is deliberately not the candidate-selection or download-confirmation
slice. A cross-user decision inspector must first have a server-authorized
detail and mutation boundary; reusing the older session-scoped Music Queue
mutation route for another household member would be incorrect.

## Recommendation stack

1. **Adopt:** a modular API helper, composable, pure presentation helper, and
   worklist component instead of placing fetching, role handling, and rendering
   in `MissingView.vue`.
2. **Adopt:** a native `fieldset` and `legend` named **Filter releases**, with
   visible labels for **User**, **Account status**, **Work state**, and
   **Search releases**. Apply filters only on submission or select changes.
3. **Adopt:** explicit row wording—**For _username_**, a state pill, and
   **Next step: _action_**—rather than a generic "needs review" bucket.
4. **Adopt:** role-specific primary navigation. Administrators see Downloader;
   operators and requesters do not receive a client navigation link to the
   protected transfer workspace. Server authorization remains authoritative.
5. **Defer:** cross-user release inspection and every manual candidate or
   download mutation until their server detail/command contract retains actor,
   target user, disabled-account read-only behavior, CSRF, and idempotency.

## Alternatives considered

| Approach | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Keep separate Missing Music and Acquisition primary destinations | Lowest initial code change | Duplicates the release decision journey and obscures Downloader's specialised role | Rejected |
| Client fetches Music Queue details for each row | Fast visual prototype | Cannot safely inspect another user's row and recreates client-side authorization decisions | Rejected |
| Render the authorized worklist first, then add a scoped detail/command boundary | Clear household-wide status now; no unsafe mutation shortcut | Detail actions follow in a separate slice | Adopted |

## Accessibility and current research

W3C's current forms guidance says controls need visible, associated labels and
related controls should be grouped visually and semantically with `fieldset`
and `legend`. The worklist therefore avoids placeholder-only filters and avoids
an unlabelled generic filter button. The visible text of each row's next step
also matches the programmatic text used for it, preserving predictable speech
interaction.

Vue's current Composition API guidance recommends composables for reusable
stateful logic and components for visual layout. The fetch lifecycle lives in a
composable while the worklist component remains responsible for semantics and
layout.

Sources checked 2026-08-26:

- [W3C WAI Forms Tutorial — Labeling Controls](https://www.w3.org/WAI/tutorials/forms/labels/)
- [W3C WAI Forms Tutorial — Grouping Controls](https://www.w3.org/WAI/tutorials/forms/grouping/)
- [W3C WCAG 2.2 — Label in Name](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html)
- [Vue — Composables](https://vuejs.org/guide/reusability/composables)

## Security boundary

The browser sends only ordinary filter values to
`GET /api/v1/missing-music/decisions`. It never submits a user identifier as
proof of authority and never obtains provider, transfer, path, candidate, or
raw evidence data from this view. The API's role-aware server scope remains the
data boundary. Hiding Downloader from non-administrator navigation improves
clarity; it is not treated as access control.

## Open pull-request assessment

The open pull requests were reviewed before this slice. No patch was applied:

| Pull request | Assessment |
| --- | --- |
| #23 `docker/metadata-action` update | Superseded by the newer version already on `main`. |
| #24 `docker/build-push-action` update | Superseded by the newer version already on `main`. |
| #40 Node `24.19-alpine` to `26.7-alpine` | Incompatible with the supported Node 24 LTS baseline. |

Applying any of these locally would either duplicate `main` or move the
application away from its supported runtime, so none is suitable work for this
change.

## Validation evidence

Completed on 2026-08-26:

- `npm run lint:client`
- `npm run lint:test`
- `node --test --test-reporter=dot "test/client/**/*.test.js"`
- focused Missing Music API, presentation, composable, and App Shell tests
  (143 passing assertions)
- `npm test` (269 Node tests and 37 integration tests passing)
- `npm run check:esm`
- `npm run check-copyright`
- `npm run build`
- `node --test --test-reporter=tap --test-concurrency=1 test/browser/missing-music-worklist-browser-acceptance.test.js`
- `node --test --test-reporter=tap --test-concurrency=1 test/browser/acquisition-overview-browser-verification.test.js`
- `node --test --test-reporter=tap --test-concurrency=1 test/browser/missing-music-to-downloader-browser-acceptance.test.js`

The browser scenario boots a real application runtime, signs in through the
UI, and verifies the named filter group, the server-provided target user, the
plain-language next step, and switching from active accounts to disabled
history. It stubs only the safe read projection; no provider or mutation
endpoint is involved.

## Follow-on work

**Completed 2026-08-26:** The server-authorized Missing Music detail read and
routed, role-aware status inspector are now available. They retain the target
account and disabled-account history without exposing raw provider or transfer
information. See
[Missing Music decision-detail design](MISSING_MUSIC_DECISION_DETAIL_DESIGN.md).

**Completed 2026-08-26:** The dedicated **Use this match** command now retains
actor/target audit history, rejects disabled targets, requires a fresh session,
CSRF, and idempotency, and explicitly does not begin a download. See
[Missing Music match-selection design](MISSING_MUSIC_MATCH_SELECTION_DESIGN.md).

The next recommended item is the explicit **Start download** confirmation for
that already selected candidate. It must retain the same actor/target context
through the Downloader handoff and preserve the separate command boundary.
