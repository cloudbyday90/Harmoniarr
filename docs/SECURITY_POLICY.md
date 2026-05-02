# Harmoniarr Security Policy And Posture

- **Version:** Planning baseline
- **Last Updated:** 2026-05-01
- **Scope:** Harmoniarr UI, API, embedded Postgres runtime, background workers, slskd integration, metadata providers, import pipeline, media tooling, and operator-facing deployment posture

---

## Purpose

This document defines Harmoniarr's intended security policy and operating posture.

It is different from `docs/SECURITY_BENCHMARKS.md`.

- `SECURITY_POLICY.md` states what Harmoniarr intends to do.
- `SECURITY_BENCHMARKS.md` tracks how that intent maps to security benchmarks and later implementation evidence.

Harmoniarr is still in planning, so this document describes target posture for v1 and near-term follow-up work.

---

## Security Priorities

Harmoniarr's security posture should optimize for the actual risks of the product:

1. Protect local admin access to a self-hosted operational application.
2. Prevent unsafe or unauthorized filesystem writes into the managed music library.
3. Treat downloaded Soulseek content as untrusted until validated.
4. Protect external service credentials and local runtime secrets.
5. Keep background jobs, imports, and provider calls explainable and controllable.

The app does not need enterprise IAM in v1. It does need strong local auth, clear privilege boundaries, safe file handling, and good operator visibility.

Harmoniarr should be secured like a self-hosted companion app, not like a hosted business system. The goal is to reduce realistic self-hosted risk and operator foot-guns, not to chase enterprise control catalogs, formal SLAs, or best-in-class managed-service posture for their own sake.

---

## Threat Model Baseline

Harmoniarr should assume the following are untrusted or potentially hostile:

- Soulseek search results.
- Downloaded files and folder names.
- Embedded media tags and filenames.
- User-supplied service URLs and configuration values.
- External API responses.
- Generated code that has not been reviewed.
- Every HTTP request field that crosses an API boundary, including headers, cookies, params, query values, methods, bodies, content types, and route sequencing.

Harmoniarr should assume the following are sensitive:

- Local admin account access.
- Session and refresh tokens.
- slskd credentials or API keys.
- Provider API keys and secrets.
- Filesystem path mappings.
- Import destinations and library state.
- Audit history and debug payloads that expose local infrastructure details.

---

## API Exposure And Entrypoint Posture

Harmoniarr should treat exposed APIs as both the front door and the windows of the system.

- The front door is the intended authenticated browser and integration API surface.
- The windows are smaller or easier-to-overlook entrypoints such as bootstrap routes, health and diagnostics endpoints, static-file serving, SPA fallbacks, provider configuration, outbound fetch targets, import filenames and paths, and any future webhook or upload surfaces.

The security objective is not only to protect authenticated routes, but to ensure that every exposed or indirectly reachable entrypoint is intentionally small, explicitly classified, and hardened against malformed, abusive, and out-of-sequence requests.

### API Surface Rules

- Maintain an explicit route inventory and classify each route as public, authenticated, admin-only, integration-only, or internal-only.
- Deny by default; no route should become public by omission.
- Keep management and diagnostics endpoints off the public Internet whenever practical.
- Prefer separate hosts, ports, or reverse-proxy rules for highly sensitive control-plane surfaces when deployment constraints allow it.
- Return generic 404 and 500 responses; do not expose framework defaults, debug stacks, or undeclared endpoints.
- Do not rely on the frontend to preserve workflow sequencing; privileged state transitions must validate current server-side state before acting.

### Request Shaping And Input Rules

- Validate all request inputs on the server side as early as possible, including params, query, headers, cookies, and JSON bodies.
- Use allowlisted schemas, enums, ranges, and length limits rather than denylist filtering.
- Apply both syntactic validation and semantic validation.
- Reject unexpected fields on privileged mutation routes to avoid mass-assignment style drift.
- Normalize free-form text before deeper processing where canonicalization matters.
- Keep regexes simple, anchored, and reviewable; avoid ReDoS-prone patterns.
- Enforce request body size limits and endpoint-specific payload limits.
- Enforce supported request and response content types explicitly; do not accept or emit undeclared types.
- Treat repeated validation failures, unsupported methods, and out-of-contract content types as abuse signals worth logging and rate limiting.

