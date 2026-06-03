import assert from 'node:assert/strict';
import test from 'node:test';
import {
  selectBrowsedCandidate,
  shouldBrowseCandidate,
} from '../../src/server/library/candidate-browse-planning.js';

function buildCandidate({ username = 'user', folderPath = 'Artist\\Album', files = [] } = {}) {
  return {
    username,
    folderPath,
    fileCount: files.length,
    files,
  };
}

function audioFile(filename, { isLocked = false, extension = 'flac' } = {}) {
  return { filename, extension, isLocked };
}

test('shouldBrowseCandidate browses when the folder name matches the album title', () => {
  const candidate = buildCandidate({
    folderPath: 'Boards of Canada\\Music Has the Right to Children',
    files: [audioFile('01 Wildlife Analysis.flac')],
  });

  const decision = shouldBrowseCandidate({
    candidate,
    albumTitle: 'Music Has the Right to Children',
    expectedTrackCount: 10,
  });

  assert.deepEqual(decision, { browse: true, reason: 'folder_name_match' });
});

test('shouldBrowseCandidate skips when search response already has the full tracklist', () => {
  const files = Array.from({ length: 10 }, (_, index) => audioFile(`${index + 1} Track.flac`));
  const candidate = buildCandidate({ folderPath: 'random', files });

  const decision = shouldBrowseCandidate({
    candidate,
    albumTitle: 'Unrelated Title',
    expectedTrackCount: 10,
  });

  assert.deepEqual(decision, { browse: false, reason: 'already_complete' });
});

test('shouldBrowseCandidate ignores locked files when counting completeness', () => {
  const files = [
    audioFile('01.flac', { isLocked: true }),
    audioFile('02.flac', { isLocked: true }),
    audioFile('03.flac'),
  ];
  const candidate = buildCandidate({ folderPath: 'Some Album', files });

  const decision = shouldBrowseCandidate({
    candidate,
    albumTitle: 'Some Album',
    expectedTrackCount: 3,
  });

  // Only one unlocked audio file, folder matches -> browse.
  assert.equal(decision.browse, true);
  assert.equal(decision.reason, 'folder_name_match');
});

test('shouldBrowseCandidate browses trusted uploaders even without folder match', () => {
  const candidate = buildCandidate({
    username: 'trusted-user',
    folderPath: 'xyz123',
    files: [audioFile('a.flac')],
  });

  const decision = shouldBrowseCandidate({
    candidate,
    albumTitle: 'Completely Different',
    expectedTrackCount: 12,
    trustedUsernames: new Set(['trusted-user']),
  });

  assert.deepEqual(decision, { browse: true, reason: 'trusted_uploader' });
});

test('shouldBrowseCandidate browses promising partial coverage', () => {
  const files = Array.from({ length: 6 }, (_, index) => audioFile(`${index + 1}.flac`));
  const candidate = buildCandidate({ folderPath: 'unrelated-hash', files });

  const decision = shouldBrowseCandidate({
    candidate,
    albumTitle: 'No Match Here',
    expectedTrackCount: 12,
  });

  assert.deepEqual(decision, { browse: true, reason: 'partial_coverage' });
});

test('shouldBrowseCandidate declines implausible candidates', () => {
  const candidate = buildCandidate({ folderPath: 'aa11bb22', files: [audioFile('1.flac')] });

  const decision = shouldBrowseCandidate({
    candidate,
    albumTitle: 'A Totally Different Album',
    expectedTrackCount: 12,
  });

  assert.deepEqual(decision, { browse: false, reason: 'not_plausible' });
});

test('shouldBrowseCandidate handles hostile path-traversal folder names safely', () => {
  const candidate = buildCandidate({
    folderPath: '..\\..\\..\\etc\\Music Has the Right to Children',
    files: [audioFile('1.flac')],
  });

  const decision = shouldBrowseCandidate({
    candidate,
    albumTitle: 'Music Has the Right to Children',
    expectedTrackCount: 10,
  });

  // Basename is used (last segment), traversal segments are ignored.
  assert.equal(decision.browse, true);
  assert.equal(decision.reason, 'folder_name_match');
});

test('shouldBrowseCandidate returns no_candidate for invalid input', () => {
  assert.deepEqual(shouldBrowseCandidate({ candidate: null }), { browse: false, reason: 'no_candidate' });
  assert.deepEqual(shouldBrowseCandidate({}), { browse: false, reason: 'no_candidate' });
});

test('selectBrowsedCandidate keeps the browsed candidate only when it reveals more files', () => {
  const original = { fileCount: 3 };
  const richer = { fileCount: 10 };
  const poorer = { fileCount: 2 };

  assert.deepEqual(selectBrowsedCandidate({ original, browsed: richer }), {
    candidate: richer,
    usedBrowse: true,
  });
  assert.deepEqual(selectBrowsedCandidate({ original, browsed: poorer }), {
    candidate: original,
    usedBrowse: false,
  });
  assert.deepEqual(selectBrowsedCandidate({ original, browsed: { fileCount: 3 } }), {
    candidate: original,
    usedBrowse: false,
  });
  assert.deepEqual(selectBrowsedCandidate({ original, browsed: null }), {
    candidate: original,
    usedBrowse: false,
  });
});
