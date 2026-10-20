# Approved external search recovery: official practices and tradeoffs

Consulted 2026-10-20 through MCP search and official navigation. This records
guidance applicable in October 2026, not assumed publication dates.

| Practice | Verified official source and status | Implementation decision |
| --- | --- | --- |
| Keyboard focus and asynchronous feedback | [WCAG 2.2](https://www.w3.org/TR/WCAG22/), W3C Recommendation, 12 December 2024; informative explanations of [focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) and [status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html?trk=article-ssr-frontend-pulse_little-text-block) | Native control, stable polite feedback, pending guard and deliberate focus ownership. Automated checks do not prove screen-reader announcements or complete WCAG conformance. |
| Current authorization | [OWASP Transaction Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html?trk=article-ssr-frontend-pulse_little-text-block), security guidance | Reread recipient/request/approval at the locked execution boundary. Bind consent to the expected old run, not a client-supplied recipient. |
| Mutation and retry | [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), HTTP standard | Distinguish replay/read continuation from new provider intent; reuse durable command keys after uncertain HTTP outcomes. |
| Concurrent state changes | [PostgreSQL 18 locking](https://www.postgresql.org/docs/18/explicit-locking.html?trk=article-ssr-frontend-pulse_little-text-block) and [application consistency](https://www.postgresql.org/docs/18/applevel-consistency.html), implementation documentation | Current operation row locks plus an atomic supersession update and retry predicate; one transaction also owns intent/run/audit. |

The operation-generation and supersession model is a Harmoniarr design decision
derived from those practices; the standards do not prescribe it.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Renew the saved search in generic Retry | Fewer controls | Reinterprets retry as fresh provider consent and hides uncertain work | Reject |
| Re-approve the same release | Reuses an existing control | Current approval deliberately replays its original intent; broadens approval semantics | Reject |
| Explicit Search again on the current failed intent | Clear consent, existing queue, bounded scope, atomic audit/replay | More user interaction and concurrency checks | Recommend |

Recommendation stack: W3C interaction semantics; OWASP current object/transaction
authorization; IETF HTTP retry discipline; PostgreSQL row locks and conditional
writes; modular ESM policies/stores/service factories and focused Vue components.
Validate focused database/browser boundaries, then one stable complete fast gate.

The fresh random draw was 0.10610880406228906 from open PR pool `[48]`.
[PR #48](https://github.com/cloudbyday90/Harmoniarr/pull/48) still proposes
TypeScript 7.0.2 at head `9898af07e914b132b7eb953eb96cde30d6ee865c`.
Recheck its complete MCP patch and package/lock/installed Vue consumer inputs
against the retained [failed candidate](OPEN_PR_48_SEARCH_CONTINUATION_EVALUATION.md).
An unchanged incompatible candidate should stay unapplied; rebasing cannot repair
the missing language-server implementation. Do not merge the PR.
