# Provider route error outcome

October 28, 2026. See the separate [research and tradeoffs](PROVIDER_ROUTE_ERRORS_RESEARCH_2026_10.md),
[policy design](PROVIDER_ROUTE_ERRORS_DESIGN.md), [Docker design](LOCAL_DOCKER_PROVIDER_ROUTE_ERRORS_DESIGN.md)
and [Docker outcome](LOCAL_DOCKER_PROVIDER_ROUTE_ERRORS_OUTCOME.md).

## Implemented behavior

A small [ESM policy](../src/server/integrations/providers/provider-route-error-policy.js)
replaces four duplicated route normalizers. MusicBrainz has five fixed public
failures; Soulseek has four, shared by downloader, candidate and Soulseek routes.
Recognized codes retain their intended 404/502/503 classifications. Incoming
message, cause, upstream response, headers and diagnostic fields never supply
the public text. Even existing public provider errors receive catalog wording.

Captured immutable application-error codes take precedence over mutable fields.
Application-owned local validation/not-found/conflict/authentication errors keep
their existing descriptors and useful text. Raw local lookalikes are no longer
promoted into public errors by metadata routes; they receive the terminal
generic 500. Unknown errors retain identity for existing bounded global handling,
including database-unavailable 503. Normalization does not mutate input errors,
coerce keys or serialize diagnostics; throwing getters remain guarded.

Browser qualification reproduced Downloader Refresh losing focus when native
disabled changed during a pending request. The existing view now uses loading,
revalidation and provider-disabled guards. Pending refresh remains focusable with
aria-disabled; a disabled provider retains native disabled. Enter, Space and click
cannot duplicate pending work, and completion does not steal focus moved elsewhere.
There is no new composable, service deployment, request owner or focus-restoration
routine. The [shared browser scenario](../testing/browser/provider-route-error-scenario.js)
also verifies useful failure feedback and recovery in the built client.

## Executed evidence

- Focused policy, actual-app adapter, four route, terminal-error and inventory
  checks: **122 passed**, zero skipped.
- Full fast gate: **11,655 passed** (6,440 server, 4,512 client, 703 script/image
  policy tests), zero failed/skipped/cancelled. Node baseline, copyright,
  migration/schema/anchor, ESM, image/topology, lint, test hygiene and build checks
  passed. The unchanged production dependency audit reported zero vulnerabilities.
- Final immutable-image native entries: **two passed**, comprising 31 provider
  route and 20 existing global HTTP-error scenario groups. Actual app sessions,
  CSRF and PostgreSQL were used with controlled provider-service failures.
  All catalogs/four adapters, anonymous/requester/disabled refusal, safe local
  validation, captured descriptors, unknown/cross-provider refusal and recovery
  passed. Private diagnostic getters/serialization were not read.
- An exact fixture-owned PostgreSQL backend was terminated during pg_sleep;
  57P01, connection end and backend absence preceded bounded HTTP 503 and healthy
  recovery. No unrelated backend was terminated. Guarded reads/refusals preserved
  settings, encrypted secrets, settings audit and operation rows.
- The canonical browser entry passed with zero skips: eight controlled groups.
  The populated walkthrough passed the same groups plus actual authenticated
  local-validation HTTP 400/no-store. Focus, duplicate activation, user-moved
  focus, disabled-provider refusal and success recovery passed. Four desktop/
  mobile screenshots were visually reviewed; no overflow or page errors occurred.

The initial live browser check exposed the focus defect; fixture preflights then
corrected Playwright's aria-aware disabled assertion to inspect native disabled,
and used controls actually present in the empty/mobile state. A later populated
walkthrough run correctly stopped on five background artwork POSTs. Source review
identified the exact artwork read endpoint, which now receives a local empty
response; the broad guard still refuses other non-GET/HEAD API requests. Final
qualification forwarded no POSTs and preserved operator settings. Failed logs
remain private and are not counted as passing evidence.

Only this browser-local artwork fixture changed after the final full fast gate
and image qualification. The other 14 changed code files, including all production
and native-test code, matched their frozen hashes. The corrected canonical and
walkthrough browser checks, lint and test hygiene passed again. Exact retention
is recorded in the Docker outcome; unchanged native/SQL/media matrices were not
repeated. Earlier server-only gates and image runs are separate evidence, not
additional final test counts.

## Scope and repository state

There are no schema, persistence, dependency, authentication, CSRF, provider
transport, retry, maintenance or command-acceptance changes. Provider faults and
successful recovery are controlled fixtures, not live account/provider acceptance.
Automated focus/visual checks do not establish spoken screen-reader, physical
device or complete WCAG acceptance; those manual checks remain user-deferred.
No memory minimum, whole-application drainage or repository-wide disclosure audit
is claimed. Public factory callers, direct responses, redirects and stored/internal
diagnostics remain separate projection owners.

GitHub MCP found **zero open PRs**, initially and at the final check recorded at
**2026-10-28 12:38:35 UTC**. Random PR implementation and stale Dependabot cleanup/
rebase were inapplicable. Work is on main; no PR was merged and no release, tag
or release workflow was created or dispatched.

## Next recommended item

Bound OAuth/Plex callback redirect error codes in
[provider routes](../src/server/routes/provider-routes.js). Spotify, YouTube and
Plex catch paths currently pass error.code to settingsRedirectUrl. Add small
provider-specific fixed-code catalogs and fallback codes, then verify actual
callback redirects and recovery while preserving callback state/browser binding,
session, expiry, cookie and authentication ownership. Do not put diagnostic text
in redirect queries or add retries. This is a source finding for the next item,
not a newly reproduced disclosure claim.

Later, preserve structured MusicBrainz configuration classification through the
Discover feedback formatter so configuration guidance is distinguishable from
temporary retry guidance. That UI classification is outside this change.
