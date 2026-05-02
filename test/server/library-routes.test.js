import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/auth.js';
import { registerLibraryRoutes } from '../../src/server/routes/library-routes.js';
import { createJsonTestApp, withServer } from '../../testing/server/http-test-helpers.js';

function createLibraryRouteTestApp(overrides = {}) {
  return createJsonTestApp((app) => {
    registerLibraryRoutes(app, {
      buildLibraryDiscoveryRunDetail: async ({ runId }) => ({
        checkedAt: '2026-05-01T00:00:00.000Z',
        run: {
          id: runId,
          status: 'completed',
        },
      }),
      buildLibraryDiscoverySummary: async () => ({
        heartbeat: {
          intervalLabel: '15 minutes',
          intervalMs: 900000,
          mode: 'automatic',
          source: 'default',
        },
        lastEvaluatedAt: '2026-04-30T14:00:00.000Z',
        latestRun: null,
        nextEligibleAt: '2026-04-30T18:00:00.000Z',
        requestCounts: {
          blocked: 1,
          cooldown: 2,
          ready: 3,
          totalRequests: 6,
        },
        summary: {
          status: 'ready',
          message: '3 discovery requests are ready to search now.',
        },
      }),
      buildLibraryOrganizePreview: async () => ({
        checkedAt: '2026-05-01T00:10:00.000Z',
        counts: {
          alreadyCanonicalCount: 1,
          blockedAmbiguousCount: 0,
          blockedCount: 0,
          blockedDuplicateTargetCount: 0,
          blockedMissingMetadataCount: 0,
          blockedOutsideRootCount: 0,
          blockedUnmatchedCount: 0,
          blockedUnsupportedExtensionCount: 0,
          matchedFiles: 1,
          renameRequiredCount: 1,
          totalFiles: 2,
        },
        files: [],
        summary: {
          status: 'ready',
          message: '1 library file can be renamed or moved to match the canonical library layout.',
        },
      }),
      buildMediaRequestSummary: async () => ({
        counts: {
          alreadyExists: 1,
          needsFetch: 2,
          needsReview: 1,
          totalRequests: 4,
        },
        recentRequests: [],
        summary: {
          message: '2 requests are waiting for fetch and import follow-up.',
          status: 'active',
        },
      }),
      buildLibraryReconciliationSummary: async () => ({
        fileCounts: {
          ambiguous: 1,
          ignored: 0,
          matched: 2,
          observed: 3,
          unmatched: 0,
        },
        lastReconciledAt: '2026-04-30T12:40:00.000Z',
        releaseCounts: {
          complete: 1,
          duplicate: 0,
          partial: 1,
        },
        summary: {
          status: 'partial',
          message: '1 release is partially satisfied by the current library.',
        },
      }),
      buildLibraryWantedSummary: async () => ({
        lastReconciledAt: '2026-04-30T13:20:00.000Z',
        monitoredArtistCount: 2,
        releaseCounts: {
          missing: 1,
          partial: 1,
          totalWanted: 2,
        },
        summary: {
          status: 'wanted',
          message: '2 monitored releases still need files, including fully missing and partially satisfied releases.',
        },
      }),
      buildLibraryScanRunDetail: async ({ runId }) => ({
        checkedAt: '2026-05-01T00:00:00.000Z',
        run: {
          id: runId,
          status: 'completed',
        },
      }),
      createMediaRequest: async ({ actorUserId, payload }) => ({
        id: 'request-1',
        requestKind: payload.requestKind,
        requestState: 'needs_fetch',
        requestedByUser: {
          id: actorUserId,
          role: 'requester',
          username: 'listener',
        },
      }),
      getRequestMetadata: (request) => ({
        ipAddress: request.headers['x-forwarded-for'] ?? '127.0.0.1',
        userAgent: request.headers['user-agent'] ?? null,
      }),
      limitLibraryDiscoveryRun: (_request, _response, next) => next(),
      limitLibraryScanRun: (_request, _response, next) => next(),
      listMediaRequests: async () => [{
        id: 'request-1',
        requestKind: 'release',
        requestState: 'needs_fetch',
        requestedByUser: { id: 'user-1', role: 'requester', username: 'listener' },
      }],
      requireCsrf: () => {},
      requireFreshAdminSession: async () => ({ appUserId: 'user-1', csrfToken: 'csrf-token', user: { role: 'admin' } }),
      requireSession: async () => ({ appUserId: 'user-1', csrfToken: 'csrf-token', user: { role: 'requester' } }),
      startLibraryDiscoveryRun: async () => ({
        accepted: true,
        run: {
          id: 'discovery-run-1',
          status: 'pending',
        },
      }),
      startLibraryOrganizeApplyRun: async () => ({
        accepted: true,
        run: {
          id: 'organize-run-1',
          status: 'pending',
        },
      }),
      startLibraryScan: async () => ({
        accepted: true,
        run: {
          id: 'run-1',
          status: 'pending',
        },
      }),
      ...overrides,
    });
  });
}

