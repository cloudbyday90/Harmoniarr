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

Status: **Resolved** (2026-05-11 — targeted critical-analysis fixes).

Resolution summary: The specific structural concerns from the original review were addressed by the 2026-05-11 critical analysis. (1) The three-island layout (brand block / nav block / signed-in card) was collapsed by removing the sidebar footer account card entirely — it was a direct duplicate of the topbar user button. (2) With the footer gone, .hx-sidebar-nav is top-anchored and the nav starts immediately from the top of the sidebar. (3) The app shell grid uses height: 100dvh; overflow: hidden with .hx-sidebar { height: 100%; overflow-y: auto } — the sidebar is inherently viewport-locked so it never scrolls off-screen on long pages. Full list of specific fixes is documented in the 2026-05-11 critical analysis section below.

Original feedback:

- The sidebar reads as if it starts halfway down the screen instead of acting like a clear primary navigation rail.
- The current shell composition makes the navigation feel detached from the top of the app rather than anchored as a stable dashboard frame.
- The left rail currently feels like three separate vertical islands: brand block, nav block, and signed-in card, with too much empty space between them.
- On a tall dashboard page, the nav ends up visually centered between the top branding and bottom account block, which makes the whole shell feel oddly suspended.
- The shell does not yet establish a strong “this is the app frame” feeling; it still reads like a styled mockup rather than a durable operations workspace.

What felt wrong structurally:

- Primary navigation should feel immediately available from the top of the screen, not visually stranded in the middle of a tall rail.
- The current vertical distribution gives too much weight to decorative spacing and not enough to orientation.
- The sidebar competes with the content column instead of grounding it.

Design direction applied:

- Reworked the authenticated shell so navigation is top-anchored and behaves like a persistent application frame (sidebar footer removal + grid height constraints).
- Brand block (topbar) and nav (sidebar) now live in a tight two-level hierarchy — no separate session island in the sidebar.
- Shell sidebar is locked to the viewport via CSS grid constraints; content scrolls independently.

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

Status: **Resolved** (2026-05-11 — Account Security page redesign).

Redesign implemented:
- Page retitled "My account" with subtitle "Password, sessions, and account preferences."
- Information hierarchy corrected: Change password is now first (security-critical), followed by Active sessions, then Recent account activity, then a clearly labelled Preferences section (Appearance, Import preferences, Push notifications).
- Extracted six pure helper functions to new `src/client/lib/account-security-presentation.js`: `isSecurityRelevantEvent`, `getActivityEventTone`, `getActivityEventStatusLabel`, `formatSessionTimestamp`, `isServiceSession`, `formatUserAgent`.
- Activity feed now filters to security-relevant events only (prefixes: `login_`, `password_`, `session_`, `bootstrap_`, `user_`). Non-security events such as metadata imports are suppressed.
- Raw ISO 8601 timestamps replaced with locale-formatted strings (e.g. "May 11, 2026, 3:13 PM") throughout sessions and activity.
- Raw `eventType` keys replaced with status pills using tone (`success` / `danger` / `info`) and compact labels (Succeeded, Failed, Revoked, etc.).
- Sessions now distinguish browser sessions (Mozilla/ UA) from service tokens, showing a labelled pill ("Browser" / "Service") on each row.
- Inline mismatch validation pill on the confirm-password field; shared action feedback banner below the page header.
- All old CSS classes removed and replaced with design system: `hx-page`, `hx-page-header`, `hx-card`, `hx-card-header`, `hx-card-body`, `hx-card-body--flush`, `hx-card-actions`, `hx-field`, `hx-field-label`, `hx-input`, `hx-select`, `hx-btn`, `hx-pill`, `hx-empty`, `hx-text-muted`. Scoped styles use `as-` prefix.
- Added 64 unit tests covering all six lib helpers.

Original feedback:

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

### 2026-05-11 - Authenticated Dashboard Shell / Sidebar — Critical Analysis

