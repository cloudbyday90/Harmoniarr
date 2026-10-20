/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

export async function readNativePartialApi(config, path) {
  const response = await fetch(config.baseUrl + '/api/v0/' + path, {
    headers: { 'X-API-Key': config.apiKey }, signal: AbortSignal.timeout(2000),
  });
  assert.equal(response.status, 200); return response.json();
}

export async function waitForNativePartialState(read, accepted) {
  const deadline = performance.now() + 15_000;
  let value;
  do {
    value = await read();
    if (accepted(value)) return value;
    await delay(100);
  } while (performance.now() < deadline);
  throw new Error('Native partial-transfer state did not reach its bounded checkpoint');
}
