import assert from 'node:assert/strict';
import test from 'node:test';
import { createMediaTranscodePlanningService } from '../../src/server/media/media-transcode-planning-service.js';

test('planInspection preserves lossless sources without warnings', () => {
  const service = createMediaTranscodePlanningService();

  const plan = service.planInspection({
    inspection: {
      metadata: {
        audioCodecs: ['flac'],
        audioStreamCount: 1,
      },
    },
  });

  assert.equal(plan.mode, 'planning_only');
  assert.equal(plan.recommendedAction, 'keep_original');
  assert.equal(plan.rationale, 'preserve_lossless_source');
  assert.equal(plan.warnings.length, 0);
});

test('planInspection flags lossy sources as transcode candidates with explicit warning', () => {
  const service = createMediaTranscodePlanningService({
    transcodeTargetCodec: 'opus',
  });

  const plan = service.planInspection({
    inspection: {
      metadata: {
        audioCodecs: ['mp3'],
        audioStreamCount: 1,
      },
    },
  });

  assert.equal(plan.recommendedAction, 'transcode_candidate');
  assert.equal(plan.target.audioCodec, 'opus');
  assert.equal(plan.warnings.length, 1);
  assert.equal(plan.warnings[0].code, 'media_transcode_lossy_source_detected');
});

test('planInspection warns when inspection metadata is unavailable', () => {
  const service = createMediaTranscodePlanningService();

  const plan = service.planInspection({
    inspection: {
      metadata: null,
    },
  });

  assert.equal(plan.recommendedAction, 'keep_original');
  assert.equal(plan.warnings.length, 1);
  assert.equal(plan.warnings[0].code, 'media_transcode_inspection_unavailable');
});