/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const linkedDownloaderQueue = Object.freeze({
  includeRemoved: false,
  observedAt: '2026-06-27T21:20:00.000Z',
  provider: 'slskd',
  providerState: Object.freeze({
    apiKeySource: 'stored',
    apiKeyUpdatedAt: '2026-06-27T21:00:00.000Z',
    configured: true,
    enabled: true,
    message: 'Download provider is configured.',
    reason: null,
    status: 'enabled',
  }),
  queueHealth: Object.freeze({
    averageSpeed: 2048,
    counts: Object.freeze({
      active: 1,
      completed: 0,
      failed: 0,
      other: 0,
      queued: 0,
      total: 1,
    }),
    message: '1 active and 0 queued transfer is in the queue.',
    progress: Object.freeze({
      bytesTransferred: 44040192,
      percentComplete: 42,
      size: 104857600,
    }),
    status: 'busy',
  }),
  sourceGroups: Object.freeze([
    Object.freeze({
      counts: Object.freeze({
        active: 1,
        completed: 0,
        failed: 0,
        other: 0,
        queued: 0,
        total: 1,
      }),
      sourceUser: 'healthy-slskd-peer',
    }),
  ]),
  transfers: Object.freeze([
    Object.freeze({
      actionEligibility: Object.freeze({
        actions: Object.freeze([
          Object.freeze({
            code: 'cancel',
            destructive: false,
            enabled: true,
            label: 'Cancel',
            reason: 'transfer_can_be_cancelled',
            requiresFreshSession: true,
          }),
          Object.freeze({
            code: 'remove',
            destructive: true,
            enabled: false,
            label: 'Remove',
            reason: 'remove_not_allowed_for_active',
            requiresFreshSession: true,
          }),
          Object.freeze({
            code: 'retry',
            destructive: false,
            enabled: false,
            label: 'Retry',
            reason: 'retry_provider_contract_not_available',
            requiresFreshSession: true,
          }),
        ]),
        canCancel: true,
        canClear: false,
        canPause: false,
        canRemove: false,
        canResume: false,
        canRetry: false,
        reason: 'cancel_available',
      }),
      averageSpeed: 2048,
      diagnostics: Object.freeze({
        importLinkage: Object.freeze({
          candidateId: 'candidate-downloader-linked',
          candidateStatus: 'downloading',
          executionItemStatus: 'queued',
          linkedAt: '2026-06-27T21:12:00.000Z',
          musicQueueRelease: Object.freeze({
            artistName: 'Autechre',
            releaseTitle: 'Amber',
            wantedReleaseId: 'wanted-release-downloader-linked',
            wantedStatus: 'missing',
          }),
          operationRunId: 'import-execution-run-downloader-linked',
          requestId: null,
          sourceSearchId: 'search-discovery-dispatch-amber',
          status: 'linked',
          summary: 'Linked to Import Review candidate.',
        }),
        provider: Object.freeze({
          hasProviderError: false,
          name: 'slskd',
          state: 'InProgress',
        }),
        queue: Object.freeze({
          hasQueuePosition: true,
          placeInQueue: 0,
        }),
        recommendedNextAction: Object.freeze({
          code: 'monitor_progress',
          description: 'Keep watching progress and speed before taking operator action.',
          label: 'Monitor progress',
          tone: 'info',
        }),
        retry: Object.freeze({
          attempts: null,
          status: 'not_tracked',
          summary: 'Retry attempts are not tracked by Harmoniarr for live provider rows yet.',
        }),
        severity: 'info',
        summary: 'The transfer is actively downloading at 42%.',
        timing: Object.freeze({
          lastKnownEventAt: '2026-06-27T21:18:00.000Z',
        }),
      }),
      directory: 'Autechre\\Amber',
      filename: 'Autechre\\Amber\\01 Foil.flac',
      id: 'transfer-downloader-linked',
      placeInQueue: 0,
      progress: Object.freeze({
        bytesTransferred: 44040192,
        percentComplete: 42,
        size: 104857600,
      }),
      sourceUser: 'healthy-slskd-peer',
      state: Object.freeze({
        code: 'active',
        label: 'Downloading',
        raw: 'InProgress',
        terminal: false,
        tone: 'warning',
      }),
      timestamps: Object.freeze({
        endedAt: null,
        enqueuedAt: '2026-06-27T21:12:00.000Z',
        requestedAt: '2026-06-27T21:11:00.000Z',
        startedAt: '2026-06-27T21:18:00.000Z',
      }),
      transferKey: 'healthy-slskd-peer::transfer-downloader-linked',
    }),
  ]),
  truncated: false,
});

const downloaderQueueFixtureStateKey = '__harmoniarrDownloaderQueueFixtureState';

function cloneFixtureValue(value) {
  return JSON.parse(JSON.stringify(value));
}

export function buildLinkedDownloaderQueueFixture(overrides = {}) {
  return {
    ...linkedDownloaderQueue,
    ...overrides,
  };
}

