/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseScriptArguments,
  getRequiredPositionalArgument,
  getScriptPositionals,
  joinPositionalArguments,
} from '../../scripts/script-arguments.js';

test('parseScriptArguments returns typed option values', () => {
  const { values } = parseScriptArguments({
    args: ['--release-tag', 'v1.2.3', '--enable-dockerhub'],
    options: {
      'enable-dockerhub': { type: 'boolean' },
      'release-tag': { type: 'string' },
    },
  });

  assert.equal(values['release-tag'], 'v1.2.3');
  assert.equal(values['enable-dockerhub'], true);
});

test('parseScriptArguments supports negative boolean flags when enabled', () => {
  const { values } = parseScriptArguments({
    allowNegative: true,
    args: ['--no-enable-dockerhub'],
    options: {
      'enable-dockerhub': { type: 'boolean' },
    },
  });

  assert.equal(values['enable-dockerhub'], false);
});

test('getScriptPositionals returns parsed positionals', () => {
  assert.deepEqual(getScriptPositionals(['publish-image', '--', 'ignored-as-positional']), [
    'publish-image',
    'ignored-as-positional',
  ]);
});

test('getRequiredPositionalArgument returns the trimmed positional value', () => {
  assert.equal(
    getRequiredPositionalArgument('summary kind', { args: ['  publish-image  '] }),
    'publish-image',
  );
});

test('getRequiredPositionalArgument rejects missing values', () => {
  assert.throws(
    () => getRequiredPositionalArgument('summary kind', { args: [] }),
    /summary kind is required/,
  );
});

test('joinPositionalArguments joins all positionals with spaces', () => {
  assert.equal(joinPositionalArguments(['new', 'album', 'import']), 'new album import');
});