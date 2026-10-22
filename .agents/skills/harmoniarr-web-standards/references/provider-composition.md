# Provider composition and target ownership

Use when a provider client works in isolation but application configuration or
nested metadata may not reach the correct artwork owner.

1. Trace the real settings secret owner through application construction, module
   factories and request callbacks. An injected client with literal keys does not
   prove saved credentials work. Reuse the existing encrypted store; keep secrets
   out of ordinary settings values, URL parameters, returned data and errors.
2. Verify lifecycle behavior on the same client: environment fallback, saved-key
   precedence, rotation, clear and resolver refusal before dispatch. Distinguish
   in-memory persistence doubles from native PostgreSQL encryption evidence.
   Separate callbacks do not guarantee an atomic two-secret snapshot.
3. Discover current primary URLs through MCP and record vendor/API version and
   source status. W3C Statements and OWASP cheat sheets supply principles and
   guidance; neither makes a synthetic fixture a conformance certification.
4. Bind nested records to the requested target. An album endpoint may return an
   artist envelope. Never substitute the artist ID, first array element, highest
   liked foreign image or inherited map property. Refuse missing/duplicate or
   conflicting target identity before downstream effects. An empty collection
   and a nonempty collection belonging to another target are different outcomes.
5. Qualify composition, selectors, consumer effects and native HTTPS separately.
   Reuse the owned HTTPS fixture and default verifier; retain provider Host/SNI
   and header-only synthetic keys. Actual artwork download, decode and durable
   assignment require their own evidence; a controlled sink proves ordering only.

Fanart.tv v3.2 uses `albums` arrays with explicit `release_group_id`; legacy maps
use release-group keys. A flat compatibility path must never recover from a
refused nested envelope. See [design](../../../../docs/FANART_WIRING_DESIGN.md),
[official research](../../../../docs/FANART_WIRING_RESEARCH.md) and
[outcome](../../../../docs/FANART_WIRING_OUTCOME.md). This workflow supports
implementation within the user's scope; it authorizes no live provider traffic,
credential disclosure, release or unrelated account changes.
