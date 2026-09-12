# Recipient-aware release request outcome

Date: September 12, 2026. Starting commit: `195b38d`.

## Implemented result

Requests for the same release now remain independent for different recipients. Same-recipient repeat clicks are suppressed while pending and after success; failed submissions become retryable. Implicit self and explicit selection of the current user share identity. Late completions update only their captured actor and recipient, and do not show a toast after the active actor changes.

A small native ESM identity helper owns tuple construction and self projections. The existing composable owns per-instance reactive pending/completed maps. Artist, Search, Activity releases, requester Home, and release-detail dialogs pass the selected recipient to status lookups as well as submission. Confirmation dialogs share parent-owned selection and clear stale errors when the recipient changes. Home and Activity also now pass the modal's actual loading, requested, and error-message prop names; their prior mismatches prevented pending locks and failure messages from working. Server authorization is unchanged.

The ambiguous tracklist requestState no longer disables recipient-specific requests. Existing server handling remains responsible for durable duplicate requests; this local state is not a cross-tab request ledger. See the [design and alternatives](RECIPIENT_REQUEST_IDENTITY_DESIGN.md).

## Validation

- Core request composable regression suite: 32 passed.
- `npm test`: passed lint/test hygiene and 8,260 tests (3,428 server, 4,209 client, 500 scripts, 123 PostgreSQL integration); zero failures/skips.
- Final `npm run test:client`: 4,209 passed after the final caller fixes.
- Final scoped ESLint and client/server production builds: passed.
- Three focused browser suites: six scenarios passed, zero failures/skips. Coverage includes recipient switching, self remaining available after another recipient's request, pending Submit/Cancel/Escape/recipient locks, and failure recovery retaining recipient selection.
- `npm run validate:security`: passed with zero reported npm vulnerabilities.

## Local Docker walkthrough

Rebuilt and restarted Compose using the documented walkthrough sequence, including its one-shot bootstrap. Existing admin, saved environment, and data were retained. Local image ID: `sha256:342706323f2c94058717876bc9e31195e6b95c7a51001213a3b380f6da587f87`. Container is healthy at `http://127.0.0.1:47956`; `/healthz` returned HTTP 200.

Browser tests used controlled fixtures with real rendered components. No live acquisition/provider request or public release publication was performed.

## Open PR review

GitHub MCP metadata and all complete patches were refreshed on September 12, 2026. No applicable patch remained to apply locally; none was merged.

| PR | Reviewed immutable head | Disposition |
| --- | --- | --- |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` | Fixture-only Node 24 to 26 major upgrade diverges from retained platform. |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` | Build/push 7.2 change superseded by locally pinned 7.3. |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` | Metadata 6.1 change superseded by locally pinned 6.2. |

## Limits and next recommendation

This fixes item 12 of the [artist review](ARTIST_DETAIL_REVIEW_2026_09.md). It does not resolve delayed tracklist loading or artist mutation projection races. Next implement items 2 and 13 together: guard async results by current album/artist generation, invalidate disposed views, and prove late responses cannot replace newer state. Add contextual Retry after establishing that lifecycle.

Retain native ESM, modular helpers/composables, existing native dialogs, server-authoritative authorization, and behavioral unit/browser coverage. No dependency, schema, endpoint, or permission changes were needed.
