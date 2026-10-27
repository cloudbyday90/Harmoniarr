/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { nativePartialPlans } from './native-partial-plan.js';
import { runNativePartialBatch } from './native-partial-client.js';
import { inspectRetiredNativePartialFiles } from './native-partial-inspection.js';
import { readNativePartialApi, waitForNativePartialState } from './native-partial-api.js';
import { inspectCompletedNativeFiles } from './native-completed-files.js';
import { readNativeProviderObservation } from './native-observer-api.js';

if (process.argv[2] === 'inspect') {
  console.log(JSON.stringify(await inspectRetiredNativePartialFiles()));
} else {
  assert.equal(process.argv[2], 'run');
  const { apiKey, expectedVersion, observerApiKey } = JSON.parse(await readFile('/run/fixture.json', 'utf8'));
  const config = { baseUrl: 'http://provider:5030', apiKey, requestTimeoutMs: 2000 };
  const observationConfig = { ...config, observerApiKey };
  await waitForNativePartialState(() => readNativePartialApi(config, 'application'), value => value.server?.isLoggedIn === true);
  const scenarios = [];
  for (const plan of nativePartialPlans) scenarios.push(await runNativePartialBatch({ plan, config, expectedVersion }));
  await inspectCompletedNativeFiles([nativePartialPlans[0].file]);
  await waitForNativePartialState(() => readNativeProviderObservation(observationConfig, 'debug/transfers'), value => value.soulseek.downloads.length === 0);
  console.log(JSON.stringify({ complete: true, scenarios, nativeDownloadsRetired: true }));
}
