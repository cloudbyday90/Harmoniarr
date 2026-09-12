# Request lifecycle Activity design

Design date: 2026-09-12. Harmoniarr is a Docker-first music library manager using Node 24 native ESM, PostgreSQL 18, and Vue. This slice restores the cancellation/reassignment Activity events identified in the previous release review.

## Problem and boundaries

The request service emits `request_cancelled` and `request_reassigned`, but the Activity service and database CHECK constraint reject both. The household feed consequently omits those successful actions. Existing request history and restricted audit records retain the operations.

Register both types and extend the constraint in a forward-only transactional migration. Use a small shared ESM policy for generic presentation and explicit public-field projection. Apply that projection on write, on feed read, and during client normalization. Household events contain event/request/actor identifiers and time, but no title, artist, reason, notes, provider URL, or extra payload. Keep detailed history behind existing request authorization. The link opens the viewer's scoped requests list rather than directing unrelated household viewers to inaccessible detail pages.

Preserve the existing best-effort Activity delivery contract. This change does not promise atomic exactly-once delivery, reconstruct previously dropped events, or redesign cancellation/reassignment concurrency. Those require a separate transactional/outbox design. A cancellation event describes request intent and does not claim downloaded media deletion or completed transfer cancellation.

A narrow publisher helper protects successful mutations from optional callback failures, including synchronous exceptions, rejected promises, void returns, and unresolved promises. The shared projection runs before callback invocation so custom publishers also receive only the public shape. Existing restricted audit/history handling remains a separate boundary.

## Research and tradeoffs

Official URLs were discovered through web search/MCP on September 12, 2026.

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Add enum strings alone | Small patch | Misses privacy, presentation, and cross-layer regression coverage | Insufficient |
| Generic household event plus authorized detailed history | Restores visibility with minimal disclosure | Less context in the household timeline | Recommended |
| Put full request/audit payload in Activity | Rich immediate detail | Household audience is broader than request-detail authorization | Reject |
| Transactional outbox for all Activity | Can make delivery recoverable and deduplicated | Requires lifecycle transaction redesign and rollout beyond this defect | Separate follow-up |

OWASP recommends excluding secrets and sensitive data from logs and matching recorded detail to its audience. This supports an explicit allowlist rather than copying audit payloads. [Logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).

PostgreSQL CHECK constraints enforce allowed values on persisted rows; replacing a constraint also requires validating retained data and considering locks. Preserve every existing event type and add real database tests. The expansion validates retained rows in the same transaction, so deployment must allow its table lock; this is not an online migration promise. [ALTER TABLE](https://www.postgresql.org/docs/18/sql-altertable.html).

W3C distinguishes status announcements from focus changes. Use the existing native link and timeline behavior, meaningful event text, and no focus movement on background refresh. This slice introduces no custom feed keyboard model or additional live region. [Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages).

The ARIA feed pattern describes dynamic article loading and keyboard/focus behavior beyond this bounded timeline. Preserve native lists and links rather than adding that role. [W3C feed pattern](https://www.w3.org/WAI/ARIA/apg/patterns/feed/).

## Validation and outcome

Cover service registration and privacy on both read/write boundaries, generic labels/icons/links, the actual database constraint, and real authenticated cancellation/reassignment routes feeding the household endpoint. Verify denied/no-op mutations do not generate success events and unrelated viewers cannot use Activity to bypass request-detail permissions. Refresh the schema snapshot through repository tooling and run full validation.

The separate [outcome document](REQUEST_LIFECYCLE_ACTIVITY_OUTCOME.md) records implementation, tests, PR disposition, limitations, and the next recommendation stack.
