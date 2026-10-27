# Administrator schema diagnostics research — October 26, 2026

## Official sources and applicable decisions

Primary URLs were discovered and opened through the connected search MCP service.
The project runtime is Vue 3.5.44, Node 24.22.1 and PostgreSQL 18.6; no dependency
upgrade is part of this work. Normative requirements and project choices differ.

- [W3C WCAG 2.2 status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  is informative guidance for the normative criterion. It explains status
  announcements without moving focus. Implementation: a permanent polite/atomic
  status node, outside the busy result region; retain the refresh button and
  respect a user's focus move while the request is pending.
- [Vue accessibility documentation](https://vuejs.org/guide/best-practices/accessibility.html)
  recommends semantic content and controls. Implementation: a named section,
  heading, native type=button, descriptive text, definition lists and time element.
  ARIA does not prevent activation: the pending handler explicitly suppresses
  duplicate requests while aria-disabled keeps the existing focused button usable.
- [RFC 9111 HTTP caching](https://httpwg.org/specs/rfc9111.html), an IETF standard,
  defines the response no-store directive. Implementation: set it before auth so
  success, unauthorized, revoked and rate-limited responses all carry no-store.
  The client also asks not to store the request. This is not a privacy guarantee
  against a compromised client or a claim that old browser data is erased.
- [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends server-side, per-request authorization and safe failure. Inference:
  re-read administrator authority before scanning and again before publishing a
  potentially slow result, so role changes/revocation during work suppress output.
- The already qualified [read-only observation stack](SCHEMA_DRIFT_RESEARCH.md)
  remains the database owner. Its shared preparation fence, transaction limits,
  restricted-role behavior and rollback acknowledgement remain unchanged. UI
  observation adds no schema repair, audit mutation or background polling.

Twelve admitted requests per minute per existing request-key policy and one active
scan per process are project resource limits, not requirements from these sources.
The limiter follows the existing app's request-key behavior; the single active
scan guard is independent of that key and admits no queue or cached result.

## Alternatives and recommendation

| Approach | Advantages | Costs / limits | Decision |
| --- | --- | --- | --- |
| Scan with every overview/page load | Always attempts recent data | Catalog work and preparation contention on routine reads | Reject |
| Include scan in general diagnostics refresh | Fewer controls | Couples independent failure/loading lifetimes and costs | Keep independent |
| Explicit administrator-only schema refresh | Deliberate cost, isolated status, no polling, existing UI | User must refresh; scan can return busy/unavailable | Adopt |
| Send full CLI report to browser | More technical detail | Unneeded identities/definitions increase disclosure and UI complexity | Counts-only HTTP projection |
| Background cache or durable operation | Shared history/status | Additional state, stale authority and lifecycle complexity | Defer |

Recommended stack: explicit native control → authenticated GET → rate/admission
limits → existing read-only observer → counts-only projection → authorization
recheck → no-store response → permanent polite feedback and fresh result. Clear
previous results on refresh/failure; never present an old green result as current.
No new app, service process, dependency, migration or startup-admission rule is
needed. Browser DOM/focus evidence does not establish screen-reader speech or
physical-device acceptance.
