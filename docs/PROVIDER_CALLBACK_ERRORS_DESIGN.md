# Provider callback error design

October 28, 2026. Implements the next [provider route item](PROVIDER_ROUTE_ERRORS_OUTCOME.md).
See [research and alternatives](PROVIDER_CALLBACK_ERRORS_RESEARCH_2026_10.md),
[outcome](PROVIDER_CALLBACK_ERRORS_OUTCOME.md) and
[Docker design](LOCAL_DOCKER_PROVIDER_CALLBACK_ERRORS_DESIGN.md).

## Boundary and behavior

The three provider callback catch paths currently pass error.code into the
settings redirect. URLSearchParams encodes syntax but cannot establish that the
value is safe public data. Introduce a small
[provider callback policy](../src/server/integrations/providers/provider-callback-error-policy.js)
with separate Spotify, YouTube and Plex catalogs and named fallback codes.
Keep route handlers thin: select the code and use the existing redirect builder.

Only exact primitive strings from that provider's reviewed callback vocabulary
survive. Use the captured immutable public API-error code first; inspect the raw
code only when no captured descriptor exists. Reject unknown, cross-provider,
prefix-only, start-only, object, symbol, array and prototype-like codes without
coercion. A throwing code getter returns the fixed fallback. Never read message,
details, cause or serialization. Do not mutate or retain errors. Unsupported
provider names are programming errors, rejected before any prototype lookup.

There are seven Spotify, eight YouTube and nineteen Plex codes, including each
fallback. The supported outcomes are:

- Spotify/YouTube: state invalid, administrator authority changed, link changed,
  client ID required, token exchange failed, invalid response and generic OAuth
  failed. YouTube additionally supports client secret required.
- Plex: state invalid, administrator authority changed, not claimed, invalid
  profile, restricted account, PIN invalid/unauthorized/read failure, user invalid/
  token invalid/fetch failure, seven bounded request failures and generic link
  failed. PIN creation, Home/resource operations and configuration-start failures
  are outside callback completion and use fallback.

Known code classification does not attest to the error's origin or authorize
publication. Captured unknown factory codes still use fallback; mutable fields
cannot override a captured code. A raw error can select only a harmless fixed
catalog member. The public response remains HTTP 303 to
/app/settings?providerOAuth=failed&code=selectedCode; success remains linked with
no code parameter. The existing encoded HTML/text redirect body must also remain
free of private data. No-store/no-referrer and cookie behavior remain unchanged.

State, expiry, browser-cookie verification, session revocation, current
administrator role, PKCE, stored redirect URI, transaction locks, encrypted token
publication and audit remain owned by existing services. This is not an OAuth
protocol migration, new redirect destination or authentication bypass.

## Verification

Unit policy tests cover the complete catalog and hostile access/coercion/captured
code cases. Actual HTTP route tests cover all three catches, browser inputs,
redirect headers/body, exact completion arguments and later healthy success.
Run existing OAuth/Plex service tests and route inventory, then one frozen full
fast gate. Add guarded packaged-app HTTP/PostgreSQL checks for bounded redirects
and unchanged settings/secrets/audit/operations. Rerun existing native OAuth and
Plex owner-link entries to verify current authority, state/expiry, single-use and
publication behavior through their real stores. Controlled provider responses
do not establish live account acceptance. No UI changes or new ARIA behavior are
planned; report browser/manual scope honestly.

Keep research, design and outcome as separate documents. Work on main, commit and
push all changes, with no branch, PR merge, release or tag.
