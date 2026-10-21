# Settings authority research and recommendations

Consulted 2026-10-21 using MCP search, official navigation and GitHub PR search.
The repository uses Node 24.22.0, Vue 3.5.44 and Vue Router 5.2.0; verify installed
versions before final publication. See the separate [design/matrix](SETTINGS_AUTHORITY_DESIGN.md).

| Primary source / status | Applicable decision |
| --- | --- |
| [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), informative security guidance | Keep permission checks at every API request. A browser tab or recovery query is not authorization. Require exact admin on reviewed deployment pages and verify own-user preference isolation independently. |
| [Vue Router guards](https://router.vuejs.org/guide/advanced/navigation-guards), framework documentation | Reuse the awaited common guard before page confirmation; retain login/password precedence, fixed root redirection and bounded cancellation/retry. |
| [W3C Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html), informative WCAG 2.2 explanation | Retain native links and logical keyboard order after filtering. Restore focus only while the removed link's interaction still owns it. |
| [W3C Consistent Navigation](https://www.w3.org/WAI/WCAG22/Understanding/consistent-navigation) and [G61](https://www.w3.org/WAI/WCAG22/Techniques/general/G61.html), informative explanation/example technique | Preserve relative surviving navigation order; role filtering can remove unavailable destinations without rearranging the rest. |

The route matrix and mixed operator metadata decision are project conclusions
from handler and consumer review. W3C does not prescribe this role model. Browser
checks do not establish general WCAG conformance or assistive-technology output.

| Option | Pros | Cons / limits | Recommendation |
| --- | --- | --- | --- |
| Hide Media & storage only | Small patch | Other refused deployment pages remain advertised; direct/stale-role entry remains possible | Insufficient |
| Restrict all Settings to admin | Simple rule | Removes valid personal preferences/Account and existing operator metadata access | Reject |
| Extend the reviewed area policy from an explicit route/API matrix | One owner for navigation/admission; preserves distinct personal/operator contracts; small ESM change | Adds a verification request on new admin page entry; mounted pages still rely on API checks | Implement |
| Introduce a general permission framework now | Could support future capabilities | Larger migration without an established server capability contract | Defer |

Recommended stack: independent API authorization; explicit area-owned route
classification; one current-session guard; native role-aware navigation and focus;
cheap semantic tests; one selected native browser cohort; stable fast gate;
preserved no-cache readiness. Review mixed-page commands individually afterward.

MCP search found zero open PRs, so there is no random open candidate to apply in
this round. Do not invent a dependency change or merge an already closed PR.
