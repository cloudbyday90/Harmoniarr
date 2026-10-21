# Settings landing research and recommendation stack

Consulted 2026-10-21 through MCP search and official navigation. Installed project
baseline: Node 24.22.0, Vue 3.5.44 and Vue Router 5.2.0. These selected practices
guide the implementation; they do not establish general standards conformance.

| Primary source / status | Applicable implementation |
| --- | --- |
| [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), informative security guidance | Keep API permission checks independent of presentation. Require exact current admin for Setup; unknown roles cannot enter it. Test the actual HTTP boundary separately. |
| [Vue Router navigation guards](https://router.vuejs.org/guide/advanced/navigation-guards), framework documentation | Await session verification before page confirmation, return a named Account redirect with replacement history, retain authentication precedence and avoid a redirect loop. |
| [W3C Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html), informative explanation of WCAG 2.2 SC 2.4.3 | Preserve native keyboard navigation and meaningful surviving link order; test actual focus and verification-failure recovery. |
| [W3C Consistent Navigation](https://www.w3.org/WAI/WCAG22/Understanding/consistent-navigation), informative explanation of SC 3.2.3 | Keep global Settings in its existing position and retain relative subnavigation order while filtering unavailable Setup/Connections. This source permits insertion/removal while preserving relative order. |

The named Account destination and dropping Setup query/hash at the role redirect
are project design decisions inferred from these principles and the actual route
contracts. W3C does not mandate this role model or a specific redirect target.

| Option | Pros | Cons / limits | Decision |
| --- | --- | --- | --- |
| Redirect only from the Setup component | Small local patch | Mounts and protected readers can run before authority is established | Reject |
| Separate root policy and second session mechanism | Explicit root behavior | Duplicates the existing current-session mechanism and precedence | Reject |
| Extend area policy and reuse common guard | Consistent Setup/Connections admission, small ESM owner, Account stays usable | One verification read for cached Setup entry; mounted pages still depend on API refusal | Implement |
| Change all Settings permissions together | Broader eventual consistency | Unreviewed tabs and recovery/Account contracts could regress | Defer to individual contract review |

Recommended stack: independently authorized APIs; focused Settings area policy;
one common current-session guard; named role redirect; native filtered navigation;
cheap semantic tests plus one selected browser cohort; stable fast gate; preserved
no-cache readiness. Avoid another permission registry or broad router rewrite.

MCP open-PR search returned no open PRs. Refreshed metadata confirms the previous
[PR #54](https://github.com/cloudbyday90/Harmoniarr/pull/54) is closed without merge,
and its exact QEMU pin is already on main from the preceding round. There is no
open candidate to randomly select or implement in this round; no PR merge or
rebase is needed.
