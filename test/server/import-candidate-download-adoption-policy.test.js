import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { captureRecoveryObservation } from '../../src/server/import-candidates/music-queue-recovery-policy.js';
import { buildDownloadAdoptionReviewDigest, normalizeDownloadAdoptionCommand, resolveDownloadAdoptionEpisode,
  MAX_DOWNLOAD_ADOPTION_FILES } from '../../src/server/import-candidates/import-candidate-download-adoption-policy.js';

function fixture() {
  const candidate = { id: randomUUID(), status: 'selected', username: 'peer', folderPath: 'Album', files: [{ id: randomUUID(),
    filename: 'Song.flac', folderPath: 'Album', sizeBytes: 1000, extension: 'flac', isLocked: false, rawPayload: { filename: 'Album\\Song.flac' } }] };
  const run = { id: randomUUID(), operationType: 'import_candidate_execution_planning', status: 'failed', summary: {} };
  const item = { importCandidateId: candidate.id, operationRunId: run.id, itemStatus: 'awaiting_confirmation', planningSnapshot: {
    execution: { requestedFiles: [{ filename: 'Album\\Song.flac', size: 1000 }], sourceObservation: captureRecoveryObservation(candidate) } } };
  return { candidate, run, item, currentOriginId: run.id };
}

test('adoption accepts only the bounded digest and unique GUID command, never caller source or policy', () => {
  const ids = [randomUUID(), randomUUID()]; const command = { reviewDigest: 'A'.repeat(64), transferIds: ids };
  assert.deepEqual(normalizeDownloadAdoptionCommand(command), { reviewDigest: 'a'.repeat(64), transferIds: ids.toSorted() });
  for (const bad of [null, [], {}, { ...command, actorUserId: randomUUID() }, { ...command, files: [] },
    { ...command, sourceObservation: {} }, { ...command, reviewDigest: 'capability' }, { ...command, transferIds: [ids[0], ids[0].toUpperCase()] },
    { ...command, transferIds: ['opaque'] }, { ...command, transferIds: Array.from({ length: MAX_DOWNLOAD_ADOPTION_FILES + 1 }, randomUUID) }]) {
    assert.throws(() => normalizeDownloadAdoptionCommand(bad), { code: 'validation_error' });
  }
});

test('only a terminal latest unresolved selected episode with exact immutable files can be reviewed', () => {
  const f = fixture(); assert.equal(resolveDownloadAdoptionEpisode(f).eligible, true);
  for (const alter of [
    (x) => { x.run.status = 'running'; }, (x) => { x.run.status = 'pending'; },
    (x) => { x.currentOriginId = randomUUID(); }, (x) => { x.candidate.status = 'downloading'; },
    (x) => { delete x.item.planningSnapshot.execution.sourceObservation; },
    (x) => { x.item.planningSnapshot.execution.requestedFiles[0].size = '1000'; },
    (x) => { x.candidate.files[0].sizeBytes += 1; }, (x) => { x.candidate.username = 'foreign-peer'; },
    (x) => { x.item.planningSnapshot.execution.handoff = { state: 'not_dispatched' }; },
    (x) => { x.item.planningSnapshot.execution.handoff = { adoption: {} }; },
  ]) { const changed = structuredClone(f); alter(changed); assert.equal(resolveDownloadAdoptionEpisode(changed).eligible, false); }
  const active = structuredClone(f); active.run.status = 'running';
  assert.equal(resolveDownloadAdoptionEpisode(active).reasonCode, 'active_download_work');
});

test('review digest binds actor, manifest, provider, policy and choice identities while excluding progress and heartbeat fields', () => {
  const f = fixture(); const episode = resolveDownloadAdoptionEpisode(f);
  const input = { actorUserId: randomUUID(), episode, providerBinding: { endpointFingerprint: 'private-binding', protocol: 'legacy', version: '0.25.1' },
    policySnapshot: { minimumBitrateKbps: 320 }, choices: [{ id: randomUUID(), username: 'peer', filename: 'Album\\Song.flac', size: 1000, state: 'InProgress' }] };
  const digest = buildDownloadAdoptionReviewDigest(input);
  const heartbeat = structuredClone(input); heartbeat.choices[0].state = 'Completed, Succeeded'; heartbeat.choices[0].bytesTransferred = 1000;
  heartbeat.episode.item.updatedAt = 'later'; heartbeat.episode.sourceObservation.updatedAt = 'later';
  assert.equal(buildDownloadAdoptionReviewDigest(heartbeat), digest);
  for (const alter of [(x) => { x.actorUserId = randomUUID(); }, (x) => { x.providerBinding.endpointFingerprint = 'other'; },
    (x) => { x.policySnapshot.minimumBitrateKbps = 256; }, (x) => { x.choices[0].id = randomUUID(); },
    (x) => { x.episode.requestedFiles[0].size += 1; }, (x) => { x.episode.sourceObservation.username = 'other'; }]) {
    const changed = structuredClone(input); alter(changed); assert.notEqual(buildDownloadAdoptionReviewDigest(changed), digest);
  }
});
