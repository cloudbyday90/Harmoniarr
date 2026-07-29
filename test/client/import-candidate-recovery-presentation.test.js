import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildImportCandidateRecoveryPresentation,
  buildImportCandidateSecondaryActions,
} from '../../src/client/lib/import-candidate-recovery-presentation.js';

test('buildImportCandidateRecoveryPresentation makes a preview blocker the primary repair', () => {
  const presentation = buildImportCandidateRecoveryPresentation({
    candidate: { status: 'selected' },
    canManageCandidates: true,
    preview: {
      validation: {
        blockers: [{ message: 'The source files are not available to add safely.' }],
      },
    },
  });

  assert.deepEqual(presentation, {
    action: { id: 'reopen', label: 'Reopen for review' },
    description: 'The source files are not available to add safely.',
    label: 'Needs attention',
    tone: 'warning',
    title: 'This match needs attention',
  });
});

test('buildImportCandidateRecoveryPresentation describes automatic progress without an action', () => {
  const presentation = buildImportCandidateRecoveryPresentation({
    candidate: { status: 'downloading' },
    canManageCandidates: true,
  });

  assert.equal(presentation.action, null);
  assert.equal(presentation.label, 'Downloading');
  assert.equal(presentation.title, 'Download in progress');
});

test('buildImportCandidateRecoveryPresentation leaves a pending match available despite unrelated preview evidence', () => {
  const presentation = buildImportCandidateRecoveryPresentation({
    candidate: { status: 'pending' },
    canManageCandidates: true,
    preview: {
      validation: {
        blockers: [{ message: 'This preview warning belongs to a later review state.' }],
      },
    },
  });

  assert.equal(presentation.label, 'Available');
  assert.deepEqual(presentation.action, { id: 'select', label: 'Use this match' });
});

test('buildImportCandidateRecoveryPresentation does not offer mutations to read-only users', () => {
  const presentation = buildImportCandidateRecoveryPresentation({
    candidate: { status: 'failed' },
    canManageCandidates: false,
  });

  assert.equal(presentation.action, null);
  assert.equal(presentation.title, 'This match needs a retry');
});

test('buildImportCandidateSecondaryActions keeps destructive choices secondary', () => {
  const actions = buildImportCandidateSecondaryActions({ status: 'pending' }, 'select');

  assert.deepEqual(actions, [
    { id: 'hold', label: 'Pause this match', tone: 'default' },
    { id: 'reject', label: 'Do not use this match', tone: 'danger' },
  ]);
});
