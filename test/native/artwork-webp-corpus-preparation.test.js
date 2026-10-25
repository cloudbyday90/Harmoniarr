/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { readFile, readdir, statfs } from 'node:fs/promises';
import test from 'node:test';
import { artworkWorkerCgroup } from '../../testing/server/artwork-worker-cgroup.js';
import { prepareWebpArtworkCorpus } from '../../testing/server/webp-artwork-corpus-preparation.js';
import { readDeploymentMemory } from '../../testing/server/deployment-memory-observer.js';
await artworkWorkerCgroup({ memoryBytes: 3 * 1024 ** 3, cpus: 2, pids: 96 });
const temporary = await statfs('/tmp'); assert.equal(temporary.blocks * temporary.bsize, 256 * 1024 ** 2);
assert.deepEqual(await readdir('/qualification'), []);
assert.ok((await readFile('/proc/self/mountinfo', 'utf8')).split('\n').some(line => { const row = line.split(' '); return row[4] === '/sources' && row[5].split(',').includes('ro'); }));
test('offline corpus preparation reproduces every pinned input on the packaged runtime', { timeout: 60_000 }, async t => {
  const before = await readDeploymentMemory();
  const result = await prepareWebpArtworkCorpus({ root: '/qualification/inputs', sourcesRoot: '/sources', signal: t.signal });
  const after = await readDeploymentMemory(); assert.deepEqual(after.events, before.events);
  assert.equal(result.inputs.length, 4); t.diagnostic(JSON.stringify({ result, before, after, preparationOutsideEncoderMeasurements: true }));
});
