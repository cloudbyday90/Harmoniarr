- The existing `/bootstrap` first-run screen should surface the shared lightweight path-validation summary so setup issues are visible before the user enters the main authenticated application.
- The authenticated dashboard should surface a contextual onboarding checklist panel after bootstrap so first login lands inside the real app with actionable next steps, not a separate wizard or success page.
- The authenticated dashboard should also surface a passive library-scan status panel so setup can progress from infrastructure readiness into existing-library scan readiness and latest recorded scan state without a modal or hidden secondary flow.
# Harmoniarr Frontend Screen And Navigation Task List

Implementation source: `docs/harmoniarr.md`
Master execution tracker: `docs/IMPLEMENTATION_TASK_LIST.md`
Recovery source: `docs/BACKUP_RESTORE_DESIGN.md`

## Current Status (2026-04-27)

- The plan identifies major frontend ownership slices, but not the screen-by-screen execution order.
- This file tracks the UI shell, screen inventory, navigation, and operator feedback component work for V1.
- The import review queue now keeps filters and selected candidate context in URL state while reusing shared ESM API and composable modules for review actions.
- The import review workspace now also centralizes route, queue, detail, preview, and transition refresh coordination in a shared composable, and the queue visibly reports its last successful refresh time for operator reassurance.
- The import review detail now shows a read-only planning preview for source, staging, and library target paths while keeping the unresolved slskd path-mapping assumption visible to operators.
- The import review screen now also includes a selected-candidate readiness panel backed by a dedicated summary route, so operators can see blocked reasons and next-stage intent without starting downloads.
- The import review screen now also includes a durable execution-planning panel with protected start/read routes, giving operators a visible run state and persisted per-candidate execution items before download behavior exists.
- The import review screen now also shows durable download-enqueue outcomes in that execution panel, including queued, warning, blocked, and enqueue-failed item states instead of a planning-only placeholder.
- That execution panel now also shows live slskd transfer reconciliation per item, including queue position, terminal errors, and coarse percent-complete progress for enqueued files.
- That execution panel now also shows automatic reconciliation heartbeat cadence and last outcome, so operators can verify background transfer-state persistence without relying on the manual reconcile action alone.
- That execution panel now also distinguishes transient missing transfers from orphaned transfers and shows the shared missing-transfer grace window, so operators can see when Harmoniarr is still waiting versus when it will persist a failure.
- The import review execution panel now also exposes an explicit persist-transfer-state action, and the review queue can surface durable `downloading` plus `import_pending` candidate states once live slskd progress is reconciled back into the shared workflow.
- The import review screen now also includes a dedicated import-pending staging panel backed by its own protected summary route, so completed downloads can be inspected as a separate import-ready queue without duplicating preview logic.
- The import review detail surface now also loads a dedicated apply-preview section for `import_pending` candidates, so operators can see missing source files and library collisions before import apply begins.
- That apply-preview section now also exposes per-file skip and clear controls for reviewed collisions, reusing the existing detail panel to surface explicit non-destructive operator decisions before apply runs start.
- The import review screen now also includes a dedicated durable import-apply panel with protected start/read routes, so operators can launch guarded library finalize work and inspect persisted per-candidate file-operation outcomes without leaving the review workflow.
- That import-apply panel now also surfaces durable `import_operations` stage/finalize history from the shared apply summary read model, including `skipped` file outcomes, so operators can inspect ordered filesystem results even after the original run snapshot shape changes.
- The settings screen now includes explicit download path mapping inputs so operators can model slskd and Harmoniarr path namespaces without relying on implicit downloads-root guesses.
- The settings screen now also surfaces validation status for local path roots and example mapping translations so operators can see read and write issues before import apply behavior exists.
- The dashboard now also surfaces the shared path-validation summary so operators can spot configuration drift or missing mappings without leaving the runtime overview.
- The dashboard library-scan panel now also exposes a contextual start/rescan action backed by the dedicated library-scan route, so first-run setup can launch the actual scan without a separate wizard.
- The dashboard now also surfaces a read-only library reconciliation summary panel backed by the dedicated library route, so operators can see current matched, ambiguous, unmatched, complete, partial, and duplicate counts without waiting for later wanted-state work.
- The metadata artist workspace now also surfaces current canonical monitoring state and a monitor/unmonitor toggle backed by the dedicated metadata monitoring route, so operators can establish monitored artist intent before wanted reconciliation exists.
- The dashboard now also surfaces a read-only wanted summary panel backed by the dedicated library wanted route, so operators can see how many monitored releases are fully missing or partially satisfied before search scheduling exists.
- The dashboard now also surfaces a read-only discovery summary panel backed by the dedicated library discovery route, so operators can see which monitored releases are immediately search-eligible versus delayed by cooldown or release-date policy.
- The dashboard discovery panel now also exposes a protected manual dispatch action and latest-run status, so operators can trigger discovery work without rerunning the full library scan.
- The dashboard now also surfaces automatic discovery heartbeat cadence through both the discovery panel and overview status pills, so the background dispatch interval is visible without opening server configuration directly.
- The auth shell now also redirects forced re-authentication failures back to login with a distinct reason, so privileged mutation denials and refresh failures reuse the same fallback path as ordinary session expiry without inventing a separate dead-end screen before password-management flows exist.
- The live transfer table has moved from Activity into a dedicated top-level
  Downloader page with summary counts, filters, accessible progress indicators,
  and a canonical `/app/downloader` route. The old Activity downloads route is
  deprecated and no longer registered.

