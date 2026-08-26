/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  controlledProviderApiKeySecretName,
  resolveControlledProviderApiKeySecretPath,
  writeControlledProviderApiKeySecret,
} from '../../scripts/controlled-provider-validation-secret.js';

test('controlled-provider validation writes its disposable key to a private Compose secret file', async () => {
  const writes = [];
  const secretPath = await writeControlledProviderApiKeySecret({
    apiKey: 'disposable-provider-key',
    secretDirectory: 'C:/temporary/controlled-provider/secrets',
    writeFileFn: async (path, value, options) => writes.push({ options, path, value }),
  });

  assert.equal(controlledProviderApiKeySecretName, 'controlled_provider_api_key');
  assert.equal(secretPath, resolveControlledProviderApiKeySecretPath('C:/temporary/controlled-provider/secrets'));
  assert.deepEqual(writes, [{
    options: { encoding: 'utf8', mode: 0o600 },
    path: secretPath,
    value: 'disposable-provider-key\n',
  }]);
});

test('controlled-provider validation rejects empty secret inputs', async () => {
  assert.throws(
    () => resolveControlledProviderApiKeySecretPath(''),
    /secretDirectory must be a non-empty string/u,
  );
  await assert.rejects(
    () => writeControlledProviderApiKeySecret({
      apiKey: '',
      secretDirectory: 'C:/temporary/controlled-provider/secrets',
    }),
    /apiKey must be a non-empty string/u,
  );
});
