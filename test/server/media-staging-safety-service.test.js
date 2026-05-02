import assert from 'node:assert/strict';
import test from 'node:test';
import { createMediaStagingSafetyService } from '../../src/server/media/media-staging-safety-service.js';

test('media staging safety blocks archive payload files until guarded extraction exists', () => {
  const service = createMediaStagingSafetyService();

  const result = service.assessCandidateFile({
    candidateId: 'candidate-1',
    file: {
      extension: '.zip',
      filename: 'pack.zip',
      id: 'file-1',
    },
  });

  assert.equal(result.blockers.some((entry) => entry.code === 'archive_payload_unsupported'), true);
});

test('media staging safety blocks traversal segments in source filenames', () => {
  const service = createMediaStagingSafetyService();

  const result = service.assessCandidateFile({
    candidateId: 'candidate-1',
    file: {
      extension: '.flac',
      filename: '../outside.flac',
      id: 'file-1',
    },
  });

  assert.equal(result.blockers.some((entry) => entry.code === 'unsafe_source_filename_traversal'), true);
});

test('media staging safety resolves parser-safe source filename from nested provider path', () => {
  const service = createMediaStagingSafetyService();

  const result = service.assessCandidateFile({
    candidateId: 'candidate-1',
    file: {
      extension: '.flac',
      filename: 'folder/subfolder/01 Intro.flac',
      id: 'file-1',
    },
  });

  assert.deepEqual(result.blockers, []);
  assert.equal(result.sourceFilename, '01 Intro.flac');
});