Status: **Partially resolved** (2026-05-11 — shell quick-wins; deeper items tracked below).

Critical analysis performed against the live walkthrough. Full findings:

**Resolved in this session:**

1. **Home nav link permanently active on all screens** — `router-link-active` (prefix-match) fired on `/app/dashboard` for every route under `/app`. Fixed by adding `exact: true` to the dashboard nav item in both `operatorNav` and `requesterNav`, and binding `:active-class="item.exact ? '' : 'router-link-active'"` / `:exact-active-class="item.exact ? 'router-link-active' : 'router-link-exact-active'"` on each `RouterLink` in the sidebar and mobile bottom nav.

2. **No tooltip fallback when sidebar collapses to icon-only (≤960px)** — Added `:title="item.label"` to each sidebar `RouterLink`. Hovering now shows the nav label in a native tooltip.

3. **Sidebar footer duplicates the topbar user button** — The `hx-sidebar-footer` showing username + role was redundant with the topbar user menu. Removed entirely. Dead `session-card`, `session-username`, and `session-role` CSS rules in `styles.css` removed at the same time.

4. **`session-username` is a legacy CSS class, not a design system class** — Removed from the topbar username span in `AppShell.vue`.

5. **"Contextual onboarding" is an internal product term** — Replaced the `<h3>Contextual onboarding</h3>` in `OnboardingSummaryPanel.vue` with a dynamic, user-facing title: "Complete your setup" (setup mode) / "Setup status" (normal mode).

6. **Raw ISO 8601 timestamps in setup-step metadata (e.g. "CHECKED AT 2026-05-11T15:41:42.139Z")** — `formatMetaValue` now detects ISO 8601 datetime strings and formats them as locale strings. `formatMetaLabel`, `formatMetaValue`, `getStepStatusLabel`, and `getStepStatusClass` extracted from `OnboardingSummaryPanel.vue` into `src/client/lib/onboarding-presentation.js` (31 tests in `test/client/onboarding-presentation.test.js`).

**Still open (tracked for follow-up):**

