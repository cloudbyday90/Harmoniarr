# Role-aware search correction outcome

Date: 2026-10-20. See the separate [design](MISSING_SEARCH_CORRECTIONS_DESIGN.md),
[research and tradeoffs](MISSING_SEARCH_CORRECTIONS_RESEARCH_2026_10.md) and
[Docker outcome](LOCAL_DOCKER_SEARCH_CORRECTIONS_OUTCOME.md).

Canonical Missing Music now offers Review ignored sources for recorded ignored
responses and Review provider connection for malformed files/missing source
identity. The existing diagnostic policy derives two strict review capabilities
from the authenticated actor, active recipient and validated current causes.
The detail service computes the bounded counters once, and its client adapter
preserves both capabilities without coercing truthy strings into permission.

A focused pure ESM presenter owns fixed internal destinations, explanation and
the existing bounded Settings return context. A small extension of the existing
diagnostic component renders semantic list items and native router links.
Requesters/operators receive administrator guidance; disabled-account history
keeps its counts without correction links. Malformed responses do not diagnose
a connection outage. Guidance makes the household-wide effect of ignore changes
clear. No title editor, automatic unignore, quality relaxation or retry was added.

Review capabilities describe navigation, not endpoint authority. Destination APIs
retain their independent session/admin checks and fresh-session/CSRF mutations.
Own-recipient scope, disabled history, search cooldown/budget, explicit intent and
stale-count suppression remain unchanged. There are no new routes, dependencies,
migrations, queues or operation commands.

Validation used Node 24.22.0/npm 12.0.2:

- `node --test` on the six explicitly selected policy/service/presenter/composable/
  Settings-return files passed all 52 focused cases in 0.23 seconds.
- The stable `npm run validate:fast` passed all 5,592 server, 4,406 client and 697
  script tests: **10,695 total**, zero failures/cancellations/skips, plus static
  checks, full lint and both builds. Test phases took 67.9/7.3/5.6 seconds. These
  are local observations, not a matched performance comparison or whole-CI claim.
- `node --test --test-concurrency=1 test/integration/missing-music-search-diagnostics.test.js test/integration/missing-music-search-again.test.js`
  passed all five PostgreSQL/HTTP cases in 18.1 seconds. The strengthened owning
  case proves administrator capabilities, requester/operator denials at actual
  ignore/settings read and mutation endpoints, unrelated/anonymous refusal,
  suppression after newer work/failure/continuation and disabled history.
  Settings/ignore contents, search schedule and operation-run counts are unchanged
  by review reads. Existing explicit Search again replay/coalescing/refusal cases
  remain green. This is persisted/HTTP evidence, not a new native provider search.
- `node --test --test-concurrency=1 test/browser/missing-music-search-corrections.test.js test/browser/missing-music-search-diagnostics.test.js`
  passed four unique browser cases in 18.7 seconds. Actual app-shell navigation
  reaches the real ignore and connection pages using keyboard Enter. Adjacent
  links have sequential Tab/Shift+Tab focus and visible outlines. Refresh revokes
  permissions without stealing invoking focus. Actual requester/operator sessions
  see escalation guidance, and disabled history suppresses even supplied true
  flags. Review navigation sends zero API mutations; existing canonical Refresh
  and advanced count presentation remain green. Feature detail payloads are
  controlled; destination pages and sessions use the actual application.
- The two owning browser cases passed again in 11.1 seconds after strengthening
  visual capture: a first screenshot caught a responsive transition, so capture
  disables animations and checks mobile viewport bounds. The inspected final
  390px light, 800px dark and 1280px light captures show no observed clipping.
  New links have at least 44px height. Four unique cases are not six distinct
  cases; DOM/keyboard checks do not prove screen-reader output/full WCAG compliance.
- Initial focused lint caught an unqualified browser `document` reference in a
  test callback. It uses `globalThis.document` before the stable gate. No runtime
  guard, test timeout, resource limit or assertion was weakened.
- The existing web-standards skill's focused search-diagnostics reference now
  distinguishes page-shell admission from destination API authority, strict
  capabilities, recipient state and diagnostic certainty. Skill structure and
  local Markdown links were checked; this is a narrow update, not a new audit.

Frozen source: 3,168 files,
`b3e25080c6093a48257fe86d8b551351fb76e06c9285be319ff6b65076898ea3`.
All ten changed code/test files are byte-verified. Focused native/browser checks
preceded line-ending preservation with unchanged logic; the full fast gate and
Docker image use final bytes. The exhaustive integration/media matrix was not
repeated for a read-only guidance change. Private logs, captures and verification
records live in `.tmp/search-corrections-2026-10-20/`.

Random PR #48 remains unapplied after fresh MCP metadata/complete patch and local
lock/installed-consumer comparison matched the retained failing TypeScript 7 Vue
language-service candidate and passing TypeScript 6 control. No merge, rebase,
closure, separate branch, version/tag change or release was created.

Next: add a bounded return-to-this-decision link on the ignored-source review
page, then refresh the originating Missing Music decision. Today that destination
uses ordinary browser navigation back. Preserve administrator ownership, explicit
ignore changes and separate search intent; returning must not start a search.
