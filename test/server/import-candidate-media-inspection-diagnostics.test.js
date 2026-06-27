import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMediaInspectionDiagnostics,
  MAX_MEDIA_INSPECTION_DIAGNOSTICS,
  normalizeMediaInspectionDiagnostics,
} from '../../src/server/import-candidates/import-candidate-media-inspection-diagnostics.js';

test('buildMediaInspectionDiagnostics records bounded per-file warning context', () => {
  const diagnostics = buildMediaInspectionDiagnostics({
    applyPreview: {
      inspectionWarnings: [{
        code: 'media_inspection_probe_failed',
        fileId: 'file-1',
        filename: 'alpha.flac',
        message: 'Probe failed',
        rawProbeOutput: 'not persisted',
      }, {
        code: 'media_inspection_no_audio_stream',
        fileId: 'file-2',
        filename: 'beta.flac',
        message: 'No audio stream was detected.',
      }],
    },
    candidate: {
      folderPath: '/private/staging/Boards of Canada/Geogaddi',
      id: 'candidate-1',
      username: 'remote-peer',
    },
  });

  assert.deepEqual(diagnostics, [{
    candidateId: 'candidate-1',
    code: 'media_inspection_probe_failed',
    fileId: 'file-1',
    filename: 'alpha.flac',
    folderPath: '/private/staging/Boards of Canada/Geogaddi',
    message: 'Probe failed',
    username: 'remote-peer',
  }, {
    candidateId: 'candidate-1',
    code: 'media_inspection_no_audio_stream',
    fileId: 'file-2',
    filename: 'beta.flac',
    folderPath: '/private/staging/Boards of Canada/Geogaddi',
    message: 'No audio stream was detected.',
    username: 'remote-peer',
  }]);
});

test('buildMediaInspectionDiagnostics falls back to file inspection warnings and caps payload size', () => {
  const files = Array.from({ length: MAX_MEDIA_INSPECTION_DIAGNOSTICS + 5 }, (_, index) => ({
    fileId: `file-${index + 1}`,
    filename: `track-${index + 1}.flac`,
    inspection: {
      warnings: [{
        code: 'media_inspection_probe_failed',
        message: `Probe failed ${index + 1}`,
      }],
    },
  }));

  const diagnostics = buildMediaInspectionDiagnostics({
    applyPreview: { files },
    candidate: {
      id: 'candidate-1',
      username: 'remote-peer',
    },
  });

  assert.equal(diagnostics.length, MAX_MEDIA_INSPECTION_DIAGNOSTICS);
  assert.equal(diagnostics[0].fileId, 'file-1');
  assert.equal(diagnostics.at(-1).fileId, `file-${MAX_MEDIA_INSPECTION_DIAGNOSTICS}`);
});

test('normalizeMediaInspectionDiagnostics drops malformed rows and truncates long text', () => {
  const diagnostics = normalizeMediaInspectionDiagnostics([{
    code: 'media_inspection_probe_failed',
    filename: `${'a'.repeat(300)}.flac`,
    message: 'x'.repeat(600),
  }, {
    code: '',
    message: '',
  }, null]);

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].filename.length, 255);
  assert.equal(diagnostics[0].message.length, 500);
  assert.match(diagnostics[0].message, /\.\.\.$/u);
});
