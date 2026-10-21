# Metadata command selection research and recommendations

Consulted 2026-10-21 through MCP search and primary-source reads. Installed
baseline: Node 24.22.0, Vue 3.5.44 and Vue Router 5.2.0. See the
[design](METADATA_COMMAND_SELECTION_DESIGN.md) for implementation ownership.

| Source / status | Applicable decision |
| --- | --- |
| [Vue watchers: side effect cleanup](https://vuejs.org/guide/essentials/watchers), framework documentation | Stale async work can complete after its input changes. Reuse the existing generation/abort owner and guard publication; a new watcher framework is unnecessary. |
| [RFC 9110, section 9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html), normative HTTP standard | Keep navigation cancellation of reads distinct from POST acceptance. Add no automatic command retries or claims that abort rolls back an accepted mutation. |
| [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), informative security guidance | Retain per-request server authorization and CSRF. A UI generation token is a presentation owner, not a security capability. |
| [W3C ARIA22 status messages](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22), informative accessibility technique | Status needs relevant context without a focus change. By project inference, an old queued-run message must not describe a new workspace. Preserve user focus when old responses arrive. This round does not add a live region or claim screen-reader/WCAG conformance. |

These sources inform the design; none prescribes Harmoniarr's generation-token
API or proves its correctness. The Vue 3.5 cleanup timing restriction matters
when registering watcher cleanup, but these existing factories use explicit
selection methods instead of creating more watchers.

| Option | Pros | Cons / limits | Recommendation |
| --- | --- | --- | --- |
| Compare artist/release IDs only | Small patch | Leaving and returning to the same ID can admit an obsolete response; stale cleanup can clear a new command | Reject |
| Abort every request on navigation | Can stop unused reads | An accepted POST may already have changed server state; abort alone cannot prevent stale publication | Reject as the sole guard |
| Capture selection generations and command targets; reuse read abort signals | Handles reselection, stale errors and pending state; retains server work and existing modular factories | Explicit token threading across follow-up reads; underlying requests can still complete | Implement |
| Replace workflows with a global command/state framework | Could centralize all async state | Larger migration and unrelated coupling without evidence of need | Defer |

Final recommendation stack: unchanged fresh server authorization/CSRF; captured
primitive command targets; monotonic selection generations; guarded result/error/
pending publication across every await; opportunistic read abort; native controls
and preserved focus; controlled race tests plus selected native HTTP/browser
consumers; one stable fast gate; preserved no-cache Docker readiness.

MCP returned zero open PRs. No random open candidate was available to implement,
merge or rebase; no unrelated dependency patch is introduced.
