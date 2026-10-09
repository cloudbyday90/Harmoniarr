/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { createOperationRunLeaseFixture } from '../../testing/operation-run-lease-fixtures.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryOrganizeApplyWorker } from '../../src/server/library/library-organize-apply-worker.js';
import { createOperationRunCancellationError, createOperationRunPauseError } from '../../src/server/operation-run-cancellation.js';

function verifiedOrganizeResult() {
  return { transport: 'copy_then_remove', sourceRemoved: true,
    verification: { destinationExists: true, sourceSizeBytes: 1, destinationSizeBytes: 1,
      sourceRemoved: true, sourceExistsAfterSuccess: false } };
}

function waitForWorkerTick() {
  return new Promise((resolve) => {
    setTimeout(resolve, 100);
  });
}

const leaseForTest = (runId) => createOperationRunLeaseFixture({ runId, jobType: 'library_organize_apply' });

function owningWorkerFixture({ applyOrganizeMutation, createExclusiveFileMutationPlan = async (plan) => plan }) {
  let finish;
  const done = new Promise((resolve) => { finish = resolve; });
  const lifecycle = [];
  const notifications = [];
  const file = { fileId: 'file-boundary', libraryRootId: 'root-boundary', libraryRootPath: 'D:/music',
    currentPath: 'D:/music/incoming/01.flac', proposedPath: 'D:/music/Artist/Album/01 Track.flac',
    proposedRelativePath: 'Artist/Album/01 Track.flac', status: { code: 'rename_required' } };
  const lease = leaseForTest('run-boundary');
  const worker = createLibraryOrganizeApplyWorker({
    acquireLease: async () => lease,
    applyOrganizeMutation,
    createExclusiveFileMutationPlan,
    buildLibraryOrganizePreview: async () => ({ counts: { totalFiles: 1 }, files: [file] }),
    isCancellationRequested: async () => false,
    markRunStarted: async () => true,
    markRunCompleted: async (input) => { lifecycle.push({ type: 'completed', ...input }); return true; },
    markRunFailed: async (input) => { lifecycle.push({ type: 'failed', ...input }); return true; },
    markRunCancelled: async (input) => { lifecycle.push({ type: 'cancelled', ...input }); return true; },
    markRunPaused: async (input) => { lifecycle.push({ type: 'paused', ...input }); return true; },
    onReleaseAddedFn: async (input) => { notifications.push(input); },
    releaseLease: async () => { finish(); },
  });
  return { worker, done, lifecycle, notifications, file, lease };
}

test('organize requires the guarded owner and passes the resolved cleanup plan with its original acquisition', async () => {
  assert.throws(() => createLibraryOrganizeApplyWorker({}), /guarded mutation owner/u);
  let mutation;
  const fixture = owningWorkerFixture({ applyOrganizeMutation: async (input) => {
    mutation = input;
    return verifiedOrganizeResult();
  } });
  await fixture.worker.startWorkerRun({ runId: 'run-boundary' }); await fixture.done;
  assert.deepEqual(mutation, { runId: 'run-boundary', expectedLease: fixture.lease, file: fixture.file,
    plan: { sourcePath: fixture.file.currentPath, sourceRoot: fixture.file.libraryRootPath,
      destinationPath: fixture.file.proposedPath, destinationRoot: fixture.file.libraryRootPath,
      requestedMode: 'move', removeSourceAfterSuccess: true } });
  assert.equal(fixture.lifecycle[0].summary.movedCount, 1);
});

test('guarded mutation pause and cancellation reach their outer handlers without completed files or notifications', async () => {
  for (const [type, error] of [
    ['paused', createOperationRunPauseError({ runId: 'run-boundary', pauseCode: 'maintenance_lock_active' })],
    ['cancelled', createOperationRunCancellationError({ runId: 'run-boundary' })],
  ]) {
    const fixture = owningWorkerFixture({ applyOrganizeMutation: async () => { throw error; } });
    await fixture.worker.startWorkerRun({ runId: 'run-boundary' }); await fixture.done;
    assert.deepEqual(fixture.lifecycle.map((entry) => entry.type), [type]);
    assert.equal(fixture.lifecycle[0].expectedLease, fixture.lease);
    assert.equal(fixture.lifecycle[0].summary.movedCount ?? 0, 0);
    assert.equal(fixture.notifications.length, 0);
  }
});

