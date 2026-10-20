# Shared-search count recommendations and tradeoffs

Consulted 2026-10-20 through MCP search, primary-source opens and official W3C navigation.

| Source / status | Applied practice |
| --- | --- |
| [W3C Info and Relationships](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships), informative WCAG 2.2 explanation | Use explicit unit labels and semantic description lists so count/value relationships survive presentation changes. |
| [W3C Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html?trk=article-ssr-frontend-pulse_little-text-block), informative guidance | Retain existing Refresh feedback and user focus; avoid redundant announcements for persistent evidence. |
| [OWASP REST Security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html), informative guidance | Authorize the target read and validate bounded numeric output; omit raw provider and technical evidence. |
| [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), HTTP specification | Keep diagnostic reads free of requested domain mutations. |

| Choice | Pros | Cons |
| --- | --- | --- |
| Rename the mixed total | Small edit | Still combines different units; canonical Missing Music remains unchanged. |
| Separate counters in advanced Wanted only | Fixes the actual old display | Requires users to leave canonical review; duplicates projection if expanded later. |
| Shared bounded projection/presenter plus scoped inspector (selected) | Consistent units, private output, canonical visibility, preserves actions | Small server DTO addition; historical or malformed evidence is omitted. |
| Expose raw diagnostics or automatically retry | More detail/fewer clicks | Leaks unbounded evidence or changes intent/provider work without a deliberate command. |

Recommendation stack: authorized release → allowlisted counters → shared fixed
presentation → canonical/advanced semantic views → existing explicit commands.
These are applicable practices, not a blanket standards-conformance claim.

Random draw 0.48760510811465574 selected the sole open
[PR #48](https://github.com/cloudbyday90/Harmoniarr/pull/48), head
`9898af07e914b132b7eb953eb96cde30d6ee865c`. MCP returned its complete TypeScript 7
patch. Package/lock and installed Vue consumer inputs were rechecked against the
retained passing TypeScript 6 control/failing TypeScript 7 candidate: unchanged.
The candidate lacks the consumer's `tsserver.js` entrypoint and remains incomplete;
the control completes. The PR remains unapplied; no merge, closure or rebase occurred.
