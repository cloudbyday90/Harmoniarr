# CSRF recommendations, October 2026

Consulted 2026-10-19 through MCP search/open and GitHub metadata. URLs below were
discovered through those services; source status is separate from project policy.

| Official source | Application |
| --- | --- |
| [OWASP CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) | Informative security guidance: validate a session-bound token on protected writes; refuse missing/mismatched tokens. Reuse the existing server-side session token hash and header comparison. Keep tokens out of logs/URLs. |
| [OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) | Informative guidance: explicit SameSite and HttpOnly cookie attributes complement CSRF tokens. Existing Strict refresh cookies are a separate boundary, not proof that default token enforcement is unnecessary. |
| [W3C Fetch Metadata](https://www.w3.org/TR/2026/WD-fetch-metadata-20260921/) | September 21 Working Draft. Request context can support additional refusal rules; adoption needs trustworthy-origin, missing-header and client compatibility decisions. It does not replace the existing session/token contract in this change. |
| [Router issue 2851](https://github.com/vuejs/router/issues/2851) and [PR 50](https://github.com/cloudbyday90/Harmoniarr/pull/50) | Vendor issue and package proposal, not standards. The issue is currently closed; local execution of the exact published candidate determines whether that version still exhibits the reported composition failure. |

## Alternatives and recommendation

| Option | Pros | Cons |
| --- | --- | --- |
| Document that operators must enable protection | No runtime compatibility change | Leaves the code's default at odds with documented protection; rejected |
| Require tokens by default, retain explicit opt-out | Reuses current ownership and token issuance; protects missing-row upgrades | Existing clients omitting headers need adjustment; saved disabled values still need review |
| Rewrite every saved disabled value to required | Broadens enforcement immediately | Cannot distinguish intentional opt-out; risks changing explicit operator policy; rejected |
| Replace token enforcement with origin/Fetch Metadata filtering | Additional useful request context | Needs separate deployment/browser policy; does not repair this default contract alone |
| Remove all public auth exceptions | Fewer apparent exceptions | Deadlocks bootstrap or breaks current refresh/login flows; rejected |

Recommended stack: modular Node 24 ESM, Express 5.3.0, Vue 3.5.44, Router 5.2.0,
reviewed pg 8.23.1 and PostgreSQL 18, TypeScript 6.0.3/language-server 6.0.2,
default-required session-bound CSRF headers, explicit saved/environment
opt-out with documented precedence, Strict/HttpOnly session cookies and existing
JSON body restrictions. Preserve current authorization and rate limits. Enable
HTTPS/secure cookies/HSTS according to actual deployment TLS; do not force those
settings for supported local HTTP. Consider Fetch Metadata separately after this
default contract is verified. The [design](CSRF_DEFAULT_PROTECTION_DESIGN.md) and
[outcome](CSRF_DEFAULT_PROTECTION_OUTCOME.md) distinguish facts and coverage limits.
