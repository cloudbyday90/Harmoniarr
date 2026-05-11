# Harmoniarr App Exploration Feedback

Purpose: capture product, UX, and visual feedback while exploring the running app locally without mixing those notes into implementation checklists.

Related planning docs:

- `docs/FRONTEND_SCREEN_NAV_TASK_LIST.md`
- `docs/harmoniarr-visual.md`
- `docs/IMPLEMENTATION_TASK_LIST.md`

## How To Use This File

- Add dated notes as the app is explored screen by screen.
- Keep entries focused on operator experience, information hierarchy, naming, layout, and workflow clarity.
- Treat this as a feedback log first, not as an implementation spec.
- Promote stabilized feedback into the task list or visual planning docs only after the direction is agreed.

## Feedback Log

### 2026-05-04 - Auth Shell / Login Screen

Status: needs redesign discussion before iterative polish.

Initial feedback:

- The current login screen reads as a placeholder or early scaffold rather than a productized landing experience.
- The overall composition feels too sparse on desktop, with a large amount of unused space around two isolated cards.
- The left-side promo panel and right-side login form do not yet feel like one coherent visual system.
- The visual hierarchy is weak: the page does not strongly communicate product identity, current app state, or why the user is landing here.
- The secondary action (`Claim account`) is too quiet relative to its importance for first-time or claim-based flows.
- The current auth shell likely needs a broader redesign pass, not just spacing and color tweaks.

What feels missing:

- A clearer product-level visual identity for the first authenticated touchpoint.
- Stronger guidance for the difference between ordinary login and first-time/claim-based access.
- Better use of wide-screen space so the page feels intentional rather than centered in empty canvas.
- A more distinctive and durable auth-shell pattern that can support login, claim, session expiry, and forced re-auth without feeling generic.

Design direction to revisit:

- Rework the auth shell as a deliberate branded entry surface instead of a basic split-card layout.
- Re-evaluate typography, information density, and CTA emphasis before polishing the existing arrangement.
- Treat login, claim, and auth recovery as one family of screens with a shared visual and interaction model.

Open follow-up:

- Decide whether Harmoniarr should lean more operational and dashboard-like at login, or more product-branded and editorial.
- Decide how prominent claim-account and first-run guidance should be in the shared auth shell.
- Revisit auth-shell layout once additional app screens have been reviewed, so the redesign reflects the broader product direction.

### 2026-05-04 - Authenticated Dashboard Shell / Sidebar

Status: layout behavior is confusing and reads as visually misplaced.

Initial feedback:

- The sidebar reads as if it starts halfway down the screen instead of acting like a clear primary navigation rail.
- The current shell composition makes the navigation feel detached from the top of the app rather than anchored as a stable dashboard frame.
- The left rail currently feels like three separate vertical islands: brand block, nav block, and signed-in card, with too much empty space between them.
- On a tall dashboard page, the nav ends up visually centered between the top branding and bottom account block, which makes the whole shell feel oddly suspended.
- The shell does not yet establish a strong “this is the app frame” feeling; it still reads like a styled mockup rather than a durable operations workspace.

What feels wrong structurally:

- Primary navigation should feel immediately available from the top of the screen, not visually stranded in the middle of a tall rail.
- The current vertical distribution gives too much weight to decorative spacing and not enough to orientation.
- The sidebar competes with the content column instead of grounding it.

Design direction to revisit:

- Rework the authenticated shell so navigation is top-anchored and behaves like a persistent application frame.
- Reconsider whether the brand block, nav, and session info should live in a tighter hierarchy instead of being spread apart across the full sidebar height.
- Treat the dashboard shell as a control-plane workspace first, not as a marketing or presentation layout.

### 2026-05-04 - Request Music Page

Status: **Resolved** (2026-05-11 — Request Music Page redesign).