### Browser And API Perimeter Controls

- Send security headers for browser-reachable responses, including at minimum correct `Content-Type`, `X-Content-Type-Options: nosniff`, appropriate cache control for sensitive responses, and a coherent CSP/header baseline for HTML responses.
- Default browser-consumed API responses to `Cache-Control: no-store` unless a narrower, explicitly reviewed caching policy is introduced for a specific route family.
- Keep CORS disabled unless a cross-origin caller is intentionally supported; when enabled, scope origins, methods, and headers narrowly.
- Rate-limit authentication, bootstrap, recovery, search-dispatch, import-trigger, and other abuse-prone routes.
- Prefer HTTPS and secure cookies in any non-local deployment, but make those controls explicit operator opt-ins so local-only HTTP installs do not inherit a half-configured transport posture.
- Keep sensitive credentials, tokens, and API keys out of URLs.

### Outbound Request And Third-Party API Rules

- Treat third-party API responses as untrusted input, not trusted data.
- Do not accept arbitrary outbound URLs when the target set is known; prefer allowlisted hosts or host patterns.
- When a configurable service endpoint is necessary, validate scheme, host, port, and path expectations explicitly.
- Prefer exact host allowlists for fixed integrations and tightly scoped suffix allowlists only when subdomain flexibility is truly required.
- Block localhost, link-local, RFC1918, and metadata-service destinations for user-configurable outbound calls unless a deployment-specific rule explicitly requires them.
- Disable automatic redirect following for user-influenced outbound requests unless the redirect target is revalidated.
- Pair application-layer validation with network-layer egress restrictions where practical.

### File, Path, And Import Entrypoint Rules

- Treat downloaded archives, folders, filenames, tags, and embedded metadata as hostile input until validated.
- Never trust user-controlled or provider-controlled filenames for final storage names.
- Normalize and constrain path joins so import, staging, and library destinations cannot escape approved roots.
- Enforce size, type, and content checks before later parser, FFmpeg, archive, or metadata-processing stages are introduced.
- Keep imported or uploaded content outside any web-served root unless a dedicated safe-serving layer exists.

### Inventory, Observability, And Failure Posture

- Keep a current inventory of public and privileged endpoints, supported content types, and externally reachable hosts.
- Keep a code-level route inventory under version control and fail validation when registered routes drift from that declared inventory.
- Audit privileged mutations, authentication events, validation abuse, and outbound request failures with redaction.
- Prefer normalized error codes and safe summaries over raw upstream or parser failures.
- Make rate-limit, validation, and authorization denials observable without leaking internal details to clients.

---

## Authentication Posture

Harmoniarr should use a Classifarr-style local authentication model for v1.

### Account Model

- Require creation of the initial local admin account during first-run setup.
- Treat `setupRequired` as true when no users exist.
- Force the UI into setup-account flow until the first admin exists.
- Reserve a non-admin `user` role for future expansion, but keep v1 effectively admin-operated.
- Do not require external identity providers in v1.

### Browser Sessions

- Use cookie-based browser authentication.
- Use an httpOnly access-token cookie for normal API access.
- Use an httpOnly refresh-token cookie for session renewal.
- Keep access tokens short-lived.
- Support non-persistent and remember-me session durations.
- Keep auth state server-managed rather than stored in localStorage or sessionStorage.

### Passwords

- Hash passwords with bcrypt.
- Enforce a minimum complexity baseline.
- Rate-limit login attempts.
- Apply account lockout or similar backoff after repeated failures.
- Do not expose password hashes or password-derived data through the API.

### Session Controls

- Support logout and logout-all-devices.
- Support session listing and selective revocation.
- Rotate refresh tokens.
- Treat replay of revoked refresh tokens as a compromise event and revoke all active sessions for that user.

