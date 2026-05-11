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

Status: the page has too many sections with unclear priority and no obvious reading path.

Initial feedback:

- The page presents multiple stacked panels, but it is not obvious what should be looked at first.
- The information architecture feels flat: hero, profile summary, notifications, request form, and request history all compete for attention.
- The page makes the operator parse the screen instead of guiding them through a primary request-submission workflow.
- The current labels are descriptive, but they do not establish a clear order of operations.
- It is not immediately clear which sections are actionable, which are just status, and which are secondary context.

What feels confusing:

- `Request profile` reads like a dashboard summary, but it sits above the actual request form and may distract from the primary action.
- `Delegated fulfillment updates` appears before the user has even submitted anything, which adds noise in an empty-state experience.
- The request history list is useful, but its placement after several summary sections makes the whole screen feel long and fragmented.
- The page reads more like a bundle of related cards than one coherent request workflow.

Design direction to revisit:

- Reframe the screen around the main job to be done: submit a request quickly and understand what happens next.
- Demote secondary summaries and notifications when the state is empty or low-signal.
- Make the primary section obvious on first glance, with supporting context progressively disclosed below it.
- Revisit empty-state handling so the screen feels purposeful even before any requests exist.

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

Status: not intuitive; the screen does not explain the job to be done or when someone should use each search mode.

Initial feedback:

- It is not obvious what the user is supposed to do here on first view.
- The page is framed as a `MusicBrainz artist flow`, which sounds like an internal implementation concept rather than a user-facing task.
- The two entry points, `Provider-first selection` and `Reopen imported metadata`, do not clearly explain when the operator should choose one versus the other.
- The page assumes the user already understands the distinction between provider metadata and local canonical metadata.

What feels unclear:

- Is this page for adding artists, editing metadata, monitoring artists, browsing imported metadata, or troubleshooting metadata state?
- What does `provider-first` mean in practical terms for the operator?
- Why would I use `Search MusicBrainz` instead of `Search local metadata`, and what happens after either choice?
- The screen does not yet establish the primary workflow in plain language.

Design direction to revisit:

- Reframe the page around operator goals such as `Add or import an artist` and `Open existing metadata`.
- Replace implementation-centric language like `provider-first selection` with user-facing intent.
- Add short decision guidance near the top so the operator knows which starting path matches their task.
- Treat metadata as a workspace with clear entry modes, not as a backend flow surface.

### 2026-05-04 - Recovery Page

Status: too much control-plane noise for a home-lab product, with terminology that is not self-explanatory.

Initial feedback:

- A lot of this page reads like enterprise/internal platform language instead of something designed for a home-lab operator.
- `Recovery control plane`, `restore readiness`, `maintenance locks`, and `privileged recovery activity` all feel too heavy for the context.
- The page is noisy because it combines backups, restore checks, queue diagnostics, failure history, and lock management at the same time.
- The terminology does not explain itself well enough for a user who just wants to back up data or avoid breaking the app during maintenance.

Specific confusion:

- `Active maintenance lock` is not intuitive phrasing for a home-lab app.
- It is not obvious whether a maintenance lock is a pause switch, a safety mode, a restore guard, or just an internal coordination flag.
- The page currently assumes the user already understands why they would manually enter a lock before doing maintenance.

What the page appears to be trying to do:

- Create and inspect backups.
- Preview whether a restore is safe to apply.
- Prevent conflicting operations during manual maintenance or restore work.
- Show recent failures and recovery-relevant diagnostics.

Design direction to revisit:

- Reframe the page in simpler home-lab language, centered on backup, restore, and safe maintenance.
- Rename or better explain `maintenance lock` in plain language, such as a temporary safety hold or operation pause mode.
- Reduce the number of simultaneous concepts visible on first load.
- Prioritize the common tasks first and move diagnostics/history deeper into the page or behind progressive disclosure.

### 2026-05-04 - Review Queue / Import Review Page

Status: the page name does not explain the task; the current terminology assumes the operator already understands the import pipeline.

Initial feedback:

- `Review Queue` is not self-explanatory as a navigation label.
- It is not clear whether this page is for downloads waiting to start, items waiting for approval, failed imports, or something else.
- The page uses internal terms like `persisted slskd candidates`, `execution readiness`, and `durable run state` without first explaining the human workflow.

What the page appears to be trying to do:

- Show discovered download candidates pulled from slskd searches.
- Let an operator inspect those candidates and decide whether to hold, select, reject, or reopen them.
- Move selected candidates into the next stages of download and import execution.

Design direction to revisit:

- Rename this area in a more task-oriented way, such as candidate review, download candidates, or import candidates.
- Explain in plain language that this is where found matches are reviewed before download/import proceeds.
- Reduce implementation-centric language until the user drills into deeper execution details.

### 2026-05-04 - Settings Page

Status: too many unrelated options on one long page, with weak grouping and no durable in-page navigation.

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