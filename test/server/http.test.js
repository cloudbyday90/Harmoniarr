import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizePageLimit, sanitizePageOffset } from '../../src/server/http.js';

test('sanitizePageLimit returns default for undefined input', () => {
  assert.equal(sanitizePageLimit(undefined), 50);
});

test('sanitizePageLimit returns default for null input', () => {
  assert.equal(sanitizePageLimit(null), 50);
});

test('sanitizePageLimit returns default for non-numeric string', () => {
  assert.equal(sanitizePageLimit('abc'), 50);
});

test('sanitizePageLimit returns default for empty string', () => {
  assert.equal(sanitizePageLimit(''), 50);
});

test('sanitizePageLimit parses valid numeric string', () => {
  assert.equal(sanitizePageLimit('25'), 25);
});

test('sanitizePageLimit clamps to maximum', () => {
  assert.equal(sanitizePageLimit('500', { max: 100 }), 100);
});

test('sanitizePageLimit clamps negative values to 1', () => {
  assert.equal(sanitizePageLimit('-5'), 1);
});

test('sanitizePageLimit normalizes zero to default', () => {
  assert.equal(sanitizePageLimit('0'), 50);
});

test('sanitizePageLimit uses custom default when provided', () => {
  assert.equal(sanitizePageLimit(undefined, { default: 25, max: 50 }), 25);
});

test('sanitizePageLimit uses custom max when provided', () => {
  assert.equal(sanitizePageLimit('200', { default: 50, max: 75 }), 75);
});

test('sanitizePageLimit handles NaN input', () => {
  assert.equal(sanitizePageLimit(Number.NaN), 50);
});

test('sanitizePageLimit handles numeric input', () => {
  assert.equal(sanitizePageLimit(30), 30);
});

test('sanitizePageOffset returns 0 for undefined input', () => {
  assert.equal(sanitizePageOffset(undefined), 0);
});

test('sanitizePageOffset returns 0 for null input', () => {
  assert.equal(sanitizePageOffset(null), 0);
});

test('sanitizePageOffset returns 0 for non-numeric string', () => {
  assert.equal(sanitizePageOffset('abc'), 0);
});

test('sanitizePageOffset parses valid numeric string', () => {
  assert.equal(sanitizePageOffset('50'), 50);
});

test('sanitizePageOffset clamps negative to 0', () => {
  assert.equal(sanitizePageOffset('-10'), 0);
});

test('sanitizePageOffset handles NaN input', () => {
  assert.equal(sanitizePageOffset(Number.NaN), 0);
});

test('sanitizePageOffset handles numeric input', () => {
  assert.equal(sanitizePageOffset(100), 100);
});
