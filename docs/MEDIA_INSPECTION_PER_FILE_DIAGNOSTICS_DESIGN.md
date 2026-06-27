# Media Inspection Per-File Diagnostics

## Context

Import Review run-detail deep links now load failed historical runs, but media
inspection detail was still aggregate-only. Operators could see warning and
unavailable counts without knowing which candidate file caused the warning.

This slice persists bounded per-file media inspection diagnostics in the
operation-run read model and renders them in the selected media inspection run
panel.

## Official Sources Reviewed

- [PostgreSQL JSON Types](https://www.postgresql.org/docs/current/datatype-json.html):
  `jsonb` is appropriate for structured document data that benefits from binary
  storage and normalization.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html):
  logs/diagnostics should avoid excess sensitive data and should be bounded.
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html):
  server-side authorization remains the access boundary; client route state only
  selects data to request.
- [MDN ARIA `status` role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/status_role):
  advisory status content should be perceivable without interrupting the user.
- [Playwright locators](https://playwright.dev/docs/locators):
  browser verification should use role/text locators that match the visible,
  accessible surface.

## Recommendations

1. Persist per-file diagnostics in `operation_runs.summary.inspectionDiagnostics`
   rather than creating a new table for this slice.
2. Normalize the diagnostic payload at write and read boundaries.
3. Store only bounded operator-useful fields:
   candidate ID, source user, source folder, file ID, filename, warning code,
   and warning message.
4. Do not persist raw probe output, full ffprobe payloads, or unbounded metadata.
5. Render diagnostics in a named table in the media inspection panel so operators
   can scan file/user/warning context.
6. Keep route access unchanged: admin-only run-detail endpoints continue to
   enforce access server-side.

## Pros And Cons

| Option | Pros | Cons |
| --- | --- | --- |
| Store diagnostics in existing operation-run `summary` JSONB | No migration, already retained with run history, direct fit for run-scoped diagnostics | Not ideal for cross-run querying |
| Add a dedicated diagnostics table | Strong relational model for querying and indexing | More schema and store surface than this UI read path currently needs |
| Persist raw media probe output | Maximum forensic detail | High data-volume and privacy risk; poor UI payload |
| Persist bounded warning summaries | Actionable and safe for operator UI | Future deep forensic views may need a richer source |

## Final Stack

- `import-candidate-media-inspection-diagnostics.js` for write/read
  normalization and payload caps.
- `import-candidate-media-inspection-worker.js` to build diagnostics from the
  existing apply-preview inspection warning data.
- `import-candidate-media-inspection-run-store.js` to normalize persisted
  diagnostics from `operation_runs.summary`.
- `ImportCandidateMediaInspectionDiagnostics.vue` to render the file-level
  diagnostics table.
- Focused server, route, and browser verification.

## Implementation Outcome

- Added bounded diagnostics normalization:
  - max 100 diagnostic rows per run summary;
  - capped string lengths;
  - malformed/empty warning rows dropped;
  - raw probe output excluded.
- Media inspection worker now persists `inspectionDiagnostics` alongside the
  existing aggregate counts on successful run completion.
- Media inspection run store now returns `inspectionDiagnostics` for current,
  recent, and historical run reads.
- Media inspection panel now renders a `Media inspection file diagnostics` table
  for selected runs with file, source user, source folder, formatted diagnostic
  code, and warning message.
- Browser coverage now proves a selected-run URL displays per-file diagnostics.

## Security Notes

This does not add a new endpoint or broaden access. The existing admin-only
media inspection summary/detail routes remain the server-side authorization
boundary. The persisted payload intentionally excludes raw probe output and
stores only bounded warning summaries needed for operator action.

## Validation

- `node --test test/server/import-candidate-media-inspection-diagnostics.test.js`
- `node --test test/server/import-candidate-media-inspection-worker.test.js`
- `node --test test/server/import-candidate-media-inspection-summary-service.test.js`
- `node --test test/server/import-candidate-routes.test.js`
- `npm run build:client`
- `node --test --test-concurrency=1 test/browser/import-review-media-inspection-per-file-diagnostics-browser-verification.test.js`

## Next High-Value Item

Import Review diagnostic row handoff to candidate detail. The diagnostics table
now shows the affected candidate/file, but the row is not yet a direct handoff
back to the Import Review candidate detail panel. Adding a route-state handoff
would let operators move from a run diagnostic to the exact candidate review
context without manually searching the queue.