### Audit Logging

Record at minimum:

- Setup completion.
- Login success and failure.
- Logout and logout-all.
- Password changes.
- Session revocation.
- Token refresh.
- Lockouts.
- Suspected replay or session compromise.

Recovery-specific logging posture:

- never log plaintext recovery codes, submitted passwords, refresh tokens, or equivalent secret material
- allow normalized recovery error codes, lock-conflict outcomes, and incident metadata in logs and audit events
- keep recovery HTTP failures generic even when internal logs retain richer normalized classification

---

## Authorization Posture

Harmoniarr should use explicit route access tiers.

### Route Tiers

- Public bootstrap routes: setup status, initial admin creation, and minimal startup/auth bootstrap endpoints.
- Public auth-establishment routes: login and token refresh.
- Authenticated routes: ordinary logged-in operations.
- Admin-only routes: settings, paths, migrations, system controls, credentials, and other sensitive configuration or operational actions.
- Integration routes: webhook and API-key-driven operations intentionally designed for non-browser clients.

### Policy

- Deny by default.
- Require explicit registration of public routes.
- Require authenticated user context for normal app operations.
- Require admin role for sensitive system and configuration actions.
- Require fresh admin sessions for privileged mutation routes that change settings, trigger operator-controlled execution, or mutate metadata/import/library state.
- Do not let ordinary API keys act as admin users in v1.

Recovery-specific authorization rules:

- keep bootstrap-admin recovery routes in a dedicated recovery router
- allow only `status` and `complete` as public recovery routes
- never allow remote HTTP to arm or cancel recovery in v1
- never allow API keys to access public recovery routes

Diagnostics-specific authorization rules:

- keep backup, restore, upgrade, and recovery diagnostics views admin-only by default
- do not allow API keys to access operator diagnostics surfaces in v1
- do not widen the pre-auth recovery exception into a general diagnostics exception; only the narrow recovery status and completion routes are public while armed
- if especially sensitive diagnostics read-audit is introduced later, scope it to incident-sensitive surfaces such as recovery detail or security-relevant audit views rather than every ordinary polling read

Diagnostics-specific redaction and rate-limit rules:

- mask or omit secret-bearing values in diagnostics, including provider credentials, webhook secrets, decrypted backup content, plaintext recovery codes, and equivalent runtime secrets
- prefer normalized summaries, counts, warning indicators, and stable internal codes over raw exception payloads in default diagnostics views
- apply lower-friction limits to authenticated diagnostics polling reads and tighter limits to destructive or state-changing control-plane writes such as restore and export
- default control-plane responses to `Cache-Control: no-store`, return retry hints on `429` responses when practical, and keep correlation headers consistent with authenticated diagnostics tooling
- treat diagnostics export or sharing as redacted evidence handling: prefer deep links and compact summaries, preserve canonical identifiers, and never include plaintext recovery codes, decrypted backup content, raw session material, or other secret-bearing payloads
- if diagnostics annotations are introduced later, keep them admin-only, attribute them to the acting user and timestamp, store them separately from canonical audit evidence, and never let them overwrite or masquerade as system-generated facts
- if diagnostics evidence bundles or persisted acknowledgments are introduced later, keep them admin-only, apply the same redaction boundary as diagnostics export, and never let acknowledgment state suppress or rewrite canonical blocked, failed, or incident evidence
- if persisted remediation notes or follow-up state are introduced later, keep them separate from canonical run status and audit evidence and require fresh control-plane evidence before treating an incident as remediated

### Override And Manual Action Policy

Manual overrides are high-trust user actions and should be preserved as explicit evidence.

- Record who created the override and when.
- Preserve the previous automated association.
- Require review when an override conflicts with technical validation.
- Do not silently let later automation erase operator intent.

---

## Browser And CSRF Posture

If browser auth uses cookies, Harmoniarr should protect mutating requests with CSRF checks by default.