- **"Missing" icon is semantically wrong** — **Resolved (2026-05-11)**. Replaced the ⓘ info-circle SVG (circle + vertical stem + dot) with a dash-circle / circle-minus (circle + horizontal dash `M8 12h8`). Dash-circle is the conventional icon for "absent / not present" in media management UIs (used by Lidarr, Radarr, Sonarr for missing items), whereas info-circle is universally read as "help or more information". Changed in both the sidebar nav and the mobile bottom nav in `AppShell.vue`. Extracted `buildOperatorNav()`, `buildRequesterNav()`, `buildVisibleNav(isRequester, count)`, and `notificationTone(category)` from inline AppShell code into `src/client/lib/app-shell-presentation.js` — eliminates duplication of nav config and the badge-injection logic, both of which are now independently testable. Added 24 unit tests in `test/client/app-shell-presentation.test.js`. Tests include a regression guard asserting the 'missing' nav item does not use icon name `'info'` or `'info-circle'`.
- **Dashboard priority: setup checklist should precede the requester search widget** — **Resolved (2026-05-11)**. `OnboardingSummaryPanel` moved to be the first card in `OperatorDashboardPanel`. `v-if` changed from `showOnboardingSummary` to `showOnboardingPanel` (`showOnboardingSummary || isLoadingOnboarding`): the panel now renders immediately on mount with a loading skeleton so operators see setup status before any data arrives, rather than having it pop in below the search widget after the async load completes. `:is-setup-mode` bound dynamically to `showOnboardingSummary` — when there are outstanding issues the heading reads "Complete your setup" instead of the less actionable "Setup status". Extracted `releaseYear`, `requestHeadline`, `fulfillmentTone`, `fulfillmentLabel` from inline functions in `OperatorDashboardPanel` into `src/client/lib/operator-dashboard-presentation.js`. Added 29 unit tests in `test/client/operator-dashboard-presentation.test.js`.
- **Login copy excludes requesters** — **Resolved (2026-05-11)**. Extracted `buildLoginDescription()` and `buildLoginInfoMessage(reason)` from `LoginView.vue` into `src/client/lib/login-presentation.js`. `buildLoginDescription()` returns persona-inclusive copy: *"Sign in to request music, track your library, and manage your account. Operators and administrators also access imports, diagnostics, and system settings."* — leading with the requester use-case before mentioning operator-only capabilities. `buildLoginInfoMessage(reason)` is the extracted `infoMessage` computed (handles `claim-complete`, `session-expired`, `reauth-required`; returns `''` for unknown/null/undefined). `LoginView.vue` now imports both functions; `description` bound with `:description="buildLoginDescription()"`. Added 13 unit tests in `test/client/login-presentation.test.js`.
- **Tab bar on Activity overflows without scroll affordance** — **Resolved (2026-05-11)**. Implemented `useTabbarOverflow` composable (`src/client/composables/useTabbarOverflow.js`). Takes injectable `addScrollListenerFn`, `removeScrollListenerFn`, `ResizeObserverCtor`; returns `{ hasOverflowStart, hasOverflowEnd, attach, cleanup }`. Components call `attach(el)` in `onMounted` and `cleanup` in `onUnmounted`. Activity and Settings views wrapped `hx-tabbar` in `.hx-tabbar-wrap` with `:class` bindings. Design system adds `::before`/`::after` fade-gradient pseudo-elements (opacity 0→1 transition) controlled by `.has-overflow-start` / `.has-overflow-end`. 0.5px sub-pixel tolerance prevents spurious fade at scroll end due to DPR rounding. 21 unit tests in `test/client/useTabbarOverflow.test.js`.
- **Auth shell redesign** — **Resolved (2026-05-12)** via five targeted fixes that collectively address the actionable parts of the original feedback without requiring a full visual redesign. Changes: (1) Vertical centering — `.auth-page` changed from `align-items: flex-start` to `align-items: center`; the form card group is now centered in the viewport on all screen sizes instead of anchored to the top with empty space below. (2) Redundant h2 removed — `<h2>Login</h2>` inside the form card was removed; the page `<h1>` already provides the heading so the duplicate added no hierarchy value. (3) Inline claim note replaced with a direct `RouterLink` — the opaque *"Use the claim-account path shown in the related entry points"* note replaced with *"First time here? Claim your account with the code from your administrator"* where "Claim your account" is a live `RouterLink` that prefills the username if one has been typed. `buildClaimAccountRoute(username)` extracted to `login-presentation.js` (8 new tests, covers trimming, null/undefined, empty/whitespace, email-format usernames). (4) Emergency recovery link removed from login footer — `authEntrySupportDefinitions['login']` in `auth-entry-support.js` changed from `[claim-account, recovery]` to `[claim-account]` only; the recovery path is operator-only emergency tooling that must not appear on the primary login screen for all users; it remains accessible through its own direct URL. (5) Jargon eyebrow removed — `eyebrow="Local access"` removed from `LoginView.vue`; `eyebrow` made optional with `default: ''` and `v-if="eyebrow"` guard in `AuthEntryShell.vue` so the `<p>` is omitted when not needed. On-brand link colours added to `.auth-entry-inline-note a` so the RouterLink renders in the established green palette rather than browser-default blue. Test count updated to **1180 tests, 0 failures**.

Test suite after this session: **1180 tests, 0 failures** (up from 1172).

### 2026-05-12 - Library Screen

Status: **Resolved** (2026-05-12 — targeted presentation fixes).

Critical analysis performed against `LibraryView.vue` and `library-release-normalization.js`.

**Issues identified and resolved:**

