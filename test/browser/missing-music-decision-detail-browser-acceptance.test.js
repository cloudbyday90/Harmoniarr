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

import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  createBrowserSmokeRuntime,
  isSkippableBrowserRuntimeError,
  toBrowserRuntimeUnavailableReason,
} from '../../testing/browser/playwright-smoke-runtime.js';
import {
  buildLinkedDownloaderQueueFixture,
  installDownloaderBrowserFixtures,
} from '../../testing/browser/downloader-browser-fixtures.js';
import {
  assertFocusWithin,
  assertLocatorFocused,
  assertTabFocusContained,
  assertVisibleFocusOutline,
} from '../../testing/browser/keyboard-accessibility-helpers.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { deriveMusicQueueStatus } from '../../src/server/acquisition/acquisition-pipeline-status-service.js';
import { installMetadataBrowserFixtures, seedMetadataImportReviewWorkspace } from '../../testing/browser/metadata-browser-fixtures.js';
import { buildImportReviewCandidate, buildImportReviewExecutionRun, buildImportReviewRunSummary, openImportReviewRunHistory } from '../../testing/browser/import-review-browser-helpers.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();

function buildRecoveryStatus(phase) {
  if (!phase) return null;
  const status = deriveMusicQueueStatus({
    release: { wantedStatus: 'missing', missingTrackCount: 10 },
    match: {
      statusCounts: { failed: 1, pending: 2 }, pendingCount: 2, totalCount: 3,
      executionStatusCounts: { pending: 1, queued: 1 }, confirmedTransferCount: 2,
      currentConfirmedTransferCount: phase === 'confirmed' ? 1 : 0,
      currentDownloadHandoff: ['handoff_unknown', 'handoff_partial'].includes(phase) ? { confirmationPending: true, disposition: phase === 'handoff_partial' ? 'partial' : 'unknown' } : null,
      recoveryExecution: { status: ['pending', 'running'].includes(phase) ? phase : null,
        candidateMatches: phase !== 'stopped', authorityReserved: ['pending', 'running'].includes(phase), reservationRetained: phase === 'review' },
    },
    search: phase.startsWith('rediscovery_') ? { status: 'cooldown', nextSearchAfter: '2030-10-08T00:00:00Z', searchAttemptCount: 3,
      recoveryDiscovery: { status: phase === 'rediscovery_pending' ? 'pending' : phase === 'rediscovery_running' ? 'running' : null, reservationRetained: true } }
      : { status: 'blocked', blockedReason: 'download_recovery_exhausted', searchAttemptCount: 3 },
  });
  return { code: status.code, label: status.label, message: status.message, nextAction: status.nextAction, tone: status.tone };
}

function buildDecision({ accountStatus = 'active', downloadStarted = false, preparedDownload = false, addAvailable = true, libraryRecoveryReason = null, libraryAddQueued = false, recheckAvailable = true, matchSelected = false, qualityChoiceCode = null, recoveryPhase = null, searchInitial = false, findMatchesAvailable = searchInitial, searchQueued = false, searchStopped = false } = {}) {
  const recoveryStatus = buildRecoveryStatus(recoveryPhase);
  return {
    ...(recoveryPhase ? { state: ['trying_next_match', 'searching', 'retrying_search'].includes(recoveryStatus.code) ? 'searching' : recoveryStatus.code === 'downloading' ? 'downloading' : 'action' } : {}),
    ...(preparedDownload ? { state: libraryAddQueued ? 'downloading' : addAvailable && accountStatus !== 'disabled' ? 'action' : 'ready' } : {}),
    decisionId: 'wanted-amber',
    expectedTrackCount: 10,
    lastReconciledAt: '2026-08-26T16:00:00.000Z',
    matchedTrackCount: 0,
    release: {
      artistName: 'Autechre',
      releaseDate: '1994-11-07',
      releaseGroupType: 'Album',
      title: 'Amber',
    },
    requestedFor: {
      accountStatus,
      id: 'listener-1',
      username: 'Jamie',
    },
    status: recoveryStatus ?? (libraryAddQueued
      ? { code: 'adding_to_library', label: 'Adding to library', message: 'Harmoniarr has queued a safe library add and will check the files again before changing the library.', nextAction: null, tone: 'info' }
      : preparedDownload
      ? { code: 'ready_to_add', label: 'Ready to add', message: addAvailable && accountStatus !== 'disabled'
        ? 'A completed download is available. Harmoniarr will check its audio and file plan before adding it.' : 'Files are ready to be added to the library.',
        nextAction: addAvailable && accountStatus !== 'disabled' ? 'add_to_library' : null, tone: 'success' }
      : libraryRecoveryReason
      ? { code: 'needs_help_adding', label: 'Needs help', message: 'This release needs a safe decision before Harmoniarr can add it to your library.',
        nextAction: !recheckAvailable || accountStatus === 'disabled' ? null : libraryRecoveryReason === 'source_path_unavailable' ? 'set_up_folders' : 'recheck_library_add', tone: 'warning' }
      : searchInitial
      ? { code: 'queued_for_search', label: 'Queued for search', message: 'This release is waiting for the next search pass.',
        nextAction: !searchQueued && findMatchesAvailable && accountStatus !== 'disabled' ? 'search_now' : null, tone: 'neutral' }
      : searchQueued
      ? { code: 'searching', label: 'Search queued', message: 'Harmoniarr will evaluate this release again.', nextAction: null, tone: 'info' }
      : qualityChoiceCode
      ? { code: 'quality_choice_needed', label: 'Quality choice needed', message: 'The best match does not clearly satisfy the selected quality preference.', nextAction: 'review_quality_choice', tone: 'warning' }
      : searchStopped
      ? { code: 'no_matches_left', label: 'Search stopped', message: 'No acceptable matches remain.', nextAction: 'try_again', tone: 'warning' }
      : downloadStarted
      ? {
        label: 'Download preparation started',
        message: 'The selected match is queued for download preparation.',
        nextAction: 'open_downloader',
        tone: 'info',
      }
      : matchSelected
      ? {
        label: 'Match selected',
        message: 'A match has been selected. A download will not start until someone explicitly starts it.',
        nextAction: 'download_now',
        tone: 'warning',
      }
      : {
        label: 'Choose a match',
        message: 'Harmoniarr found options that need a selection.',
        nextAction: 'review_matches',
        tone: 'warning',
      }),
  };
}

function buildWorklistPayload() {
  return {
    checkedAt: '2026-08-26T16:30:00.000Z',
    decisions: [buildDecision()],
    filters: {
      accountStatus: 'active',
      q: '',
      requestedForUserId: '',
      state: 'action',
    },
    page: {
      limit: 50,
      offset: 0,
      sourceLimitReached: false,
      total: 1,
    },
    scope: 'all',
    users: [
      { accountStatus: 'active', id: 'listener-1', username: 'Jamie' },
    ],
  };
}

