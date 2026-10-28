# Storage folder browser research

Consulted October 28, 2026 using MCP search and opened official sources. Applies
to installed Vue 3.5.44, Router 5.4.0 and Chromium 156.0.8078.4. These sources
inform this component's behavior; they do not establish full WCAG conformance.

| Official source / status | Applicable decision |
| --- | --- |
| [W3C APG modal dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) — informative guidance | Name the dialog from its visible heading, deliberately place initial focus, keep keyboard interaction modal and return focus to its invoker. |
| [W3C Label in Name](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name) — informative explanation of WCAG 2.2 SC 2.5.3 | Keep visible Browse in each accessible name and append its destination. The ellipsis need not be pronounced. |
| [Chrome native dialog guidance](https://developer.chrome.com/docs/modern-web-guidance/guides/ui-components/dialog) — vendor implementation guidance | Use showModal/close, autofocus and native Escape/focus containment/return. Avoid a second focus trap or redundant role/aria-modal/inert scripting. |
| [W3C APG listbox](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/) — informative guidance | Listboxes imply option selection and arrow-key behavior. Folder navigation is implemented as native buttons in an ordinary list instead. |
| [Vue useId](https://vuejs.org/api/composition-api-helpers.html) — framework API documentation | Generate the dialog heading association once in component setup. |
| [Vue scope disposal](https://vuejs.org/api/reactivity-advanced.html) — framework API documentation | Retire the read owner with its component scope. Explicit close also retires it before unmount. |

The read-ownership recommendation is an application inference: aborting fetch
reduces unnecessary work, while a current-request identity check prevents an old
result from publishing even when cancellation is ignored. A failed read cannot
authorize selection of the default root or an earlier successful path. The
existing administrator-only filesystem endpoint remains the server authority.

## Options and tradeoffs

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Only rename Browse buttons | Small change; distinguishes destinations | Leaves unnamed dialog, unconfirmed selection and stale-read defects. Insufficient. |
| Native dialog plus scoped read owner | Browser supplies modal behavior; narrow ESM composable owns cancellation and confirmed state | Requires lifecycle and real-browser tests. Selected. |
| Custom modal/listbox widget | Could supply a richer file-picker interaction | Requires a complete keyboard/focus model and more maintenance. Unnecessary for navigation buttons. |
| Reuse stale-while-revalidate resource | Existing general read abstraction | Stale selectable paths are inappropriate here; current abstraction lacks per-intent abort/identity admission. Keep its unrelated callers unchanged. |

## Final recommendation stack

1. Destination-specific Browse names and a heading-named native dialog.
2. Native focus entry, Escape and close-before-unmount return; ordinary navigation buttons.
3. One component-scoped AbortController/current-request owner; select only confirmed latest success.
4. Persistent status feedback, explicit Retry and synchronous navigation focus recovery.
5. Draft-only selection with the existing explicit settings save and server authorization.
6. Focused lifecycle tests, real-browser reflow/zoom checks and preserved packaged runtime evidence.

No new service/container, dependency, schema refresh, database migration or
maintenance job is required. Directory paging/search is a possible next task;
it needs a separate server contract and should not silently truncate results.