Redesign implemented:
- Extracted all presentational helpers into `src/client/lib/request-music-form.js` (pure functions, fully tested).
- Extracted all reactive state and async actions into `src/client/composables/useRequestMusicForm.js` (injectable deps, fully tested).
- Rewrote `RequestMusicView.vue` to use the design system (`hx-page`, `hx-card`, `hx-stat-grid`, `hx-pill`, `hx-btn`, `hx-field`, `hx-input`, `hx-select`, `hx-empty`) and the new composable.
- Corrected the information hierarchy: submit form is now first (primary action), stat summary is below (secondary context, only shown when data exists), delegated notifications panel is conditional (only shown when there is activity), request history is last.
- Admin scope toggle (Mine / All requests) moved to the page header.
- `RequestNotificationsPanel.vue` ported to the design system — removed all legacy classes (`activity-feed-*`, `pill-row`, `pill`, etc.).
- All old CSS classes (`panel-dark`, `panel-light`, `section-header`, `metadata-card`, `eyebrow`, `error-copy`, `success-copy`, etc.) removed.
- Empty-state handling added to the request history section with `hx-empty`.
- Test suite: `test/client/request-music-form.test.js` (~50 tests) and `test/client/useRequestMusicForm.test.js` (34 tests).

Initial feedback:

- The page presents multiple stacked panels, but it is not obvious what should be looked at first.
- The information architecture feels flat: hero, profile summary, notifications, request form, and request history all compete for attention.
- The page makes the operator parse the screen instead of guiding them through a primary request-submission workflow.
- The current labels are descriptive, but they do not establish a clear order of operations.
- It is not immediately clear which sections are actionable, which are just status, and which are secondary context.

What felt confusing:

- `Request profile` reads like a dashboard summary, but it sits above the actual request form and may distract from the primary action.
- `Delegated fulfillment updates` appears before the user has even submitted anything, which adds noise in an empty-state experience.
- The request history list is useful, but its placement after several summary sections makes the whole screen feel long and fragmented.
- The page reads more like a bundle of related cards than one coherent request workflow.

### 2026-05-04 - Jobs / Operations History Page

Status: **Resolved** (2026-05-04 — Background Jobs redesign).

Redesign implemented:
- Page title changed from "Operations" to "Background Jobs" with operator-friendly subtitle.
- Card title changed from "Run monitor" to "Job queue".
- Detail panel card title changed from "Run detail" to "Job detail" with a helpful empty-state prompt.
- Run duration now shown inline in the job queue row (e.g. "3m 25s").
- Auto-refresh indicator added to page header — shows live pulsing dot when active runs are being polled (15s interval), or "Refreshed Xm ago" otherwise.
- Detail panel header now shows operation name prominently with start time and duration; raw run UUID demoted to Technical details collapsed section.
- "Triggered by" label replaced with inline context in the subtitle.
- Empty state copy updated to explain what kinds of jobs appear here.
- `onUnmounted` cleanup in `useOperationHistory` prevents timer leaks when navigating away.
- Backend terminology (`durable operations`, `run detail`, `lease`, `audit timeline`) demoted — lease internals remain accessible only in the collapsed Technical details section.

Original feedback:

- It is not obvious what this page is for on first view.
- The page uses internal terminology like `durable operations`, `run detail`, `lease`, and `audit timeline` without enough framing.
- The screen feels like an internal diagnostics console surfaced directly to the user rather than an intentionally designed operator workflow.
- The selected detail panel exposes a lot of low-level run metadata before explaining why any of it matters.
- The error shown in the example dominates the page, but the user still is not told what kind of job failed, why they should care, or what action is expected next.

What felt unclear:

- The difference between a `job`, a `run`, an `operation`, and a `workflow` is not clear.
- `Lease owner`, `lease expiry`, and `last heartbeat` are implementation details that currently read as backend jargon.
- `Audit timeline` is technically descriptive, but not operator-friendly in this context.
- The page does not explain whether it is mainly for troubleshooting, retrying failed background work, or monitoring active automation.

### 2026-05-04 - Account Security Page

Status: awkwardly placed in navigation and weakly explained.

Initial feedback:

- It is not obvious why this is a top-level app destination instead of living under Settings or a user/account menu.
- The current placement makes the navigation feel flatter and noisier because personal account management is mixed with system/operator sections.
- The screen content is understandable at a field level, but the page does not clearly explain why the user should visit it in normal use.

What the page appears to be trying to do:

- Let the current user change their password.
- Show active signed-in sessions for this account.
- Show recent account-related activity such as logins.

Why the current presentation is confusing:

- `Account Security` reads like a global admin/security area, but the actual content is personal account management.
- The page sits alongside dashboard, jobs, metadata, recovery, and settings as if it is a peer control-plane workspace, which feels structurally wrong.
- The session list exposes browser, IP, issue time, and expiry, but the UI does not explain what action the user should take based on that information.
- `Recent account actions` is technically useful, but it currently reads as raw event history rather than clear security reassurance.