test('library organize apply worker records release activity and notifications after full success', async () => {
  const releaseNotifications = [];
  const activityEvents = [];
  let completedSummary = null;

  const worker = createLibraryOrganizeApplyWorker({
    acquireLease: async ({ runId }) => leaseForTest(runId),
    applyOrganizeMutation: async () => verifiedOrganizeResult(),
    buildLibraryOrganizePreview: async () => ({
      counts: { totalFiles: 2 },
      files: [
        {
          currentPath: 'D:/music/tmp/01.mp3',
          fileId: 'file-1',
          libraryRootPath: 'D:/music',
          match: { artistName: 'Radiohead', releaseTitle: 'OK Computer' },
          proposedPath: 'D:/music/Radiohead/OK Computer/01 Airbag.mp3',
          proposedRelativePath: 'Radiohead/OK Computer/01 Airbag.mp3',
          status: { code: 'rename_required' },
        },
        {
          currentPath: 'D:/music/tmp/02.mp3',
          fileId: 'file-2',
          libraryRootPath: 'D:/music',
          match: { artistName: 'Radiohead', releaseTitle: 'OK Computer' },
          proposedPath: 'D:/music/Radiohead/OK Computer/02 Paranoid Android.mp3',
          proposedRelativePath: 'Radiohead/OK Computer/02 Paranoid Android.mp3',
          status: { code: 'rename_required' },
        },
      ],
    }),
    createExclusiveFileMutationPlan: async (plan) => plan,
    isCancellationRequested: async () => false,
    markRunCancelled: async () => {},
    markRunCompleted: async ({ summary }) => { completedSummary = summary; },
    markRunFailed: async () => {},
    markRunPaused: async () => {},
    markRunStarted: async () => {},
    onReleaseAddedFn: async (payload) => { releaseNotifications.push(payload); },
    recordActivityEventFn: async (payload) => { activityEvents.push(payload); },
    releaseLease: async () => {},
    renewLease: async () => {},
  });

  await worker.startWorkerRun({ plannedRenameCount: 2, runId: 'run-1' });
  await waitForWorkerTick();

  assert.equal(completedSummary.movedCount, 2);
  assert.equal(releaseNotifications.length, 1);
  assert.deepEqual(releaseNotifications[0], {
    artistName: 'Radiohead',
    movedCount: 2,
    releaseCount: 1,
    releaseTitle: 'OK Computer',
  });
  assert.equal(activityEvents.length, 1);
  assert.equal(activityEvents[0].eventType, 'release_added');
  assert.equal(activityEvents[0].entityArtist, 'Radiohead');
  assert.equal(activityEvents[0].entityTitle, 'OK Computer');
  assert.deepEqual(activityEvents[0].extraPayload, {
    schemaVersion: 1,
    presentationType: 'release_added',
    movedCount: 2,
    primaryRelease: { artistName: 'Radiohead', releaseTitle: 'OK Computer' },
    releaseCount: 1,
    releases: [{ artistName: 'Radiohead', releaseTitle: 'OK Computer' }],
    source: {
      operationType: 'library_organize_apply',
      runId: 'run-1',
    },
  });
});

