# Missing Music decision workflow design

**Status:** proposed — the Missing Music transfer-decision work is intentionally
paused pending the download-confirmation decision. The independent Home
artist-card status correction may proceed without that decision.

**Created:** 2026-08-26

## Purpose

This document corrects the previously implemented navigation direction. It
defines a multi-user workflow from a desired release that is not in the library
through a deliberate match choice and, when appropriate, into the transfer
monitor. Administrators can work across household users without losing the
target user's history or privacy boundary.

It does **not** rename Downloader. It does **not** create a broad
"Acquisition" primary destination. It merges the user-facing responsibilities
currently presented as **Missing Music** and **Music Queue** into one Missing
Music surface, while keeping **Downloader** as the specialist transfer
operation surface.

## Problem statement

The current interface separates a missing-release card from the work needed to
act on it:

1. An operator sees a release in **Missing Music**.
2. The operator starts a search or opens the release.
3. The interface moves the operator to a separately named **Music Queue** to
   compare matches, select one, retry, or resolve a recovery state.
4. The operator then moves again to **Downloader** to see transfer progress.

The second destination is a decision step, not a distinct user goal. It makes
the same release appear to live in two unrelated places and leaves the next
action unclear. The correct boundary is therefore:

- **Missing Music** owns *which release to resolve and which candidate to use*.
- **Downloader** owns *what is happening to a transfer after it has been
  submitted*.

## Intended operator model

```text
Discover
  └─ Add artist / choose desired release policy

Missing Music
  ├─ Find matches
  ├─ Review matches
  ├─ Choose a match deliberately
  ├─ Retry or adjust a blocked decision
  └─ View the resulting transfer in Downloader

Downloader
  └─ Inspect, monitor, and manage submitted transfers
```

This is a handoff, not one dense all-purpose page. A transfer is shown in
Downloader only after the operator has made, or the system has safely made, a
release decision.

## Navigation contract

### Operator sidebar

The target primary navigation order is:

1. Home
2. Discover
3. Missing Music
4. Downloader
5. Activity
6. Settings

`Acquisition` is not a primary user-facing destination. It may remain an
internal service, API, or operational term where changing it would add risk
without improving the operator experience.

### Role boundary

All authenticated users use the canonical Missing Music release-decision
surface, but its scope is derived by the server—not trusted from the URL or a
client-side user ID.

| Role | Missing Music scope | User filter | Transfer operation |
| --- | --- | --- | --- |
| Admin | All active users by default; may choose one user or include disabled-user history | Yes | Downloader is available |
| Operator | Their own release decisions only | No | Not available under the current server contract |
| Requester | Their own release decisions only | No | Not available |

An administrator acts *for* a selected user, but audit records must retain the
administrator as the actor. Existing server-side Downloader authorization
remains authoritative; removing or hiding a client link is not an authorization
control.

### Deep-link compatibility

The canonical release-decision deep link becomes
`/app/missing/:decisionId`. A decision ID is an opaque server-issued value that
identifies both a release and its user scope. It prevents an administrator from
accidentally acting on the wrong user's copy of the same release, and avoids
exposing a provider transfer identity.

Legacy paths must retain query strings and hashes, but redirects must be
role-aware. A requester must never be redirected to a route that loads an
administrator's cross-user data, and a route must never accept a client-supplied
user ID as authorization. The route guard resolves the signed-in user's scope;
the server confirms it again for every read and mutation.

| Existing path | Canonical destination |
| --- | --- |
| `/app/music-queue` | Missing Music in the signed-in user's allowed scope |
| `/app/music-queue/:wantedReleaseId` | Matching Missing Music decision, if the caller may view it |
| `/app/acquisition` | Missing Music in the signed-in user's allowed scope |
| `/app/acquisition/music-queue` | Missing Music in the signed-in user's allowed scope |
| `/app/acquisition/music-queue/:wantedReleaseId` | Matching Missing Music decision, if the caller may view it |
| `/app/acquisition/downloader` | `/app/downloader` for an administrator; the normal protected-route result otherwise |

URLs may contain only the opaque decision ID and ordinary view state. They must
not add provider usernames, raw transfer IDs, API keys, or provider payloads.

## Missing Music action model

Each release has one clearly named primary action based on durable state. The
UI may show supportive context, but it must not ask the operator to infer the
next step from a generic status label.

