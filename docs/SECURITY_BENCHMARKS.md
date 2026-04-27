# Harmoniarr Security Benchmarks

- **Version:** Planning baseline
- **Last Updated:** 2026-04-26
- **Scope:** Harmoniarr API, UI, container, embedded Postgres, slskd integration, metadata providers, media import pipeline, and future optional services
- **Source:** Adapted from Classifarr's `docs/SECURITY_BENCHMARKS.md`

---

## Overview

This document maps Harmoniarr's intended security posture against practical security benchmarks.

Harmoniarr is still in planning, so most entries describe target controls rather than verified implementation. Once code, Dockerfiles, Compose files, and CI exist, each item should be updated with concrete file references and actual compliance status.

### Benchmark Sources

| Source | Focus | Use In Harmoniarr |
|--------|-------|-------------------|
| CIS Docker Benchmark | Container and runtime hardening | Standard Docker image and Compose deployment |
| OWASP API Security Top 10 2023 | API security risks | Express API, auth, object access, rate limits |
| OWASP REST Security Cheat Sheet | REST service best practices | Headers, CORS, auth, validation, errors |
| SANS/CWE Top 25 | Common software weaknesses | Input validation, SQL injection, path traversal, auth |
| Node.js Security Best Practices | Node/Express runtime security | Backend implementation baseline |
| NIST Cybersecurity Framework 2.0 | Security program model | Planning, detection, response, recovery |
| NIST Secure Software Development Framework | Secure development lifecycle | Requirements, review, vulnerability prevention |
| OWASP ASVS | Application security verification | Testable auth, access control, validation, and session requirements |
| GitHub Secret Protection | Secret leak prevention | Secret scanning and push protection |
| OpenSSF guidance | Supply chain security | Dependency trust, lockfiles, Scorecards, SBOM |

---

## Compliance Summary Dashboard

### Planning Status

| Category | Target Status | Notes |
|----------|---------------|-------|
| CIS Docker Benchmark | Planned | Requires Dockerfile and Compose verification |
| OWASP API Security Top 10 | Planned | Requires API/auth implementation |
| OWASP REST Security | Planned | Requires Express middleware implementation |
| SANS/CWE Top 25 | Planned | Requires code and test gates |
| Node.js Security | Planned | Requires package, lint, and runtime setup |
| NIST CSF | Planned | Requires security docs, release workflow, and incident process |

### High-Risk Areas For Harmoniarr

| Risk | Why It Matters | Target Control |
|------|----------------|----------------|
| Downloaded untrusted files | Soulseek content is user-supplied and untrusted | Staging, allowlists, import validation, optional ClamAV scanning |
| Path traversal and unsafe imports | Imports move files into the user library | Canonical path validation, root-folder boundaries, no overwrite by default |
| slskd credentials/API access | slskd controls Soulseek search/downloads | Encrypted secrets, masked responses, least-privilege API key guidance |
| Metadata provider abuse | MusicBrainz and other providers are rate-limited | Adapter rate limits, caching, jitter, heartbeat state |
| SSRF via provider/settings URLs | User-configured service URLs can point anywhere | URL validation, private-network policy, allow/deny rules |
| Command execution via media tools | ffmpeg, ffprobe, Chromaprint, ClamAV are external tools | Structured argument construction, no shell interpolation, timeouts |
| Embedded Postgres lifecycle | DB runs inside standard container | strict file permissions, migration health, backup/restore model |
| Manual override workflows | User overrides can bypass automated matching | audit trail, explicit review, conflict warnings |
| AI-assisted/vibe-coded implementation | Generated code can miss security controls while appearing functional | Security gates, negative tests, route inventory, dependency review |

### Commonly Missed Controls In AI-Assisted Builds

AI-generated or "vibe-coded" projects commonly fail in predictable places: access control, auth edge cases, input validation, secret handling, over-permissive CORS, unsafe dependencies, and missing negative tests. Harmoniarr should treat generated code as untrusted until reviewed and tested.

