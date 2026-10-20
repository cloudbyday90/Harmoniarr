# Saved-search recovery research and recommendation

Consulted 2026-10-20 through MCP search and GitHub metadata. These are applicable
sources verified in October 2026, not claims of October publication.

| Practice | Official source and status | Application |
| --- | --- | --- |
| Accessible keyboard and status feedback | [WCAG 2.2](https://www.w3.org/TR/WCAG22/), W3C Recommendation, 12 December 2024; [status explanation](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html?trk=article-ssr-frontend-pulse_little-text-block), informative | Native Search again control; established polite feedback, pending state and focus ownership. Browser evidence cannot establish complete WCAG or screen-reader conformance. |
| Object authorization | [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), security guidance | Reuse current target resolution and locked write eligibility. UI visibility is not authorization. |
| Retry semantics | [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), HTTP standard | An absent/expired continuation is not evidence authorizing another POST. A deliberate new generation uses the existing durable command. |
| Concurrent writes | [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html?trk=article-ssr-frontend-pulse_little-text-block), official implementation documentation | Conditional UPDATE fences the failure to its current claim; existing transaction locks serialize Search again and target checks. |

The mapping from these standards to Harmoniarr's generation/claim model is a
project design decision. Neither WCAG nor HTTP prescribes this schema.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Automatically replace missing/expired searches | Minimal operator effort | Repeats uncertain provider work; hides consent and stale authority | Reject |
| Add a second recovery queue/API | Dedicated workflow | Duplicates target, replay, audit and worker infrastructure | Reject |
| Current-claim stop plus existing Search again | Explicit intent, small change, existing security boundaries | Requires a user action; external approval owner needs a separate slice | Recommend |

Recommended stack: WCAG 2.2 interaction semantics; OWASP object authorization;
RFC 9110 mutation discipline; PostgreSQL conditional writes and existing locks;
ESM policy modules, service factories and existing Vue command composables.
Use focused native database/browser evidence plus one final fast gate. Do not
repeat unrelated native transfer matrices for a recovery-state change.

Open PR #48 was selected from the one-item open pool using a fresh random draw
0.8326014384918252. The MCP patch still proposes TypeScript 6.0.3 to 7.0.2 at
head `9898af07e914b132b7eb953eb96cde30d6ee865c`:
[PR #48](https://github.com/cloudbyday90/Harmoniarr/pull/48).
The unchanged Vue consumer failure is documented in
[its prior evaluation](OPEN_PR_48_SEARCH_CONTINUATION_EVALUATION.md).
Recheck package/lock/installed consumer inputs before reusing that result; do not
merge, close or rebase an incompatible dependency upgrade to imply it is fixed.
