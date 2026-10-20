/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { nativeResumePlans } from './native-resume-policy.js';
import { runNativeResumeBatch, waitForNativeResume } from './native-resume-client.js';
import { readNativePartialApi } from './native-partial-api.js';
import { inspectRetiredNativeResumeFiles } from './native-resume-inspection.js';

if (process.argv[2] === 'inspect') {
  console.log(JSON.stringify(await inspectRetiredNativeResumeFiles()));
} else {
  const phase = process.argv[2];
  assert.ok(['defaults', 'eof', 'reset', 'retire'].includes(phase));
  const { apiKey, expectedVersion } = JSON.parse(await readFile('/run/fixture.json', 'utf8'));
  const config = { baseUrl: 'http://provider:5030', apiKey, requestTimeoutMs: 2000 };
  await waitForNativeResume(() => readNativePartialApi(config, 'server'), value => value.isLoggedIn === true);
  if (phase === 'defaults') {
    const retry = (await readNativePartialApi(config, 'options')).transfers.download.retry;
    const retryDefaults = { partial: retry.partial, attempts: retry.attempts, delay: retry.delay, maxDelay: retry.maxDelay };
    assert.deepEqual(retryDefaults, { partial: 'resume', attempts: 3, delay: 5000, maxDelay: 60000 });
    console.log(JSON.stringify(retryDefaults));
  } else if (phase === 'retire') {
    await waitForNativeResume(() => readNativePartialApi(config, 'debug/transfers'), value => value.soulseek.downloads.length === 0);
    console.log(JSON.stringify({ nativeDownloadsRetired: true }));
  } else {
    console.log(JSON.stringify(await runNativeResumeBatch({ plan: nativeResumePlans.find(plan => plan.kind === phase), config, expectedVersion })));
  }
}
