# Plex callback implementation outcome

October 27, 2026. Plex pending login state is now browser-bound and single-use;
its consumption commits with the local session and required audit. Implemented
directly on main using modular ESM files, with no new dependency, schema artifact
or deployed service. See [official research and tradeoffs](PLEX_CALLBACK_RESEARCH_2026_10.md)
and the separate [implementation design](PLEX_CALLBACK_DESIGN.md).

## Delivered behavior

The route passes a random browser verifier internally and returns an explicit
public DTO. The verifier lives in a host-only HttpOnly SameSite=Lax cookie, with
Secure and a `__Host-` prefix under the configured secure-cookie policy. The
versioned encrypted pending payload stores only its hash. State and verifier
validation precede provider calls; legacy unbound pending flows require restart.
Provider verification retains the actual PIN/token/profile path outside SQL.

Client-identifier initialization now uses a bounded owner and fixed advisory lock.
Start-state persistence and the required privacy-safe start audit share a bounded
transaction, using database-clock expiry. New audits exclude raw state, browser
verifier/hash, PIN and provider token. Canonical application-only continuations,
no-store/no-referrer and existing login refusal/303 behavior are preserved.

Completion captures exact encrypted-record identity/bytes/full revision, checks
the current linked enabled account, and requires one matching unexpired deletion.
Consumption, bookkeeping, root-session issuance and required success audit share
the same transaction/client. A final database-clock expiry check precedes commit.
Rollback restores state; suppressed deletion/audit cannot publish a login. No
post-commit deletion remains. Replayed or concurrently consumed state cannot
issue another session. Lost acknowledgement after a real commit is conservative:
no automatic retry, no second session, and a fresh sign-in is available.

An established browser binding supports independent tabs. It is retained on
success/refusal so one callback cannot invalidate another pending tab. Failure
does not clear state prematurely. Simultaneous first starts without an established
cookie, changing canonical host/policy or blocked/expired cookies can require
restart. Failed/expired database records await the maintenance followup below.

## Frozen source and fast gate

Source fingerprint: 3,752 files, SHA-256
`94f4dd25d55c81ca12d1f052fb9fa5d1bec550148fa26d90e1688701f587f32c`.
Fourteen production/test files were frozen before final validation. Documentation
was completed afterward; the frozen code remained unchanged. Eight production
paths match the new immutable image.

Focused command `node --test test/server/plex-callback-state.test.js
test/server/plex-direct-sign-in-service.test.js test/server/linked-login.test.js
test/server/auth-routes.test.js` passed **44 tests**. The complete fourteen-stage
fast gate passed with server concurrency eight: **6,298 server + 4,504 client +
703 script = 11,505 tests**, zero failures/cancellations/skips. Executed stages:

```text
npm run check:node-baseline
npm run check-copyright
npm run migration:check
npm run check:schema-snapshot
npm run check:schema-anchor-contract
npm run check:esm
npm run check:image-tags
npm run check:compose-topology
npm run lint
npm run check:test-hygiene
node --test --test-concurrency=8 test/server/**/*.test.js
node --test test/client/**/*.test.js
node --test test/scripts/**/*.test.js test/compose-image-tag-policy.test.js
npm run build
```

Pinned local Node 24.22.1/npm 12.0.2 were used. `npm audit` reported zero
vulnerabilities. Whitespace checks use the repository's CRLF-aware policy.

## Callback qualification

The packaged callback entry passed 19 actual PostgreSQL scenarios: HTTP cookie/
privacy behavior and other-browser refusal before provider work; normal consume/
replay; start-audit privacy; legacy/malformed/expired refusal; exhausted pool;
independent tabs; concurrent HTTP single winner; revision/cipher/replacement/
deletion after preliminary read; expiry during provider/admission; required-audit
rollback and explicit retry; suppressed deletion; invisibility before commit;
final expiry rollback; real commit with controlled lost acknowledgement; required
start-audit failure; deadline rollback and actual backend retirement.

The disposable HTTPS Chromium fixture passed Secure/HttpOnly/host-only/Lax cookie
checks, actual cross-site top-level return, other-browser refusal, original-browser
success, independent-tab completion, replay without replacing the session cookie,
and no binding cookie at the simulated provider. The application/database use the
immutable packaged implementation. Test-only public certificates and a scoped
browser chain exception establish navigation behavior, not production TLS trust.

The first native preflights incorrectly attributed global pool occupancy to a
single callback. They failed during overlap and could leave a barrier waiting.
Per-call actual checkout/release tracking and abort-aware fixture barriers fixed
the evidence boundary; no production deadline was relaxed. The initially stalled
owned tmpfs container was inspected, stopped and removed. Browser preflights also
found fixture-only Docker port publication and saved-policy setup mistakes; the
final fixture persists its own secure policy before composition and exits zero
through owned graceful shutdown. Failed preflights remain distinct from final
evidence. [Docker outcome](LOCAL_DOCKER_PLEX_CALLBACK_OUTCOME.md) records the full
affected regression matrix, deployment identity and cleanup.

## Recommendation and limits

Adopt the implemented stack: browser verifier/hash, bounded encrypted state,
database-clock expiry, provider work outside SQL, exact current linked-account
admission and exact conditional consumption with atomic session/audit publication.
The benefit is the tested browser/replay and partial-publication protection. The
cost is additional bounded SQL and conservative restart under uncertain or
invalidated flows. Old unbound flows intentionally restart.

Provider responses are controlled. No live Plex/TLS acceptance, physical network
failure proof, exhaustive schedule coverage, new memory minimum, OIDC compliance
or complete WCAG/manual assistive-technology acceptance is claimed. Expiry fences
publication but does not bound external response bodies or transport duration.
The exact record guard does not detect arbitrary privileged tampering or every
identical-value restoration history. Existing historical audit records are not
rewritten.

GitHub MCP checks for all open PRs and open Dependabot PRs returned empty. There
was no PR to randomly select/apply or stale Dependabot PR to rebase/close. None
was merged. Work stays on main with no release, tag or separate branch.

**Next item:** integrate bounded expired callback-state cleanup with existing
maintenance, including conservative legacy retention, active-flow race proof and
protection for the persistent Plex client identifier. It should run automatically
under existing maintenance ownership, with no manual refresh or extra service.
