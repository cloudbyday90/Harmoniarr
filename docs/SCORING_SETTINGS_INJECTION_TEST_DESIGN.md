# Scoring Settings Injection Test Design

> Phase 2, step E3 of the Settings Library track. Extends
> `test/server/import-candidate-service.test.js` to verify settings-driven
> scoring weights flow through the ingestion pipeline.

## Scope

Three tests added to the existing `import-candidate-service.test.js` file:

1. **Custom `loadSettingsFn` returns scoring weights** — Verify the `scorers`
   argument passed to `scoreDownloadResultFn` contains the custom weights from
   `loadSettingsFn`.
2. **`loadSettingsFn` returns no scoring namespace** — Verify the `scorers`
   argument uses default weights when settings don't include `scoring`.
3. **`loadSettingsFn` throws** — Verify the `scorers` argument uses default
   weights when settings source is unavailable.

## Strategy

Wrap `scoreDownloadResult` in a `t.mock.fn()` that captures the `scorers`
argument, then verify the weights. This follows the exact pattern of the
existing "uses injectable scoreDownloadResultFn" test (line 911) which captures
arguments via `mock.calls[0].arguments[0]`.

## Files

| File | Change |
|---|---|
| `test/server/import-candidate-service.test.js` | Add 3 tests after the existing injection test |

## Outcome

Full-chain verification that `loadSettingsFn` → `resolveScoringSettings` →
`effectiveScorers` → `scoreDownloadResultFn({scorers})` works correctly for
custom weights, missing namespace, and error fallback.
