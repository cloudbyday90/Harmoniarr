# Settings Save-State Consistency Design

## Scope

This document defines the shared save experience for the primary Settings
surfaces:

1. Connections
2. Media & storage
3. Library

The goal is a quiet, dependable interaction: a person changes a setting,
saves it, receives one truthful outcome, and sees only the next action that is
useful for that outcome.

## Problem

The three pages independently rendered nearly identical sticky save controls,
but the underlying form state did not distinguish an initial settings-load
failure from a later save failure. A failed save could therefore replace the
editable form with a generic unavailable screen, eliminating the safe retry
path. The pages also used slightly different copy, loading punctuation, and
live-region semantics.

Connections has a second issue: persisting an external Soulseek address or API
key does not prove the service is reachable. Treating save success as provider
health would be misleading.

## Research Baseline

The requested June 2026 guidance was reviewed against the current official
sources on 2026-07-31.

- [WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  supports polite, programmatic notification of save progress and success
  without taking focus away from the form.
- [WCAG 2.2 error identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html)
  requires a textual error and a useful correction path, rather than merely
  showing a failed result.
- The [WAI-ARIA alert pattern](https://www.w3.org/WAI/ARIA/apg/patterns/alert/)
  reserves assertive announcements for important errors; normal saved and
  saving states should remain polite.
- The [OWASP Error Handling Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html)
  recommends generic public failures when detailed errors could reveal
  implementation data. Harmoniarr should retain short, bounded validation
  guidance but suppress URLs, credentials, tokens, stack traces, and other
  sensitive-looking server text.
- [Playwright locator guidance](https://playwright.dev/docs/locators) favors
  role- and name-based assertions. The browser proof should locate the save
  controls and live outcomes semantically rather than through CSS structure.

## Options Considered

### Keep page-local save bars

Pros:

- Lowest immediate code change.
- Each page can choose distinct wording.

Cons:

- The same lifecycle bug is easy to repeat.
- Accessibility and responsive behavior drift.
- Users encounter different labels for the same action.

### Display only transient toasts

Pros:

- Reduces persistent visual surface.
- Easy to add to existing pages.

Cons:

- A toast disappears before a person can act on a failed save.
- It cannot own the retry action or describe unsaved state near the form.
- It is insufficient for a long Settings page whose save control remains at
  the bottom.

### Shared state model and shared save bar

Pros:

- One accessible, testable contract across the three pages.
- Load failure and retryable save failure have separate presentation paths.
- The component stays compact until there is material state to report.
- A post-save verification action can appear only when a saved value is not
  equivalent to a healthy service.

Cons:

- Requires a safe dirty-state baseline and migration of three views.
- A generic component must avoid taking ownership of page-specific recovery.

## Decision

Use a shared, client-only save-state model and `SettingsSaveBar` component.
No API or database contract changes are needed.

### State Contract

| State | User-facing outcome | Primary action | Follow-up |
| --- | --- | --- | --- |
| Initial | No status noise | Save settings | None |
| Unsaved | Unsaved changes | Save changes | None |
| Saving | Saving settings | Disabled saving button | None |
| Save failed | Settings were not saved, with bounded guidance | Try saving again | Keep the form editable |
| Saved | Settings saved | Saved button until another edit | None |
| Saved, test needed | Settings saved, connection unverified | Saved button | Test saved connection |

Initial load failure remains a page-level `Settings unavailable` state. A save
failure never becomes that state. Once a person edits the form after a failed
attempt, the error clears and the footer returns to `Unsaved changes`.

### Security Boundary

- The dirty-state baseline must never retain raw write-only secrets. It records
  only whether each secret field is populated, alongside ordinary settings.
- Save failures use a safe bounded presentation helper. It permits short,
  plain validation text but falls back to a generic retry message when the
  message resembles a URL, credential, token, secret, stack trace, or
  unbounded diagnostic.
- The status model and component never receive provider responses, API keys,
  filesystem paths, or server error objects.
- `Test saved connection` continues to call the existing scoped administrator
  status endpoint and is not treated as a save operation.
- OAuth connection actions use provider-specific retry guidance instead of
  rendering their raw API error text after the form-level load/save split.

### Per-Page Application

- **Connections:** a successful save that changes provider configuration
  creates `Saved, test needed`. The explicit test action clears that pending
  verification state and preserves the existing local provider-status card.
- **Media & storage:** a successful save remains `Saved`. The existing folder
  readiness panel is the authoritative saved path-validation result; this
  footer does not duplicate it or manufacture a second check.
- **Library:** a successful save remains `Saved`. Future scheduled searches
  consume the saved policy without an immediate external-health assertion.

## Implementation Outcome

The implementation adds a pure save-state presentation module, a secret-safe
form fingerprint, a reusable Vue save bar, and focused unit, contract, and
browser coverage. The migration removes the three bespoke `cfg-save-bar`
instances while preserving existing form submission and provider-recovery
behavior.

## Acceptance Criteria

- All three pages render the same accessible save control and outcome language.
- A failed save leaves its form available and exposes a clear retry action.
- An initial load failure still renders `Settings unavailable`.
- A saved external provider asks for an explicit connection test; save success
  alone is not called healthy.
- Dirty tracking does not retain or expose raw secrets.
- Tests cover the pure state model, dirty/reset behavior, view integration, and
  role-based browser interaction.

## Follow-Up

After this consistency pass, the next high-value UX slice is a **Settings
information hierarchy pass**: reduce repeated helper copy, normalize card
headings and disclosure summaries, and establish a clear required-versus-
advanced visual cadence across General, Connections, Library, and Media &
storage.
