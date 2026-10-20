# External-search filtering diagnostics outcome

Date: 2026-10-20. See the separate [design](EXTERNAL_SEARCH_DIAGNOSTICS_DESIGN.md),
[official recommendations and tradeoffs](EXTERNAL_SEARCH_DIAGNOSTICS_RESEARCH_2026_10.md)
and [local Docker outcome](LOCAL_DOCKER_EXTERNAL_SEARCH_DIAGNOSTICS_OUTCOME.md).

Approved external-request review now explains successful provider responses that
produce zero usable candidates. A shared ESM projection admits only validated
counts for responses/files, ignored sources, title exclusions, missing uploader
identity and malformed files. It drops raw payloads, peer names, paths, queries,
exception text and supplied reason strings. Missing required counts, candidate
success, genuine empty searches and inconsistent evidence do not qualify.

Discovery carries this projection into the existing worker summary. Starts and
later outcomes clear old diagnostics. The review store projects it again only
from the current failed external job with matching intent/request identity,
no-candidate code, zero candidates and no supersession or published-empty outcome.
Both ordinary and collection review use this store. There is no new migration,
dependency, queue or mutation endpoint.

A focused Vue component presents separate response/file counts, observed causes
and fixed correction guidance. Links open the verified Ignored, Connections or
Background Jobs routes. The UI does not invent a title-term settings page or
claim quality scoring rejected the search. Correction, changing the approved
edition and requesting fresh provider work retain their existing explicit owners.
An intentional source-policy correction can be followed by ordinary job Retry,
which continues the saved provider UUID without consuming empty-search budget.

Validation used Node 24.22.0/npm 12.0.2:

- The complete stable `validate:fast` gate passed: 5,589 server, 4,400 client and
  697 script tests (10,686 total), zero failures/cancellations/skips, plus static
  checks, full lint and both builds. Test phases took 67.5/9.1/5.7 seconds.
- The PostgreSQL/HTTP selection covered 49 unique cases. The first broad run was
  48/49 in 94.8 seconds: the new fixture omitted the production ignore-list reader,
  so ingestion correctly created a candidate instead of filtering it. With the
  actual source-user ignore service wired as in app startup, the owning eight-case
  recovery/diagnostic suite passed in 22.2 seconds. The other 41 cases passed in
  the broad run; they were not repeated after this fixture-only correction.
- The new native HTTP case uses real PostgreSQL, session-authenticated review,
  actual slskd client/service, ingestion, worker and queue claims. A real saved
  ignore produces bounded reasons, zero candidates and no fresh-search permission.
  Private extra fields are stripped on read; mismatched intent/request, superseded
  and published-empty summaries are refused. After an intentional ignore removal,
  ordinary Retry reuses the same single provider POST/reservation and creates one
  pending candidate. Empty-search observation/budget remain unchanged.
- Ten unique browser cases were covered. The first broad run was 9/10 in 40.3
  seconds, exposing a real 1px default outline on the new links. After adding the
  component's 2px focus-visible ring, all four owning recovery/diagnostic browser
  cases passed in 14.2 seconds. The other six review/collection cases passed in the
  broad run and were not repeated for the new component's scoped CSS correction.
  Evidence covers the actual Ignored route, keyboard focus, 44px mobile links,
  absent Search again for filtered results, no queued command, and Refresh focus.
  The 390px mobile diagnostic screenshot was inspected without observed overflow.
  Controlled feature API projections render inside the real application shell;
  screen-reader announcements and full WCAG conformance were not tested.
- Forty-six focused projection/service/worker/presentation controls passed before
  the stable broad gate. They include private/unknown fields, strict counts,
  inconsistent evidence, successful/published-empty refusal and separate units.
- The existing web standards AI skill gained a focused search-diagnostics reference,
  including actual app fixture wiring and unit-aware evidence. Structural skill
  validation and the repository's test-hygiene check passed.

The failed development candidates remain private alongside the passing corrections
under `.tmp/external-search-diagnostics-2026-10-20/`. No timeout/resource cap was
raised. Unchanged native transfer/media matrices were not repeated for this
read-only diagnostic projection and UI change.

Final frozen source: 3,157 files,
`8597bd0422ffc6982b621d2bf75eef89e1052d0e8d4ddfd39e3bc1cb08ddf34a`.
Thirteen changed code/test files are byte-verified; database/browser evidence
preceded line-ending normalization with identical logic, and the full fast gate
and packaged image use final bytes. Runtime inventory/readiness evidence is in
the separate Docker document.

Random PR #48 remains unapplied: fresh MCP metadata/complete patch, package/lock
and installed Vue consumer inputs match the retained failing TypeScript 7 candidate
and passing TypeScript 6 control. No PR merge/rebase/closure, dependency update,
new branch, release, tag or version change was performed.

Next: apply the same bounded, unit-aware diagnostic approach to Missing Music.
Its current `Filtered` detail adds ignored-response counts to excluded-file
counts; replace that mixed-unit total with separate cause counts and truthful
correction guidance while preserving canonical action ownership.