1. **`formatLibraryTrackCounts` used slash separator instead of "of"** — `"8 / 12 tracks"` reads like a file-system ratio; `"8 of 12 tracks"` is the natural human form used throughout the rest of the UI. Fixed in `library-release-normalization.js`. Existing tests that asserted the wrong string were also updated.

2. **`formatLibraryTrackCounts` pluralisation bug for single track** — `"1 tracks"` was returned for a fully-matched single-track release. The pre-existing test even asserted `'1 tracks'` confirming the bug was not caught. Fixed: returns `"1 track"` (singular) when `expectedTrackCount === 1`. Test renamed and corrected; regression guard added asserting the output never equals `'1 tracks'`.

3. **Page subtitle was hardcoded with internal product language** — *"Your music collection — releases acquired and reconciled with the library."* used the internal term "reconciled" which is not user-facing vocabulary. Extracted to `buildLibraryPageSubtitle()` in `library-release-normalization.js` returning operator-friendly copy. A jargon guard test (`does not contain the word 'reconcil'`) prevents regression.

4. **Stat card copy hardcoded inline in the template** — Four separate `<article>` blocks with inline label/value/meta repeated the same structure with no shared logic or testability. Replaced with `buildLibraryStatCards(total, complete, partial, duplicate)` returning a frozen array of `{label, value, meta}` objects. `LibraryView.vue` now drives the grid with `v-for="card in statCards"` using a single `statCards` computed. All three inline `completeCount` / `partialCount` / `duplicateCount` computeds collapsed into the single `statCards` computed call.

5. **Releases card subtitle showed "0 releases" in empty state** — The `<p class="hx-card-subtitle">` was unconditionally rendered including during empty/loading states, showing "0 releases" before any data arrived. Replaced with `buildLibraryReleasesCardSubtitle(count)` which returns `null` for `count ≤ 0` or falsy input; the subtitle `<p>` is conditionally rendered with `v-if`.

**Extractions and tests added:**

- `buildLibraryPageSubtitle()` — pure, deterministic, jargon-free subtitle string. 3 tests.
- `buildLibraryStatCards(total, complete, partial, duplicate)` — returns frozen array of 4 frozen `{label, value, meta}` objects. 8 tests covering structure, values, freeze, zero-values, and non-jargon meta.
- `buildLibraryReleasesCardSubtitle(count)` — returns `null` for empty/invalid, `"1 release"` for singular, `"N releases"` for plural. 7 tests including singular regression guard.

Updated 3 pre-existing tests that asserted the old (wrong) format strings; added 1 regression guard for the pluralisation bug.

Test suite after this session: **1200 tests, 0 failures** (up from 1180).

### 2026-05-12 - Missing Screen

Status: **Resolved** (2026-05-12 — targeted presentation fixes).

Critical analysis performed against `MissingView.vue` and `wanted-release-normalization.js`.

**Issues identified and resolved:**

1. **`formatWantedTrackCounts` used slash separator `" / "` instead of `" of "`** — same issue as Library screen (fixed in same session). `"8 / 12 tracks"` → `"8 of 12 tracks"`. Pre-existing tests that asserted the wrong strings were corrected. Regression guard added.

2. **`formatWantedTrackCounts` pluralisation bug for single-track release** — `"0 / 1 tracks"` for a single missing track. Fixed: returns `"0 of 1 track"` (singular) when `expectedTrackCount === 1`. Existing test was also asserting the wrong string.

3. **Page subtitle used internal jargon `"reconciliation gaps"`** — *"Wanted releases and reconciliation gaps across the monitored library."* Replaced by `buildMissingPageSubtitle()` returning *"Monitored releases not yet fully acquired. Request any release to start filling the gaps."* Jargon guard test prevents regression.

4. **`"Wanted summary"` card title was internal product language** — Renamed to `"Acquisition status"` so the heading is immediately clear to any user, not just those familiar with the internal product model.

