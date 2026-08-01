import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deriveImportCandidateAddRecoveryReasonCode,
} from '../../src/server/import-candidates/import-candidate-add-blocker.js';

test('deriveImportCandidateAddRecoveryReasonCode maps safe-auto evidence to bounded media recovery reasons', () => {
  assert.equal(
    deriveImportCandidateAddRecoveryReasonCode({
      addBlockerCode: 'media_verification',
      qualityGate: { blockers: [{ code: 'safe_auto_quality_codec_extension_mismatch' }] },
    }),
    'lossy_audio',
  );
  assert.equal(
    deriveImportCandidateAddRecoveryReasonCode({
      addBlockerCode: 'media_verification',
      qualityGate: { blockers: [{ code: 'safe_auto_spectral_transcoded' }] },
    }),
    'suspicious_lossless',
  );
  assert.equal(
    deriveImportCandidateAddRecoveryReasonCode({
      addBlockerCode: 'media_verification',
      qualityGate: { blockers: [{ code: 'safe_auto_media_inspection_failed' }] },
    }),
    'audio_check_failed',
  );
});

test('deriveImportCandidateAddRecoveryReasonCode accepts only media-specific allow-listed reasons', () => {
  assert.equal(
    deriveImportCandidateAddRecoveryReasonCode({
      addBlockerCode: 'media_verification',
      recoveryReasonCode: 'suspicious_lossless',
    }),
    'suspicious_lossless',
  );
  assert.equal(
    deriveImportCandidateAddRecoveryReasonCode({
      addBlockerCode: 'library_collision',
      recoveryReasonCode: 'lossy_audio',
    }),
    null,
  );
  assert.equal(
    deriveImportCandidateAddRecoveryReasonCode({
      addBlockerCode: 'media_verification',
      recoveryReasonCode: 'private-path:/downloads/music',
    }),
    'audio_check_failed',
  );
});
