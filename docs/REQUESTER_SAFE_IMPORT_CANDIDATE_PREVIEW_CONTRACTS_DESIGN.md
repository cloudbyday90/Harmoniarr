# Requester-Safe Import-Candidate Preview Contracts

## Scope

This phase covers the HTTP read contracts for:

- `GET /api/v1/import-candidates/:importCandidateId/preview`
- `GET /api/v1/import-candidates/:importCandidateId/apply-preview`

The underlying preview services remain operator-grade planning services used by
admin import review, apply workers, media inspection, transcode planning, and
status summaries. This phase changes the requester-facing API boundary, not the
internal planning service semantics.

## Official Research Baseline

Research was refreshed against official sources on June 6, 2026.

- OWASP API Security Top 10 2023, API1 Broken Object Level Authorization:
  https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/
- OWASP API Security Top 10 2023, API3 Broken Object Property Level
  Authorization:
  https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/
- OWASP Web Security Testing Guide, Testing for Excessive Data Exposure:
  https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/12-API_Testing/03-Testing_for_Excessive_Data_Exposure
- OWASP Authorization Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- NIST Privacy Framework:
  https://www.nist.gov/privacy-framework/privacy-framework
- NIST Disassociability guidance:
  https://www.nist.gov/node/1630826

The relevant current guidance is:

- endpoints that accept object identifiers must authorize access before
  returning object data;
- property-level authorization is distinct from object-level authorization;
- APIs should not serialize internal objects and rely on the client to hide
  sensitive fields;
- deny-by-default and least privilege should be applied when exposing new
  resources;
- processing should avoid associating people, devices, and events beyond the
  operational requirement.

## Current Risk

After the requester-safe list/detail phase, owned non-admin import-candidate
list and detail reads return minimal `Source` summaries. The preview endpoints
still accepted owned requester candidates and returned operator-grade planning
objects. Those objects can include:

- source folder paths and resolved download paths;
- staging root and staging preview paths;
- library root, user root, configured user roots, and destination paths;
- file IDs, file names, source paths, staging paths, and library paths;
- collision and missing-source status by file;
- media inspection metadata and transcode planning detail;
- saved operator file decisions.

This is appropriate for admin import review. It is not required for the
requester journey, which already receives safe request pipeline and progress
projections.

## Options

### Option A: Keep Owned Requester Preview Access

Pros:

- No HTTP compatibility change.
- Requesters could inspect the same planning details as admins for their own
  request-owned candidates.

Cons:

- Conflicts with API property-minimization guidance.
- Exposes filesystem layout, staging behavior, target library paths, file
  names, collision state, inspection metadata, and internal decisions.
- The requester UI does not need this data because requesters are routed away
  from import review.

### Option B: Add Requester-Safe Preview Projections

Pros:

- Keeps a future extension point for requester drill-downs.
- Could expose high-level readiness such as `ready`, `blocked`, or
  `attention`.

Cons:

- Most safe data already exists in the request journey and import-candidate
  read projection.
- Requires a second projection for path-planning contracts whose raw internals
  are not requester-facing.
- Risks semantic drift between a "safe preview" and the real admin preview.

### Option C: Make Preview HTTP Endpoints Admin-Only

Pros:

- Matches the current UI boundary: import review is admin diagnostic space.
- Avoids exposing path-planning and file-inspection data to requesters.
- Preserves internal services for workers and admin summaries.
- Uses an explicit deny-by-default boundary before candidate lookup and before
  expensive preview planning.

Cons:

- Any external requester client that directly called these endpoints will now
  receive `403 admin_required`.
- Future requester preview features would need a purpose-built safe endpoint.

## Final Recommendation Stack

Use Option C.

1. Require admin sessions before serving preview and apply-preview HTTP
   endpoints.
2. Do not load candidates or run preview planning for non-admin sessions.
3. Keep the existing internal preview and apply-preview service contracts
   unchanged for admin import review and background operations.
4. Keep requester progress on the request journey and requester-safe
   import-candidate list/detail projections, not on path-planning previews.
5. Update route inventory to classify both endpoints as admin read routes.
6. Add route tests that prove non-admin sessions receive `403 admin_required`
   and preview services are not called.

## Outcome

The implementation now:

- makes both preview endpoints admin-only at the route boundary;
- preserves admin preview and apply-preview response shapes;
- avoids candidate lookup for non-admin preview attempts;
- avoids preview/apply-preview planning work for non-admin requests;
- updates the route inventory access classification;
- keeps requester import-candidate read access limited to the minimal `Source`
  list/detail projections from the previous phase.

## Security Notes

- The route checks admin access before object lookup, reducing object probing
  and expensive path-planning work.
- The admin-only contract avoids returning paths, file names, media inspection
  metadata, collision state, source file reachability, or saved file decisions
  to requesters.
- No schema, mutation, external service, or permission expansion was added.
- Future requester drill-downs should use a separate response contract derived
  from request progress, not from admin path-planning objects.

## Next High-Value Design Areas

1. **Importing-stage freshness and explanation.** Add safe sub-stage language
   for validation, scan, transcode, post-apply scan, and quarantine progress.
2. **Requester-scoped transfer actions.** Design cancel, retry, and requeue
   actions with per-request authorization, idempotency, rate limits, and audit
   events before exposing any requester mutation.
3. **Requester-safe failure and blocker reasons.** Define a bounded requester
   vocabulary for failed search, failed download, import blocked, operator
   review needed, and unavailable source states.

## Phase 19 Update

`REQUEST_RETRY_AWARE_JOURNEY_MESSAGING_DESIGN.md` completes retry-aware
Downloading-stage messaging. Replacement-source retries are now explained by
the request journey, while preview/apply-preview diagnostics remain admin-only.
