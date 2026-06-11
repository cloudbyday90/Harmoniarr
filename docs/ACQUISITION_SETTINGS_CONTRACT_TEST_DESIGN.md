# Acquisition Settings Contract Test Design

> Phase 3, step C1 of the Settings Library track. Adds 5 contract tests for the
> Acquisition policy card to `settings-library-view-contract.test.js`.

## Problem

Steps A1–B1 implemented the acquisition namespace in the payload builder, composable,
and view. Contract tests verify the Vue SFC source text contains the correct
bindings, labels, and structural elements — without DOM rendering. The existing
contract test file has 14 tests (8 discovery + 6 scoring) but no acquisition tests.

## Research

### Node.js `assert.match` for source-text assertions

From the Node.js documentation (`node:assert/strict`):

> `assert.match(string, regexp[, message])` — Expects the string input to match the
> regular expression. If the values do not match, or if the string argument is of
> another type than string, an `AssertionError` is thrown.

The existing test file uses `assert.match(source, /regex/)` exclusively. This is a
lightweight contract testing approach that verifies structural invariants of the
template without mounting the component or rendering the DOM.

**Benefits:**

1. **Zero dependencies**: No Vue Test Utils, no jsdom, no DOM rendering.
2. **Fast**: Reads the file once per test, runs regex assertions.
3. **Contract enforcement**: Catches missing `v-model` bindings, wrong field names,
   missing labels, incorrect `min`/`max` ranges.
4. **Refactor safety**: If someone renames `form.acquisition.autoIgnoreCooldownHours`
   to something else, the test fails immediately.

**Limitations:**

1. Cannot test runtime behavior (computed properties, event handlers).
2. Regex patterns must be precise enough to avoid false positives from unrelated
   template sections.

### Existing contract test pattern

The file follows a consistent structure:

```js
test('SettingsLibraryView <description>', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');
  assert.match(source, /pattern/);
});
```

Each test is self-contained (reads the file independently). Tests are grouped by
concern (card presence, field wiring, input constraints, labels, save behavior).

### Test ordering

The existing tests follow this order:

1. Composable integration (line 25)
2. Discovery card presence (line 33)
3. Error state (line 41)
4. Discovery field wiring (line 48)
5. Discovery input constraints (line 57)
6. Discovery field labels (line 66)
7. Save behavior (line 75)
8. Loading state (line 85)
9. Scoring card presence (line 92)
10. Scoring field wiring (line 99)
11. Scoring input constraints (line 112)
12. Scoring sum indicator (line 118)
13. Scoring reset button (line 125)
14. Scoring field labels (line 132)

Acquisition tests should be inserted after the Discovery tests and before the
Scoring tests, matching the card order in the view (Discovery → Acquisition →
Scoring).

## Options Considered

### Decision 1: Test granularity

| Option | Pros | Cons |
|---|---|---|
| **A — 5 focused tests** (card presence, toggle wiring, cooldown wiring, disabled binding, labels) | Each test has a clear single concern; easy to identify what broke | More test functions |
| **B — 2 grouped tests** (card presence + wiring, constraints + labels) | Fewer test functions | Harder to pinpoint failures; mixed concerns per test |
| **C — 1 comprehensive test** (all acquisition assertions in one function) | Most compact | One failure hides others; no concern isolation |

**Chosen: A.** Matches the existing pattern where each test has a clear, singular
concern. The discovery section has 5 tests (presence, wiring, constraints, labels,
save), the scoring section has 5 tests (presence, wiring, constraints, sum, reset,
labels). The acquisition section should have 5 tests with the same granularity.

### Decision 2: Regex specificity for disabled binding

| Option | Pros | Cons |
|---|---|---|
| **A — Match exact attribute sequence**: `autoIgnoreCooldownHours.*:disabled="!form\.acquisition\.autoIgnoreEnabled"` | Precise; verifies both the field and its disabled condition in context | Longer regex; may break on attribute reordering |
| **B — Two separate assertions**: one for the field wiring, one for the disabled binding | Decoupled; each assertion tests one thing; survives attribute reordering | Doesn't verify both attributes are on the same element |

**Chosen: B.** The field wiring test already verifies `v-model.number` on the
cooldown. A separate test verifies the `:disabled` binding exists. This is more
resilient to attribute reordering (HTML attribute order is not significant).

## Final Recommendation

Add 5 tests after the Discovery section (after line 90) and before the Scoring
section (line 92):

### Test 1: Card presence
```
SettingsLibraryView renders the Acquisition policy card in the default branch
```
Asserts:
- `<h3 class="hx-card-title">Acquisition policy</h3>` is present
- Subtitle text "Control how Harmoniarr handles source users" is present

### Test 2: Toggle wiring
```
SettingsLibraryView wires the auto-ignore toggle to form.acquisition.autoIgnoreEnabled
```
Asserts:
- `v-model="form.acquisition.autoIgnoreEnabled"` is present (checkbox binding)

### Test 3: Cooldown wiring and constraints
```
SettingsLibraryView wires the cooldown field to form.acquisition.autoIgnoreCooldownHours
```
Asserts:
- `v-model.number="form.acquisition.autoIgnoreCooldownHours"` is present
- `min="0" max="8760" step="1"` is present (matching validator range)

### Test 4: Disabled binding
```
SettingsLibraryView disables the cooldown input when auto-ignore is off
```
Asserts:
- `:disabled="!form.acquisition.autoIgnoreEnabled"` is present

### Test 5: Field labels
```
SettingsLibraryView labels acquisition fields with hx-field-label
```
Asserts:
- `<label class="hx-field-label">Cooldown (hours)</label>` is present

Note: The toggle uses `cfg-check` with a `<span>` label, not `hx-field-label`,
so only the cooldown label is checked.

## Files

| File | Change |
|---|---|
| `test/client/settings-library-view-contract.test.js` | Add 5 acquisition contract tests |

## Security

- Contract tests verify that input constraints (`min`, `max`) match the server
  validator ranges. This catches accidental range changes that could allow invalid
  values through the client.
- The `:disabled` binding test ensures the progressive disclosure pattern is
  maintained (preventing accidental removal of the disabled guard).

## Outcome

5 contract tests added to `settings-library-view-contract.test.js` after the
Discovery section and before the Scoring section:

1. **Card presence**: Verifies "Acquisition policy" title and subtitle.
2. **Toggle wiring**: Verifies `v-model="form.acquisition.autoIgnoreEnabled"`.
3. **Cooldown wiring + constraints**: Verifies `v-model.number` binding and
   `min="0" max="8760" step="1"` range.
4. **Disabled binding**: Verifies `:disabled="!form.acquisition.autoIgnoreEnabled"`.
5. **Field label**: Verifies `<label class="hx-field-label">Cooldown (hours)</label>`.

19/19 tests pass (14 existing + 5 new), 0 lint warnings.

## Validation

- `node --test test/client/settings-library-view-contract.test.js` — all 19 tests
  pass (14 existing + 5 new).
- `npx eslint test/client/settings-library-view-contract.test.js --max-warnings 0`
  — no lint errors.
