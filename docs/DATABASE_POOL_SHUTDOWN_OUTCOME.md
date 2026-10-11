# Database pool shutdown outcome

October 11, 2026. A held native PostgreSQL client reproduced replacement creation
during `closePool()` on the original code: the unchanged refusal assertion failed
with `Missing expected exception`. The rejected log remains at
`.tmp/app-pool-lifetime-2026-10-11/rejected-native.log`. This is a newly reproduced
pool-generation race, not a reproduced cause of the historical Activity/admin
bootstrap failures.

## Implemented behavior

The small ESM lifecycle factory owns generation, admission and native completion.
`database.js` keeps configuration and idle-error handling and delegates pool
ownership. Getters refuse synchronously during close; overlapping closers share
one promise and end call. Success permits serial restart; failed end retains the
original rejected promise and closed admission, including a null rejection.
No retries, SQL, acquisition-limit, schema, UI or HTTP authorization changes.
The new refusal has a fixed code/message and includes no connection details.

The [design](DATABASE_POOL_SHUTDOWN_DESIGN.md) details alternatives and tradeoffs;
the [official research ledger](DATABASE_POOL_SHUTDOWN_RESEARCH_2026_10.md) separates
pg, Node, OWASP and W3C guidance from this project's architectural decisions.

## Executed evidence

- Focused database lifecycle/idle-error, actual HTTP boundary and startup
  supervisor controls: 14 passed, zero failed/cancelled/skipped.
- Native held-client control: 1 passed, zero failed/cancelled/skipped. It verifies
  pending closure, refusal, shared close, continued SQL on the held client,
  release/end completion and SQL on the next pool generation.
- Scoped lint passed. Host Node 24.18.1, npm 12.0.2, pg 8.23.0 and pg-pool 3.14.0
  were read locally. Native timing is evidence of completion, not a matched
  benchmark against the rejected candidate.

Raw local evidence is retained under `.tmp/app-pool-lifetime-2026-10-11/`.
The stable `npm run validate` exited zero in 1,053.68s (17m33.68s): 9,918 passed,
zero failed/cancelled/todo and 10 skipped. Its layers were 4,628 server, 4,384
client, 552 script and 354 passed/10 skipped integration tests. Static checks,
complete lint, test hygiene and both builds passed. The integration process took
909.53s. The ten native skips explicitly reported unavailable local ffmpeg/
ffprobe; they are not counted as coverage or as test-efficiency savings.

The existing media fixture image was then inspected and selected by immutable
ID `sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`.
Its observed ffprobe is 8.0.1; actual ffmpeg generation and worker inspections
passed. The three owning media files passed 22/22 in 179.45s, with zero failures,
cancellations or skips. Every one of the ten skipped names is matched to a
passing follow-up case in `media-coverage.json`. This closes the identified
coverage gap across separate runs; it is not one skip-free complete gate or a
matched benchmark. Source code stayed frozen. No otherwise passing full gate
was repeated. Media invocations use the existing network-disabled, owned-workspace
fixture and the scoped environment was restored.

Executed commands (PowerShell, repository root):

```powershell
node --test test/server/database-pool-lifecycle.test.js test/server/database.test.js test/server/http-shutdown-lifetime.test.js test/server/startup-service-supervisor.test.js
node --test --test-concurrency=1 test/integration/database-pool-lifecycle.test.js
npm run validate
npm run validate:security:npm
```

The native command first supplied the retained rejected baseline; after the
implementation it passed without weakening its refusal assertion or bounds.
The full gate includes the new native case, both app-runtime entries and the
original Activity/admin consumers through their unchanged serial membership.

Media prerequisite completion used the existing immutable image above and:

```powershell
$priorMediaFixtureImage = [Environment]::GetEnvironmentVariable('HARMONIARR_INTEGRATION_MEDIA_IMAGE', 'Process')
try {
  $env:HARMONIARR_INTEGRATION_MEDIA_IMAGE = 'sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2'
  node --test --test-concurrency=1 test/integration/missing-music-add-to-library.test.js test/integration/missing-music-library-add-recheck.test.js test/integration/music-queue-automatic-library-add.test.js
} finally {
  [Environment]::SetEnvironmentVariable('HARMONIARR_INTEGRATION_MEDIA_IMAGE', $priorMediaFixtureImage, 'Process')
}
```

Npm audit reports zero vulnerabilities. Source/installed standards skills and
the maintained testing skill pass structural validation; all four maintained
standards files match after synchronization. Five staged code hashes match the
tested freeze, and all 381 local links in the eleven changed Markdown documents
resolve. Windows-aware whitespace checks pass. These are scoped quality checks,
not a new blind skill trial or whole-system security certification.

## Remaining boundary and next recommendation

The real HTTP gate holds detached work beyond a completed response and closed
server; it releases and awaits that work in cleanup. The apply worker's microtask
launch and dispatcher's unawaited launched handlers are concrete next owners to
audit. The fixed fixture delay stays this round. Closing a pool does not drain
arbitrary worker/provider/filesystem work or permanently seal the old invocation
after a successful restart. Existing swallowed fixture cleanup errors likewise
remain a separate issue; the lifecycle itself no longer loses its close failure.

Next: own the apply-worker completion promise and close new worker admission,
then integrate actual drain into app-fixture teardown. Prove late registration,
startup failure, Error/null failure and cancellation before replacing the 150 ms
delay. Follow with the exhaustive cohort/remainder dispatcher only after these
owners are sound. Historical first-checkout failures remain unreproduced.

The [fresh PR assessment](OPEN_PR_APPLICABILITY_POOL_SHUTDOWN_2026_10_OUTCOME.md)
found no unreplayed applicable patch. Standards/testing skills gained narrow
owner/evidence and media-prerequisite guidance. Main only; no new branch, release or PR merge. This
round does not rebuild the previously validated local Docker image.
