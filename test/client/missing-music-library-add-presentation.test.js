import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMissingMusicLibraryAddFeedback, buildMissingMusicLibraryAddPresentation } from '../../src/client/lib/missing-music-library-add-presentation.js';
import { buildMissingMusicDecisionDetailPresentation } from '../../src/client/lib/missing-music-decision-detail-presentation.js';

function detail(permissions = {}) {
  return { decision: { decisionId: 'wanted-amber', release: { title: 'Amber', artistName: 'Autechre' },
    requestedFor: { username: 'Jamie', accountStatus: 'active' }, status: { code: 'ready_to_add', nextAction: 'add_to_library' } },
  permissions, sourcePath: '/private/download', candidateId: 'private-candidate' };
}

test('prepared add uses strict public permission and scoped confirmation without private plan facts', () => {
  const eligible = detail({ canAddToLibrary: true });
  const presentation = buildMissingMusicLibraryAddPresentation(eligible);
  assert.equal(presentation.canAdd, true);
  assert.match(presentation.confirmation, /Amber by Autechre, requested for Jamie/u);
  assert.match(presentation.safetyExplanation, /before moving files/u);
  assert.doesNotMatch(JSON.stringify(presentation), /private\/download|private-candidate/u);
  assert.equal(buildMissingMusicDecisionDetailPresentation(eligible).nextStep, 'Add to library');
  for (const permissions of [{}, { canAddToLibrary: 'true' }, { canAddToLibrary: false }, { canAddToLibrary: true, isReadOnly: true }]) {
    assert.equal(buildMissingMusicLibraryAddPresentation(detail(permissions)).canAdd, false);
  }
  eligible.decision.requestedFor.accountStatus = 'disabled';
  assert.equal(buildMissingMusicLibraryAddPresentation(eligible).canAdd, false);
  assert.equal(buildMissingMusicDecisionDetailPresentation(detail()).nextStep, 'Check the current release status.');
});

test('prepared add reports all five bounded outcomes without claiming completed files or safe deferred work', () => {
  const outcomes = ['queued', 'already_queued', 'still_needs_review', 'not_available', 'deferred'];
  const feedback = outcomes.map((outcome) => buildMissingMusicLibraryAddFeedback({ outcome, message: '/private/download' }));
  assert.equal(new Set(feedback.map(({ message }) => message)).size, 5);
  assert.deepEqual(feedback.map(({ tone }) => tone), ['success', 'info', 'warning', 'warning', 'warning']);
  assert.match(feedback[0].message, /before any files move/u);
  assert.match(feedback[1].message, /No additional work/u);
  assert.match(feedback[4].message, /left unchanged/u);
  assert.doesNotMatch(feedback[4].message, /safe to add/u);
  assert.doesNotMatch(JSON.stringify(feedback), /private\/download|Added to library/u);
  assert.equal(buildMissingMusicLibraryAddFeedback({ outcome: 'unknown', message: 'Private' }).tone, 'info');
});
