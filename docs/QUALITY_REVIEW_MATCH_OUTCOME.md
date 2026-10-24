# Quality-review alternative selection outcome

Implemented October 23, 2026 on main. See the [design](QUALITY_REVIEW_MATCH_DESIGN.md)
and [official-source research and tradeoffs](QUALITY_REVIEW_MATCH_RESEARCH.md).

## Delivered behavior

Missing Music now offers **Choose another match** after measured lossy-audio or
suspicious-lossless refusal when a current eligible alternative exists. A native
disclosure reveals the existing bounded chooser. A reusable Vue component replaces
the inspector's inline chooser; the existing mutation, feedback and focus owners
remain responsible for the command and refreshed status.

The recipient may select their own release; an administrator may act for a current
household recipient. The server resolves the target, then the small import-candidate
selection owner rechecks actor privileges, participant eligibility, current search,
track scope, conflicting work and shared quality requirements inside the canonical
locks. Alternatives keep their own context and must preserve the rejected
acquisition's quality floor plus stricter current policy. No fallback consent is
copied, and advertised lossless remains subject to actual audio inspection.

Selection, its event and required audit commit together. Advisory Activity follows
commit. The failed candidate and downloaded bytes remain intact. The response says
downloadStarted=false, refresh exposes the existing explicit download action, and
selection creates no transfer or apply run. There is no new application, sidecar,
dependency, migration, version change, tag or release.

## Executed validation

- Focused decision/command/module/client checks: 47 passed; final presentation and
  extracted-component contract checks: 11 passed.
- Full fast gate: **11,070 passed** (5,897 server, 4,473 client, 700 script), with
  zero failures, cancellations or skips. Lint, copyright/ESM/schema/Compose policies
  and client/server builds passed.
- Final replacement SQL/HTTP suite: six passed. Its scenarios cover shared bounded
  choices, explicit no-download, recipient/CSRF authorization, replay, weaker
  policy/foreign consent/stale track scope, changed search or participants, required
  event/audit rollback, concurrent alternatives and observed account-lock waits.
  Both recipient disablement and actor role revocation are committed during actual
  lock waits; independent observation avoids exhausting the two-connection app pool.
- Existing preflight-review and shared selection regressions: six passed. The
  combined earlier SQL run passed all twelve scenarios; the final replacement run
  adds the stale-track refusal and safe read projection.
- Rendered inspector/review/selection browser cohort: 27 passed. The new replacement
  case also passed separately against the final source and built client. It uses
  actual SQL/HTTP projection, native Enter/Space disclosure, retained disclosure
  focus, Current status command focus, explicit download readiness and reload.
- Both maintained AI skills passed the skill-creator validator. Their standards
  reference now joins W3C disclosure, OWASP action authorization, PostgreSQL locking
  and executable evidence in one practical workflow.

Early fixture/contract failures were corrected and retained in private logs:
an overbroad privacy assertion, a bounded-pool observer, an incorrect focus-heading
expectation and a source contract that still expected the extracted markup inline.
Browser execution uses the repository runner's force-exit policy after suite cleanup.

SQL/browser tests use controlled search candidates and an injected measured gate;
they do not establish public discovery or actual audio measurement. Packaged media
and preserved installation evidence belong to the
[Docker outcome](LOCAL_DOCKER_QUALITY_REVIEW_MATCH_OUTCOME.md). Screen-reader and
physical-device acceptance remain manual and are not claimed as completed.

GitHub MCP returned zero open PRs at initial selection and recheck. No random PR,
merge or stale-PR cleanup was applicable.

## Recommendation and next item

Retain the built-in chooser, server-derived recipient, shared quality guard,
canonical transaction and existing explicit download flow. It completes the
recipient journey without duplicating acquisition authority. The tradeoff is a
short guarded write and conservative refusal of stale or insufficient evidence.

Follow-up implemented: [Search again after measured review](QUALITY_REVIEW_SEARCH_OUTCOME.md)
adds a guarded restart when the entire current search has no eligible alternative.
It preserves shared identity and the original quality floor across later retries.
See that outcome for the next recommendation.
