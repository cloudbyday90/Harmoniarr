/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const ACCEPTED_QUALITY = Object.freeze({
  code: 'accepted',
  profile: { code: 'lossless_archive' },
  tone: 'info',
});

const NEEDS_VERIFICATION_QUALITY = Object.freeze({
  code: 'needs_verification',
  profile: { code: 'lossless_archive' },
  tone: 'warning',
});

const AUTOMATIC_RECOVERY_STATUS = Object.freeze({
  code: 'trying_next_match',
  detail: 'A previous match did not work. Harmoniarr is moving to the next eligible match automatically.',
  label: 'Trying another match',
  nextAction: 'view_recovery',
  tone: 'info',
});

const DOWNLOADING_STATUS = Object.freeze({
  code: 'downloading',
  detail: 'Harmoniarr selected the next eligible lossless match and is downloading it now.',
  label: 'Downloading',
  nextAction: 'open_downloader',
  tone: 'info',
});

const QUALITY_STOP_STATUS = Object.freeze({
  code: 'quality_choice_needed',
  detail: 'A downloaded match did not pass verified lossless checks, and no other safe match is available.',
  label: 'Quality choice needed',
  nextAction: 'review_quality_choice',
  tone: 'warning',
});

const IMPORT_STOP_STATUS = Object.freeze({
  code: 'needs_help_adding',
  detail: 'A file for this release already exists in your library, so Harmoniarr stopped before overwriting it.',
  label: 'Needs help',
  nextAction: 'review_add_plan',
  repair: Object.freeze({
    actionCode: 'review_add_plan',
    actionLabel: 'Review library conflict',
    detail: 'A file for this release already exists in your library, so Harmoniarr stopped before overwriting it.',
    nextStep: 'Review the release, then use Advanced diagnostics to decide how to handle the existing library file.',
    reasonCode: 'library_collision',
    title: 'Existing library files need review',
  }),
  tone: 'warning',
});

export const MUSIC_QUEUE_TERMINAL_RECOVERY_CASES = Object.freeze([
  Object.freeze({
    activityEventType: 'music_queue_match_retrying',
    artistName: 'Fixture Harbor',
    automatic: true,
    id: 'wanted-timeout-fallback',
    initialStatus: AUTOMATIC_RECOVERY_STATUS,
    key: 'timeout_fallback',
    quality: ACCEPTED_QUALITY,
    releaseTitle: 'Beacon After Rain',
    terminalOutcome: 'download_timed_out',
    terminalStatus: DOWNLOADING_STATUS,
  }),
  Object.freeze({
    activityEventType: 'music_queue_match_retrying',
    artistName: 'Fixture Harbor',
    automatic: true,
    id: 'wanted-disappeared-source-fallback',
    initialStatus: AUTOMATIC_RECOVERY_STATUS,
    key: 'disappeared_source_fallback',
    quality: ACCEPTED_QUALITY,
    releaseTitle: 'Tideglass',
    terminalOutcome: 'source_disappeared',
    terminalStatus: DOWNLOADING_STATUS,
  }),
  Object.freeze({
    activityEventType: 'music_queue_quality_blocked',
    artistName: 'Fixture Harbor',
    automatic: false,
    id: 'wanted-strict-quality-stop',
    initialStatus: QUALITY_STOP_STATUS,
    key: 'strict_quality_exhaustion',
    quality: NEEDS_VERIFICATION_QUALITY,
    releaseTitle: 'Clear Signal',
    terminalOutcome: 'quality_failed',
    terminalStatus: QUALITY_STOP_STATUS,
  }),
  Object.freeze({
    activityEventType: 'music_queue_import_blocked',
    artistName: 'Fixture Harbor',
    automatic: false,
    id: 'wanted-library-collision-stop',
    initialStatus: IMPORT_STOP_STATUS,
    key: 'collision_stop',
    quality: ACCEPTED_QUALITY,
    releaseTitle: 'Northbound',
    terminalOutcome: 'import_blocked',
    terminalStatus: IMPORT_STOP_STATUS,
  }),
]);