async function installMissingMusicFixture(browserContext, requests, {
  accountStatus = 'active',
  downloadStarted = false,
  preparedDownload = false,
  automaticLibraryAddQueued = false,
  libraryRecoveryReason = null,
  matchSelected = false,
  minimumBitrateKbps = null,
  qualityChoiceCode = null,
  recoveryPhase = null,
  searchInitial = false,
  searchStopped = false,
} = {}) {
  const state = {
    downloadStartRequest: null,
    downloadStarted,
    preparedDownload,
    automaticLibraryAddQueued,
    addAvailable: preparedDownload,
    addOutcome: 'queued',
    addFailure: false,
    addRequest: null,
    addRequestCount: 0,
    addResponseWait: null,
    libraryRecoveryReason,
    libraryAddQueued: automaticLibraryAddQueued,
    recheckAvailable: ['source_path_unavailable', 'audio_check_failed'].includes(libraryRecoveryReason),
    repairFoldersAvailable: libraryRecoveryReason === 'source_path_unavailable',
    recheckOutcome: 'queued',
    recheckFailure: false,
    recheckRequest: null,
    recheckRequestCount: 0,
    recheckResponseWait: null,
    matchSelected,
    minimumBitrateKbps,
    selectionRequest: null,
    accountStatus,
    detailReadFailure: false,
    detailResponseWait: null,
    searchInitial,
    findMatchesAvailable: searchInitial,
    findMatchesFailure: false,
    findMatchesRequest: null,
    findMatchesRequestCount: 0,
    findResponseWait: null,
    searchAgainAvailable: searchStopped || Boolean(qualityChoiceCode),
    searchAgainFailure: false,
    searchAgainRequest: null,
    searchAgainRequestCount: 0,
    searchQueued: false,
    searchStopped,
    qualityChoiceCode,
    recoveryPhase,
    qualityFallbackAvailable: qualityChoiceCode === 'below_minimum',
    qualityFallbackAllowed: false,
    qualityFallbackFailure: false,
    qualityFallbackRequest: null,
    qualityFallbackRequestCount: 0,
    qualityResponseWait: null,
    downloadReviewAvailable: false,
  };

  await browserContext.route('**/api/v1/missing-music/decisions**', async (route) => {
    const requestUrl = new URL(route.request().url());
    requests.push(requestUrl.pathname);
    const detailPath = '/api/v1/missing-music/decisions/wanted-amber';
    const selectionPath = `${detailPath}/matches/candidate-amber/select`;
    const downloadStartPath = `${detailPath}/start-download`;
    const downloaderHandoffPath = `${detailPath}/downloader-handoff`;
    const searchAgainPath = `${detailPath}/search-again`;
    const findMatchesPath = `${detailPath}/find-matches`;
    const qualityFallbackPath = `${detailPath}/allow-fallback-quality`;
    const recheckPath = `${detailPath}/recheck-library-add`;
    const addPath = `${detailPath}/add-to-library`;
    if (route.request().method() === 'GET' && requestUrl.pathname === `${detailPath}/download-review-handoff`) {
      await route.fulfill({ status: state.downloadReviewAvailable ? 200 : 403, contentType: 'application/json',
        body: JSON.stringify(state.downloadReviewAvailable ? { ok: true, decisionId: 'wanted-amber', operationRunId: 'run-amber', importCandidateId: 'candidate-amber',
          release: { artistName: 'Autechre', title: 'Amber' }, requestedFor: { username: 'Jamie' } }
          : { ok: false, error: { code: 'admin_required' } }) }); return;
    }
    if (route.request().method() === 'POST' && requestUrl.pathname === addPath) {
      const headers = route.request().headers();
      state.addRequest = { body: route.request().postDataJSON(), csrfToken: headers['x-csrf-token'] ?? null, idempotencyKey: headers['idempotency-key'] ?? null };
      state.addRequestCount += 1;
      if (state.addResponseWait) await state.addResponseWait;
      if (state.addFailure) {
        await route.fulfill({ status: state.addFailure, contentType: 'application/json', body: JSON.stringify({ ok: false, error: { code: 'private_add_error', message: 'Private /mnt/download path and probe details' } }) });
        return;
      }
      if (['queued', 'already_queued'].includes(state.addOutcome)) { state.libraryAddQueued = true; state.addAvailable = false; }
      if (state.addOutcome === 'not_available') state.addAvailable = false;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true,
        action: { code: 'add_to_library', decisionId: 'wanted-amber', targetUserId: 'listener-1', outcome: state.addOutcome, runId: state.libraryAddQueued ? 'run-add' : null },
      }) });
      return;
    }

    if (route.request().method() === 'POST' && requestUrl.pathname === recheckPath) {
      const headers = route.request().headers();
      state.recheckRequestCount += 1;
      state.recheckRequest = { body: route.request().postDataJSON(), csrfToken: headers['x-csrf-token'] ?? null, idempotencyKey: headers['idempotency-key'] ?? null };
      if (state.recheckResponseWait) await state.recheckResponseWait;
      if (state.recheckFailure) {
        await route.fulfill({ status: Number(state.recheckFailure), contentType: 'application/json',
          body: JSON.stringify({ ok: false, error: { code: 'unexpected_error', message: 'Private candidate /mnt/library probe output' } }) });
        return;
      }
      if (['queued', 'already_queued'].includes(state.recheckOutcome)) { state.libraryAddQueued = true; state.recheckAvailable = false; }
      if (state.recheckOutcome === 'not_available') state.recheckAvailable = false;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true,
        action: { code: 'recheck_library_add', decisionId: 'wanted-amber', targetUserId: 'listener-1', outcome: state.recheckOutcome, runId: state.libraryAddQueued ? 'run-add' : null },
      }) });
      return;
    }

    if (route.request().method() === 'POST' && requestUrl.pathname === findMatchesPath) {
      const headers = route.request().headers();
      state.findMatchesRequestCount += 1;
      state.findMatchesRequest = {
        body: route.request().postDataJSON(), csrfToken: headers['x-csrf-token'] ?? null,
        idempotencyKey: headers['idempotency-key'] ?? null,
      };
      if (state.findResponseWait) await state.findResponseWait;
      if (state.findMatchesFailure) {
        await route.fulfill({ status: Number(state.findMatchesFailure), contentType: 'application/json',
          body: JSON.stringify({ ok: false, error: { code: 'unexpected_error', message: 'Private provider /mnt/downloads source identity' } }) });
        return;
      }
      state.searchQueued = true;
      state.findMatchesAvailable = false;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true,
        action: { code: 'find_matches', decisionId: 'wanted-amber', targetUserId: 'listener-1',
          searchPreparationStarted: true, searchAlreadyQueued: true, intentAlreadyRecorded: false,
          dispatchAlreadyActive: false, discoveryRunId: 'run-find' },
      }) });
      return;
    }

    if (route.request().method() === 'POST' && requestUrl.pathname === qualityFallbackPath) {
      const headers = route.request().headers();
      state.qualityFallbackRequestCount += 1;
      state.qualityFallbackRequest = {
        body: route.request().postDataJSON(),
        csrfToken: headers['x-csrf-token'] ?? null,
        idempotencyKey: headers['idempotency-key'] ?? null,
      };
      if (state.qualityResponseWait) await state.qualityResponseWait;
      if (state.qualityFallbackFailure) {
        await route.fulfill({ status: 500, contentType: 'application/json',
          body: JSON.stringify({ ok: false, error: { code: 'unexpected_error', message: 'Private provider /mnt/downloads source identity' } }) });
        return;
      }
      state.qualityFallbackAllowed = true;
      state.qualityFallbackAvailable = false;
      state.searchQueued = true;
      state.searchAgainAvailable = false;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true,
        action: { code: 'allow_fallback_quality', decisionId: 'wanted-amber', targetUserId: 'listener-1',
          fallbackAllowed: true, searchPreparationStarted: true, overrideAlreadyAllowed: false,
          restartAlreadyQueued: false, dispatchAlreadyActive: false, discoveryRunId: 'run-quality' },
      }) });
      return;
    }

    if (route.request().method() === 'POST' && requestUrl.pathname === searchAgainPath) {
      const headers = route.request().headers();
      state.searchAgainRequestCount += 1;
      state.searchAgainRequest = {
        body: route.request().postDataJSON(),
        csrfToken: headers['x-csrf-token'] ?? null,
        idempotencyKey: headers['idempotency-key'] ?? null,
      };
      if (state.searchAgainFailure) {
        await route.fulfill({ status: 500, contentType: 'application/json',
          body: JSON.stringify({ ok: false, error: { code: 'unexpected_error', message: 'Private provider /mnt/downloads source identity' } }) });
        return;
      }
      state.searchQueued = true;
      state.searchAgainAvailable = false;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true,
        action: { code: 'search_again', decisionId: 'wanted-amber', targetUserId: 'listener-1',
          searchPreparationStarted: true, restartAlreadyQueued: false, dispatchAlreadyActive: false, discoveryRunId: 'run-search' },
      }) });
      return;
    }

    if (route.request().method() === 'GET' && requestUrl.pathname === detailPath && state.detailResponseWait) await state.detailResponseWait;

    if (route.request().method() === 'GET' && requestUrl.pathname === detailPath && state.detailReadFailure) {
      await route.fulfill({ status: 503, contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: { code: 'unexpected_error', message: 'Private database host' } }) });
      return;
    }

    if (route.request().method() === 'GET' && requestUrl.pathname === downloaderHandoffPath) {
      await route.fulfill({
        body: JSON.stringify({
          decisionId: 'wanted-amber',
          ok: true,
          release: { artistName: 'Autechre', title: 'Amber' },
          requestedFor: { username: 'Jamie' },
          wantedReleaseId: 'wanted-amber',
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (route.request().method() === 'POST' && requestUrl.pathname === selectionPath) {
      const headers = route.request().headers();
      state.selectionRequest = {
        body: route.request().postDataJSON(),
        csrfToken: headers['x-csrf-token'] ?? null,
        idempotencyKey: headers['idempotency-key'] ?? null,
      };
      state.matchSelected = true;
      await route.fulfill({
        body: JSON.stringify({
          action: {
            code: 'use_match',
            decisionId: 'wanted-amber',
            downloadStarted: false,
            matchId: 'candidate-amber',
            targetUserId: 'listener-1',
          },
          ok: true,
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (route.request().method() === 'POST' && requestUrl.pathname === downloadStartPath) {
      const headers = route.request().headers();
      state.downloadStartRequest = {
        body: route.request().postDataJSON(),
        csrfToken: headers['x-csrf-token'] ?? null,
        idempotencyKey: headers['idempotency-key'] ?? null,
      };
      state.downloadStarted = true;
      await route.fulfill({
        body: JSON.stringify({
          action: {
            code: 'start_download',
            decisionId: 'wanted-amber',
            downloadPreparationStarted: true,
            matchId: 'candidate-amber',
            operationRunId: 'run-amber',
            targetUserId: 'listener-1',
          },
          ok: true,
        }),
        contentType: 'application/json',
        status: 202,
      });
      return;
    }

    const payload = requestUrl.pathname === detailPath
      ? {
        checkedAt: '2026-08-26T16:31:00.000Z',
        decision: buildDecision({
          accountStatus: state.accountStatus,
          downloadStarted: state.downloadStarted,
          preparedDownload: state.preparedDownload,
          addAvailable: state.addAvailable,
          libraryRecoveryReason: state.libraryRecoveryReason,
          libraryAddQueued: state.libraryAddQueued,
          recheckAvailable: state.recheckAvailable,
          matchSelected: state.matchSelected,
          qualityChoiceCode: state.qualityChoiceCode,
          recoveryPhase: state.recoveryPhase,
          searchInitial: state.searchInitial,
          findMatchesAvailable: state.findMatchesAvailable,
          searchQueued: state.searchQueued,
          searchStopped: state.searchStopped,
        }),
        matchChoices: state.preparedDownload || state.matchSelected || state.searchStopped || state.qualityChoiceCode || state.recoveryPhase || state.searchInitial || state.libraryRecoveryReason
          ? []
          : [{
            fileCount: 10,
            formats: ['FLAC'],
            id: 'candidate-amber',
            totalSizeBytes: 358000000,
          }],
        permissions: {
          canAddToLibrary: state.addAvailable && !state.libraryAddQueued && state.accountStatus !== 'disabled',
          canAllowFallbackQuality: state.qualityFallbackAvailable && state.accountStatus !== 'disabled',
          canFindMatches: state.findMatchesAvailable && state.accountStatus !== 'disabled',
          canRecheckLibraryAdd: state.recheckAvailable && !state.libraryAddQueued && state.accountStatus !== 'disabled',
          canRepairFolders: state.repairFoldersAvailable && !state.libraryAddQueued && state.accountStatus !== 'disabled',
          canReviewDownloadHandoff: state.downloadReviewAvailable && state.accountStatus !== 'disabled',
          canSelectMatch: !state.matchSelected && !state.searchStopped && !state.qualityChoiceCode && !state.recoveryPhase && !state.searchInitial && !state.libraryRecoveryReason,
          canSearchAgain: (state.recoveryPhase ? state.recoveryPhase === 'stopped' : state.searchAgainAvailable) && state.accountStatus !== 'disabled',
          canStartDownload: state.accountStatus !== 'disabled' && (state.recoveryPhase ? buildRecoveryStatus(state.recoveryPhase).nextAction === 'download_now' : state.matchSelected && !state.downloadStarted),
          canViewDownloader: state.recoveryPhase ? buildRecoveryStatus(state.recoveryPhase).nextAction === 'open_downloader' : state.downloadStarted,
          isReadOnly: state.accountStatus === 'disabled',
        },
        qualityEvidence: state.qualityChoiceCode ? {
          code: state.searchQueued ? 'no_evidence' : state.qualityChoiceCode,
          profileCode: 'lossless_archive',
          formats: state.qualityChoiceCode === 'needs_verification' ? ['flac'] : ['mp3'],
          bitrateKbps: state.qualityChoiceCode === 'needs_verification' ? null : 128,
          preferredFormats: ['flac'],
          minimumFormats: state.qualityFallbackAllowed ? ['flac', 'alac', 'wav', 'mp3', 'aac', 'opus', 'ogg'] : ['flac', 'alac', 'wav'],
          minimumBitrateKbps: state.minimumBitrateKbps ?? (state.qualityFallbackAllowed ? 256 : null),
          requiresVerification: true,
          verifiedLossless: false,
          fallbackAllowed: state.qualityFallbackAllowed,
          fallbackOverrideActive: state.qualityFallbackAllowed,
        } : null,
        libraryAddRecovery: { reasonCode: state.libraryRecoveryReason, queued: state.libraryAddQueued && !state.automaticLibraryAddQueued,
          runId: state.libraryAddQueued && !state.automaticLibraryAddQueued ? 'run-add' : null },
        scope: 'all',
      }
      : { ...buildWorklistPayload(),
        filters: { ...buildWorklistPayload().filters, state: requestUrl.searchParams.get('state') ?? 'action' },
        decisions: ((state.searchInitial && state.searchQueued) || (state.recoveryPhase && !['stopped', 'review', 'rediscovery_uncertain', 'handoff_unknown', 'handoff_partial'].includes(state.recoveryPhase)) || (state.preparedDownload && (state.libraryAddQueued || !state.addAvailable))) && requestUrl.searchParams.get('state') === 'action' ? [] : [buildDecision(state)],
        page: { ...buildWorklistPayload().page, total: ((state.searchInitial && state.searchQueued) || (state.recoveryPhase && !['stopped', 'review', 'rediscovery_uncertain', 'handoff_unknown', 'handoff_partial'].includes(state.recoveryPhase)) || (state.preparedDownload && (state.libraryAddQueued || !state.addAvailable))) && requestUrl.searchParams.get('state') === 'action' ? 0 : 1 },
      };

    await route.fulfill({
      body: JSON.stringify({ ok: true, ...payload }),
      contentType: 'application/json',
      status: 200,
    });
  });

  return state;
}

function buildAmberDownloaderQueue() {
  const defaultQueue = buildLinkedDownloaderQueueFixture();
  const amberTransfer = {
    ...defaultQueue.transfers[0],
    diagnostics: {
      ...defaultQueue.transfers[0].diagnostics,
      importLinkage: {
        ...defaultQueue.transfers[0].diagnostics.importLinkage,
        musicQueueRelease: {
          ...defaultQueue.transfers[0].diagnostics.importLinkage.musicQueueRelease,
          wantedReleaseId: 'wanted-amber',
        },
      },
    },
  };

  return buildLinkedDownloaderQueueFixture({ transfers: [amberTransfer] });
}

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Missing Music decision detail browser acceptance', () => {
  before(async () => {
    try {
      browserRuntime = await createBrowserSmokeRuntime({ config: integrationRuntimeConfig });
      runtimeUnavailableReason = null;
    } catch (error) {
      if (!isSkippableBrowserRuntimeError(error)) {
        throw error;
      }

      runtimeUnavailableReason = toBrowserRuntimeUnavailableReason(error);
    }
  }, { timeout: integrationRuntimeConfig.suiteSetupTimeoutMs });

  after(async () => {
    await browserRuntime?.cleanup();
  }, { timeout: integrationRuntimeConfig.suiteTeardownTimeoutMs });

  test('opens a server-authorized release-status detail with a clear return path', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const requests = [];
      await installMissingMusicFixture(browserContext, requests);
      await bootstrapAdminThroughUi(page, { baseUrl });

      await page.goto(baseUrl + '/app/missing', { waitUntil: 'domcontentloaded' });
      const detailLink = page.getByRole('link', { name: 'Open status details for Autechre — Amber' });
      await detailLink.focus();
      await assertLocatorFocused(detailLink, 'the release-details link should receive keyboard focus');
      await assertVisibleFocusOutline(detailLink, 'the release-details link focus indicator should be visible');
      await detailLink.click();

      const heading = page.getByRole('heading', { exact: true, level: 2, name: 'Amber' });
      await heading.waitFor();
      assert.equal(new URL(page.url()).pathname, '/app/missing/wanted-amber');
      await assertLocatorFocused(heading, 'opening release details should focus the inspector title');
      await assertVisibleFocusOutline(heading, 'the inspector title focus indicator should be visible');
      const inspector = page.locator('.missing-music-inspector');
      await inspector.getByRole('heading', { exact: true, level: 3, name: 'Current status' }).waitFor();
      await inspector.getByText('Jamie', { exact: true }).waitFor();
      await inspector.getByText('Next step:', { exact: false }).waitFor();
      assert.ok(requests.includes('/api/v1/missing-music/decisions/wanted-amber'));

      await page.getByRole('link', { name: 'Back to release decisions' }).click();
      const pageHeading = page.getByRole('heading', { exact: true, level: 1, name: 'Missing Music' });
      await pageHeading.waitFor();
      assert.equal(new URL(page.url()).pathname, '/app/missing');
      await assertLocatorFocused(pageHeading, 'returning to release decisions should focus the Missing Music page title');
      await assertVisibleFocusOutline(pageHeading, 'the Missing Music page title focus indicator should be visible');
    }, {
      scenarioName: 'missing_music_decision_detail_navigation',
    });
  });

  test('queues Search again, refreshes both decision surfaces, and retains the snapshot on safe refresh failure', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) { t.skip(runtimeUnavailableReason); return; }
    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const requests = [];
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await bootstrapAdminThroughUi(page, { baseUrl });
      const fixture = await installMissingMusicFixture(browserContext, requests, { searchStopped: true });
      await page.goto(baseUrl + '/app/missing/wanted-amber', { waitUntil: 'domcontentloaded' });
      const inspector = page.locator('.missing-music-inspector');
      const searchButton = inspector.getByRole('button', { exact: true, name: 'Search again' });
      await searchButton.focus();
      await assertVisibleFocusOutline(searchButton, 'Search again should expose its keyboard focus');
      await searchButton.press('Enter');
      await inspector.getByText('Search queued', { exact: true }).waitFor();
      await inspector.getByText('A new search is queued. Acquisition will follow the saved automation policy.', { exact: true }).waitFor();
      await assertLocatorFocused(inspector.getByRole('heading', { exact: true, name: 'Current status' }), 'the completed command should focus the updated state');
      assert.equal(fixture.searchAgainRequestCount, 1);
      assert.deepEqual(fixture.searchAgainRequest.body, {});
      assert.match(fixture.searchAgainRequest.csrfToken, /.+/u);
      assert.match(fixture.searchAgainRequest.idempotencyKey, /.+/u);
      assert.equal(fixture.downloadStartRequest, null);
      assert.equal(fixture.selectionRequest, null);

      const detailPath = '/api/v1/missing-music/decisions/wanted-amber';
      const worklistPath = '/api/v1/missing-music/decisions';
      const detailCount = requests.filter((path) => path === detailPath).length;
      const worklistCount = requests.filter((path) => path === worklistPath).length;
      const pageRefresh = page.locator('.hx-page-header').getByRole('button', { exact: true, name: 'Refresh' });
      await Promise.all([
        page.waitForResponse((response) => new URL(response.url()).pathname === detailPath),
        page.waitForResponse((response) => new URL(response.url()).pathname === worklistPath),
        pageRefresh.click(),
      ]);
      await pageRefresh.waitFor();
      assert.equal(requests.filter((path) => path === detailPath).length, detailCount + 1);
      assert.equal(requests.filter((path) => path === worklistPath).length, worklistCount + 1);
      await assertLocatorFocused(pageRefresh, 'Refresh should retain its invoker focus');

      const filterInput = page.getByLabel('Search releases', { exact: true });
      await filterInput.focus();
      fixture.detailReadFailure = true;
      await Promise.all([
        page.waitForResponse((response) => new URL(response.url()).pathname === detailPath && response.status() === 503),
        page.evaluate(() => globalThis.window.dispatchEvent(new Event('focus'))),
      ]);
      await inspector.getByRole('alert').getByText('Missing Music release details could not be refreshed. Try again.', { exact: true }).waitFor();
      await inspector.getByText('Search queued', { exact: true }).waitFor();
      await assertLocatorFocused(filterInput, 'a failed background refresh should retain keyboard focus');
      assert.doesNotMatch(await inspector.innerText(), /Private database|Private provider|\/mnt/u);
      assert.deepEqual(pageErrors, []);
    }, { scenarioName: 'missing_music_search_again_and_freshness' });
  });

  test('Find matches is reachable from the default worklist, announces pending outside busy state, and refreshes progress by keyboard', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) { t.skip(runtimeUnavailableReason); return; }
    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const requests = [];
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await bootstrapAdminThroughUi(page, { baseUrl });
      const fixture = await installMissingMusicFixture(browserContext, requests, { searchInitial: true });
      await page.goto(baseUrl + '/app/missing', { waitUntil: 'domcontentloaded' });
      const worklist = page.locator('.missing-music-worklist');
      await worklist.getByText('Next step: Find matches', { exact: true }).waitFor();
      await worklist.getByRole('link', { name: 'Open status details for Autechre — Amber' }).click();
      const inspector = page.locator('.missing-music-inspector');
      const find = inspector.getByRole('button', { name: 'Find matches', exact: true });
      await find.waitFor();
      await inspector.getByText('Request matches for this release for Jamie. Acquisition will follow the saved automation policy.', { exact: true }).waitFor();
      assert.equal(await find.getAttribute('type'), 'button');
      assert.equal(await inspector.getByRole('button', { name: 'Search again', exact: true }).count(), 0);
      const statuses = inspector.locator('.hx-missing-command-feedback');
      assert.equal(await statuses.count(), 7);
      assert.equal(await statuses.first().getAttribute('role'), 'status');
      assert.equal(await statuses.first().getAttribute('aria-atomic'), 'true');
      assert.equal(await statuses.first().innerText(), '');
      const statusNode = await statuses.first().elementHandle();

      const screenshotDirectory = resolve('.tmp/missing-music-find-matches');
      await mkdir(screenshotDirectory, { recursive: true });
      await page.keyboard.press('Tab');
      for (const width of [390, 800, 1280]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const theme of ['light', 'dark']) {
          await page.evaluate((value) => globalThis.document.documentElement.setAttribute('data-theme', value), theme);
          await inspector.getByRole('region', { name: 'Current status', exact: true }).evaluate((element) => element.scrollIntoView({ block: 'center' }));
          await find.focus();
          await find.scrollIntoViewIfNeeded();
          await assertVisibleFocusOutline(find, 'Find matches should show visible keyboard focus');
          assert.equal(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth), true);
          assert.equal(await inspector.evaluate((element) => element.scrollWidth <= element.clientWidth), true);
          if (width === 390) assert.ok((await find.boundingBox()).height >= 44);
          assert.equal(await find.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            return bounds.top >= 56 && bounds.bottom <= globalThis.innerHeight - (globalThis.innerWidth <= 640 ? 60 : 0);
          }), true, 'the focused action should clear sticky chrome');
          assert.equal(await inspector.getByRole('region', { name: 'Current status', exact: true }).evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            return bounds.top >= 56 && bounds.bottom <= globalThis.innerHeight - (globalThis.innerWidth <= 640 ? 60 : 0);
          }), true, 'the action explanation should clear sticky chrome in visual evidence');
          await inspector.getByRole('region', { name: 'Current status', exact: true }).screenshot({ path: resolve(screenshotDirectory, `find-matches-${width}-${theme}.png`), animations: 'disabled' });
        }
      }
      let finishResponse;
      fixture.findResponseWait = new Promise((resolveResponse) => { finishResponse = resolveResponse; });
      const detailPath = '/api/v1/missing-music/decisions/wanted-amber';
      const worklistPath = '/api/v1/missing-music/decisions';
      const detailCount = requests.filter((path) => path === detailPath).length;
      const worklistCount = requests.filter((path) => path === worklistPath).length;
      await find.focus();
      await find.press('Space');
      await inspector.getByRole('status').getByText('Requesting matches…', { exact: true }).waitFor();
      assert.equal(await inspector.getByRole('button', { name: 'Requesting…', exact: true }).isDisabled(), true);
      assert.equal(await statusNode.evaluate((element) => element.isConnected && !element.closest('[aria-busy="true"]')), true);
      assert.equal(fixture.findMatchesRequestCount, 1);
      assert.deepEqual(fixture.findMatchesRequest.body, {});
      assert.match(fixture.findMatchesRequest.csrfToken, /.+/u);
      assert.match(fixture.findMatchesRequest.idempotencyKey, /^missing-music-decisions-find-matches-/u);
      await Promise.all([
        page.waitForResponse((response) => new URL(response.url()).pathname === detailPath),
        page.waitForResponse((response) => new URL(response.url()).pathname === worklistPath),
        Promise.resolve().then(() => finishResponse()),
      ]);
      await inspector.getByText('Next step: Check this release', { exact: true }).waitFor();
      await inspector.getByText('Queued for search', { exact: true }).waitFor();
      await inspector.getByRole('status').getByText('Find matches requested for this recipient. This release is queued using saved automation.', { exact: true }).waitFor();
      await worklist.getByRole('heading', { name: 'No releases on this page', exact: true }).waitFor();
      await assertLocatorFocused(inspector.getByRole('heading', { name: 'Current status', exact: true }), 'Find completion should move owned focus to the refreshed state');
      assert.equal(await find.count(), 0);
      assert.equal(requests.filter((path) => path === detailPath).length, detailCount + 1);
      assert.equal(requests.filter((path) => path === worklistPath).length, worklistCount + 1);
      assert.equal(await statusNode.evaluate((element) => element.isConnected), true, 'the status container must persist across the command');
      assert.equal(fixture.searchAgainRequestCount, 0);
      assert.equal(fixture.selectionRequest, null);
      assert.equal(fixture.downloadStartRequest, null);
      assert.deepEqual(pageErrors, []);
    }, { scenarioName: 'missing_music_find_matches_keyboard_and_layouts' });
  });

  test('Find matches preserves user-moved focus during success and during background revalidation', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) { t.skip(runtimeUnavailableReason); return; }
    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      const fixture = await installMissingMusicFixture(browserContext, [], { searchInitial: true });
      let finishResponse;
      fixture.findResponseWait = new Promise((resolveResponse) => { finishResponse = resolveResponse; });
      await page.goto(baseUrl + '/app/missing/wanted-amber', { waitUntil: 'domcontentloaded' });
      const inspector = page.locator('.missing-music-inspector');
      const find = inspector.getByRole('button', { name: 'Find matches', exact: true });
      await find.focus();
      await find.press('Enter');
      await inspector.getByRole('status').getByText('Requesting matches…', { exact: true }).waitFor();
      const filter = page.getByLabel('Search releases', { exact: true });
      await filter.focus();
      finishResponse();
      await inspector.getByText('Next step: Check this release', { exact: true }).waitFor();
      await inspector.getByText('Queued for search', { exact: true }).waitFor();
      await assertLocatorFocused(filter, 'command completion should respect a user move to a filter');
      await Promise.all([
        page.waitForResponse((response) => new URL(response.url()).pathname === '/api/v1/missing-music/decisions/wanted-amber'),
        page.evaluate(() => globalThis.window.dispatchEvent(new Event('focus'))),
      ]);
      await assertLocatorFocused(filter, 'background revalidation should retain user focus');
    }, { scenarioName: 'missing_music_find_matches_respects_moved_focus' });
  });

  test('Find matches keeps uncertain retry identity, uses safe errors, and hides denied or disabled actions', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) { t.skip(runtimeUnavailableReason); return; }
    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      const fixture = await installMissingMusicFixture(browserContext, [], { searchInitial: true });
      fixture.findMatchesFailure = 500;
      await page.goto(baseUrl + '/app/missing/wanted-amber', { waitUntil: 'domcontentloaded' });
      const inspector = page.locator('.missing-music-inspector');
      const find = inspector.getByRole('button', { name: 'Find matches', exact: true });
      await find.focus();
      await find.press('Enter');
      await inspector.getByRole('alert').getByText('Matches could not be requested. Refresh this release and try again.', { exact: true }).waitFor();
      await assertLocatorFocused(find, 'a failed command should preserve its invoker focus');
      const previousKey = fixture.findMatchesRequest.idempotencyKey;
      await find.press('Space');
      await inspector.getByRole('alert').getByText('Matches could not be requested. Refresh this release and try again.', { exact: true }).waitFor();
      assert.equal(fixture.findMatchesRequest.idempotencyKey, previousKey);
      fixture.findMatchesFailure = 403;
      await find.click();
      await inspector.getByRole('alert').getByText('You cannot change this release. Refresh its status before trying again.', { exact: true }).waitFor();
      assert.doesNotMatch(await inspector.innerText(), /Private|\/mnt/u);
      fixture.findMatchesAvailable = false;
      await page.reload({ waitUntil: 'domcontentloaded' });
      await inspector.getByText('Queued for search', { exact: true }).waitFor();
      assert.equal(await find.count(), 0);
      await inspector.getByText('Next step: Check this release', { exact: true }).waitFor();
      fixture.findMatchesAvailable = true;
      fixture.accountStatus = 'disabled';
      await page.reload({ waitUntil: 'domcontentloaded' });
      await inspector.getByText('This account is disabled. Its history is read-only.', { exact: true }).waitFor();
      assert.equal(await find.count(), 0);
      assert.equal(fixture.findMatchesRequestCount, 3);
    }, { scenarioName: 'missing_music_find_matches_safe_retries' });
  });

  test('Search again failures use public feedback and unsupported or disabled decisions expose no retry button', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) { t.skip(runtimeUnavailableReason); return; }
    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      const fixture = await installMissingMusicFixture(browserContext, [], { searchStopped: true });
      fixture.searchAgainFailure = true;
      await page.goto(baseUrl + '/app/missing/wanted-amber', { waitUntil: 'domcontentloaded' });
      const inspector = page.locator('.missing-music-inspector');
      await inspector.getByRole('button', { exact: true, name: 'Search again' }).click();
      await inspector.getByRole('alert').getByText('The search could not be queued. Refresh this release and try again.', { exact: true }).waitFor();
      assert.doesNotMatch(await inspector.innerText(), /Private|\/mnt/u);
      const previousKey = fixture.searchAgainRequest.idempotencyKey;
      await inspector.getByRole('button', { exact: true, name: 'Search again' }).click();
      assert.equal(fixture.searchAgainRequest.idempotencyKey, previousKey);
      assert.equal(fixture.searchAgainRequestCount, 2);

      fixture.searchAgainAvailable = false;
      await page.reload({ waitUntil: 'domcontentloaded' });
      await inspector.getByText('Search stopped', { exact: true }).waitFor();
      assert.equal(await inspector.getByRole('button', { exact: true, name: 'Search again' }).count(), 0);
      fixture.searchAgainAvailable = true;
      fixture.accountStatus = 'disabled';
      await page.reload({ waitUntil: 'domcontentloaded' });
      await inspector.getByText('This account is disabled. Its history is read-only.', { exact: true }).waitFor();
      assert.equal(await inspector.getByRole('button', { exact: true, name: 'Search again' }).count(), 0);
      assert.equal(fixture.searchAgainRequestCount, 2);
    }, { scenarioName: 'missing_music_search_again_safe_failures' });
  });

  test('fallback recovery exposes only committed preparation or confirmed transfers and returns stopped work to existing actions', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) { t.skip(runtimeUnavailableReason); return; }
    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      const fixture = await installMissingMusicFixture(browserContext, [], { recoveryPhase: 'stopped' });
      await page.goto(baseUrl + '/app/missing/wanted-amber', { waitUntil: 'domcontentloaded' });
      const inspector = page.locator('.missing-music-inspector');
      const status = inspector.locator('.hx-missing-status-snapshot').getByRole('status');
      const worklist = page.locator('.missing-music-worklist');
      await inspector.getByText('No matches left', { exact: true }).waitFor();
      await inspector.getByRole('button', { name: 'Search again', exact: true }).waitFor();
      assert.equal(await inspector.getByRole('button', { name: 'Start download', exact: true }).count(), 0);
      assert.equal(await inspector.getByText('Trying another match', { exact: true }).count(), 0);
      const detailPath = '/api/v1/missing-music/decisions/wanted-amber';
      const worklistPath = '/api/v1/missing-music/decisions';
      await Promise.all([
        page.waitForResponse((response) => new URL(response.url()).pathname === worklistPath && new URL(response.url()).searchParams.get('state') === 'all'),
        page.getByLabel('Work state', { exact: true }).selectOption('all'),
      ]);
      const filter = page.getByLabel('Search releases', { exact: true });
      await filter.focus();
      const main = page.locator('.hx-main');
      await main.evaluate((element) => { element.scrollTop = 0; });
      const privateFacts = /musicQueueRecovery|music_queue_fallback_recovery|recoveryExecution|recoveryDiscovery|legacyRecoverySelection|recoverySelectionNeedsReview|reservationRetained|authorityReserved|candidateMatches|episode|participantPolicies|qualityOverride|sourceSearchId|currentConfirmedTransferCount|currentExecutionStatusCounts|\/private|\/mnt/u;
      const statusNode = await status.elementHandle();
      assert.equal(await status.getAttribute('aria-live'), 'polite');
      assert.equal(await status.getAttribute('aria-atomic'), 'true');
      await statusNode.evaluate((element) => {
        const observation = { changes: 0 };
        observation.observer = new globalThis.MutationObserver((records) => { observation.changes += records.length; });
        observation.observer.observe(element, { childList: true, characterData: true, subtree: true });
        element.recoveryStatusObservation = observation;
      });
      async function refreshVisibleState() {
        const [detailResponse, worklistResponse] = await Promise.all([
          page.waitForResponse((response) => new URL(response.url()).pathname === detailPath),
          page.waitForResponse((response) => new URL(response.url()).pathname === worklistPath),
          page.evaluate(() => globalThis.document.dispatchEvent(new Event('visibilitychange'))),
        ]);
        await inspector.locator('.hx-missing-status-snapshot:not([aria-busy="true"])').waitFor();
        const detail = await detailResponse.json();
        const list = await worklistResponse.json();
        assert.deepEqual(list.decisions[0].status, detail.decision.status);
        assert.doesNotMatch(JSON.stringify({ detail, list }), privateFacts);
        await worklist.getByText(detail.decision.status.label, { exact: true }).waitFor();
        await status.filter({ hasText: detail.decision.status.message }).waitFor();
        await assertLocatorFocused(filter, 'recovery background refresh must preserve the user-selected control');
        assert.equal(await main.evaluate((element) => element.scrollTop), 0);
        return detail;
      }
      await refreshVisibleState();
      assert.equal(await statusNode.evaluate((element) => element.recoveryStatusObservation.changes), 0,
        'the identical stopped snapshot should not rewrite the existing live text');
      fixture.recoveryPhase = 'pending';
      const queued = await refreshVisibleState();
      assert.equal(queued.decision.state, 'searching');
      assert.equal(queued.permissions.canSearchAgain, false);
      assert.equal(queued.permissions.canViewDownloader, false);
      assert.equal(await status.innerText(), 'A previous match did not work. The next eligible match is queued for download preparation.');
      assert.equal(await inspector.getByRole('button', { name: 'Search again', exact: true }).count(), 0);
      const screenshotDirectory = resolve('.tmp/fallback-recovery-2026-10');
      await mkdir(screenshotDirectory, { recursive: true });
      for (const width of [390, 800, 1280]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const theme of ['light', 'dark']) {
          await page.evaluate((value) => globalThis.document.documentElement.setAttribute('data-theme', value), theme);
          const currentStatus = inspector.getByRole('region', { name: 'Current status', exact: true });
          await currentStatus.evaluate((element) => element.scrollIntoView({ block: 'center' }));
          assert.equal(await currentStatus.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            return bounds.top >= 56 && bounds.bottom <= globalThis.innerHeight - (globalThis.innerWidth <= 640 ? 60 : 0);
          }), true);
          assert.equal(await inspector.evaluate((element) => element.scrollWidth <= element.clientWidth), true);
          await currentStatus.screenshot({ path: resolve(screenshotDirectory, `recovery-${width}-${theme}.png`), animations: 'disabled' });
        }
      }
      await filter.focus();
      await main.evaluate((element) => { element.scrollTop = 0; });
      const queuedChanges = await statusNode.evaluate((element) => element.recoveryStatusObservation.changes);
      await refreshVisibleState();
      assert.equal(await statusNode.evaluate((element) => element.recoveryStatusObservation.changes), queuedChanges);
      fixture.recoveryPhase = 'running';
      await refreshVisibleState();
      assert.equal(await status.innerText(), 'Harmoniarr is preparing the next eligible match for download.');
      fixture.recoveryPhase = 'confirmed';
      const confirmed = await refreshVisibleState();
      assert.equal(confirmed.decision.state, 'downloading');
      assert.equal(confirmed.permissions.canViewDownloader, true);
      await inspector.getByRole('link', { name: 'View Amber downloads for Jamie in Downloader', exact: true }).waitFor();
      assert.equal(await status.innerText(), 'A selected match is downloading.');
      fixture.recoveryPhase = 'review';
      const review = await refreshVisibleState();
      assert.equal(review.decision.state, 'action');
      assert.equal(review.permissions.canSearchAgain, false);
      assert.equal(await status.innerText(), 'Automatic recovery needs review before another download can start.');
      assert.equal(await inspector.getByRole('button', { name: 'Start download', exact: true }).count(), 0);
      for (const [phase, code] of [['rediscovery_pending', 'retrying_search'], ['rediscovery_running', 'searching'], ['rediscovery_uncertain', 'needs_help_adding']]) {
        fixture.recoveryPhase = phase;
        const discovery = await refreshVisibleState();
        assert.equal(discovery.decision.status.code, code);
        assert.equal(discovery.permissions.canSearchAgain, false);
        if (phase === 'rediscovery_uncertain') assert.equal(await status.innerText(), 'Automatic recovery needs review before another search can start.');
      }
      fixture.recoveryPhase = 'stopped';
      const stopped = await refreshVisibleState();
      assert.equal(stopped.decision.state, 'action');
      assert.equal(stopped.permissions.canSearchAgain, true);
      await inspector.getByRole('button', { name: 'Search again', exact: true }).waitFor();
      assert.equal(await inspector.getByRole('link', { name: 'View Amber downloads for Jamie in Downloader', exact: true }).count(), 0);
      assert.equal(await statusNode.evaluate((element) => element.isConnected), true);
      assert.doesNotMatch(await inspector.innerText(), privateFacts);
      assert.equal(fixture.searchAgainRequestCount + fixture.findMatchesRequestCount + fixture.addRequestCount + fixture.recheckRequestCount, 0);
      assert.equal(fixture.downloadStartRequest, null);
      assert.equal(fixture.selectionRequest, null);
      await statusNode.evaluate((element) => element.recoveryStatusObservation.observer.disconnect());
    }, { scenarioName: 'missing_music_fallback_recovery_truth' });
  });

  test('admin unresolved status opens the exact server-resolved diagnostic review while normal detail omits private review identifiers', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) { t.skip(runtimeUnavailableReason); return; }
    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await installMetadataBrowserFixtures(browserContext); await bootstrapAdminThroughUi(page, { baseUrl });
      const requests = []; const fixture = await installMissingMusicFixture(browserContext, requests, { recoveryPhase: 'handoff_unknown' });
      const candidate = buildImportReviewCandidate({ id: 'candidate-amber', status: 'selected' });
      const run = buildImportReviewExecutionRun({ id: 'run-amber', status: 'failed', items: [{ importCandidateId: candidate.id, itemStatus: 'awaiting_confirmation',
        planningSnapshot: { candidate: { id: candidate.id }, execution: { handoff: { state: 'awaiting_confirmation' } } } }] });
      await seedMetadataImportReviewWorkspace(page, { candidates: [candidate], executionSummary: buildImportReviewRunSummary({ currentRun: run,
        summary: { status: 'attention', confirmationPending: true } }) });
      await page.goto(baseUrl + '/app/missing/wanted-amber');
      const inspector = page.locator('.missing-music-inspector'); await inspector.getByText('Confirming download request', { exact: true }).waitFor();
      assert.equal(await inspector.getByRole('button', { name: 'Review download request', exact: true }).count(), 0, 'without admin review permission no operator control is shown');
      fixture.downloadReviewAvailable = true;
      const [response] = await Promise.all([page.waitForResponse((result) => new URL(result.url()).pathname === '/api/v1/missing-music/decisions/wanted-amber'),
        page.evaluate(() => globalThis.document.dispatchEvent(new Event('visibilitychange')))]);
      assert.doesNotMatch(JSON.stringify(await response.json()), /operationRunId|importCandidateId|attemptId|receipts|providerBinding|currentDownloadHandoff/u);
      const open = inspector.getByRole('button', { name: 'Review download request', exact: true }); await open.waitFor(); await open.focus(); await page.keyboard.press('Enter');
      await page.waitForFunction(() => { const url = new URL(globalThis.location.href); return url.searchParams.get('executionRunId') === 'run-amber'
        && url.searchParams.get('candidate') === 'candidate-amber' && url.searchParams.get('status') === 'selected' && url.hash === '#import-execution-run-panel'; });
      await page.getByRole('heading', { name: 'Match diagnostics', exact: true }).waitFor(); await openImportReviewRunHistory(page);
      const panel = page.locator('.review-panel').filter({ has: page.getByRole('heading', { name: 'Send selected matches to downloads', exact: true }) });
      await panel.getByText('Run run-amber', { exact: true }).waitFor(); await panel.getByRole('button', { name: 'Review download request', exact: true }).waitFor();
      assert.equal(requests.filter((path) => path.endsWith('/download-review-handoff')).length, 1);
      assert.equal(fixture.downloadStartRequest, null); await page.goto('about:blank');
    }, { scenarioName: 'missing_music_admin_download_review_handoff' });
  });

  test('interrupted download refresh hides repeat Start, keeps partial receipts in review and exposes only genuine accepted progress', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) { t.skip(runtimeUnavailableReason); return; }
    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      const fixture = await installMissingMusicFixture(browserContext, [], { matchSelected: true });
      await page.goto(baseUrl + '/app/missing/wanted-amber', { waitUntil: 'domcontentloaded' });
      const inspector = page.locator('.missing-music-inspector');
      await inspector.getByRole('button', { name: 'Start download', exact: true }).waitFor();
      await page.getByLabel('Work state', { exact: true }).selectOption('all');
      const filter = page.getByLabel('Search releases', { exact: true });
      await filter.focus();
      const main = page.locator('.hx-main');
      await main.evaluate((element) => { element.scrollTop = 0; });
      const status = inspector.locator('.hx-missing-status-snapshot').getByRole('status');
      const node = await status.elementHandle();
      const privateFields = /currentDownloadHandoff|attemptId|receiptDisposition|sourceObservation|unconfirmedRuns|private-/u;
      async function refresh() {
        const [detailResponse, listResponse] = await Promise.all([
          page.waitForResponse((response) => new URL(response.url()).pathname === '/api/v1/missing-music/decisions/wanted-amber'),
          page.waitForResponse((response) => new URL(response.url()).pathname === '/api/v1/missing-music/decisions'),
          page.evaluate(() => globalThis.document.dispatchEvent(new Event('visibilitychange'))),
        ]);
        await inspector.locator('.hx-missing-status-snapshot:not([aria-busy="true"])').waitFor();
        const detail = await detailResponse.json(); const list = await listResponse.json();
        assert.deepEqual(list.decisions[0].status, detail.decision.status);
        assert.doesNotMatch(JSON.stringify({ detail, list }), privateFields);
        await status.filter({ hasText: detail.decision.status.message }).waitFor();
        await assertLocatorFocused(filter, 'handoff background refresh preserves the user-selected control');
        assert.equal(await main.evaluate((element) => element.scrollTop), 0);
        return detail;
      }
      fixture.recoveryPhase = 'handoff_unknown';
      const unknown = await refresh();
      assert.equal(unknown.decision.status.label, 'Confirming download request');
      assert.equal(unknown.permissions.canStartDownload, false);
      assert.equal(unknown.permissions.canSearchAgain, false);
      assert.equal(await inspector.getByRole('button', { name: 'Start download', exact: true }).count(), 0);
      assert.equal(await inspector.getByRole('link', { name: /downloads for Jamie in Downloader/u }).count(), 0);
      assert.equal(await status.getAttribute('aria-live'), 'polite');
      assert.equal(await status.getAttribute('aria-atomic'), 'true');
      const directory = resolve('.tmp/download-handoff-confirmation-2026-10');
      await mkdir(directory, { recursive: true });
      for (const width of [390, 800, 1280]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const theme of ['light', 'dark']) {
          await page.evaluate((value) => globalThis.document.documentElement.setAttribute('data-theme', value), theme);
          const region = inspector.getByRole('region', { name: 'Current status', exact: true });
          await region.evaluate((element) => element.scrollIntoView({ block: 'center' }));
          assert.equal(await inspector.evaluate((element) => element.scrollWidth <= element.clientWidth), true);
          await region.screenshot({ path: resolve(directory, `handoff-${width}-${theme}.png`), animations: 'disabled' });
        }
      }
      await filter.focus(); await main.evaluate((element) => { element.scrollTop = 0; });
      await node.evaluate((element) => { const observation = { changes: 0 };
        observation.observer = new globalThis.MutationObserver((records) => { observation.changes += records.length; });
        observation.observer.observe(element, { childList: true, characterData: true, subtree: true }); element.handoffObservation = observation; });
      fixture.recoveryPhase = 'handoff_partial';
      assert.equal((await refresh()).decision.status.label, 'Confirming download request');
      assert.equal(await node.evaluate((element) => element.handoffObservation.changes), 0, 'an identical partial review message does not rewrite live text');
      fixture.recoveryPhase = 'confirmed';
      const confirmed = await refresh();
      assert.equal(confirmed.decision.status.code, 'downloading');
      await inspector.getByRole('link', { name: 'View Amber downloads for Jamie in Downloader', exact: true }).waitFor();
      assert.equal(await inspector.getByRole('button', { name: 'Start download', exact: true }).count(), 0);
      assert.equal(fixture.downloadStartRequest, null);
      assert.equal(await node.evaluate((element) => element.isConnected), true);
      await node.evaluate((element) => element.handoffObservation.observer.disconnect());
    }, { scenarioName: 'missing_music_current_handoff_confirmation' });
  });

  test('guarded automatic adding refreshes into current prepared Add recovery without private facts, focus theft or identical-text churn', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) { t.skip(runtimeUnavailableReason); return; }
    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const requests = [];
      await bootstrapAdminThroughUi(page, { baseUrl });
      const fixture = await installMissingMusicFixture(browserContext, requests, { preparedDownload: true, automaticLibraryAddQueued: true });
      await page.goto(baseUrl + '/app/missing/wanted-amber', { waitUntil: 'domcontentloaded' });
      const inspector = page.locator('.missing-music-inspector');
      const snapshot = inspector.locator('.hx-missing-status-snapshot');
      const status = snapshot.getByRole('status');
      const queuedMessage = 'Harmoniarr has queued a safe library add and will check the files again before changing the library.';
      await status.filter({ hasText: queuedMessage }).waitFor();
      assert.equal(await status.innerText(), queuedMessage);
      assert.equal(await status.getAttribute('aria-live'), 'polite');
      assert.equal(await status.getAttribute('aria-atomic'), 'true');
      assert.equal(await inspector.getByRole('button', { name: 'Add to library', exact: true }).count(), 0);
      assert.equal(fixture.addRequestCount, 0);
      const statusNode = await status.elementHandle();
      await statusNode.evaluate((element) => {
        const observation = { textChanges: 0 };
        observation.observer = new globalThis.MutationObserver((records) => {
          observation.textChanges += records.filter((record) => ['childList', 'characterData'].includes(record.type)).length;
        });
        observation.observer.observe(element, { childList: true, characterData: true, subtree: true });
        element.automaticStatusObservation = observation;
      });
      const screenshotDirectory = resolve('.tmp/automatic-library-add-2026-10');
      await mkdir(screenshotDirectory, { recursive: true });
      for (const width of [390, 800, 1280]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const theme of ['light', 'dark']) {
          await page.evaluate((value) => globalThis.document.documentElement.setAttribute('data-theme', value), theme);
          assert.equal(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth), true);
          assert.equal(await inspector.evaluate((element) => element.scrollWidth <= element.clientWidth), true);
          const currentStatus = inspector.getByRole('region', { name: 'Current status', exact: true });
          await currentStatus.evaluate((element) => element.scrollIntoView({ block: 'center' }));
          assert.equal(await currentStatus.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            return bounds.top >= 56 && bounds.bottom <= globalThis.innerHeight - (globalThis.innerWidth <= 640 ? 60 : 0);
          }), true, 'automatic status evidence should remain clear of fixed navigation');
          await currentStatus.screenshot({
            path: resolve(screenshotDirectory, `automatic-${width}-${theme}.png`), animations: 'disabled',
          });
        }
      }
      const filter = page.getByLabel('Search releases', { exact: true });
      await filter.focus();
      const main = page.locator('.hx-main');
      await main.evaluate((element) => { element.scrollTop = 0; });
      const userScroll = await main.evaluate((element) => element.scrollTop);
      const detailPath = '/api/v1/missing-music/decisions/wanted-amber';
      const privateFacts = /music_queue_download_completed|automaticLibraryAddForWantedReleaseId|libraryAddRequestedForWantedReleaseId|recheckRequestedForWantedReleaseId|participantPolicies|\/private|\/mnt/u;
      async function revalidateDetail() {
        const [response] = await Promise.all([
          page.waitForResponse((value) => new URL(value.url()).pathname === detailPath),
          page.evaluate(() => globalThis.window.dispatchEvent(new Event('focus'))),
        ]);
        await inspector.locator('.hx-missing-status-snapshot:not([aria-busy="true"])').waitFor();
        const payload = await response.json();
        assert.doesNotMatch(JSON.stringify(payload), privateFacts);
        return payload;
      }
      for (let poll = 0; poll < 3; poll += 1) {
        const payload = await revalidateDetail();
        assert.equal(payload.permissions.canAddToLibrary, false);
        assert.equal(payload.decision.state, 'downloading');
      }
      assert.equal(await statusNode.evaluate((element) => element.automaticStatusObservation.textChanges), 0,
        'identical snapshots should not replace or mutate the existing status text');
      await assertLocatorFocused(filter, 'unchanged automatic progress must preserve user focus');
      assert.equal(await main.evaluate((element) => element.scrollTop), userScroll);

      // Model the public projection after a worker refuses changed authority;
      // PostgreSQL/file tests prove that worker boundary independently.
      fixture.automaticLibraryAddQueued = false;
      fixture.libraryAddQueued = false;
      fixture.addAvailable = true;
      let finishRefresh;
      fixture.detailResponseWait = new Promise((resolveResponse) => { finishRefresh = resolveResponse; });
      const refusalRefresh = revalidateDetail();
      await inspector.locator('.hx-missing-status-snapshot[aria-busy="true"]').waitFor();
      assert.equal(await status.innerText(), queuedMessage, 'keep the prior snapshot while the new decision is still being read');
      finishRefresh();
      const refused = await refusalRefresh;
      fixture.detailResponseWait = null;
      assert.equal(refused.permissions.canAddToLibrary, true);
      assert.equal(refused.decision.state, 'action');
      assert.equal(refused.decision.status.nextAction, 'add_to_library');
      await status.filter({ hasText: 'A completed download is available. Harmoniarr will check its audio and file plan before adding it.' }).waitFor();
      assert.equal(await statusNode.evaluate((element) => element.isConnected), true);
      const changedTextCount = await statusNode.evaluate((element) => element.automaticStatusObservation.textChanges);
      assert.ok(changedTextCount > 0, 'a changed public status should update the existing live text');
      await assertLocatorFocused(filter, 'automatic refusal recovery must not steal focus');
      assert.equal(await main.evaluate((element, position) => position <= element.scrollHeight - element.clientHeight, userScroll), true);
      assert.equal(await main.evaluate((element) => element.scrollTop), userScroll);
      await revalidateDetail();
      assert.equal(await statusNode.evaluate((element) => element.automaticStatusObservation.textChanges), changedTextCount);
      await assertLocatorFocused(filter, 'an identical recovery snapshot must preserve user focus');
      assert.equal(await main.evaluate((element) => element.scrollTop), userScroll);
      assert.doesNotMatch(await inspector.innerText(), privateFacts);

      const add = inspector.getByRole('button', { name: 'Add to library', exact: true });
      await add.focus();
      await add.press('Enter');
      const dialog = page.getByRole('dialog', { name: 'Add to library?', exact: true });
      await assertLocatorFocused(dialog.getByRole('button', { name: 'Cancel', exact: true }), 'automatic refusal uses the existing deliberate confirmation');
      await dialog.getByText('Quality requirements and file-conflict checks still apply.', { exact: false }).waitFor();
      assert.equal(fixture.addRequestCount, 0, 'background refusal and opening confirmation do not request another add');
      const worklistPath = '/api/v1/missing-music/decisions';
      await Promise.all([
        page.waitForResponse((response) => new URL(response.url()).pathname === detailPath),
        page.waitForResponse((response) => new URL(response.url()).pathname === worklistPath),
        dialog.getByRole('button', { name: 'Add to library', exact: true }).press('Space'),
      ]);
      await dialog.waitFor({ state: 'hidden' });
      await status.filter({ hasText: queuedMessage }).waitFor();
      assert.equal(fixture.addRequestCount, 1);
      assert.deepEqual(fixture.addRequest.body, {});
      assert.match(fixture.addRequest.idempotencyKey, /^missing-music-decisions-add-to-library-/u);
      await assertLocatorFocused(inspector.getByRole('heading', { name: 'Current status', exact: true }), 'the explicit guarded recovery retains command-owned focus');
      assert.doesNotMatch(await inspector.innerText(), privateFacts);
      await statusNode.evaluate((element) => element.automaticStatusObservation.observer.disconnect());
    }, { scenarioName: 'missing_music_automatic_add_current_recovery' });
  });

  test('prepared Add to library is found in the default worklist, confirms by keyboard, and exposes pending after modal closure', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) { t.skip(runtimeUnavailableReason); return; }
    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const requests = [];
      await bootstrapAdminThroughUi(page, { baseUrl });
      const fixture = await installMissingMusicFixture(browserContext, requests, { preparedDownload: true });
      await page.goto(baseUrl + '/app/missing', { waitUntil: 'domcontentloaded' });
      await page.locator('.missing-music-worklist').getByText('Next step: Add to library', { exact: true }).waitFor();
      await page.getByRole('link', { name: 'Open status details for Autechre — Amber' }).click();
      const inspector = page.locator('.missing-music-inspector');
      const add = inspector.getByRole('button', { name: 'Add to library', exact: true });
      await add.focus();
      assert.equal(await add.getAttribute('type'), 'button');
      await add.press('Enter');
      const dialog = page.getByRole('dialog', { name: 'Add to library?', exact: true });
      await dialog.getByText('requested for Jamie', { exact: false }).waitFor();
      const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true });
      await assertLocatorFocused(cancel, 'Cancel is the deliberate initial confirmation focus');
      await assertTabFocusContained(page, dialog, { steps: 4 });
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      await assertLocatorFocused(add, 'Escape should return to the prepared-add invoker');
      await add.press('Space');
      await cancel.click();
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(fixture.addRequestCount, 0);
      await add.press('Enter');
      const screenshotDirectory = resolve('.tmp/add-to-library-2026-10');
      await mkdir(screenshotDirectory, { recursive: true });
      for (const width of [390, 800, 1280]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const theme of ['light', 'dark']) {
          await page.evaluate((value) => globalThis.document.documentElement.setAttribute('data-theme', value), theme);
          await cancel.focus();
          await assertVisibleFocusOutline(cancel, 'the native add confirmation should show visible Cancel focus');
          assert.equal(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth), true);
          assert.equal(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth), true);
          if (width === 390) assert.ok((await cancel.boundingBox()).height >= 44);
          assert.equal(await dialog.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            return bounds.top >= 56 && bounds.bottom <= globalThis.innerHeight - (globalThis.innerWidth <= 640 ? 60 : 0);
          }), true, 'confirmation content must remain clear of fixed navigation');
          await dialog.screenshot({ path: resolve(screenshotDirectory, `add-${width}-${theme}.png`), animations: 'disabled' });
        }
      }
      const feedback = await inspector.locator('.hx-missing-library-add-action + .hx-missing-command-feedback').elementHandle();
      assert.equal(await feedback.evaluate((element) => element.textContent.trim()), '');
      let finish;
      fixture.addResponseWait = new Promise((resolveResponse) => { finish = resolveResponse; });
      const detailPath = '/api/v1/missing-music/decisions/wanted-amber';
      const worklistPath = '/api/v1/missing-music/decisions';
      const detailCount = requests.filter((path) => path === detailPath).length;
      const worklistCount = requests.filter((path) => path === worklistPath).length;
      const confirm = dialog.getByRole('button', { name: 'Add to library', exact: true });
      await confirm.focus();
      await confirm.press('Space');
      await dialog.waitFor({ state: 'hidden' });
      await inspector.getByRole('status').getByText('Checking the prepared files before queueing the library add…', { exact: true }).waitFor();
      assert.equal(await feedback.evaluate((element) => element.isConnected && !element.closest('[inert], [aria-busy="true"]')), true);
      const requesting = inspector.getByRole('button', { name: 'Requesting…', exact: true });
      assert.equal(await requesting.isDisabled(), true);
      await requesting.press('Enter');
      assert.equal(fixture.addRequestCount, 1);
      assert.deepEqual(fixture.addRequest.body, {});
      assert.match(fixture.addRequest.csrfToken, /.+/u);
      assert.match(fixture.addRequest.idempotencyKey, /^missing-music-decisions-add-to-library-/u);
      await Promise.all([
        page.waitForResponse((response) => new URL(response.url()).pathname === detailPath),
        page.waitForResponse((response) => new URL(response.url()).pathname === worklistPath),
        Promise.resolve().then(() => finish()),
      ]);
      await inspector.getByText('Adding to library', { exact: true }).waitFor();
      await inspector.getByRole('status').getByText('Harmoniarr queued this release to be added to the music library. Audio and file checks will run before any files move.', { exact: true }).waitFor();
      const currentStatus = inspector.getByRole('heading', { name: 'Current status', exact: true });
      await assertLocatorFocused(currentStatus, 'accepted add should focus the refreshed status while the interaction remains owned');
      assert.equal(await currentStatus.evaluate((element) => element.getBoundingClientRect().top >= 56), true);
      assert.equal(await feedback.evaluate((element) => element.isConnected), true);
      assert.equal(requests.filter((path) => path === detailPath).length, detailCount + 1);
      assert.equal(requests.filter((path) => path === worklistPath).length, worklistCount + 1);
      assert.equal(await page.locator('.missing-music-worklist__row').count(), 0, 'accepted add leaves the default action worklist');
      assert.equal(await add.count(), 0);
      assert.equal(fixture.recheckRequestCount, 0);
      assert.equal(fixture.downloadStartRequest, null);
    }, { scenarioName: 'missing_music_prepared_add_confirmation_and_layouts' });
  });

  test('prepared Add to library renders five bounded outcomes without granting a bypass or claiming completion', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) { t.skip(runtimeUnavailableReason); return; }
    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      const fixture = await installMissingMusicFixture(browserContext, [], { preparedDownload: true });
      for (const [outcome, message, tone] of [
        ['queued', 'Harmoniarr queued this release to be added to the music library. Audio and file checks will run before any files move.', 'success'],
        ['already_queued', 'Library-add work is already queued for this release. No additional work was started.', 'info'],
        ['still_needs_review', 'These prepared files need review before Harmoniarr can add them safely.', 'warning'],
        ['not_available', 'This release is no longer ready for this library add. Review its current status.', 'warning'],
        ['deferred', 'Another library add is active. This release was left unchanged; try again after that work finishes.', 'warning'],
      ]) {
        fixture.addOutcome = outcome;
        fixture.addAvailable = true;
        fixture.libraryAddQueued = false;
        await page.goto(baseUrl + '/app/missing/wanted-amber', { waitUntil: 'domcontentloaded' });
        await page.reload({ waitUntil: 'domcontentloaded' });
        const inspector = page.locator('.missing-music-inspector');
        await inspector.getByRole('button', { name: 'Add to library', exact: true }).click();
        await page.getByRole('dialog', { name: 'Add to library?', exact: true }).getByRole('button', { name: 'Add to library', exact: true }).click();
        const feedback = inspector.getByRole('status').filter({ hasText: message });
        await feedback.waitFor();
        assert.equal(await feedback.getAttribute('data-tone'), tone);
        await inspector.getByText(['queued', 'already_queued'].includes(outcome) ? 'Adding to library' : 'Ready to add', { exact: true }).waitFor();
        assert.doesNotMatch(await inspector.innerText(), /Private|\/mnt|run-add/u);
      }
      assert.equal(fixture.addRequestCount, 5);
    }, { scenarioName: 'missing_music_prepared_add_bounded_outcomes' });
  });

  test('prepared Add retains an uncertain retry and preserves moved user focus and background scroll', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) { t.skip(runtimeUnavailableReason); return; }
    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      const fixture = await installMissingMusicFixture(browserContext, [], { preparedDownload: true });
      fixture.addFailure = 500;
      await page.goto(baseUrl + '/app/missing/wanted-amber', { waitUntil: 'domcontentloaded' });
      const inspector = page.locator('.missing-music-inspector');
      const add = inspector.getByRole('button', { name: 'Add to library', exact: true });
      const dialog = page.getByRole('dialog', { name: 'Add to library?', exact: true });
      for (let attempt = 0; attempt < 2; attempt += 1) {
        await add.focus();
        await add.press('Enter');
        await dialog.getByRole('button', { name: 'Add to library', exact: true }).focus();
        await page.keyboard.press('Enter');
        await inspector.getByRole('alert').getByText('The library add could not be requested. Refresh this release and try again.', { exact: true }).waitFor();
        await assertLocatorFocused(add, 'an uncertain response after modal closure should retain the meaningful invoker');
        if (attempt === 0) fixture.originalAddKey = fixture.addRequest.idempotencyKey;
      }
      assert.equal(fixture.addRequest.idempotencyKey, fixture.originalAddKey);
      assert.doesNotMatch(await inspector.innerText(), /Private|\/mnt/u);
      fixture.addFailure = false;
      let finish;
      fixture.addResponseWait = new Promise((resolveResponse) => { finish = resolveResponse; });
      await add.press('Space');
      await dialog.getByRole('button', { name: 'Add to library', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      const filter = page.getByLabel('Search releases', { exact: true });
      await filter.focus();
      // Leave room below the user-selected position when ready actions disappear.
      await page.locator('.hx-main').evaluate((element) => { element.scrollTop = Math.min(element.scrollTop, 300); });
      const userScroll = await page.locator('.hx-main').evaluate((element) => element.scrollTop);
      assert.equal(await page.locator('.hx-main').evaluate((element) => element.scrollTop < element.scrollHeight - element.clientHeight - 100), true);
      finish();
      await inspector.getByText('Adding to library', { exact: true }).waitFor();
      await assertLocatorFocused(filter, 'prepared-add completion must respect user-moved focus');
      assert.equal(await page.locator('.hx-main').evaluate((element, position) => position <= element.scrollHeight - element.clientHeight, userScroll), true, 'the chosen position should remain within the refreshed scroll range');
      assert.equal(await page.locator('.hx-main').evaluate((element) => element.scrollTop), userScroll);
      await Promise.all([
        page.waitForResponse((response) => new URL(response.url()).pathname === '/api/v1/missing-music/decisions/wanted-amber'),
        page.evaluate(() => globalThis.window.dispatchEvent(new Event('focus'))),
      ]);
      await assertLocatorFocused(filter, 'background prepared-add refresh must preserve user focus');
      assert.equal(await page.locator('.hx-main').evaluate((element) => element.scrollTop), userScroll);
      assert.equal(fixture.addRequestCount, 3);
    }, { scenarioName: 'missing_music_prepared_add_retry_and_focus' });
  });

  test('prepared Add cleans up confirmation and pending route state and hides denied or disabled commands', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) { t.skip(runtimeUnavailableReason); return; }
    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      const fixture = await installMissingMusicFixture(browserContext, [], { preparedDownload: true });
      await page.goto(baseUrl + '/app/missing', { waitUntil: 'domcontentloaded' });
      await page.getByRole('link', { name: 'Open status details for Autechre — Amber' }).click();
      const inspector = page.locator('.missing-music-inspector');
      await inspector.getByRole('button', { name: 'Add to library', exact: true }).click();
      await page.getByRole('dialog', { name: 'Add to library?', exact: true }).waitFor();
      await page.goBack();
      await inspector.waitFor({ state: 'hidden' });
      assert.equal(await page.getByRole('dialog', { name: 'Add to library?', exact: true }).count(), 0);
      assert.equal(fixture.addRequestCount, 0);
      await page.getByRole('link', { name: 'Open status details for Autechre — Amber' }).click();
      let finish;
      fixture.addResponseWait = new Promise((resolveResponse) => { finish = resolveResponse; });
      await inspector.getByRole('button', { name: 'Add to library', exact: true }).click();
      await page.getByRole('dialog', { name: 'Add to library?', exact: true }).getByRole('button', { name: 'Add to library', exact: true }).click();
      await inspector.getByRole('status').getByText('Checking the prepared files before queueing the library add…', { exact: true }).waitFor();
      await inspector.getByRole('link', { name: 'Back to release decisions', exact: true }).click();
      await inspector.waitFor({ state: 'hidden' });
      await Promise.all([
        page.waitForResponse((response) => new URL(response.url()).pathname.endsWith('/add-to-library')),
        Promise.resolve().then(() => finish()),
      ]);
      assert.equal(await inspector.count(), 0);
      assert.equal(await page.getByText('Harmoniarr queued this release to be added to the music library. Audio and file checks will run before any files move.', { exact: true }).count(), 0);
      fixture.libraryAddQueued = false;
      fixture.addAvailable = false;
      await page.goto(baseUrl + '/app/missing/wanted-amber', { waitUntil: 'domcontentloaded' });
      await inspector.getByText('Ready to add', { exact: true }).waitFor();
      assert.equal(await inspector.getByRole('button', { name: 'Add to library', exact: true }).count(), 0);
      fixture.addAvailable = true;
      fixture.accountStatus = 'disabled';
      await page.reload({ waitUntil: 'domcontentloaded' });
      await inspector.getByText('This account is disabled. Its history is read-only.', { exact: true }).waitFor();
      assert.equal(await inspector.getByRole('button', { name: 'Add to library', exact: true }).count(), 0);
      assert.equal(fixture.addRequestCount, 1);
    }, { scenarioName: 'missing_music_prepared_add_route_and_permission' });
  });

  test('checks completed files by keyboard, reports durable acceptance, refreshes both surfaces, and shows recovery in both themes', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) { t.skip(runtimeUnavailableReason); return; }
    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const requests = [];
      await bootstrapAdminThroughUi(page, { baseUrl });
      const fixture = await installMissingMusicFixture(browserContext, requests, { libraryRecoveryReason: 'audio_check_failed' });
      await page.goto(baseUrl + '/app/missing', { waitUntil: 'domcontentloaded' });
      await page.locator('.missing-music-worklist').getByText('Next step: Check the files again', { exact: true }).waitFor();
      await page.getByRole('link', { name: 'Open status details for Autechre — Amber' }).click();
      const inspector = page.locator('.missing-music-inspector');
      const recovery = inspector.getByRole('region', { name: 'Audio check could not finish', exact: true });
      const check = recovery.getByRole('button', { name: 'Check the files again', exact: true });
      await check.waitFor();
      assert.equal(await check.getAttribute('type'), 'button');
      assert.equal(await recovery.getByRole('link', { name: 'Set up folders', exact: true }).count(), 0);
      await recovery.getByText('Check the same completed download for Jamie.', { exact: false }).waitFor();
      const statusNode = await inspector.locator('.hx-missing-command-feedback').last().elementHandle();
      assert.equal(await statusNode.evaluate((element) => element.getAttribute('role') === 'status' && element.textContent.trim() === ''), true);
      const screenshotDirectory = resolve('.tmp/missing-music-library-add-recheck');
      await mkdir(screenshotDirectory, { recursive: true });
      await page.keyboard.press('Tab');
      for (const width of [390, 800, 1280]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const theme of ['light', 'dark']) {
          await page.evaluate((value) => globalThis.document.documentElement.setAttribute('data-theme', value), theme);
          await recovery.evaluate((element) => element.scrollIntoView({ block: 'center' }));
          await check.focus();
          await assertVisibleFocusOutline(check, 'the file recheck should expose keyboard focus');
          assert.equal(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth), true);
          assert.equal(await recovery.evaluate((element) => element.scrollWidth <= element.clientWidth), true);
          if (width === 390) assert.ok((await check.boundingBox()).height >= 44);
          assert.equal(await recovery.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            return bounds.top >= 56 && bounds.bottom <= globalThis.innerHeight - (globalThis.innerWidth <= 640 ? 60 : 0);
          }), true, 'recovery control and explanation should clear fixed navigation');
          await recovery.screenshot({ path: resolve(screenshotDirectory, `recheck-${width}-${theme}.png`), animations: 'disabled' });
        }
      }
      let finishResponse;
      fixture.recheckResponseWait = new Promise((resolveResponse) => { finishResponse = resolveResponse; });
      const detailPath = '/api/v1/missing-music/decisions/wanted-amber';
      const worklistPath = '/api/v1/missing-music/decisions';
      const detailCount = requests.filter((path) => path === detailPath).length;
      const worklistCount = requests.filter((path) => path === worklistPath).length;
      await check.focus();
      await check.press('Space');
      await inspector.getByRole('status').getByText('Checking the completed files again…', { exact: true }).waitFor();
      assert.equal(await recovery.getByRole('button', { name: 'Checking…', exact: true }).isDisabled(), true);
      assert.equal(await statusNode.evaluate((element) => element.isConnected && !element.closest('[aria-busy="true"]')), true);
      assert.deepEqual(fixture.recheckRequest.body, {});
      assert.match(fixture.recheckRequest.csrfToken, /.+/u);
      assert.match(fixture.recheckRequest.idempotencyKey, /^missing-music-decisions-recheck-library-add-/u);
      await Promise.all([
        page.waitForResponse((response) => new URL(response.url()).pathname === detailPath),
        page.waitForResponse((response) => new URL(response.url()).pathname === worklistPath),
        Promise.resolve().then(() => finishResponse()),
      ]);
      await inspector.getByText('Adding to library', { exact: true }).waitFor();
      await inspector.getByRole('status').getByText('Harmoniarr queued this release for library-add checks. The files will be added only if the plan remains safe.', { exact: true }).waitFor();
      await page.locator('.missing-music-worklist').getByText('Adding to library', { exact: true }).waitFor();
      const currentStatus = inspector.getByRole('heading', { name: 'Current status', exact: true });
      await assertLocatorFocused(currentStatus, 'accepted recovery should focus the refreshed state while the interaction owns focus');
      assert.equal(await currentStatus.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.top >= 56 && bounds.bottom <= globalThis.innerHeight;
      }), true, 'the command focus destination should be visible below the topbar');
      assert.equal(requests.filter((path) => path === detailPath).length, detailCount + 1);
      assert.equal(requests.filter((path) => path === worklistPath).length, worklistCount + 1);
      assert.equal(await check.count(), 0);
      assert.equal(await statusNode.evaluate((element) => element.isConnected), true);
      assert.equal(fixture.recheckRequestCount, 1);
      assert.equal(fixture.downloadStartRequest, null);
      assert.equal(fixture.searchAgainRequestCount, 0);
    }, { scenarioName: 'missing_music_library_add_recheck_keyboard_and_layouts' });
  });

  test('library recheck renders six bounded outcomes with distinct waiting and review feedback', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) { t.skip(runtimeUnavailableReason); return; }
    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      const fixture = await installMissingMusicFixture(browserContext, [], { libraryRecoveryReason: 'audio_check_failed' });
      for (const [outcome, message, tone] of [
        ['queued', 'Harmoniarr queued this release for library-add checks. The files will be added only if the plan remains safe.', 'success'],
        ['already_queued', 'Library-add checks are already queued for this release. No additional work was started.', 'info'],
        ['deferred', 'Another library add is active. This release was left unchanged; check its files again after that work finishes.', 'warning'],
        ['prerequisite_not_ready', 'The required folders or media tools are not ready. Repair the prerequisite, then check these files again.', 'warning'],
        ['still_needs_review', 'These completed files still need review before Harmoniarr can add them safely.', 'warning'],
        ['not_available', 'This release is no longer eligible for this file recheck. Review its current status.', 'warning'],
      ]) {
        fixture.recheckOutcome = outcome;
        fixture.recheckAvailable = true;
        fixture.libraryAddQueued = false;
        await page.goto(baseUrl + '/app/missing/wanted-amber', { waitUntil: 'domcontentloaded' });
        await page.reload({ waitUntil: 'domcontentloaded' });
        const inspector = page.locator('.missing-music-inspector');
        await inspector.getByRole('button', { name: 'Check the files again', exact: true }).click();
        const feedback = inspector.getByRole('status').filter({ hasText: message });
        await feedback.waitFor();
        assert.equal(await feedback.getAttribute('data-tone'), tone);
        if (['queued', 'already_queued'].includes(outcome)) await inspector.getByText('Adding to library', { exact: true }).waitFor();
        else await inspector.getByText('Needs help', { exact: true }).waitFor();
        assert.doesNotMatch(await inspector.innerText(), /Private|\/mnt|run-add/u);
      }
      assert.equal(fixture.recheckRequestCount, 6);
    }, { scenarioName: 'missing_music_library_add_recheck_bounded_outcomes' });
  });

  test('library recheck retains uncertain retry identity and respects moved focus, denied permission, and disabled history', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) { t.skip(runtimeUnavailableReason); return; }
    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      const fixture = await installMissingMusicFixture(browserContext, [], { libraryRecoveryReason: 'audio_check_failed' });
      fixture.recheckFailure = 500;
      await page.goto(baseUrl + '/app/missing/wanted-amber', { waitUntil: 'domcontentloaded' });
      const inspector = page.locator('.missing-music-inspector');
      const check = inspector.getByRole('button', { name: 'Check the files again', exact: true });
      await check.focus();
      await check.press('Enter');
      await inspector.getByRole('alert').getByText('The files could not be rechecked. Refresh this release and try again.', { exact: true }).waitFor();
      await assertLocatorFocused(check, 'safe recheck failure should preserve the invoker');
      const previousKey = fixture.recheckRequest.idempotencyKey;
      await check.press('Space');
      await inspector.getByRole('alert').getByText('The files could not be rechecked. Refresh this release and try again.', { exact: true }).waitFor();
      assert.equal(fixture.recheckRequest.idempotencyKey, previousKey);
      assert.doesNotMatch(await inspector.innerText(), /Private|\/mnt/u);
      fixture.recheckFailure = false;
      let finishResponse;
      fixture.recheckResponseWait = new Promise((resolveResponse) => { finishResponse = resolveResponse; });
      await check.press('Enter');
      await inspector.getByRole('status').getByText('Checking the completed files again…', { exact: true }).waitFor();
      const filter = page.getByLabel('Search releases', { exact: true });
      await filter.focus();
      const userScrollPosition = await page.locator('.hx-main').evaluate((element) => element.scrollTop);
      finishResponse();
      await inspector.getByText('Adding to library', { exact: true }).waitFor();
      await assertLocatorFocused(filter, 'recheck completion must respect user-moved focus');
      assert.equal(await page.locator('.hx-main').evaluate((element) => element.scrollTop), userScrollPosition, 'recheck completion must preserve the user scroll position');
      await Promise.all([
        page.waitForResponse((response) => new URL(response.url()).pathname === '/api/v1/missing-music/decisions/wanted-amber'),
        page.evaluate(() => globalThis.window.dispatchEvent(new Event('focus'))),
      ]);
      await assertLocatorFocused(filter, 'background revalidation should preserve user focus');
      assert.equal(await page.locator('.hx-main').evaluate((element) => element.scrollTop), userScrollPosition, 'background revalidation should preserve the user scroll position');
      fixture.libraryAddQueued = false;
      fixture.recheckAvailable = false;
      await page.reload({ waitUntil: 'domcontentloaded' });
      await inspector.getByText('Needs help', { exact: true }).waitFor();
      assert.equal(await check.count(), 0);
      fixture.recheckAvailable = true;
      fixture.accountStatus = 'disabled';
      await page.reload({ waitUntil: 'domcontentloaded' });
      await inspector.getByText('This account is disabled. Its history is read-only.', { exact: true }).waitFor();
      assert.equal(await check.count(), 0);
      assert.equal(await inspector.getByRole('link', { name: 'Set up folders', exact: true }).count(), 0);
      assert.equal(fixture.recheckRequestCount, 3);
    }, { scenarioName: 'missing_music_library_add_recheck_safe_retry_and_focus' });
  });

  test('folder repair saves Settings, returns to the same recipient decision, and requires an explicit canonical recheck', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) { t.skip(runtimeUnavailableReason); return; }
    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const mutations = [];
      page.on('request', (request) => { if (request.method() === 'POST') mutations.push(new URL(request.url()).pathname); });
      await bootstrapAdminThroughUi(page, { baseUrl });
      const fixture = await installMissingMusicFixture(browserContext, [], { libraryRecoveryReason: 'source_path_unavailable' });
      let settingsPayload;
      await browserContext.route('**/api/v1/settings', async (route) => {
        if (route.request().method() === 'GET') {
          const response = await route.fetch();
          settingsPayload = await response.json();
          await route.fulfill({ response, body: JSON.stringify(settingsPayload) });
          return;
        }
        settingsPayload = { ...settingsPayload, settings: { ...settingsPayload.settings, ...route.request().postDataJSON() },
          pathValidation: { ...settingsPayload.pathValidation, summary: { status: 'healthy' } } };
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(settingsPayload) });
      });
      await page.goto(baseUrl + '/app/missing/wanted-amber', { waitUntil: 'domcontentloaded' });
      const repair = page.getByRole('region', { name: 'Completed files are not reachable', exact: true });
      const settingsLink = repair.getByRole('link', { name: 'Set up folders', exact: true });
      assert.equal(await settingsLink.getAttribute('href'), '/app/settings/media-storage?returnTo=missing_music_decision&returnReleaseId=wanted-amber');
      await settingsLink.click();
      await page.getByRole('heading', { name: 'Media folders', exact: true }).waitFor();
      await page.getByLabel('Downloads folder', { exact: true }).fill('/configured/downloads');
      await page.getByRole('button', { name: 'Save changes', exact: true }).click();
      await page.getByRole('heading', { name: 'Folders are ready', exact: true }).waitFor();
      const returnLink = page.getByRole('link', { name: 'Return to Missing Music', exact: true });
      assert.equal(await returnLink.getAttribute('href'), '/app/missing/wanted-amber');
      assert.equal(fixture.recheckRequestCount, 0, 'saving folders must not implicitly start a release mutation');
      assert.equal(mutations.some((path) => path.includes('/acquisition/') && path.endsWith('/recheck-library-add')), false);
      assert.equal(mutations.some((path) => path.endsWith('/recheck-library-add')), false);
      await returnLink.click();
      const inspector = page.locator('.missing-music-inspector');
      await inspector.getByText('Jamie', { exact: true }).waitFor();
      await assertLocatorFocused(inspector.getByRole('heading', { name: 'Amber', exact: true }), 'returning from Settings should focus the current decision');
      const check = inspector.getByRole('button', { name: 'Check the files again', exact: true });
      await check.focus();
      await check.press('Enter');
      await inspector.getByText('Adding to library', { exact: true }).waitFor();
      assert.equal(fixture.recheckRequestCount, 1);
      assert.deepEqual(fixture.recheckRequest.body, {});
      assert.equal(mutations.filter((path) => path === '/api/v1/missing-music/decisions/wanted-amber/recheck-library-add').length, 1);
      assert.equal(mutations.some((path) => path.includes('/acquisition/') && path.endsWith('/recheck-library-add')), false);
    }, { scenarioName: 'missing_music_folder_repair_explicit_recheck_return' });
  });

  test('saves recipient quality consent by keyboard, refreshes both surfaces, and renders in light and dark layouts', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) { t.skip(runtimeUnavailableReason); return; }
    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const requests = [];
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await bootstrapAdminThroughUi(page, { baseUrl });
      const fixture = await installMissingMusicFixture(browserContext, requests, { qualityChoiceCode: 'below_minimum', minimumBitrateKbps: 320 });
      await page.goto(baseUrl + '/app/missing/wanted-amber', { waitUntil: 'domcontentloaded' });
      const inspector = page.locator('.missing-music-inspector');
      const quality = inspector.getByRole('region', { name: 'Quality', exact: true });
      await quality.getByText('128 kbps', { exact: true }).waitFor();
      await quality.getByText('Not verified', { exact: true }).waitFor();
      await quality.getByText('Lossless archive', { exact: true }).waitFor();
      await quality.getByText('Allow MP3, AAC, Opus, or Ogg at 320 kbps or higher for this release. Audio checks and library checks still apply. Saved automation may continue.', { exact: true }).waitFor();
      await quality.getByText('This choice applies to this release for Jamie. Other household recipients’ quality requirements still apply.', { exact: true }).waitFor();
      const allow = quality.getByRole('button', { exact: true, name: 'Allow fallback quality' });
      const search = inspector.getByRole('button', { exact: true, name: 'Search again' });
      assert.equal(await search.isVisible(), true);
      assert.match(await inspector.innerText(), /This keeps the current quality choice/u);
      assert.doesNotMatch(await quality.innerText(), /upgrade/iu);

      const screenshotDirectory = resolve('.tmp/missing-music-quality-fallback');
      await mkdir(screenshotDirectory, { recursive: true });
      for (const width of [390, 800, 1280]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const theme of ['light', 'dark']) {
          await page.evaluate((value) => globalThis.document.documentElement.setAttribute('data-theme', value), theme);
          await allow.focus();
          await assertVisibleFocusOutline(allow, 'the fallback action should expose keyboard focus in every theme');
          assert.equal(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth), true);
          assert.equal(await quality.evaluate((element) => element.scrollWidth <= element.clientWidth), true);
          if (width > 640) {
            const firstRowTops = await quality.locator('.hx-missing-quality__facts > div').evaluateAll((elements, count) =>
              elements.slice(0, count).map((element) => element.getBoundingClientRect().top), width > 960 ? 3 : 2);
            assert.ok(Math.max(...firstRowTops) - Math.min(...firstRowTops) <= 1, 'quality facts in the same grid row should align');
          }
          if (width === 390) assert.ok((await allow.boundingBox()).height >= 44);
          await quality.screenshot({ path: resolve(screenshotDirectory, `quality-${width}-${theme}.png`), animations: 'disabled' });
        }
      }
      let finishQualityResponse;
      fixture.qualityResponseWait = new Promise((resolveResponse) => { finishQualityResponse = resolveResponse; });
      const detailPath = '/api/v1/missing-music/decisions/wanted-amber';
      const worklistPath = '/api/v1/missing-music/decisions';
      const detailCount = requests.filter((path) => path === detailPath).length;
      const worklistCount = requests.filter((path) => path === worklistPath).length;
      await allow.focus();
      await allow.press('Enter');
      await quality.getByRole('button', { exact: true, name: 'Saving…' }).waitFor();
      assert.equal(await search.isDisabled(), true, 'a pending quality command should disable competing search');
      assert.equal(fixture.qualityFallbackRequestCount, 1);
      assert.deepEqual(fixture.qualityFallbackRequest.body, {});
      assert.match(fixture.qualityFallbackRequest.csrfToken, /.+/u);
      assert.match(fixture.qualityFallbackRequest.idempotencyKey, /.+/u);
      await Promise.all([
        page.waitForResponse((response) => new URL(response.url()).pathname === detailPath),
        page.waitForResponse((response) => new URL(response.url()).pathname === worklistPath),
        Promise.resolve().then(() => finishQualityResponse()),
      ]);
      await quality.getByText('Allowed for this recipient', { exact: true }).waitFor();
      await quality.getByText('FLAC, ALAC, WAV, MP3, AAC, Opus, Ogg · lossy audio 320 kbps or higher', { exact: true }).waitFor();
      await quality.getByRole('status').getByText('Fallback quality is allowed for this recipient. A new search is queued using saved automation. Other household quality requirements still apply.', { exact: true }).waitFor();
      await assertLocatorFocused(inspector.getByRole('heading', { exact: true, name: 'Current status' }), 'saved quality consent should focus the refreshed current state');
      assert.equal(await quality.getByRole('button', { exact: true, name: 'Allow fallback quality' }).count(), 0);
      assert.equal(requests.filter((path) => path === detailPath).length, detailCount + 1);
      assert.equal(requests.filter((path) => path === worklistPath).length, worklistCount + 1);
      await page.locator('.missing-music-worklist').getByText('Search queued', { exact: true }).waitFor();
      assert.equal(fixture.searchAgainRequestCount, 0);
      assert.equal(fixture.selectionRequest, null);
      assert.equal(fixture.downloadStartRequest, null);
      assert.deepEqual(pageErrors, []);
    }, { scenarioName: 'missing_music_quality_fallback_keyboard_and_layouts' });
  });

  test('quality fallback uses safe retry feedback and verification or disabled history exposes no override', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) { t.skip(runtimeUnavailableReason); return; }
    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      const fixture = await installMissingMusicFixture(browserContext, [], { qualityChoiceCode: 'below_minimum' });
      fixture.qualityFallbackFailure = true;
      await page.goto(baseUrl + '/app/missing/wanted-amber', { waitUntil: 'domcontentloaded' });
      const quality = page.getByRole('region', { name: 'Quality', exact: true });
      await quality.getByText('Allow MP3, AAC, Opus, or Ogg at 256 kbps or higher for this release. Audio checks and library checks still apply. Saved automation may continue.', { exact: true }).waitFor();
      const allow = quality.getByRole('button', { name: 'Allow fallback quality', exact: true });
      await allow.click();
      await quality.getByRole('alert').getByText('The quality choice could not be saved. Refresh this release and try again.', { exact: true }).waitFor();
      const previousKey = fixture.qualityFallbackRequest.idempotencyKey;
      await allow.click();
      assert.equal(fixture.qualityFallbackRequest.idempotencyKey, previousKey);
      assert.equal(fixture.qualityFallbackRequestCount, 2);
      assert.doesNotMatch(await quality.innerText(), /Private|\/mnt/u);

      fixture.qualityChoiceCode = 'needs_verification';
      fixture.qualityFallbackAvailable = false;
      await page.reload({ waitUntil: 'domcontentloaded' });
      await quality.getByText('Needs verification', { exact: true }).waitFor();
      await quality.getByText('Not verified', { exact: true }).waitFor();
      assert.equal(await allow.count(), 0);
      fixture.qualityChoiceCode = 'below_minimum';
      fixture.qualityFallbackAvailable = true;
      fixture.accountStatus = 'disabled';
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByText('This account is disabled. Its history is read-only.', { exact: true }).waitFor();
      await quality.getByText('Below preference', { exact: true }).waitFor();
      assert.equal(await allow.count(), 0);
      assert.equal(fixture.qualityFallbackRequestCount, 2);
    }, { scenarioName: 'missing_music_quality_fallback_safe_feedback' });
  });

  test('selects one visible match without starting a download and returns focus to the updated state', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));

      await bootstrapAdminThroughUi(page, { baseUrl });
      const fixture = await installMissingMusicFixture(browserContext, []);
      await page.goto(baseUrl + '/app/missing/wanted-amber', { waitUntil: 'domcontentloaded' });

      const inspector = page.locator('.missing-music-inspector');
      await inspector.getByRole('heading', { exact: true, level: 3, name: 'Choose a match' }).waitFor();
      await inspector.getByText('10 files found', { exact: true }).waitFor();
      await inspector.getByRole('button', { name: 'Use this match for Amber — match 1' }).click();

      const currentStatus = inspector.getByRole('heading', { exact: true, level: 3, name: 'Current status' });
      await currentStatus.waitFor();
      await inspector.getByText('Match selected', { exact: true }).waitFor();
      await inspector.getByText('A download will not start until someone explicitly starts it.', { exact: false }).waitFor();
      await inspector.getByText('Next step: Start download', { exact: true }).waitFor();
      assert.equal(await currentStatus.evaluate((element) => globalThis.document.activeElement === element), true);
      assert.deepEqual(fixture.selectionRequest?.body, {});
      assert.match(fixture.selectionRequest?.csrfToken ?? '', /.+/u);
      assert.match(fixture.selectionRequest?.idempotencyKey ?? '', /.+/u);
      assert.equal(fixture.matchSelected, true);

      await browserContext.unrouteAll({ behavior: 'ignoreErrors' });
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, {
      scenarioName: 'missing_music_match_selection_without_download_start',
    });
  });

  test('confirms one selected match before starting its download preparation', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));

      await bootstrapAdminThroughUi(page, { baseUrl });
      const fixture = await installMissingMusicFixture(browserContext, [], { matchSelected: true });
      await page.goto(baseUrl + '/app/missing/wanted-amber', { waitUntil: 'domcontentloaded' });

      const inspector = page.locator('.missing-music-inspector');
      const startDownloadButton = inspector.getByRole('button', { name: 'Start download' });
      await startDownloadButton.focus();
      await assertVisibleFocusOutline(startDownloadButton, 'the Start download button focus indicator should be visible');
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', { name: 'Start download?' });
      await dialog.waitFor();
      await dialog.getByText('It will submit the transfer only after the download worker runs.', { exact: false }).waitFor();
      await assertFocusWithin(dialog, 'opening the native confirmation dialog should move focus inside it');
      await assertTabFocusContained(page, dialog, { steps: 4 });

      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(fixture.downloadStartRequest, null);
      await assertLocatorFocused(startDownloadButton, 'dismissing the dialog should return focus to Start download');
      await assertVisibleFocusOutline(startDownloadButton, 'returned Start download focus should remain visible');

      await startDownloadButton.click();
      await dialog.getByRole('button', { name: 'Start download' }).click();

      const currentStatus = inspector.getByRole('heading', { exact: true, level: 3, name: 'Current status' });
      await currentStatus.waitFor();
      await inspector.getByText('Download preparation started', { exact: true }).waitFor();
      await inspector.getByText('Download preparation started. Transfer progress will appear in Downloader after it is submitted.', { exact: true }).waitFor();
      assert.equal(await currentStatus.evaluate((element) => globalThis.document.activeElement === element), true);
      assert.deepEqual(fixture.downloadStartRequest?.body, {});
      assert.match(fixture.downloadStartRequest?.csrfToken ?? '', /.+/u);
      assert.match(fixture.downloadStartRequest?.idempotencyKey ?? '', /.+/u);
      assert.equal(fixture.downloadStarted, true);

      await browserContext.unrouteAll({ behavior: 'ignoreErrors' });
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, {
      scenarioName: 'missing_music_download_start_confirmation',
    });
  });

  test('hands an administrator to the release-scoped Downloader view without provider identifiers', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await installMissingMusicFixture(browserContext, [], { downloadStarted: true });
      await installDownloaderBrowserFixtures(browserContext, { queue: buildAmberDownloaderQueue() });
      await bootstrapAdminThroughUi(page, { baseUrl });

      await page.goto(baseUrl + '/app/missing/wanted-amber', { waitUntil: 'domcontentloaded' });
      const inspector = page.locator('.missing-music-inspector');
      const downloaderLink = inspector.getByRole('link', {
        name: 'View Amber downloads for Jamie in Downloader',
      });
      await downloaderLink.waitFor();
      assert.equal(
        await downloaderLink.getAttribute('href'),
        '/app/downloader?missingMusicDecisionId=wanted-amber',
      );

      await Promise.all([
        page.waitForURL(/\/app\/downloader\?missingMusicDecisionId=wanted-amber$/u),
        downloaderLink.click(),
      ]);
      const downloaderUrl = new URL(page.url());
      assert.deepEqual([...downloaderUrl.searchParams.entries()], [['missingMusicDecisionId', 'wanted-amber']]);
      assert.doesNotMatch(downloaderUrl.href, /healthy-slskd-peer|transfer-downloader-linked/u);

      await page.getByRole('heading', { exact: true, name: 'Downloads for Amber' }).waitFor();
      await page.getByText('Showing live transfers for Amber by Autechre, requested for Jamie.', { exact: true }).waitFor();
      const transferQueue = page.locator('article.hx-card').filter({
        has: page.getByRole('heading', { exact: true, name: 'Transfer Queue' }),
      });
      await transferQueue.getByText('01 Foil.flac', { exact: true }).waitFor();
      const returnLink = page.getByRole('link', { name: 'Return to Amber in Missing Music' });
      assert.equal(await returnLink.getAttribute('href'), '/app/missing/wanted-amber');
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, {
      scenarioName: 'missing_music_to_downloader_handoff',
    });
  });
});
