# Eligible shortlist research and recommendations

Reviewed October 24, 2026. Official URLs were discovered by connected MCP search,
then opened through that service.

| Official source | Applicable guidance | Project application |
| --- | --- | --- |
| [W3C disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) | Native button activation and accurate expanded/controlled state | Preserve the existing keyboard disclosure and inspector focus owner |
| [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Default refusal and action-boundary authorization | Candidate scope and quality checks at commit; a visible choice is not authority |
| [PostgreSQL 18 LIMIT](https://www.postgresql.org/docs/18/queries-limit.html) | Use a unique predictable order for limited subsets; large offsets cost work | Internal UUID keyset traversal in fixed batches with no public offset/cursor |

These are project-specific engineering applications. APG is informative guidance,
not an accessibility certification. The database reference matches the packaged
major version. No framework or runtime upgrade is needed.

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Increase the raw shortlist cap | Very small patch | Ineligible rows can still hide valid choices; more public data | Reject |
| Filter and batch before the existing cap | Repairs the reproduced journey; fewer queries; existing UI and authority | Still shows twelve eligible choices; UUID ordering differs from raw score ordering | Select |
| New public pagination endpoint and client state | Can inspect every eligible alternative | Additional cursor, refresh, focus and stale-page ownership to maintain | Follow-up if broader browsing is needed |

Final stack: existing Vue disclosure and mutation owner; bounded public projection;
shared ESM eligibility/scanner; narrow PostgreSQL candidate-fact store; existing
transactional selection/event/audit and separate download command.

GitHub MCP found zero open PRs at initial selection. Recheck before completion;
do not invent a PR implementation or merge an unrelated change.