Controls to require:

- Route inventory tests proving every API route is authenticated or intentionally public.
- Object-level authorization tests for artists, albums, wanted items, jobs, imports, settings, and source-user records.
- Realtime channel authorization for Socket.IO events, subscriptions, and progress updates.
- CSRF tests if browser authentication uses cookies.
- Negative tests for unauthorized, unauthenticated, wrong-role, wrong-owner, and stale-session requests.
- Server-side validation tests for every write endpoint, even when the UI validates.
- Secret scanning with push protection before code reaches the repository.
- Dependency review for every new package, including maintainer trust, typosquatting risk, license, activity, and transitive dependency risk.
- Lockfile enforcement and pinned GitHub Actions.
- Security review for all generated code touching auth, paths, SQL, shell/process execution, imports, downloads, encryption, sessions, CORS, or provider URLs.
- Threat-model notes for high-risk flows before implementation.

These controls are especially important because the app will manage untrusted downloaded files, local filesystem paths, external service credentials, and long-running background jobs.

---

## CIS Docker Benchmark

### Container Image Targets

| Control | Harmoniarr Target | Status |
|---------|-------------------|--------|
| Use trusted base image | Use official Node 24 Alpine image, pinned to stable Alpine branch | Planned |
| Minimize packages | Install only runtime dependencies: Node, Postgres runtime, media tools, health tooling | Planned |
| Non-root app process | Support `PUID`, `PGID`, `UMASK`; drop privileges before Node runs | Planned |
| Remove setuid/setgid where practical | Strip setuid/setgid bits unless required by runtime tooling | Planned |
| Healthcheck | Provide `/health` and Docker `HEALTHCHECK` | Planned |
| Vulnerability scanning | Add npm audit, OSV, Trivy, and secret scanning in CI | Planned |

### Runtime Targets

| Control | Harmoniarr Target | Status |
|---------|-------------------|--------|
| No privileged container | Compose must not use `privileged: true` | Planned |
| Drop capabilities | Drop all capabilities by default; add only those required for file ownership setup | Planned |
| `no-new-privileges` | Enable where compatible with startup model | Planned |
| Read-only root filesystem | Preferred; writable paths via volumes/tmpfs if compatible with embedded Postgres | Planned |
| Limit exposed ports | Expose only Harmoniarr HTTP port by default | Planned |
| Avoid host networking | Use bridge/custom network by default | Planned |
| Resource limits | Document memory, CPU, and PID limits | Planned |
| Safe volume mounts | Mount only app data, downloads, library roots, and configured media paths | Planned |

### Operator Responsibility

| Control | Notes |
|---------|-------|
| Harden Docker host | Host OS, Docker daemon, and filesystem partitioning remain operator responsibility |
| TLS termination | Production HTTPS should be handled by reverse proxy such as Caddy, Traefik, or nginx |
| Interface binding | Document binding to `127.0.0.1` or reverse proxy network for non-public deployments |
| Docker secrets | Recommended for high-sensitivity deployments; env vars remain common for self-hosted installs |

---

## OWASP API Security Top 10 2023

### API1 Broken Object Level Authorization

Target:

- Every entity route must authorize access to the requested object.
- Admin/system actions must require admin role.
- User-scoped API keys must not access unrelated resources.

Status: Planned.

### API2 Broken Authentication

Target:

- First-run admin creation.
- Strong password hashing.
- Secure session or JWT model.
- httpOnly cookies if browser auth uses cookies.
- Refresh token rotation if refresh tokens are used.
- Login and setup rate limits.
- Optional API keys with scoped permissions.

Status: Planned.

### API3 Broken Object Property Level Authorization

Target:

- Never return raw secrets.
- Mask slskd API keys, metadata provider tokens, webhook secrets, ClamAV connection secrets if any, and encryption metadata.
- Keep raw provider payloads behind admin/debug access.