## Global UI Rules

- [ ] Lock authenticated vs anonymous navigation boundaries.
- [ ] Lock route names, top-level navigation groups, and default landing behavior after login.
- [ ] Lock global error/loading/empty-state conventions.
- [ ] Lock operator feedback patterns for saves, destructive confirms, background-job progress, and maintenance mode.

## Screen Group 1 - Bootstrap And Auth

- [x] Create first-run bootstrap-admin setup screen.
- [x] Create login screen.
- [x] Create session-expiry handling.
- [x] Create forced re-auth and invalid-session fallback flows.
- [ ] Ensure auth UI stays compatible with CSRF and cookie-session behavior.

## Screen Group 2 - App Shell, Dashboard, And Global Navigation

- [x] Create the base app shell with authenticated layout and navigation.
- [x] Create default dashboard/control-plane landing view.
- [ ] Add global status surfaces for health, maintenance mode, and privileged-action feedback.
- [ ] Add account/session management entry points.

## Screen Group 3 - Settings And Secrets Management

- [x] Create settings screens for storage paths and current system-path validation feedback.
- [ ] Extend settings screens for import policy, metadata providers, notifications, and media/transcoding policy.
- [x] Add the initial slskd connectivity settings surface, including encrypted API-key status and safe save/clear UX.
- [x] Add validation and audit-friendly operator feedback for settings changes.

## Screen Group 4 - Import Review And Canonical Metadata

- [x] Create import candidate list, filters, and detail view.
- [x] Create review decision actions with stale-action handling.
- [ ] Add confirm states where a review action should require explicit operator confirmation.
- [x] Create metadata detail panes for canonical IDs, provenance, path mapping preview, and staging context.
- [ ] Ensure review surfaces clearly distinguish preview state from applied library changes.

## Screen Group 5 - Jobs, History, And Notifications

- [x] Create job queue/history screens with status, timings, and failure reasons.
- [x] Create job detail/event views for audit-friendly troubleshooting.
- [x] Promote live downloader operations into a dedicated top-level operator page.
- [ ] Create durable operator-attention or notifications surface if server-backed notifications are accepted.
- [ ] Define toast-only vs durable-history UI boundaries.

## Screen Group 6 - Filesystem And Media Operation UX

- [ ] Create preview screens for rename, organize, import apply, and transcoding candidates.
- [ ] Create warning/confirmation UX for risky media actions.
- [ ] Create result summaries for applied media operations, including partial-failure visibility.

## Screen Group 7 - Backup, Restore, Recovery, And Diagnostics

- [ ] Create backup/export list/detail and create-new UX.
- [ ] Create restore preview/apply UX with explicit maintenance-lock messaging.
- [ ] Create diagnostics views for health, failed jobs, recent privileged actions, and maintenance state.
- [ ] Create admin recovery operator UX only if the security policy accepts an in-app surface; otherwise keep it documented as a controlled operator flow only.

## Frontend Validation Checklist

- [ ] Confirm every major screen has loading, empty, error, and success states.
- [ ] Confirm maintenance mode and permission denials have explicit UX.
- [ ] Confirm destructive actions always show preview or confirmation before apply.
- [ ] Confirm navigation stays usable on supported desktop and mobile widths.
- [ ] Confirm route/state behavior is stable on refresh and expired-session transitions.

## Done Criteria

- [ ] V1 screen inventory is explicitly defined and sequenced.
- [ ] Navigation, auth boundaries, and operator feedback rules are locked before implementation completes.
- [ ] Critical-path UI flows exist for bootstrap, settings, import review, jobs, diagnostics, and recovery-sensitive operations.
