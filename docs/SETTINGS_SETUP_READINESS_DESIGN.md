# Settings Setup Readiness Design

## Status

Implemented on 2026-07-28.

## Problem

The Settings landing page showed connection, media folders, and library
behavior as three equally prominent sequential tasks. This made the initial
setup view busier than necessary and obscured the two prerequisites that
actually gate downloads: a usable Soulseek provider and media folders that
Harmoniarr can use.

The page also needed to stay safe: a lightweight setup summary must not expose
saved connection URLs, API-key status, filesystem paths, or detailed
validation output.

## Research

Sources were checked on 2026-07-28 against the requested June 2026 baseline.

| Source | Applied guidance |
| --- | --- |
| [W3C WAI-ARIA Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) | Keep optional setup behind a semantic disclosure trigger with an explicit expanded state and labelled region. |
| [W3C WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Announce setup-readiness changes with a polite status message instead of relying on the visible badge alone. |
| [W3C WCAG 2.2 Labels or Instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html) | Use concise, task-specific labels such as `Set folders` and `Finish managed setup` that identify the next action. |
| [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) | Do not replicate credentials or unnecessary sensitive configuration into a summary read model. Keep secrets write-only and minimise their exposure. |
| [NIST SP 800-218 SSDF](https://csrc.nist.gov/pubs/sp/800/218/final) | Preserve security controls while changing presentation architecture, and verify the change with repeatable tests. |

## Options

### Keep all setup tasks expanded

Pros: every routine option is immediately visible.

Cons: it gives optional scheduling and automation the same visual priority as
download prerequisites and increases scanning cost on every Settings visit.

### Replace Settings with a forced wizard

Pros: a strict first-install sequence.

Cons: it is disruptive for existing operators, poorly fits independent
maintenance tasks, and makes direct routes harder to use.

### Compact core readiness with optional setup disclosed

Pros: foregrounds the two true download prerequisites, preserves direct
settings routes, keeps follow-up tuning available without visual pressure, and
works for both a new installation and an established library.

Cons: an operator must choose to open the optional area to change discovery
scheduling or automatic-download behavior.

## Final Recommendation Stack

1. Show only the Soulseek provider and media-folder readiness as required
   setup tasks.
2. Show a short aggregate posture: `Ready for downloads` only when both core
   tasks are healthy; otherwise state how many required tasks remain.
3. Keep library schedule and safe automatic-download preferences behind a
   named `Optional setup` disclosure, not a separate card or forced sequence.
4. Route each repair action to its existing focused Settings area. Do not add
   mutations, configuration fields, or test actions to the summary.
5. Reduce the Settings payload before presentation to provider mode/deployment
   state, folder-presence booleans, and the allowlisted aggregate validation
   status. Never expose raw paths, endpoint URLs, API keys, or unrelated secret
   metadata.
6. Keep server-side path validation, CSRF-protected writes, secret storage, and
   connection testing unchanged.

## Implementation

`src/client/lib/settings-setup-progress.js` now reduces the Settings response
to:

- Soulseek provider mode and managed-deployment-missing state.
- Whether completed-download and music-library folders are configured.
- One allowlisted folder-validation state: `healthy`, `degraded`, or
  `unavailable`.

`src/client/lib/settings-setup-presentation.js` projects that state into a
compact core checklist and a separate optional-library task. It treats a
failed setup-state read differently from a missing folder so the operator is
sent to review saved folder settings rather than incorrectly told to create a
new configuration.

`SettingsSetupView.vue` uses the existing `SettingsDisclosure` component for
the optional area and retains an atomic status region for screen readers.

## Verification

- Unit coverage proves the reducer omits URLs, secrets, and raw paths.
- Presentation tests cover healthy, incomplete, and unreadable setup states.
- Source-contract and Playwright coverage prove the two core tasks remain
  visible while library behavior is initially disclosed.
- Lint, build, the full test suite, and a no-cache local walkthrough rebuild
  are run before release.

## Outcome

Settings now leads with the prerequisites that make automated music progress
possible. Optional tuning remains available without competing with connection
or folder repair, and the summary cannot become a new secret or path exposure
surface.

## Next High-Value Item

Apply the same task-first hierarchy to Activity: make the recent lifecycle
timeline the default operational view, group low-value routine events, and
surface only actionable failures or explicit repair links before advanced
diagnostics.
