# Empty external-search policy research and choices

Consulted 2026-10-20 through MCP search and opened primary results. These sources
are current consulted guidance, not a claim of blanket standards conformance.

| Source and status | Applicable recommendation |
| --- | --- |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/?issue=64), W3C Recommendation; [focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) and [status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html?trk=article-ssr-frontend-pulse_little-text-block), informative WAI guidance | Keep native named controls, meaningful focus and persistent command feedback; explain blocked recovery and its deadline. |
| [OWASP API4:2023](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/), informative security guidance | Bound expensive repeated operations per resource as well as the HTTP rate limiter; tune limits to product needs. |
| [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), HTTP specification | POST has no inherent retry guarantee; retain the existing durable command identity after uncertain acceptance. |
| [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html?trk=article-ssr-frontend-pulse_little-text-block), database documentation | Serialize policy and replacement work under current row locks and commit the counter with required audit. |

The existing slskd response adapter already verifies final publication, strict zero
counts and an empty response endpoint. Reuse that qualified boundary rather than
equating zero accepted candidates with zero provider responses. Its existing
positive-count, cancellation and publication-gap controls remain relevant.

| Choice | Pros | Cons |
| --- | --- | --- |
| Unlimited immediate Search again | Simple, responsive | Repeated empty queries waste provider capacity; reservation expiry becomes a bypass. |
| Automatic retry/backoff | Less operator work | Creates searches without new consent; requires another scheduling lifecycle. |
| Durable intent cooldown and two explicit retries (selected) | Bounded cost, auditable consent, restart/replay safe | Additive schema; six-hour delay; exhaustion needs operator review. |
| Count operation history dynamically | Avoids new counter | History retention can reset the budget; expensive history scans; ambiguous retries. |

Recommended stack: qualified provider evidence → durable approved-intent policy →
existing transactional command and queue → server-owned review projection →
semantic Vue control/status → focused fast, PostgreSQL/HTTP and browser evidence.
Six hours and two extra searches are local policy judgments, not values prescribed
by OWASP or W3C. Keep broader configurable policy and explicit budget-reset design
as future work if operational evidence justifies them.

The fresh random draw was 0.7160992987264855 from the sole open PR,
[#48](https://github.com/cloudbyday90/Harmoniarr/pull/48), head
`9898af07e914b132b7eb953eb96cde30d6ee865c`. MCP returned the complete unchanged
TypeScript 6.0.3 → 7.0.2 patch. Local package/lock and actual Vue consumer inputs
were rechecked against the retained passing control/failing candidate: unchanged.
The TypeScript 7 candidate still lacks the `tsserver.js` consumer entrypoint; its
Vue language-server result is incomplete, while the TypeScript 6 control completes.
The incompatible upgrade remains unapplied; no PR was merged, closed or rebased.
