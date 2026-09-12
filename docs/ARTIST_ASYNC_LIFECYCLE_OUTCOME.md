# Artist and album asynchronous lifecycle outcome

Date: September 12, 2026. Starting commit: `6db046a`.

## Implemented behavior

Album detail now clears and invalidates obsolete data on close, unmount, identity change, or a new load. Read success, failure, and finalization use generation checks; cancelling a read is an optimization rather than the correctness guarantee. A stale canonical-edition response cannot start an obsolete follow-up read.

Artist policy saves, manual edition selections, and reconciliation retries use a narrow per-instance ESM mutation-task composable. It gates callbacks by captured actor, artist identity, and view generation. Manual edition feedback additionally belongs to the open dialog context. A route/account change invalidates tasks and closes stale dialogs; account changes also invalidate current artist reads and trigger an actor-aware reload. Scoped feedback replaces the manual-edition helper's unscoped toast on this view.

The browser regression holds a completed server-fixture save response, navigates A to B to A, creates a fresh dirty draft, then delivers the old response. The fresh draft remains intact and saving remains available. This distinguishes presentation isolation from pretending the underlying write was cancelled.

The separate [design](ARTIST_ASYNC_LIFECYCLE_DESIGN.md) records official sources, alternatives, security boundaries, and the recommended stack.

## Validation

- Album lifecycle unit suite: 16 passed, including deferred old success/error, close/reopen, and canonical completion races.
- Artist mutation-task unit suite: five passed, covering navigation, actor change, disposal, duplicates/retries, and pending cleanup during follow-up reload.
- Final focused browser run: five scenarios passed in three suites, zero skips; artist A-B-A response isolation, album lifecycle, and normal policy Activity flow.
- Client/server production builds and scoped ESLint: passed.
- Security validation: passed, with zero reported npm vulnerabilities.
- `npm test`: passed repository lint/test hygiene and all 8,272 tests (3,428 server, 4,221 client, 500 scripts, 123 PostgreSQL integration); zero failures or skips. An obsolete source-shape assertion was removed after moving pending/error ownership into the composable; its public retry-action assertions remain, and the final full rerun passed.

## Local Docker walkthrough

Completed the documented build, health-wait restart, and one-shot bootstrap with existing saved environment, admin, and data retained. Local image ID: `sha256:2cbd713a3c61264d21f9f446f8a6541b538a1a5b6a8715ddd0d6e180cdc3def4`. The container is healthy at `http://127.0.0.1:47956`; `/healthz` returned HTTP 200.

Browser regression scenarios use controlled fixtures and rendered components. No live provider acquisition or public release publication was performed.

## PR disposition

GitHub MCP refreshed all open metadata and complete patches on September 12, 2026. No applicable patch remained to apply; none was merged.

| PR | Reviewed head | Finding |
| --- | --- | --- |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` | Fixture-only Node 26 upgrade diverges from retained Node 24 platform. |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` | Build/push 7.2 superseded by local 7.3. |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` | Metadata 6.1 superseded by local 6.2. |

## Limits and next recommendation

These changes address items 2 and 13 of the [artist review](ARTIST_DETAIL_REVIEW_2026_09.md). Submitted server writes may still complete after navigation; reopening the artist obtains server state. This is not server concurrency control, an undo mechanism, or a global pending-operation ledger. Authorization, CSRF, database transactions, and server revision contracts are unchanged.

Next implement item 3: contextual album-load errors and Retry, preserving album identity and accessible error announcements. The lifecycle guards now provide a safe basis for repeated attempts. Retain native ESM, narrow composables, native dialogs, captured response ownership, server-authoritative mutations, and deferred-response unit/browser tests.
