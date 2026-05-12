import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isValidThemePreference,
  THEME_STORAGE_KEY,
  VALID_THEME_PREFERENCES,
} from '../../src/client/lib/theme-preference.js';

// ---------------------------------------------------------------------------
// THEME_STORAGE_KEY
// ---------------------------------------------------------------------------

test('THEME_STORAGE_KEY is the expected localStorage key string', () => {
  assert.equal(THEME_STORAGE_KEY, 'hx-theme-preference');
});

test('THEME_STORAGE_KEY is a non-empty string', () => {
  assert.equal(typeof THEME_STORAGE_KEY, 'string');
  assert.ok(THEME_STORAGE_KEY.length > 0);
});

// ---------------------------------------------------------------------------
// VALID_THEME_PREFERENCES
// ---------------------------------------------------------------------------

test('VALID_THEME_PREFERENCES contains system, light, and dark', () => {
  assert.ok(VALID_THEME_PREFERENCES.includes('system'));
  assert.ok(VALID_THEME_PREFERENCES.includes('light'));
  assert.ok(VALID_THEME_PREFERENCES.includes('dark'));
});

test('VALID_THEME_PREFERENCES has exactly three entries', () => {
  assert.equal(VALID_THEME_PREFERENCES.length, 3);
});

// ---------------------------------------------------------------------------
// isValidThemePreference
// ---------------------------------------------------------------------------

test('isValidThemePreference returns true for system', () => {
  assert.equal(isValidThemePreference('system'), true);
});

test('isValidThemePreference returns true for light', () => {
  assert.equal(isValidThemePreference('light'), true);
});

test('isValidThemePreference returns true for dark', () => {
  assert.equal(isValidThemePreference('dark'), true);
});

test('isValidThemePreference returns false for null', () => {
  assert.equal(isValidThemePreference(null), false);
});

test('isValidThemePreference returns false for undefined', () => {
  assert.equal(isValidThemePreference(undefined), false);
});

test('isValidThemePreference returns false for empty string', () => {
  assert.equal(isValidThemePreference(''), false);
});

test('isValidThemePreference returns false for unrecognised string', () => {
  assert.equal(isValidThemePreference('auto'), false);
});

test('isValidThemePreference returns false for Dark (wrong case)', () => {
  assert.equal(isValidThemePreference('Dark'), false);
});

test('isValidThemePreference returns false for LIGHT (wrong case)', () => {
  assert.equal(isValidThemePreference('LIGHT'), false);
});

test('isValidThemePreference returns false for a number', () => {
  assert.equal(isValidThemePreference(0), false);
});

test('isValidThemePreference returns false for a boolean', () => {
  assert.equal(isValidThemePreference(true), false);
});

test('isValidThemePreference returns false for an object', () => {
  assert.equal(isValidThemePreference({}), false);
});

test('isValidThemePreference returns false for an array', () => {
  assert.equal(isValidThemePreference(['dark']), false);
});

test('isValidThemePreference accepts all values in VALID_THEME_PREFERENCES', () => {
  for (const pref of VALID_THEME_PREFERENCES) {
    assert.equal(isValidThemePreference(pref), true, `expected true for '${pref}'`);
  }
});