- Require CSRF token headers for cookie-authenticated `POST`, `PUT`, `PATCH`, and `DELETE` requests.
- Exempt safe methods.
- Exempt setup/bootstrap endpoints where CSRF would deadlock first-run setup.
- Exempt refresh endpoints where CSRF expiry would otherwise break valid remember-me sessions.
- Exempt API-key-authenticated requests and bearer-token requests that do not rely on browser cookies.
- Allow an explicit deployment-level opt-out only for tightly trusted local-only or separately network-restricted installs.
- Do not treat a reverse proxy alone as a general substitute for CSRF protection on cookie-authenticated browser writes.
- Treat secure cookies, HTTPS enforcement, and HSTS as sibling deployment-level opt-ins that should normally be enabled together when the app is actually served behind TLS.

The shared frontend API client should be the only supported path for authenticated UI writes.

Bootstrap-admin recovery route exceptions:

- exempt `GET /api/recovery/bootstrap-admin/status` from CSRF because it is a read-only public pre-auth route
- exempt `POST /api/recovery/bootstrap-admin/complete` from CSRF because it is a pre-auth recovery route and cannot depend on an existing browser session
- require `Cache-Control: no-store` on both routes
- do not set login cookies from the recovery completion response

These exemptions apply only to the narrow bootstrap-admin recovery flow and should not expand to other auth routes without a separate review.

---

## API Key Posture

API keys, if Harmoniarr needs them at all, should exist only for limited local automation or narrowly scoped integrations, not for normal browser administration.

- Do not make first-party API keys a required v1 feature unless a real local automation use case exists.
- Keep any token model intentionally small and understandable; a broad enterprise-style scope matrix is not required.
- Prefer show-once creation semantics over routine plaintext reveal endpoints.
- Mask tokens in normal responses and UI displays.
- Record last-used and usage metadata where practical.
- Support revocation and simple reissue or expiration when tokens are present.
- Avoid using non-browser tokens for admin-only system actions in v1.

---

## Secrets Handling Posture

Harmoniarr will manage secrets for services such as slskd and metadata providers. Those secrets should be treated as high-sensitivity configuration.

- Never return raw secrets from normal API responses.
- Mask secrets in UI and API projections.
- Keep secrets out of logs.
- Keep secrets out of browser storage.
- Document runtime secret sources and precedence clearly.
- Prefer encrypted-at-rest secret storage when application-managed secret persistence exists.

Secrets requiring this posture include:

- slskd credentials or API tokens.
- Metadata provider API keys.
- Optional webhook secrets.
- Optional future antivirus or sidecar service credentials.
- JWT and session-signing secrets.

---

## Filesystem And Import Safety Posture

Harmoniarr must treat filesystem actions as a primary security boundary.

### Path Mapping Contract

Harmoniarr should treat `slskd`-reported paths and Harmoniarr-local paths as separate namespaces.

- Do not assume a raw `slskd` path is locally readable.
- Store explicit configured translations from `slskd` path prefixes to Harmoniarr-visible path prefixes.
- Preserve both the raw source path and the translated local path.
- Reject ambiguous, overlapping, or unvalidated mappings.
- Normalize separators and platform-specific path behavior before validation.

This is both an operational and a security requirement. Incorrect translation can turn an import bug into a filesystem-boundary violation.

### Path Safety

- Canonicalize and validate all configured paths.
- Enforce root-folder boundaries.
- Prevent path traversal via filenames, tags, metadata, folder names, or manual overrides.
- Never let generated destination paths escape configured roots.

Harmoniarr should explicitly enforce these root classes:

- Completed download roots.
- Staging roots.
- Library roots.
- Temporary media-tooling or transcode roots.

No operation should silently cross between these roots without an explicit planned workflow step.

### Import Safety

- Treat completed downloads as untrusted until reviewed and validated.
- Stage files before import.
- Use allowlists for importable file types.
- Do not overwrite existing library files by default.
- Do not auto-extract archives by default.
- Do not execute downloaded content.
- Keep import operations planned and previewable.

Additional boundary rules:

