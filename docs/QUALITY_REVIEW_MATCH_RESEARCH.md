# Quality-review match selection research

Reviewed October 23, 2026. URLs were discovered and opened through the connected
MCP search service. These are official sources; implementation choices below are
project-specific applications of their guidance.

| Source | Applicable practice | Application |
| --- | --- | --- |
| [W3C APG disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) | Native button, Enter/Space, accurate expanded state and controlled content | Reveal existing choices without navigation or automatic focus movement |
| [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html?trk=article-ssr-frontend-pulse_little-text-block) | Expose command status to assistive technology | Reuse the existing command feedback and focus owner |
| [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Deny by default, check permissions at the action boundary, test authorization | Resolve recipient on the server and revalidate shared ownership inside the transaction |
| [PostgreSQL 18 concurrency](https://www.postgresql.org/docs/18/mvcc.html) | Maintain integrity across concurrent sessions | Reuse canonical account, release, discovery and candidate locks; read current facts after waiting |

APG and Understanding documents are informative implementation guidance. They do
not certify this application. PostgreSQL guidance is matched to the packaged major
version rather than an assumed latest version.

## Options and tradeoffs

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Continue advanced-diagnostics handoff | Minimal implementation | Recipient workflow remains incomplete | Reject |
| Reuse the current chooser without a write guard | Small UI change | Stale scope and policy can cross the read/write boundary | Reject |
| Reuse chooser with a scoped transactional owner | Consistent UI, bounded public data, current shared policy, atomic evidence | Additional policy and contention tests | Recommend |
| Create a second application or transfer service | Independent workflow | Duplicated authority, deployment and memory cost | Reject |

## Final recommendation stack

1. Built-in release disclosure and existing mutation/focus/feedback owners.
2. Server-derived recipient scope and bounded candidate facts.
3. Shared current-policy eligibility with no consent copying or quality downgrade.
4. Canonical PostgreSQL locks and atomic transition/event/audit.
5. Focused tests, real SQL/HTTP and browser evidence, preserved local rebuild.

GitHub MCP returned zero open PRs for cloudbyday90/Harmoniarr at the initial check;
there is no applicable random PR to implement or rebase this round.
