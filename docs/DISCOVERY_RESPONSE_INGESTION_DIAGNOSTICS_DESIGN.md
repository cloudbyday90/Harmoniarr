# Discovery Response Ingestion Diagnostics Design

Status: Implemented
Date: 2026-06-28

## Problem

slskd can return search responses while Harmoniarr still creates zero Import
Review candidates. Before this change, the persisted discovery evidence only
said `candidateCount: 0` and `fileCount: 0`, which left operators unable to
tell whether the provider returned no responses, every response came from an
ignored uploader, files matched blocked title terms, or provider payloads could
not be normalized.

This was visible in local Docker testing: slskd logs showed completed Lauren
Daigle searches with responses, but Harmoniarr had no Import Review candidates
or Downloader activity.

## Researched Guidance

- OWASP Logging Cheat Sheet: application logs and diagnostic events should
  contain enough operational context for debugging and monitoring, while
  excluding or sanitizing sensitive data such as tokens, secrets, personal data,
  and file paths. Source:
  https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- PostgreSQL JSON functions: `jsonb_build_object` is the right fit for typed,
  structured evidence writes, and `jsonb_strip_nulls` removes absent diagnostic
  fields cleanly. Source:
  https://www.postgresql.org/docs/current/functions-json.html
- Playwright locators: UI verification should prefer user-visible, accessible
  locators when this evidence is promoted into browser coverage. Source:
  https://playwright.dev/docs/locators
- Docker bind mounts: path visibility between external slskd and Harmoniarr
  still depends on container-visible bind mounts; diagnostics should not expose
  host paths. Source:
  https://docs.docker.com/engine/storage/bind-mounts/

## Options Considered

1. Persist raw slskd responses in discovery evidence.
   - Pros: Maximum forensic detail.
   - Cons: Exposes usernames, remote paths, filenames, and potentially large
     provider payloads in a broad read model.

2. Add a new diagnostics table keyed by search id.
   - Pros: Durable and queryable history.
   - Cons: Requires schema work for a first diagnostic pass and duplicates the
     existing discovery evidence read path.

3. Persist bounded aggregate diagnostics under
   `library_discovery_requests.evidence.lastSearchResult.ingestionDiagnostics`.
   - Pros: Uses the existing dispatch evidence path, keeps the UI unchanged
     structurally, avoids raw provider payloads, and supports immediate Wanted
     visibility.
   - Cons: Retains only latest-search diagnostics, not full history.

## Final Recommendation

Use option 3.

The implemented stack:

- `import-candidate-ingest-diagnostics.js` provides bounded, provider-specific
  aggregate diagnostics.
- `normalizeSlskdResponsesToImportCandidatesWithDiagnostics()` preserves the
  existing candidate normalization behavior while returning reason counts.
- `import-candidate-service.js` returns `ingestionDiagnostics` from slskd
  ingestion without changing the older array-returning normalization export.
- `library-discovery-dispatch-service.js` forwards diagnostics into discovery
  success evidence when present.
- `library-discovery-request-store.js` persists diagnostics inside
  `lastSearchResult` via typed JSONB placeholders.
- `wanted-release-normalization.js` renders zero-candidate diagnostics as
  operator-readable Wanted row messages and aggregate details.

## Diagnostic Contract

The evidence is intentionally bounded:

- `responseCount`
- `responseFileCount`
- `filteredResponseCount`
- `filteredFileCount`
- `ignoredUserResponseCount`
- `blacklistedFileCount`
- `missingUsernameResponseCount`
- `malformedFileCount`
- `candidateCount`
- `fileCount`
- `reasonCodes`

It intentionally excludes:

- API keys and provider credentials
- raw slskd responses
- usernames
- filenames
- remote paths
- host/container path mappings

## Security Outcome

The design follows a least-disclosure diagnostic model. Operators get enough
information to understand why a search produced no candidates, while sensitive
provider and filesystem details stay out of discovery evidence and Wanted rows.

## Validation

- `node --test test/server/import-candidate-service.test.js`
- `node --test test/server/library-discovery-request-store.test.js test/server/library-discovery-dispatch-service.test.js`
- `node --test test/client/wanted-release-normalization.test.js`
- `npm run lint:server`

## Follow-Up

The next high-value item is **import candidate auto-selection and download
handoff readiness**: when diagnostics show candidates are produced, the operator
still needs a clear path from best candidate selection to Downloader enqueue,
including why a candidate was not auto-selected when scoring is ambiguous.