test('library discovery summary route requires a session and returns the shared discovery payload', async (t) => {
  const requireSession = t.mock.fn(async () => ({ appUserId: 'user-19', csrfToken: 'csrf-19' }));
  const buildLibraryDiscoverySummary = t.mock.fn(async () => ({
    heartbeat: {
      intervalLabel: '15 minutes',
      intervalMs: 900000,
      mode: 'automatic',
      source: 'default',
    },
    lastEvaluatedAt: '2026-04-30T14:00:00.000Z',
    latestRun: null,
    nextEligibleAt: '2026-04-30T18:00:00.000Z',
    requestCounts: {
      blocked: 1,
      cooldown: 2,
      ready: 3,
      totalRequests: 6,
    },
    summary: {
      status: 'ready',
      message: '3 discovery requests are ready to search now.',
    },
  }));
  const app = createLibraryRouteTestApp({
    buildLibraryDiscoverySummary,
    requireSession,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/library/discovery-summary`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireSession.mock.callCount(), 1);
    assert.equal(buildLibraryDiscoverySummary.mock.callCount(), 1);
    assert.deepEqual(payload, {
      heartbeat: {
        intervalLabel: '15 minutes',
        intervalMs: 900000,
        mode: 'automatic',
        source: 'default',
      },
      lastEvaluatedAt: '2026-04-30T14:00:00.000Z',
      latestRun: null,
      nextEligibleAt: '2026-04-30T18:00:00.000Z',
      requestCounts: {
        blocked: 1,
        cooldown: 2,
        ready: 3,
        totalRequests: 6,
      },
      summary: {
        status: 'ready',
        message: '3 discovery requests are ready to search now.',
      },
    });
  });
});

test('media request summary route resolves authenticated scope and returns the shared summary payload', async (t) => {
  const requireSession = t.mock.fn(async () => ({ appUserId: 'user-50', csrfToken: 'csrf-50', user: { role: 'requester' } }));
  const buildMediaRequestSummary = t.mock.fn(async ({ requestedByUserId }) => ({
    counts: {
      alreadyExists: 1,
      needsFetch: 2,
      needsReview: 0,
      totalRequests: 3,
    },
    recentRequests: [],
    summary: {
      message: `Summary for ${requestedByUserId}`,
      status: 'active',
    },
  }));
  const app = createLibraryRouteTestApp({ buildMediaRequestSummary, requireSession });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/library/media-request-summary`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(buildMediaRequestSummary.mock.calls[0].arguments, [{ requestedByUserId: 'user-50' }]);
    assert.equal(payload.scope, 'mine');
    assert.equal(payload.summary.message, 'Summary for user-50');
  });
});

test('library organize apply route requires admin csrf and starts queued organize execution', async (t) => {
  const requireFreshAdminSession = t.mock.fn(async () => ({ appUserId: 'admin-7', csrfToken: 'csrf-7', user: { role: 'admin' } }));
  const requireCsrf = t.mock.fn();
  const startLibraryOrganizeApplyRun = t.mock.fn(async ({ requestMetadata, triggeredByUserId }) => ({
    accepted: true,
    run: {
      id: 'organize-run-2',
      status: 'pending',
      triggeredByUserId,
      requestMetadata,
    },
  }));
  const app = createLibraryRouteTestApp({
    requireCsrf,
    requireFreshAdminSession,
    startLibraryOrganizeApplyRun,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/library/organize-runs`, {
      method: 'POST',
      headers: {
        'x-csrf-token': 'csrf-7',
        'x-forwarded-for': '203.0.113.22',
        'user-agent': 'HarmoniarrLibraryTest/1.0',
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 202);
    assert.equal(requireFreshAdminSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.equal(startLibraryOrganizeApplyRun.mock.callCount(), 1);
    assert.deepEqual(startLibraryOrganizeApplyRun.mock.calls[0].arguments[0], {
      requestMetadata: {
        ipAddress: '203.0.113.22',
        userAgent: 'HarmoniarrLibraryTest/1.0',
      },
      triggeredByUserId: 'admin-7',
    });
    assert.equal(payload.ok, true);
    assert.equal(payload.run.id, 'organize-run-2');
  });
});

test('media request list route allows admins to read all requests', async (t) => {
  const requireSession = t.mock.fn(async () => ({ appUserId: 'admin-1', csrfToken: 'csrf-admin', user: { role: 'admin' } }));
  const listMediaRequests = t.mock.fn(async () => [{ id: 'request-2' }]);
  const app = createLibraryRouteTestApp({ listMediaRequests, requireSession });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/library/media-requests?scope=all`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(listMediaRequests.mock.calls[0].arguments, [{ requestedByUserId: null }]);
    assert.equal(payload.scope, 'all');
    assert.deepEqual(payload.mediaRequests, [{ id: 'request-2' }]);
  });
});

