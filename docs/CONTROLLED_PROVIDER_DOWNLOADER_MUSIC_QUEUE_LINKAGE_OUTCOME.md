# Controlled Provider Downloader Music Queue Linkage Outcome

## Result

Implemented on 2026-08-25. The controlled-provider validation now crosses the
real packaged Downloader boundary during shared fallback recovery.

It builds the production Downloader read model once for each isolated
operator, finds the fallback transfer by its persisted import-candidate link,
and requires that the exposed Music Queue release belongs only to that operator.
The validation rejects sibling release IDs, operator IDs, and the fixture's
private policy markers in the linkage payload.

## Delivered Changes

- Added a focused ESM verifier module and unit coverage for the scoped
  linkage/redaction contract.
- Mounted the helper read-only in the existing controlled-provider Compose
  overlay.
- Instantiated the packaged `createDownloaderModule` in the Docker verifier,
  using the same real slskd service as the discovery and recovery pipeline.
- Added aggregate-only Downloader linkage facts to the controlled-provider
  result gate, so a future regression fails the validation instead of merely
  changing diagnostic output.

## Validation Record

Passed on 2026-08-25:

```text
npm run lint:scripts
npm run lint:test
node --test test/testing/controlled-provider-music-queue-linkage-verifier.test.js \
  test/scripts/docker-controlled-provider-pipeline-validation.test.js \
  test/server/downloader-module.test.js \
  test/server/downloader-queue-read-model-service.test.js \
  test/server/downloader-import-candidate-linkage-service.test.js \
  test/server/downloader-music-queue-linkage-service.test.js
npm run check:esm
npm run migration:check
npm run check:schema-snapshot
npm run build
npm run validate:docker-controlled-provider-pipeline -- --no-cache
npm run validate
npm run validate:security
```

The full Docker command passed with 17 synthetic fixtures, 20 ingested
matches, four verified library adds, recovery and exhaustion branches, shared
release fan-out, and the new scoped Downloader linkage gate. It uses no live
provider or operator-owned files.

## Database Integrity Repair

The first Docker run exposed a constraint mismatch: the production execution
worker writes `awaiting_confirmation` before a slskd enqueue is confirmed, but
the `import_execution_run_items` constraint did not admit the state. The new
forward-only migration
`20260825_220000_import_execution_handoff_confirmation_status.sql` adds only
that already-used durable checkpoint and the regenerated schema snapshot keeps
fresh installs aligned. This preserves the no-duplicate-enqueue recovery rule.

## Scope Decision

No user-facing Downloader control, queue label, or provider configuration was
added. The existing native filter and accessible status behaviour remain the
single visible handoff. This work closes the underlying production read-model
gap first, which keeps the self-hosted deployment small and makes any future
UI change evidence-led.

## Next Item

Provide bounded, actionable readiness results for the owner-configured strict
provider probe after observing an actual configuration failure. Keep the
automated controlled-provider pipeline as the credential-free regression gate.
