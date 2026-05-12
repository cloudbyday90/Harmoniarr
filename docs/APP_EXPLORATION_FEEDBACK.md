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

### 2026-05-11 - Account Security Screen

**Screen:** `AccountSecurityView.vue` (627 lines before changes)
**Lib:** `src/client/lib/account-security-presentation.js`
**Tests:** `test/client/account-security-presentation.test.js`

**Issues identified and resolved:**

1. **Must-change-password banner copy was operator-facing** — *"Password change required — this account cannot perform admin actions until the password is updated."* contains the internal term "admin actions". Replaced with `buildMustChangePasswordWarning()` → *"Your password must be updated before you can continue."* — user-facing and role-neutral.

2. **Active Sessions subtitle contained internal term "Browsers and services"** — "services" is the internal concept (sidecar/service-account sessions). Replaced with `buildActiveSessionsSubtitle()` → *"Devices and apps currently signed in to this account."*

3. **"Import preferences" card title mislabelled the section** — The card controls notification push subscriptions and request preferences, not imports. Replaced with `buildRequestPreferencesTitle()` → *"Request preferences"*.

4. **Push notification body copy was vague and inconsistent** — *"Notifications are enabled on this device."* / *"Notifications are not enabled on this device."* — passive constructions with no call to action. Replaced with `buildPushSubscribedBody()` / `buildPushUnsubscribedBody()`: *"You'll be notified when your requests are ready, even when the app isn't open."* / *"Enable to be alerted when your requests are ready."*

5. **Push permission-denied paragraph contained browser instruction jargon** — *"Open your browser's site settings and allow notifications for this page, then reload."* is only correct for desktop Chrome. Replaced with `buildPushPermissionDeniedBody()` which uses the same action-oriented phrasing but with consistent product copy.

6. **Raw `pushErrorMessage` exposed internal error strings** — The error pill rendered the raw error from the Push API verbatim (e.g. *"Registration failed"*, *"NotAllowed"*, *"The push service is unreachable"*). Replaced with `formatPushNotificationError(rawError)` which normalises known patterns (permission errors, service-worker failures, push service unavailability, aborts) to user-facing copy and falls through to the raw message only when none match.

7. **`loadPreferences()` call was orphaned outside `onMounted`** — A `void loadPreferences().then(syncDraftFromPreferences)` line appeared between two computed refs with incorrect indentation, outside any lifecycle hook. Moved into the existing `onMounted` block alongside `checkPushStatus`, `loadSessions`, and `loadRecentActivity`.

**Extractions and tests added to `account-security-presentation.js`:**

- `buildMustChangePasswordWarning()` — 4 tests
- `buildActiveSessionsSubtitle()` — 3 tests
- `buildRequestPreferencesTitle()` — 4 tests
- `buildPushSubscribedBody()` — 3 tests
- `buildPushUnsubscribedBody()` — 3 tests
- `buildPushPermissionDeniedBody()` — 3 tests
- `formatPushNotificationError(rawError)` — 13 tests

Test suite after this session: **1490 tests, 0 failures** (up from 1457).

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

Status: **Resolved** (2026-05-11 — copy corrections, error normalisation, lib extraction; 2026-05-12 — sort/filter extraction, count-label extraction).

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

**Additional exports added 2026-05-12** (3 new exports, 18 new tests):

8. **Inline sort/filter comparator extracted** — The `sortedResponses` computed contained a 14-line inline filter+sort that extracted file count from two different response shapes, sorted by upload speed descending with queue-length tiebreaker. Logic was untested and coupled to the component. Extracted to `sortNetworkResponses(responses, { minimumFileCount })` in `search-presentation.js`. The computed is now a single delegating line.

9. **Inline pluralisation ternaries replaced** — Two subtitle ternaries (`peer/peers`, `file/files`) were inline in the template. Replaced with `formatPeerCountLabel(count)` → `"1 peer"` / `"N peers"` and `formatFileCountLabel(count)` → `"1 file"` / `"N files"`.

**Updated lib: `src/client/lib/search-presentation.js`** (13 exports total):

- `sortNetworkResponses(responses, { minimumFileCount })` — 9 tests (empty, no-mutation, fileCount filter, files-array filter, speed sort, queue tiebreaker, missing-field defaults, exact-boundary)
- `formatPeerCountLabel(count)` — 4 tests (0, 1, 2, 100)
- `formatFileCountLabel(count)` — 4 tests (0, 1, 5, 50)

Test suite after 2026-05-12 session: **1907 tests, 0 failures** (up from 1889).

---

### 2026-05-11 - Settings — Users & Access Screen

**Screen:** `SettingsUsersView.vue` (611 lines before changes)
**Lib:** `src/client/lib/settings-users-presentation.js` (new file)
**Tests:** `test/client/settings-users-presentation.test.js` (new file)

**Issues identified and resolved:**

1. **Role values were raw lowercase backend enum strings** — The user card header rendered `user.role` with `text-transform: uppercase` CSS to cosmetically fix a data problem. Both the card header badge and inline label showed `admin`, `operator`, `requester` as raw values. The CSS hack was removed; `formatUserRole(role)` now returns `"Admin"`, `"Operator"`, `"Requester"` and falls back to capitalising unknown roles.

2. **"Signs in with: local password" exposed internal auth provider name** — The word `"local"` is the backend auth-provider enum value, meaningless to an admin. The ternary `user.authProvider === 'plex' ? 'Plex' : 'local password'` was replaced with `formatAuthProvider(user.authProvider)` returning `"Plex"` for Plex and `"password"` for local. The colon was also removed so the copy reads naturally as a sentence.

3. **"Import non-conflicting Plex users" button exposed implementation terminology** — `"non-conflicting"` is an internal API term for entries that pass validation. An admin who hasn't run a Preview doesn't know what a conflict means in this context. Button label changed to `"Import ready Plex users"`.

4. **Redundant "Not linked" paragraph when Plex is disconnected** — `plexLinkStatusLabel()` was a closure over `secretStatus` that returned `"Not linked"` when the Plex link was absent — but the card header already displayed a `"Not linked"` pill. The paragraph was only meaningful when linked (it showed *"Linked as [Title] (email)"*). Replaced closure with `formatPlexLinkStatusDetail(plexStatus)` which returns `null` when not linked; the paragraph is guarded with `v-if` so it's hidden until there is something useful to show.

5. **Empty-state copy used developer process language** — *"Create users above, then attach Plex onboarding and folder-provisioning flows as needed."* — `"attach … flows"` is internal task description language. Replaced with `buildUsersEmptyStateBody()` → *"Once you've added users, their accounts will appear here. You can link Plex accounts and set up personal library folders from each user's card."*

6. **Six pure functions inline in `<script setup>` with no tests** — `describePlexLocalAuthStatus`, `plexLibraryAccessPolicyLabel`, `plexLibraryAccessPolicyTone`, `describePlexLibraryAccessPolicy`, `plexLinkStatusLabel`, `hasPendingManagedLibraryRootChanges` were all defined as local functions in the component. All were pure (stateless except the `plexLinkStatusLabel` closure, which was refactored to accept the plex status as a parameter). All moved to `settings-users-presentation.js` and are now tested.

