# HTTP error response outcome

Implemented October 28, 2026. See the separate [design](HTTP_ERROR_DESIGN.md),
[official research and tradeoffs](HTTP_ERROR_RESEARCH_2026_10.md) and
[Docker outcome](LOCAL_DOCKER_HTTP_ERROR_OUTCOME.md).

## Delivered behavior

The existing API-error factory now captures an immutable public descriptor in a
private WeakMap while preserving its Error return and mutable internal fields.
Only the original factory-owned error carries that intent. A copy, prototype,
status/expose flag or later property mutation cannot supply a public descriptor.
Valid descriptors contain integer statuses 400–599, nonempty codes up to 128
UTF-16 code units and messages up to 2,048 units. Invalid definitions follow the
known normalization/generic fallback path rather than reflecting arbitrary data.

The narrow ESM [HTTP response module](../src/server/http-error-response.js)
preserves explicit public errors, existing static parser 400/413 responses and
recognized database connection failures as 503 database_unavailable. Unexpected
failures use the existing JSON envelope with status 500, internal_error and
Unexpected server error. The terminal app middleware sends only selected
primitive fields with no-store; it does not serialize the original object,
stack, cause, request body, SQL, paths or error-controlled headers.

After response headers start, the middleware delegates a new bounded Error to
Express instead of attempting a second response. It forwards no original cause
or arbitrary properties. This path has a unit delegation/no-second-write probe;
actual streaming socket failure is not newly qualified here.

Twenty-four files with older intentional constructors now use the shared factory.
Existing validation/auth/bootstrap/conflict/artwork-admission statuses, codes and
text remain unchanged at construction. The AST-assisted inventory and reviewed
mechanical diff cover these source conversions; they do not prove every runtime
path. Together with the factory, app and new response module, 27 server files
change. No client, SQL/schema, dependency, transaction or worker policy changes.

## Executed evidence

- Focused combined qualification: 28 tests passed, including nine new projector
  and actual-app HTTP tests. Factory provenance, immutable capture, exact bounds,
  primitive rejections, hostile getters/toJSON, SQL/filesystem/provider failures,
  parser/database normalization and headers-sent ownership passed. Actual app
  HTTP preserves field validation, conflict and lookup-unavailable responses.
- One frozen-source fast gate passed 6,424 server, 4,512 client and 703 script
  tests: 11,639 total, zero failures/skips/cancellations. All 14 selected static,
  test and build stages passed, including lint, ESM, migration/schema, copyright,
  Node baseline, topology/image checks and test hygiene. Production npm audit
  reported zero vulnerabilities.
- Three final-image native test entries passed: 20 HTTP-error, 14 provider-status
  and 11 encrypted credential-save scenario groups. Error tests exercise real
  bootstrap claims, auth, CSRF, rejected settings validation without writes,
  metadata view validation, malformed/oversized JSON and media/Accept admission.
  Injected unexpected SQL/filesystem/forged errors remain generic without echo.
- During an authenticated overview request, a fixture-owned PostgreSQL connection
  performs pg_sleep, its exact backend is terminated, 57P01 is observed, driver
  end and backend absence are verified, then the real error reaches the app's
  global handler. Static 503 and subsequent healthy recovery passed. No unrelated
  backend or application pool peer was terminated; this is not a whole-server
  outage test.
- Provider partial status and credential validation/encrypted persistence/rollback
  regressions passed. Native error reads and rejected settings patches preserve
  exact settings, encrypted-secret and settings-audit row projections.
- Five browser groups passed: actual authenticated validation, controlled generic
  settings-load failure, actual reload recovery, controlled generic status failure
  and actual refresh recovery. No settings writes were attempted, settings/secret
  snapshots stayed equal and no page errors occurred. Refresh focus and overflow
  checks passed; four desktop/mobile screenshots were visually checked.

The initial native preflight used the general artist endpoint for a view check;
that endpoint does not own view validation. The fixture was corrected to the
operator endpoint after source review. The failed log and container retirement
record remain private; only the later passing run qualifies the candidate. This
does not diagnose the general endpoint's earlier 500. Initial unit app setup also
generated an unrelated ephemeral VAPID warning; an injected unused push service
removed that setup dependency before the frozen gate. Overlay preflight is
separate from final immutable-image proof.

Public factory callers still own safe wording. Route-local normalizers, direct
JSON responses, redirects, stored operation diagnostics and internal logging
remain separate owners. No repository-wide disclosure audit, live provider,
memory minimum, spoken screen-reader or physical-device acceptance is claimed.
Earlier unexplained linked-login evidence remains separate; manual assistive
checks remain user-deferred.

GitHub MCP found no open PR initially or at the final check,
2026-10-28 11:57:43 UTC. Random PR implementation and stale Dependabot cleanup/
rebase were inapplicable. Work remains on main without a release/tag, PR merge
or release-workflow dispatch.

## Next recommended item

Review the route-local provider error normalizers in
[metadata routes](../src/server/routes/metadata-routes.js),
[downloader routes](../src/server/routes/downloader-routes.js) and
[candidate routes](../src/server/routes/import-candidate-routes.js). Some branches
explicitly pass an incoming error.message to createApiError after matching only
its code. The new global boundary deliberately honors explicit public intent;
it cannot decide whether that earlier message selection was safe.

Introduce a narrow shared public-message catalog for these provider failures and
preserve useful validation only from explicit application-owned errors. Prove
that matching provider codes with raw response/path/credential sentinels do not
become public text, while existing status/code and retry guidance remain useful.
The benefit is consistent provider failure disclosure; the cost is reviewing
compatibility for configuration and validation explanations. This is a source
finding and next hardening step, not a newly reproduced remote disclosure.
