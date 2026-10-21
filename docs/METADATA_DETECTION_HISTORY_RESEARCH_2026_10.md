# Metadata detection-history research and recommendations

Consulted 2026-10-21 through MCP search and official reads. The installed baseline
is Node 24.22.0, Vue 3.5.44 and Vue Router 5.2.0; final verification checks it.
The [design](METADATA_DETECTION_HISTORY_DESIGN.md) maps the selected practices.

| Official source / status | Application |
| --- | --- |
| [Vue side-effect cleanup](https://vuejs.org/guide/essentials/watchers), framework documentation | Retire async work when its input changes. Reuse explicit generation owners instead of adding more watchers to these factories. |
| [WHATWG DOM Standard](https://dom.spec.whatwg.org/), living normative specification | Pass an AbortSignal to the existing GET adapter. Treat cancellation and a request's completion/publication as separate boundaries; retain currency checks when dependencies ignore abort. |
| [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), informative security guidance | Preserve per-request server session checks and bounded paging. A UI token grants no API authority and does not replace server validation. |
| [W3C Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html), informative WCAG 2.2 explanation | Preserve native controls and avoid late responses disrupting a user's current interaction. Selection-owned content and focus checks are project design applications, not proof of complete SC 2.4.3 conformance. |

The dual-token reset contract is a project design conclusion from these principles
and reproduced races. No source prescribes this exact composable or certifies it.
No new live region, assistive-technology testing or blanket accessibility audit
is implied by the chosen focus checks.

| Option | Pros | Cons / limits | Decision |
| --- | --- | --- | --- |
| Check artist ID only | Small patch | Same-ID reselection and same-artist catalog replacement can admit stale pages | Reject |
| Abort old GETs only | Stops cooperative reads | A response can arrive anyway; stale errors/cleanup remain possible | Insufficient |
| Separate history composable with workspace/page generations and reset hooks | Clear ownership, smaller artist workflow, handles replaced catalog and stale cleanup | Explicit reset integration; underlying reads can still finish | Implement |
| Global pagination/state framework | Could support unrelated readers | Broad coupling and migration with no demonstrated need | Defer |

Recommended stack: authenticated bounded GET; captured artist/cursor; workspace
and page generations; opportunistic read abort; guarded append/error/pending
publication; reset on navigation and catalog replacement; native interaction
checks; focused race tests and selected consumers; stable fast gate; preserved
no-cache Docker readiness.

MCP returned zero open PRs. No random candidate is available to implement locally,
merge or rebase this round; no unrelated dependency change is added.