5. **Raw lowercase status pills** — `wanted.summary.value.status` and `reconciliation.summary.value.status` were rendered raw (e.g. `complete`, `failed`). Replaced with `formatMissingSummaryStatus(status)` which maps known values to capitalised labels (`"Complete"`, `"Healthy"`, `"Partial"`, `"Unavailable"`, `"Failed"`) and title-cases unknown values.

6. **`"Last reconciled"` subtitle used jargon and raw ISO 8601 timestamps** — Both the "Acquisition status" and "Reconciliation" card subtitles used `lastReconciledAt ?? 'never'` which would show raw ISO 8601 strings if a timestamp was present. Replaced with `formatLastReconciledAt(value)` that returns `"never"` for null/empty, a locale-formatted datetime string for valid ISO 8601, and the raw value as a fallback. Label changed from `"Last reconciled"` to `"Last updated"`.

7. **Inline 15-line sort comparator in `filteredReleases`** — The full sort comparator (field branching + direction logic) was embedded inside the component computed. Extracted to `sortWantedReleases(releases, field, order)` in `wanted-release-normalization.js`. The `filteredReleases` computed is now 4 lines. 10 unit tests added covering sort by artist/title/date, ascending/descending, empty input, null input, immutability, and `artistSortName` fallback.

8. **Stat grid was 4 hardcoded `<article>` blocks** — Same pattern fixed on the Library screen. Replaced with `buildMissingStatCards(monitoredCount, totalWanted, missingCount, partialCount)` returning a frozen array of 4 frozen `{label, value, meta}` objects. View drives the grid with `v-for="card in statCards"` from a single `statCards` computed. 7 unit tests.

9. **Releases card showed `"0 releases pending acquisition"` in empty state** — Replaced with `buildWantedReleasesCardSubtitle(count)` which returns `null` for `count ≤ 0` or falsy input; the subtitle `<p>` is hidden with `v-if`. 7 unit tests including singular regression guard.

**Extractions and tests added to `wanted-release-normalization.js`:**

- `sortWantedReleases(releases, field, order)` — pure sort, 10 tests
- `buildMissingPageSubtitle()` — 3 tests including jargon guard
- `buildMissingStatCards(monitoredCount, totalWanted, missingCount, partialCount)` — 7 tests
- `buildWantedReleasesCardSubtitle(count)` — 7 tests
- `getMissingSummaryTone(status)` — 7 tests
- `shouldShowMissingSummaryPill(status)` — 5 tests
- `formatMissingSummaryStatus(status)` — 8 tests
- `formatLastReconciledAt(value)` — 6 tests

Updated 3 pre-existing tests asserting old slash-format strings; added 1 regression guard.

Test suite after this session: **1255 tests, 0 failures** (up from 1200).

---

### 2026-05-11 - Discover Screen

Status: **Resolved** (2026-05-11 — targeted copy and extraction fixes).

Critical analysis performed against `DiscoverView.vue` and the missing `discover-presentation.js` lib.

**Issues identified and resolved:**

1. **No `discover-presentation.js` lib existed** — Unlike every other reviewed screen, Discover had no extracted presentation lib. Two inline component functions (`avatarStyle`, `artistInitial`) wrapped `getArtistAvatar` directly in `<script setup>`. These are now extracted to `buildDiscoverAvatarStyle(id, name)` and `buildDiscoverArtistInitial(id, name)` in `src/client/lib/discover-presentation.js`. The avatar `<div>` in both the suggestions grid and the search results grid now calls the lib functions directly from the template.

2. **"monitor" appeared throughout user-facing copy** — The page subtitle (*"Find artists you love and monitor them for new releases."*), the taste-graph subtitle (*"Based on artists you've monitored"*), and the seed chip `aria-label` (*"Your taste seeds"*) all used operator/internal product language. Requesters expect "follow". Replaced via lib functions: `buildDiscoverPageSubtitle()`, `buildDiscoverGraphSubtitle()`, `buildDiscoverSeedsAriaLabel()`. The seed chip remove button `aria-label` (*"Remove {name} from taste seeds"*) is now `buildDiscoverSeedRemoveAriaLabel(name)` → *"Stop following {name}"*.