7. **Raw Plex preview enum values in the import preview cards** — When a Plex user preview is loaded, four raw backend values were rendered verbatim: `profile.classification` (e.g. `create`, `linked`, `conflict`), `profile.homeRole` (e.g. `admin`, `managed`), `profile.libraryAccessState` (e.g. `confirmed`, `unconfirmed`, `denied`), and `profile.conflictReason` (e.g. `username_match`). All four now route through formatting functions; the complex ternary CSS class expression was also replaced with `formatPlexProfileClassificationClass(classification)`.

**Extractions and tests added to `settings-users-presentation.js`:**

- `formatUserRole(role)` — 7 tests (admin/operator/requester/unknown/null/empty)
- `formatAuthProvider(provider)` — 6 tests (local/plex/null/unknown/no-internal-term guard)
- `buildUsersEmptyStateBody()` — 3 tests (non-empty, no-jargon guard, mentions Plex)
- `formatPlexLinkStatusDetail(plexStatus)` — 6 tests (null/unlinked returns null, title+email, title-only, Linked fallback)
- `plexLibraryAccessPolicyLabel(policy)` — 4 tests (eligible/review_required/null/unknown)
- `plexLibraryAccessPolicyTone(policy)` — 4 tests (eligible/review_required/null/unknown)
- `describePlexLibraryAccessPolicy(policy)` — 8 tests (all reasonCodes, server count singular/plural, null)
- `describePlexLocalAuthStatus(user)` — 7 tests (blocked/ready, timestamp, must-change notice)
- `hasPendingManagedLibraryRootChanges(user)` — 6 tests (equal/changed/empty/null coercion)
- `formatPlexProfileClassification(classification)` — 7 tests (all values, null, no-raw-enum guards)
- `formatPlexProfileClassificationClass(classification)` — 4 tests (all values, unknown fallback)
- `formatPlexHomeRole(homeRole)` — 7 tests (admin/managed/home/friend/null/unknown, no-raw-enum guards)
- `formatPlexLibraryAccessState(state)` — 6 tests (confirmed/unconfirmed/denied/null/unknown, no-denied guard)
- `formatPlexConflictReason(reason)` — 7 tests (null/undefined/known codes/underscore replacement, no-raw-enum guard)

Test suite after this session: **1572 tests, 0 failures** (up from 1490).

---

### 2026-05-12 - Settings — Media & Storage Screen

**Screen:** `SettingsMediaStorageView.vue`
**Lib:** `src/client/lib/settings-media-storage-presentation.js` (new file)
**Tests:** `test/client/settings-media-storage-presentation.test.js` (new file)

**Issues identified and resolved:**

1. **`coverArtArchive` raw internal provider ID in hint text** — The hint beneath "Sources to try" read *"Try these sources in order, separated by commas. `coverArtArchive` is the main free source."* The identifier `coverArtArchive` is the internal provider registry key, not a recognisable product name. Updated to: *"Try sources in order, separated by commas. `coverArtArchive` is the default and the main free option (Cover Art Archive)."* — the registry key is retained as a typed value reference but now named in plain language.

2. **"slskd" exposed in the Downloads folder hint** — *"Where slskd puts completed downloads. Harmoniarr reads from here."* used the internal service name. Replaced with `buildDownloadsPathHint()` → *"Where your download client puts completed downloads. Harmoniarr reads from here."*

3. **"slskd" exposed in Path translations section** — The description read *"slskd and Harmoniarr may run in separate containers with different folder names pointing to the same place on disk."* This is both container-centric (wrong framing for bare-metal or single-container installs) and exposes the internal service name. Replaced with `buildPathTranslationsDescription()` → *"If your download client and Harmoniarr use different paths for the same folder, add a translation here."*

4. **"slskd" exposed in Path translations empty state** — *"Not needed if slskd and Harmoniarr share the same folder paths."* Replaced with `buildPathTranslationsEmptyState()` → *"Not needed if your download client and Harmoniarr share the same folder paths."*

5. **"slskd sees this path" field label exposed internal service name** — The field label inside each mapping card read *"slskd sees this path"*. Replaced with `buildDownloadMappingSourceLabel()` → *"Download client path"*.

6. **`pathValidation.notes?.remoteSlskdValidation` rendered raw backend message** — The path validation card displayed the raw note *"No explicit slskd download mappings are configured yet; preview resolution still falls back to the downloads root assumption."* containing `slskd`, `preview resolution`, and `downloads root assumption` — all internal terminology. Routed through `formatPathValidationNote(note)` which normalises the known pattern to: *"No path translations are configured. Harmoniarr will use the downloads folder path directly."* Also returns `null` for empty/null inputs; the card body is now conditionally rendered with a `v-if` guard so it is hidden when there is no meaningful note to show.

7. **Three pure functions inline in `<script setup>` with no tests** — `statusTone(status)`, `statusLabel(status)`, and `formatCommaSeparatedList(value)` were all defined locally in the component with no tests. All three moved to `settings-media-storage-presentation.js` as `formatPathStatusTone`, `formatPathStatusLabel`, and `formatCommaSeparatedList`.

8. **Template index arithmetic `mapping.index + 1` / `userMusicRoot.index + 1`** — 0-based index arithmetic was performed inline in the template for path validation cards. Moved to `formatMappingLabel(index)` and `formatUserRootLabel(index)`. The user root label also changed from "root" to "folder" (`Per-user root 1` → `Per-user folder 1`) to use vocabulary that matches admin expectations.

**Extractions and tests added to `settings-media-storage-presentation.js`:**

- `formatPathStatusTone(status)` — 6 tests (healthy/unavailable/unknown/null/undefined, non-danger guard)
- `formatPathStatusLabel(status)` — 6 tests (healthy/unavailable/unknown/null/undefined, no-raw-enum guard)
- `formatCommaSeparatedList(value)` — 7 tests (join, single, empty, null, undefined, non-array, numeric)
- `formatMappingLabel(index)` — 5 tests (1-based, prefix, regression guard for 0-based)
- `formatUserRootLabel(index)` — 5 tests (1-based, uses "folder" not "root", regression guard)
- `formatPathValidationNote(note)` — 8 tests (null/undefined/empty, known pattern normalisation, slskd replacement, pass-through, case-insensitive)
- `buildDownloadsPathHint()` — 4 tests (non-empty, no-slskd guard, download client, mentions Harmoniarr)
- `buildPathTranslationsDescription()` — 4 tests (non-empty, no-slskd guard, no-container guard, download client)
- `buildPathTranslationsEmptyState()` — 3 tests (non-empty, no-slskd guard, download client)
- `buildDownloadMappingSourceLabel()` — 3 tests (non-empty, no-slskd guard, plain language)

Test suite after this session: **1623 tests, 0 failures** (up from 1572).

---

### 2026-05-12 - Background Jobs Screen (OperationsView)

**Screen:** `OperationsView.vue` (556 lines before changes)
**Lib:** `src/client/lib/operation-run-presentation.js` (extended — 10 new exports)
**Tests:** `test/client/operation-run-presentation.test.js` (extended — 57 new tests)

**Issues identified and resolved:**