test('media request create route passes session ownership and request metadata to the shared service', async (t) => {
  const requireSession = t.mock.fn(async () => ({ appUserId: 'user-51', csrfToken: 'csrf-51', user: { role: 'requester' } }));
  const requireCsrf = t.mock.fn();
  const createMediaRequest = t.mock.fn(async ({ actorUserId, payload }) => ({
    id: 'request-3',
    requestKind: payload.requestKind,
    requestState: 'needs_fetch',
    requestedByUser: {
      id: actorUserId,
      role: 'requester',
      username: 'listener',
    },
  }));
  const app = createLibraryRouteTestApp({ createMediaRequest, requireCsrf, requireSession });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/library/media-requests`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-51',
        'x-forwarded-for': '198.51.100.91',
        'user-agent': 'HarmoniarrMediaRequestRouteTest/1.0',
      },
      body: JSON.stringify({
        artistName: 'Daft Punk',
        releaseTitle: 'Discovery',
        requestKind: 'release',
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(requireSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.deepEqual(createMediaRequest.mock.calls[0].arguments, [{
      actorUserId: 'user-51',
      payload: {
        artistName: 'Daft Punk',
        releaseTitle: 'Discovery',
        requestKind: 'release',
      },
      requestMetadata: {
        ipAddress: '198.51.100.91',
        userAgent: 'HarmoniarrMediaRequestRouteTest/1.0',
      },
    }]);
    assert.equal(payload.ok, true);
    assert.equal(payload.mediaRequest.id, 'request-3');
  });
});

test('library discovery run detail route requires a session and returns the exact run payload', async (t) => {
  const requireSession = t.mock.fn(async () => ({ appUserId: 'user-20', csrfToken: 'csrf-20' }));
  const buildLibraryDiscoveryRunDetail = t.mock.fn(async ({ runId }) => ({
    checkedAt: '2026-05-01T00:00:00.000Z',
    run: {
      id: runId,
      status: 'failed',
    },
  }));
  const app = createLibraryRouteTestApp({
    buildLibraryDiscoveryRunDetail,
    requireSession,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/library/discovery-runs/discovery-run-4`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireSession.mock.callCount(), 1);
    assert.deepEqual(buildLibraryDiscoveryRunDetail.mock.calls[0].arguments, [{ runId: 'discovery-run-4' }]);
    assert.deepEqual(payload, {
      ok: true,
      libraryDiscoveryRun: {
        checkedAt: '2026-05-01T00:00:00.000Z',
        run: {
          id: 'discovery-run-4',
          status: 'failed',
        },
      },
    });
  });
});

test('library discovery run start route requires a session and returns the accepted run payload', async (t) => {
  const requireFreshAdminSession = t.mock.fn(async () => ({ appUserId: 'user-23', csrfToken: 'csrf-23', user: { role: 'admin' } }));
  const requireCsrf = t.mock.fn();
  const startLibraryDiscoveryRun = t.mock.fn(async ({ requestMetadata, triggeredByUserId }) => ({
    accepted: true,
    run: {
      id: 'discovery-run-4',
      requestMetadata,
      status: 'pending',
      triggeredByUserId,
    },
  }));
  const app = createLibraryRouteTestApp({ requireCsrf, requireFreshAdminSession, startLibraryDiscoveryRun });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/library/discovery-runs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-23',
        'x-forwarded-for': '198.51.100.44',
        'user-agent': 'HarmoniarrLibraryDiscoveryRouteTest/1.0',
      },
      body: JSON.stringify({}),
    });
    const payload = await response.json();

    assert.equal(response.status, 202);
    assert.equal(requireFreshAdminSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.deepEqual(startLibraryDiscoveryRun.mock.calls[0].arguments, [{
      requestMetadata: {
        ipAddress: '198.51.100.44',
        userAgent: 'HarmoniarrLibraryDiscoveryRouteTest/1.0',
      },
      triggeredByUserId: 'user-23',
    }]);
    assert.deepEqual(payload, {
      ok: true,
      accepted: true,
      run: {
        id: 'discovery-run-4',
        requestMetadata: {
          ipAddress: '198.51.100.44',
          userAgent: 'HarmoniarrLibraryDiscoveryRouteTest/1.0',
        },
        status: 'pending',
        triggeredByUserId: 'user-23',
      },
    });
  });
});

