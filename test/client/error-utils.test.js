import assert from 'node:assert/strict';
import test from 'node:test';
import { getErrorMessage } from '../../src/client/lib/error-utils.js';

test('getErrorMessage returns error.message for Error instances', () => {
  assert.equal(getErrorMessage(new Error('something broke'), 'fallback'), 'something broke');
});

test('getErrorMessage returns error.message for TypeError', () => {
  assert.equal(getErrorMessage(new TypeError('bad type'), 'fallback'), 'bad type');
});

test('getErrorMessage returns fallback for string', () => {
  assert.equal(getErrorMessage('not an error', 'fallback'), 'fallback');
});

test('getErrorMessage returns fallback for null', () => {
  assert.equal(getErrorMessage(null, 'fallback'), 'fallback');
});

test('getErrorMessage returns fallback for undefined', () => {
  assert.equal(getErrorMessage(undefined, 'fallback'), 'fallback');
});

test('getErrorMessage returns fallback for number', () => {
  assert.equal(getErrorMessage(42, 'fallback'), 'fallback');
});

test('getErrorMessage returns fallback for plain object', () => {
  assert.equal(getErrorMessage({ message: 'hi' }, 'fallback'), 'fallback');
});

test('getErrorMessage returns undefined fallback when not provided', () => {
  assert.equal(getErrorMessage('not an error'), undefined);
});
