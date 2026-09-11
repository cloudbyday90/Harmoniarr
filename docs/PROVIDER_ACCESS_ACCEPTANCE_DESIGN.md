# Provider access and acceptance design

Research and design date: September 11, 2026. Baseline: `ee33431`.

## Decision and purpose

Add an explicit administrator check of access to one provider collection, with a separately allowlisted local acceptance artifact. Reuse the current provider clients, collection adapters, and Spotify/YouTube authorization services. Keep configuration presence, observed access, captured collection review, and completed acquisition as separate facts.

Harmoniarr manages a Soulseek-native music library. Provider collections supply metadata for the existing request and release-review workflow. An access check reads a small collection sample; it creates no request, collection ledger, release intent, discovery search, import candidate, or transfer. It cannot establish that music was acquired or that arbitrary collections are accessible.

The [collection completion outcome](EXTERNAL_COLLECTION_COMPLETION_OUTCOME.md) identifies live-provider access as the next release gap after bounded enumeration and review. Existing [Docker acceptance evidence](DOCKER_PROVIDER_ACCEPTANCE_EVIDENCE_DESIGN.md), [readiness policy](DOCKER_PROVIDER_ACCEPTANCE_READINESS_DESIGN.md), and [secret-input design](DOCKER_PROVIDER_ACCEPTANCE_SECRET_INPUT_DESIGN.md) concern download-provider evidence. Retain their explicit execution, protected password input, and output allowlist principles without treating that evidence as proof of Spotify, Apple Music, or YouTube collection access.

## Official research and local implications

Sources below were discovered with web search and then opened through the web tool. Apple documentation serves a JavaScript shell to the reader; its indexed official page content supplied the substantive text. This research does not use community claims or guessed provider endpoints.

