/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';

test('ordinary emitter diagnostics remain enabled', () => {
  const emitter = new EventEmitter();
  assert.equal(emitter.getMaxListeners(), 10);
  for (let index = 0; index < 11; index++) emitter.on('end', () => {});
});
