# Runtime dependency recommendations, October 2026

Consulted 2026-10-19 through GitHub MCP and MCP web search/open. PR metadata and
official navigation supplied URLs; source status and scope are explicit below.

| Source | Applicable recommendation |
| --- | --- |
| [Express 5.3 release](https://github.com/expressjs/express/releases/tag/v5.3.0) and [source comparison](https://github.com/expressjs/express/compare/v5.2.1...v5.3.0) | Vendor source/release information. Review parser/proxy dependencies, response framing, download headers and error behavior. Qualify the app's real contracts; upstream advisories alone do not prove a project vulnerability or remediation. |
| [Express proxy guide](https://expressjs.com/en/5x/guide/behind-proxies/) | Framework guidance. Trust forwarded values only according to the deployed proxy policy. Retain the existing explicit deployment policy rather than broadly trusting headers. |
| [Vue 3.5.44 comparison](https://github.com/vuejs/core/compare/v3.5.43...v3.5.44) | Vendor implementation history, October 13 patch. Reviewed compiler, watcher, async placeholder/Suspense and DOM changes; test actual runtime/component consumers alongside builds. |
| [Router lazy routes](https://router.vuejs.org/guide/advanced/lazy-loading) and [guards](https://router.vuejs.org/guide/advanced/navigation-guards.html) | Framework guidance. Keep lazy import functions separate from async components; navigation guards may redirect/cancel asynchronously. Server authorization remains mandatory. |
| [Router issue 2851](https://github.com/vuejs/router/issues/2851) | Upstream report, not a normative contract. The local exact-shape reproduction and wrapping control establish a library regression; current app applicability must be evaluated separately. |
| [OWASP CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) | Informative security guidance. Retain server token validation and current session/role checks for mutations. SameSite and disabled UI controls are not substitutes. Verify refusal leaves durable state unchanged. |
| [W3C Fetch Metadata](https://www.w3.org/TR/2026/WD-fetch-metadata-20260921/) | September 21 Working Draft. Request context can inform defense in depth; it is not a replacement for this app's session/token contract. No new header policy or conformance claim follows from this dependency change. |
| [W3C Focus Order guidance](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Informative WCAG 2.2 understanding guidance. Verify meaningful keyboard navigation on rendered links and current child content; a few browser checks do not establish full WCAG compliance. |
| [Language-server v6 release](https://github.com/typescript-language-server/typescript-language-server/releases/tag/v6.0.0) | Vendor migration guidance. Node >=22.22.2 is required, compatible with the existing Node 24 baseline. Verify real requests with the retained TypeScript 6 compiler API. |

## Options and final recommendation stack

| Option | Pros | Cons |
| --- | --- | --- |
| Keep all current runtime packages | Minimal immediate change | Defers upstream Express and Vue fixes and leaves qualification unresolved |
| Adopt all of PR 49 | One complete group update | Includes a locally reproduced Router 5.4 composition failure |
| Adopt Express/Vue, retain Router 5.2 | Qualifies useful runtime patches without introducing the observed router regression | Partial group adoption; newer router features remain deferred |
| Patch dependency internals or wrap every route | Could work around the library trigger | Adds private maintenance or unnecessary product markup; rejected here |
| Adopt language server 6 with TypeScript 6 | Retains working compiler API while qualifying the dev-tool update | Separate Node floor and lifecycle/consumer validation remain necessary |

Recommended stack: Node 24 modular ESM; Express 5.3.0; Vue 3.5.44; Router 5.2.0;
reviewed pg and music-metadata versions; TypeScript 6.0.3 with locally qualified
language server 6.0.2. Retain existing session/CSRF/proxy/body-limit and durable
write ownership. Use focused contracts, selected native/browser controls and
fast checks on frozen source. Outcome documents distinguish executed evidence,
upstream reports, successful controls and unperformed coverage.

The existing default resolves CSRF protection to disabled; the security policy
calls for default protection on cookie-authenticated writes. This round proves
explicit required mode only. Prioritize a separate secure-default and deployment
compatibility fix before adding Fetch Metadata enforcement or changing router
composition. See the [qualification outcome](RUNTIME_DEPENDENCY_QUALIFICATION_OUTCOME.md).
