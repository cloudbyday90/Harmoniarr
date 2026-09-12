# Artist read and recovery outcome

Date: September 12, 2026. Starting commit: `5c0e0ed`.

## Implemented result

Artist and monitored-artist projections no longer enqueue reconciliation. They return persisted failed, pending, and running state and retain `recovery: null` for compatibility. The old projection recovery orchestrator is removed. The existing protected manual Retry POST remains available.

Automatic recovery now runs from the existing operation dispatcher, independent of navigation. A modular sweep considers up to ten failures per minute after a sixty-second age threshold. A separate store rechecks eligibility transactionally, skips disabled accounts and cancelled/active/already-recovered work, coordinates with artist saves and queue commands, and inserts one recovery plus its audit record atomically. A failed recovery is not automatically retried again. Busy locks are skipped after a short timeout; failed candidates do not prevent other candidates or ordinary queued operations from progressing.

Guarded UUID comparisons preserve identity across equivalent historical spellings and skip malformed summaries. No frontend component, new queue infrastructure, or database schema was introduced. See the separate [design, official research, and tradeoffs](ARTIST_READ_RECOVERY_DESIGN.md).

## Verification

- Three focused projection tests passed, including repeated/concurrent reads with zero recovery calls.
- A PostgreSQL route regression passed: seven GETs preserve failed rows and produce no recovery audit calls; a missing-CSRF retry is denied and the explicit protected POST queues `manual_retry`. Its actor/CSRF test doubles are explicit; the repository's broader integration suite covers real authentication/session behavior.
- Ten focused PostgreSQL recovery tests passed, including concurrent sweeps/restart, one recovery limit, audit rollback, active/manual work, cancellation, disabled accounts, absent snapshots, bounded lock waiting, equivalent UUID spellings, and malformed summaries.
- Dispatcher/sweep tests cover maintenance readiness before recovery, cooldown/batch bounds, error reporting, and continuing after individual candidate failures. Startup wiring is tested.
- Six browser scenarios passed in two suites, zero skips. Loading failed state sends no recovery POST; keyboard activation of the native **Retry update** button sends one CSRF-protected request and displays queued status. Existing artist and release-modal workflows also pass.
- Security validation passed with zero npm audit vulnerabilities.
- `npm run validate` passed copyright, migration policy, schema snapshot, ESM, image/Compose policy, repository lint/test hygiene, all 8,315 tests, and client/server production builds. Totals: 3,439 server, 4,236 client, 500 scripts, and 140 PostgreSQL integration tests; zero failures or skips.

## Local Docker walkthrough

Rebuilt and restarted using the documented Compose build, health wait, and one-shot bootstrap sequence. Saved environment, downloads mount, admin, and application data were retained. Local image ID: `sha256:8ed90567bea21e2dff218e0c5de009d97826f936d252bca578f7b7386096734f`. The container is healthy at `http://127.0.0.1:47956`; `/healthz` returned HTTP 200. This verifies local startup, not a public image publication or live provider acquisition result.

## Open PR review

GitHub MCP refreshed metadata and complete patches for all three open PRs on September 12, 2026. None was applicable, applied, or merged.

| PR | Reviewed immutable head | Disposition |
| --- | --- | --- |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` | Fixture-only Node 26 upgrade diverges from the retained Node 24 platform. |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` | Build/push 7.2 superseded by local 7.3. |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` | Metadata 6.1 superseded by local 6.2. |

## Limits and next recommendation

This completes item 6 of the [artist review](ARTIST_DETAIL_REVIEW_2026_09.md). Background recovery can now process eligible historical failures without opening their pages. Batch size and cadence are bounded; query cost on a very large operation history is not benchmarked. Persistent contention can delay candidates. Existing maintenance and administrative-restore coordination limits remain; no exactly-once provider effect or full accessibility conformance is claimed.

Next prioritize item 7: strict track-override identity validation. Replace permissive numeric parsing with safe-integer validation and enforce valid recording/track identifiers, while preserving legitimate nullable fields. Test suffixes, fractions, overflow, malformed UUIDs, and valid overrides before persistence.
