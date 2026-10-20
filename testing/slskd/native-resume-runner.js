/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';

export async function runNativeResumeScenario({ docker, fixtureId, providerId }) {
  const step = async phase => JSON.parse(await docker(['exec', fixtureId, 'node', '/app/testing/slskd/native-resume-scenario.js', phase]));
  const retryDefaults = await step('defaults');
  const scenarios = [await step('eof'), await step('reset')];
  const retirement = await step('retire');
  await docker(['stop', '--time', '5', providerId]);
  const stopped = JSON.parse(await docker(['inspect', providerId]))[0];
  assert.equal(stopped.Id, providerId); assert.equal(stopped.State.Running, false); assert.equal(stopped.State.ExitCode, 0);
  const filesystem = await step('inspect');
  return { complete: true, scenarios, retryDefaults, ...retirement, filesystem, providerStoppedBeforeInspection: true };
}
