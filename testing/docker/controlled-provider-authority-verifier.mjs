/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { executeControlledApply } from './controlled-provider-worker-driver.mjs';

/** Fresh, application-derived recipients lose authority after real download/queue acceptance. */
export async function verifyControlledProviderAuthority({ pool, fixture, authorityFixtures, libraryModule,
  importCandidateModule, executeDownloadAndReconcile, getProviderEvidence, listLibraryFiles }) {
  const outcomes = [];
  const snapshot = async () => Promise.all((await listLibraryFiles()).map(async path => ({ path,
    sha256: createHash('sha256').update(await readFile(path)).digest('hex') })));
  for (const change of ['missing_owner', 'disabled_owner', 'monitoring_revoked']) {
    const owner = await authorityFixtures.createSingleDiscovery({ ...fixture, id: `${fixture.id}-${randomUUID()}` });
    const dispatch = await libraryModule.libraryDiscoveryDispatchService.dispatchReadyDiscoveryRequests();
    assert.equal(dispatch.candidateCount, 1, `${change}: current authority must permit ingestion`);
    const search = dispatch.dispatchedSearches[0];
    assert.equal(search.metadataReleaseId, owner.metadataReleaseId, `${change}: dispatch must use this case's derived authority`);
    const reconciliation = await executeDownloadAndReconcile({ importCandidateModule, runId: search.autoDownloadStart.runId });
    const runId = reconciliation.autoApplyRuns[0]?.runId;
    assert.ok(runId, `${change}: current authority must permit guarded queue acceptance`);
    const candidateId = search.autoSelection.selectedCandidateId;
    if (change === 'missing_owner') await pool.query('DELETE FROM library_wanted_releases WHERE id=$1', [owner.wantedReleaseId]);
    if (change === 'disabled_owner') await pool.query('UPDATE app_users SET is_disabled=TRUE WHERE id=$1', [owner.appUserId]);
    if (change === 'monitoring_revoked') {
      await pool.query('UPDATE operator_artist_monitoring SET is_monitored=FALSE WHERE app_user_id=$1 AND metadata_artist_id=$2',
        [owner.appUserId, owner.metadataArtistId]);
      await libraryModule.libraryWantedReleaseService.reconcileWantedReleases();
      await libraryModule.libraryDiscoveryRequestService.reconcileDiscoveryRequests();
      assert.equal((await pool.query('SELECT id FROM library_wanted_releases WHERE id=$1', [owner.wantedReleaseId])).rowCount, 0);
    }
    const before = await getProviderEvidence(fixture.id);
    const filesBefore = await snapshot();
    const run = await executeControlledApply(importCandidateModule, runId);
    assert.equal(run.appliedCount, 0, `${change}: revoked authority must refuse the actual worker write`);
    assert.notEqual((await importCandidateModule.importCandidateService.getImportCandidate({ importCandidateId: candidateId })).status, 'applied');
    assert.deepEqual(await snapshot(), filesBefore, `${change}: library file names and bytes must remain unchanged`);
    const after = await getProviderEvidence(fixture.id);
    assert.equal(after.transferCount, before.transferCount, `${change}: no further transfer may be issued`);
    outcomes.push({ change, admittedBeforeChange: true, appliedCount: run.appliedCount,
      providerTransferDelta: after.transferCount - before.transferCount, libraryFilesUnchanged: true });
  }
  return outcomes;
}