test('library scan run detail route requires a session and returns the exact run payload', async (t) => {
  const requireSession = t.mock.fn(async () => ({ appUserId: 'user-24', csrfToken: 'csrf-24' }));
  const buildLibraryScanRunDetail = t.mock.fn(async ({ runId }) => ({
    checkedAt: '2026-05-01T00:05:00.000Z',
    run: {
      id: runId,
      status: 'completed',
    },
  }));
  const app = createLibraryRouteTestApp({
    buildLibraryScanRunDetail,
    requireSession,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/library/scan-runs/scan-run-1`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireSession.mock.callCount(), 1);
    assert.deepEqual(buildLibraryScanRunDetail.mock.calls[0].arguments, [{ runId: 'scan-run-1' }]);
    assert.deepEqual(payload, {
      ok: true,
      libraryScanRun: {
        checkedAt: '2026-05-01T00:05:00.000Z',
        run: {
          id: 'scan-run-1',
          status: 'completed',
        },
      },
    });
  });
});

test('library reconciliation summary route requires a session and returns the shared summary payload', async (t) => {
  const requireSession = t.mock.fn(async () => ({ appUserId: 'user-17', csrfToken: 'csrf-17' }));
  const buildLibraryReconciliationSummary = t.mock.fn(async () => ({
    fileCounts: {
      ambiguous: 1,
      ignored: 0,
      matched: 8,
      observed: 9,
      unmatched: 0,
    },
    lastReconciledAt: '2026-04-30T12:40:00.000Z',
    releaseCounts: {
      complete: 3,
      duplicate: 0,
      partial: 1,
    },
    summary: {
      status: 'partial',
      message: '1 release is partially satisfied by the current library.',
    },
  }));
  const app = createLibraryRouteTestApp({
    buildLibraryReconciliationSummary,
    requireSession,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/library/reconciliation-summary`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireSession.mock.callCount(), 1);
    assert.equal(buildLibraryReconciliationSummary.mock.callCount(), 1);
    assert.deepEqual(payload, {
      fileCounts: {
        ambiguous: 1,
        ignored: 0,
        matched: 8,
        observed: 9,
        unmatched: 0,
      },
      lastReconciledAt: '2026-04-30T12:40:00.000Z',
      releaseCounts: {
        complete: 3,
        duplicate: 0,
        partial: 1,
      },
      summary: {
        status: 'partial',
        message: '1 release is partially satisfied by the current library.',
      },
    });
  });
});

test('library organize preview route requires a session and returns the shared planning payload', async (t) => {
  const requireSession = t.mock.fn(async () => ({ appUserId: 'user-61', csrfToken: 'csrf-61' }));
  const buildLibraryOrganizePreview = t.mock.fn(async () => ({
    checkedAt: '2026-05-01T00:10:00.000Z',
    counts: {
      alreadyCanonicalCount: 1,
      blockedAmbiguousCount: 0,
      blockedCount: 0,
      blockedDuplicateTargetCount: 0,
      blockedMissingMetadataCount: 0,
      blockedOutsideRootCount: 0,
      blockedUnmatchedCount: 0,
      blockedUnsupportedExtensionCount: 0,
      matchedFiles: 1,
      renameRequiredCount: 1,
      totalFiles: 2,
    },
    files: [],
    summary: {
      status: 'ready',
      message: '1 library file can be renamed or moved to match the canonical library layout.',
    },
  }));
  const app = createLibraryRouteTestApp({
    buildLibraryOrganizePreview,
    requireSession,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/library/organize-preview`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireSession.mock.callCount(), 1);
    assert.equal(buildLibraryOrganizePreview.mock.callCount(), 1);
    assert.deepEqual(payload, {
      checkedAt: '2026-05-01T00:10:00.000Z',
      counts: {
        alreadyCanonicalCount: 1,
        blockedAmbiguousCount: 0,
        blockedCount: 0,
        blockedDuplicateTargetCount: 0,
        blockedMissingMetadataCount: 0,
        blockedOutsideRootCount: 0,
        blockedUnmatchedCount: 0,
        blockedUnsupportedExtensionCount: 0,
        matchedFiles: 1,
        renameRequiredCount: 1,
        totalFiles: 2,
      },
      files: [],
      summary: {
        status: 'ready',
        message: '1 library file can be renamed or moved to match the canonical library layout.',
      },
    });
  });
});

test('library wanted summary route requires a session and returns the shared wanted payload', async (t) => {
  const requireSession = t.mock.fn(async () => ({ appUserId: 'user-21', csrfToken: 'csrf-21' }));
  const buildLibraryWantedSummary = t.mock.fn(async () => ({
    lastReconciledAt: '2026-04-30T13:20:00.000Z',
    monitoredArtistCount: 2,
    releaseCounts: {
      missing: 1,
      partial: 1,
      totalWanted: 2,
    },
    summary: {
      status: 'wanted',
      message: '2 monitored releases still need files, including fully missing and partially satisfied releases.',
    },
  }));
  const app = createLibraryRouteTestApp({
    buildLibraryWantedSummary,
    requireSession,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/library/wanted-summary`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireSession.mock.callCount(), 1);
    assert.equal(buildLibraryWantedSummary.mock.callCount(), 1);
    assert.deepEqual(payload, {
      lastReconciledAt: '2026-04-30T13:20:00.000Z',
      monitoredArtistCount: 2,
      releaseCounts: {
        missing: 1,
        partial: 1,
        totalWanted: 2,
      },
      summary: {
        status: 'wanted',
        message: '2 monitored releases still need files, including fully missing and partially satisfied releases.',
      },
    });
  });
});

