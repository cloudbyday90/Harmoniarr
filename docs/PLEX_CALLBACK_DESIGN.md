# Browser-bound single-use Plex callback design

October 27, 2026. The trigger is a callback to an existing pending Plex flow.
Previously its lookup and deletion were independent of successful local login.
Two callbacks could publish independently, and a failed post-login delete could
hide a completed durable login. This design extends the current transaction
boundary without adding a deployed application, dependency or schema migration.
See [research and alternatives](PLEX_CALLBACK_RESEARCH_2026_10.md).

## Module ownership

| Module | Responsibility |
| --- | --- |
| `plex-browser-binding.js` | Cookie name, random verifier, strict cookie parsing and serialization |
| `integrations/plex/plex-callback-policy.js` | Bounded payload/proof validation, binding hash, lifetime and safe continuations |
| `integrations/plex/plex-callback-state-store.js` | Minimal read, database expiry, exact conditional consume and final expiry SQL |
| `integrations/plex/plex-callback-state-service.js` | Bounded encrypted-state creation/read and required start audit; serialized client identifier |
| `integrations/plex/plex-direct-sign-in-service.js` | Provider orchestration outside SQL and delegation of verified identity/state |
| `linked-login-service.js` | Current account/link admission and atomic state/session/audit publication |
| `routes/auth-routes.js` | Internal cookie handoff, explicit public response and existing 303/session-cookie delivery |

All modules use ESM and injectable factories. The encrypted-secret service gains
record decryption so the bounded read can capture the exact bytes/revision once;
ordinary encrypted-secret callers retain their existing interface.

## Start and browser ownership

Start reuses a valid browser binding or creates 32 random bytes. Its cookie is
HttpOnly, host-only, Path=/, SameSite=Lax and Max-Age=600. Secure deployments use
`__Host-harmoniarr_plex_binding` with Secure; explicit local HTTP policy uses
`harmoniarr_plex_binding`. This follows the existing deployment security policy,
including saved settings. Production should configure HTTPS and secure cookies.
Duplicate, malformed or noncanonical cookie values are refused at completion.
The configured callback base URL must use the same application host on which the
browser starts sign-in; changing host or cookie policy during a flow requires a
restart at the canonical origin.

A bounded transaction with a fixed advisory lock initializes the installation's
Plex client identifier once. PIN creation then happens without an SQL checkout.
Another bounded transaction obtains database-clock expiry ten minutes ahead,
saves encrypted version 1 state and inserts the required `plex_sign_in_started`
audit. The payload contains binding hash, client identifier, PIN ID, safe
continuation and expiry. Public metadata contains only version/expiry. The audit
contains provider/expiry, not raw state, verifier, hash, PIN or provider token.
Failure rolls back state and audit; no binding cookie is delivered.

Independent tabs with an established cookie share the binding and retain distinct
pending state IDs. The cookie is not cleared on success/refusal, so one tab does
not invalidate another. Simultaneous first starts before any cookie exists can
race; a displaced flow safely requires restart. Cookie expiry bounds browser
retention; it does not itself delete database records.

## Completion and atomic consumption

The callback requires a valid cookie and canonical state ID before provider work.
A bounded read selects only encrypted bytes, key version, ID, full textual
updated-at revision and database observation time, with a 16 KiB ciphertext cap.
After checkout release, decrypt and validate the version, canonical expiry,
bounded fields and constant-time hash equality. Legacy unbound or malformed
payloads fail closed and require restart. Plaintext is capped at 4096 UTF-8 bytes.

Provider PIN/token/profile checks and candidate lookup remain separate from the
write transaction. Copy the exact state proof before awaiting admission; callers
cannot mutate the retained Buffer or descriptor afterward. Under the existing
account write lock, require the exact current provider/subject link and an enabled
account. Conditional DELETE requires the same secret type/name, ID, ciphertext,
full timestamp revision and unexpired database clock. Only one deleted row admits
publication. An unrelated secret cannot satisfy this proof.

Deletion, successful-login bookkeeping, root refresh family and required success
audit share one bounded transaction/client. Recheck expiry after the required
audit and before commit. Failure, suppression, timeout or expiry rolls everything
back, restoring pending state. No post-commit state deletion remains. Confirmed
completion precedes route cookie delivery. A real commit followed by lost
acknowledgement leaves one consumed state and one complete session; the owner does
not retry automatically, and replay does not issue another session.

Failed provider/restricted/unlinked attempts retain state until expiry. Refusal
does not grant a session or retarget another account. Expiry checks fence local
publication, not the elapsed duration of an external provider request. A timestamp
and ciphertext comparison does not claim to detect arbitrary privileged database
tampering or every history that restores identical values.

## HTTP and validation

Start/callback responses use no-store and no-referrer. The public start DTO is an
allowlist. Continuations normalize through URL parsing to `/app` or an application
descendant; external/protocol-relative targets, control/backslash paths and
encoded separator/path escapes fall back to `/app`. Existing login refusal
feedback and 303 behavior remain. No additional cognitive challenge is introduced.

Unit/route tests cover payloads, cookies, continuations, copied proofs and adapter
handoff. Actual PostgreSQL tests cover concurrent callbacks, exact-record races,
expiry, required-audit rollback, precommit invisibility, controlled commit-ack loss
and actual backend retirement. A separate disposable HTTPS browser fixture checks
cross-site Lax return, other-browser refusal, independent tabs and replay. Exact
executed evidence and limitations belong in the separate outcomes.
