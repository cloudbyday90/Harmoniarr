# Provider callback feedback research

Consulted October 28, 2026 through Search/GitHub MCP. Source URLs were discovered
and opened, including official navigation links. Current implementation uses
Vue 3.5.44, Vue Router 5.4.0, Playwright 1.64.1 and ESM on Node 24.22.1.
Initial GitHub search found no open PRs.

| Official source/status | Applicable practice | Decision |
| --- | --- | --- |
| [W3C status-message understanding](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html?trk=article-ssr-frontend-pulse_little-text-block), informative WCAG 2.2 guidance | Status updates should be available without moving focus; avoid unnecessarily assertive announcements. | Persistent polite status feedback, native controls and no scripted focus restoration. Automated DOM checks do not certify spoken output. |
| [W3C ARIA22](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22), informative technique updated January 12, 2026 | Establish role=status before adding the message; explicit atomic behavior improves context. | Mount an empty status paragraph before consuming the query. Keep controls outside the live region and pending refresh focusable with an activation guard. |
| [RFC 9700](https://datatracker.ietf.org/doc/html/rfc9700), BCP 240, January 2025 | Preserve callback binding and minimize credential leakage through referrers/history. | Treat callback parameters as untrusted hints, remove owned query fields and retain server callback/state/PKCE authority. Cleanup of the landing URL cannot erase earlier browser/proxy/server history. |
| [Vue Router navigation](https://router.vuejs.org/guide/essentials/navigation) and [guards](https://router.vuejs.org/guide/advanced/navigation-guards), official v4/v5 documentation | replace changes the current history entry; query-only navigation does not trigger per-route entry guards. | Watch query changes in the mounted workspace component; replace only owned callback fields while preserving path, unrelated query and hash. Preserve existing router guards. |

## Alternatives and recommendation

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Display raw query code or trust linked | Simple | Forged URLs can imply success or echo private text | Reject |
| Transient toast only | Reuses existing toast UI | Recovery instructions disappear before the user finishes reviewing them | Reject |
| Add callback handling to the large Connections view | Near connection controls | Misses the current Setup landing and increases view coupling | Reject |
| Small workspace component, pure policy and scoped status composable | Works on both landing and Connections; bounded text, server observation and explicit retry | One extra read for a recognized callback and explicit lifecycle/race handling | Implement |

Recommended stack: finite query-to-guidance policy, existing provider-status GET,
scoped abort/deadline/latest-result ownership, then persistent workspace feedback
and existing Connections navigation. A saved link is a point-in-time local
observation, not proof that the provider accepted this callback or still grants
access. Unknown/ambiguous hints cannot select a provider read. Retrying linking
remains an explicit action under existing fresh-admin/CSRF/state owners.

See the separate [design](PROVIDER_CALLBACK_FEEDBACK_DESIGN.md) and
[outcome](PROVIDER_CALLBACK_FEEDBACK_OUTCOME.md).
