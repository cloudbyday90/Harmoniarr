# Requester-Safe Import-Candidate Detail Contract

## Scope

This phase hardens the requester-visible import-candidate read surface:

- `GET /api/v1/import-candidates`
- `GET /api/v1/import-candidates/:importCandidateId`

The work preserves the existing ownership check for non-admin users and adds a
role-aware projection so requester responses no longer expose operator review
diagnostics, peer identity, folder paths, raw source payloads, file names,
internal object identifiers, or request ownership user IDs.

Preview and apply-preview responses remain out of scope for this phase. They
are separate path-planning contracts and should receive their own requester-safe
decision before becoming requester-facing.

## Official Research Baseline

Research was refreshed against official sources on June 6, 2026, for the
requested May 2026 decision point.

- OWASP API Security Top 10 2023, API1 Broken Object Level Authorization:
  https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/
- OWASP API Security Top 10 2023, API3 Broken Object Property Level
  Authorization:
  https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/
- OWASP Web Security Testing Guide, Testing for Excessive Data Exposure:
  https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/12-API_Testing/03-Testing_for_Excessive_Data_Exposure
- OWASP Authorization Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- NIST Privacy Framework materials, October 2024 workshop deck:
  https://www.nist.gov/system/files/documents/2024/10/29/Day1_PM_combined.pdf

The relevant guidance is consistent:

- Object ID endpoints need server-side object-level authorization.
- Authorization must apply at the property level, not only at the object level.
- API responses should be shaped by explicit allowlists rather than generic
  object serialization.
- UI hiding is not a security boundary because raw API traffic remains visible.
- Returned data should be the minimum needed for the business purpose.

## Current Risk

Before this phase, requesters could only read import candidates tied to their
own delegated request, but the successful list and detail responses still used
operator-grade candidate objects. Those objects included fields such as:

- `id`
- `username`
- `folderPath`
- `sourceSearchId`
- `sourceResponseKey`
- `rawPayload`
- `normalizedPayload.requestOwnership`
- `selectionReason`
- `files`
- `uploaderReputation`

That was acceptable for admin import review but too broad for a requester
progress surface. Ownership was correct, while field-level minimization was not.

## Options

### Option A: Close Import-Candidate Read Endpoints to Requesters

Pros:

- Smallest exposure surface.
- Clear separation between requester journey and admin import review.

Cons:

- Breaks any current requester diagnostics that rely on owned candidate reads.
- Provides no migration path for future requester progress drill-downs.
- Still requires a separate requester progress projection elsewhere.

### Option B: Keep Owned Requester Reads Operator-Rich

Pros:

- No compatibility break for existing responses.
- Admin and requester payloads remain identical.

Cons:

- Conflicts with OWASP property-level authorization guidance.
- Exposes peer names, remote folder paths, file names, raw payloads, and user ID
  ownership metadata to requesters.
- Relies on UI routing to hide data that remains available in raw API traffic.

### Option C: Hide Sensitive Fields in the Client

Pros:

- Low code change.
- Keeps backend response shapes unchanged.

Cons:

- Explicitly conflicts with OWASP testing guidance for excessive data exposure.
- Does not protect API clients, browser network tools, logs, or future client
  regressions.

### Option D: Role-Aware Server Projection

Pros:

- Keeps existing object-level authorization and adds property-level
  minimization.
- Preserves full admin diagnostics without exposing them to requesters.
- Gives requesters stable, generic source labels aligned with the request
  journey.
- Is testable with direct route and database-backed integration coverage.

Cons:

- Introduces separate response contracts by role.
- Requires future requester features to use the minimal projection or define a
  new safe endpoint instead of reusing admin objects.

## Final Recommendation Stack

Use Option D.

1. Keep the existing non-admin ownership policy:
   requesters may only read candidates whose request ownership targets their
   user ID.
2. Add a pure server projection module at
   `src/server/import-candidates/import-candidate-read-projection.js`.
3. Preserve full import-candidate objects only for `admin` sessions, matching
   the current route authorization model.
4. Return requester-safe list rows with:
   - `sourceKey`
   - `sourceLabel`
   - `sourceProvider`
   - `status`
   - `fileCount`
   - `totalSizeBytes`
   - `formats`
   - `discoveredAt`
   - `updatedAt`
5. Return the same minimal detail shape for requester detail reads, using
   `sourceLabel: "Source"` because a direct detail request has no list index.
6. For requester list responses, retain safe pagination and `status` filter
   context only. Do not echo request ownership IDs, peer filters, folder
   filters, or internal search keys.
7. Skip uploader reputation enrichment for requester reads. Reputation is an
   operator trust signal and should not be fetched or attached to requester
   payloads.

## Outcome

The implementation now:

- keeps admin import review responses unchanged;
- keeps non-admin reads scoped to owned import candidates;
- projects non-admin list rows as `Source N` summaries;
- projects non-admin detail responses as a generic `Source` summary;
- omits candidate IDs, peer usernames, folder paths, files, raw payloads,
  normalized ownership metadata, internal search keys, selection reasons,
  locked-file counts, download attempt counts, and uploader reputation from
  requester responses;
- avoids reputation enrichment work for requester reads;
- updates route and integration tests to prove the minimized contract and the
  hidden-candidate `404` behavior.

## Security Notes

- Object-level authorization remains centralized in
  `import-candidate-visibility.js`.
- Field-level authorization is enforced on the server before JSON response
  serialization.
- The requester contract intentionally does not return the import-candidate ID.
  The ID is an operator workflow identifier, not a requester progress
  requirement.
- The requester contract does not return file names or paths because they can
  disclose source library structure and media collection details.
- No schema, mutation, external service, or permission expansion was added.

## Next High-Value Design Areas

1. **Retry-aware journey messaging.** Distinguish an abandoned source from
   `trying another source` when a failed candidate is replaced, and ensure stale
   transfer progress does not look like an active failure.
2. **Importing-stage freshness and explanation.** Extend safe observed-age
   language to validation, scan, transcode, post-apply scan, and quarantine
   progress without exposing filesystem or exception detail.
3. **Requester-scoped transfer actions.** Design cancel, retry, and requeue
   actions with per-request authorization, idempotency, rate limits, and audit
   events before exposing any requester mutation.

## Phase 18 Update

`REQUESTER_SAFE_IMPORT_CANDIDATE_PREVIEW_CONTRACTS_DESIGN.md` completes the
requester-safe preview/apply-preview decision. The HTTP endpoints are now
admin-only because they expose path-planning and file-inspection diagnostics
that requesters do not need.
