# Fanart.tv credentials and album ownership

Decision date: October 22, 2026. This follows the
[response containment outcome](FANART_RESPONSE_OUTCOME.md).

The default artwork module omits both credential resolvers. Its album selector
also reads a flat image list while the current vendor contract returns an artist
envelope containing albums. Fix these at composition and selection boundaries.

The application creates one provider credentials service for settings and artwork.
The artwork module supplies its existing per-request resolvers to Fanart.tv;
standalone module construction retains the same default credentials factory.
Stored secrets keep precedence over environment fallback. Resolving at request
time preserves rotation and clearing; a resolver failure dispatches nothing and
retains only the existing private error projection. No new secret storage or SQL.

Extract pure image selection into a small ESM module. Nested v3.2 arrays select
exactly one record with the requested release-group ID. Legacy maps use their
own requested key and reject a conflicting explicit ID. Empty collections remain
empty; nonempty collections without the requested album, malformed containers
and duplicate matches fail before image download. Never use the artist envelope's
MBID or the first album as a substitute. Flat payloads remain an explicit endpoint
compatibility path only when no nested envelope is present; a conflicting explicit
release-group ID still fails. Preserve image-type, language and likes priorities.

Validation proceeds from selectors and credential composition to the actual
artwork consumer, native default-origin HTTPS and the normal fast gate. Synthetic
secret-store doubles prove saved-value resolution, not PostgreSQL encryption.
Existing encrypted storage is unchanged. Docker validation preserves admin/data
and uses readiness only; it sends no live artwork requests.

The downstream image downloader still needs its own URL, redirect, byte and format
boundary. This change does not establish general SSRF resistance or permit a live
provider acceptance claim. See [research](FANART_WIRING_RESEARCH.md) and the final
[outcome](FANART_WIRING_OUTCOME.md).