Design direction to revisit:

- Move this surface under Settings, a profile menu, or a dedicated account submenu rather than keeping it as a primary top-level navigation item.
- Reframe the page as personal account security instead of a general control-plane security workspace.
- Add clearer guidance for what the session list is for, such as reviewing unfamiliar devices or revoking stale sessions.

### 2026-05-04 - Metadata Page

Status: **Resolved** (2026-05-11 — Artist Metadata page redesign).

Redesign implemented:
- Page hero heading changed from "MusicBrainz artist flow" to "Artist Metadata" with operator-facing subtitle.
- Hero card now includes a two-bullet decision guide explaining when to use each entry point.
- `MetadataArtistSearchPanel` section header changed from "Provider-first selection" to "Find an artist", with guidance text: "Search MusicBrainz to find an artist you want to import for the first time."
- `MetadataLocalSearchPanel` section header changed from "Reopen imported metadata" to "Open local artist", with guidance text: "Find an artist, release group, or release you've already imported."
- Local search field label changed from "Imported metadata" to "Search name" with updated placeholder.
- Loading/error copy simplified: "Loading local artist workspace" → "Loading artist…"; "Artist flow failed" → "Action failed".
- Extracted `describeMonitoringDecision`, `describeWantedState`, `buildNextMonitoringPatch`, `detectionEventLinkTarget` from `MetadataArtistSummary.vue` into new shared lib `src/client/lib/metadata-artist-presentation.js`.
- Added 16 unit tests for the new lib covering all decision branches and edge cases.

Original feedback:

- It is not obvious what the user is supposed to do here on first view.
- The page is framed as a `MusicBrainz artist flow`, which sounds like an internal implementation concept rather than a user-facing task.
- The two entry points, `Provider-first selection` and `Reopen imported metadata`, do not clearly explain when the operator should choose one versus the other.
- The page assumes the user already understands the distinction between provider metadata and local canonical metadata.

What felt unclear:

- Is this page for adding artists, editing metadata, monitoring artists, browsing imported metadata, or troubleshooting metadata state?
- What does `provider-first` mean in practical terms for the operator?
- Why would I use `Search MusicBrainz` instead of `Search local metadata`, and what happens after either choice?
- The screen does not yet establish the primary workflow in plain language.

### 2026-05-04 - Recovery Page

Status: **Resolved** (2026-05-11 — Backup & Restore page redesign).

Redesign implemented:
- Removed the "Recent activity" diagnostics panel entirely. Background job history is already surfaced on the Operations page; duplicating it here added noise without value.
- Removed the `blockingLocks` detail list. When a restore is blocked by a running job, the page now shows a plain operator message: "The app is currently busy with another task. Click 'Refresh checks' in a moment to see if it's ready." No internal lock types or reasons are exposed.
- The "Blocked" status pill on the Restore card is retained as a quick visual signal.
- Extracted `formatTimestamp`, `formatBytes`, `formatScope`, `checkStatusClass`, `checkStatusLabel`, `describeRestoreReadiness` from inline functions into the shared lib `src/client/lib/backup-restore-presentation.js`.
- Added 30 unit tests covering all branches and edge cases.
- Removed the `useRecoveryDiagnostics` composable import and all associated diagnostics state from the view.

Original feedback:

- A lot of this page reads like enterprise/internal platform language instead of something designed for a home-lab operator.
- `Recovery control plane`, `restore readiness`, `maintenance locks`, and `privileged recovery activity` all feel too heavy for the context.
- The page is noisy because it combines backups, restore checks, queue diagnostics, failure history, and lock management at the same time.
- The terminology does not explain itself well enough for a user who just wants to back up data or avoid breaking the app during maintenance.

### 2026-05-04 - Review Queue / Import Review Page

Status: **Resolved** (2026-05-11)

What was changed:

- Renamed hero heading from "Persisted slskd candidates" to "Download candidates"; updated admin and non-admin descriptions to plain operator language explaining the review-select-download-import flow.
- Non-admin info panel rewritten: removed "delegated import candidates" and "import-run controls" language; replaced with plain "you can view candidates assigned to your account, only admins can approve or start downloads."
- `ImportCandidateQueueList`: removed "Operator queue" eyebrow, loading/empty state rewritten to plain language ("Loading candidates…", "No matches found. Run a search or adjust the filters.").
- `ImportCandidateDetailPanel`: eyebrow renamed "Match detail", heading renamed "Files and actions", empty/loading states rewritten; removed raw `sourceProvider search sourceSearchId` metadata line; loading/preview empty states use plain language.
- `ImportCandidateExecutionPanel`: renamed to "Download run" / "Queue selected for download"; description rewritten; "Persist transfer state" renamed "Sync transfer state"; empty/loading states use plain language; "Auto reconcile cadence" renamed "Auto-sync interval", "Cadence source" renamed "Interval source"; `formatExecutionMode('download_enqueue')` label changed from "Download enqueue" to "Queue downloads".
- `ImportCandidateApplyPanel`: renamed to "Library import" / "Move downloads to library"; description rewritten; empty/loading states use plain language.
- `ImportCandidateFilters`: eyebrow renamed "Filter candidates", heading renamed "Candidate filters".
- `ImportPendingCandidateStatusPanel`: renamed "Ready to import" / "Downloads awaiting import"; loading/empty states rewritten; removed raw source search ID metadata line; "Import pending at" renamed "Ready for import at".
- `SelectedImportCandidateStatusPanel`: renamed "Candidates selected for download" / "Download readiness"; loading/empty states rewritten; removed raw source search ID metadata line.
- Extracted `formatTimestamp`, `formatBytes`, `formatPath`, `formatTokenLabel`, `candidateStatusLabel`, `formatRunStatus`, `formatExecutionMode`, `formatPercent` from inline component functions into `src/client/lib/import-candidate-presentation.js`.
- Added 52 unit tests in `test/client/import-candidate-presentation.test.js`.

### 2026-05-04 - Settings Page

Status: **Resolved** (2026-05-11)

Initial feedback:

- The settings page has a lot of options, but they are not organized into clear tabs or durable sections that match how a user thinks about configuration.
- The current page feels like one very long contract form rather than a usable settings experience.
- System/security, slskd connectivity, provider intake, artwork behavior, paths, path mappings, path validation, Plex import, and app-user management all appear in one continuous vertical flow.
- The title `Settings contract` reinforces implementation framing instead of user-facing configuration framing.

What feels wrong structurally:

- These settings should likely be split into clearer groups such as general/system, connections, paths/storage, providers, artwork, and users.
- The current page makes scanning and returning to a specific section harder than it should be.
- Long-form scrolling makes it easy to lose orientation inside the page.

Sidebar behavior feedback:

- The sidebar appears to be lost on long pages because it is not acting like a sticky app navigation rail.
- On the settings page, scrolling deep into the form also scrolls the sidebar out of the primary viewing area, which makes the shell feel unstable.
- A control-plane sidebar should stay anchored and usable during long-page navigation.

Design direction to revisit:

- Break settings into tabs, sub-navigation, or durable grouped sections with stronger hierarchy.
- Replace implementation-centric headings like `Settings contract` with plain configuration language.
- Make the shell sidebar sticky or otherwise persistent during long-page scrolling.

Resolution:

- The old monolithic `SettingsView.vue` (1,421 lines) was not referenced by the router — confirmed dead code. Deleted along with its hash-anchor navigation helpers (`settings-navigation.js`) and their orphaned test file.
- `SettingsWorkspaceView.vue` (the tab-split shell already in use) was already correct.
- `SettingsLibraryView.vue`: replaced `panel-light`/`section-header`/`muted-copy` stubs with `cfg-page`/`hx-card`/`hx-empty` design system placeholder card.
- `SettingsNotificationsView.vue`: replaced `panel-light`/`section-header`/`hx-form-row`/`hx-btn-primary`/`muted-copy` with `cfg-page`/`hx-card`/`hx-text-muted`/`data-variant="primary"`; renamed heading from "Push Notifications" to "Browser notifications"; fixed `...` → `…`; restructured permission/subscribe/unsubscribe states as clean conditional blocks.
- Fixed a pre-existing test hang in `useOperationHistory.test.js`: two tests triggered real `setInterval` polling by loading active runs without injecting a fake timer, preventing process exit. Added `setIntervalFn: () => 0` / `clearIntervalFn: () => {}` to both.