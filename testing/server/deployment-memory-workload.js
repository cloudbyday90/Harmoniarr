/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { createApp } from '../../src/server/app.js';
import { createArtworkModule } from '../../src/server/artwork/artwork-module.js';
import { createArtworkFetchService } from '../../src/server/artwork/artwork-fetch-service.js';
import { createArtworkImageDownloadService } from '../../src/server/artwork/artwork-image-download-service.js';
import { createArtworkIngestionService, prepareArtworkAsset } from '../../src/server/artwork/artwork-ingestion-service.js';
import { createArtworkIngestionAdmission } from '../../src/server/artwork/artwork-ingestion-admission.js';
import { createArtworkWorkerService } from '../../src/server/artwork/artwork-worker-service.js';
import { upsertArtworkAsset } from '../../src/server/artwork/artwork-repository.js';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';
import { measureDeploymentMemory } from './deployment-memory-observer.js';
import { withDeploymentDatabaseWork } from './deployment-memory-database.js';
import { withDeploymentImageProvider } from './deployment-memory-provider.js';
import { maximumByteArtworkPng } from './artwork-worker-inputs.js';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export async function runDeploymentMemoryWorkload({ pool, dimension, callerBytes, maximumBytes = false }) {
  const image = maximumBytes ? (await maximumByteArtworkPng(100 * 1024 ** 2)).input
    : await sharp({ create: { width: dimension, height: dimension, channels: 3, background: 'red' } }).jpeg().toBuffer();
  const jobs = maximumBytes ? 1 : 2;
  return withDeploymentImageProvider(image, async provider => {
    const gate = createArtworkIngestionAdmission(); const children = []; const tasks = [];
    let activeChildren = 0; let peakChildren = 0; let downloads = 0; let heldPublication = false;
    const published = Promise.withResolvers(); const release = Promise.withResolvers(); const downloaded = Promise.withResolvers();
    const worker = createArtworkWorkerService({ spawnFn: (...args) => {
      const child = spawn(...args); const record = { pid: child.pid, closed: false }; children.push(record);
      activeChildren++; peakChildren = Math.max(peakChildren, activeChildren);
      child.once('close', () => { record.closed = true; activeChildren--; }); return child;
    } });
    let policy;
    const application = createApp({ clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json', createArtworkModule: options => {
      // Keep the actual settings/storage owner; only this fixture's policy maxima
      // and provider order differ from the fresh-install defaults.
      const base = createArtworkModule(options); const original = base.artworkPolicyService;
      const artworkPolicyService = { getArtworkRuntimePolicy: async () => {
        policy = await original.getArtworkRuntimePolicy();
        return { ...policy, fetch: { ...policy.fetch, providerOrder: ['fanartTv'] },
          limits: { maxOriginalFileSizeBytes: 100 * 1024 ** 2, maxOriginalDimensionPixels: 8192 } };
      } };
      const ingestion = createArtworkIngestionService({ artworkPolicyService, artworkIngestionAdmission: gate,
        prepareArtworkAssetFn: input => prepareArtworkAsset({ ...input, transformArtworkBufferFn: worker.processArtworkBuffer }),
        upsertArtworkAssetFn: async asset => {
          const saved = await upsertArtworkAsset(asset);
          if (!heldPublication) { heldPublication = true; published.resolve(); await release.promise; }
          return saved;
        },
      });
      const transport = createArtworkImageDownloadService({ fetchImpl: provider.fetchImpl });
      const fetchService = createArtworkFetchService({ artworkPolicyService, artworkIngestionService: ingestion,
        artworkAssignmentService: base.artworkAssignmentService, artworkQuotaService: base.artworkQuotaService,
        artworkFetchBackoffService: base.artworkFetchBackoffService,
        fanartTvClient: { fetchArtistImages: async () => [{ imageType: 'artistthumb', url: 'https://assets.fanart.tv/memory.jpg' }] },
        downloadImageFn: async (...args) => { const result = await transport.downloadImageBuffer(...args); if (++downloads === jobs) downloaded.resolve(); return result; },
      });
      return { ...base, artworkIngestionService: ingestion, artworkFetchService: fetchService };
    } });
    application.runtimeResourceService.applyProcessRuntimePreferences();
    return withWorkerTaskCleanup(async () => {
      return await measureDeploymentMemory(async checkpoint => {
        const retained = Buffer.alloc(callerBytes, 0x5a);
        return withDeploymentDatabaseWork(pool, async database => {
          await checkpoint('admitted');
          const owners = Array.from({ length: jobs }, () => randomUUID()); let publicationReservedBytes;
          for (const ownerId of owners) tasks.push(application.artworkModule.artworkFetchService.resolveArtwork({
            ownerId, ownerType: 'musicbrainz_artist', artworkRole: 'artist_thumbnail',
          }));
          const completed = Promise.all(tasks);
          try {
            await Promise.race([Promise.all([published.promise, downloaded.promise]), completed.then(() => assert.fail('Publication hold was bypassed'))]);
            assert.equal(Number((await pool.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE application_name = 'hx_memory_work' AND wait_event = 'advisory'")).rows[0].count), 2);
            assert.ok(gate.getMemoryState().reservedBytes > 0); assert.ok(children.some(child => child.closed));
            publicationReservedBytes = gate.getMemoryState().reservedBytes;
            if (dimension === 8192) { assert.equal(children.length, 1); assert.equal(gate.getState().queued, 1); }
            await checkpoint('publication');
          } finally { release.resolve(); }
          const results = await completed;
          assert.equal(downloads, jobs); assert.equal(children.length, jobs);
          const hashes = [];
          for (const result of results) {
            assert.equal(result.sourceProvider, 'fanartTv');
            const row = (await pool.query('SELECT sha256, relative_path, payload_checksum FROM artwork_assets WHERE id = $1', [result.assetId])).rows[0];
            const output = await readFile(join(policy.storage.root, row.relative_path));
            assert.equal(hash(output), row.sha256); assert.equal(row.payload_checksum, hash(image)); hashes.push(row.sha256);
            const metadata = await sharp(output).metadata(); assert.equal(metadata.width, dimension); assert.equal(metadata.height, dimension);
          }
          assert.equal(new Set(hashes).size, 1);
          if (dimension === 8192) assert.equal(hashes[0], '6cd962b9433503f386017ab370eaf43b2524abc7cd1e6abf501b540d79630576');
          if (maximumBytes) assert.equal(hashes[0], '0201a304652d5c7a872673cecb170e186c87d763b39e8f8ddf3961a6ed77da1a');
          assert.equal(Number((await pool.query('SELECT count(*)::int AS count FROM artwork_assignments WHERE owner_id = ANY($1::uuid[])', [owners])).rows[0].count), jobs);
          assert.equal(retained[0], 0x5a); assert.equal(retained.at(-1), 0x5a);
          assert.equal(gate.getMemoryState().reservedBytes, 0); assert.deepEqual(gate.getState(), { active: 0, queued: 0, queuedBytes: 0 });
          return { dimension, callerBytes: retained.length, imageBytes: image.length, activeDatabaseStatements: database.activeStatements,
            sortWorkMemBytes: 8 * 1024 ** 2, sortedRowsPerStatement: 100_000, sortParallelWorkers: 0,
            images: results.length, assignments: jobs, outputSha256: hashes[0], peakChildren, ...provider.getState(),
            publicationReservedBytes, logicalBudgetBytes: gate.getMemoryState().budgetBytes, finalReservedBytes: 0 };
        });
      });
    }, async () => {
      release.resolve(); await Promise.allSettled(tasks);
      for (const child of children) { assert.equal(child.closed, true); assert.throws(() => process.kill(child.pid, 0), { code: 'ESRCH' }); }
    });
  });
}
