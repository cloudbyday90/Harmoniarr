/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMissingMusicLibraryAddRecoveryPresentation, buildMissingMusicLibraryAddRecheckFeedback } from '../../src/client/lib/missing-music-library-add-recheck-presentation.js';
import { buildMissingMusicDecisionDetailPresentation } from '../../src/client/lib/missing-music-decision-detail-presentation.js';

function detail(reasonCode = 'source_path_unavailable', permissions = {}) {
  return { decision: { decisionId: 'wanted-amber', requestedFor: { username: 'Jamie', accountStatus: 'active' }, status: { nextAction: 'recheck_library_add' } },
    libraryAddRecovery: { reasonCode, queued: false, runId: null }, permissions: { canRecheckLibraryAdd: true, canRepairFolders: true, ...permissions } };
}

test('folder recovery uses the same decision in the bounded Settings return without a recipient or candidate input', () => {
  const presentation = buildMissingMusicLibraryAddRecoveryPresentation(detail());
  assert.equal(presentation.canRecheck, true);
  assert.deepEqual(presentation.repairFoldersLocation, { name: 'settings-media-storage', query: { returnTo: 'missing_music_decision', returnReleaseId: 'wanted-amber' } });
  assert.match(presentation.actionExplanation, /same completed download for Jamie/u);
  assert.equal(buildMissingMusicDecisionDetailPresentation(detail()).nextStep, 'Check the files again');
});

test('interrupted audio verification offers only the permitted recheck and never invents a Settings tool repair', () => {
  const presentation = buildMissingMusicLibraryAddRecoveryPresentation(detail('audio_check_failed'));
  assert.equal(presentation.canRecheck, true);
  assert.equal(presentation.repairFoldersLocation, null);
  assert.match(presentation.explanation, /repair the media tools/u);
});

test('unsafe categories, missing permission, disabled history, and already queued work cannot expose another recheck', () => {
  for (const code of ['library_collision', 'lossy_audio', 'suspicious_lossless', 'unsafe_add_plan', 'add_failed', 'media_verification', 'unknown', null]) {
    const input = detail(code);
    const presentation = buildMissingMusicLibraryAddRecoveryPresentation(input);
    assert.equal(presentation.canRecheck, false);
    assert.equal(presentation.showPanel, false);
    assert.equal(presentation.repairFoldersLocation, null);
    assert.equal(buildMissingMusicDecisionDetailPresentation(input).nextStep, 'Check the current release status.');
  }
  for (const permissions of [{ canRecheckLibraryAdd: false, canRepairFolders: false }, { canRecheckLibraryAdd: 'true', canRepairFolders: 'true' }, { isReadOnly: true }]) {
    const presentation = buildMissingMusicLibraryAddRecoveryPresentation(detail('source_path_unavailable', permissions));
    assert.equal(presentation.canRecheck, false);
    assert.equal(presentation.repairFoldersLocation, null);
  }
  const disabled = detail();
  disabled.decision.requestedFor.accountStatus = 'disabled';
  assert.equal(buildMissingMusicLibraryAddRecoveryPresentation(disabled).canRecheck, false);
  const queued = detail();
  queued.libraryAddRecovery.queued = true;
  assert.equal(buildMissingMusicLibraryAddRecoveryPresentation(queued).canRecheck, false);
  assert.equal(buildMissingMusicLibraryAddRecoveryPresentation(queued).repairFoldersLocation, null);
});

test('malformed return IDs and raw repair details cannot become navigation or visible diagnostic text', () => {
  const input = detail();
  input.decision.decisionId = '../../outside';
  input.libraryAddRecovery.path = '/private/music';
  input.libraryAddRecovery.message = 'Private ffprobe output';
  const presentation = buildMissingMusicLibraryAddRecoveryPresentation(input);
  assert.equal(presentation.repairFoldersLocation, null);
  assert.doesNotMatch(JSON.stringify(presentation), /Private|private|ffprobe|outside/u);
});

test('six bounded outcomes distinguish accepted work, existing work, and no-write review or deferral', () => {
  const messages = new Set();
  for (const [outcome, tone] of [['queued', 'success'], ['already_queued', 'info'], ['deferred', 'warning'], ['prerequisite_not_ready', 'warning'], ['still_needs_review', 'warning'], ['not_available', 'warning']]) {
    const feedback = buildMissingMusicLibraryAddRecheckFeedback({ outcome, path: '/private/music', message: 'Private provider output', runId: 'internal-run' });
    assert.equal(feedback.tone, tone);
    assert.doesNotMatch(JSON.stringify(feedback), /Private|private|internal-run/u);
    messages.add(feedback.message);
  }
  assert.equal(messages.size, 6);
  assert.match(buildMissingMusicLibraryAddRecheckFeedback({ outcome: 'queued' }).message, /only if the plan remains safe/u);
  assert.match(buildMissingMusicLibraryAddRecheckFeedback({ outcome: 'already_queued' }).message, /No additional work was started/u);
  assert.match(buildMissingMusicLibraryAddRecheckFeedback({ outcome: 'deferred' }).message, /left unchanged/u);
  assert.equal(buildMissingMusicLibraryAddRecheckFeedback({ outcome: 'constructor' }).tone, 'info');
});
