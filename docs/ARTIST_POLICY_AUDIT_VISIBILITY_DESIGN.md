# Artist Policy Audit Visibility Design

## Context

Artist Detail policy saves can repair or clear ambiguous track overrides, change release selections, and queue reconciliation. Before this change, the save result was visible in the current Artist Detail projection but did not leave a concise operator-facing activity entry for later review.

## Official Source Review

- OWASP Logging Cheat Sheet: application logging should include security and operational events, record enough "when, where, who, and what" context, and avoid logging excessive or sensitive data.
- OWASP Authorization Cheat Sheet: authorization must be enforced server-side for protected actions and should fail closed.
- Express production security best practices: keep route surfaces small, validate inputs, and avoid leaking internal implementation details.
- PostgreSQL constraints documentation: named check constraints are appropriate for bounded enum-like values and can be changed by dropping and re-adding the constraint.
- Vue computed-property guidance: derive display copy from state instead of storing duplicate presentation state.
- Playwright locator guidance: browser verification should prefer user-visible semantics and stable locators over implementation details.

Reviewed URLs:

- https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- https://expressjs.com/en/advanced/best-practice-security/
- https://www.postgresql.org/docs/current/ddl-constraints.html
- https://vuejs.org/guide/essentials/computed.html
- https://playwright.dev/docs/locators

## Options Considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Add a dedicated `operator_artist_policy_audit` table | Strong long-term forensic model; can store full diffs and retention independently | New read route, schema, UI, retention policy, and access-control surface; duplicates the existing Activity feed for this slice | Defer |
| Emit a structured `artist_policy_saved` activity event from the existing save boundary | Uses existing authenticated Activity read path; append-only; visible to operators immediately; low schema blast radius | Activity feed is summary-oriented, not a complete forensic log | Selected |
| Return save-summary-only UI state without persistence | No schema change | Loses the audit trail on reload; does not help later operator review | Rejected |

## Final Recommendation Stack

- Use the existing Artist Policy save endpoint as the only mutation boundary.
- Compute a bounded before/after summary inside `operator-artist-save-service.js` using the previous persisted policy and the normalized incoming draft.
- Persist only an append-only `activity_events` row with event type `artist_policy_saved` after transaction commit.
- Store counts and stable IDs in `extra_payload`; avoid raw request bodies, filesystem paths, user notes, or full track lists.
- Keep UI presentation as derived client code: label, detail summary, and a link back to Artist Detail when the MusicBrainz artist id is available.
- Preserve existing authorization, fresh-session, and CSRF behavior. No new mutation route is introduced.

## Implemented Outcome

- Added `artist_policy_saved` to the `activity_events.event_type` check constraint through migration `20260627_135354_add_artist_policy_activity_event.sql`.
- Added `operator-artist-policy-change-summary.js` as a pure server helper for bounded save summaries.
- Updated Artist Policy save orchestration to read previous monitoring, release selections, and track overrides inside the save transaction.
- Activity events now include monitoring field counts, release-selection changes, track-override changes, repaired review counts, cleared stale-review counts, snapshot revision, reconciliation run id, and Artist Detail deep-link metadata.
- Activity feed presentation now renders concise operator copy and links back to Artist Detail.

## Security Notes

- The activity event is emitted after commit and cannot roll back or fail the policy save.
- The event payload is intentionally summary-level. It does not persist the full draft, raw request body, file paths, or sensitive session data.
- The existing route remains protected by fresh session and CSRF. The Activity feed remains behind authenticated session access.
- The database still rejects unknown activity event types through a check constraint.

## Follow-Up

The saved policy Activity trail browser verification is complete. Operators can
repair a reviewed track override, save policy, open Activity, confirm the
`artist_policy_saved` entry, and use the feed link to return to Artist Detail.
See `ARTIST_POLICY_ACTIVITY_TRAIL_BROWSER_VERIFICATION_DESIGN.md`.
