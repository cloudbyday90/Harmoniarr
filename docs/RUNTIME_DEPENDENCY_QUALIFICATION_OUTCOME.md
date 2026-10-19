# Runtime dependency qualification outcome

Date: 2026-10-19. The [design](RUNTIME_DEPENDENCY_QUALIFICATION_DESIGN.md) follows
the native TLS slice. [Official research and tradeoffs](RUNTIME_DEPENDENCY_RESEARCH_2026_10.md)
support partial adoption of [PR 49](https://github.com/cloudbyday90/Harmoniarr/pull/49).
Reviewed immutable head: 015c009518178e8667c9370a00f9ccbeb4677960;
base: 69073b83cc8bcc4a2659734a5acf478c6db8d691.

## Delivered behavior and dependency decision

Retain Express 5.3.0 and Vue 3.5.44. Keep Router 5.2.0 and its previously locked
tooling subtree. The Router rollback initially resolved unrelated Babel/unplugin
tooling updates; those were removed before the final clean install and gates.
The remaining lock delta contains the intended runtime/Vue compiler dependencies,
content-type deduplication and random PR 47's language-server update. Existing
pg, pg-pool, pg-protocol, music-metadata and TypeScript entries are preserved.

Add two ESM regression files using existing runtime/session/browser fixtures:

- runtime-http-contract.test.js verifies actual anonymous refusal, required-mode
  missing/invalid CSRF refusal, role downgrade and revoked cookie/token replay.
  Rejected writes leave PostgreSQL settings rows unchanged; a valid protected
  write persists the requested log level.
- runtime-navigation-browser-verification.test.js verifies focused-link Enter
  activation in the actual built app, real Settings workspace/child chunk
  requests, current-link state, child replacement and back/forward history.
  A per-document marker remains unchanged and page errors stay empty.

Both files register active scenario completion before disposal. Production routes,
security defaults and component markup are unchanged in this slice.

The full proposed Vue 3.5.44/Router 5.4.0 pair reproduces
[upstream issue 2851](https://github.com/vuejs/router/issues/2851): after ancestor
Suspense has resolved, a nested route whose sole root is an async-setup component
raises a null getRootNode exception. A wrapping-element control completes without
that exception. Eventual content rendering does not erase the captured error.
Current application source has no Suspense/async-setup trigger; this is a vendor
composition regression, not a reproduced Harmoniarr page failure. Retaining the
working router avoids introducing that failure into future compositions.

## Final validation

| Gate | Observed result |
| --- | --- |
| validate:fast | 10,514 passed: 5,459 server, 4,384 client, 671 scripts; zero failed/cancelled/skipped; static checks, lint, hygiene and both builds passed |
| Selected native PostgreSQL HTTP contracts | Three new cases passed with required protection saved through the real settings route |
| Existing native auth/settings/recovery | All four passed, including actual export/restore and maintenance readiness |
| Selected Chromium navigation | New nested-navigation case, existing requester-role-request case and Missing Music legacy-redirect case all passed |
| npm security audit | Zero reported vulnerabilities at consultation time |
| Random PR 47 | Real LSP initialize/document-hover/shutdown and clean process close passed; see its [separate outcome](OPEN_PR_47_LOCAL_EVALUATION_OUTCOME.md) |
| AI skills | Testing skill and repository/installed standards skills pass skill-creator validation; four standards mirror files are byte-equal |

Native files run serially in isolated subprocesses with strict complete-case
reporter evidence and natural process close, without force-exit or successful
skip substitution. PostgreSQL 18.3 and existing immutable prerequisite images
were verified through the normal preflight. Browser files run serially after
the final client build. This is selected native/browser evidence, not either
complete suite, a production image rebuild or hosted-platform qualification.
Discovery finds 131 integration files; the other 129 were not freshly rerun.

Final native and browser source identity is 3,035 files, SHA-256
b16370ce66462350082c3887d00e3951b85bd12796407a841e3116b36289428e.
The source fingerprint includes package JSON/lock bytes. Browser asset inventory
and every file hash match before/after. Staging is checked against tested code.
Final fast validation took about 128 seconds; selected native files about 23
seconds and browser files about 29 seconds, excluding prerequisite work.
Some fast/native work overlapped under existing host load. These observations
are not a matched performance benchmark or a whole-CI speed improvement.

## Retained failures and evidence limits

The first new native collection passed two cases and failed the CSRF case:
it assumed required protection while the existing default was disabled. The
corrected test explicitly saves required mode before refusal checks; subsequent
collections passed. An initial browser-test lint error used an unqualified
document global and was corrected. The broader gate was repeated after trimming
the rollback's unrelated lock changes. Earlier passing collections are retained
as separate candidates, not substituted for final source proof.

Raw diagnostic, failed and passing logs, package backups, immutable PR metadata,
JSON-RPC output and source/asset hashes remain ignored under
.tmp/runtime-qualification-2026-10-19/. Existing Vue test warnings and the native
TestsStream end-listener warning remain visible; no warning suppression, retry,
deadline increase or concurrency change was introduced.

The browser test uses programmatic focus plus Enter; it does not prove sequential
Tab order, assistive-technology announcements or full WCAG conformance. The
library reproduction is diagnostic evidence outside the committed app tests.
LSP qualification covers a real JavaScript hover, not every editor operation.
No live provider, every route, all TLS/deployment modes or deployment image was
qualified. No PR merge, branch, tag or release was created by this work.

## Next recommendation

Reconcile default CSRF behavior with the [security policy](SECURITY_POLICY.md).
resolveCsrfProtectionMode currently returns disabled for an unset value; the
policy calls for protected cookie-authenticated writes by default and an
explicit deployment opt-out. This round proves the saved required mode works;
it does not fix or certify default protection. Design saved-setting/environment
precedence, existing-install migration and bootstrap/refresh exceptions, then
prove fresh/upgrade browser writes with actual durable-state controls. Prioritize
that concrete security gap before optional Fetch Metadata enforcement. Revisit a
fixed router release and TestsStream listener ownership independently afterward.
