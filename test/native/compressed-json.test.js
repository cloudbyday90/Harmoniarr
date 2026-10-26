/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { closePool } from '../../src/server/database.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';
import { runCompressedJsonProbe } from '../../testing/server/compressed-json-probe.js';

await requireDeploymentMemoryProfile();
test('packaged JSON parser survives trailing compressed bytes with compression support intact', { timeout: 20_000 }, async t => {
  t.after(closePool);
  const result = await runCompressedJsonProbe({ parserModuleUrl: new URL('file:///app/server-dist/http-hardening.js') });
  assert.deepEqual(result, { deflateTrailing: 200, gzipTrailing: 200, gzipValid: 200, health: 200 });
  t.diagnostic(JSON.stringify({ ...result, packagedParser: true, childRetired: true }));
});