1. **Nine pure functions inline in `<script setup>` with no tests** — `formatTimestamp`, `formatTimestampShort`, `runStatusTone`, `groupTone`, `leaseStateLabel`, `leaseStateTone`, `summaryEntries`, `formatSummaryLabel`, and `formatSummaryValue` were all defined locally in the component. The timestamp and relative-time functions in particular had non-trivial branching logic (4-branch `formatTimestampShort`, NaN-guard `formatTimestamp`) that was completely untested. All nine removed from the view and added as new exports to the existing `operation-run-presentation.js`.

2. **`event.eventType` rendered raw in the run timeline** — The timeline showed each audit event with `event.summary` (human-readable) and `event.eventType` (raw snake_case identifier, e.g. `run_started`, `step_completed`, `run_claimed`) as a grey secondary label. The raw identifiers are internal event names that add noise for an admin. Replaced with `formatOperationEventTypeLabel(eventType)` which maps known identifiers to plain labels and title-cases unknowns. Hidden with `v-if` when the label is empty.

3. **`"Queue claimed"` and `"Claimed by instance"` were distributed-queue jargon** — Inside the collapsed Technical details section, these two labels used internal queue implementation terminology. An admin who expands the detail sees `"Queue claimed"` (the moment a worker dequeued the job) and `"Claimed by instance"` (which worker process took it). Renamed to `"Processing started"` and `"Worker instance"`.

4. **`"Lease state"`, `"Lease owner"`, `"Lease expiry"`, `"Last heartbeat"` were distributed-lock terminology** — Four rows inside Technical details used a `"Lease"` concept (distributed lock pattern) that means nothing to a self-hosting admin. Renamed to `"Lock state"`, `"Lock held by"`, `"Lock expiry"`, and `"Last check-in"`.

**New exports added to `operation-run-presentation.js`:**

- `formatOperationTimestamp(value)` — 5 tests (null/undefined/empty→"Not yet recorded", valid ISO→locale string, unparseable pass-through)
- `formatOperationTimestampShort(value, { nowFn })` — 7 tests (null/undefined→"—", <60s→"Just now", <1h→"Xm ago", >24h→locale date, boundary guard, unparseable pass-through)
- `formatOperationRunStatusTone(status)` — 6 tests (failed/cancelled/running, completed→null, null→null)
- `formatOperationGroupTone(groupId)` — 5 tests (needs-attention/in-progress, completed→null, null→null)
- `formatLeaseStateLabel(state)` — 5 tests (active/expired/released, null/unknown→"Unknown")
- `formatLeaseStateTone(state)` — 4 tests (active→success, expired→danger, released→null, null→null)
- `buildOperationSummaryEntries(summary)` — 5 tests (null, filter, key/value, cap at 12, empty)
- `formatOperationSummaryLabel(key)` — 4 tests (camelCase, snake_case, single word, PascalCase)
- `formatOperationSummaryValue(value)` — 7 tests (array/singular/boolean/object/number/string)
- `formatOperationEventTypeLabel(eventType)` — 9 tests (null/undefined, known mappings, no-underscore guard, title-case fallback)

Test suite after this session: **1680 tests, 0 failures** (up from 1623).

---

### 2026-05-12 - Downloads Screen (ActivityDownloadsView)

**Screen:** `ActivityDownloadsView.vue` (218 lines before changes)
**Lib:** `src/client/lib/activity-downloads-presentation.js` (new file — 8 exports)
**Tests:** `test/client/activity-downloads-presentation.test.js` (new file — 83 tests)

**Issues identified and resolved:**

1. **"Live slskd transfer state." subtitle named the backend daemon** — The page subtitle read "Live slskd transfer state." which exposes the underlying slskd daemon name to a self-hosting admin who only knows Harmoniarr. Changed to "Live Soulseek transfer activity."

2. **`lastRefreshedAt` rendered as a raw ISO 8601 string** — The subtitle included `refreshed 2026-05-12T12:01:43.291Z` because `lastRefreshedAt` is the raw ISO string from `useAsyncResource`. Replaced with `formatOperationTimestampShort(lastRefreshedAt)` to produce the same relative format used by the Operations screen ("Just now", "3m ago", etc).

3. **Transfer state labels were raw PascalCase slskd enum names** — The table State column showed `InProgress`, `Negotiating`, `Initializing`, `TimedOut` verbatim. `Negotiating` and `Initializing` are internal protocol phases with no meaning to a user; `InProgress` reads like code; `TimedOut` has no word boundary. Added `formatTransferStateLabel()` mapping: `InProgress→Downloading`, `Initializing→Starting`, `Negotiating→Connecting`, `TimedOut→Timed out`. Compound states like `Completed, Succeeded` and `Completed, Errored` are also resolved.

4. **"Peer" column used Soulseek-protocol terminology** — Soulseek calls remote users "peers" internally. For a self-hoster this reads as jargon. Renamed to "User".

5. **"Queue" column header was ambiguous** — Could mean "is this queued?", "queue depth", or "position in queue". The actual value is the file's position in the remote peer's upload queue (i.e. how many files ahead of yours). Renamed to "Position".

6. **Empty state copy used "import execution" jargon** — "Files enqueued through Search or import execution will appear here." used internal terminology. Changed to "Files downloaded via Search or library import will appear here."

7. **Nine pure functions were inline in `<script setup>` with no tests** — `isActiveState`, `isCompletedState`, `isFailedState`, `stateTone`, `shortState`, `progress`, `formatBytes`, `formatSpeed`, and `basename` were all defined locally. The state classifier trio used regex matching against Soulseek enum names — untested logic that would silently break on any slskd state name change. `formatBytes` and `formatSpeed` were also fourth and fifth copies of the same function already exported from `search-presentation.js`. All nine removed; `formatBytes`/`formatSpeed` now imported from `search-presentation.js`.

8. **`calculateTransferProgress` was called twice per table row** — The template evaluated `progress(file) !== null` and then `progress(file)` again for the display value. Replaced with `allFilesWithProgress` computed that augments each file with a pre-calculated `progress` field, eliminating the double evaluation.

**New exports in `activity-downloads-presentation.js`:**

- `isActiveTransferState(state)` — 10 tests (all 4 active states, negative cases, case-insensitive)
- `isCompletedTransferState(state)` — 9 tests (clean completion, all failed-completion compound states, negative cases)
- `isFailedTransferState(state)` — 10 tests (all 5 failure states, negative cases, case-insensitive)
- `formatTransferStateLabel(state)` — 21 tests (all 10 known states, 4 compound states, fallback, no-raw-enum guard, no-underscore guard)
- `formatTransferStateTone(state)` — 12 tests (all state categories, priority ordering, null)
- `calculateTransferProgress(file)` — 11 tests (null/missing/zero size, negative transferred, 50%, 100%, cap, rounding, Infinity guard)
- `formatTransferFilename(path)` — 8 tests (null/undefined, Unix path, Windows path, no-dir, mixed separators, separator-only, deep Soulseek path)
- `formatDownloadActivitySummary(counts)` — 3 tests (zero counts, mixed counts, separator character)

Test suite after this session: **1763 tests, 0 failures** (up from 1680).

---

