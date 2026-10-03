---
name: harmoniarr-web-standards
description: "Apply and verify web standards for Harmoniarr UI commands, forms, focus/status behavior, and HTTP mutations. Use for standards-oriented implementation or review; copy-only changes do not need this workflow."
---

# Harmoniarr Web Standards

Turn applicable official practices into observable behavior in the requested
journey. Select relevant standards; do not expand ordinary work into a blanket
accessibility/security audit or a framework migration.

## Establish the journey and applicable sources

Trace the rendered control, actor/recipient authority, HTTP request, owning
write/worker, and refreshed result. Read current source and tests before trusting
an old plan. Use [the project evidence map](references/project-evidence-map.md)
to locate boundaries for commands and asynchronous updates.
For a proposal-only or restricted-source review, honor those limits and identify
unverified owners/contracts rather than treating visible omissions as reproduced
application defects.

For standards decisions, read only the relevant rows in
[official practices](references/official-practices.md). Discover and open primary
URLs through available MCP search/metadata or official navigation; do not invent
links, publication dates, or current versions. A saved link is a starting point,
not evidence that changing guidance is still current. Record consultation date,
applicable version, and source status: normative specification, informative
guidance, framework documentation, or project convention. If lookup is unavailable,
report that limit and do not fabricate current-source verification.
Check the host's actual versions before applying version-specific advice; the
version in a saved reference does not establish the deployed version.

Connect each selected practice to an implementation owner, concrete failure case,
and evidence. A small mapping is enough; an irrelevant checklist is not.

## Implement the relevant boundaries

For browser interaction, prefer native semantic controls with explicit types and
accessible names. ARIA supplements behavior; it does not supply keyboard handlers
or prevent activation by itself. Check the rendered control's keyboard, focus,
label, and target behavior in the actual application shell.

For asynchronous feedback, establish a polite status container before the message
changes, with deliberate atomic semantics. Keep command feedback outside a busy
ancestor that would defer it. Do not make background revalidation steal focus.
If the invoking control disappears, move focus to a meaningful destination only
while that interaction still owns focus; preserve a user's move elsewhere.
Distinguish an accepted/queued intent from a completed provider/download/library
result, and keep errors bounded.

For HTTP mutations, keep reads free of domain side effects. Recheck session,
CSRF, actor/target relationship, and current object eligibility at the owning
server/write boundary. Browser permissions and disabled controls are presentation,
not authorization. POST is not intrinsically idempotent: use the existing durable
command contract and retain its key after an uncertain response rather than
inventing a fresh intent on each retry.
Discover the existing resolution/expiry rules and distinguish uncertain acceptance
from a definite rejection before changing or clearing that key.

For shared or concurrent work, inspect every relevant reader/writer. Preserve
ownership, saved policy, lock order, and atomic required audit. Use a transaction
and current-state locks where they own the invariant; a check-then-create race
over an absent row may need an existing uniqueness/coalescing boundary or a
transaction-scoped advisory lock. Queue `SKIP LOCKED` behavior is not object
authorization or a consistent general read. Reuse workers instead of introducing
another operation system. Keep new first-party modules ESM and responsibilities
narrow.

## Verify and report the actual result

Choose evidence at the boundary that owns the claim: keyboard/pending/focus and
live-region browser behavior; service authorization and replay; real PostgreSQL
rollback/concurrency when SQL owns the property. Automated ARIA/DOM assertions do
not prove screen-reader announcements or full WCAG conformance. Use visual/manual
and assistive-technology checks when relevant and available; report unperformed
checks rather than claiming them.

Follow the repository's appropriate focused and broader validation. Do not add
wording/regex tests that merely restate a standard or the implementation. Report
the selected practice, implemented behavior, executed evidence, and remaining
scope separately. Preserve user instructions about branches, releases, publication,
merges, and other external actions; standards guidance grants no authorization.