function cloneQuality(quality) {
  return {
    ...quality,
    profile: { ...quality.profile },
  };
}

function cloneStatus(status) {
  return {
    ...status,
    repair: status.repair ? { ...status.repair } : null,
  };
}

function buildRelease({ scenario, status }) {
  return {
    artistName: scenario.artistName,
    expectedTrackCount: 10,
    id: scenario.id,
    matchedTrackCount: 0,
    missingTrackCount: 10,
    quality: cloneQuality(scenario.quality),
    releaseGroupType: 'Album',
    releaseTitle: scenario.releaseTitle,
    status: cloneStatus(status),
  };
}

function buildActivityExtraPayload(scenario) {
  const payload = {
    terminalOutcome: scenario.terminalOutcome,
    wantedReleaseId: scenario.id,
  };

  if (scenario.activityEventType === 'music_queue_quality_blocked') {
    payload.message = 'A downloaded match did not pass verified lossless checks, and no other safe match is available.';
  }

  if (scenario.activityEventType === 'music_queue_import_blocked') {
    payload.addBlockerCode = 'library_collision';
  }

  return payload;
}

export function buildMusicQueueTerminalRecoveryPayload({ scenario, stage = 'initial' }) {
  const status = stage === 'terminal' ? scenario.terminalStatus : scenario.initialStatus;

  return {
    checkedAt: '2026-07-30T15:00:00.000Z',
    pagination: { limit: 100, offset: 0, total: 1 },
    releases: [buildRelease({ scenario, status })],
    summary: { counts: { [status.code]: 1 }, total: 1 },
  };
}

export function buildMusicQueueTerminalRecoveryActivityPayload(scenario) {
  return {
    checkedAt: '2026-07-30T15:00:00.000Z',
    events: [{
      entityArtist: scenario.artistName,
      entityId: scenario.id,
      entityTitle: scenario.releaseTitle,
      entityType: 'wanted_release',
      eventType: scenario.activityEventType,
      extraPayload: buildActivityExtraPayload(scenario),
      id: `terminal-recovery-${scenario.key}`,
      occurredAt: '2026-07-30T14:59:00.000Z',
    }],
    ok: true,
    total: 1,
  };
}

/**
 * Installs only the read models that make terminal-recovery presentation
 * deterministic. The application, authenticated session, and provider-health
 * readiness remain real for each browser scenario.
 *
 * @param {import('playwright').BrowserContext} browserContext
 * @param {typeof MUSIC_QUEUE_TERMINAL_RECOVERY_CASES[number]} scenario
 * @returns {Promise<{getReleaseReadCount: () => number}>}
 */
export async function installMusicQueueTerminalRecoveryReadModelFixtures(browserContext, scenario) {
  let releaseReadCount = 0;
  const listPath = '/api/v1/acquisition/releases';
  const releasePath = `${listPath}/${encodeURIComponent(scenario.id)}`;

  function getListStage() {
    return scenario.automatic && releaseReadCount > 0 ? 'terminal' : 'initial';
  }

  function getReleaseStage() {
    return scenario.automatic && releaseReadCount > 1 ? 'terminal' : 'initial';
  }

  await browserContext.route(/\/api\/v1\/acquisition\/releases(?:\/[^/?]+)?(?:\?.*)?$/, async (route) => {
    const requestUrl = new URL(route.request().url());
    const stage = requestUrl.pathname === releasePath ? getReleaseStage() : getListStage();

    if (requestUrl.pathname === listPath) {
      releaseReadCount += 1;
    }

    const payload = buildMusicQueueTerminalRecoveryPayload({ scenario, stage });
    await route.fulfill({
      body: JSON.stringify(requestUrl.pathname === releasePath
        ? { checkedAt: payload.checkedAt, release: payload.releases[0] }
        : payload),
      contentType: 'application/json',
    });
  });

  await browserContext.route(/\/api\/v1\/activity\/feed(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      body: JSON.stringify(buildMusicQueueTerminalRecoveryActivityPayload(scenario)),
      contentType: 'application/json',
    });
  });

  return {
    getReleaseReadCount: () => releaseReadCount,
  };
}
