# Fidelity Settings Test Design

> Phase 5 of the Settings Library track. Test coverage for the `fidelity` settings
> namespace in the frontend pipeline.

## Contract Tests (`settings-library-view-contract.test.js`)

4 new tests added after the Scoring section:

1. **Card presence**: Asserts `Fidelity thresholds` in `hx-card-title` and the
   descriptive subtitle text.
2. **Field wiring**: Asserts all 9 `v-model.number="form.fidelity.*"` bindings.
3. **Input constraints**: Asserts `min`/`max`/`step` for all 9 fields match the
   server validator ranges.
4. **Field labels**: Asserts all 9 `hx-field-label` elements.

## Payload Tests (`settings-form.test.js`)

2 new tests plus 1 existing fixture update:

1. **Fixture update**: First test (`preserves existing slskd api key`) updated to
   include `fidelity: createFidelityForm()` in input and expected output.
2. **Custom values**: Asserts all 9 fidelity fields with non-default values pass
   through `buildSettingsUpdatePayload`.
3. **Default values**: Asserts `createFidelityForm()` defaults pass through
   correctly.

## Helper

`createFidelityForm()` returns an object with all 9 default values matching the
server validator defaults:

```js
{
  spectralAuthenticMinCutoffHz: 20000,
  spectralSuspiciousMinCutoffHz: 19000,
  spectralTranscodeMidCutoffHz: 16000,
  spectralMinSampleRateHz: 44100,
  trustWatchFailureCount: 3,
  trustWatchMaxSuccessRate: 0.5,
  trustWatchEvidenceCount: 3,
  trustHealthyEvidenceCount: 5,
  trustHealthyMinSuccessRate: 0.8,
}
```

## Validation Results

- `node --test test/client/settings-form.test.js`: 13/13 pass
- `node --test test/client/settings-library-view-contract.test.js`: 28/28 pass
- `npm run lint:client`: 0 warnings
