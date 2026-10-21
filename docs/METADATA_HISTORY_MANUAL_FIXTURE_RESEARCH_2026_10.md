# Manual accessibility fixture research and recommendation

Consulted October 21, 2026. URLs were discovered and opened through MCP search,
not guessed. This is a focused recommendation for the Metadata history journey.

## Applicable official sources

| Source and status | Application and evidence boundary |
| --- | --- |
| [WCAG-EM 2.0, July 23, 2026 W3C Group Note](https://www.w3.org/TR/WCAG-EM/) | Record the sampled states, route to reproduce them, input/settings, browser/AT versions and private evidence. A Group Note is evaluation guidance; this focused fixture does not establish a full conformance evaluation. |
| [WAI involving users in evaluation, informative guidance](https://www.w3.org/WAI/test-evaluate/involving-users/) | Have an operator exercise actual speech/navigation and report the evaluated scope. One pairing does not establish all users' experience. |
| [WCAG 2.2, W3C Recommendation](https://www.w3.org/TR/WCAG22/?cq_net=g) and [Focus Order understanding, informative](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Preserve meaningful keyboard navigation and observable status behavior in continuing/final/pending/retry states. The existing production owner supplies these behaviors; the fixture makes them reachable. |
| [Playwright accessibility testing, framework guidance in its next documentation](https://playwright.dev/docs/next/accessibility-testing) | Automated checks cover some common problems; combine them with manual assessment and inclusive evaluation. DOM focus/status checks are fixture qualification, not speech proof. |
| [Playwright BrowserContext API, framework contract](https://playwright.dev/docs/api/class-browsercontext) | Use an owned nonpersistent context for automated qualification. Manual operators use an ordinary private browser window and report its actual version. Installed qualification baseline is Playwright 1.64.1. |
| [OWASP attack surface analysis, security guidance](https://cheatsheetseries.owasp.org/cheatsheets/Attack_Surface_Analysis_Cheat_Sheet) | Review the new local server boundary and minimize admitted paths/commands. The loopback, exact-origin route guard and terminal-only controls are project design choices informed by that guidance. |
| [IETF RFC 9110, HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110.html) | Safe-method semantics concern requested state changes; GET alone is not containment against provider traffic. Explicitly refuse provider-backed GET routes as well as domain mutations. |
| [Docker port publishing, official implementation guidance](https://docs.docker.com/engine/network/port-publishing/) and [Testcontainers PostgreSQL, framework API](https://node.testcontainers.org/modules/postgresql/) | A published port has broader default bindings unless constrained. Use an explicit loopback mapping and inspect it. The reviewed local bridge-default candidate failed this invariant, so the manual adapter uses Docker's public CLI while preserving the integration database interface. |

WCAG-EM 2.0's recordkeeping section identifies reproducibility data and notes
that records can contain sensitive information. Keep recordings, credentials
and raw diagnostic artifacts private; publish bounded reviewed outcomes. A
passing subset or a numeric score does not grant a WCAG conformance claim.

## Options and tradeoffs

| Option | Benefits | Costs / limits | Decision |
| --- | --- | --- | --- |
| Existing preserved walkthrough history | Actual deployed environment and saved data | Sufficient pages and pending/error states are not guaranteed; real provider work would be unrelated | Retain for deployment checks |
| Standalone copied history component | Cheap, no database | Can drift from actual shell/session/routes and focus composition | Decline |
| More assertions in the automated engine matrix | Repeatable regression evidence | Cannot establish actual screen-reader speech or physical safe-area behavior; increases routine cost if made default | Keep the existing explicit lane |
| Real app with synthetic read owners and disposable database | Actual components/routes, reproducible loading/error/retry, no live provider preparation, works in an operator's installed browser | Needs Docker and local startup; catalog and health summaries are fixtures; desktop only | Implement this round |
| Expose the fixture over LAN for phones | Can reach another device | Adds authentication/network/origin deployment concerns and still needs actual hardware/AT observations | Defer to separately owned device acceptance |

## Recommended stack and method

1. Keep production Vue/native controls, shared focus/status owners and ESM service
   boundaries; do not add production test endpoints.
2. Reuse the existing real Express/PostgreSQL fixture lifetime with fresh ownership,
   synthetic cursor data and a narrow server-side route guard.
3. Use fast controller/native HTTP checks for ordinary feedback and one explicit
   database/browser fixture qualification. Keep the large engine/zoom lane opt-in.
4. Apply W3C evaluation recordkeeping and actual operator AT observations, with
   OWASP containment and RFC method semantics at the local fixture boundary.
5. Conduct physical safe-area/on-screen-keyboard acceptance separately, recording
   actual device conditions and any unperformed checks.

The high-value skill improvement is a narrow manual-evaluation reference in
`harmoniarr-web-standards`, routed from its entrypoint. It teaches how to prepare
states, protect the test boundary and separate fixture/DOM proof from actual AT
results without creating another overlapping standards skill.
