# Artist save revision outcome

Date: September 12, 2026. Starting commit: `035548f`.

## Implemented result

Artist saves now require a non-negative safe-integer expected revision. Missing, null, or malformed values fail with 400 before connecting to the database. Initial saves explicitly use zero; stale saves return the existing 409 conflict without replacing policy, selections, overrides, snapshots, or queued reconciliation work.

Revision validation is shared with manual edition saves in a small ESM policy module. A separate save-state store serializes each operator/artist transaction before reading state. Its lock canonicalizes UUID spellings in PostgreSQL. It handles canonical bigint strings from the database driver without weakening numeric API validation. Existing transaction and server authorization boundaries remain in place.

The client sends explicit revisions. Add Artist is create-only and directs conflicts to Artist Detail. Artist Detail distinguishes a loaded empty snapshot from missing or malformed revision data. Conflict feedback preserves unsaved edits, explains review/reload, and does not silently refresh or resubmit the draft.

See the [design](ARTIST_SAVE_REVISION_DESIGN.md) for official September 2026 research, alternatives, pros/cons, the recommended stack, and administrative-restore limits.

## Verification

- Fifty-one focused backend service, route, and store tests passed, including rejected revisions before connection and PostgreSQL bigint normalization.
- Six real PostgreSQL integration tests passed, zero skips. Tests exercise the actual PUT adapter with a known-session test double and real save service for 400 responses; they prove concurrent initial and existing saves yield one winner and one 409, no partial state, correct queued work, sequential updates, and equivalent UUID spellings sharing a lock. These focused adapter tests do not replace the repository's session/CSRF integration coverage.
- Client focused tests, scoped lint, and client build passed.
- Eight browser scenarios passed in three suites, zero skips. New conflict coverage verifies the submitted original revision, retained edits, announced guidance, and no automatic GET/PUT. Existing artist lifecycle, release dialog, and Retry workflows also pass.
- Dependency security validation passed with zero npm audit vulnerabilities.
- `npm run validate` passed copyright, migration policy, schema snapshot, ESM, image/Compose policy, repository lint/test hygiene, all 8,302 tests, and client/server production builds. Test totals: 3,437 server, 4,236 client, 500 scripts, and 129 PostgreSQL integration; zero failures or skips. A final test-fixture cleanup was rechecked with its focused suite and ESLint.

## Local Docker walkthrough

Rebuilt and restarted using the documented Compose build, health wait, and one-shot bootstrap sequence. Existing saved environment, downloads mount, admin, and application data were retained. Local image ID: `sha256:2132b5f9e2eeb210ffb70ca1a5716d6bd5ebeccb733ccf3f0dffdba2302f4bf0`. The container is healthy at `http://127.0.0.1:47956`; `/healthz` returned HTTP 200. This establishes local startup, not a public image release or live provider acquisition result.

## Open PR review

GitHub MCP refreshed metadata and complete patches for all three open PRs on September 12, 2026. None was applicable, applied, or merged.

| PR | Reviewed immutable head | Disposition |
| --- | --- | --- |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` | Node 26 fixture-only upgrade diverges from the retained Node 24 platform. |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` | Build/push 7.2 is superseded by local 7.3. |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` | Metadata 6.1 is superseded by local 6.2. |

## Limits and next recommendation

This completes item 5 of the [artist review](ARTIST_DETAIL_REVIEW_2026_09.md) for canonical artist saves. Old callers omitting revisions now receive validation errors. Administrative restore operations still need separate revision/maintenance coordination; no guarantee against concurrent restore is claimed. No automatic draft merge is attempted.

Next prioritize item 6: remove reconciliation queue side effects from artist GET projections. Move automatic recovery to durable worker processing and keep deliberate recovery on the protected POST. Acceptance should prove repeated reads create no jobs and worker recovery remains deduplicated. Track administrative restore coordination alongside that write-boundary work.
