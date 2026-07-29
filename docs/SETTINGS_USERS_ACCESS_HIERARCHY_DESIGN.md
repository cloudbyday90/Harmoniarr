# Settings Users & Access Hierarchy

## Status

Implemented on 2026-07-28.

## Problem

The Users & access route presented Plex maintenance, account creation, role
reference, list filtering, and every per-user recovery action as peer content.
An operator had to scan a large maintenance workspace before seeing the people
who currently have access. Password resets, claim codes, folder provisioning,
and Plex unlinking were shown beside routine review controls even though each
has a different operational purpose and risk.

## Research

Sources were checked on 2026-07-28 against the requested June 2026 baseline.

| Source | Applied guidance |
| --- | --- |
| [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Keep least privilege and deny-by-default enforcement on the server, validate authorization for every request, and maintain auditability. |
| [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html) | Treat account recovery as a distinct, infrequent security event rather than ordinary account editing. |
| [W3C ARIA Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) | Use semantic, keyboard-operable disclosures for task-specific maintenance detail. |

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| Keep every form and action expanded | Direct access to every capability | High cognitive load; makes recovery and linked-account maintenance look routine. |
| Move all changes to a separate detail route | Very compact list view | Adds navigation for common local administration and duplicates existing edit surfaces. |
| Access overview plus task-specific disclosures | Shows the current account picture first while retaining direct routes and preserving unsaved field state | Operators open a named section for infrequent work. |

## Final Recommendation Stack

1. Lead with **Account access**, derived only from loaded user records and the saved Plex-link state.
2. Keep **Add a user**, search, filters, and user-detail links easy to reach.
3. Keep role, disabled-state, and library-folder changes together in **Manage access** on each user card.
4. Keep temporary-password and claim-code operations in **Sign-in recovery**; present issued claim codes only there.
5. Keep Plex link/unlink and directory reconciliation in **Plex account maintenance**.
6. Keep the role explanation in **About roles** rather than using it as a competing card.
7. Preserve fresh-admin checks, CSRF enforcement, server-side authorization, input validation, and audit events. The browser only summarizes saved/listed state.

## Security Boundaries

- The account summary is descriptive. It does not grant, revoke, or validate access.
- Role updates, disabled-state updates, claim issuance, password resets, provisioning, and Plex actions continue to require a fresh administrator session and CSRF protection on the server.
- An issued claim code is not shown until an operator explicitly opens the recovery task for that user.
- The client never treats a visible user record as proof that an authorization decision is allowed; every server route remains authoritative.

## Verification

- Pure ESM presentation tests cover complete and partial user lists, disabled accounts, and Plex-link states.
- Source and Playwright checks prove the summary leads the page and task-specific controls remain discoverable through disclosures.
- Full tests, build/ESM validation, and a no-cache walkthrough rebuild are required before release.

## Next Item

Review **Settings > Account** with the same model: current personal session and sign-in safety first, then password change, session revocation, and audit detail as clearly separated tasks.
