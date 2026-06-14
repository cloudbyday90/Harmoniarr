# Web Push VAPID Hardening Design

## Status

Implemented on 2026-06-13.

This document records the source review, options, recommendation stack, implementation outcome, and validation for hardening Harmoniarr's Web Push VAPID runtime configuration.

## Problem

Browser and integration tests surfaced a runtime warning:

```text
[harmoniarr-push] VAPID keys not set in environment. Generated an ephemeral pair for this run.
```

The previous behavior kept local startup convenient, but it had two security and reliability issues:

- production could silently start with ephemeral VAPID keys if the environment was missing required configuration
- runtime startup logs printed generated private key material to stderr

Ephemeral VAPID keys invalidate browser push subscriptions after restart, and private key material should not be emitted through normal application logs.

## Official Research

Research was performed against official sources in June 2026 for practices current as of May 2026.

- IETF RFC 8292, Voluntary Application Server Identification for Web Push: https://datatracker.ietf.org/doc/html/rfc8292
  - VAPID uses a maintained ECDSA P-256 signing key pair to establish a consistent application-server identity across push messages.
  - VAPID contact information lets push services contact the application-server operator during exceptional situations.
- IETF RFC 8291, Message Encryption for Web Push: https://datatracker.ietf.org/doc/html/rfc8291
  - Web Push payload encryption provides confidentiality and integrity between the application server and user agent.
- MDN PushManager.subscribe(): https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe
  - `applicationServerKey` is the ECDSA P-256 public key used by the push server to authenticate the application server, and sent messages must use VAPID with the corresponding private key.
- web.dev Push Notifications Subscription Guide: https://web.dev/articles/push-notifications-subscribing-a-user
  - The private application-server key signs push requests, and push services validate the signature against the public key linked to the subscription.
  - Application-server keys should be created once for the app, and the private key should remain private.
- web-push official README: https://github.com/web-push-libs/web-push/blob/master/README.md
  - The package supports generating VAPID keys and setting VAPID details before sending notifications.
- OWASP Secrets Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
  - Secrets should be centrally managed, access-controlled, and protected from leakage through logs or configuration sprawl.
- Node.js environment variable documentation: https://nodejs.org/api/environment_variables.html
  - Environment variables are process runtime configuration values read through `process.env`; Node defines stable `.env` parsing behavior.

## Options

### Option A: Keep auto-generation and full key logging

Pros:

- Zero migration work.
- Developers can copy generated keys from logs.

Cons:

- Production can silently run with unstable keys.
- Runtime logs expose private key material.
- Push subscriptions break after restart.

Decision: reject.

### Option B: Always require configured VAPID keys

Pros:

- Strongest startup posture.
- No ephemeral subscriptions.
- No secret logging.

Cons:

- Breaks local and integration startup unless every harness supplies keys.
- Adds friction for new development environments.

Decision: reject as too disruptive for non-production workflows.

### Option C: Require stable keys in production, allow non-production ephemeral fallback without secret logging

Pros:

- Production fails closed when VAPID keys are missing.
- Local development remains usable.
- Runtime logs no longer expose private key material.
- Integration and browser tests can inject deterministic keys to avoid noisy fallback warnings.

Cons:

- Non-production can still create ephemeral subscriptions unless operators disable fallback explicitly.
- Requires a separate key-generation path for setup.

Decision: accept.

### Option D: Persist generated VAPID keys in database settings

Pros:

- First boot could self-heal while keeping stable subscriptions.
- Aligns with older design notes that mentioned persisted app config.

Cons:

- Requires secret storage, migration, rotation policy, backup/restore behavior, and startup ordering work.
- Larger security surface than needed to fix the immediate leak/fail-open behavior.

Decision: defer.

## Final Recommendation Stack

Implement Option C now.

- VAPID keys:
  - read `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` from runtime environment
  - fail startup in `NODE_ENV=production` when either key is missing
  - allow ephemeral generation only outside production
  - allow non-production fallback to be disabled with `HARMONIARR_ALLOW_EPHEMERAL_VAPID_KEYS=false`
- VAPID contact:
  - read `VAPID_CONTACT` from runtime environment
  - require `mailto:` or `https:` URI shape
  - reject the default local placeholder contact in production
- Logging:
  - never print generated VAPID public or private keys from normal server startup
  - log an actionable command for generating stable keys
- Key generation:
  - add `npm run generate:vapid-keys` as the explicit operator/setup path that prints env-ready values
- Tests:
  - inject deterministic VAPID keys and contact into integration/browser app runtime
  - add unit tests for production fail-closed behavior, contact validation, non-production fallback, and no key leakage in warnings

## Implementation Outcome

Implemented:

- Hardened `src/server/push/vapid-keys.js` with production fail-closed behavior, contact validation, non-production fallback controls, and secret-safe warnings.
- Moved default contact resolution in `push-notification-service.js` through the VAPID config resolver.
- Added `scripts/generate-vapid-keys.js` and `npm run generate:vapid-keys` for explicit setup.
- Updated `testing/integration/app-runtime.js` to provide deterministic VAPID keys and contact during integration/browser scenarios.
- Updated Compose and `.env.example` deployment surfaces so production containers require stable VAPID values and walkthrough runs stay local-development scoped.
- Updated `test/server/vapid-keys.test.js` to cover the hardened contract.

Security posture:

- Production no longer silently starts with ephemeral VAPID identity.
- Runtime startup no longer prints VAPID private key material.
- Test harnesses avoid accidental fallback behavior.
- No route, database, or subscription schema changes were required.

Validation completed:

- `node --test test/server/vapid-keys.test.js test/server/push-notification-service.test.js test/server/push-routes.test.js`
- `npm run lint:server`
- `npm run lint:test`
- `npm run lint:scripts`
- `npm run check:esm`
- `npm run check:image-tags`
- `npm run build:server`
- `node --test --test-concurrency=1 test/browser/discover-refresh-regression.test.js`
- `git diff --check`
