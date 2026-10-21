# Metadata command authority research and recommendations

Consulted 2026-10-21 through MCP search, official source reads and GitHub PR search.
Project baseline is Node 24.22.0, Vue 3.5.44 and Vue Router 5.2.0; final validation
checks the installed versions. The separate [design](METADATA_COMMAND_AUTHORITY_DESIGN.md)
maps each command to its actual handler.

| Primary source / status | Applicable implementation |
| --- | --- |
| [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), informative security guidance | Keep every server permission check. Use exact admin presentation/dispatch decisions for privileged commands, deny missing capability inputs, and prove native HTTP refusal independently of hidden controls. |
| [Vue props](https://vuejs.org/guide/components/props), framework documentation | Derive live access in the parent and pass one-way Boolean capabilities to children, with explicit false defaults. Do not infer permission from loading state or a provider row. |
| [W3C Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html), informative explanation of WCAG 2.2 SC 2.4.3 | Keep surviving native controls in logical order and test actual keyboard opening/activation. |
| [W3C H91: HTML form controls and links](https://www.w3.org/WAI/WCAG21/Techniques/html/H91), informative technique for keyboard and name/role/value behavior, updated January 26, 2026 | Retain native buttons with visible accessible names and keyboard activation. Preserve the distinct Open/read and Import/write actions as a project convention. This is not a link-purpose conformance claim about buttons. |

The command matrix and workflow predicate are project design conclusions from
these principles and source review. W3C does not prescribe this permission model.
Selected checks do not establish full WCAG conformance or screen-reader output.

| Option | Pros | Cons / limits | Decision |
| --- | --- | --- | --- |
| Make the whole Metadata browser admin-only | Small route change | Removes supported operator reads and authenticated artist import | Reject |
| Hide buttons only | Small rendering change | Stale emitted events can still reach workflow dispatch | Insufficient |
| Shared exact-role policy, explicit component props and default-deny workflow predicates | Clear ownership, preserved Open branches, no new global service, safe omitted inputs | A few explicit bindings; cached role display can lag server authority | Implement |
| Add another mandatory session request before every command | Earlier UI revocation feedback | Duplicates the server's fresh check and adds another async failure/race mechanism | Defer |

Recommended stack: independent fresh server authorization/CSRF; small ESM policy;
live parent capabilities; guarded workflow dispatch; native Open/Import controls;
focused tests plus selected browser/native HTTP checks; stable fast gate;
preserved no-cache readiness. Keep provider simulation separate from durable proof.

MCP found zero open PRs. No random open candidate is applicable this round; do not
create an unrelated dependency patch or merge a closed PR to satisfy selection.