| Release state | Primary action | Supporting copy | Result |
| --- | --- | --- | --- |
| No search has been started | **Find matches** | Search for candidates that fit the release and quality policy. | Search is explicitly requested. |
| Candidate matches are available | **Review matches** | Compare the available choices before selecting one. | Opens the Missing Music release inspector. |
| A candidate needs selection | **Use this match** | Shows the artist, release, quality, and available evidence. | Applies the selected candidate according to the confirmation contract. |
| No candidate is acceptable | **Try again** | Search again or adjust the allowed quality if policy permits. | Starts the bounded recovery action. |
| Search or reconciliation is underway | No mutation button | Harmoniarr is checking this release automatically. | Status refreshes without navigating away. |
| A transfer is submitted | **View in Downloader** | The release decision is complete; transfer progress is available separately. | Opens Downloader filtered to the release. |
| Files are ready to add | **Add to library** | Files are ready for the existing guarded library-add workflow. | Uses the existing scoped action. |

Actions that can change state use native buttons. Destinations use links. The
review inspector opens only after an explicit user action and retains a
release-scoped URL so it can be shared or revisited safely.

## Multi-user administration workbench

### Default and filters

For an administrator, Missing Music opens to **All active users** filtered to
**Needs action**. This makes unattended household work visible without hiding
the administrator's own releases.

The compact desktop toolbar, and its equivalent mobile filter disclosure, use
these controls:

| Control | Default | Purpose |
| --- | --- | --- |
| **User** | All active users | All active users, Me, or one named user. Disabled users remain selectable in a clearly labelled historical group. |
| **Account status** | Active | Active, Disabled, or All users. Disabled history is deliberately excluded from the active-action count unless selected. |
| **State** | Needs action | Needs action, Searching, Downloading, Ready to add, or All states. |
| **Search** | Empty | Artist or release title. |

The filter controls are one labelled native form group. They use visible
`label` elements, a short `fieldset`/`legend`, URL-synchronised state, and a
concise status announcement such as "Showing 12 releases for all active users."
On small screens, **Filters** is a disclosure button; it does not navigate or
change the result set merely by receiving focus.

### Worklist rows

In the all-users view, each row represents one user-scoped decision. Identical
releases are not merged in the first version: a selection for Jamie must never
silently select or download the same release for Alex.

Each row shows:

- release artwork, artist, title, and concise quality/track context;
- **For _username_** as the primary ownership fact;
- **Requested by _username_** only when that differs from the target user;
- the current state and its one explicit next action;
- a disabled-account marker when the historical target is no longer active.

Opening a row retains this context in the release inspector. Its actions state
who receives the outcome, while Activity records who performed the action.

### Disabled users and history

Disabled users and their history are retained indefinitely. They are not
hard-deleted from user, request, decision, transfer-link, or audit records.

- Disabled accounts do not appear in the default active-user action view.
- An administrator can select **Disabled** or **All users** to investigate
  their historical requests, decisions, and outcomes.
- Historical rows are read-only by default and say "This account is disabled."
  They must not offer a new search, match selection, transfer, or library-add
  mutation for the disabled target user.
- An in-flight transfer remains visible for diagnosis. The implementation must
  not cancel it automatically solely because the account was disabled; any
  cancellation is a separate, explicit administrator action.
- Audit data retains immutable actor ID, target user ID, decision ID, source
  request ID when present, and timestamp. The UI may show a current username,
  but history is joined by durable IDs so a renamed or disabled account remains
  traceable.

### Server contract

The current wanted-release and Music Queue reads are scoped to the signed-in
`appUserId`. The administration workbench therefore needs a dedicated,
admin-authorized query; client-side fan-out across every user is rejected.

The new route/service contract must support server-side pagination, filtering,
and an explicit resolved scope:

```text
GET /api/v1/missing-music/decisions
  ?scope=all|mine
  &requestedForUserId=<admin-only optional user ID>
  &accountStatus=active|disabled|all
  &state=<optional state>
  &q=<optional search>
```

The response returns only rows the authenticated caller may view and includes
an opaque `decisionId`, release facts, `requestedFor`, optional `requestedBy`,
state, and bounded action availability. It must not return provider-private
transfer data.

Mutations resolve `decisionId` server-side, then enforce the caller's role:

- a non-admin may act only on a decision in their own scope;
- an admin may act for the decision's target user;
- a disabled target is read-only;
- the service records actor and target separately in the existing audit/event
  boundary;
- every mutation retains fresh-session, CSRF, and idempotency protections.

This keeps authorization in services and routes, rather than accepting a raw
target user ID as a client-side assertion.

### Implemented query boundary — 2026-08-26

The first multi-user slice is now available as a read-only, server-authorized
query:

```text
GET /api/v1/missing-music/decisions
  ?scope=all|mine
  &requestedForUserId=<admin-only optional user ID>
  &accountStatus=active|disabled|all
  &state=action|searching|downloading|ready|all
  &q=<artist or release text, 120 characters maximum>
  &limit=<1..100>
  &offset=<non-negative integer>
```

The route always obtains the actor from the authenticated server session. A
non-admin's requested scope resolves to `mine`; an attempt to name another
user is rejected. An administrator defaults to all active users and may switch
to a named user or the disabled-user history. The response exposes only an
opaque `decisionId`, release facts, track coverage, the target-user display
fact, and an allowlisted status/next-action presentation. It does not include
candidate payloads, provider usernames, transfer IDs, paths, or raw evidence.

The `state` value is derived on the server from the existing Music Queue
status policy. It keeps the worklist understandable without creating a second
status rule set:

| State | Includes | Intended filter label |
| --- | --- | --- |
| `action` | A match, recovery, setup, quality, or safe-add choice is required | **Choose an action** |
| `searching` | Search, scoring, retry, or automatic recovery continues | **Working automatically** |
| `downloading` | Files are downloading or being added | **Downloading or adding** |
| `ready` | Verified files are ready for the library | **Ready to add** |
| `all` | Every current state, including an unrecognized future state | **All states** |

The initial projection is intentionally capped at 2,000 source releases per
request. When the cap is reached, `page.sourceLimitReached` is true so a future
UI can ask the administrator to refine the user, account-status, state, or
search filter instead of silently hiding history. A later performance slice can
move state projection into a dedicated indexed database read model; this slice
does not duplicate the established acquisition-status logic just to make that
optimization early.

### Security and W3C rationale

The scope policy is enforced inside the query service, not only in a hidden UI
control. That follows OWASP's recommendation to validate authorization on each
request and to make authorization decisions server-side. The database query is
restricted to the resulting target-user IDs; a requester's browser therefore
never receives another household member's decision rows or user options.

The forthcoming filter toolbar will use visible labels—**User**, **Account
status**, **Work state**, and **Search releases**—and one semantic group. W3C
explains that a control's label must describe its purpose and that related
controls should be grouped both visually and in the markup. This is why the API
uses concrete state categories instead of an unexplained generic
"needs review" filter.

