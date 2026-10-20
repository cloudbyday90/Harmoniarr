/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { writeFile } from 'node:fs/promises';
import { createApp } from '../../src/server/app.js';
import { createImportCandidateModule } from '../../src/server/import-candidates/import-candidate-module.js';
import { createLibraryModule } from '../../src/server/library/library-module.js';
import { createMissingMusicModule } from '../../src/server/missing-music/missing-music-module.js';
import { createMediaInspectionService } from '../../src/server/media/media-inspection-service.js';
import { createSlskdTransferSnapshotService } from '../../src/server/slskd/slskd-transfer-snapshot-service.js';
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { bootstrapAdminSession } from '../../testing/integration/auth-helpers.js';
import { createLibraryAddMediaScenario } from '../../testing/integration/library-add-media-scenario.js';
import { startCanonicalNativeAudio } from '../../testing/integration/native-audio-commands.js';
import { qualifyNativeAudioCommandRefusals } from '../../testing/integration/native-audio-command-refusals.js';
import { runCanonicalNativeAudioExecution } from '../../testing/integration/native-audio-execution.js';
import { seedNativeAudioCandidates } from '../../testing/integration/native-audio-candidates.js';
import { qualifyNativeAudioPublication } from '../../testing/integration/native-audio-publication.js';
import { createNativeAudioBridge } from '../../testing/slskd/native-audio-bridge.js';
import { requireNativeSlskdImages, withNativeSlskdProvider } from '../../testing/slskd/native-provider-runtime.js';
import { fingerprintPostgresCohortSource } from '../../testing/integration/postgres-cohort-policy.js';

test('canonical selected-match commands retain durable ownership through native audio transfer and valid/corrupt import', { timeout: 300_000 }, async t => {
  const source = await fingerprintPostgresCohortSource(); const images = requireNativeSlskdImages();
  let module; let bridge; let library;
  const commandRecordings = [];
  const awaitQueuedActivity = async () => { assert.ok(commandRecordings.length); assert.deepEqual(await commandRecordings.shift(), { recorded: true }); };
  const media = createLibraryAddMediaScenario({ mode: 'owned-api', mediaImage: images.applicationImage });
  assert.equal(await media.mediaFixture.verifyTooling({ signal: t.signal }), null);
  const config = resolveIntegrationTestRuntimeConfig();
  const runtime = await createIntegrationAppRuntime({ config, createAppFn: options => createApp({ ...options,
    createMissingMusicModule: dependencies => createMissingMusicModule({ ...dependencies, recordActivityEventFn: event => {
      const recording = dependencies.recordActivityEventFn(event);
      if (event.eventType === 'music_queue_download_queued') commandRecordings.push(recording);
      return recording;
    } }),
    createLibraryModule: dependencies => { library = createLibraryModule(dependencies); return library; },
    createImportCandidateModule: dependencies => {
      const mediaInspectionService = createMediaInspectionService({ getMediaToolingStatus: media.mediaFixture.getTooling,
        mediaCommandService: { runCommand: ({ binary, args }) => media.mediaFixture.mediaCommand(binary, args) } });
      const remote = name => (...args) => { assert.ok(bridge); return bridge.service[name](...args); };
      module = createImportCandidateModule({ ...dependencies, getMediaToolingStatus: media.mediaFixture.getTooling, mediaInspectionService,
        slskdTransferSnapshotService: createSlskdTransferSnapshotService({ getDownloads: remote('getDownloads'), getBoundDownloads: remote('getBoundDownloads') }),
        slskdService: { ...dependencies.slskdService, prepareDownloadDispatch: remote('prepareDownloadDispatch'),
          getDownloadBatchEvidence: remote('getDownloadBatchEvidence'), getBoundDownloads: remote('getBoundDownloads'), getDownloads: remote('getDownloads') } });
      return module;
    },
  }) });
  let result;
  try {
    await media.runScenario(runtime, async ({ client, baseUrl, getPoolFn, workspaceDir }) => {
      await bootstrapAdminSession(client);
      const { fixtures } = await seedNativeAudioCandidates({ client, getPoolFn, workspaceDir });
      const commandRefusals = await qualifyNativeAudioCommandRefusals({ client, baseUrl, pool: getPoolFn(), fixtures });
      result = await withNativeSlskdProvider({ ...images, signal: t.signal, mode: 'audio', expectedVersion: '0.26.1.0', runScenario: async native => {
        bridge = createNativeAudioBridge(native);
        const commands = [];
        for (const fixture of fixtures) {
          const command = await startCanonicalNativeAudio({ client, pool: getPoolFn(), fixture, awaitQueuedActivity });
          fixture.operationRunId = command.operationRunId;
          commands.push(command);
          await runCanonicalNativeAudioExecution({ client, pool: getPoolFn(), module, fixture });
        }
        await bridge.call('published');
        const details = [];
        for (const fixture of fixtures) details.push(await module.importCandidateExecutionSummaryService.buildImportCandidateExecutionRunDetail({ runId: fixture.operationRunId }));
        const transport = await bridge.exportCompleted(fixtures[0].paths.downloads);
        const publications = [];
        for (const [index, fixture] of fixtures.entries()) publications.push(await qualifyNativeAudioPublication({ module, library, pool: getPoolFn(), fixture, detail: details[index] }));
        return { complete: true, commandRefusals, commands, transport, publications };
      } });
    }, { scenarioName: 'native_audio_import' });
  } finally { await runtime.cleanup(); }
  assert.deepEqual(await fingerprintPostgresCohortSource(), source);
  assert.equal(result.cleanupVerified, true); assert.equal(result.fixture.fileConnections, 2);
  assert.equal(result.fixture.sentFiles.length, 2); assert.equal(result.fixture.refused, 0);
  assert.equal(commandRecordings.length, 0);
  if (process.env.HARMONIARR_NATIVE_SLSKD_EVIDENCE_PATH) {
    await writeFile(process.env.HARMONIARR_NATIVE_SLSKD_EVIDENCE_PATH, JSON.stringify({ source, ...result }, null, 2), { flag: 'wx' });
  }
});
