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
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function readRepositoryFile(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

test('controlled-provider Compose grants the disposable provider key only through a secret file', async () => {
  const source = await readRepositoryFile('compose.controlled-provider-fixture.yaml');

  assert.match(source, /secrets:\r?\n\s+controlled_provider_api_key:/u);
  assert.match(source, /file: \$\{HARMONIARR_CONTROLLED_PROVIDER_SECRET_FILE:\?Set HARMONIARR_CONTROLLED_PROVIDER_SECRET_FILE/u);
  assert.match(source, /harmoniarr:[\s\S]*?secrets:\r?\n\s+- source: controlled_provider_api_key/u);
  assert.match(source, /controlled-provider:[\s\S]*?secrets:\r?\n\s+- source: controlled_provider_api_key/u);
  assert.doesNotMatch(source, /CONTROLLED_PROVIDER_API_KEY:\s*\$\{/u);
});

test('controlled-provider fixtures read the key from the Compose secret mount', async () => {
  const [fixtureServerSource, verifierSource] = await Promise.all([
    readRepositoryFile('testing/docker/controlled-provider-fixture-server.mjs'),
    readRepositoryFile('testing/docker/controlled-provider-pipeline-verifier.mjs'),
  ]);

  assert.match(fixtureServerSource, /CONTROLLED_PROVIDER_API_KEY_FILE \?\? '\/run\/secrets\/controlled_provider_api_key'/u);
  assert.match(verifierSource, /readFile\('\/run\/secrets\/controlled_provider_api_key', 'utf8'\)/u);
  assert.doesNotMatch(fixtureServerSource, /process\.env\.CONTROLLED_PROVIDER_API_KEY(?!_FILE)/u);
  assert.doesNotMatch(verifierSource, /process\.env\.CONTROLLED_PROVIDER_API_KEY/u);
});