- Refuse import when path translation fails.
- Refuse import when the translated source path falls outside configured completed-download or staging roots.
- Refuse final library writes outside configured library roots.
- Keep path validation independent from user confidence in metadata matching.

### Media Tooling

- Invoke `ffmpeg`, `ffprobe`, Chromaprint, and future security tooling with structured arguments.
- Do not build shell commands through unsafe interpolation.
- Apply timeouts and failure handling.

---

## Downloaded Content Posture

Soulseek content should be treated as hostile until proven otherwise.

- Search results are only observations, not trusted metadata.
- Candidate scoring should not imply trust in the files themselves.
- Files should remain in staging until import validation completes.
- Optional antivirus scanning should fit into the staging workflow rather than become a cosmetic badge.
- Missing or failed antivirus services should be surfaced clearly in policy and UI.

---

## Network And Provider Posture

Harmoniarr talks to external services and local operators will configure service URLs. That creates SSRF and credential-leak risk.

- Validate integration URLs.
- Avoid arbitrary user-driven fetch behavior.
- Apply provider-specific rate limits and retries.
- Keep external dependency health visible.
- Treat private-network access as an explicit integration capability, not a side effect of arbitrary URL support.

This applies to:

- slskd.
- MusicBrainz.
- Cover Art Archive.
- AcoustID.
- Optional future sidecars and security services.

---

## Container And Runtime Posture

Harmoniarr is intended for Docker-first deployment and should follow a conservative runtime posture.

- Use a stable Alpine base and explicit package versions where practical.
- Run as a non-root application user where possible.
- Keep writable paths explicit.
- Prefer minimal capabilities.
- Keep exposed ports minimal.
- Treat embedded Postgres data as sensitive runtime state.
- Refuse unsafe major-version mismatches instead of guessing through upgrade paths.

Where multiple containers are involved, the deployment must make the shared download and library paths explicit. Harmoniarr should not rely on undocumented host-path coincidence between itself and `slskd`.

Reverse proxy support is encouraged for non-local or TLS-terminated deployments, but application-level auth and authorization remain Harmoniarr's responsibility.

---

## Observability And Recovery Posture

Security-relevant failures should be diagnosable without exposing secrets.

- Log auth failures, session failures, provider auth failures, path validation failures, and import safety failures.
- Keep logs structured where practical.
- Expose health and degraded-state information clearly in the UI.
- Keep backup and restore workflows explicit and operator-driven.
- Keep retention and cleanup behavior documented rather than implicit.

---

## Backup, Restore, And Upgrade Posture

Backup and recovery controls should match Harmoniarr's actual threat model and deployment shape.

### Backup Scope Policy

Harmoniarr should distinguish between:

- Logical app backups of recoverable configuration and user intent.
- Operator-managed volume or snapshot backups for full host, media, and database disaster recovery.

The app should not imply that a logical backup is a full replacement for filesystem-level or off-box recovery.

For v1, logical app backups should exclude local interactive authentication state.

That means excluding at minimum:

- local user rows used for login
- password hashes
- active sessions
- refresh tokens
- CSRF state
- API keys and equivalent long-lived integration credentials when they can be reissued safely

### Backup Defaults

- Encrypt app-managed backups by default.
- Treat plaintext backups as an explicit expert-only choice with a warning.
- Store backups in a dedicated backup directory with restricted access.
- Encourage off-box or immutable secondary copies outside the app's primary trust boundary.

### Restore Safety Policy

Restore should never be an opaque "import this file" action.

Required restore properties:

- Preview before apply.
- Compatibility checks before apply.
- Clear replace vs merge semantics.
- Maintenance lock during apply.
- Transactional restore where practical.
- Dependency-ordered restore.
- Session invalidation after restore.
- Revalidation of path mappings, dependency health, and other sensitive runtime state after restore.
- Structured audit evidence for preview, apply, completion, and failure outcomes without storing secret payload material.

High-risk state-changing operations such as restore, upgrade, and bootstrap-admin recovery should be mutually exclusive and fail fast on lock conflict rather than waiting implicitly.

### Admin Recovery Policy