### 2026-05-12 - History Screen (ActivityHistoryView)

**Screen:** `ActivityHistoryView.vue` (120 lines before changes)
**Lib:** `src/client/lib/activity-history-presentation.js` (new file — 4 exports)
**Tests:** `test/client/activity-history-presentation.test.js` (new file — 55 tests)

**Issues identified and resolved:**

1. **`entry.entryType` rendered with raw `.replace(/_/g, ' ')` in the template** — Produced all-lowercase labels like `library scan completed` and `metadata refresh queued`. Template string manipulation belongs in a lib. Added `formatActivityEntryTypeLabel(entryType)` with a known-type lookup table (21 entries covering all expected Harmoniarr activity types) plus a Title Case fallback for anything unknown.

2. **`entry.status` rendered raw** — The pill displayed the raw backend enum: `success`, `failed`, `in_progress` (with underscore), `ok` (a system-level token). Added `formatActivityEntryStatusLabel(status)` mapping `success/completed/ok → "Succeeded"`, `failed/error → "Failed"`, `in_progress → "In progress"`, etc. The underscore in `in_progress` would otherwise appear literally in the UI.

3. **`entry.occurredAt` was a raw ISO 8601 timestamp** — `2026-05-12T09:41:22.000Z` shown verbatim in the table. Now uses `formatOperationTimestamp(entry.occurredAt)` from the existing operation-run-presentation lib to produce a consistent locale-formatted datetime.

4. **Subtitle used a ternary for pluralisation** — `{{ entryCount }} entr{{ entryCount === 1 ? 'y' : 'ies' }}` embedded branching logic in the template. Replaced with `formatActivityEntryCountLabel(entryCount)` which returns `"1 entry"` or `"N entries"`. Subtitle also simplified from "Recent system activity events" to "Recent system activity" (the word "events" is redundant given the context).

5. **`statusTone()` was an inline function with no tests** — 4-branch function covering 7 status strings; `"ok" → 'success'` and `"in_progress" → 'warning'` had no regression guard. Extracted as `formatActivityEntryStatusTone(status)` with full test coverage.

**New exports in `activity-history-presentation.js`:**

- `formatActivityEntryTypeLabel(entryType)` — 19 tests (null/undefined/empty, 13 known types, no-underscore guard, title-cased fallback, single-word fallback)
- `formatActivityEntryStatusLabel(status)` — 16 tests (null/undefined/empty, all 8 known statuses, no-raw-ok guard, no-underscore guard, title-cased fallback)
- `formatActivityEntryStatusTone(status)` — 14 tests (all 3 success aliases, all 3 danger aliases, all 3 warning aliases, null→info, unknown→info, empty→info, no-cross-tone guards)
- `formatActivityEntryCountLabel(count)` — 6 tests (singular at 1, plural at 0/2/100, count-in-label, no singular for plural)

Test suite after this session: **1818 tests, 0 failures** (up from 1763).

---

### 2026-05-12 - Queue Screen (ActivityQueueView)

**Screen:** `ActivityQueueView.vue` (unchanged line count — only script-block changes)
**Lib extended:** `src/client/lib/operation-run-presentation.js` (3 new exports appended)
**Tests extended:** `test/client/operation-run-presentation.test.js` (34 new tests)

**Issues identified and resolved:**

1. **`run.operationType` rendered raw** — The Operation column displayed internal job identifiers like `library_scan`, `metadata_refresh`, `import_reconciliation` (snake_case, no capitalisation). Replaced with `getOperationRunDescriptor(run.operationType).title`, reusing the existing lookup table from `operation-run-link-targets.js` that the Operations view already uses. Produces labels like `"Library scan"`, `"Metadata refresh"`, with a Title Case fallback for any unrecognised type.

2. **`run.status` rendered raw in the pill** — The pill displayed backend state machine identifiers verbatim: `in_progress` (with underscore), `claimed` (worker-claimed jargon), `queued`, `succeeded`. Added `formatQueueRunStatusLabel(status)` which maps the extended status vocabulary used by the operation history endpoint: `in_progress → "In progress"`, `claimed → "In progress"` (hides worker jargon), `queued/pending → "Queued"`, `succeeded → "Succeeded"`, with a Title Case fallback. Removed the inline `statusTone()` function, replaced with `formatQueueRunStatusTone(status)`.

3. **`run.startedAt` was a raw ISO 8601 timestamp** — `2026-05-12T09:41:22.000Z` shown verbatim in the Started column. Now uses `formatOperationTimestampShort(run.startedAt)` for a consistent relative / locale-formatted display.

4. **`checkedAt` was a raw ISO string in the subtitle** — `checked 2026-05-12T09:41:22.000Z` shown verbatim. Now uses `formatOperationTimestampShort(checkedAt)`.

5. **`formatDuration()` was an inline function with no tests** — Non-trivial branching (3 early-exit guards, integer math, two output formats). Extracted as `formatElapsedDuration(startIso, endIso, { nowFn })` in `operation-run-presentation.js` with injectable `nowFn` for deterministic testing. Handles hours (`2h 3m`), minutes+seconds (`2m 15s`), sub-minute (`45s`), `0s` for clock-skew, and `'—'` for missing/unparseable timestamps.

6. **Empty state copy exposed internal job type names** — "Operation runs (scans, reconciliation, import workers) will appear here once dispatched." used backend terminology. Changed to "Scheduled tasks such as library scans and metadata refreshes will appear here once started."

7. **"Attempt" column header was ambiguous** — Shows `1/3` values (attempt number / max attempts). Header `"Attempt"` reads as a label for the current attempt rather than the count. Renamed to `"Attempts"`.

**New exports in `operation-run-presentation.js`:**

- `formatQueueRunStatusLabel(status)` — 12 tests (succeeded, completed, failed, cancelled, pending→Queued, queued→Queued, in_progress→In progress, claimed→In progress, title-case fallback, null/undefined→dash, no-underscore guard)
- `formatQueueRunStatusTone(status)` — 10 tests (all tone mappings, unknown→undefined, null→undefined)
- `formatElapsedDuration(startIso, endIso, { nowFn })` — 12 tests (null/undefined/unparseable start, zero, 45s, 2m 15s, negative clock skew→0s, nowFn for null end, nowFn for omitted end, 2h 3m, 59s boundary, 1m 0s boundary)

Test suite: **1852 tests, 0 failures** (up from 1818).

---

### 2026-05-12 - Users Screen (ActivityUsersView)

**Screen:** `ActivityUsersView.vue`
**Lib extended:** `src/client/lib/settings-users-presentation.js` (2 new exports appended)
**Tests extended:** `test/client/settings-users-presentation.test.js` (13 new tests)

**Issues identified and resolved:**

1. **`user.role` rendered raw in the pill** — The Role column showed the lowercase backend enum verbatim: `admin`, `owner`, `requester`. `formatUserRole(role)` and a role-tone function already existed in `settings-users-presentation.js` (used by SettingsUsersView) but were not imported here. Added `formatUserRoleTone(role)` to the lib and imported both into the view. Pills now read `"Admin"`, `"Requester"` etc.

