# Recovery diagnostic events research

Reviewed October 25, 2026 using MCP search and primary-source retrieval. See
[design](RECOVERY_DIAGNOSTIC_EVENTS_DESIGN.md) and
[outcome](RECOVERY_DIAGNOSTIC_EVENTS_OUTCOME.md).

| Official source | Application |
| --- | --- |
| [W3C information and relationships](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html) | Preserve programmatically determinable headings and lists; label each record's time and message rather than relying on visual grouping alone. |
| [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Keep the existing quiet loading/completion announcement without moving focus or announcing the entire record list. |
| [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Treat diagnostic event data as potentially sensitive and untrusted. Preserve server redaction, project needed fields and encode text for its display context. Logging guidance informs display minimization; this task does not change audit collection. |

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Map current service fields in a bounded presentation module | Correct messages/times, stable row identity, no API/query change | Requires explicit fallbacks for missing facts. Recommended. |
| Rename server fields or accept obsolete aliases | Less view editing | Extends a misleading contract and still supplies no truthful aggregate count/actor. Reject. |
| Render arbitrary audit summary/details or reconstruct counts | More apparent detail | Expands sensitive output or invents facts not established by the payload. Reject. |

Recommended stack: existing administrator/redaction boundary → current service
fields → bounded stable-ID projection → escaped semantic rows with truthful
fallbacks → existing refresh/status ownership → service-derived and rendered
regressions. This is a repository-specific inference from the sources, not a new
standard that mandates these particular fields or display limits.

The existing free-text redactor recognizes selected path roots and credential/
email patterns; it is not an exhaustive detector of arbitrary secrets or paths.
Fixtures use application-owned paths within that policy. The presenter does not
expand this server policy or claim that escaped text is automatically confidential.
