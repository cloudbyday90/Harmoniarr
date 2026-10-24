# Scoped eligible-match pages

Use for browsing measured-quality alternatives beyond twelve. Read the active
repository's docs/ELIGIBLE_MATCH_PAGINATION_DESIGN.md, research and outcome.

1. Keep read authorization and transactional selection independent. Recompute
   current recipient/quality/track scope on each page; a signed cursor is not consent.
2. Bind short-lived cursors to actor/role, target, failed search and current policy.
   Validate size/type/signature/expiry before an anchor reaches SQL. Do not expose
   private scope facts in a base64 payload; public anchors and digests suffice.
3. Apply eligibility before the twelve-result cap. Use unique forward/reverse
   keysets and one-result lookahead. Preserve complete exhaustion semantics for
   Search again; an empty continuation cannot imply global exhaustion.
4. Replace results rather than accumulating arrays or cursor histories. State the
   bounds on retained facts/DOM separately from scan work and wall time.
5. Share the existing detail request gate. Preserve the accepted cursor on failed
   reads and background refresh; explicit refresh/commands return first. Abort or
   ignore stale route/navigation/mutation reads, including their status messages.
6. Keep native page buttons stable. Use guarded aria-disabled controls to retain
   focus at terminal pages and persistent polite status announcements. Never move
   focus during polling. Manual assistive-technology acceptance is separate.
7. Prove sparse bidirectional traversal, exact terminal pages, tampering, foreign
   actor/target, current participant changes and later-page guarded selection in
   real SQL/HTTP. Add rendered keyboard/focus/refresh proof and bounded DOM checks.

Research W3C, OWASP and PostgreSQL official sources through MCP. Reuse existing
owners; do not introduce another application or weaken selection to page membership.