2. **`user.authProvider ?? 'local'` exposed backend internal token** — The Auth provider column fell back to the raw string `'local'` for password-based accounts. `formatAuthProvider(provider)` already exists in `settings-users-presentation.js` and maps `local → 'password'`, `plex → 'Plex'`. Now used in place of the inline fallback.

3. **`user.lastLoginAt` and `user.createdAt` were raw ISO 8601 timestamps** — `2026-05-12T09:41:22.000Z` shown verbatim in the Last login and Created columns. Now uses `formatOperationTimestamp()` from `operation-run-presentation.js` (same function used by Operations, History, Downloads, and Queue views), guarded with a `? ... : '—'` so null values still render the em dash.

4. **`roleTone()` was an inline function with no tests** — 3-branch function covering 4 role strings. Extracted as `formatUserRoleTone(role)` in `settings-users-presentation.js` with full test coverage. The `owner` role mapping (`'warning'`) was previously present only in this one file with no test; it now has regression coverage.

5. **Subtitle used an inline ternary for pluralisation** — `{{ userCount }} application user{{ userCount === 1 ? '' : 's' }}` embedded branching in the template. Added `formatUserCountLabel(count)` to the lib returning `"1 user"` / `"N users"`. Subtitle simplified from `"N application users."` to `"N users."` — "application" was redundant context.

**New exports in `settings-users-presentation.js`:**

- `formatUserRoleTone(role)` — 7 tests (admin→warning, owner→warning, requester→info, operator→undefined, null→undefined, unknown→undefined, admin/owner same tone)
- `formatUserCountLabel(count)` — 6 tests (singular at 1, plural at 0/2/100, count in label, no singular for 0)

Test suite: **1865 tests, 0 failures** (up from 1852).

---

### 2026-05-12 - Imports Screen (ActivityImportsView)

**Screen:** `ActivityImportsView.vue`
**Lib extended:** `src/client/lib/import-candidate-presentation.js` (3 new exports appended)
**Tests extended:** `test/client/import-candidate-presentation.test.js` (24 new tests)

**Issues identified and resolved:**

1. **`candidate.status` rendered raw with no tone** — The Status pill displayed raw backend state machine identifiers: `import_pending` (with underscore), `downloading`, `applied`, `held`, `rejected`. `candidateStatusLabel(status)` already existed in `import-candidate-presentation.js` but was not imported. Added `candidateStatusTone(status)` as a new export and wired both into the view. Pills now read `"Import pending"`, `"Downloading"`, `"Applied"` etc. with appropriate tones (`applied → 'success'`, `failed/rejected → 'danger'`, `downloading → 'warning'`, `held/import_pending/selected → 'info'`).

2. **`candidate.sourceProvider` rendered raw** — The Source column showed internal backend provider tokens: `slskd` (the slskd daemon identifier) and `musicbrainz`. Neither is a user-facing term. Added `formatSourceProvider(provider)` with `slskd → 'Soulseek'`, `musicbrainz → 'MusicBrainz'`, title-case fallback for unknowns, and `'—'` for null/empty.

3. **`formatBytes` duplicated inline** — The view had its own `formatBytes` implementation (identical behaviour to `search-presentation.js::formatBytes`, same `'—'` fallback for `<= 0`). Removed the inline copy; now imports from `search-presentation.js`, consistent with `ActivityDownloadsView`.

4. **Timestamp chain rendered raw ISO string** — `candidate.importPendingAt ?? candidate.updatedAt ?? candidate.createdAt` produced a raw ISO 8601 string. Wrapped with `formatOperationTimestamp()` from `operation-run-presentation.js`, guarded with a ternary so nullish chain still renders `'—'`.

5. **Subtitle inline pluralisation ternary** — `{{ candidateCount }} candidate{{ candidateCount === 1 ? '' : 's' }}` embedded branching in the template. Added `formatCandidateCountLabel(count)` to the lib, returning `"1 candidate"` / `"N candidates"`.

**New exports in `import-candidate-presentation.js`:**

- `candidateStatusTone(status)` — 10 tests (all 5 known tones, unknown→undefined, null→undefined, applied/rejected tone-exclusion guard)
- `formatSourceProvider(provider)` — 8 tests (slskd→Soulseek, musicbrainz→MusicBrainz, no-raw-token guards, null/undefined/empty→dash, title-case fallback)
- `formatCandidateCountLabel(count)` — 6 tests (singular at 1, plural at 0/2/100, count in label, no singular for 0)

Test suite: **1889 tests, 0 failures** (up from 1865).

---

### 2026-05-12 - Settings — Connections Screen

**Screen:** `SettingsConnectionsView.vue` (476 lines before changes)
**Lib:** `src/client/lib/settings-connections-presentation.js` (new file)
**Tests:** `test/client/settings-connections-presentation.test.js` (new file)

**Issues identified and resolved:**

1. **`slskdApiKeyStatusLabel()` — inline closure with no tests** — The function read directly from the `secretStatus` ref to produce `'No API key configured'` / `'Stored in Harmoniarr'` / `'Environment-provided key'`. Extracted to `formatSlskdApiKeyStatusLabel(slskdStatus)` in the new lib, accepting the `secretStatus?.slskd` object. Template call site updated to pass the status slice directly.

2. **`providerSecretStatusLabel(provider, secretKey, sourceKey)` — inline closure with no tests** — Used at three call sites (Spotify client secret, YouTube API key, Apple Music private key) to return the same 3-value label. Extracted to `formatProviderSecretStatusLabel(providerStatus, secretKey, sourceKey)`, accepting the provider status object instead of the provider name string so the function has no dependency on `secretStatus`. All three template call sites updated.

3. **`spotifyOAuthStatusLabel()` / `youtubeOAuthStatusLabel()` — duplicate inline closures with no tests** — Both functions had identical logic: `'Not linked'` / `'Linked until <date>'` / `'Linked'`. Merged into a single `formatOAuthStatusLabel(oauthStatus)` export. Both template call sites updated.

4. **`formatCommaSeparatedList` duplicated inline** — The function was already extracted to `settings-media-storage-presentation.js` during the SettingsMediaStorageView session. The identical copy in this view was removed and replaced with an import from the existing lib.

5. **Internal jargon in Soulseek connection card subtitle** — `"How Harmoniarr talks to slskd, the Soulseek search daemon. You configured this during setup."` exposed both `slskd` (internal service name) and `"daemon"` (infrastructure vocabulary). Replaced via `buildSlskdConnectionSubtitle()` → `'Configure the address and API key for the Soulseek download service.'`

**New lib: `src/client/lib/settings-connections-presentation.js`** (4 exports, 28 tests):

- `buildSlskdConnectionSubtitle()` — 4 tests (no-slskd, no-daemon, non-empty, stable)
- `formatSlskdApiKeyStatusLabel(slskdStatus)` — 8 tests (null/undefined, not-configured, stored, environment, non-stored-source, no-slskd-in-output)
- `formatProviderSecretStatusLabel(providerStatus, secretKey, sourceKey)` — 8 tests (null/undefined, not-configured, stored, environment, all three key-name patterns, absent secretKey)
- `formatOAuthStatusLabel(oauthStatus)` — 8 tests (null/undefined, not-linked, no-expiry, expiry-present, bare-ISO-not-returned, year-present-in-output)

