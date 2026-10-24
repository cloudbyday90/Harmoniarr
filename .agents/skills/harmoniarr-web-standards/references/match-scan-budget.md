# Bounded detail scans and truthful continuation

Use for sparse quality-review match reads. Read the active repository's
docs/ELIGIBLE_MATCH_SCAN_BUDGET_DESIGN.md, research and outcome.

1. Bound facts fetched as well as evaluated, separately from response size. The
   detail reader uses at most four fifty-row queries; stop early on lookahead.
   Report counts at the scanner boundary, not through public provider diagnostics.
2. Distinguish incomplete, found and exhausted. An exact full budget requires a
   later EOF probe; empty partial windows remain visible with explicit controls.
3. Preserve both directions, stable ordering and no skipped eligible lookahead.
   Test inclusive reverse navigation from empty EOF at an eligible boundary.
4. Bind and authenticate continuation state, including empty-from-start history.
   Treat it as a current-view browsing inference. Never use a browser cursor or
   completed historical walk as restart/selection authority.
5. Retain the fresh complete transactional restart guard until every candidate
   writer participates in a separately qualified revision/certificate design.
   State this mutation cost separately from the detail-read budget.
6. Use native stable controls and persistent polite status. Normalize partial
   empty pages strictly, retain the disclosure, preserve focus and accepted page
   on errors, and avoid automatic continuation loops. First page begins a fresh
   walk even after reverse EOF. Keep implementation counts out of product copy.
7. Combine real SQL cohorts once: a match beyond the budget, exact-boundary true
   exhaustion and a new eligible choice behind a completed empty cursor. Prove
   the stale restart is refused without audit/intent, and keyboard continuation
   selects only through the existing guarded command without starting download.

Use MCP-discovered OWASP API resource guidance, W3C status examples and PostgreSQL
ordering guidance. A returned-row budget is not query-plan, wall-time, byte or RSS
qualification; do not claim whole-platform speedup or bounded mutation work.
