/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { after, test } from 'node:test';
import { getPool, closePool } from '../../src/server/database.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';
import { qualifyQualityReviewSearchFences } from '../../testing/server/quality-review-search-fence-fixture.js';

await requireDeploymentMemoryProfile();
after(closePool);
test('packaged PostgreSQL qualifies the nonwaiting restart fence on disposable data', { timeout: 60_000 }, async () => {
  console.info(JSON.stringify(await qualifyQualityReviewSearchFences({ pool: getPool() })));
});
