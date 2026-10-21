# Source-policy admission research and recommendations

Consulted 2026-10-21 through MCP search, official navigation and GitHub file/PR
metadata. Installed baseline: Node 24.22.0, Vue 3.5.44, Vue Router 5.2.0.
This is a scoped recommendation, not a claim of general standards conformance.

| Official source and status | Applicable practice and project decision |
| --- | --- |
| [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), informative security guidance | Deny missing authority and verify permissions on each API request. Preserve server admin/freshness/CSRF checks; use route admission only to prevent an unusable page. |
| [Vue Router navigation guards](https://router.vuejs.org/guide/advanced/navigation-guards.html), framework documentation for v4/v5 | Await the existing current-session check before confirmation; cancel failed verification or redirect denied roles. Reuse the reviewed shared guard. |
| [W3C WCAG 2.2 Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html), informative explanation of SC 2.4.3 | Filtering unavailable links must preserve meaningful sequence. Check actual Tab movement from Monitored artists to System history and visible focus. |
| [W3C Link Purpose](https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context), informative explanation of SC 2.4.4 | Retain explicit Source users, Source blocklist and System history link names using native navigation elements. |
| [GitHub secure use reference](https://docs.github.com/en/actions/reference/security/secure-use?learn=getting_started&learnProduct=actions), vendor security guidance | Keep the selected reusable workflow pinned to a full commit SHA; inspect downstream actions and required token permissions. |
| [OSV GitHub Action](https://google.github.io/osv-scanner/github-action/), vendor documentation | Full scans and PR comparison scans are separate workflows. Existing caller uses the full scan's default recursive arguments and does not consume its JSON output. |
| [OSV releases](https://github.com/google/osv-scanner-action/releases), vendor release record | v2.7.0 is the selected update; inspect its exact source rather than inferring behavior from the version label. |
| [Pinned v2.7.0 full workflow](https://github.com/google/osv-scanner-action/blob/b1d267aea5211fa648d9d442fa64b90dbdcbdd36/.github/workflows/osv-scanner-reusable.yml), implementation evidence | Adds failure when a failed scanner leaves no nonempty result file; result exports are opt-in. Its permissions fit the existing caller. All action references in this workflow are SHA pinned. |

W3C addresses interaction and semantics. OWASP supplies authorization guidance;
framework documentation defines navigation behavior; GitHub and OSV define the
CI execution contract. None grants authority to bypass a server permission or
to claim a hosted workflow passed from local tests alone.

## Alternatives and tradeoffs

| Option | Benefits | Costs / limits | Decision |
| --- | --- | --- | --- |
| Hide links only | Small presentation change | Direct links still mount refused pages; cached roles can be stale | Insufficient |
| Shared reviewed policy plus current session on entry | One decision for links and admission; prevents page reads before verification; covers revoked admin | One session request per new source-policy entry; already mounted views still rely on APIs | Implement |
| Add per-view checks | Local visibility of access decision | Duplicates policy and may run after mount reads | Reject |
| Migrate every Activity/Settings permission now | Potential wider consistency | Requires reviewing unrelated API contracts and journeys | Defer until scoped evidence exists |
| Apply PR #53's exact full-scan pin | Gains upstream failed-scan handling and maintained scanner; small reviewable change | New scanner/actions still need local and hosted qualification; PR sibling stays older | Implement with explicit evidence limits |

Recommendation stack, in order: preserve independent server authorization;
share the three reviewed route decisions; verify current session before entry;
filter native links while preserving keyboard order; test owning boundaries with
cheap policy tests plus one combined real browser cohort; run the stable fast
gate and preserved no-cache readiness workflow. Adopt the selected OSV update
separately, retaining SHA pinning and distinguishing completed scans from clean
findings and successful SARIF upload.

Random draw: three open PRs (#54, #53, #48), draw 0.6635868944519738, zero-based
index 1 selected [PR #53](https://github.com/cloudbyday90/Harmoniarr/pull/53).
Reviewed head `ac3df84ab9ff2bb7f4c6ef8f00408f991872d12e` changes only the
full-scan reference from `9a498708959aeaef5ef730655706c5a1df1edbc2` to
`b1d267aea5211fa648d9d442fa64b90dbdcbdd36`. MCP reports it open and mergeable
against the current main; no rebase or stale-PR cleanup is justified for this
candidate. The [outcome](SOURCE_ROUTE_ACCESS_OUTCOME.md) records executed checks.