test('library scan start route requires a session and returns the accepted run payload', async (t) => {
  const requireFreshAdminSession = t.mock.fn(async () => ({ appUserId: 'user-17', csrfToken: 'csrf-17', user: { role: 'admin' } }));
  const requireCsrf = t.mock.fn();
  const startLibraryScan = t.mock.fn(async ({ requestMetadata, triggeredByUserId }) => ({
    accepted: true,
    run: {
      id: 'run-4',
      requestMetadata,
      status: 'pending',
      triggeredByUserId,
    },
  }));
  const app = createLibraryRouteTestApp({ requireCsrf, requireFreshAdminSession, startLibraryScan });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/library/scan-runs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-17',
        'x-forwarded-for': '198.51.100.88',
        'user-agent': 'HarmoniarrLibraryRouteTest/1.0',
      },
      body: JSON.stringify({}),
    });
    const payload = await response.json();

    assert.equal(response.status, 202);
    assert.equal(requireFreshAdminSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.deepEqual(startLibraryScan.mock.calls[0].arguments, [{
      requestMetadata: {
        ipAddress: '198.51.100.88',
        userAgent: 'HarmoniarrLibraryRouteTest/1.0',
      },
      triggeredByUserId: 'user-17',
    }]);
    assert.deepEqual(payload, {
      ok: true,
      accepted: true,
      run: {
        id: 'run-4',
        requestMetadata: {
          ipAddress: '198.51.100.88',
          userAgent: 'HarmoniarrLibraryRouteTest/1.0',
        },
        status: 'pending',
        triggeredByUserId: 'user-17',
      },
    });
  });
});

test('library discovery run start route preserves forced re-auth failures from the injected admin guard', async () => {
  const app = createLibraryRouteTestApp({
    requireFreshAdminSession: async () => {
      throw createApiError(403, 'reauth_required', 'Re-authentication is required before continuing');
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/library/discovery-runs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const payload = await response.json();

    assert.equal(response.status, 403);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'reauth_required',
        message: 'Re-authentication is required before continuing',
      },
    });
  });
});

test('library discovery run start route preserves injected rate limit failures before the shared run service', async (t) => {
  const startLibraryDiscoveryRun = t.mock.fn(async () => ({ accepted: true }));
  const app = createLibraryRouteTestApp({
    limitLibraryDiscoveryRun: (_request, _response, next) => {
      next(createApiError(429, 'rate_limited', 'Too many requests. Try again later.'));
    },
    startLibraryDiscoveryRun,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/library/discovery-runs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const payload = await response.json();

    assert.equal(response.status, 429);
    assert.equal(startLibraryDiscoveryRun.mock.callCount(), 0);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'rate_limited',
        message: 'Too many requests. Try again later.',
      },
    });
  });
});

test('library scan start route forwards service errors to the api error handler', async () => {
  const app = createLibraryRouteTestApp({
    startLibraryScan: async () => {
      throw createApiError(409, 'library_scan_in_progress', 'A library scan is already running or queued');
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/library/scan-runs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-token',
      },
      body: JSON.stringify({}),
    });
    const payload = await response.json();

    assert.equal(response.status, 409);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'library_scan_in_progress',
        message: 'A library scan is already running or queued',
      },
    });
  });
});
