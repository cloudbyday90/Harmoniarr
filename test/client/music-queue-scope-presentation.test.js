import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMusicQueueScopePresentation,
  getMusicQueueReleaseScope,
  isMusicQueueReleaseInScope,
  MUSIC_QUEUE_DEFAULT_SCOPE,
} from '../../src/client/lib/music-queue-scope-presentation.js';

function release(statusCode) {
  return { statusCode };
}

test('getMusicQueueReleaseScope maps each operator state to one decision-first scope', () => {
  for (const statusCode of [
    'failed',
    'needs_help_adding',
    'needs_setup',
    'no_matches_left',
    'pick_match',
    'quality_choice_needed',
  ]) {
    assert.equal(getMusicQueueReleaseScope(release(statusCode)), 'actions');
  }

  for (const statusCode of [
    'adding_to_library',
    'checking_matches',
    'downloading',
    'ready_to_add',
    'searching',
    'trying_next_match',
  ]) {
    assert.equal(getMusicQueueReleaseScope(release(statusCode)), 'in-progress');
  }

  assert.equal(getMusicQueueReleaseScope(release('queued_for_search')), 'scheduled');
  assert.equal(getMusicQueueReleaseScope(release('retrying_search')), 'scheduled');
  assert.equal(getMusicQueueReleaseScope(release('in_library')), 'all');
});

test('scope membership never hides a release from All releases', () => {
  const stableRelease = release('in_library');

  assert.equal(isMusicQueueReleaseInScope(stableRelease, 'actions'), false);
  assert.equal(isMusicQueueReleaseInScope(stableRelease, 'in-progress'), false);
  assert.equal(isMusicQueueReleaseInScope(stableRelease, 'scheduled'), false);
  assert.equal(isMusicQueueReleaseInScope(stableRelease, 'all'), true);
});

test('Actions scope gives the operator an explicit status and automatic-work context', () => {
  const releases = [
    release('quality_choice_needed'),
    release('downloading'),
    release('queued_for_search'),
  ];

  assert.equal(MUSIC_QUEUE_DEFAULT_SCOPE, 'actions');
  assert.deepEqual(buildMusicQueueScopePresentation(releases), {
    count: 1,
    detail: 'Harmoniarr is working automatically on 1 release.',
    emptyMessage: 'No release actions are available right now.',
    heading: 'Actions',
    status: '1 release has an action available',
  });
});
