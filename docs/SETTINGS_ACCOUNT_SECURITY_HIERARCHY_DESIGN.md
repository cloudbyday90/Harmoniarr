# Settings Account Security Hierarchy

**Status:** Implemented on 2026-07-28

## Problem

`Settings > Account` placed password changes, every signed-in device, audit
history, appearance, request defaults, and notifications in a single expanded
scan. These are not equally frequent or equally urgent. The current account
and any action that blocks normal use should be clear first; detailed controls
should remain available without making the normal page feel like a security
workbench.

This is an information-architecture change. The server remains the authority
for password validation, session validity, CSRF checks, rate limits, session
revocation, and audit records.

## Research

Official sources were checked on 2026-07-28 against the requested June 2026
baseline.

| Source | Applied guidance |
| --- | --- |
| [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) | Treat password changes and session termination as high-risk events; keep reauthentication and server-side invalidation authoritative. |
| [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html) | Session termination and authenticator events require clear user-facing handling; session state remains an authenticated-service concern, not a browser inference. |
| [W3C ARIA Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) | Use semantic buttons with `aria-expanded`, `aria-controls`, and labelled regions for optional task detail. |

## Options

### Keep all cards expanded

Pros: no extra interaction before a control is available.

Cons: it gives routine personal preferences the same visual weight as password
and session controls, leaving users to infer where to start.

### Hide all security controls behind one advanced boundary

Pros: compact first view.

Cons: a required password update or session-read failure could be too easy to
miss, and one large hidden panel recreates the original scanning problem.

### Current sign-in posture followed by task disclosures

Pros: identifies the signed-in account and required action first; explains
other devices without exposing their metadata by default; preserves clear,
direct access to each task; and keeps preferences separate from access control.

Cons: infrequent work requires one additional click.

## Final Recommendation Stack

1. Lead with a compact **Account safety** summary showing the signed-in person
   and the current server-read session posture.
2. Treat a required password update and unavailable device read as explicit
   warning states. Do not describe the account as safe based only on browser
   state.
3. Keep **Password**, **Signed-in devices**, and **Recent security activity**
   as separate task disclosures. Automatically open the password task only
   when the server requires the change.
4. Keep personal appearance, request-quality defaults, and notifications in a
   separate **Preferences** group so they do not compete with access controls.
5. Preserve the existing password-change flow: current-password verification,
   CSRF protection, server validation, revocation of other active sessions,
   issuance of the replacement session, rate limiting, and durable audit
   events.

## Implementation

- Added `settings-account-security-presentation.js`, an ESM-only pure helper
  that derives bounded, non-authoritative safety copy from the session read.
- `AccountSecurityView.vue` now leads with Account safety, then distinct
  Security tasks and Preferences sections.
- Existing forms, session-revoke controls, audit links, preference persistence,
  and push notification controls retain their original client and server
  contracts inside `SettingsDisclosure` sections.
- A password task starts open only for `mustChangePassword`; other optional
  controls remain mounted when hidden so unfinished form input is retained.

## Verification

- Unit tests cover required-password, loading, session-error, other-device,
  and single-current-device posture states.
- Source-contract coverage asserts the hierarchy and disclosure boundaries.
- Browser verification opens the Account page, reveals password, devices,
  activity, and request-preference tasks, and checks for page errors.
- Full repository, ESM, and Docker walkthrough validation remain required
  before this work is closed.

## Outcome

Account settings now makes the current sign-in situation understandable before
showing detailed session metadata or personal preferences. It improves scan
ability without moving security decisions or secret handling into the browser.

## Next High-Value Item

Apply the same task-first hierarchy to **Settings > Backup & restore**: show
the latest protected backup and recovery readiness first, then place export,
restore preview/apply, and diagnostics behind explicit recovery tasks.
