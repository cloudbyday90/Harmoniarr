/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import test from 'node:test';
import { closePool, getPool } from '../../src/server/database.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';
import { qualifyDeploymentReviewMemory } from '../../testing/server/deployment-review-qualification.js';

const { gib, profile } = await requireDeploymentMemoryProfile();
test('packaged review requests and owned restart overlap real media, artwork and PostgreSQL work', { timeout: 180_000 }, async t => {
  t.after(closePool);
  t.diagnostic(JSON.stringify(await qualifyDeploymentReviewMemory({ pool: getPool(), profile, gib, signal: t.signal })));
});
