/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';

export async function runNativePartialScenario({ docker, fixtureId, providerId }) {
  const step = async phase => JSON.parse(await docker(['exec', fixtureId, 'node', '/app/testing/slskd/native-partial-scenario.js', phase]));
  const result = await step('run');
  await docker(['stop', '--time', '5', providerId]);
  const stopped = JSON.parse(await docker(['inspect', providerId]))[0];
  assert.equal(stopped.Id, providerId); assert.equal(stopped.State.Running, false);
  assert.equal(stopped.State.ExitCode, 0);
  const filesystem = await step('inspect');
  for (const partial of filesystem.incomplete) {
    const receipt = result.scenarios.find(row => row.filename === partial.filename);
    assert.equal(receipt.bytesTransferred, partial.size);
  }
  return { ...result, filesystem, providerStoppedBeforeInspection: true };
}
