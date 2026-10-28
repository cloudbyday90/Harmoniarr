# Provider callback error outcome

October 28, 2026. See separate [research and tradeoffs](PROVIDER_CALLBACK_ERRORS_RESEARCH_2026_10.md),
[policy design](PROVIDER_CALLBACK_ERRORS_DESIGN.md), [Docker design](LOCAL_DOCKER_PROVIDER_CALLBACK_ERRORS_DESIGN.md)
and [Docker outcome](LOCAL_DOCKER_PROVIDER_CALLBACK_ERRORS_OUTCOME.md).

## Implemented behavior

The three Spotify, YouTube and Plex callback catches now select redirect codes
through a small [ESM policy](../src/server/integrations/providers/provider-callback-error-policy.js).
There are 34 reviewed codes: seven Spotify, eight YouTube and nineteen Plex,
including each provider's fallback. Known callback outcomes retain their existing
classification. Unknown, cross-provider, start-only, prefix-only and malformed
codes use spotify_oauth_failed, youtube_oauth_failed or plex_link_failed.

Captured immutable API-error codes take precedence over later field mutation.
Factory provenance does not make an unknown code public. Raw errors may select
only an exact primitive-string catalog member; code objects are never coerced.
Throwing getters use fallback. Message, cause, details and serialization do not
supply URL data. No input error is changed or retained.

Success remains HTTP 303 to the fixed settings destination with linked and no
code parameter. Failure remains HTTP 303 with failed and the selected fixed code.
The route uses the existing URLSearchParams builder; redirect body, no-store,
no-referrer and cookie behavior retain their contracts. Existing completion
owners still receive the original state, authorization code and browser binding.
There are only two production file changes: the policy and provider route adapter.

State/expiry/browser checks, current administrator authority, PKCE, session
revocation, encrypted credential publication, transaction fences and audit remain
owned by existing services. There is no schema, maintenance, dependency, transport,
retry, new service deployment or UI change.

## Executed validation

- Seven selected policy/route/OAuth/Plex/inventory unit files: **62 passed**,
  zero skipped. Policy tests cover all 34 codes, private accessors, mutation,
  hostile coercion, prototype keys, long values and cross-provider refusal.
  Route tests check actual redirects, headers/body, completion arguments and recovery.
- Full fast gate: **11,668 passed** (6,453 server, 4,512 client, 703 script/image
  policy tests), zero failures/skips/cancellations. All 14 selected static/test/
  build stages passed, including ESM, schema/anchors, lint and test hygiene.
- Three final immutable-image native tests passed with **143 scenario groups**:
  callback projection 30, existing OAuth ownership 80 and Plex ownership 33.
  They use actual packaged application/PostgreSQL. The callback fault fixture
  preserves settings, encrypted secrets, settings audit and operation rows;
  private diagnostic access/serialization reads remain zero. Missing cookies
  refuse before completion and later controlled success produces only linked.
- Existing owner entries separately verify browser binding, current administrator
  authority, single-use state, record/revision fences, atomic token publication,
  controlled commit-acknowledgement loss and actual backend retirement. OAuth
  additionally retains refresh fencing. Provider responses remain controlled.
- Actual Chromium navigation passed **six groups** on the preserved walkthrough:
  missing binding and invalid state after binding for all three providers.
  Destinations, no-store/no-referrer and private-data refusal passed. The Settings
  and Setup readiness views rendered, settings/secret status stayed equal, no
  mutation requests were attempted and no page errors occurred.

The initial lint preflight required explicit returns in four deliberately hostile
test getters; these were corrected before the full frozen gate. The first native
callback fixture then received HTTP 406 because it sent Accept: text/html alone;
the existing application API contract requires JSON compatibility. The fixture
now uses the actual browser negotiation shape, which includes */*. No production
admission or callback behavior was changed. The failed log and exact container
retirement/absence record remain private. The corrected native entry passed;
lint and test hygiene passed again. Only that native fixture header changed after
the full gate. Exact hashes prove unchanged production and fast-gate tests; the
Docker outcome records both source fingerprints and retained runtime proof.

No live provider/account acceptance, complete native/SQL/media matrix, repository-
wide disclosure audit, memory minimum or whole-application drainage is claimed.
Browser navigation does not establish spoken screen-reader or physical-device
acceptance; previously deferred manual checks remain deferred. The original
provider callback URL can still appear in browser history or server/proxy logs;
this change bounds the application's outgoing redirect, not those other owners.

GitHub MCP found **zero open PRs**, initially and at the final check recorded at
**2026-10-28 13:00:08 UTC**. Random PR implementation and stale Dependabot cleanup/
rebasing were inapplicable. Work is on main without a PR merge, release, tag or
release-workflow dispatch.

## Next recommended item

Present the fixed callback outcome in the settings connection journey. The current
callback lands on Settings / Setup readiness, while the existing connection
presentation and useConnections actions do not consume these callback outcome
parameters. Add a small finite presentation policy and owned callback feedback,
then refresh the provider's saved status. Treat query values as untrusted hints;
linked in a URL must not establish that an account is linked. Unknown/forged
outcomes should use generic guidance, with no raw code or diagnostic echo.

Verify persistent status/error feedback, keyboard/focus behavior, safe query
cleanup and success/refusal/reload through the actual built UI. Keep retry under
explicit user activation and the existing fresh-admin/CSRF/state owners. This
follow-up improves recovery guidance without changing credential authority.
