import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  candidateStatusLabel,
  candidateStatusTone,
  formatCandidateSourceLabel,
  formatBytes,
  runItemStatusLabel,
  runItemStatusTone,
  buildPipelineSteps,
} from '../../src/client/lib/request-pipeline-presentation.js';

describe('candidateStatusLabel', () => {
  test('maps known statuses', () => {
    assert.equal(candidateStatusLabel('pending'), 'Discovered');
    assert.equal(candidateStatusLabel('held'), 'Held');
    assert.equal(candidateStatusLabel('selected'), 'Queued');
    assert.equal(candidateStatusLabel('downloading'), 'Downloading');
    assert.equal(candidateStatusLabel('import_pending'), 'Import pending');
    assert.equal(candidateStatusLabel('applied'), 'Applied');
    assert.equal(candidateStatusLabel('rejected'), 'Rejected');
    assert.equal(candidateStatusLabel('failed'), 'Failed');
  });

  test('returns Unknown for unrecognized status', () => {
    assert.equal(candidateStatusLabel('bogus'), 'Unknown');
  });
});

describe('candidateStatusTone', () => {
  test('maps applied to selected', () => {
    assert.equal(candidateStatusTone('applied'), 'selected');
  });

  test('maps failed statuses to failed', () => {
    assert.equal(candidateStatusTone('failed'), 'failed');
    assert.equal(candidateStatusTone('rejected'), 'failed');
  });

  test('maps pending to held', () => {
    assert.equal(candidateStatusTone('pending'), 'held');
  });
});

describe('formatBytes', () => {
  test('formats zero bytes', () => {
    assert.equal(formatBytes(0), '0 B');
  });

  test('formats null as 0 B', () => {
    assert.equal(formatBytes(null), '0 B');
  });

  test('formats bytes', () => {
    assert.equal(formatBytes(500), '500 B');
  });

  test('formats kilobytes', () => {
    assert.equal(formatBytes(1536), '1.5 KB');
  });

  test('formats megabytes', () => {
    assert.equal(formatBytes(1048576), '1.0 MB');
  });

  test('formats gigabytes', () => {
    assert.equal(formatBytes(1073741824), '1.0 GB');
  });
});

describe('formatCandidateSourceLabel', () => {
  test('prefers the server-provided safe source label', () => {
    assert.equal(formatCandidateSourceLabel({
      sourceLabel: 'Source 2',
      username: 'remote-peer',
      folderPath: 'Artist\\Album',
    }, 1), 'Source 2');
  });

  test('falls back to operator peer and folder context when no safe label exists', () => {
    assert.equal(formatCandidateSourceLabel({
      username: 'remote-peer',
      folderPath: 'Artist\\Album',
    }), 'remote-peer - Album');
  });

  test('falls back to a generic source label when no source fields exist', () => {
    assert.equal(formatCandidateSourceLabel({}, 2), 'Source 3');
  });
});

describe('runItemStatusLabel', () => {
  test('returns null for null input', () => {
    assert.equal(runItemStatusLabel(null), null);
  });

  test('returns null for missing itemStatus', () => {
    assert.equal(runItemStatusLabel({}), null);
  });

  test('maps known item statuses', () => {
    assert.equal(runItemStatusLabel({ itemStatus: 'completed' }), 'Completed');
    assert.equal(runItemStatusLabel({ itemStatus: 'failed' }), 'Failed');
    assert.equal(runItemStatusLabel({ itemStatus: 'in_progress' }), 'In progress');
  });

  test('passes through unknown status', () => {
    assert.equal(runItemStatusLabel({ itemStatus: 'custom_status' }), 'custom_status');
  });
});

describe('runItemStatusTone', () => {
  test('returns null for null input', () => {
    assert.equal(runItemStatusTone(null), null);
  });

  test('maps completed to selected', () => {
    assert.equal(runItemStatusTone({ itemStatus: 'completed' }), 'selected');
  });

  test('maps failed to failed', () => {
    assert.equal(runItemStatusTone({ itemStatus: 'failed' }), 'failed');
  });

  test('maps in_progress to warning', () => {
    assert.equal(runItemStatusTone({ itemStatus: 'in_progress' }), 'warning');
  });
});

describe('buildPipelineSteps', () => {
  test('returns empty array for null candidate', () => {
    assert.deepEqual(buildPipelineSteps(null), []);
  });

  test('shows discovery step for pending candidate', () => {
    const steps = buildPipelineSteps({ status: 'pending' });
    assert.equal(steps.length, 2);
    assert.equal(steps[0].key, 'discovery');
    assert.equal(steps[0].status, 'completed');
    assert.equal(steps[1].key, 'review');
    assert.equal(steps[1].status, 'pending');
  });

  test('shows rejected step for rejected candidate', () => {
    const steps = buildPipelineSteps({ status: 'rejected' });
    assert.equal(steps.length, 2);
    assert.equal(steps[1].key, 'review');
    assert.equal(steps[1].status, 'failed');
  });

  test('shows full pipeline for applied candidate with run data', () => {
    const steps = buildPipelineSteps({
      status: 'applied',
      execution: { runStatus: 'completed', itemStatus: 'completed' },
      apply: { runStatus: 'completed', itemStatus: 'completed' },
    });
    assert.equal(steps.length, 4);
    assert.equal(steps[0].key, 'discovery');
    assert.equal(steps[0].status, 'completed');
    assert.equal(steps[1].key, 'review');
    assert.equal(steps[1].status, 'completed');
    assert.equal(steps[2].key, 'execution');
    assert.equal(steps[2].status, 'completed');
    assert.equal(steps[3].key, 'apply');
    assert.equal(steps[3].status, 'completed');
  });

  test('shows active download step', () => {
    const steps = buildPipelineSteps({
      status: 'downloading',
      execution: { runStatus: 'running', itemStatus: 'in_progress' },
    });
    assert.equal(steps.length, 3);
    assert.equal(steps[2].key, 'execution');
    assert.equal(steps[2].status, 'active');
    assert.equal(steps[2].label, 'Downloading');
  });

  test('shows failed execution step', () => {
    const steps = buildPipelineSteps({
      status: 'selected',
      execution: { runStatus: 'failed', itemStatus: 'failed' },
    });
    assert.equal(steps[2].key, 'execution');
    assert.equal(steps[2].status, 'failed');
    assert.equal(steps[2].label, 'Download failed');
  });

  test('shows pending execution step without run data', () => {
    const steps = buildPipelineSteps({ status: 'selected' });
    assert.equal(steps.length, 3);
    assert.equal(steps[2].key, 'execution');
    assert.equal(steps[2].status, 'pending');
  });

  test('shows applied step without apply run data', () => {
    const steps = buildPipelineSteps({
      status: 'applied',
      execution: { runStatus: 'completed', itemStatus: 'completed' },
    });
    assert.equal(steps[3].key, 'apply');
    assert.equal(steps[3].status, 'completed');
    assert.equal(steps[3].label, 'Imported');
  });
});
