# Plex owner-link design

October 27, 2026. Implements the next boundary from [Plex HTTP](PLEX_HTTP_OUTCOME.md).
See [research and tradeoffs](PLEX_OWNER_LINK_RESEARCH_2026_10.md) and
[implementation outcome](PLEX_OWNER_LINK_OUTCOME.md).

## Ownership

`plex-owner-link-service.js` orchestrates settings, bounded provider calls and
normalized profile data. Policy, pending-state read, SQL store and transactional
commands are separate ESM modules. Existing provider routes retain fresh-admin
and CSRF checks for start/clear. The anonymous callback requires its dedicated
browser verifier; it never derives administrator authority from URL parameters.

Start captures the initiating account, exact refresh-token ID, family ID and
one-way token hash. The encrypted v1 pending envelope contains those primitives,
PIN/client identifiers, browser-binding hash, link revision, purpose and ten-minute
DB-clock expiry. Raw session tokens and browser verifiers are never persisted
in pending state. Legacy unbound envelopes refuse and require a new start.

Secure cookie: `__Host-harmoniarr_plex_link_binding`; local HTTP cookie:
`harmoniarr_plex_link_binding`. Both are HttpOnly, host-only, Path=/, SameSite=Lax
and ten minutes. Reuse an established browser verifier across tabs, refresh its
cookie lifetime only after a successful start, and keep sign-in binding separate.
Start/callback responses use no-store and no-referrer. The start response exposes
only provider, authorization URL and expiry.

## Transaction order and publication

Each command uses the existing bounded session transaction owner: maintenance
write guard, account eligibility write lock, session-family advisory lock, exact
refresh-token row lock, installation link advisory lock, then secret records.
Separate post-wait statements check current administrator role, enabled state,
password-change requirement, credential epoch, revocation, replacement and expiry.
The parent must still be unexpired at the final boundary. Provider calls run
between owned transactions, with no database checkout held.

Preparation initializes a persistent encrypted client identifier and link revision.
Pending creation rechecks authority/revision and commits pending state with its
required start audit. Completion rechecks authority/revision, deletes exactly the
accepted state ID/name/ciphertext/full timestamp revision while unexpired, replaces
the encrypted token, advances revision and records a required success audit in
one transaction. Final DB-clock state and parent expiry checks precede commit.
Rollback restores state/token/revision/audit together. No post-commit cleanup or
automatic retry follows uncertain COMMIT acknowledgement.

Clear rechecks current authority, confirms token deletion, advances revision even
when already unlinked and commits its required audit together. A successful clear
or relink invalidates all older pending installation flows, including another tab
or administrator. The first successful completion wins over other pending flows.

Secret writes are bounded to 8 KiB UTF-8 plaintext, reread with at most two rows
and a 16 KiB ciphertext cap, and must decrypt to exactly the intended value.
Suppressed writes/deletes or ambiguous duplicates refuse publication. Default
state/token/status reads use bounded auth-read ownership; borrowed queryables
remain available internally. Profile identity and optional metadata are bounded.
New audit details contain only provider and start expiry, with the existing
application actor reference; historical events are not rewritten.

## Lifecycle and compatibility

The existing maintenance worker now scans both canonical Plex sign-in and owner
pending namespaces within the same total 100-record batch/cursor. Version-one
expiry, conservative 24-hour legacy grace, unknown/unreadable preservation,
required aggregate audit and drainage remain shared. Permanent client/token/
revision names do not match. Callback expiry is authoritative without cleanup.

No schema, dependency, UI, session-cookie policy or deployed service changes are
needed. Session rotation/logout/password change/revocation while away requires a
new linking attempt. This conservative behavior preserves the exact initiating
authorization. Rollback by reverting code preserves established token/client data;
in-flight v1 owner states should be abandoned rather than downgraded to old rules.
