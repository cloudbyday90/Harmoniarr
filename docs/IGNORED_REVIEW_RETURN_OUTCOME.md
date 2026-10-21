# Ignored-source review return outcome

Date: 2026-10-20. See the separate [design](IGNORED_REVIEW_RETURN_DESIGN.md),
[research and tradeoffs](IGNORED_REVIEW_RETURN_RESEARCH_2026_10.md) and
[Docker outcome](LOCAL_DOCKER_IGNORED_REVIEW_RETURN_OUTCOME.md).

The canonical ignored-source correction link now retains the originating Missing
Music decision through the existing bounded return context. A focused ESM helper
admits only the exact decision context, one validated identifier and an
administrator role. A small Activity return card owns route/session presentation;
the existing view only passes whether an ignore/remove/auto-ignore save is pending.
Pending saves withhold the anchor and update an existing polite status container.

Return to Missing Music uses a fixed named route with only the decision ID.
Unknown query fields, arbitrary URLs, other contexts, legacy aliases, repeated
values and unsupported roles cannot become a destination or an authorization
claim. Missing context leaves ordinary ignored-source review unchanged.

Returning mounts the existing inspector and its scoped detail read; there is no
refresh flag, extra polling, auto-save, automatic unignore or new search. The
read can show current unavailable/read-only states. Recorded search counts are
historical facts and are not rewritten merely because an ignore was removed.
No server/shared code, API, persistence schema, dependency or command changed.

Validation used Node 24.22.0/npm 12.0.2, with installed Vue 3.5.44/Router 5.2.0:

- `node --test test/client/ignored-source-review-handoff.test.js test/client/missing-music-search-corrections-presentation.test.js test/client/settings-recovery-handoff.test.js test/client/use-missing-music-decision-detail.test.js`
  passed all 29 focused cases in 0.26 seconds. They cover the bounded round-trip,
  maximum/malformed/repeated IDs, unrelated contexts, unknown fields, strict roles,
  existing correction permissions and the detail lifecycle.
- The stable `npm run validate:fast` passed 5,592 server, 4,409 client and 697
  script tests: **10,698 total**, zero failures/cancellations/skips, plus static
  checks, full lint and both builds. Test phases took 69.0/12.6/7.4 seconds.
  These are local observations, not a matched speedup or whole-CI measurement.
- `node --test --test-concurrency=1 test/browser/ignored-source-review-return.test.js test/browser/missing-music-search-corrections.test.js`
  passed four browser cases in 20.6 seconds, without skips/cancellations. The new
  native journey uses real PostgreSQL, authentication, recorded discovery, actual
  detail HTTP, ignore APIs and the real app shell; its decision is not an API stub.
- That journey preserves origin through reload, uses meaningful keyboard links,
  visible outlines and sequential focus, cancels the first unignore confirmation
  with zero mutation, then explicitly removes one synthetic source. The actual
  mutation response is held after the real server write to prove pending UI
  withholds return until it receives completion; owned route work is released and
  drained through the fixture lifecycle. This is response uncertainty, not proof
  of a blocked database write or completed provider operation.
- A deliberate independent discovery-state advance while review is open proves
  return issues a new detail GET, shows current facts instead of old diagnostic
  counts and focuses the existing inspector heading. Only the explicit DELETE
  was sent from that browser journey. Search attempts, fresh-search attempts,
  next-search deadline and operation-run count remain unchanged. No search
  command was submitted; removing an ignore did not itself update search history.
- The refusal case handles malicious/duplicate contexts, a syntactically valid
  unavailable target through the existing scoped 404 state, and role withdrawal.
  The operator receives no return card and the actual ignore API still refuses
  access. The existing two correction-navigation/role cases also remain green.
- Inspected 390px light, 800px dark and 1280px light captures show no observed
  clipping. The return link has at least 44px height. Browser DOM/focus evidence
  does not establish screen-reader announcements or full WCAG compliance.
- The web-standards skill's focused reference now records exact context admission,
  pending response ownership, current-detail reads and historical count limits.
  Skill structure and local Markdown links were checked. New lines in an existing
  CRLF view were preserved with the repository's line-ending workflow before the
  stable gate; `git diff --check` is clean.

Frozen source: 3,172 files,
`513c612b1ac0dcd6d89bee8073684a3c5ea7d99f71b028e1965136e5e536cb88`.
All eight changed code/test files are byte-verified. The focused/browser checks
preceded line-ending preservation with unchanged logic; the full fast gate and
Docker use final bytes. No exhaustive integration/media matrix was repeated for
this client navigation change. Logs, captures and native/packaged verification
remain private under `.tmp/ignored-review-return-2026-10-20/`.

Random PR #48 remains unapplied: fresh MCP metadata/complete patch, lock hash and
installed consumer versions match retained failing TypeScript 7 Vue-language-
service evidence and a passing TypeScript 6 control. No merge, rebase, closure,
separate branch, version/tag change or release was created.

Next: add administrator-only route admission for ignored-source review, aligned
with its existing API policy. The role-withdrawal browser case confirms operators
can enter that page shell even though its reads are refused. Preserve useful
operator/requester destinations and independent server authorization; frontend
navigation guards must not be treated as API access control.
