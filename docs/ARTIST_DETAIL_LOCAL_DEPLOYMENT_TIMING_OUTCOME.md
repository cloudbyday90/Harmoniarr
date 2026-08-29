# Artist Detail Local Deployment Timing Outcome

Status: Implemented
Date: 2026-08-29

## Outcome

Harmoniarr now provides a one-shot, secure local-deployment measurement for a
real Artist Detail browser visit. It differentiates the local metadata,
authenticated per-user operator projection, and provider Discography fallback
without adding telemetry, a dashboard, an endpoint, or a cache-control UI.

The command emits a small allowlisted artifact on standard output and can
optionally write it inside the repository workspace. It is intentionally a
diagnostic tool rather than a change to normal user behavior.

## Implementation

- `scripts/artist-detail-local-timing-evidence.js` validates the versioned
  artifact schema, request order, status families, and bounded Resource
  Timing values.
- `scripts/measure-artist-detail-local-timing.js` validates a loopback-only
  target, uses a file-only password, signs in through the normal UI, observes
  only the relevant request categories, and writes only workspace-local
  evidence.
- `scripts/secret-input.js` now exports a reusable file-only secret resolver
  for newly designed diagnostic scripts; legacy scripts retain their existing
  compatibility behavior.
- `package.json` adds `npm run measure:artist-detail-local-timing`.

## Verification

The focused contract and security validation passed on 2026-08-29:

- `node --test test/scripts/secret-input.test.js test/scripts/artist-detail-local-timing-evidence.test.js test/scripts/measure-artist-detail-local-timing.test.js`
- focused ESLint across the new scripts and their tests
- `npm run validate:artist-detail-cache-browser-evidence` — production client
  build plus the serial Chromium/PostgreSQL cold, fresh, stale-SWR and local
  projection proof passed.
- `npm run validate:security` — Compose image and single-node topology policy
  passed; npm audit reported zero vulnerabilities.
- `npm run validate` — copyright, migrations, schema snapshot, ESM,
  Compose-policy, full lint, test-hygiene, server/client/script/integration
  suites, and production builds passed.
- `git diff --check`

## Recommendation retained

Do not change Artist Detail concurrency or cache strategy from an impression
of slowness. Capture a reproducible local case, identify the only dominant
request category, and add the smallest regression beside the responsible
service before applying a fix.
