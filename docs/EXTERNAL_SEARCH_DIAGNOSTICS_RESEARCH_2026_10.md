# External-search diagnostic recommendations and tradeoffs

Consulted 2026-10-20 using MCP search and opened primary results.

| Official source / status | Applied practice |
| --- | --- |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/?cq_net=g), W3C Recommendation; [status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html?trk=article-ssr-frontend-pulse_little-text-block), informative WAI guidance | Use semantic persistent details and meaningful links; retain existing status feedback after Refresh without redundant assertive announcements or focus movement. |
| [OWASP REST Security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html), informative guidance | Validate type/range and authorize review; expose fixed useful diagnostics without technical/private payloads. |
| [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), HTTP specification | Keep review GET and navigation free of requested domain mutations; policy changes/retries retain their existing explicit commands. |

These practices guide the implementation; they do not certify general accessibility
or security conformance. Filtering results are not form-input errors, so WCAG error
suggestion criteria are not asserted as a direct requirement for this feature.

| Option | Pros | Cons |
| --- | --- | --- |
| Keep generic no-candidate failure | Minimal code | Operator cannot distinguish ignored sources, malformed files or an empty provider. |
| Expose raw diagnostics/payloads | Maximum debugging detail | Leaks peer/path information; unbounded fields; poor product guidance. |
| Bounded counters plus fixed reasons and internal navigation (selected) | Useful, private, testable; reuses existing jobs/review | Deliberately omits per-peer evidence; historical jobs may lack diagnostics. |
| Automatically relax policy or search again | Fewer clicks | Changes saved intent and consumes provider work without deliberate consent. |

Recommended stack: existing ingestion evidence → strict shared projection → current
job-bound store read → focused Vue presentation → explicit existing correction and
saved-search retry flows. No dependency, migration, new command or automatic policy
relaxation is needed. Unknown evidence remains unknown; suggestions must correspond
to a verified product surface.

The random draw was 0.35598886709678357 from the sole open PR,
[#48](https://github.com/cloudbyday90/Harmoniarr/pull/48), head
`9898af07e914b132b7eb953eb96cde30d6ee865c`. MCP returned the complete unchanged
TypeScript 7 upgrade patch. Package/lock and installed Vue consumer inputs were
rechecked against the retained passing TypeScript 6 control/failing TypeScript 7
candidate: unchanged. The candidate lacks the consumer's `tsserver.js` entrypoint
and does not complete; the control completes. PR #48 remains unapplied. No PR was
merged, closed or rebased.
