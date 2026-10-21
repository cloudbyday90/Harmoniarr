# Settings Connections research and recommendations

Consulted 2026-10-21 through MCP search, official navigation and GitHub file/PR
metadata. Baseline: Node 24.22.0, Vue 3.5.44, Vue Router 5.2.0. Sources inform the
reviewed boundary; focused checks do not establish general standards conformance.

| Primary source / status | Applicable decision |
| --- | --- |
| [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), informative security guidance | Preserve independent admin/freshness/CSRF checks at handlers. Deny unknown authority at reviewed client boundaries; test direct HTTP separately from link visibility. |
| [Vue Router guards](https://router.vuejs.org/guide/advanced/navigation-guards.html), framework documentation | Await session verification before confirmation; cancel or redirect through one common guard while retaining authentication precedence. |
| [W3C Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html), informative explanation of WCAG 2.2 SC 2.4.3 | Preserve native link order and focus after filtering Connections; verify actual keyboard behavior and Account access. |
| [W3C Link Purpose](https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html?trk=public_post_comment-text), informative explanation of SC 2.4.4 | Retain descriptive Connections/Account labels and avoid advertising a reviewed unavailable destination in the Settings tab and global health link. |
| [W3C Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible) and [technique C45](https://www.w3.org/WAI/WCAG22/Techniques/css/C45.html), informative explanation and example technique | Use a scoped `:focus-visible` cue with project tokens. The two-pixel threshold is a project convention; SC 2.4.7 does not prescribe its shape or width. Inspect actual native Tab focus in light/dark and responsive navigation. |
| [Pinned Docker QEMU action](https://github.com/docker/setup-qemu-action/blob/99012661954931238ded8c8b007157a8430204e1/action.yml), vendor contract | Node 24 remains the action runtime; image/platform/cache defaults remain compatible. New reset input defaults false. The vendor now packages its entrypoint as CJS; first-party project modules remain ESM. |
| [Pinned QEMU implementation](https://github.com/docker/setup-qemu-action/blob/99012661954931238ded8c8b007157a8430204e1/src/main.ts), implementation evidence | Inspect actual pull/inspect/version/install/output paths and error handling. Privileged host registration is a separate effect from evaluating those paths under controlled dependencies. |
| [QEMU action README](https://github.com/docker/setup-qemu-action/blob/99012661954931238ded8c8b007157a8430204e1/README.md), vendor guidance | Keep QEMU setup before Buildx. Its purpose is user-mode cross-architecture execution; no release dispatch is required for local evaluation. |
| [Docker multi-platform builds](https://docs.docker.com/build/building/multi-platform/), vendor guidance | Docker Desktop already supports emulation. A local ARM container proves that environment's execution path, not fresh-runner installation by the updated action. |

W3C supplies interaction guidance; OWASP supplies authorization principles;
framework and vendor documentation define execution contracts. None makes a
browser guard an API security boundary or local emulation a hosted release proof.

## Options and recommendation stack

| Option | Pros | Cons / limits | Decision |
| --- | --- | --- | --- |
| Hide the Connections tab only | Small change | Direct URLs and stale cached roles still enter refused pages | Insufficient |
| Separate area policies plus common admission service | Small modules; one verification mechanism; policies shared with navigation; Account stays available | Adds a few explicit modules and one session read on protected entry | Implement |
| Put Settings into the Activity policy | Minimal file count | Misstates ownership and couples unrelated areas | Reject |
| Restrict every Settings route now | Potential broader consistency | Other contracts and Account/recovery behavior need individual review | Defer |
| Apply PR #54's exact SHA update locally | Maintains the action/input/runtime contract and current upstream fixes | Privileged installation and hosted caches still require runner qualification | Implement with explicit evidence limits |

Selected stack: independent server authorization; area-owned ESM policies; one
composed session guard; role-aware native navigation; cheap semantic tests plus
one combined browser cohort; stable fast gate; preserved no-cache readiness.
Keep release infrastructure qualification distinct from application validation.

Random draw: the only open PR was [#54](https://github.com/cloudbyday90/Harmoniarr/pull/54),
draw 0.8548933251368009, index 0. Reviewed head
`b0f1bc3a00b58c2667145befa7cbc2178f78dcdd` changes only the QEMU reference from
`ce360397dd3f832beb865e1373c09c0e9f86d70a` to
`99012661954931238ded8c8b007157a8430204e1`. The
[outcome](CONNECTIONS_ROUTE_ACCESS_OUTCOME.md) records actual applicability and checks.