Test suite: **1935 tests, 0 failures** (up from 1907).

---

### 2026-05-12 - Settings — General Screen

**Screen:** `SettingsGeneralView.vue` (262 lines before changes)

**Issues identified and resolved:**

1. **`formatCommaSeparatedList` — third inline duplicate removed** — The function was defined inline for the third time (identical body to the copies in `SettingsConnectionsView.vue` and `SettingsGeneralView.vue`). The canonical version was already extracted to `settings-media-storage-presentation.js` during the SettingsMediaStorageView session (7 existing tests). The inline definition (3 lines) was deleted and an import added. The two `applySettings` call sites at `derivativeSizesText` and `providerOrderText` are unchanged.

No new lib exports or tests were added — `formatCommaSeparatedList` is already fully tested in `test/client/settings-media-storage-presentation.test.js`. The template renders only security checkboxes and system log-level/base-URL fields; all option labels (`Disabled`, `Required`, `debug`, `info`, `warn`, `error`) are appropriate for an admin audience and required no changes.

Test suite: **1935 tests, 0 failures** (unchanged — no new exports).

---

### 2026-05-12 - Request Music Screen

**Screen:** `RequestMusicView.vue` (294 lines before changes)

**Issues identified and resolved:**

1. **`request.sourceProvider` raw in request history list** — The provider line rendered `Source provider: spotify` / `youtube` / `apple_music` verbatim. `formatSourceProvider()` already existed in `import-candidate-presentation.js` but lacked explicit cases for `spotify`, `youtube`, and `apple_music`. The default fallback capitalised only the first character, giving `Youtube` (wrong) and `Apple music` (wrong). Added three explicit `switch` cases: `'spotify' → 'Spotify'`, `'youtube' → 'YouTube'`, `'apple_music' → 'Apple Music'`. Template call site updated to `formatSourceProvider(request.sourceProvider)`.

2. **`request.requestedByUser.role` and `request.requestedForUser.role` raw in admin attribution lines** — Two `<p>` elements showed `(admin)`, `(requester)` etc. as raw backend enum strings. `formatUserRole()` already existed in `settings-users-presentation.js`. Imported it into the view and replaced both raw role interpolations with `formatUserRole(...)` calls.

3. **`getRequestTargetLabel` used raw role in the admin "Request for" dropdown** — The lib function returned `alice (admin, you)` / `bob (requester)`. Updated `request-music-form.js` to import `formatUserRole` from `settings-users-presentation.js` and wrap the role in both branches, now returning `alice (Admin, you)` / `bob (Requester)`.

**Files changed:**
- `src/client/lib/import-candidate-presentation.js` — 3 new `switch` cases in `formatSourceProvider`
- `src/client/lib/request-music-form.js` — import `formatUserRole`; use in `getRequestTargetLabel`
- `src/client/views/RequestMusicView.vue` — import `formatSourceProvider`, `formatUserRole`; fix 3 template call sites
- `test/client/import-candidate-presentation.test.js` — 5 new tests (`spotify`, `youtube`, `apple_music` returns; `youtube`/`apple_music` do not expose raw tokens)
- `test/client/request-music-form.test.js` — updated 2 `getRequestTargetLabel` assertions to expect `Admin`/`Requester`

Test suite: **1940 tests, 0 failures** (up from 1935).

---

### 2026-05-12 - My Requests Screen

**Screen:** `MyRequestsView.vue` (190 lines before changes)

**Issues identified and resolved:**

1. **Inline sort comparator extracted to `sortMyRequests`** — The `displayRequests` computed contained a 20-line sort body with three field branches, each using fallback chains (`releaseGroupTitle ?? title`, `artistSortName ?? artistName`, `requestedAt ?? createdAt`) and bi-directional comparison. Extracted to `src/client/lib/my-requests-presentation.js` as `sortMyRequests(requests, { field, order })`. The computed now delegates to the lib and reads cleanly.

No raw enum display issues were found — the sort/filter option labels (`'Date requested'`, `'Pending'`, etc.) are already user-facing strings. `RequestCard` handles its own display rendering.

**Files changed:**
- `src/client/lib/my-requests-presentation.js` — NEW FILE, `sortMyRequests` export
- `test/client/my-requests-presentation.test.js` — NEW FILE, 13 tests
- `src/client/views/MyRequestsView.vue` — import `sortMyRequests`; replace inline sort body

**Test coverage for `sortMyRequests`:** empty input, no-mutation, `requested_at` desc (default), `requested_at` asc, `createdAt` fallback, `title` asc (releaseGroupTitle), `title` asc (title fallback), `title` desc, `artist` asc (artistSortName), `artist` asc (artistName fallback), `artist` desc, case-insensitive title sort, case-insensitive artist sort, equal-value order preservation.

Test suite: **1954 tests, 0 failures** (up from 1940).

### 2026-05-12 - Activity Wanted Screen

**Screen:** `ActivityWantedView.vue` (129 lines before changes)

**Issues identified and resolved:**

1. **Raw `wantedStatus` enum in status pill** — The pill rendered `missing` / `partial` with an ad-hoc inline ternary for tone. Replaced with `getWantedStatusLabel(release.wantedStatus)` and `getWantedStatusTone(release.wantedStatus)` from `src/client/lib/wanted-release-normalization.js`. Now renders `Missing` / `Partial` with `danger` / `warning` tones through the shared normalizer.

2. **Raw ISO timestamp for last-reconciled date** — `lastReconciledAt` was rendered with a bare `?? 'never'` fallback, exposing the raw ISO 8601 string to users. Replaced with `formatLastReconciledAt(wanted.libraryWantedSummary.value?.lastReconciledAt)` from the same lib. Now renders `never` for null and a locale-formatted string for valid dates.

3. **Inline pluralisation ternary for release count** — `{{ releases.totalCount.value }} release{{ releases.totalCount.value === 1 ? '' : 's' }} pending acquisition` replaced with `{{ buildWantedReleasesCardSubtitle(releases.totalCount.value) }}`. Also returns `null` for zero/null counts (no subtitle rendered), `'1 release pending acquisition'`, or `'N releases pending acquisition'`.

4. **Jargon card title "Reconciliation"** → changed to `"Acquisition status"`.

5. **Jargon card subtitle "Last reconciled"** → changed to `"Last updated"`.

No new lib exports or tests were needed — all four functions already existed and were already covered by `test/client/wanted-release-normalization.test.js`.

**Files changed:**
- `src/client/views/ActivityWantedView.vue` — add imports for 4 lib functions; fix raw values in template

Test suite: **1959 tests, 0 failures** (5 new tests added for `formatActivityEventTime` in same commit — see ActivityFeedView entry below).

### 2026-05-12 - Activity Feed Screen

**Screen:** `ActivityFeedView.vue` (156 lines before changes)

**Issues identified and resolved:**

1. **Inline `formatOccurredAt` function in `<script setup>`** — The view defined its own date-formatter using `toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })`. Extracted to `formatActivityEventTime(value)` in `src/client/lib/activity-event-normalization.js`. The view now imports and calls the shared function. Both template call sites (`event.occurredAt` in the `<time>` element and `checkedAt` in the "Last checked" paragraph) updated to `formatActivityEventTime(...)`.

