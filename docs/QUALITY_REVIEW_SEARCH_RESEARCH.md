# Quality-review restart research and recommendations

Reviewed October 24, 2026 through the connected MCP search service. URLs were
discovered by search and their official pages opened before use.

| Official source | Applicable practice | Project application |
| --- | --- | --- |
| [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html?trk=article-ssr-frontend-pulse_little-text-block) | Convey action status through roles/properties without unnecessary interruption | Existing live feedback and owned command focus; background updates stay quiet |
| [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Default refusal, authorization on each request, permission tests | Server-derived recipient plus actor/shared-owner revalidation at commit |
| [PostgreSQL 18 concurrency](https://www.postgresql.org/docs/18/mvcc.html) | Coordinate concurrent work while preserving data integrity | Canonical locks, fresh reads after waiting and atomic intent/audit |

These applications are engineering inferences from the sources. W3C Understanding
is informative guidance, not certification. The PostgreSQL source matches the
packaged major version. No dependency upgrade is needed for this change.

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Broaden the stopped-status allowlist | Small patch | No full-search exhaustion proof or original policy preservation | Reject |
| Separate recovery/search application | Independent workflow | Duplicated authorization, memory and deployment ownership | Reject |
| Reuse current intent with a scoped guard and durable floor | Existing UI/queue, atomic evidence, no implicit fallback | More ownership checks; conservative refusal after scope drift | Select |

Final stack: native Vue command and existing feedback; small ESM scope/guard and
quality-requirement policy modules; PostgreSQL durable intent plus required audit;
existing discovery resolver/dispatcher and ingestion; focused SQL/browser and
packaged validation. Preserve explicit quality consent and failed acquisitions.

GitHub MCP returned zero open PRs at initial selection and final recheck. No random
applicable PR or stale-PR rebase was available.
