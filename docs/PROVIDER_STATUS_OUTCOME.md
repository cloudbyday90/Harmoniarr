# Provider status aggregation outcome

Implemented October 28, 2026. See the separate [design](PROVIDER_STATUS_DESIGN.md),
[official research and tradeoffs](PROVIDER_STATUS_RESEARCH_2026_10.md) and
[Docker outcome](LOCAL_DOCKER_PROVIDER_STATUS_OUTCOME.md).

## Delivered behavior

The small ESM [aggregation factory](../src/server/integrations/providers/provider-status-service.js)
isolates a failed local provider observation. Healthy owner payloads pass through
unchanged. Failed observations contain only a fixed provider identifier,
availability=unavailable and provider_status_unavailable. A deterministic summary
distinguishes complete, partial and unavailable collection results. HTTP 200
means that representation was collected; it does not establish provider health.

The authenticated/no-store provider GET uses all four readers. The administrator
overview reuses the factory for its existing three-provider projection. Borrowed
queryables run serially without release/transaction ownership; independently
owned route reads await every started returned promise. No retries, status cache
or new timeout is introduced. Recognized database connection and bounded lookup
failures remain a sanitized 503 database_unavailable, with no raw cause/message.
Unavailable does not manufacture unlinked, unconfigured or invalid credentials.

Settings payloads and commands retain their existing contracts. Required settings,
schema and dependency reads outside the overview's provider projection can still
fail the request. Core dependency-free health still skips this projection. This
change adds no schema, persisted validation, maintenance job or deployed service.

## Executed evidence

- Focused qualification: 46 passing tests, including 13 new service/overview
  tests. These cover each reader, all-unavailable, primitive rejections, native and
  lookup classifications, held sibling settlement, borrowed handle ownership,
  serial admission, module composition and dependency-free overview behavior.
- One frozen-source fast gate: 6,415 server, 4,512 client and 703 script tests,
  all passing with zero failures, skips or cancellations. Lint, ESM, copyright,
  test hygiene, Node baseline, schema/migration, image/topology checks and build
  passed. Production npm audit reported zero vulnerabilities.
- Two guarded final-image native test entries passed: 14 provider-aggregation and
  18 affected Apple-status scenario groups. Real encrypted Apple corruption leaves
  healthy siblings visible in provider GET and overview; restoration recovers.
  Injected local reader failures exercise each provider and all-unavailable.
- A fixture-owned PostgreSQL connection executes pg_sleep; its exact backend is
  terminated, the driver reports 57P01, end is observed and backend absence is
  verified. That genuine error is then supplied to one injected route reader to
  qualify bounded HTTP 503 mapping and recovery. This does not simulate a whole
  database outage or terminate a production status reader's connection.
- Native GETs preserve exact settings, encrypted-secret and settings-audit row
  projections, with no provider HTTP calls. Anonymous, requester/admin and current
  disabled-session behavior, no-store and secret-error exclusion passed.
- Four browser groups passed on the existing walkthrough: actual complete GET,
  controlled peer-partial preserving actual Apple checks, controlled Apple
  unavailable, and actual refresh recovery. Settings/secret-status snapshots
  stayed equal, no settings PUT occurred, and no page errors occurred. Desktop
  and mobile screenshots were visually checked; focus and overflow checks passed.

Two initial lint shadowing errors were corrected before the frozen gate; their
failed log remains private. Preflight native runs used a candidate overlay and
are separate from the final immutable-image runs. Native promise settlement is
not a claim of complete application/native drainage. No live provider acceptance,
memory minimum, spoken screen-reader or physical-device acceptance is inferred;
manual assistive checks remain deferred. Earlier unexplained linked-login
evidence remains separate and was not diagnosed or repaired here.

GitHub MCP found no open repository PR initially or at the final check,
2026-10-28 11:32:49 UTC. Random local PR application and stale Dependabot
cleanup/rebase were therefore inapplicable. Work stays directly on main; no PR
merge, release, tag or release-workflow dispatch is part of this change.

## Next recommended item

The shared unexpected HTTP error boundary is now implemented. See its separate
[design](HTTP_ERROR_DESIGN.md), [official research](HTTP_ERROR_RESEARCH_2026_10.md)
and [outcome](HTTP_ERROR_OUTCOME.md) for explicit public-error provenance,
compatibility migration, qualification limits and the next recommendation.