**Files changed:**
- `src/client/lib/activity-event-normalization.js` — add `formatActivityEventTime` export
- `test/client/activity-event-normalization.test.js` — append 5 tests for `formatActivityEventTime`
- `src/client/views/ActivityFeedView.vue` — remove inline function; import and use `formatActivityEventTime`

**Test coverage for `formatActivityEventTime`:** null returns `''`, undefined returns `''`, empty string returns `''`, non-date string returns `''`, valid ISO timestamp returns non-empty locale string.

Test suite: **1959 tests, 0 failures** (up from 1954).

### 2026-05-12 - Activity Releases Screen

**Screen:** `ActivityReleasesView.vue` (197 lines before changes)

**Issues identified and resolved:**

1. **Two inline pluralisation ternaries in card subtitles** — Both the Recent and Upcoming sections embedded identical `length === 0 ? 'No X detected' : \`${length} release${length === 1 ? '' : 's'}...\`` patterns directly in the template. Extracted to two pure functions in `src/client/lib/release-radar-normalization.js`:
   - `buildRecentReleasesCardSubtitle(count)` → `'No new releases detected'` | `'1 release from monitored artists'` | `'N releases from monitored artists'`
   - `buildUpcomingReleasesCardSubtitle(count)` → `'No upcoming releases detected'` | `'1 upcoming release from monitored artists'` | `'N upcoming releases from monitored artists'`

Both subtitles now read as single clean `{{ helper(count) }}` expressions. The empty-state text and `<EmptyState>` component bodies are separate concerns and were not changed.

**Files changed:**
- `src/client/lib/release-radar-normalization.js` — add `buildRecentReleasesCardSubtitle` and `buildUpcomingReleasesCardSubtitle`
- `test/client/release-radar-normalization.test.js` — append 10 tests (zero/null/singular/plural/large-count for each function)
- `src/client/views/ActivityReleasesView.vue` — import both helpers; replace two inline ternaries

**Test coverage:** zero returns no-releases message, null returns no-releases message, 1 returns singular, 2 returns plural, large count returns plural — for each of the two helpers.

Test suite: **1969 tests, 0 failures** (up from 1959).

### 2026-05-12 - Bootstrap Setup Screen

**Screen:** `BootstrapSetupView.vue` (118 lines before changes)

**Issues identified and resolved:**

1. **Two repeated conditional ternaries with no tests** — The `AuthEntryShell` `:title` prop and the inner form `<h2>` heading both branched on `ownerClaimSummary?.required` with inline string literals. The same conditional appeared twice, with no coverage for either branch. Extracted to two pure functions added to the existing `src/client/lib/auth-entry-support.js`:
   - `getBootstrapTitle(ownerClaimSummary)` — returns `'Claim the configured owner account'` when `required`, otherwise `'Create the first admin account'`
   - `getBootstrapHeading(ownerClaimSummary)` — returns `'Claim owner account'` / `'Create admin account'` (the shorter in-card heading)

   Both functions handle `null` and `undefined` gracefully (default to the free-create branch). The view template now calls the lib functions directly — no intermediate computed properties needed.

**Why `auth-entry-support.js` and not a new file:** The lib already owns all other auth-entry display concerns (support-item definitions, route targets) and is already imported by this view. Adding the bootstrap display helpers here avoids a one-function file and keeps all first-run/auth-flow presentation in one tested module.

**Files changed:**
- `src/client/lib/auth-entry-support.js` — add `getBootstrapTitle` and `getBootstrapHeading` exports
- `test/client/auth-entry-support.test.js` — update import; append 10 tests covering required/not-required branches, null/undefined fallback, no-internal-term guard, and heading-shorter-than-title invariant
- `src/client/views/BootstrapSetupView.vue` — update import; replace two inline ternaries with lib calls

Test suite: **1979 tests, 0 failures** (up from 1969).

### 2026-05-12 - DependencyStatusPanel Component

**Component:** `DependencyStatusPanel.vue` (operator/admin provider health panel)

**Issues identified and resolved:**

1. **Three inline presentation functions with no tests** — The component defined all display logic directly in `<script setup>`:
   - `formatProvider(provider)` — maps `'musicbrainz'` → `'MusicBrainz'`; passes `'slskd'` and unknown values through unchanged (technical names are appropriate in this admin-facing health panel)
   - `formatStatus(status)` — reads from a local `statusLabels` lookup (`degraded` / `healthy` / `misconfigured` / `unavailable`); passes through unrecognised values
   - `formatDetailKey(key)` — converts camelCase detail keys (e.g. `responseTimeMs`) to space-separated title case (e.g. `Response Time Ms`) by inserting spaces before uppercase letters, then capitalising the first character

   All three extracted to a new `src/client/lib/dependency-status-presentation.js` as `formatDependencyProvider`, `formatDependencyStatus`, and `formatDependencyDetailKey`. The component now imports these; the local `statusLabels` constant and all three inline function bodies are gone.

2. **Duplicate `formatActivityTime` removed from `RequesterHomePanel`** — The component had an identical copy of the function extracted in a prior pass as `formatActivityEventTime` in `activity-event-normalization.js`. Replaced the inline definition and the single template call site with the shared lib function. No new tests needed (coverage already exists).

**Files changed:**
- `src/client/lib/dependency-status-presentation.js` — new file; exports `formatDependencyProvider`, `formatDependencyStatus`, `formatDependencyDetailKey`
- `test/client/dependency-status-presentation.test.js` — new file; 16 tests covering all three functions (known values, passthrough, edge cases, empty string)
- `src/client/components/DependencyStatusPanel.vue` — import the three lib functions; remove inline definitions and local `statusLabels`; update three template call sites
- `src/client/components/dashboard/RequesterHomePanel.vue` — import `formatActivityEventTime`; remove inline `formatActivityTime`; update the single template call site

Test suite: **1995 tests, 0 failures** (up from 1979).

### 2026-05-12 - ImportCandidateApplyPanel Component

**Component:** `ImportCandidateApplyPanel.vue` (apply-run detail panel — moves staged downloads into the library)

**Issues identified and resolved:**

1. **Nine inline presentation functions with no tests** — The component `<script setup>` contained a full set of status/class/label/describe helpers that belonged in the existing `import-candidate-presentation.js` lib:

   | Old inline function | New lib export | Purpose |
   |---|---|---|
   | `statusClass(status)` | `getRunStatusClass` | CSS class for apply-run status pill |
   | `itemStatusClass(status)` | `getApplyItemStatusClass` | CSS class for per-item status pill |
   | `itemStatusLabel(status)` | `getApplyItemStatusLabel` | Display label for per-item status |
   | `operationStatusClass(status)` | `getApplyOperationStatusClass` | CSS class for file-operation status |
   | `operationStatusLabel(status)` | `getApplyOperationStatusLabel` | Display label for file-operation status |
   | `operationStepLabel(stepType)` | `getApplyOperationStepLabel` | Step type label (Stage / Finalize) |
   | `formatMutationMode(mode)` | `formatApplyMutationMode` | Filesystem mutation mode label |
   | `formatFallbackReason(reason)` | `formatApplyFallbackReason` | Human-readable fallback reason |
   | `describeOperation(op)` | `describeApplyOperation` | Full operation description (error / fallback / normal) |

   Two helper functions were also extracted:
   - `itemOperationHistory(item)` → `getApplyItemOperationHistory` — resolves the correct operation list (live vs snapshot)
   - `canStartRun(currentRun, count)` → `canStartApplyRun` — apply-run start eligibility predicate

   All eleven functions were appended to `src/client/lib/import-candidate-presentation.js`. The component now imports them; all inline definitions and the call sites in the template were updated to use the prefixed names.

