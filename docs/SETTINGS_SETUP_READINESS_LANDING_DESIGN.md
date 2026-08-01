# Settings Setup Readiness Landing Design

## Scope

This slice makes the default `Settings > Setup` route the clear first-run and
recovery entry point for automatic music handling. It intentionally covers only
the small set of prerequisites that block normal download and library work:

1. A usable Soulseek provider.
2. Usable completed-download and music-library folders.

Library preferences remain optional. Provider details, folder paths, secrets,
and diagnostics remain on their dedicated Settings pages.

## Problem

The existing Setup route safely summarized readiness, but every prerequisite
looked like a separate button. It did not establish which task mattered next,
and it offered no way to refresh the read-only status after correcting an
external deployment problem. That made a small recovery workflow feel like a
configuration dashboard.

## Research

Official guidance was requested for June 2026. The sources below were located
and reviewed on 2026-08-01; they are the current official guidance available
at implementation time.

- [GOV.UK task list](https://design-system.service.gov.uk/components/task-list/)
  recommends short task names, a small set of readable statuses, and making the
  full task row the link rather than making a status look interactive.
- [GOV.UK complete multiple tasks](https://design-system.service.gov.uk/patterns/complete-multiple-tasks/)
  recommends starting with the smallest useful status set and visually
  de-emphasizing completed tasks so outstanding work is easier to scan.
- [USWDS alerts](https://designsystem.digital.gov/components/alert/) recommends
  concise, contextual messages that state the next step without overwhelming a
  user with unrelated notifications.
- [W3C status-message guidance](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html)
  requires dynamic progress and result messages to be programmatically
  determinable; advisory updates should not interrupt the user.
- [W3C region labels](https://www.w3.org/WAI/tutorials/page-structure/labels/)
  supports named regions and descriptive headings for efficient navigation.

## Options

### Keep the button-per-task summary

Pros:

- No component or data-contract change.
- Each task already has a direct destination.

Cons:

- Repeats equal visual weight for completed and incomplete work.
- Makes the status badge and action button compete within every row.
- Does not identify the first recovery action.

### Replace Settings with a mandatory wizard

Pros:

- Establishes a fixed sequence.
- Can conceal specialist choices.

Cons:

- Conflicts with independent home-server setup tasks and external deployment
  work that users complete outside Harmoniarr.
- Adds state, backtracking, and recovery complexity without changing the
  underlying configuration routes.

### Action-led readiness landing, selected

Pros:

- Elevates only the first incomplete prerequisite as **Your next step**.
- Keeps all required tasks visible and independently reachable through
  scan-friendly, whole-row links.
- Uses a small, readable status vocabulary and contains optional tuning behind
  an Optional disclosure.
- Adds a non-destructive **Check status** action for recovery after external
  changes.

Cons:

- Returning users see a small amount of duplicate wording between the next-step
  callout and the task row.
- The page intentionally cannot repair external provider or filesystem problems
  itself; it only links to the relevant normal Settings page.

## Decision

Use an action-led readiness landing with this presentation contract:

1. Show one readiness summary and a compact **Check status** button.
2. When a core prerequisite is not ready, show exactly one elevated
   **Your next step** action linked to that task's normal Settings route.
3. Render required tasks as whole-row links. A status is informative text, not
   a button; the row states its target action with a quiet destination label.
4. When both core tasks are ready, omit the next-step callout and make the
   completion state the lead message.
5. Keep library behavior under an Optional compact disclosure.
6. Announce only changing check/refresh results through a polite status region.

## Architecture

- `settings-setup-presentation.js` remains the pure, non-sensitive view-model
  boundary. It adds `nextStep` derived from the first incomplete core task.
- `SettingsSetupTaskList.vue` owns semantic whole-row navigation and static
  task status presentation. It accepts plain step view models and has no API or
  configuration-write behavior.
- `SettingsSetupNextAction.vue` owns the elevated recovery callout. It receives
  only an already-redacted step and uses a normal router link.
- `SettingsSetupView.vue` owns parallel read-only refreshes, a concise live
  status message, and composition of the two small presentational components.

## Security Boundaries

- Reuse the existing setup-progress reducer, which intentionally excludes
  connection addresses, API keys, raw paths, and unrelated secret metadata.
- Reuse the scoped Soulseek status request. Do not call broad dependency health
  endpoints from Setup, and do not contact disabled providers.
- `Check status` has no mutation, reconciliation, download, or import effect.
- Do not render transport/provider exception text. Existing safe provider-state
  copy remains the only error presentation.
- Use named router routes rather than interpolated external URLs.

## Validation

- Pure client tests prove first incomplete task selection, ready completion,
  and that the model remains non-sensitive.
- Source contracts prove semantic named task lists, whole-row router links,
  compact Optional disclosure, and the refresh contract.
- Docker-backed browser verification proves initial failure recovery, direct
  routing, status refresh, optional disclosure, responsive no-overflow, and no
  page errors.

## Outcome

The Setup route becomes an unobtrusive checklist for the two things Harmoniarr
needs before it can handle music automatically. It does not become another
diagnostics dashboard or replace the normal Settings pages where configuration
actually happens.

## Implementation Outcome

Completed:

- Added a pure `nextStep` to the safe setup presentation model. It selects the
  first incomplete core prerequisite and never promotes optional library
  preferences to a blocker.
- Added small ESM `SettingsSetupNextAction` and `SettingsSetupTaskList`
  components. Required and optional task rows are semantic router links with
  descriptive, non-interactive statuses.
- Updated Setup to show one `Your next step` action only while required setup
  remains, a clear completion message once both prerequisites are ready, and a
  read-only `Check status` refresh.
- Preserved the existing redaction boundary and added browser proof that raw
  configured folder paths never appear on the Setup route.

Verification completed:

- Focused client lint and presentation contracts passed.
- `npm run validate` passed, including copyright, schema, ESM, lint, test, and
  production-build gates.
- The Docker-backed Settings browser scenario passed for blocked-folder
  recovery, direct routing, readiness refresh, optional preferences, mobile
  no-overflow, and no client-side page errors.

## Next Step

After this landing pass, verify **setup recovery handoffs** from Music Queue,
Downloader, and other blocked surfaces: each should name the missing
prerequisite, link directly to the relevant normal Settings page, and preserve
the user's original operational context after repair.
