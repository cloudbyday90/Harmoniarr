/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createApp } from '../../src/server/app.js';
import { createImportCandidateModule } from '../../src/server/import-candidates/import-candidate-module.js';
import { createIntegrationAppRuntime } from './app-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from './runtime-config.js';
import { bootstrapAdminSession } from './auth-helpers.js';
import { createLibraryAddFixtureUser, seedOwnedLibraryAddFixture } from './library-add-media-fixtures.js';

/** SQL/HTTP qualification injects the gate; packaged verifiers own actual audio measurement. */
export function createPreflightReviewFixture() {
  let module; let libraryModule;
  const controls = { code: 'safe_auto_spectral_transcoded', beforeGateReturns: null, eligible: false };
  async function createRuntime({ clientDistDir = null } = {}) {
    return createIntegrationAppRuntime({ config: resolveIntegrationTestRuntimeConfig(), createAppFn: options => { const application = createApp({ ...options,
      ...(clientDistDir ? { clientDistDir } : {}),
      createImportCandidateModule: dependencies => {
        module = createImportCandidateModule({ ...dependencies,
          getMediaToolingStatus: async () => ({ status: 'healthy' }),
          importCandidateApplyPreviewService: { previewImportCandidateApply: async () => ({ summary: { status: 'ready' },
            counts: { readyCount: 1 }, files: [{ status: { code: 'ready' } }] }) },
          importCandidateSafeAutoAddQualityGateService: { evaluateSafeAutoAddQuality: async () => {
            await controls.beforeGateReturns?.();
            return { eligible: controls.eligible, blockers: controls.eligible ? [] : [{ code: controls.code,
              filename: '/private/provider/file.flac', message: 'private raw tool output' }] };
          } },
        });
        return module;
      },
    }); libraryModule = application.libraryModule; return application; } });
  }
  async function setup({ client, getPoolFn, workspaceDir }, { shared = false } = {}) {
    controls.code = 'safe_auto_spectral_transcoded'; controls.beforeGateReturns = null; controls.eligible = false;
    const admin = (await bootstrapAdminSession(client)).payload.user;
    const pool = getPoolFn();
    const owner = await createLibraryAddFixtureUser(client, pool, 'quality-review-owner', { minimumQuality: 'lossless', preferredFormat: 'flac' });
    const fixture = await seedOwnedLibraryAddFixture({ pool, owner, workspaceDir, audio: false, extension: 'flac',
      profileCode: 'lossless_archive', minimumBitrateKbps: null });
    await mkdir(dirname(fixture.sourcePath), { recursive: true }); await writeFile(fixture.sourcePath, 'task-owned retained download');
    let sibling;
    if (shared) {
      sibling = await createLibraryAddFixtureUser(client, pool, 'quality-review-sibling', { minimumQuality: 'lossless', preferredFormat: 'flac' });
      const wanted = (await pool.query(`INSERT INTO library_wanted_releases (app_user_id,metadata_artist_id,metadata_release_group_id,
        metadata_release_id,wanted_status,expected_track_count,matched_track_count,missing_track_count)
        SELECT $2,metadata_artist_id,metadata_release_group_id,metadata_release_id,'missing',1,0,1 FROM library_wanted_releases WHERE id=$1 RETURNING id`,
      [fixture.wantedId, sibling.id])).rows[0];
      await pool.query('INSERT INTO library_discovery_request_wanted_release_links (discovery_request_id,wanted_release_id) VALUES ($1,$2)', [fixture.discoveryId, wanted.id]);
      await pool.query(`UPDATE import_candidates SET normalized_payload=jsonb_set(normalized_payload,'{musicQueue,wantedReleaseIds}',$2::jsonb) WHERE id=$1`,
        [fixture.candidateId, JSON.stringify([fixture.wantedId, wanted.id])]);
      sibling = { ...sibling, wantedId: wanted.id };
    }
    const start = () => module.importCandidateAutoApplyRunService.startSafeApplyRunAfterDownloadCompleted({ importCandidateId: fixture.candidateId });
    return { ...fixture, pool, owner, admin, sibling, start, module, libraryModule };
  }
  return { controls, createRuntime, setup };
}
