/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { closePool, getPool } from '../../src/server/database.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';
import { qualifyDeploymentReviewMemory } from '../../testing/server/deployment-review-qualification.js';
import { createDeploymentWebpSelectionFixture } from '../../testing/server/deployment-webp-selection-fixture.js';
import { selectWebpSelectionCase } from '../../testing/server/webp-selection-cases.js';

const { gib, profile } = await requireDeploymentMemoryProfile();
const selected = selectWebpSelectionCase(process.env.HARMONIARR_SELECTION_CASE);
const scenario = process.env.HARMONIARR_SELECTION_SCENARIO ?? 'publish'; assert.ok(['publish', 'cancel'].includes(scenario));
assert.equal(process.env.HARMONIARR_BOUNDARY_FIXTURE_ROOT, '/boundary-inputs');
assert.ok((await readFile('/proc/self/mountinfo', 'utf8')).split('\n').some(line => { const fields = line.split(' '); return fields[4] === '/boundary-inputs' && fields[5].split(',').includes('ro'); }));

test(`mixed selected WebP ${scenario}: ${selected.input.id} (${gib} GiB)`, { timeout: 180_000 }, async t => {
  t.after(closePool);
  t.diagnostic(JSON.stringify(await qualifyDeploymentReviewMemory({ pool: getPool(), profile, gib, signal: t.signal,
    artworkFixtureFactory: options => createDeploymentWebpSelectionFixture({ ...options, caseId: selected.input.id, scenario }),
  })));
});
