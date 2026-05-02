import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createMediaLosslessRetentionPolicyService,
  DEFAULT_LOSSY_DERIVATIVE_DECISION_TYPE,
} from '../../src/server/media/media-lossless-retention-policy-service.js';

test('evaluateCandidatePolicy does not require acknowledgement for keep-original plans', () => {
  const service = createMediaLosslessRetentionPolicyService();

  const policy = service.evaluateCandidatePolicy({
    decision: null,
    transcodePlan: {
      recommendedAction: 'keep_original',
    },
  });

  assert.equal(policy.requiresLossyAcknowledgement, false);
  assert.equal(policy.lossyDerivativeAcknowledged, false);
  assert.equal(policy.warnings.length, 0);
});

test('evaluateCandidatePolicy requires acknowledgement for lossy derivative candidates', () => {
  const service = createMediaLosslessRetentionPolicyService();

  const policy = service.evaluateCandidatePolicy({
    decision: null,
    transcodePlan: {
      recommendedAction: 'transcode_candidate',
    },
  });

  assert.equal(policy.requiresLossyAcknowledgement, true);
  assert.equal(policy.lossyDerivativeAcknowledged, false);
  assert.equal(policy.warnings[0].code, 'media_transcode_lossy_derivative_ack_required');
});

test('evaluateCandidatePolicy records explicit lossy derivative acknowledgement', () => {
  const service = createMediaLosslessRetentionPolicyService();

  const policy = service.evaluateCandidatePolicy({
    decision: {
      decisionType: DEFAULT_LOSSY_DERIVATIVE_DECISION_TYPE,
    },
    transcodePlan: {
      recommendedAction: 'transcode_candidate',
    },
  });

  assert.equal(policy.requiresLossyAcknowledgement, true);
  assert.equal(policy.lossyDerivativeAcknowledged, true);
  assert.equal(policy.warnings[0].code, 'media_transcode_lossy_derivative_acknowledged');
});