Status: Planned.

### API4 Unrestricted Resource Consumption

Target:

- Pagination and result caps on large tables.
- Rate limits for auth, search, metadata refresh, manual Soulseek search, and expensive import validation.
- Queue limits for search, browse, fingerprint, transcode, antivirus, and metadata jobs.
- File size limits for scans/imports where practical.

Status: Planned.

### API5 Broken Function Level Authorization

Target:

- Deny by default.
- Explicit route registration by access level.
- Admin-only controls for settings, provider credentials, paths, media management, migration state, and system health.

Status: Planned.

### API6 Unrestricted Access To Sensitive Business Flows

Sensitive flows:

- Enqueue downloads.
- Import files into library.
- Replace existing library files.
- Manual correlation/override.
- Block/trust Soulseek users.
- Modify quality profiles and automation settings.
- Trigger metadata refreshes at scale.

Target:

- Authentication, authorization, rate limits, audit events, and confirmation for high-impact actions.

Status: Planned.

### API7 Server-Side Request Forgery

Target:

- Validate all configured service URLs.
- Restrict metadata and integration HTTP clients to expected domains or configured endpoints.
- Treat user-supplied URLs as untrusted.
- Avoid arbitrary URL fetch from search results, tags, or metadata payloads.
- Consider private-network access policy for integrations.

Status: Planned.

### API8 Security Misconfiguration

Target:

- Secure default headers.
- CORS allowlist.
- Production-safe errors.
- No default credentials after setup.
- Debug endpoints disabled or admin-only.
- Health endpoint avoids sensitive detail unless authenticated.

Status: Planned.

### API9 Improper Inventory Management

Target:

- Version API responses.
- Document internal API routes.
- Keep deprecated routes out of v1 unless needed.
- Track integration adapter versions, especially `slskd` compatibility.

Status: Planned.

### API10 Unsafe Consumption Of APIs

Target:

- Validate responses from slskd, MusicBrainz, Cover Art Archive, AcoustID, ClamAV, and future providers.
- Use provider-specific rate limits.
- Store raw payloads for debugging but normalize before domain decisions.
- Circuit breaker/backoff through dependency heartbeat.

Status: Planned.

---

## OWASP REST Security Targets

| Area | Harmoniarr Target | Status |
|------|-------------------|--------|
| Authentication | Admin login, scoped API keys, secure cookies or bearer tokens | Planned |
| Authorization | Route-level middleware and object-level checks | Planned |
| Input validation | Validate route params, request bodies, filters, paths, URLs, template tokens | Planned |
| Output filtering | Mask secrets and omit raw sensitive provider data | Planned |
| Secure headers | Helmet-style headers and CSP for UI | Planned |
| CORS | Explicit origin configuration | Planned |
| CSRF | Required if cookie-authenticated write requests are used | Planned |
| Rate limiting | Auth, search, metadata, import, and admin actions | Planned |
| Error handling | Generic external errors, detailed server logs | Planned |
| Audit logging | Auth, settings changes, manual overrides, imports, downloads, trust decisions | Planned |
| TLS | Reverse proxy recommended for production | Operator responsibility |

---

## SANS/CWE Top 25 Coverage Targets

| CWE | Risk | Harmoniarr Target |
|-----|------|-------------------|
| CWE-79 | XSS | CSP, output escaping, avoid unsafe HTML |
| CWE-89 | SQL Injection | Parameterized `pg` queries only |
| CWE-20 | Input Validation | Shared validators for API inputs and worker payloads |
| CWE-22 | Path Traversal | Canonical path validation under configured roots |
| CWE-78 | OS Command Injection | Use structured spawn args; no shell interpolation |
| CWE-306 | Missing Authentication | Auth required for app APIs after first-run setup |
| CWE-862 | Missing Authorization | Role/permission checks for privileged actions |
| CWE-200 | Information Exposure | Sanitized errors, masked secrets, limited health details |
| CWE-352 | CSRF | Double-submit or equivalent if cookie auth is used |
| CWE-434 | Unsafe File Upload/Import | Staging, allowlisted import types, no auto-extract, optional AV |
| CWE-502 | Deserialization | No unsafe deserialization of untrusted data |
| CWE-400 | Resource Exhaustion | Queues, rate limits, file limits, worker concurrency |
| CWE-287 | Improper Authentication | Password hashing and session/token lifecycle |

