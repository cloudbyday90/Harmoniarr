/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { isDeepStrictEqual } from 'node:util';
import { refuseOperatorTrackFiles } from './operator-track-file-policy.js';

export function readTrackDeliveryProgress(candidate, selection) {
  const payload = candidate?.normalizedPayload ?? {};
  if (!Object.hasOwn(payload, 'operatorTrackDeliveryProgress')) return [];
  const progress = payload.operatorTrackDeliveryProgress;
  if (!selection?.sharedDelivery || progress?.version !== 1
    || !isDeepStrictEqual(progress.participants, selection.participants)
    || !Array.isArray(progress.plans) || progress.plans.length !== 2
    || new Set(progress.plans.map(file => file?.fileId)).size !== 2
    || !Array.isArray(progress.files) || progress.files.length < 1 || progress.files.length > 2
    || new Set(progress.files.map(file => file?.fileId)).size !== progress.files.length) throw refuseOperatorTrackFiles();
  for (const plan of progress.plans) {
    const binding = selection.bindings.find(entry => entry.fileId === plan.fileId);
    const owner = selection.participants.find(entry => entry.scope.tracks[0].metadataTrackId === binding?.track.metadataTrackId);
    if (!owner || !plan.libraryPath || !plan.delivery?.libraryRoot
      || !isDeepStrictEqual(plan.delivery, { ...owner, libraryRoot: plan.delivery.libraryRoot })) throw refuseOperatorTrackFiles();
  }
  for (const file of progress.files) {
    const binding = selection.bindings.find(entry => entry.fileId === file?.fileId);
    const owner = selection.participants.find(entry => entry.scope.tracks[0].metadataTrackId === binding?.track.metadataTrackId);
    if (!binding || !owner || file.status !== 'applied' || !file.libraryPath || !file.delivery?.libraryRoot
      || !isDeepStrictEqual(file.verifiedTrack, binding.track)
      || !isDeepStrictEqual(file.delivery, { ...owner, libraryRoot: file.delivery.libraryRoot })
      || !/^[a-f0-9]{64}$/u.test(file.trackFileEvidence?.sha256 ?? '')
      || !Number.isSafeInteger(file.trackFileEvidence?.sizeBytes) || file.trackFileEvidence.sizeBytes <= 0) throw refuseOperatorTrackFiles();
  }
  return structuredClone(progress.files);
}

export function captureTrackDeliveryPlans(files) {
  return structuredClone(files.map(file => ({ fileId: file.fileId, libraryPath: file.libraryTarget?.path ?? file.libraryPath,
    delivery: file.delivery })).sort((a, b) => a.fileId.localeCompare(b.fileId)));
}

export function captureTrackDeliveryOperation(operation) {
  return structuredClone({ fileId: operation.fileId, filename: operation.filename, libraryPath: operation.libraryPath,
    status: operation.status, delivery: operation.delivery, verifiedTrack: operation.verifiedTrack,
    trackFileEvidence: operation.trackFileEvidence });
}