3. **Search error title exposed `MusicBrainz` service name** — `:title="searchError"` passed the raw composable error string directly to `EmptyState`. This could render *"MusicBrainz is temporarily unavailable"* — an internal service name that means nothing to a requester. `formatDiscoverSearchError(rawError)` now normalises any message containing `"musicbrainz"` to *"Artist search is temporarily unavailable. Try again in a moment."*, without mentioning the service by name. 10 unit tests cover null/undefined/empty, the exact phrase, case-insensitive match, substring match, and pass-through for unknown messages.

4. **Search error body was factually wrong for service outages** — *"Check your connection or try a different artist name."* is incorrect when MusicBrainz is down (the user's connection is fine). Replaced with `buildDiscoverSearchErrorBody()` → *"Try again or search for a different artist."* which is correct in all failure modes.

5. **Pre-search empty state described UI mechanics instead of value** — *"Type an artist name above and press Search. Once you monitor artists, Harmoniarr will surface new releases for you to request."* Combined "press Search" instructions with "monitor"/"surface" jargon. Replaced with `buildDiscoverPreSearchBody()` → *"Follow an artist and Harmoniarr will automatically watch for their new releases — ready for you to request."*

6. **"Done — go to Home" button was a wizard-exit affordance** — Appeared in the page header when `hasMonitored` was true (session-ephemeral). Discover is a persistent navigation screen, not a modal or setup wizard. Users return to it repeatedly to find more artists. The button was removed; monitoring success is already communicated by the artist card state change and the taste graph section appearing. The now-unused `hasMonitored` destructure was removed from the `useArtistMonitoring` spread.

7. **"No similar artists found for your current picks."** — "picks" is casual and inconsistent with the product's tone. Replaced with `buildDiscoverNoSimilarArtistsMessage()` → *"No similar artists found based on your current selection."*

**Extractions and tests added to `discover-presentation.js`:**

- `buildDiscoverPageSubtitle()` — 3 tests
- `buildDiscoverPreSearchBody()` — 4 tests including jargon/mechanic guards
- `formatDiscoverSearchError(rawError)` — 10 tests
- `buildDiscoverSearchErrorBody()` — 3 tests
- `buildDiscoverGraphSubtitle()` — 3 tests
- `buildDiscoverSeedsAriaLabel()` — 3 tests
- `buildDiscoverSeedRemoveAriaLabel(name)` — 6 tests
- `buildDiscoverNoSimilarArtistsMessage()` — 3 tests
- `buildDiscoverAvatarStyle(id, name)` — 7 tests
- `buildDiscoverArtistInitial(id, name)` — 7 tests

Test suite after this session: **1303 tests, 0 failures** (up from 1255).

---

### 2026-05-11 - Artist Detail Screen

Status: **Resolved** (2026-05-11 — targeted copy, extraction, and deduplication fixes).

Critical analysis performed against `ArtistDetailView.vue`. No `artist-detail-presentation.js` lib existed. All presentation logic was inline in `<script setup>` or directly embedded in the template.

**Issues identified and resolved:**

1. **Raw API validation error leaked to UI** — `{{ discographyError }}` rendered the raw composable error string directly. MusicBrainz parameter validation errors such as `"limit must be an integer between 1 and 25"` were shown verbatim — technical noise that means nothing to a requester. `formatDiscographyError(rawError)` now normalises: messages containing `"must be"`, `"invalid"`, or `"bad request"` are suppressed to a generic fallback; messages containing `"musicbrainz"` (case-insensitive) are normalised to *"Discography is temporarily unavailable. Try again in a moment."*; unknown messages pass through unchanged. A parallel `formatArtistDetailError(rawError)` covers the artist metadata error.

2. **`"Open in MusicBrainz ↗"` exposed an internal data source name** — The MusicBrainz attribution link rendered the service name directly in the UI. Requesters have no reason to know MusicBrainz powers artist lookups. `buildArtistMusicBrainzLabel()` → *"More info ↗"* removes the service name while retaining the external-link signal.

3. **`{{ section.type }}s` naive plural was incorrect for some types** — `"Other"` would render as `"Others"` and the `"EP"` result (`"EPs"`) was coincidentally correct via the generic append, not by explicit intent. `pluralizeReleaseType(type)` uses an explicit map: `Album→Albums`, `Single→Singles`, `EP→EPs`, `Broadcast→Broadcasts`, `Other→Other`; unknown types append `s`; null/undefined/empty → `"Releases"`. A regression guard test confirms `"Other"` is explicitly handled and would not produce `"Others"`.

4. **Inline `avatarStyle`/`artistInitial` functions duplicated Discover's pattern** — Both `ArtistDetailView` and `DiscoverView` had identical inline component functions wrapping `getArtistAvatar`. The canonical shared helpers `buildAvatarStyle(id, name)` and `buildAvatarInitial(id, name)` are now exported from `src/client/lib/artist-avatar.js`. `discover-presentation.js` delegates to them; `artist-detail-presentation.js` exports `buildRelatedArtistAvatarStyle`/`buildRelatedArtistInitial` which also delegate. Inline avatar functions removed from both views.

5. **Inline computed logic cluttered `<script setup>`** — `artistMeta` (8-line join/filter block) and `musicBrainzUrl` (guard + template string) were inlined. Extracted to `buildArtistMetaLine(artist)` and `buildArtistMusicBrainzUrl(mbid)` in `artist-detail-presentation.js`; computeds are now one-liners.

6. **Empty discography body exposed internal service name** — `"MusicBrainz has no release groups listed for this artist."` used `"release groups"` (MusicBrainz internal terminology) and named the data source. Replaced with `buildNoDiscographyBody()` → *"No releases are listed for this artist yet."*

7. **Raw artist error rendered without normalisation** — `{{ artistError }}` passed the raw error string directly into the template for soft (non-fatal) artist metadata errors, with the same leak risk as the discography error. Replaced with `formatArtistDetailError(artistError)`.

**New lib: `src/client/lib/artist-detail-presentation.js`** (10 exports):

- `buildArtistMetaLine(artist)` — 10 tests
- `buildArtistMusicBrainzUrl(mbid)` — 6 tests
- `buildArtistMusicBrainzLabel()` — 3 tests (no-MusicBrainz guard)
- `buildArtistDetailErrorBody()` — 2 tests
- `formatDiscographyError(rawError)` — 11 tests (validation suppression, service-name normalisation, pass-through)
- `formatArtistDetailError(rawError)` — 5 tests
- `pluralizeReleaseType(type)` — 10 tests (EP regression guard, Other explicit mapping)
- `buildNoDiscographyBody()` — 3 tests (no-MusicBrainz guard)
- `buildRelatedArtistAvatarStyle(id, name)` — 6 tests (delegation verified)
- `buildRelatedArtistInitial(id, name)` — 6 tests (delegation verified)

**Shared helpers added to `src/client/lib/artist-avatar.js`** (2 new exports, 14 new tests):

- `buildAvatarStyle(id, name)` → `{ background, color }` (CSS-ready; maps `bg→background`, `fg→color`)
- `buildAvatarInitial(id, name)` → single uppercase character or `'?'`

Test suite after this session: **1377 tests, 0 failures** (up from 1303).

---

### 2026-05-11 - Search Screen

Status: **Resolved** (2026-05-11 — copy corrections, error normalisation, lib extraction).

Critical analysis performed against `SearchView.vue` (685 lines). No `search-presentation.js` lib existed. Five pure utility functions were inline in `<script setup>` with no tests; all string literals were embedded in the template.

**Issues identified and resolved:**

1. **Raw music search error as `EmptyState :title`** — `:title="musicSearchError"` passed the raw composable error string directly to the page-level heading. API validation errors like `"limit must be an integer between 1 and 25"` or raw service-name errors would render verbatim. `formatMusicSearchError(rawError)` now normalises: `"musicbrainz"` (case-insensitive) → `'Search is temporarily unavailable. Try again in a moment.'`; `"must be"/"invalid"/"bad request"` → generic fallback; unknown messages pass through.

2. **`'Probing slskd…'` rendered in the Network status pill** — The status label computation returned the literal string `'Probing slskd…'` while the connection state was being fetched. "slskd" is an internal service dependency name meaningless to requesters. Extracted to `buildNetworkStatusLabel(statusObj, isProbing)` → `'Checking connection…'` while probing.

3. **Raw `networkErrorMessage` in a danger pill** — Three raw strings could leak: `'slskd did not return a search identifier'`, `'Failed to poll search results'`, and raw `error.message` from fetch failures. `formatNetworkSearchError(rawError)` maps known patterns to user-readable copy and strips service names.

4. **Raw `searchMeta?.state` in the results subtitle** — slskd internal state machine values (`'InProgress'`, `'Completed'`, `'Cancelled'`) rendered verbatim next to the results count. `buildNetworkSearchStateLabel(state)` maps to human-readable labels: `InProgress→Searching`, `Completed→Complete`, `Cancelled→Stopped`, `TimedOut→Timed out`; unknown states are capitalised.

5. **"monitor" in pre-search body copy** — `"Type a name above and press Search. Find artists to monitor or releases to request."` used operator language ("monitor") already corrected on Discover and combined a UI instruction with a value statement. Replaced via `buildSearchPreSearchBody()` → `'Find artists to follow or releases to request.'`

6. **"Soulseek peers" in network empty state body** — `"Enter a query above and press Search to discover Soulseek peers sharing matching files."` exposed "Soulseek" as a network-layer detail. Replaced via `buildNetworkNoResultsBody()` → `'Enter a query and press Search. Results appear as peers respond with matching files.'`

7. **No `search-presentation.js` lib — five untested inline pure functions** — `formatBytes(bytes)`, `formatSpeed(bytesPerSec)`, `totalSizeForResponse(response)`, the `statusTone` computed logic, and the `statusLabel` computed logic were all inline in `<script setup>` with no tests. All extracted to `src/client/lib/search-presentation.js`; `statusTone`/`statusLabel` computeds are now one-liners delegating to `buildNetworkStatusTone`/`buildNetworkStatusLabel`.

**New lib: `src/client/lib/search-presentation.js`** (10 exports):

- `formatMusicSearchError(rawError)` — 11 tests (MusicBrainz normalisation, validation suppression, pass-through)
- `formatNetworkSearchError(rawError)` — 9 tests (slskd name suppression, known error mapping)
- `buildNetworkStatusTone(statusObj)` — 11 tests (all tone values, null/undefined, both state fields)
- `buildNetworkStatusLabel(statusObj, isProbing)` — 8 tests (no-slskd guard, capitalisation, connectionState fallback)
- `buildNetworkSearchStateLabel(state)` — 10 tests (all mapped states, fallback capitalisation, raw-enum regression guard)
- `buildSearchPreSearchBody()` — 3 tests (no-monitor guard, non-empty, stable)
- `buildNetworkNoResultsBody()` — 3 tests (no-Soulseek guard, non-empty, stable)
- `formatBytes(bytes)` — 13 tests (null/zero/negative/non-number, unit progression, decimal logic)
- `formatSpeed(bytesPerSec)` — 6 tests (null/zero/negative, /s suffix, KB/s and MB/s)
- `totalSizeForResponse(response)` — 7 tests (null, totalSize preference, files fallback, missing size)

Test suite after this session: **1457 tests, 0 failures** (up from 1377).