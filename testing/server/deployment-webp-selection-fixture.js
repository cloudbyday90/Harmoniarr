/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { selectWebpSelectionCase } from './webp-selection-cases.js';
import { prepareDeploymentWebpSelectionCase } from './deployment-webp-selection-case.js';
import { createDeploymentWebpSelectionObserver } from './deployment-webp-selection-observer.js';
import { settleDeploymentArtwork } from './deployment-artwork-publication.js';

/** Only test-owned input/observation/cancellation differs from the shared workload. */
export function createDeploymentWebpSelectionFixture({ caseId, scenario, mediaObserver, signal }) {
  const selected = selectWebpSelectionCase(caseId);
  const observation = createDeploymentWebpSelectionObserver({ mediaObserver, inputBytes: selected.input.inputBytes, scenario, signal });
  return {
    prepare: async options => {
      const prepared = await prepareDeploymentWebpSelectionCase(caseId, { ...options, verifyPublication: observation.verifyPublication });
      prepared.spec.cancel = scenario === 'cancel'; return prepared;
    },
    createWorker: observation.createWorker,
    async settle(options) {
      const { pool, tasks, owners, children, getPolicy, getDownloads, getPublicationLookups } = options;
      let result;
      if (scenario === 'publish') result = await settleDeploymentArtwork(options);
      else {
        const settled = await Promise.allSettled(tasks);
        for (const row of settled) { assert.equal(row.status, 'rejected'); assert.equal(row.reason?.code, 'artwork_worker_cancelled'); assert.equal(row.reason?.status, 503); }
        assert.equal(getPublicationLookups(), 0); assert.equal(getDownloads(), 2); assert.equal(children.length, 1);
        const assignments = (await pool.query('SELECT count(*)::int AS count FROM artwork_assignments WHERE owner_id=ANY($1::uuid[])', [owners])).rows[0].count;
        assert.equal(assignments, 0);
        result = { images: 0, assignments, outputSha256: null, publicationReservedBytes: 0, artworkCase: { ...options.artworkCase.evidence, cancelled: 2, closedWorkers: 1 } };
      }
      const count = (await pool.query('SELECT count(*)::int AS count FROM artwork_assets')).rows[0].count;
      let files;
      try { files = (await readdir(getPolicy().storage.root, { recursive: true, withFileTypes: true })).filter(row => row.isFile()).length; }
      catch (error) { if (error.code !== 'ENOENT') throw error; files = 0; }
      assert.equal(count, scenario === 'publish' ? 1 : 0); assert.equal(files, count);
      return { ...result, selection: { ...observation.getEvidence(), databaseRows: count, files } };
    },
  };
}