test('library organize apply worker still records release activity when some files moved before failure', async () => {
  const releaseNotifications = [];
  const activityEvents = [];

  let callCount = 0;
  const worker = createLibraryOrganizeApplyWorker({
    acquireLease: async ({ runId }) => leaseForTest(runId),
    applyOrganizeMutation: async () => {
      callCount += 1;
      if (callCount === 2) {
        throw new Error('disk rename failed');
      }
      return verifiedOrganizeResult();
    },
    buildLibraryOrganizePreview: async () => ({
      counts: { totalFiles: 2 },
      files: [
        {
          currentPath: 'D:/music/tmp/01.mp3',
          fileId: 'file-1',
          libraryRootPath: 'D:/music',
          match: { artistName: 'Autechre', releaseTitle: 'Amber' },
          proposedPath: 'D:/music/Autechre/Amber/01 Foil.mp3',
          proposedRelativePath: 'Autechre/Amber/01 Foil.mp3',
          status: { code: 'rename_required' },
        },
        {
          currentPath: 'D:/music/tmp/02.mp3',
          fileId: 'file-2',
          libraryRootPath: 'D:/music',
          match: { artistName: 'Autechre', releaseTitle: 'Amber' },
          proposedPath: 'D:/music/Autechre/Amber/02 Montreal.mp3',
          proposedRelativePath: 'Autechre/Amber/02 Montreal.mp3',
          status: { code: 'rename_required' },
        },
      ],
    }),
    createExclusiveFileMutationPlan: async (plan) => plan,
    isCancellationRequested: async () => false,
    markRunCancelled: async () => {},
    markRunCompleted: async () => {},
    markRunFailed: async () => {},
    markRunPaused: async () => {},
    markRunStarted: async () => {},
    onReleaseAddedFn: async (payload) => { releaseNotifications.push(payload); },
    recordActivityEventFn: async (payload) => { activityEvents.push(payload); },
    releaseLease: async () => {},
    renewLease: async () => {},
  });

  await worker.startWorkerRun({ plannedRenameCount: 2, runId: 'run-2' });
  await waitForWorkerTick();

  assert.equal(releaseNotifications.length, 1);
  assert.equal(releaseNotifications[0].releaseTitle, 'Amber');
  assert.equal(releaseNotifications[0].movedCount, 1);
  assert.equal(activityEvents.length, 1);
  assert.equal(activityEvents[0].eventType, 'release_added');
  assert.deepEqual(activityEvents[0].extraPayload, {
    schemaVersion: 1,
    presentationType: 'release_added',
    movedCount: 1,
    primaryRelease: { artistName: 'Autechre', releaseTitle: 'Amber' },
    releaseCount: 1,
    releases: [{ artistName: 'Autechre', releaseTitle: 'Amber' }],
    source: {
      operationType: 'library_organize_apply',
      runId: 'run-2',
    },
  });
});

test('library organize apply worker records multi-release summaries in activity payloads', async () => {
  const activityEvents = [];

  const worker = createLibraryOrganizeApplyWorker({
    acquireLease: async ({ runId }) => leaseForTest(runId),
    applyOrganizeMutation: async () => verifiedOrganizeResult(),
    buildLibraryOrganizePreview: async () => ({
      counts: { totalFiles: 2 },
      files: [
        {
          currentPath: 'D:/music/tmp/01.mp3',
          fileId: 'file-1',
          libraryRootPath: 'D:/music',
          match: { artistName: 'Radiohead', releaseTitle: 'Kid A' },
          proposedPath: 'D:/music/Radiohead/Kid A/01 Everything In Its Right Place.mp3',
          proposedRelativePath: 'Radiohead/Kid A/01 Everything In Its Right Place.mp3',
          status: { code: 'rename_required' },
        },
        {
          currentPath: 'D:/music/tmp/02.mp3',
          fileId: 'file-2',
          libraryRootPath: 'D:/music',
          match: { artistName: 'Autechre', releaseTitle: 'Amber' },
          proposedPath: 'D:/music/Autechre/Amber/01 Foil.mp3',
          proposedRelativePath: 'Autechre/Amber/01 Foil.mp3',
          status: { code: 'rename_required' },
        },
      ],
    }),
    createExclusiveFileMutationPlan: async (plan) => plan,
    isCancellationRequested: async () => false,
    markRunCancelled: async () => {},
    markRunCompleted: async () => {},
    markRunFailed: async () => {},
    markRunPaused: async () => {},
    markRunStarted: async () => {},
    onReleaseAddedFn: async () => {},
    recordActivityEventFn: async (payload) => { activityEvents.push(payload); },
    releaseLease: async () => {},
    renewLease: async () => {},
  });

  await worker.startWorkerRun({ plannedRenameCount: 2, runId: 'run-4' });
  await waitForWorkerTick();

  assert.equal(activityEvents.length, 1);
  assert.equal(activityEvents[0].entityArtist, null);
  assert.deepEqual(activityEvents[0].extraPayload, {
    schemaVersion: 1,
    presentationType: 'release_added',
    movedCount: 2,
    primaryRelease: { artistName: 'Radiohead', releaseTitle: 'Kid A' },
    releaseCount: 2,
    releases: [
      { artistName: 'Radiohead', releaseTitle: 'Kid A' },
      { artistName: 'Autechre', releaseTitle: 'Amber' },
    ],
    source: {
      operationType: 'library_organize_apply',
      runId: 'run-4',
    },
  });
  assert.equal(activityEvents[0].entityTitle, '2 releases');
});