export function buildUnlinkedDownloaderTransferFixture(overrides = {}) {
  return {
    actionEligibility: {
      actions: [],
      canCancel: false,
      canClear: false,
      canPause: false,
      canRemove: false,
      canResume: false,
      canRetry: false,
      reason: 'no_action_available',
    },
    averageSpeed: 0,
    diagnostics: {
      importLinkage: {
        candidateId: null,
        candidateStatus: null,
        executionItemStatus: null,
        linkedAt: null,
        musicQueueRelease: null,
        operationRunId: null,
        requestId: null,
        sourceSearchId: null,
        status: 'unlinked',
        summary: 'No Import Review candidate is linked to this transfer.',
      },
      provider: {
        hasProviderError: false,
        name: 'slskd',
        state: 'Queued',
      },
      queue: {
        hasQueuePosition: true,
        placeInQueue: 1,
      },
      recommendedNextAction: {
        code: 'monitor_progress',
        description: 'Wait for the remote peer to make this transfer available.',
        label: 'Monitor progress',
        tone: 'info',
      },
      retry: {
        attempts: null,
        status: 'not_tracked',
        summary: 'Retry attempts are not tracked by Harmoniarr for live provider rows yet.',
      },
      severity: 'info',
      summary: 'The transfer is waiting in the remote queue.',
      timing: {
        lastKnownEventAt: '2026-06-27T21:19:00.000Z',
      },
    },
    directory: 'Biosphere\\Substrata',
    filename: 'Biosphere\\Substrata\\02 Antarctica Starts Here.flac',
    id: 'transfer-downloader-unlinked',
    placeInQueue: 1,
    progress: {
      bytesTransferred: 0,
      percentComplete: null,
      size: 94371840,
    },
    sourceUser: 'queued-slskd-peer',
    state: {
      code: 'queued',
      label: 'Queued',
      raw: 'Queued',
      terminal: false,
      tone: 'info',
    },
    timestamps: {
      endedAt: null,
      enqueuedAt: '2026-06-27T21:19:00.000Z',
      requestedAt: '2026-06-27T21:19:00.000Z',
      startedAt: null,
    },
    transferKey: 'queued-slskd-peer::transfer-downloader-unlinked',
    ...overrides,
  };
}

export function buildEmptyDownloaderQueueFixture(overrides = {}) {
  return buildLinkedDownloaderQueueFixture({
    queueHealth: Object.freeze({
      averageSpeed: 0,
      counts: Object.freeze({
        active: 0,
        completed: 0,
        failed: 0,
        other: 0,
        queued: 0,
        total: 0,
      }),
      message: 'No active transfers right now.',
      progress: Object.freeze({
        bytesTransferred: 0,
        percentComplete: 0,
        size: 0,
      }),
      status: 'idle',
    }),
    sourceGroups: Object.freeze([]),
    transfers: Object.freeze([]),
    ...overrides,
  });
}

export async function installDownloaderBrowserFixtures(browserContext, {
  queue = buildLinkedDownloaderQueueFixture(),
} = {}) {
  await browserContext.addInitScript(({ queuePayload, stateKey }) => {
    const originalFetch = globalThis.fetch.bind(globalThis);

    function buildJsonResponse(body, status = 200) {
      return new Response(JSON.stringify(body), {
        headers: {
          'Content-Type': 'application/json',
        },
        status,
      });
    }

    function clone(value) {
      return JSON.parse(JSON.stringify(value));
    }

    globalThis[stateKey] = {
      queuePayload: clone(queuePayload),
    };

    globalThis.fetch = async (input, init) => {
      const requestUrl = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
      const url = new URL(requestUrl, globalThis.location.origin);
      const method = String(
        init?.method
          ?? (typeof input === 'object' && input !== null && 'method' in input ? input.method : 'GET')
          ?? 'GET',
      ).toUpperCase();

      if (method === 'GET' && url.pathname === '/api/v1/downloader/queue') {
        return buildJsonResponse({
          downloader: clone(globalThis[stateKey].queuePayload),
          ok: true,
        });
      }

      return originalFetch(input, init);
    };
  }, {
    queuePayload: queue,
    stateKey: downloaderQueueFixtureStateKey,
  });

  return {
    /**
     * Replaces the queue returned to every current page in this isolated
     * browser context. It lets a scenario verify a bounded state transition
     * (for example, a live transfer leaving Downloader) without a real
     * provider or network request.
     *
     * @param {object} nextQueue
     * @returns {Promise<void>}
     */
    async setQueue(nextQueue) {
      const queuePayload = cloneFixtureValue(nextQueue);
      await Promise.all(browserContext.pages().map((page) => page.evaluate((state) => {
        const fixtureState = globalThis[state.stateKey];
        if (!fixtureState) {
          throw new Error('Downloader fixture state is unavailable on this page');
        }

        fixtureState.queuePayload = state.queuePayload;
      }, {
        queuePayload,
        stateKey: downloaderQueueFixtureStateKey,
      })));
    },
  };
}
