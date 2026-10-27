/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { nativeRefusalPlans } from './native-refusal-policy.js';
import { runNativeRefusalBatch } from './native-refusal-client.js';
import { waitForNativeResume } from './native-resume-client.js';
import { readNativePartialApi } from './native-partial-api.js';
import { inspectRetiredNativeRefusalFiles } from './native-refusal-inspection.js';
import { readNativeProviderObservation } from './native-observer-api.js';

const phase = process.argv[2];
if (phase === 'inspect') {
  console.log(JSON.stringify(await inspectRetiredNativeRefusalFiles()));
} else {
  assert.ok(['defaults', 'exhaustion', 'size-change', 'retire'].includes(phase));
  const { apiKey, expectedVersion, observerApiKey } = JSON.parse(await readFile('/run/fixture.json', 'utf8'));
  const config = { baseUrl: 'http://provider:5030', apiKey, requestTimeoutMs: 2000 };
  const observationConfig = { ...config, observerApiKey };
  await waitForNativeResume(() => readNativePartialApi(config, 'application'), value => value.server?.isLoggedIn === true);
  if (phase === 'defaults') {
    const retry = (await readNativeProviderObservation(observationConfig, 'options')).transfers.download.retry;
    const retryDefaults = { partial: retry.partial, attempts: retry.attempts, delay: retry.delay, maxDelay: retry.maxDelay };
    assert.deepEqual(retryDefaults, { partial: 'resume', attempts: 3, delay: 5000, maxDelay: 60000 });
    console.log(JSON.stringify(retryDefaults));
  } else if (phase === 'retire') {
    await waitForNativeResume(() => readNativeProviderObservation(observationConfig, 'debug/transfers'), value => value.soulseek.downloads.length === 0);
    console.log(JSON.stringify({ nativeDownloadsRetired: true }));
  } else {
    console.log(JSON.stringify(await runNativeRefusalBatch({ plan: nativeRefusalPlans.find(plan => plan.kind === phase), config, expectedVersion })));
  }
}
