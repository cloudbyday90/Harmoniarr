# Packaged notification continuity outcome

Implemented September 13, 2026. The separate [design](PACKAGED_NOTIFICATION_CONTINUITY_DESIGN.md) records official sources, alternatives, security and W3C boundaries, and open PR disposition.

## Delivered changes

The existing immutable candidate harness now seeds one disabled requester, one request, one invalidated synthetic registration, and four queue rows (pending, sent, failed, expired) in both initial phases. Fresh seeding follows first-admin bootstrap and precedes backup/restore. No operator connection, live endpoint, or browser subscription is used.

A separate serialized ESM notification probe runs through the selected image's database client. It discovers historical schema capabilities and captures exact timestamp text and hashes of endpoint, encryption/authentication keys, and payload contents. The host verifier compares original fields across restart and upgrade, including ownership, registration identity when already present, queue status, scheduling, and content. Newly introduced expiry, registration, claim, and terminal fields must satisfy their migration rules. Unknown terminal history receives the migration's common grace baseline; known sent history retains its original timestamp.

Candidate checks require four exact column definitions, three validated immediate constraints, six valid and ready indexes, and the latest pruning migration. Acceptance fails when schema proof, continuity proof, or the four-notification/one-subscription counts are absent. Only aggregate counts and verification flags enter the saved public evidence; fixture rows and hashes remain internal.

## Recommendation stack and tradeoffs

Use the existing immutable image resolver and isolated Docker lifecycle, small native ESM probes and verifiers, explicit migration-backfill rules, exact schema/index checks, sanitized evidence, and a real packaged run. This catches lost rows, ownership changes, incorrect backfills, and schema drift that migration counts and health alone would miss.

The cost is additional fixture and historical-schema compatibility logic. Future intentional notification transformations must update these explicit expectations. The fixture is deliberately inert: this proves retained database state, not provider acceptance, delivery, display, or browser permission. The dedicated local network does not provide outbound network isolation.

## Executed evidence

The application image is built from committed revision `d306205345ccb416a94257956b419e61af2d28fd`; this slice changes host acceptance tooling, not packaged application behavior. Candidate image: `sha256:1354c366218d1fe52a6f818bda26c05a29395d9e0867943f610515e3842f6c5c`.

Baseline revision: `24d9dfb3415a9246d19068779d63d7111095c4bd`. Baseline image: `sha256:38634ac85f9615a8511566d57aa17c2beb4e6b86b134748801c215f2d65f5ad6`.

Final command:

```powershell
node scripts/validate-docker-candidate.js `
  --candidate-image sha256:1354c366218d1fe52a6f818bda26c05a29395d9e0867943f610515e3842f6c5c `
  --baseline-image sha256:38634ac85f9615a8511566d57aa17c2beb4e6b86b134748801c215f2d65f5ad6 `
  --candidate-revision d306205345ccb416a94257956b419e61af2d28fd `
  --baseline-revision 24d9dfb3415a9246d19068779d63d7111095c4bd `
  --allow-local-images `
  --evidence-path .tmp/packaged-notification-continuity-2.json
```

Passed at `2026-09-13T11:42:05.666Z`. Evidence SHA-256: `2cf1936362a8cea7ef251d68da53a4d4b87d5a451427d8dc381ec7b4fff96257`. The earlier run also passed; the final run includes fixed-second fixture intervals and strengthened fresh-field checks.

| Check | Result |
| --- | --- |
| Fresh installation | 104 matching packaged migrations; zero pending; required notification schema and indexes verified |
| Existing-data restart | Same ledger and exact generated request, subscription, and four queue rows preserved |
| Baseline | 98 matching packaged migrations; legacy fixture captured |
| Upgrade | Six migrations added; all old ledger entries preserved; new fields/backfills and 104-migration schema verified |
| Runtime | Linux/amd64; Node 24.19.0; PostgreSQL, pg_dump, and pg_restore 18.6 |
| Existing smoke flows | Backup/restore, settings persistence, maintenance-conflict refusal, delegated requester scope, and startup refusal passed |
| Isolation and cleanup | Generated fixture resources removed; existing deployments were not operated on |

The evidence retains `local-artifact-runtime`, `provenanceVerified:false`, and `acceptedReleaseBaselineVerified:false`. Candidate platform manifest: `sha256:93cc17b9d9d03dda42a1a5c2cb42c69e7e2f3d7ad58a335b998aaadb14939723`. No new ARM64, live-provider/browser, or production-cutover proof is claimed.

## Validation

Focused checks passed: seven standalone probe tests, ten schema/continuity tests, seven acceptance tests, and fifteen smoke lifecycle tests. Independent review found no material blockers. `npm run validate:security` passed with zero reported npm vulnerabilities; this is not a comprehensive security audit.

Full `npm run validate` passed repository policies, lint, test hygiene, all 8,589 tests (3,635 server, 4,287 client, 512 script, 155 integration), and client/server builds. No tests failed, skipped, or were cancelled. Staged whitespace checks passed.

## PR review

All three open PRs were refreshed through GitHub MCP and their complete patches reviewed. PRs #23 and #24 propose action versions superseded locally. PR #40 is an unrelated Node-major change to a provider fixture. None was applicable, applied, or merged. The design records links and immutable heads.

## Next release item

Run the existing published-candidate acceptance path against registry digest references with verified build provenance and an explicitly reviewed release baseline. This local rehearsal refreshes packaged behavior evidence to 104 migrations; it cannot establish artifact origin or release acceptance. ARM64 execution and live provider/browser delivery remain separately scoped evidence.

September 13 published-gate follow-up: [readiness outcome](PUBLISHED_ACCEPTANCE_READINESS_OUTCOME.md) records the live CLI/registry access failures, empty accessible release list, and exact inputs required before published acceptance can proceed.