| Source | Verified guidance | Implication |
| --- | --- | --- |
| [Spotify authorization](https://developer.spotify.com/documentation/web-api/concepts/authorization) | Client credentials authenticate an application without user authorization. User resources require an appropriate user authorization flow. Authorization Code and PKCE have different client-secret storage requirements. | The resolver already supports Spotify user OAuth and app credentials. Report the selected mode accurately; do not describe saved app credentials as private playlist access or build another OAuth flow in this change. |
| [Spotify quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes) | Development Mode requires a Premium app owner and an allowlisted user population; nonallowlisted users can receive 403 after login. Extended Quota Mode has different eligibility and limits. The Dashboard identifies the app mode. | Keep `quotaMode: unknown`; neither a successful request nor a 403 establishes the mode. Give conditional account/access guidance without asserting the exact cause of an ambiguous denial. |
| [Spotify February 2026 migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide) | The listed Development Mode changes do not alter Extended Quota Mode. Playlist items move to `/items`, and missing playlist contents can reflect access restrictions while metadata remains readable. | Missing contents are not an empty collection. Support the current envelope through the shared adapter and keep account-mode limitations explicit in evidence. |
| [Spotify playlist items](https://developer.spotify.com/documentation/web-api/reference/get-playlists-items) | The current reference restricts the endpoint to an owning or collaborating user and documents 403 otherwise. User country takes priority over a supplied market. | Test a collection the authorized account can read. A catalogue or metadata response alone cannot validate playlist contents. Do not infer a universal private/public access capability. |
| [Spotify July 23 quota update](https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates) | Development apps share quota per developer account; the current Client ID limit is 25. A 429 response can distinguish exhausted quota with `QUOTA_EXCEEDED`. | Parse only the recognized reason. Do not recommend rotating app IDs, repeat the superseded one-app limit, or label every 429 a short-term rate limit. |
| [Spotify rate limits](https://developer.spotify.com/documentation/web-api/concepts/rate-limits) | Rate limits use a rolling 30-second window; 429 responses normally include `Retry-After` seconds. Quota restrictions are separate. | Preserve a validated retry hint and give pacing guidance. The check does not retry automatically or promise when a quota budget resets. |
| [Apple developer tokens](https://developer.apple.com/documentation/applemusicapi/generating-developer-tokens) | Apple Music requests require a signed developer token. ES256 is required and token expiry is bounded. Developer-token request rates can produce temporary 429 responses. | Keep the existing server-side signing path and catalog scope. Configuration or successful signing alone is not evidence of resource access. |
| [Apple Music user authentication](https://developer.apple.com/documentation/applemusicapi/user-authentication-for-musickit?changes=_3) | Subscriber-specific data, including the user's library, additionally requires a Music User Token. | The present Apple client handles catalog resources using a developer token. Private library support is outside this release item; do not offer it as a credential retry. |
| [YouTube API reference](https://developers.google.com/youtube/v3/docs) | Every request needs an API key or OAuth token; private user data needs authorization. | Retain API-key access for supported public data and existing OAuth for authorized private data. Report which mode was used without exposing its credential. |
| [YouTube authentication](https://developers.google.com/youtube/v3/guides/authentication) | Private data uses OAuth; YouTube Data API does not support service-account authorization. | Reuse the existing user authorization service. Do not propose a service account as a private-playlist workaround. |
| [YouTube errors](https://developers.google.com/youtube/v3/docs/errors) | Quota exhaustion can be a 403 `quotaExceeded`; `insufficientPermissions` denotes insufficient OAuth scope. | Classify documented, allowlisted reasons before falling back to generic access denial. HTTP status alone cannot separate quota from permission failure. |
| [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) and [REST security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html) | Access tokens and secrets should be excluded from logs; client errors should avoid unnecessary internal details. | Construct diagnostics and artifacts from explicit safe fields. Never serialize provider bodies, token exchanges, URLs, stack traces, or transport causes as operator detail. |
| [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) | Validate allowed destinations and disable redirects that bypass validation. | Parse source identity and call fixed provider endpoints. Validate continuation identity; never fetch a supplied continuation URL directly. Reject redirects in authenticated provider transport. |
| [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) and [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Results and waiting states need programmatic identification; inputs need labels, errors need text, and known safe corrections should be offered. | Use a native labelled URL form, a native action button, persistent status feedback, and a concise corrective action. Avoid focus changes and repeated announcements on passive reads. |

## Bounded implementation contract

`POST /api/v1/providers/collection-access-check` accepts `{ sourceUrl }`. Require a fresh administrator session and an application rate limit of four checks per minute. The route calls the existing `requireCsrf` guard and follows the deployment's `security.csrfProtectionMode`, consistent with the other administrator routes. The platform currently defaults that setting to `disabled`; this change does not silently change deployment policy. Set `security.csrfProtectionMode: required` for release deployments and verify rejection of missing or invalid tokens. Read-only status routes do not run the check or contact providers.

The service resolves only the provider identified by the validated source. It may refresh that provider's existing OAuth token using the current encrypted secret service. It must not refresh unrelated credentials, change authentication scopes, relink accounts, or silently try another identity after a denied request. A local configuration problem produces a safe diagnostic independently of other providers.

Reuse collection fetching and adaptation with a maximum of two container pages, eight provider HTTP calls, and a 30-second total deadline, including authentication work. Do not fetch the discovered album children. Spotify version reads count toward the HTTP budget. Invalid continuation, changed version, malformed data, access denial, unavailable service, timeout, and exhausted limits cannot become full-traversal success.

The returned `check` has this allowlist:

| Field | Meaning |
| --- | --- |
| `schemaVersion` | `1` |
| `provider`, `resourceType` | Recognized provider and collection kind |
| `authMode` | `oauth_user`, `client_credentials`, `api_key`, `developer_token`, or `none` |
| `quotaMode` | `unknown`; no unsupported account-mode inference |
| `outcome`, `code` | `verified`, `not_checked`, or `failed`, plus a stable diagnostic code |
| `pagesChecked`, `entriesSeen` | Bounded successfully observed page and source-entry counts |
| `hasMore` | Boolean when known; otherwise `null` |
| `fullTraversal`, `multiPageObserved` | Independent completion and pagination evidence |
| `snapshotCheck` | `not_applicable`, `verified`, `failed`, or `not_checked` |
| `checkedAt` | Observation timestamp |
| `retryAfterSeconds` | Valid bounded retry hint or `null` |
| `label`, `detail`, `nextAction` | Fixed application copy selected by code |

`verified` means the attempted collection reads succeeded. A one-page result can verify access while failing the separate multi-page acceptance requirement. If another page remains after the second page, report partial observed access with `fullTraversal: false`; do not claim complete traversal. Spotify version comparison detects observed change but is not a snapshot-pinned provider read. Apple and YouTube evidence describes the range observed during the check, consistent with the [collection design](EXTERNAL_COLLECTION_COMPLETION_DESIGN.md).

No access-check ledger, scheduled job, or dedicated persisted audit event is introduced for this read-only network diagnostic. Existing OAuth token refresh can still update encrypted credentials when required. Source URLs, resource IDs, account names, titles, playlist membership, provider response bodies, and private paths are absent from the result and saved evidence.

## Transport and error design

Use modular ESM transport, error-classification, provider-resolution, access-check, and projection services. Keep provider-specific parsing small and retain shared adapters as the source of collection-shape validation.

The baseline YouTube client can place an API-key-bearing request URL in `error.details.url`; other clients retain raw transport causes. Remove these fields at the transport boundary, then allowlist again at presentation and artifact boundaries. Normalize bounded provider error bodies into known reasons only. Unknown reasons and arbitrary upstream error descriptions never become application copy.

Separate authentication failure, access denial, missing resource, ordinary throttling, exhausted quota, provider outage, malformed data, and probe-budget exhaustion. Retry hints must be finite, nonnegative, and bounded; malformed or unavailable hints become `null`. Fixed messages can suggest checking credentials, account access, scopes, provider Dashboard quotas, or retrying later without asserting an unobserved cause.

The current [Spotify quota-mode response example](https://developer.spotify.com/documentation/web-api/concepts/quota-modes) places `QUOTA_EXCEEDED` at `body.error.reason`, alongside `body.error.status: 429`. The classifier reads this documented location. Known Spotify quota exhaustion and YouTube `quotaExceeded` or `dailyLimitExceeded` produce the distinct `quota_exceeded` diagnostic; ordinary throttling remains `rate_limited`.

## Alternatives and tradeoffs

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Treat saved credentials as connected | Minimal work; no network cost | Misleading for expired authorization, private access, quota, and actual envelopes | Reject |
| Automatically probe all providers on status reads | Fresh-looking status | Spends quota, refreshes unrelated credentials, couples providers, and still cannot prove arbitrary resource access | Reject |
| Add new OAuth implementations now | Could extend future account features | Existing Spotify/YouTube flows already cover the required seam; Apple user-library integration is a separate product decision | Defer |
| Capture raw provider responses | Detailed forensic material | Unnecessary credential and private-data exposure; unstable artifacts | Reject |
| Explicit bounded resource check and safe artifact | Useful account-specific evidence, controlled cost, existing interfaces and services | Requires a deliberate operator test collection; a two-page limit cannot fully inspect large collections | Choose |
| Full automated provider acceptance in CI | Frequent external coverage | Requires secrets and account entitlements; unreliable quotas and mutable remote data | Keep fixture CI and opt-in live evidence separate |

## Reproducible acceptance and evidence

Use a supported collection that spans exactly two fetched pages for strict acceptance. A larger collection can demonstrate access but cannot satisfy this probe's strict full-traversal requirement. Configure the desired provider and, where necessary, authorize its account through existing Settings controls before checking it.

The local CLI requires explicit `--live`, an application URL, administrator username, password-only protected file, selected collection URL, and evidence output path. It authenticates to Harmoniarr and calls the same protected POST route; provider credentials remain in the application. Do not place a provider credential or account password in a source URL.

The user authorized choosing a popular public test playlist. The selected diagnostic sample is [NPR Music Tiny Desk Concerts on YouTube](https://www.youtube.com/playlist?list=PL1B627337ED6F55F0), discovered by following the external playlist link from its [MusicBrainz series](https://musicbrainz.org/series/fa1b1a42-ce0c-4437-b896-3eb9e6a658a6). This establishes the source identity, not current API access or collection size. Its full traversal may exceed this check's two-page bound.

For the observed local walkthrough at `http://127.0.0.1:47956`, the command is:

```powershell
npm.cmd run validate:provider-collection-access -- --live --base-url http://127.0.0.1:47956 --username ADMIN --password-file PROTECTED_FILE --source-url 'https://www.youtube.com/playlist?list=PL1B627337ED6F55F0' --evidence-path .tmp/provider-collection-access/tiny-desk.json
```

Replace `ADMIN` and `PROTECTED_FILE` with the walkthrough administrator and a protected password-only file; neither value is inferred from repository examples. The application URL is a local deployment observation, not a portable default. A strict failure caused by remaining pages records useful bounded access evidence but does not pass full multi-page acceptance. No live result is claimed until this command has authenticated and observed the provider response.

The observed walkthrough configuration has `spotifyEnabled: false`, `youtubeEnabled: false`, and `appleMusicEnabled: false`. Only these enabled flags were inspected; no provider credentials were sought or used. The public sample is authorized, but a real provider check still requires an enabled, configured connection and a valid administrator login. This environment therefore has no live-provider acceptance result. Enabling and configuring a provider is an operator prerequisite, and the selected public source alone does not satisfy it.

The artifact contains `evidenceType: live_provider_collection_access` and an independently validated safe `check`. It excludes source/application URLs, resource/account identities, credentials, secret-file paths, raw bodies, and transport messages. Write bounded failed or incomplete evidence before returning a nonzero strict exit status. Strict acceptance requires `outcome: verified`, `multiPageObserved: true`, and `fullTraversal: true`; a successful login or one-page check is insufficient.

The collector attempts to close its transient application session. If logout fails after a valid provider result, the CLI still writes the validated safe artifact, then exits unsuccessfully with cleanup guidance. A valid observation is preserved without treating session cleanup failure as overall command success. Output creation uses exclusive creation and never overwrites an existing artifact.

Tests using controlled provider responses must identify their fixture provenance. They verify implementation behavior, not real account entitlement. Without an enabled saved connection and an observed successful run, live multi-page acceptance remains outstanding; neither the artifact schema nor passing fixture tests changes that fact. The Windows invocation uses `npm.cmd` to preserve argument forwarding; the portable direct Node command is in the separate outcome runbook.

Meaningful regression coverage exercises selected-provider isolation, fresh-admin/rate limits, malformed and credential-bearing URLs, redirect rejection, total request budgets, cancellation/timeouts, missing versus empty contents, version change, partial traversal, quota versus permission responses, invalid retry hints, malicious error messages, and artifact redaction. CSRF integration coverage explicitly enables `security.csrfProtectionMode: required` and verifies the 403 boundary; it does not imply enforcement when an operator has disabled that policy. Script coverage includes a failed quota check followed by logout failure, preserved safe evidence, and prevention of overwrite. Browser checks cover labels, keyboard submission, persistent result feedback, and recovery copy. Broader collection and import regressions must continue to prove that this diagnostic creates no acquisition work. Final validation results belong in the separate implementation outcome; passing controlled tests does not establish live-provider access.

## Pull request disposition

GitHub MCP refreshed all three open PRs and read every changed-file patch on September 11, 2026. Each PR has one changed file. None supplies an applicable local patch for this item, and none was merged or otherwise mutated.

| PR and immutable head | Complete patch | Local disposition |
| --- | --- | --- |
| [#40](https://github.com/cloudbyday90/Harmoniarr/pull/40), `649659f1e199d48d55cc8d5cccf9f079dc235d86` | Changes the controlled-provider fixture image from Node `24.19.0-alpine` to `26.7.0-alpine` | Retain the repository's Node 24 LTS baseline; a fixture-only major upgrade would diverge from the platform |
| [#24](https://github.com/cloudbyday90/Harmoniarr/pull/24), `40cf4d117b69bd55b9a0a7353361838216e1e952` | Changes `docker/build-push-action` from 7.1.0 to 7.2.0 | Superseded locally by 7.3.0 at `53b7df96c91f9c12dcc8a07bcb9ccacbed38856a` |
| [#23](https://github.com/cloudbyday90/Harmoniarr/pull/23), `ae651337286216e92be7ae977e39fcedc14de7f9` | Changes `docker/metadata-action` from 6.0.0 to 6.1.0 | Superseded locally by 6.2.0 at `dc802804100637a589fabce1cb79ff13a1411302` |

## Final recommendation stack and next step

Use Node 24 LTS, modular ESM services, fixed provider transports with bounded parsing and cancellation, existing encrypted OAuth credentials, selective provider resolution, existing collection adapters, fresh-administrator authorization, and native Vue forms. Enable the deployment's required CSRF policy for release. Retain the two-page/eight-request/30-second provider deadline and the strict local evidence collector, with fixture-based CI and separate live acceptance. Run focused transport, service, route, artifact, and browser checks, followed by the repository's full validation stack; record actual results without treating an unexecuted provider probe as a pass.

After implementation validation, capture real multi-page access with operator-owned credentials and a known test collection. Record provider-specific observed limitations before considering guarded automatic collection continuation. If no eligible live collection is supplied, preserve that release-evidence gap and proceed next with the independently useful PostgreSQL backup/restore proof for request decisions and retained work.
