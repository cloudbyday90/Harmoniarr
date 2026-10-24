/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { createApp } from '../../src/server/app.js';
import { createArtworkModule } from '../../src/server/artwork/artwork-module.js';
import { createArtworkFetchService } from '../../src/server/artwork/artwork-fetch-service.js';
import { createArtworkImageDownloadService } from '../../src/server/artwork/artwork-image-download-service.js';
import { createArtworkIngestionService, prepareArtworkAsset } from '../../src/server/artwork/artwork-ingestion-service.js';
import { createArtworkIngestionAdmission } from '../../src/server/artwork/artwork-ingestion-admission.js';
import { createArtworkWorkerService } from '../../src/server/artwork/artwork-worker-service.js';
import { getArtworkAssetBySha256 } from '../../src/server/artwork/artwork-repository.js';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';
import { measureDeploymentMemory } from './deployment-memory-observer.js';
import { withDeploymentDatabaseWork } from './deployment-memory-database.js';
import { withDeploymentImageProvider } from './deployment-memory-provider.js';
import { maximumByteArtworkPng } from './artwork-worker-inputs.js';
import { prepareDeploymentArtworkCase } from './deployment-artwork-corpus-case.js';
import { settleDeploymentArtwork } from './deployment-artwork-publication.js';

export async function runDeploymentMemoryWorkload({ pool, dimension, callerBytes, maximumBytes = false, artworkCaseId = null,
  withConcurrentWork = (_context, work) => work(), onArtworkSpawn = () => {}, onArtworkClose = () => {} }) {
  if ([withConcurrentWork, onArtworkSpawn, onArtworkClose].some(callback => typeof callback !== 'function')) throw new TypeError('Invalid concurrent qualification owner');
  if (artworkCaseId != null && maximumBytes) throw new TypeError('Use one owned artwork input mode');
  const artworkCase = artworkCaseId == null ? null : await prepareDeploymentArtworkCase(artworkCaseId);
  const image = artworkCase?.image ?? (maximumBytes ? (await maximumByteArtworkPng(100 * 1024 ** 2)).input
    : await sharp({ create: { width: dimension, height: dimension, channels: 3, background: 'red' } }).jpeg().toBuffer());
  const jobs = maximumBytes ? 1 : 2;
  return withDeploymentImageProvider(image, async provider => {
    const gate = createArtworkIngestionAdmission(); const children = []; const tasks = [];
    let activeChildren = 0; let peakChildren = 0; let downloads = 0; let heldPublication = false;
    const published = Promise.withResolvers(); const release = Promise.withResolvers(); const downloaded = Promise.withResolvers();
    const worker = createArtworkWorkerService({ spawnFn: (...args) => {
      const child = spawn(...args); const record = { pid: child.pid, closed: false, code: null, signal: null }; children.push(record);
      let outputBytes = 0; child.stdout.on('data', chunk => { outputBytes += chunk.length; });
      activeChildren++; peakChildren = Math.max(peakChildren, activeChildren);
      child.once('spawn', onArtworkSpawn);
      child.once('close', (code, signal) => {
        Object.assign(record, { closed: true, code, signal }); activeChildren--;
        try { onArtworkClose({ code, signal, outputBytes }); } catch { /* optional qualification diagnostic */ }
      }); return child;
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
        getArtworkAssetBySha256Fn: async sha256 => {
          assert.ok(!artworkCase?.spec.refuse, 'Refused artwork cannot reach publication lookup');
          const existing = await getArtworkAssetBySha256(sha256);
          if (!heldPublication) { heldPublication = true; published.resolve(); await release.promise; }
          return existing;
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
        return withDeploymentDatabaseWork(pool, database => withConcurrentWork({ application, pool }, async () => {
          await checkpoint('admitted');
          const owners = Array.from({ length: jobs }, () => randomUUID());
          for (const ownerId of owners) tasks.push(application.artworkModule.artworkFetchService.resolveArtwork({
            ownerId, ownerType: 'musicbrainz_artist', artworkRole: 'artist_thumbnail',
          }));
          const publication = await settleDeploymentArtwork({ pool, image, artworkCase, dimension, maximumBytes, owners, tasks,
            published, downloaded, release, gate, children, getPolicy: () => policy, getDownloads: () => downloads, checkpoint });
          assert.equal(retained[0], 0x5a); assert.equal(retained.at(-1), 0x5a);
          assert.equal(gate.getMemoryState().reservedBytes, 0); assert.deepEqual(gate.getState(), { active: 0, queued: 0, queuedBytes: 0 });
          return { dimension: artworkCase?.spec.width ?? dimension, callerBytes: retained.length, imageBytes: image.length, activeDatabaseStatements: database.activeStatements,
            sortWorkMemBytes: 8 * 1024 ** 2, sortedRowsPerStatement: 100_000, sortParallelWorkers: 0,
            ...publication, peakChildren, ...provider.getState(), logicalBudgetBytes: gate.getMemoryState().budgetBytes, finalReservedBytes: 0 };
        }));
      });
    }, async () => {
      release.resolve(); await Promise.allSettled(tasks);
      for (const child of children) { assert.equal(child.closed, true); assert.throws(() => process.kill(child.pid, 0), { code: 'ESRCH' }); }
    });
  }, { contentType: artworkCase?.contentType });
}
