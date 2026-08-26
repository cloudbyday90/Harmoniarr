import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDownloaderMissingMusicHandoffPresentation } from '../../src/client/lib/downloader-missing-music-handoff-presentation.js';

test('Downloader Missing Music handoff presents the release and target user without exposing identifiers', () => {
  const presentation = buildDownloaderMissingMusicHandoffPresentation({
    decisionId: 'wanted-amber',
    release: { artistName: 'Autechre', title: 'Amber' },
    requestedFor: { id: 'must-not-be-used', username: 'Jamie' },
    wantedReleaseId: 'wanted-amber',
  });

  assert.equal(presentation.isReady, true);
  assert.equal(presentation.title, 'Downloads for Amber');
  assert.equal(presentation.copy, 'Showing live transfers for Amber by Autechre, requested for Jamie.');
  assert.equal(presentation.returnLabel, 'Return to Amber in Missing Music');
  assert.deepEqual(presentation.returnLocation, {
    name: 'missing-decision',
    params: { decisionId: 'wanted-amber' },
  });
  assert.doesNotMatch(JSON.stringify(presentation), /must-not-be-used/u);
});

test('Downloader Missing Music handoff remains inactive without server-issued identifiers', () => {
  const presentation = buildDownloaderMissingMusicHandoffPresentation({
    decisionId: 'wanted-amber',
    wantedReleaseId: '',
  });

  assert.equal(presentation.isReady, false);
  assert.equal(presentation.wantedReleaseId, '');
  assert.equal(presentation.returnLocation, null);
});
