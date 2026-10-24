# Initial quality-preflight review research

Official sources discovered and opened through connected MCP search on 2026-10-23. These recommendations apply the guidance to this workflow; they do not certify general security or accessibility conformance.

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html): deny by default, check current permissions at the action boundary, and test business authorization. Application: measured audio evidence does not authorize a later write after recipient or acquisition state changes.
- [PostgreSQL 18 transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html) and [concurrency control](https://www.postgresql.org/docs/18/mvcc.html): transaction visibility and locks must support the intended consistency rule. Application: reuse the existing lock order, re-read after locks and commit candidate/history/audit together. Long media inspection stays outside the transaction.
- [W3C WCAG 2.2 Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html?trk=article-ssr-frontend-pulse_little-text-block): informative guidance on making status changes available without moving focus. Application: preserve the existing Missing Music feedback/focus behavior and verify rendered review guidance, not merely an internal enum.
- [W3C WCAG 2.2 Understanding Error Suggestion](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html): informative guidance about actionable corrections for rejected user input. Downloaded-media failure is not necessarily a user input error; our analogous design principle is to explain the safe repair or review action without exposing paths or worker output.

## Options and decision

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Existing guarded add-review event and public projection | Durable and scoped; existing repair actions; no schema or parallel workflow | Requires final snapshot checks and migration of old fixture assumptions | Adopt |
| UI-only warning or computed live preview | Small presentation change | Lost on restart; repeats expensive inspection; does not prove a committed stop | Reject |
| Allocate an apply run solely to record failure | Reuses worker result shape | Queues work already known to be unsafe and obscures initial/worker boundaries | Reject |
| Automatically relax quality or promote a fallback | May appear to recover faster | Changes saved intent and can bypass review or shared consent | Reject for this change |

## Final recommendation stack

Actual media gate → captured current release/participant scope → existing prepared-add transaction guard → bounded candidate review event and required audit → existing Missing Music review/tool-recheck action → focused SQL/browser/packaged qualification.

The added cost is one short guarded write after a real refusal. No new runtime service, queue, standards framework or storage table is needed. Initial GitHub MCP selection returned zero open PRs; recheck before publication.
