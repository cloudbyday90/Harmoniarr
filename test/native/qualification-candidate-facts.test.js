/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { after, test } from 'node:test';
import { getPool, closePool } from '../../src/server/database.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';
import { qualifyQualificationCandidateFacts } from '../../testing/server/qualification-candidate-facts-fixture.js';

await requireDeploymentMemoryProfile();
after(closePool);
test('packaged PostgreSQL qualifies minimal facts, policy parity and parent-only locking on disposable data', { timeout: 180_000 }, async () => {
  console.info(JSON.stringify(await qualifyQualificationCandidateFacts({ pool: getPool() })));
});