Additional sources checked 2026-08-26:

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [W3C WAI Forms Tutorial — Labeling Controls](https://www.w3.org/WAI/tutorials/forms/labels/)
- [W3C WAI Forms Tutorial — Grouping Controls](https://www.w3.org/WAI/tutorials/forms/grouping/)

## Confirmation contract — decision required

The user-facing choice must be explicit before a candidate can create a
provider transfer. One decision is still required before implementation:

### Option A — use the match immediately

`Use this match` is itself the confirmation. Selecting it applies the candidate
and queues the normal downstream work.

- **Pros:** fastest workflow; one clear button.
- **Cons:** less friction before an external transfer is initiated; the button
  must carry unusually strong evidence and wording.

### Option B — confirm before starting the download

`Use this match` records the candidate selection, then a concise confirmation
dialog presents **Start download** as the final action.

- **Pros:** a clear, auditable boundary before a transfer request; best fit for
  low-confidence or manual recovery choices.
- **Cons:** an extra interaction for routine decisions.

### Recommended default

Use **Option B** for a manually chosen candidate: a visible choice followed by
a short **Start download** confirmation. Automatic policy-approved work remains
automatic and is reported as such; the manual workflow must not silently begin
a transfer. The confirmation must explain the target release and selected
candidate without revealing provider-private information.

## Home artist-card release-plan status

### What the current label actually means

The current green **Last reconciliation completed** pill is not a statement
that music was found, downloaded, or added to the library. It reports that the
background artist-policy run finished. That run applies the monitored artist's
policy and overrides, saves a release-plan snapshot, and lets the application
derive desired-release coverage.

This is distinct from the library reconciliation shown elsewhere in the
product, which compares files on disk with known releases. Calling both things
"reconciliation" on primary screens makes the distinction invisible and asks
people to understand an implementation detail before they can understand the
page.

The existing Home card already shows the outcome that matters: the artist's
policy, how many desired releases are acquired, and how many remain missing.
A completed internal run does not change the next action and currently omits
its time, result, and any explanation. It is therefore not useful as a default
card status.

### Decision

Remove a completed artist-policy run from the Home card. Do not replace it
with a different healthy/complete badge. The coverage line is the meaningful,
plain-language outcome.

Show a compact card status only for a current or exceptional condition. Its
text must name the user-facing effect, not the internal process.

| Internal artist-policy state | Home card treatment | Artist detail treatment |
| --- | --- | --- |
| `completed` | No status pill. Show the existing coverage outcome. | Show a quiet **Release plan updated** timestamp from the latest saved snapshot when available. |
| `queued` or `running` | Muted/warning **Updating release plan**. Supporting text, where room permits: "Checking which releases to keep for this artist." | Show progress and the current run context. |
| `failed` | Danger **Release plan update needs attention** with the existing **Manage** destination visibly available. Do not rely on the red treatment alone. | Explain the failure and retain the existing **Retry update** action. |
| `cancelled` | Warning **Release plan update stopped** with **Manage** as the resolution path. | Explain the stopped run and the available recovery path. |
| `idle` or no run | No status pill. | Explain the plan has not yet been updated only when that context affects a policy action. |

The Home card must not gain a second action button. **Manage** remains the
one contextual destination; the detail view owns timing, failure detail,
recovery, and policy editing. This keeps a compact artist overview from
becoming an operations panel.

### W3C-guided interaction and semantics

WCAG 2.2 requires headings and labels to describe their topic or purpose. A
label that only says a background task completed does neither; **Updating
release plan** and **Release plan update needs attention** describe the state
and why it matters.

Static status text received with the initial Home render is ordinary text, not
a live-region announcement. The application must not announce every artist
card during polling or when a visitor merely reaches Home. If an operator
starts or retries an update in artist detail, announce that result once from a
nearby, concise `role="status"` region; a failure that requires immediate
attention may use the existing focused error treatment. Do not add a live
region to every card. W3C explicitly cautions that excessive live-region
updates make an application unnecessarily chatty.

The card's color remains supportive only. Every non-default state supplies
plain text, and the visible **Manage** link retains a descriptive accessible
name such as "Manage Lauren Daigle". The status component is a text element,
not a button, and a status change must never move focus away from the
operator's current task.

### Planned module boundary and tests

Extract the Home-only status decision from the broad card-presentation module
into `src/client/lib/operator-artist-card-status-presentation.js`. This pure
ES module returns either `null` or a small presentation object containing the
plain-language label, tone, and optional supporting text. It deliberately does
not expose raw run data to the card.

The card consumes that object only when it is non-null. The artist-detail view
continues to receive the existing richer reconciliation/run data, but its
public copy is updated to **release plan update**. Historical Activity can
retain the precise operational term when that detail is useful for audit.

Focused tests must prove that:

- a completed run renders no Home card status pill, while coverage remains
  visible;
- queued/running and failed/stopped states have exact, plain-language text;
- a failure exposes text plus the named Manage destination, not color alone;
- polling or initial card rendering does not create a live-region announcement
  per artist; and
- a user-initiated retry in artist detail produces one concise status message
  without moving focus.

## Component and module design

The refactor should preserve the existing bounded API and mutation services.
It should not create a large replacement singleton view.

| Responsibility | Planned module | Notes |
| --- | --- | --- |
| State-to-action wording and routes | `src/client/lib/missing-music-decision-presentation.js` | Pure ESM; one place for labels, accessible names, scope facts, and release-safe locations. |
| Scope/filter policy | `src/server/missing-music/missing-music-scope-policy.js` | Pure ESM policy that derives allowed scope from the authenticated role. |
| Admin decision query | `src/server/missing-music/*-service.js` and `*-store.js` | Server-side pagination/filtering; no browser fan-out across users. |
| Missing-release inventory | Existing `MissingView.vue`, reduced to page composition | Retains library coverage, user filter, summary, and release cards. |
| Actionable release list/inspector | `MissingMusicDecisionList.vue` and `MissingMusicReviewPanel.vue` | Reuses focused Music Queue composables and review pieces before any internal renaming. |
| Candidate selection mutations | Scoped Missing Music service/API boundary | Keeps actor and target distinct while retaining CSRF and idempotency behavior. |
| Transfer operation | Existing `DownloaderView.vue` | Keeps transfer filters, controls, and admin protection. |
| Home artist-card status | `src/client/lib/operator-artist-card-status-presentation.js` | Pure ESM; hides successful internal runs, describes only current or exceptional release-plan work. |
| Artist-detail release-plan wording | `src/client/lib/operator-artist-release-plan-presentation.js` | Pure ESM; retains concise detail context and an optional saved-snapshot timestamp. |
| Compatibility locations | `router.js` and pure route helpers | Converts old Music Queue and interim Acquisition paths without losing query/hash state. |

Legacy `music-queue` file and API identifiers may remain while they preserve
working server contracts. New public copy, route names, test descriptions, and
accessible labels use **Missing Music**. Internal renaming is a later,
separately scoped maintenance task—not a prerequisite for the workflow fix.

## Accessibility requirements

The implementation will use ordinary Vue Router links for navigation and
native buttons for state-changing actions. It will not use an ARIA tab widget
for independently routable release inspection or Downloader.

- Repeated destinations and actions must have the same visible and accessible
  names across Missing Music, Activity, and Downloader.
- User, account-status, state, and search controls form one labelled filter
  group; each control has its own visible label.
- Opening a review is user initiated; focus moves to the inspector heading only
  after that action.
- In-place mutation keeps or restores focus to the action that triggered it,
  with a concise `role="status"` result announcement.
- The inspector has an explicit close control that returns focus to the source
  release card.
- Desktop, collapsed-sidebar, and mobile layouts preserve visible focus and
  usable touch targets.

These constraints follow W3C WCAG 2.2's requirement for consistent
identification of repeated functions and its predictable-navigation guidance.
The ARIA Authoring Practices Guide also recommends semantic HTML and an
accessible name for navigation regions rather than adding custom ARIA patterns
without their full keyboard contract.

Sources checked 2026-08-26:

- [W3C WCAG 2.2 — Consistent Identification](https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html)
- [W3C WCAG 2.2 — Consistent Navigation](https://www.w3.org/TR/wcag/#consistent-navigation)
- [W3C ARIA APG — Providing Accessible Names and Descriptions](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/)
- [W3C ARIA APG — Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)
- [W3C WCAG 2.2 — Headings and Labels](https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels)
- [W3C WCAG 2.2 — Status Messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html)
- [W3C WAI-ARIA 1.2 — `status` role](https://www.w3.org/TR/wai-aria/#status)

## Validation plan

Before commit, prove the workflow at the boundaries that own it:

1. **Pure ESM unit tests**
   - state-to-action labels and accessible names;
   - safe Missing Music and Downloader locations;
   - role/scope policy, including disabled-user history;
   - no provider-sensitive values in handoff locations;
   - route redirects retain query strings and hashes.
2. **Router and authorization tests**
   - administrator sees all-user controls and Downloader;
   - operator/requester scopes resolve to their own data and expose no user
     enumeration control;
   - disabled users remain addressable by an administrator but read-only;
   - direct protected Downloader navigation remains blocked for a requester.
3. **Browser tests**
   - administrator filters from all active users to one named active or
     disabled user without receiving extra rows;
   - Missing Music card → review inspector → candidate decision → Downloader
     handoff, with target-user context retained;
   - two concurrent requester sessions cannot view or mutate one another's
     decisions, requests, or transfers;
   - keyboard focus enters and leaves the inspector correctly;
   - exact labels describe each action;
   - legacy links land at the canonical destination.
4. **Broader checks**
   - `npm run lint:client`
   - `npm run lint:test`
   - focused client and browser suites, then `npm run test:client`
   - `npm run build:client`
   - `npm run validate` when the route/UI slice is complete
5. **Local packaging check**
   - rebuild the walkthrough Compose service using
     `docs/LOCAL_DOCKER_WALKTHROUGH.md` only after all code checks pass.

## Implementation sequence

1. Record the final confirmation decision in this document.
2. **Completed 2026-08-26:** Correct the Home artist-card status: remove
   completed-job noise, surface only active or exceptional release-plan work,
   and add focused presentation and accessibility tests. This slice is
   independent of the download-confirmation decision.
3. Add the admin-only cross-user decision query, scope policy, audit context,
   and disabled-user retention behavior.
4. Mark the earlier Acquisition workspace design and outcome as superseded by
   this document.
5. Replace primary navigation and establish canonical, role-aware
   compatibility routes.
6. Add the modular Missing Music decision presentation and inspector while
   retaining working API/mutation contracts until their scoped replacement is
   complete.
7. Change internal handoffs from Music Queue to Missing Music and restore
   Downloader as the transfer destination.
8. Add tests before removing the interim Acquisition workspace modules.
9. Run validation, rebuild walkthrough Compose, visually inspect all three
   responsive breakpoints, then commit and push.

## Recommendation

Adopt the Missing Music–first workflow and keep Downloader explicit. This
matches the operator's sequence—identify a missing release, make a bounded
decision, then follow the transfer—without conflating release selection with
transfer management or forcing the user to learn a separate Music Queue page.