2. **`describeApplyOperation` documents complex fallback behavior** — The description builder handles three distinct cases (explicit error, filesystem mode fallback, normal step summary) and composes them from the three lower-level helpers. Tests cover each branch plus the null-safe path.

**Files changed:**
- `src/client/lib/import-candidate-presentation.js` — append 11 new exports (`getRunStatusClass`, `getApplyItemStatusClass`, `getApplyItemStatusLabel`, `getApplyOperationStatusClass`, `getApplyOperationStatusLabel`, `getApplyOperationStepLabel`, `formatApplyMutationMode`, `formatApplyFallbackReason`, `describeApplyOperation`, `getApplyItemOperationHistory`, `canStartApplyRun`)
- `test/client/import-candidate-presentation.test.js` — update import list; append 51 tests covering all new functions with known values, defaults, edge cases, null safety, and the full `describeApplyOperation` composition
- `src/client/components/ImportCandidateApplyPanel.vue` — update import; remove all inline function and constant definitions; update all template call sites to use lib names

Test suite: **2046 tests, 0 failures** (up from 1995).

### 2026-05-12 - RequestCard Component

**Component:** `src/client/components/media/RequestCard.vue` (artwork-first request tracking card shown in My Requests and the Requester dashboard)

**Issues identified and resolved:**

1. **Inline `formatDate` with no tests** — The component defined a private function to format ISO date strings into locale short dates (`year: 'numeric', month: 'short', day: 'numeric'`). The same pattern was already partially established for event timestamps; this one produces a date-only display (no time). Extracted as `formatRequestDate(isoString)` in `my-requests-presentation.js`. Returns `null` for missing or unparseable input (consistent with how the component used it — `null` suppresses rendering in the template).

2. **Inline `kindLabel` computed with no tests** — Three-branch `requestKind` enum mapping (`external_url`, `track`, `release`) was embedded directly. Extracted as `getRequestKindLabel(requestKind)` — returns `null` for absent or unknown values, which suppresses the kind pill in the template.

3. **Inline `attributionLine` computed with no tests** — Multi-case delegation attribution logic (viewer = beneficiary / viewer = submitter / operator view / no-delegation guard). This is the most semantically rich logic in the component and was entirely untested. Extracted as `getRequestAttributionLine(request, viewerUserId)`, preserving all four cases:
   - `null` when `viewerUserId` absent (backward-compatible suppression)
   - `null` when by/for are missing or identical (not a delegation)
   - `"Requested by <submitter>"` when viewer is the beneficiary
   - `"For <beneficiary>"` when viewer is the submitter
   - `"By <submitter> · For <beneficiary>"` for operator/third-party view

**Files changed:**
- `src/client/lib/my-requests-presentation.js` — append `formatRequestDate`, `getRequestKindLabel`, `getRequestAttributionLine`
- `test/client/my-requests-presentation.test.js` — update import list; append 21 tests covering all three new functions (null/undefined/invalid inputs, all enum values, all attribution branches, fallback username)
- `src/client/components/media/RequestCard.vue` — import three new lib functions; remove `formatDate` inline function definition; replace `kindLabel`, `requestedDate`/`updatedDate`, and `attributionLine` computed bodies with lib calls

Test suite: **2067 tests, 0 failures** (up from 2046).

### 2026-05-12 - ReleaseDetailModal, MetadataReleaseDetail, ImportCandidateDetailPanel Components

**Components affected:**
- `src/client/components/media/ReleaseDetailModal.vue` (679 lines — largest component, user-facing release detail modal)
- `src/client/components/MetadataReleaseDetail.vue` (developer/diagnostic release detail view)
- `src/client/components/ImportCandidateDetailPanel.vue` (import candidate file metadata display)

**New shared lib:** `src/client/lib/track-duration.js`

**Issues identified and resolved:**

1. **Inline `formatDuration(ms)` in `ReleaseDetailModal`** — Formatted track durations as `m:ss`. No tests. Extracted as `formatTrackDuration(ms)` returning `null` for invalid input (callers use `?? ''` fallback). Template updated to `formatTrackDuration(track.lengthMs) ?? ''`.

2. **Inline `totalRuntime` computed in `ReleaseDetailModal`** — 13-line block that iterated media/tracks to sum `lengthMs`, then formatted the result as `h:mm:ss` or `m:ss`. No tests. Extracted as two separate functions: `computeMediaTotalMs(mediaArray)` (pure aggregation, testable with any array) and `formatAlbumRuntime(totalMs)` (formatting, returns `null` for ≤0). Computed now reads: `formatAlbumRuntime(computeMediaTotalMs(media.value))`.

3. **Inline `formatTrackLength(lengthMs)` in `MetadataReleaseDetail`** — Same m:ss conversion but used `Math.floor` instead of `Math.round` and returned `'Unknown length'` for invalid values. No tests. Replaced with `formatTrackDuration(track.lengthMs) ?? 'Unknown length'` — canonical rounding and null-return contract, fallback label at call site.

4. **`formatDuration` called but never defined in `ImportCandidateDetailPanel`** — A runtime bug: `formatDuration(file.lengthSeconds)` referenced a function that was neither defined in the component script nor imported. This would throw a Vue template error whenever the file list section rendered. Fixed by importing and calling `formatFileDuration(seconds)` from the new lib (takes seconds, not ms — matches the `file.lengthSeconds` data field). Fallback: `?? 'Unknown'`.

**New lib exports in `track-duration.js`:**
- `formatTrackDuration(ms)` — ms → `m:ss` or `null`; uses `Math.round`
- `formatFileDuration(seconds)` — seconds → `m:ss` or `null`; for file metadata
- `computeMediaTotalMs(mediaArray)` — sums `track.lengthMs` across `media[].tracks[]`
- `formatAlbumRuntime(totalMs)` — ms → `h:mm:ss` or `m:ss` or `null` for ≤0

**Files changed:**
- `src/client/lib/track-duration.js` — new file with 4 exports
- `test/client/track-duration.test.js` — new file, 41 tests covering all branches (null/undefined/zero/negative, rounding, padding, hour boundary, multi-medium aggregation)
- `src/client/components/media/ReleaseDetailModal.vue` — import lib; replace `totalRuntime` computed; remove `formatDuration` function; update call site
- `src/client/components/MetadataReleaseDetail.vue` — import lib; remove `formatTrackLength`; update call site
- `src/client/components/ImportCandidateDetailPanel.vue` — import `formatFileDuration`; fix undefined `formatDuration` call site

Test suite: **2108 tests, 0 failures** (up from 2067).