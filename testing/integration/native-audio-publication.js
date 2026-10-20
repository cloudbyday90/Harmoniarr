/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { runLibraryAddFixtureWorker, libraryAddRuntimePath } from './library-add-media-fixtures.js';
import { nativeAudioDigest } from '../slskd/native-audio-data.js';
import { qualifyNativeAudioCatalogue } from './native-audio-catalogue.js';

export async function qualifyNativeAudioPublication({ module, library, pool, fixture, detail }) {
  assert.equal(detail.run.items.length, 1);
  assert.equal(detail.run.items[0].liveTransferSummary?.status, 'completed', JSON.stringify(detail));
  assert.equal(detail.run.items[0].planningSnapshot.execution.handoff.state, 'confirmed');
  const reconciliation = await module.importCandidateExecutionReconciliationService.reconcileImportCandidateExecutionSummary({ executionSummary: { currentRun: detail.run } });
  const preview = await module.importCandidateApplyPreviewService.previewImportCandidateApply({ importCandidateId: fixture.candidateId });
  if (fixture.file.kind === 'valid') {
    assert.equal(preview.files[0].inspection.metadata.primaryAudioCodec, 'pcm_s16le');
    assert.equal(preview.files[0].inspection.metadata.sampleRate, 44100);
    assert.equal(preview.files[0].inspection.metadata.bitDepth, 16);
    assert.equal(preview.files[0].inspection.metadata.channelCount, 2);
    assert.equal(reconciliation.summary.autoApplyStarted, 1, JSON.stringify(reconciliation));
    const result = await runLibraryAddFixtureWorker({ pool, module, runId: reconciliation.autoApplyRuns[0].runId });
    assert.equal(result.appliedCount, 1, JSON.stringify(result));
    const bytes = await readFile(preview.files[0].libraryTarget.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), nativeAudioDigest(fixture.file));
    await assert.rejects(stat(fixture.sourcePath), { code: 'ENOENT' });
    const audits = (await pool.query("SELECT actor_type,actor_user_id FROM audit_events WHERE event_type='import_candidate_apply_started' AND entity_id=$1", [reconciliation.autoApplyRuns[0].runId])).rows;
    assert.equal(audits.length, 1); assert.equal(audits[0].actor_type, 'system'); assert.equal(audits[0].actor_user_id, null);
    const catalogue = await qualifyNativeAudioCatalogue({ pool, library, canonicalPath: preview.files[0].libraryTarget.path, size: fixture.file.size });
    return { kind: 'valid', transportCompleted: true, codec: 'pcm_s16le', applied: true, canonicalSha256: nativeAudioDigest(fixture.file), systemAudit: true, catalogue };
  }
  assert.equal(reconciliation.summary.autoApplyStarted, 0, JSON.stringify(reconciliation));
  assert.equal(preview.files[0].inspection.metadata, null);
  assert.ok(preview.files[0].inspection.warnings.some(row => row.code === 'media_inspection_probe_failed'));
  const rows = (await pool.query('SELECT count(*)::int count FROM import_operations WHERE import_candidate_id=$1', [fixture.candidateId])).rows[0];
  assert.equal(rows.count, 0); assert.equal((await stat(fixture.sourcePath)).size, fixture.file.size);
  await assert.rejects(stat(preview.files[0].libraryTarget.path), { code: 'ENOENT' });
  const catalogued = (await pool.query('SELECT canonical_path FROM library_files')).rows;
  assert.equal(catalogued.length, 1, 'Only the valid control may be catalogued');
  assert.equal(catalogued.some(row => libraryAddRuntimePath(row.canonical_path).includes('/users/native-audio-corrupt/')), false);
  return { kind: 'corrupt', transportCompleted: true, applied: false, inspectionCode: 'media_inspection_probe_failed', sourceRetained: true, canonicalFileAbsent: true, catalogueAbsent: true };
}
