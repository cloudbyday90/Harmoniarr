# Apple Music HTTP ownership research

Consulted October 28, 2026 through connected Search/GitHub MCP services. URLs were
discovered through search, repository metadata or official navigation. Apple's
HTML page links to Markdown that the MCP reader could not render; that exact
official resource was fetched directly and reviewed. These sources inform the
application decisions below; numeric admission/body limits are project policy.

## Official evidence and application

| Source/status | Applicable guidance | Decision |
| --- | --- | --- |
| [Apple Music developer tokens](https://developer.apple.com/documentation/AppleMusicAPI/generating-developer-tokens?changes=latest_maj_5&language=objc), current API documentation; [official Markdown](https://developer.apple.com/documentation/applemusicapi/generating-developer-tokens.md) | Developer requests use Bearer authentication with ES256/P-256/SHA-256, issuer/key identifiers and time claims. Expiry may be at most 15,777,000 seconds ahead. | Preserve existing server-generated 15,552,000-second tokens and 2,592,000-second renewal buffer. Verify actual signatures and cache boundaries. Add no subscriber authorization or browser token delivery. |
| [Node HTTP v24.22.1](https://nodejs.org/download/release/latest-v24.x/docs/api/http.html), runtime documentation | Agent/socket ownership and request destruction are distinct from timeout notification. | Adopt the existing native owner, which retains capacity through actual resource retirement. Keep current runtime pins. |
| [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), official security guidance | Validate the actual connection destination, retaining original Host/SNI/TLS verification; domain checks alone do not close DNS rebinding gaps. | Add only the existing Apple API origin to provider policy; reuse complete public DNS validation, redirect and proxy refusal. |
| [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/), W3C Statement, May 15, 2025 | Minimize unnecessary data transfer/exposure. | Keep keys and tokens server-side; preserve sanitized errors and bounded response reads. This provides no WCAG conformance claim. |
| [ORAS action metadata](https://github.com/oras-project/setup-oras/blob/005458ad77f1c8facd38a094e4af2e69e5607ff4/action.yml), immutable upstream source | Action v2.0.2 runs on Node 24 and retains default CLI 1.3.1. | Apply random PR #60's single SHA update without changing CLI inputs, release permissions or triggers; qualify the actual bundle locally. |
| [GitHub secure use](https://docs.github.com/en/actions/reference/security/secure-use?learn=getting_started&learnProduct=actions), official guidance | Verify full action SHA against the upstream repository. | Retain full-SHA pinning and verify tag checkout identity. This is not a claim that every transitive action dependency is immutable. |
| [Dependabot commands](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-pull-request-comment-commands), official documentation | Rebase is available through a bot command; ignore commands also change future update preferences. | Inspect freshness/conflicts. Close a locally applied superseded PR after pushing; do not ignore dependencies or force-push bot branches. |

## Pros and cons

| Choice | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Keep Apple on legacy fetch | Small immediate diff; existing proxy behavior | Independent lifetime/admission; cancellation does not prove native retirement | Remove the now-unused legacy adapter |
| Reuse application HTTP owner | One four-slot limit for all three catalogue providers, including preparation/drain; existing TLS/body policy | More contention can return unavailable; fresh connections cost setup; configured proxy refuses dispatch | Implement |
| A separate Apple HTTP singleton/service | Independent provider capacity | Duplicated resource policy and another ownership/deployment boundary | Do not add |
| Extract signing/cache without changing policy | Smaller client; signature and renewal can be tested independently; existing exports remain | Retains the existing long-lived token policy and permissive local key input handling | Implement now; review token policy next |
| Merge a dependency PR | Convenient GitHub merge record | Conflicts with the requested local application/no-merge workflow | Apply the exact reviewed diff on main and test locally |

## Final recommendation stack

1. Shared native HTTPS owner for Spotify, YouTube and Apple Music: four total
   requests, no queue, existing deadlines, byte limits and resource retirement.
2. Small Apple developer-token factory and thin catalogue client; preserve JWT,
   cache, storefront, pagination/includes and existing error contracts.
3. Strict Apple destination policy plus existing sanitized response classification;
   independently qualify actual native transport and real saved-key wiring.
4. SHA-pinned ORAS action update from PR #60, tested without registry publication
   or release dispatch. Keep unrelated fresh Dependabot work independent.
5. Next review explicit P-256 private-key admission and developer-token lifetime
   policy. Apple's six-month maximum is a ceiling, not a recommendation to use
   that lifetime. Shorter tokens reduce exposure but require compatible renewal.

Body limits reduce accepted input and four slots bound admitted work. Neither
proves a heap/RSS ceiling or whole-container memory minimum. See the separate
[design](APPLE_HTTP_DESIGN.md), [outcome](APPLE_HTTP_OUTCOME.md) and
[PR design](DEPENDABOT_ORAS_DESIGN.md).
