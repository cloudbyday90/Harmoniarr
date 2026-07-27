/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const musicQueueTransferRecoveryReleaseId = 'wanted-transfer-recovery-release';

export const MUSIC_QUEUE_TRANSFER_RECOVERY_STAGES = Object.freeze([
  Object.freeze({
    code: 'trying_next_match',
    detail: 'A download did not finish. Harmoniarr is moving to the next eligible match automatically.',
    label: 'Trying another match',
    nextAction: 'view_recovery',
    tone: 'info',
  }),
  Object.freeze({
    code: 'downloading',
    detail: 'Harmoniarr selected the next eligible lossless match and is downloading it now.',
    label: 'Downloading',
    nextAction: 'open_downloader',
    tone: 'info',
  }),
]);

export function buildMusicQueueTransferRecoveryPayload(stage) {
  return {
    checkedAt: '2026-07-27T13:00:00.000Z',
    pagination: { limit: 100, offset: 0, total: 1 },
    releases: [{
      artistName: 'Fixture Harbor',
      expectedTrackCount: 10,
      id: musicQueueTransferRecoveryReleaseId,
      matchedTrackCount: 0,
      missingTrackCount: 10,
      quality: {
        code: 'accepted',
        profile: { code: 'lossless_archive' },
        tone: 'info',
      },
      releaseGroupType: 'Album',
      releaseTitle: 'Automatic Recovery',
      status: stage,
    }],
    summary: { counts: { [stage.code]: 1 }, total: 1 },
  };
}

export function buildMusicQueueTransferRecoveryActivityPayload() {
  return {
    checkedAt: '2026-07-27T13:00:00.000Z',
    events: [{
      entityArtist: 'Fixture Harbor',
      entityId: musicQueueTransferRecoveryReleaseId,
      entityTitle: 'Automatic Recovery',
      entityType: 'wanted_release',
      eventType: 'music_queue_match_retrying',
      extraPayload: { wantedReleaseId: musicQueueTransferRecoveryReleaseId },
      id: 'transfer-recovery-started',
      occurredAt: '2026-07-27T12:59:00.000Z',
    }],
    ok: true,
    total: 1,
  };
}
