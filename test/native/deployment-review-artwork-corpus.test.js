/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import test from 'node:test';
import { closePool, getPool } from '../../src/server/database.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';
import { selectDeploymentArtworkCase } from '../../testing/server/deployment-artwork-corpus-case.js';
import { qualifyDeploymentReviewMemory } from '../../testing/server/deployment-review-qualification.js';

const { gib, profile } = await requireDeploymentMemoryProfile();
const spec = selectDeploymentArtworkCase(process.env.HARMONIARR_REVIEW_ARTWORK_CASE);
test(`mixed workload artwork corpus: ${spec.id}`, { timeout: 180_000 }, async t => {
  t.after(closePool);
  t.diagnostic(JSON.stringify(await qualifyDeploymentReviewMemory({ pool: getPool(), profile, gib, signal: t.signal, artworkCaseId: spec.id })));
});
