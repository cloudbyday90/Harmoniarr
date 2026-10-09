# Practical web standards skill design

Status: Accepted for implementation
Research date: October 3, 2026

## Purpose

Create `harmoniarr-web-standards` to turn relevant standards and official practice
guidance into concrete implementation decisions and evidence for Harmoniarr web
commands and forms. The user requested W3C and similar practices as a practical,
structural, methodical AI skill. The current Find matches journey provides a real
application across browser semantics, HTTP, authorization, and queue races.

## Practice families

| Family | Purpose | Source status |
| --- | --- | --- |
| W3C WCAG/WAI-ARIA | Keyboard, focus, status, labels, and operable targets | Distinguish normative criteria from informative Understanding/APG/techniques. |
| WHATWG HTML | Native browser controls and form behavior | Living specification; inspect the relevant element rather than adding custom ARIA reflexively. |
| OWASP | Object authorization, CSRF, and bounded public errors | Security practice guidance, not automatic certification. |
| IETF HTTP | Read/mutation semantics and safe uncertain retries | RFC 9110 semantics; project replay/response conventions are explicit local decisions. |
| PostgreSQL | Transaction state, locking, coalescing, and rollback | Versioned product guidance, not a standards-body requirement. |
| Vue/Playwright | Framework integration and observable browser evidence | Official implementation/testing guidance; automation covers only part of accessibility. |

The discovered and opened official source URLs are recorded in the skill's
practice reference and the [Find matches design](MISSING_MUSIC_FIND_MATCHES_DESIGN.md).
Consultation date does not imply a source was published then. Revalidate changing
documentation when applying the skill later.

## Structure and tradeoffs

| Option | Benefit | Cost | Decision |
| --- | --- | --- | --- |
| A broad standards encyclopedia | Many topics in one place | Expensive context, stale facts, and irrelevant mandatory checks | Reject |
| A W3C-only checklist | Clear accessibility focus | Misses authority, HTTP retry, and persistence boundaries | Reject |
| Put every standard into canonical-actions | One entry point | Loads standards detail for unrelated product actions | Reject |
| Narrow entry point with conditional practice/evidence references | Cheap discovery and standards-to-consumer traceability | References need maintenance and the agent must choose applicable rows | Adopt |

Maintain `SKILL.md`, quoted Codex UI metadata, a short dated official-practice
reference, and a project evidence map under `.agents/skills/harmoniarr-web-standards`.
Install the identical files in the user's local Codex skills directory, matching
the existing project skill arrangement. No executable helper or new testing
dependency is needed solely to create the skill.

## Method and limits

Trace one requested journey and select the few relevant practice families.
Discover/open official URLs, record authority/version/date, and connect each
chosen rule to its actual consumer, failure case, and verification. Reuse current
project command, UI, and testing boundaries. Keep project conventions separate
from standard requirements, particularly WCAG AA's 24-pixel target criterion and
the project's stronger 44-pixel mobile convention.

Collect real evidence for meaningful boundaries: keyboard/focus/status behavior,
authoritative object checks, uncertain mutation retries, SQL concurrency/rollback,
and safe refreshed output. Avoid source-wording tests, invented certification,
unsolicited repository-wide audits, and unrelated framework/security migrations.
Preserve the user's main/no-release/no-merge instructions.

Validate skill structure, installed/source identity, and reference links. An
independent bounded scenario should receive only the skill, a realistic request,
and minimal raw artifacts without expected findings. Record actual decisions,
evidence limits, and any justified instruction correction in a separate outcome.

## Attempt-owned confirmation maintenance, October 8 local

Extend the existing evidence map with the observed provider receipt boundary.
The [confirmation design](DOWNLOAD_HANDOFF_CONFIRMATION_DESIGN.md) requires
supported-version research before selecting a replay contract, exact durable
receipt ownership and truthful partial/current transfer evidence. Similar
history, a new baseline-relative ID and a batch record are each insufficient
causal or whole-manifest proof on their own. Maintain this as conditional project
guidance, with no new broad audit, invocation policy or duplicate skill.
