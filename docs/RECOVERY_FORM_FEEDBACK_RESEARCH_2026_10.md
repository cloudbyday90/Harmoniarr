# Recovery feedback research and recommendations

Consulted October 21, 2026 through MCP discovery, primary-page opens and official
navigation. Existing Vue 3.5.44/Router 5.2.0/Playwright 1.64.1 are sufficient.

| Primary source and status | Relevant practice | Project decision |
| --- | --- | --- |
| [WAI ARIA21](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA21), informative technique | Identify validated fields and connect correcting text. | Reuse confirmation focus/invalid/description policy for local mismatch. |
| [WAI ARIA19](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA19), informative technique | Keep live error containers available before updating content. | Persistent shared feedback survives loading and unavailable branches. |
| [WAI form notifications](https://www.w3.org/WAI/tutorials/forms/notifications/?trk=public_post_comment-text), informative tutorial | Clear errors and a correcting focus path aid completion. | Local correction can focus confirmation; delayed global errors retain later focus. |
| [OWASP recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html?trk=public_post_comment-text), informative security guidance | Recovery codes should expire, be single use and resist brute force; account changes require valid proof. | Keep actual server code/expiry/attempt/hold/session rules, no automatic retry or credential logging. The operator-armed flow is not an email-reset implementation. |
| [Vue watchers](https://vuejs.org/guide/essentials/watchers.html), framework guidance | Obsolete asynchronous results need cleanup/ownership. | Use a per-owner read revision and refuse late publication after submit/completion/destroy. No new global store. |
| [Vue composables](https://vuejs.org/guide/reusability/composables), framework guidance | Narrow composables encapsulate stateful work and own side-effect cleanup. | Reuse shared feedback/confirmation while retaining the recovery-specific POST/refresh owner. |
| [Vue computed properties](https://vuejs.org/guide/essentials/computed), framework guidance | Computed caching follows reactive dependencies; Date.now alone does not tick. | A controlled probe confirms the existing display gap. Make a reactive countdown a separate follow-up; server expiry remains authoritative. |

The request fence is a project implementation decision, not an alternative to
server authorization or a requirement imposed by WCAG. Techniques do not establish
conformance, and native DOM assertions do not establish spoken output.

## Options and tradeoffs

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Mark only the existing error paragraph as alert | Tiny change | Failure reload still erases it; duplicate and late reads remain | Insufficient |
| Reuse login's entire submission wrapper | Shared general feedback | Competes with recovery's POST/refresh/status owner | Reuse presentation/confirmation only |
| Strengthen the existing recovery owner | Preserves failure, refreshed budgets and completion ordering without dependencies | Needs focused race and native server refusal tests | Implement |
| Change server gates while updating UI | Could address separate server findings | Expands risk without a reproduced authority defect in this slice | Defer |

Recommended stack: native semantic inputs, shared Vue feedback/confirmation,
small ESM recovery-state ownership, existing server verification and durable
attempt/hold/session rules, focused race tests, native browser/PostgreSQL proof,
then actual operator/device acceptance. Extend the current standards AI skill;
another overlapping skill would make routing less precise.