Harmoniarr should preserve one guaranteed admin recovery path, but that path should be separate from ordinary logical backup restore.

- Do not rely on logical backup restore as the only way to recover local admin access.
- Support an operator-controlled bootstrap-admin recovery flow for cases where the operator still has local container or volume control.
- Treat admin recovery as a high-risk operation that must be audited.
- Require fresh authentication after admin recovery or restore.
- Prefer restoring one recoverable admin path over restoring historical local user accounts in v1.

Bootstrap-admin recovery should additionally follow these controls:

- local arming only; remote HTTP must not be enough to arm recovery
- one-time recovery code only
- short expiry window
- aggressive rate limiting on completion attempts
- forced revocation of interactive session state on successful completion
- explicit operator review of admin accounts and local API keys after recovery
- completion should fail with conflict when restore or upgrade maintenance locks are active
- do not support a recovery-safe mode exception in v1

Recommended v1 rate-limit posture:

- recovery status route: low-cost IP-based read limiter
- recovery completion route: strict IP-based write limiter plus per-run invalid-attempt threshold
- generic failure responses once thresholds are crossed

### Sensitive Runtime State

Do not restore these as live runtime state:

- Access tokens.
- Refresh tokens.
- Active sessions.
- In-flight job execution state.
- Temporary caches.

If backed-up account or integration state is restored, the app should invalidate or rotate runtime access where appropriate.

For v1, the safer default is to restore configuration state while forcing fresh interactive login and reissued integration credentials.

### Upgrade Safety Policy

- Fail closed on incompatible PostgreSQL major-version upgrades.
- Require explicit upgrade paths for major version changes.
- Make app version, schema version, and cluster version visible to operators.
- Strongly recommend or auto-create a fresh logical backup before risky upgrade operations.

### Recovery Testing Policy

Common backup failures come from untested restore assumptions. Harmoniarr should treat restore validation as part of the platform posture, not optional hygiene.

- Test restore procedures regularly.
- Keep evidence that restore preview, apply, and post-restore reconciliation paths actually work.
- Measure approximate recovery time for core app-state restore.
- Distinguish between backup verification and actual recovery validation.
- Test bootstrap-admin recovery arm, expire, complete, and post-login checklist behavior.
- Test bootstrap-admin recovery invalid-attempt threshold handling and terminal-state transitions.
- Test route-level controls for recovery status and completion, including rate limiting, API-key rejection, CSRF exemption boundaries, and absence of login-cookie issuance.

### Mistakes To Avoid

Harmoniarr should avoid these well-known backup and recovery mistakes:

- Assuming backup creation success proves recoverability.
- Storing the only backup copy inside the same failure domain as the primary app data.
- Backing up secrets without encrypting the backup artifact.
- Treating backed-up local user records as a safe substitute for an explicit admin recovery plan.
- Restoring stale sessions or long-lived credentials without rotation.
- Applying restore without maintenance locking.
- Treating merge restore as harmless when object identity rules are unclear.
- Restoring transient worker state that should instead be rebuilt.

---

## Secure Development Posture

Harmoniarr should assume that generated code and fast-moving implementation work are common sources of subtle security regressions.

- Require route inventory testing.
- Require negative auth tests.
- Require validation tests for write endpoints.
- Require secret scanning and dependency review.
- Review any code touching auth, sessions, SQL, paths, downloads, shell execution, encryption, or provider URLs.
- Keep benchmark and policy docs updated as implementation lands.

---

## Initial v1 Stance

For v1, Harmoniarr should adopt this explicit security stance:

- Local admin account required on first run.
- Cookie-based browser auth with refresh-token-backed sessions.
- CSRF protection for cookie-authenticated writes.
- API keys for integrations only.
- Explicit server-enforced admin route protection.
- Strict path-boundary enforcement for imports and media management.
- Staging-first treatment of downloaded content.
- Conservative secret exposure rules.
- Strong audit and session visibility for account security.

This is the baseline posture to implement first. Benchmark and compliance tracking should measure against this posture, not replace it.
