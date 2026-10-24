/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { after, test } from 'node:test';
import { getPool, closePool } from '../../src/server/database.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';
import { qualifyCandidateSearchRevisions } from '../../testing/server/candidate-search-revision-fixture.js';

await requireDeploymentMemoryProfile();
after(closePool);
test('packaged PostgreSQL qualifies durable candidate revisions on disposable data', { timeout: 180_000 }, async () => {
  console.info(JSON.stringify(await qualifyCandidateSearchRevisions({ pool: getPool() })));
});