test('library organize apply worker requeues the run when a maintenance pause is requested', async (t) => {
  const acquireLease = t.mock.fn(async ({ runId }) => leaseForTest(runId));
  const releaseLease = t.mock.fn(async () => {});
  const markRunStarted = t.mock.fn(async () => {});
  const markRunCompleted = t.mock.fn(async () => {});
  const markRunFailed = t.mock.fn(async () => {});
  const markRunCancelled = t.mock.fn(async () => {});
  const markRunPaused = t.mock.fn(async () => {});

  const worker = createLibraryOrganizeApplyWorker({
    acquireLease,
    applyOrganizeMutation: async () => verifiedOrganizeResult(),
    buildLibraryOrganizePreview: async () => ({ counts: { totalFiles: 0 }, files: [] }),
    createExclusiveFileMutationPlan: async (plan) => plan,
    isCancellationRequested: async () => ({
      kind: 'paused',
      nextRetryAt: '2026-05-04T12:30:00.000Z',
      pauseCode: 'recovery_lock_conflict',
      pauseMessage: 'Library organize apply is paused while the restore maintenance lock is active.',
      pauseProvider: 'restore',
    }),
    markRunCancelled,
    markRunCompleted,
    markRunFailed,
    markRunPaused,
    markRunStarted,
    releaseLease,
    renewLease: async () => {},
  });

  const paused = new Promise((resolve) => {
    markRunPaused.mock.mockImplementation(async (args) => {
      resolve(args);
    });
  });
  const leaseReleased = new Promise((resolve) => {
    releaseLease.mock.mockImplementation(async (args) => {
      resolve(args);
    });
  });

  await worker.startWorkerRun({ plannedRenameCount: 5, runId: 'run-paused' });

  const pausedArgs = await paused;
  const releasedLeaseArgs = await leaseReleased;

  assert.equal(markRunStarted.mock.callCount(), 0);
  assert.equal(markRunCompleted.mock.callCount(), 0);
  assert.equal(markRunFailed.mock.callCount(), 0);
  assert.equal(markRunCancelled.mock.callCount(), 0);
  assert.deepEqual(pausedArgs, {
    expectedLease: leaseForTest('run-paused'),
    nextAttemptAt: '2026-05-04T12:30:00.000Z',
    runId: 'run-paused',
    summary: {
      currentStep: 'Library organize apply paused by maintenance lock',
      pauseCode: 'recovery_lock_conflict',
      pauseMessage: 'Library organize apply is paused while the restore maintenance lock is active.',
      pauseProvider: 'restore',
      plannedRenameCount: 5,
    },
  });
  assert.deepEqual(releasedLeaseArgs, {
    expectedLease: leaseForTest('run-paused'),
    runId: 'run-paused',
    status: 'paused',
  });
});

test('library organize apply worker does not emit release activity when no files were moved', async () => {
  const releaseNotifications = [];
  const activityEvents = [];

  const worker = createLibraryOrganizeApplyWorker({
    acquireLease: async ({ runId }) => leaseForTest(runId),
    applyOrganizeMutation: async () => {
      throw new Error('disk rename failed');
    },
    buildLibraryOrganizePreview: async () => ({
      counts: { totalFiles: 1 },
      files: [
        {
          currentPath: 'D:/music/tmp/01.mp3',
          fileId: 'file-1',
          libraryRootPath: 'D:/music',
          match: { artistName: 'Aphex Twin', releaseTitle: 'Selected Ambient Works 85-92' },
          proposedPath: 'D:/music/Aphex Twin/Selected Ambient Works 85-92/01 Xtal.mp3',
          proposedRelativePath: 'Aphex Twin/Selected Ambient Works 85-92/01 Xtal.mp3',
          status: { code: 'rename_required' },
        },
      ],
    }),
    createExclusiveFileMutationPlan: async (plan) => plan,
    isCancellationRequested: async () => false,
    markRunCancelled: async () => {},
    markRunCompleted: async () => {},
    markRunFailed: async () => {},
    markRunPaused: async () => {},
    markRunStarted: async () => {},
    onReleaseAddedFn: async (payload) => { releaseNotifications.push(payload); },
    recordActivityEventFn: async (payload) => { activityEvents.push(payload); },
    releaseLease: async () => {},
    renewLease: async () => {},
  });

  await worker.startWorkerRun({ plannedRenameCount: 1, runId: 'run-3' });
  await waitForWorkerTick();

  assert.equal(releaseNotifications.length, 0);
  assert.equal(activityEvents.length, 0);
});
