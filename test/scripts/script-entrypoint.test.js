/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { isDirectExecution } from '../../scripts/script-entrypoint.js';

test('isDirectExecution prefers import.meta.main when available', () => {
  assert.equal(isDirectExecution({ main: true, url: 'file:///ignored.js' }, []), true);
  assert.equal(isDirectExecution({ main: false, url: 'file:///ignored.js' }, []), false);
});

test('isDirectExecution falls back to argv entrypoint URL matching', () => {
  const entryPath = 'C:\\repo\\scripts\\task.js';
  const entryUrl = pathToFileURL(entryPath).href;

  assert.equal(isDirectExecution({ url: entryUrl }, ['node', entryPath]), true);
  assert.equal(isDirectExecution({ url: 'file:///different.js' }, ['node', entryPath]), false);
});

test('isDirectExecution returns false when argv entrypoint is absent', () => {
  assert.equal(isDirectExecution({ url: 'file:///task.js' }, ['node']), false);
  assert.equal(isDirectExecution({ url: 'file:///task.js' }, null), false);
});