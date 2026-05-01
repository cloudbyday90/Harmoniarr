import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getOptionalEnv,
  getRequiredEnv,
  parseBooleanEnv,
} from '../../scripts/script-environment.js';

test('getOptionalEnv trims values and returns null for empty inputs', () => {
  assert.equal(getOptionalEnv('VALUE', { VALUE: '  example  ' }), 'example');
  assert.equal(getOptionalEnv('EMPTY', { EMPTY: '   ' }), null);
  assert.equal(getOptionalEnv('MISSING', {}), null);
});

test('getRequiredEnv trims values and rejects missing inputs', () => {
  assert.equal(getRequiredEnv('VALUE', { VALUE: '  example  ' }), 'example');
  assert.throws(() => getRequiredEnv('MISSING', {}), /MISSING is required/);
});

test('parseBooleanEnv parses true and false strings with a default fallback', () => {
  assert.equal(parseBooleanEnv(' true '), true);
  assert.equal(parseBooleanEnv(' FALSE '), false);
  assert.equal(parseBooleanEnv(undefined, true), true);
  assert.throws(() => parseBooleanEnv('maybe'), /Boolean environment value expected/);
});