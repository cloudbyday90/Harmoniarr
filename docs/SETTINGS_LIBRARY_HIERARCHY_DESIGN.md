# Settings Library Hierarchy

## Status

Implemented on 2026-07-28.

## Problem

Settings > Library correctly kept discovery scheduling visible, but its five
specialist settings sections appeared as equal-weight cards. A home operator
had to scan source safety, retention, match scoring, audio thresholds, and file
naming before knowing which controls were routine. The layout also lacked a
single boundary that communicated which controls are safe to leave unchanged.

## Research

Sources were checked on 2026-07-28 against the requested June 2026 baseline.

| Source | Applied guidance |
| --- | --- |
| [W3C WCAG 2.2 Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Keep the visual and DOM order aligned: routine automation first, then the advanced trigger, then specialist controls immediately after that trigger. |
| [W3C ARIA Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) | Use real buttons with `aria-expanded` and `aria-controls`; nested sections remain keyboard-operable disclosures. |
| [W3C WCAG 2.2 Labels or Instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html) | Keep the existing labels and concise range/default guidance, but do not force all specialist instructions into the default view. |
| [W3C WCAG 2.2 Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html) | Preserve explicit validation and save feedback for values that can affect search, retention, and quality behavior. |

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| Keep five advanced cards visible | Direct access to every setting | Makes rare tuning appear equally important as everyday automation. |
| Hide every advanced setting without section labels | Very compact | Makes a future diagnostic task difficult and removes useful context. |
| One advanced boundary with named inline sections | Keeps routine scheduling dominant while retaining direct, accessible specialist entry points | Adds one intentional expand action before uncommon work. |

## Final Recommendation Stack

1. Keep **Discovery scheduling** and automatic high-confidence download behavior visible.
2. Place Source safety, History retention, How matches are ranked, Audio verification thresholds, and File naming inside **Advanced library controls**.
3. Retain each advanced area as a named inline disclosure, so an operator can open only the domain being changed.
4. Use `h3` headings for nested disclosures beneath the `h2` advanced boundary to preserve a meaningful document outline.
5. Preserve existing server validation, numeric ranges, CSRF-protected saves, and import safety checks; this is information architecture, not a policy relaxation.

## Implementation

- Added `headingLevel` support to the shared ESM `SettingsDisclosure` component.
- Consolidated five top-level specialist cards under one `Advanced library controls` disclosure.
- Kept the existing field labels, reset actions, default/range help, and save behavior unchanged.
- Updated browser proof to open the parent advanced boundary before Match ranking, which verifies the real keyboard and screen-reader path.

## Security And Safety

- No backend, provider secret, or path-resolution behavior changed.
- Existing settings validation remains the authority for numeric policy values.
- Advanced tuning is still available to authorized settings users; it is not hidden by role or client-only state.
- The automation toggle continues to describe its boundary: only unambiguous, high-confidence selections can start automatically.

## Verification

- Focused presentation and source-contract tests verify the primary-to-advanced hierarchy and semantic heading support.
- Browser coverage verifies expanding Advanced library controls, then Match ranking, before accessing Format tier.
- Full validation and a no-cache walkthrough rebuild are required before release.

## Next Item

Review **Settings > System & security** with the same standard: keep service-critical recovery and security status readable first, and move uncommon operational limits or account maintenance behind named disclosures.
