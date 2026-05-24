import assert from 'node:assert/strict';
import test from 'node:test';
import { isAbortError } from '../../src/client/lib/abort-error.js';

test('isAbortError returns true for DOMException with AbortError name', () => {
  const error = new DOMException('The operation was aborted', 'AbortError');
  assert.equal(isAbortError(error), true);
});

test('isAbortError returns true for error with request_aborted code', () => {
  const error = { name: 'Error', code: 'request_aborted' };
  assert.equal(isAbortError(error), true);
});

test('isAbortError returns true for error with both AbortError name and request_aborted code', () => {
  const error = { name: 'AbortError', code: 'request_aborted' };
  assert.equal(isAbortError(error), true);
});

test('isAbortError returns false for generic Error', () => {
  assert.equal(isAbortError(new Error('generic')), false);
});

test('isAbortError returns false for TypeError', () => {
  assert.equal(isAbortError(new TypeError('type')), false);
});

test('isAbortError returns false for null', () => {
  assert.equal(isAbortError(null), false);
});

test('isAbortError returns false for undefined', () => {
  assert.equal(isAbortError(undefined), false);
});

test('isAbortError returns false for string', () => {
  assert.equal(isAbortError('AbortError'), false);
});

test('isAbortError returns false for number', () => {
  assert.equal(isAbortError(42), false);
});

test('isAbortError returns false for plain object without matching name or code', () => {
  assert.equal(isAbortError({ name: 'NetworkError', code: 'ECONNREFUSED' }), false);
});

test('isAbortError returns false for empty object', () => {
  assert.equal(isAbortError({}), false);
});