---

## Node.js Security Targets

| Practice | Target |
|----------|--------|
| Stable runtime | Node 24 baseline |
| ESM | Use ES modules for app/scripts |
| Express security | Helmet, body limits, centralized errors |
| Dependency auditing | npm audit, Dependabot, OSV |
| Security linting | ESLint security rules for server code |
| Secret handling | Encrypt integration secrets at rest; mask in logs/UI |
| Logging | Structured logs with redaction |
| Process handling | Use init process such as `tini` in container |
| External commands | No shell-built commands for ffmpeg/ffprobe/fingerprint/AV |
| Worker safety | Durable jobs, bounded retries, backoff, idempotency |

---

## AI-Assisted Development Security Gates

Harmoniarr may be developed with AI assistance, but generated code should not receive lower scrutiny than handwritten code.

Required gates:

| Gate | Target |
|------|--------|
| Security-sensitive change flag | PRs touching auth, authorization, paths, imports, downloads, jobs, encryption, provider URLs, CORS, sessions, or shell/process execution must be marked security-sensitive |
| Human review | Security-sensitive generated code requires explicit human review before merge |
| Negative tests | Every new privileged route or job action needs unauthorized and wrong-role tests |
| Route inventory | Tests should fail when a route is mounted outside the auth-gated router unless explicitly allowlisted |
| Realtime inventory | Socket.IO events and progress streams must require auth and object-level authorization |
| Dependency review | New runtime dependencies need justification and security review |
| Secret scan | Secret scan and push protection must run before merge |
| SAST/SCA | Security lint, dependency audit, and container scan should be CI gates |
| Threat-model note | High-risk flows need short abuse-case notes before implementation |

High-risk Harmoniarr flows:

- First-run setup and admin creation.
- Login/session refresh/logout.
- slskd credential storage and validation.
- Provider credential storage.
- Manual Soulseek search and result correlation.
- Candidate acceptance and download enqueue.
- File import, rename, move, hardlink, and overwrite prevention.
- Quality upgrade replacement workflows.
- Path settings and root-folder validation.
- Background job creation, cancellation, retry, and progress subscriptions.
- Source-user trust, blocklist, and override decisions.
- Optional antivirus quarantine and override behavior.

Security-sensitive generated code should include tests that prove the failure case, not only the happy path.

---

## Harmoniarr-Specific Security Requirements

### Download And Import Safety

Targets:

- All downloads land in staging first.
- Importable extensions are allowlisted.
- Archives are not auto-extracted by default.
- Files are not executed.
- Existing library files are not overwritten silently.
- Import plans show before/after paths.
- Optional future ClamAV scanning runs before import.
- Quarantine blocks import.

### Path And Filesystem Safety

Targets:

- Library roots and download roots must be explicit.
- Every import destination must be canonicalized and verified under an allowed root.
- Symlink behavior must be explicit and conservative.
- Case-only renames and collisions must be handled safely.
- Permission changes must be previewed for existing files.

### Integration Safety

Targets:

- slskd credentials encrypted and masked.
- MusicBrainz limited to one request per second by default.
- Provider calls cached and jittered.
- AcoustID and fingerprinting are optional and queued.
- ClamAV is optional and heartbeat-monitored when enabled.
- Failed dependencies pause affected schedulers.

### Realtime And Job Safety

Targets:

