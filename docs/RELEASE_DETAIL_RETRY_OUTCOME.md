# Release detail error recovery outcome

Date: September 12, 2026. Starting commit: `caaa31e`.

## Implemented result

A failed release-detail read now preserves the album hero and displays a contextual failure with Retry. Retry repeats the exact failed album/edition GET through the existing lifecycle guards. It does not repeat successful writes or acquisition requests. Blank error messages remain visible failures and retryable.

The recovery UI lives in a separate Vue component. Loading and error announcements use distinct persistent regions. Retry stays mounted while pending, suppresses duplicate activation, and retains focus. On success, focus returns to Close only when Retry still owned it; user-moved focus is preserved. Close/reopen invalidates obsolete recovery callbacks. Read diagnostics are not rendered as UI text.

See the [design](RELEASE_DETAIL_RETRY_DESIGN.md) for current official sources, alternatives, and recommended stack.

## Validation

- Release-detail composable suite: 22 passed, including exact edition replay, duplicate suppression, cancellation, canonical-read recovery, and blank errors.
- Final browser run: six scenarios passed in two suites, zero skips. Coverage includes safe error text, repeated failure, pending focus, duplicate activation, success announcements, user-moved focus, and close/reopen response isolation, plus existing release-detail workflows.
- `npm run build`: client/server production builds passed.
- Scoped ESLint and security validation passed; npm audit reported zero vulnerabilities.
- `npm test`: repository lint/test hygiene and all 8,278 tests passed (3,428 server, 4,227 client, 500 scripts, 123 PostgreSQL integration); zero failures or skips.
- ESM consistency and copyright compliance checks: passed.

## Local Docker walkthrough

Rebuilt and restarted the walkthrough using its documented build, health wait, and one-shot bootstrap sequence. Existing saved environment, admin, and data were retained. Local image ID: `sha256:b38babb60dd92a4d1ebfe73342682436159acfccbad3d96fd370ccc10ec01975`. Container healthy at `http://127.0.0.1:47956`; `/healthz` returned HTTP 200. No public image/release publication or live provider acquisition was performed.

## Open PR review

GitHub MCP refreshed metadata and complete patches for all open PRs on September 12, 2026. None was applicable, applied, or merged.

| PR | Reviewed immutable head | Disposition |
| --- | --- | --- |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` | Fixture-only Node 26 major upgrade diverges from retained Node 24 platform. |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` | Build/push 7.2 superseded by local 7.3. |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` | Metadata 6.1 superseded by local 6.2. |

## Limits and next recommendation

This addresses item 3 of the [artist review](ARTIST_DETAIL_REVIEW_2026_09.md). Explicit Retry does not fix persistent provider outages or change canonical-write and acquisition-error workflows. Browser tests use controlled failures, not live provider outage simulation.

Next implement item 4: expose editions beyond the first six, with bounded expansion or an accessible selector. Preserve the selected edition and keyboard navigation, and distinguish the supplied edition page from a complete remote catalog. Broader catalog pagination remains item 14.