- Socket.IO connections must authenticate before subscribing to events.
- Event subscriptions must be scoped to the user's permissions.
- Job progress endpoints and realtime events must not expose task IDs, file paths, artist names, album names, or progress details to unauthenticated users.
- Job IDs should be unguessable or access-controlled.
- Job cancellation, retry, and priority changes require authorization.
- Background workers should validate job payloads from the database before acting.

### Privacy And Log Safety

Targets:

- Local filesystem paths should be redacted or limited in non-admin logs.
- slskd credentials, API keys, cookies, session tokens, provider tokens, and encryption keys must never be logged.
- Soulseek usernames, IP addresses, queue details, and trust notes should be treated as sensitive operational data.
- Export/debug bundles should redact secrets and optionally redact local paths and usernames.
- Backups should document whether sensitive settings are encrypted and whether backup files need separate protection.

### Manual Override Safety

Targets:

- Manual correlation/override must preserve previous automated decisions.
- User, timestamp, target, prior association, new association, and optional reason are recorded.
- Conflicts with metadata/fingerprint/quality evidence require import review.

---

## NIST CSF 2.0 Planning Map

| Function | Harmoniarr Target | Status |
|----------|-------------------|--------|
| Govern | Security policy, benchmark docs, release checklist | Planned |
| Identify | Asset inventory: app, DB, slskd, providers, media roots, workers | Planned |
| Protect | Auth, authorization, container hardening, secret encryption, path safety | Planned |
| Detect | Dependency heartbeat, security logs, scan results, audit events | Planned |
| Respond | Security advisory process, incident notes, release fixes | Planned |
| Recover | Backups, restore docs, migration safety, safe startup failures | Planned |

---

## Initial Security Action Items

### High Priority

| Item | Reason |
|------|--------|
| Define auth/session model | All API security depends on it |
| Define path validation library | Import safety depends on it |
| Define secret encryption approach | slskd and provider credentials need protection |
| Add security docs and disclosure policy | Needed before public release |
| Add CI secret/dependency scanning | Catches common project risks early |

### Medium Priority

| Item | Reason |
|------|--------|
| Define Docker hardening baseline | Needed before container release |
| Define audit event model | Needed for overrides/imports/trust decisions |
| Define SSRF policy for configured URLs | slskd/provider endpoints are configurable |
| Define optional ClamAV integration | Planned future defense-in-depth |
| Define route/realtime inventory tests | Common source of auth bypass in fast-generated Express apps |
| Define dependency review policy | Prevent typosquatting, abandoned packages, and risky transitive dependencies |
| Define privacy/redaction policy | Soulseek usernames, IPs, paths, and trust notes may be sensitive |

### Deferred

| Item | Reason |
|------|--------|
| Mandatory antivirus scanning | Future feature, not v1 blocker |
| Docker secrets-only deployment | Useful for hardened installs, not baseline self-hosted ergonomics |
| Custom AppArmor profile | Host-dependent hardening |
| Full multi-instance security model | Out of scope for initial embedded Postgres deployment |

---

## Verification Commands

These commands should be updated once the repo has implementation files:

```bash
npm audit
npm run lint
npm test
docker compose config
```

Expected future checks:

- Server lint.
- Client lint.
- Security lint.
- Secret scan.
- Push protection or equivalent pre-push secret blocking.
- Dependency vulnerability scan.
- Dependency review for new runtime packages.
- Container vulnerability scan.
- Route inventory auth test.
- Socket/realtime auth test.
- Docker image build.
- Health endpoint smoke test.

---

## Related Documents

- `docs/harmoniarr.md`
- `docs/harmoniarr-visual.md`
- Future `SECURITY.md`
- Future `SECURITY_REVIEW.md`
- Future release checklist

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-04-26 | Planning baseline | Adapted Classifarr security benchmark structure for Harmoniarr planning, with Harmoniarr-specific risks for Soulseek downloads, media imports, slskd integration, metadata provider limits, embedded Postgres, and future antivirus scanning. |
