import assert from 'node:assert/strict';
import test from 'node:test';

import { validateDockerFreshInstall, validateDockerUpgradePath } from '../../scripts/docker-smoke-validation.js';

function createResponseHeaders({ setCookie } = {}) {
  return {
    get(name) {
      return String(name).toLowerCase() === 'set-cookie' ? (setCookie ?? null) : null;
    },
    getSetCookie() {
      return setCookie ? [setCookie] : [];
    },
  };
}

function createFetchResponse(body, status = 200, { setCookie } = {}) {
  return {
    headers: createResponseHeaders({ setCookie }),
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

function mergeSettings(currentSettings, patch) {
  return {
    ...currentSettings,
    ...patch,
    providers: {
      ...(currentSettings.providers ?? {}),
      ...(patch?.providers ?? {}),
    },
    system: {
      ...(currentSettings.system ?? {}),
      ...(patch?.system ?? {}),
    },
  };
}

function createSmokeApiFetchStub({
  initialSettings = {
    providers: {
      requestTimeoutMs: 15000,
    },
    system: {
      logLevel: 'info',
    },
  },
} = {}) {
  const calls = [];
  const activeLocks = [];
  const backupArtifacts = [];
  const mediaRequests = [];
  const sessions = new Map();
  const users = [];
  let nextLockId = 1;
  let nextRunId = 1;
  let nextRequestId = 1;
  let nextUserId = 1;
  let settings = structuredClone(initialSettings);

  function issueSession(user) {
    const sessionId = `session-${user.id}-${sessions.size + 1}`;
    sessions.set(sessionId, user);
    return `sid=${sessionId}; Path=/; HttpOnly`;
  }

  function resolveSessionUser(headers) {
    const cookieHeader = headers.get('cookie') ?? '';
    const sessionId = cookieHeader
      .split(';')
      .map((segment) => segment.trim())
      .find((segment) => segment.startsWith('sid='))
      ?.slice(4);

    return sessionId ? sessions.get(sessionId) ?? null : null;
  }

  function buildVisibleRequests(currentUser, scope) {
    if (currentUser?.role === 'admin' && scope === 'all') {
      return mediaRequests;
    }

    return mediaRequests.filter((request) => request.requestedForUser.id === currentUser?.id);
  }

  function buildFulfillmentStatus(request) {
    switch (request.requestState) {
      case 'already_exists':
        return {
          code: 'already_available',
          detail: 'This request already matched imported media.',
          label: 'Already available',
          occurredAt: request.updatedAt,
          tone: 'selected',
        };
      case 'needs_review':
        return {
          code: 'under_review',
          detail: 'Needs operator review before fetch can continue.',
          label: 'Needs review',
          occurredAt: request.updatedAt,
          tone: 'held',
        };
      default:
        return {
          code: 'queued',
          detail: 'Waiting for fetch and discovery follow-up.',
          label: 'Queued',
          occurredAt: request.updatedAt,
          tone: 'held',
        };
    }
  }

  function buildNotificationFeed(requests) {
    const notifications = [];

    for (const request of requests) {
      if (request.requestedByUser.id !== request.requestedForUser.id) {
        notifications.push({
          category: 'delegated_request',
          id: `media-request:${request.id}:delegated`,
          message: `${request.requestedByUser.username} requested ${request.artistName} - ${request.releaseTitle} for you.`,
          occurredAt: request.createdAt,
          severity: 'info',
          title: 'Music requested for you',
        });
      }

      notifications.push({
        category: 'fulfillment',
        id: `media-request:${request.id}:queued`,
        message: `${request.artistName} - ${request.releaseTitle} has been queued for fulfillment.`,
        occurredAt: request.updatedAt,
        severity: 'info',
        title: 'Request queued',
      });
    }

    return {
      checkedAt: '2026-05-04T12:05:00.000Z',
      counts: {
        byCategory: {
          delegated_request: notifications.filter((notification) => notification.category === 'delegated_request').length,
          failure: 0,
          fulfillment: notifications.filter((notification) => notification.category === 'fulfillment').length,
          review: 0,
        },
        total: notifications.length,
      },
      notifications,
    };
  }

  function buildSummaryPayload(currentUser, scope) {
    const resolvedScope = currentUser?.role === 'admin' && scope === 'all' ? 'all' : 'mine';
    const visibleRequests = buildVisibleRequests(currentUser, resolvedScope);
    const enrichedRequests = visibleRequests.map((request) => ({
      ...request,
      fulfillmentStatus: buildFulfillmentStatus(request),
    }));

    return {
      counts: {
        alreadyExists: enrichedRequests.filter((request) => request.requestState === 'already_exists').length,
        needsFetch: enrichedRequests.filter((request) => request.requestState === 'needs_fetch').length,
        needsReview: enrichedRequests.filter((request) => request.requestState === 'needs_review').length,
        totalRequests: enrichedRequests.length,
      },
      fulfillmentCounts: {
        active: enrichedRequests.filter((request) => request.fulfillmentStatus.code === 'queued').length,
        alreadyAvailable: 0,
        downloading: 0,
        failed: 0,
        fulfilled: 0,
        importPending: 0,
        queued: enrichedRequests.filter((request) => request.fulfillmentStatus.code === 'queued').length,
        satisfied: 0,
        totalRequests: enrichedRequests.length,
        underReview: enrichedRequests.filter((request) => request.fulfillmentStatus.code === 'under_review').length,
      },
      notificationFeed: buildNotificationFeed(enrichedRequests),
      ok: true,
      recentRequests: enrichedRequests,
      scope: resolvedScope,
      summary: {
        message: `${enrichedRequests.length} requests are waiting for fetch and import follow-up.`,
        status: 'active',
      },
    };
  }

  async function fetchFn(url, options = {}) {
    const method = String(options.method ?? 'GET').toUpperCase();
    const parsedUrl = new URL(url);
    const headers = new Headers(options.headers ?? {});
    const body = typeof options.body === 'string' && options.body.length > 0
      ? JSON.parse(options.body)
      : null;

    calls.push({
      body,
      headers,
      method,
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
    });

    const currentUser = resolveSessionUser(headers);

    if (parsedUrl.pathname === '/healthz') {
      return createFetchResponse({
        ok: true,
        pendingMigrations: 0,
        service: 'ok',
      });
    }

    if (parsedUrl.pathname === '/api/v1/bootstrap/admin' && method === 'POST') {
      const adminUser = {
        id: 'admin-1',
        password: body?.password ?? 'DockerSmokePass123!',
        role: 'admin',
        username: body?.username ?? 'smoke-admin',
      };
      users.splice(0, users.length, adminUser);

      return createFetchResponse({
        csrfToken: 'csrf-bootstrap',
        ok: true,
        user: {
          username: adminUser.username,
        },
      }, 201, {
        setCookie: issueSession(adminUser),
      });
    }

    if (parsedUrl.pathname === '/api/v1/auth/login' && method === 'POST') {
      const matchedUser = users.find((user) => user.username === body?.username && user.password === body?.password);

      if (!matchedUser) {
        return createFetchResponse({
          error: {
            code: 'invalid_credentials',
            message: 'Invalid credentials',
          },
          ok: false,
        }, 401);
      }

      return createFetchResponse({
        csrfToken: `csrf-${matchedUser.username}`,
        ok: true,
        user: {
          username: matchedUser.username,
        },
      }, 200, {
        setCookie: issueSession(matchedUser),
      });
    }

    if (!currentUser) {
      return createFetchResponse({
        error: {
          code: 'auth_required',
          message: 'Auth required',
        },
        ok: false,
      }, 401);
    }

    if (parsedUrl.pathname === '/api/v1/settings' && method === 'GET') {
      return createFetchResponse({
        ok: true,
        settings,
      });
    }

    if (parsedUrl.pathname === '/api/v1/settings' && method === 'PUT') {
      settings = mergeSettings(settings, body ?? {});
      return createFetchResponse({
        ok: true,
        settings,
        updates: [],
      });
    }

    if (parsedUrl.pathname === '/api/v1/users' && method === 'POST') {
      const user = {
        id: `user-${nextUserId++}`,
        password: body?.password,
        role: body?.role ?? 'requester',
        username: body?.username ?? `user-${nextUserId}`,
      };
      users.push(user);

      return createFetchResponse({
        ok: true,
        roleOptions: [],
        user: {
          id: user.id,
          role: user.role,
          username: user.username,
        },
      }, 201);
    }

    if (parsedUrl.pathname === '/api/v1/library/media-requests' && method === 'POST') {
      const requestedForUser = users.find((user) => user.id === body?.requestedForUserId) ?? currentUser;
      const request = {
        artistName: body?.artistName ?? null,
        createdAt: '2026-05-04T12:03:00.000Z',
        id: `request-${nextRequestId++}`,
        releaseTitle: body?.releaseTitle ?? null,
        requestKind: body?.requestKind ?? 'release',
        requestState: 'needs_fetch',
        requestedByUser: {
          id: currentUser.id,
          role: currentUser.role,
          username: currentUser.username,
        },
        requestedForUser: {
          id: requestedForUser.id,
          role: requestedForUser.role,
          username: requestedForUser.username,
        },
        updatedAt: '2026-05-04T12:03:00.000Z',
      };
      mediaRequests.push(request);

      return createFetchResponse({
        mediaRequest: request,
        ok: true,
      }, 201);
    }

    if (parsedUrl.pathname === '/api/v1/library/media-request-summary' && method === 'GET') {
      return createFetchResponse(buildSummaryPayload(currentUser, parsedUrl.searchParams.get('scope') ?? 'mine'));
    }

    if (parsedUrl.pathname === '/api/v1/library/media-requests' && method === 'GET') {
      const scope = parsedUrl.searchParams.get('scope') ?? 'mine';
      const summaryPayload = buildSummaryPayload(currentUser, scope);

      return createFetchResponse({
        mediaRequests: summaryPayload.recentRequests,
        ok: true,
        scope: summaryPayload.scope,
      });
    }

    if (parsedUrl.pathname === '/api/v1/recovery/backups' && method === 'POST') {
      const artifact = {
        filename: 'harmoniarr_backup_2026-05-04T12-00-00-000Z.json',
        formatVersion: '1',
        id: `backup-${backupArtifacts.length + 1}`,
      };
      backupArtifacts.push(artifact);
      return createFetchResponse({
        accepted: true,
        backupArtifact: artifact,
        ok: true,
      }, 202);
    }

    if (parsedUrl.pathname === '/api/v1/recovery/backups' && method === 'GET') {
      return createFetchResponse({
        backupArtifacts,
        checkedAt: '2026-05-04T12:01:00.000Z',
        ok: true,
      });
    }

    if (parsedUrl.pathname === '/api/v1/recovery/maintenance-locks' && method === 'GET') {
      return createFetchResponse({
        activeLocks,
        lockCount: activeLocks.length,
        ok: true,
      });
    }

    if (parsedUrl.pathname === '/api/v1/recovery/maintenance-locks' && method === 'POST') {
      const lock = {
        id: `lock-${nextLockId++}`,
        lockType: body?.lockType ?? 'maintenance',
        reason: body?.reason ?? null,
        status: 'active',
      };
      activeLocks.push(lock);
      return createFetchResponse({
        lock,
        ok: true,
      }, 202);
    }

    if (parsedUrl.pathname.startsWith('/api/v1/recovery/maintenance-locks/') && parsedUrl.pathname.endsWith('/release') && method === 'POST') {
      const lockId = parsedUrl.pathname.split('/')[5];
      const activeLockIndex = activeLocks.findIndex((lock) => lock.id === lockId);
      const [releasedLock] = activeLockIndex >= 0 ? activeLocks.splice(activeLockIndex, 1) : [null];

      return createFetchResponse({
        lock: {
          ...(releasedLock ?? { id: lockId, lockType: 'maintenance' }),
          status: 'released',
        },
        ok: true,
      });
    }

    if (parsedUrl.pathname.startsWith('/api/v1/recovery/backups/') && parsedUrl.pathname.endsWith('/restore-preview') && method === 'GET') {
      const backupArtifactId = parsedUrl.pathname.split('/')[5];
      const artifact = backupArtifacts.find((entry) => entry.id === backupArtifactId);
      return createFetchResponse({
        backupArtifact: artifact,
        canApplyRestore: activeLocks.length === 0,
        compatibility: {
          checks: [],
          compatible: true,
        },
        integrity: {
          actualPayloadSha256: `sha-${backupArtifactId}`,
          expectedPayloadSha256: `sha-${backupArtifactId}`,
          status: 'passed',
        },
        ok: true,
        restoreReadiness: {
          blockedByLock: activeLocks.length > 0,
          blockingLocks: activeLocks,
        },
      });
    }

    if (parsedUrl.pathname.startsWith('/api/v1/recovery/backups/') && parsedUrl.pathname.endsWith('/restore-apply') && method === 'POST') {
      if (activeLocks.length > 0) {
        return createFetchResponse({
          error: {
            code: 'recovery_lock_conflict',
            message: 'A conflicting maintenance lock prevents restore apply',
          },
          ok: false,
        }, 409);
      }

      return createFetchResponse({
        accepted: true,
        ok: true,
        restoreResult: {
          appliedScopes: ['settings'],
          settingsUpdated: true,
        },
        run: {
          id: `run-${nextRunId++}`,
          status: 'completed',
        },
      }, 202);
    }

    if (parsedUrl.pathname.startsWith('/api/v1/recovery/backups/') && method === 'GET') {
      const backupArtifactId = parsedUrl.pathname.split('/')[5];
      const artifact = backupArtifacts.find((entry) => entry.id === backupArtifactId);
      return createFetchResponse({
        backupArtifact: artifact,
        ok: true,
      });
    }

    throw new Error(`Unexpected fetch invocation: ${method} ${parsedUrl.pathname}${parsedUrl.search}`);
  }

  return {
    calls,
    fetchFn,
  };
}

function createRunCommandStub({
  failureComposeExitCode = 1,
  failureLogs = '[harmoniarr] startup failed: HARMONIARR_BOOTSTRAP_OWNER_CLAIM_CODE is required when HARMONIARR_BOOTSTRAP_OWNER_USERNAME or HARMONIARR_BOOTSTRAP_OWNER_EMAIL is configured.',
  failureServiceState = { ExitCode: 1, Status: 'exited' },
  ffmpegVersion = 'ffmpeg version 7.1.1',
  ffprobeVersion = 'ffprobe version 7.1.1',
  logs = '[harmoniarr-entrypoint] initializing embedded PostgreSQL cluster at /app/data/postgres/18/data\n[harmoniarr-entrypoint] starting embedded PostgreSQL on 127.0.0.1:5432\n[harmoniarr-entrypoint] preparing database state\n[harmoniarr] loaded schema snapshot from src/server/schema-snapshot.sql',
  migrationCheckOutput = 'No pending migrations remain.',
  postgresIdentity = 'harmoniarr|harmoniarr',
  postgresPersistenceCount = '1',
  postgresReadyMessage = '127.0.0.1:5432 - accepting connections',
  restartLogs = '[harmoniarr-entrypoint] starting embedded PostgreSQL on 127.0.0.1:5432\n[harmoniarr-entrypoint] preparing database state',
} = {}) {
  const calls = [];
  let successfulStartupCount = 0;

  async function runCommandFn({ args, command, cwd, env }) {
    calls.push({ args, command, cwd, env });

    if (command !== 'docker') {
      throw new Error(`Unexpected command: ${command}`);
    }

    const joinedArgs = args.join(' ');
    const isComposeCommand = args[0] === 'compose';

    if (isComposeCommand && args.includes('up')) {
      if (args.includes('--abort-on-container-failure')) {
        return { exitCode: failureComposeExitCode, stderr: '', stdout: '' };
      }

      successfulStartupCount += 1;

      return { exitCode: 0, stderr: '', stdout: '' };
    }

    if (isComposeCommand && args.includes('down')) {
      return { exitCode: 0, stderr: '', stdout: '' };
    }

    if (isComposeCommand && args.includes('ps') && (args.includes('-q') || args.includes('-aq')) && args.at(-1) === 'harmoniarr') {
      return { exitCode: 0, stderr: '', stdout: 'container-123\n' };
    }

    if (args[0] === 'inspect' && args.includes('{{json .HostConfig.ReadonlyRootfs}}')) {
      return { exitCode: 0, stderr: '', stdout: 'true\n' };
    }

    if (args[0] === 'inspect' && args.includes('{{json .State}}')) {
      return { exitCode: 0, stderr: '', stdout: `${JSON.stringify(failureServiceState)}\n` };
    }

    if (isComposeCommand && args.includes('ffmpeg') && args.includes('-version')) {
      return {
        exitCode: 0,
        stderr: '',
        stdout: ffmpegVersion ? `${ffmpegVersion}\nconfiguration: ...\n` : '',
      };
    }

    if (isComposeCommand && args.includes('ffprobe') && args.includes('-version')) {
      return {
        exitCode: 0,
        stderr: '',
        stdout: ffprobeVersion ? `${ffprobeVersion}\nconfiguration: ...\n` : '',
      };
    }

    if (isComposeCommand && args.includes('pg_isready')) {
      return {
        exitCode: 0,
        stderr: '',
        stdout: `${postgresReadyMessage}\n`,
      };
    }

    if (isComposeCommand && args.includes('psql')) {
      const sql = args.at(-1) ?? '';

      if (sql.includes("SELECT current_database() || '|' || current_user")) {
        return {
          exitCode: 0,
          stderr: '',
          stdout: `${postgresIdentity}\n`,
        };
      }

      if (sql.includes('CREATE TABLE IF NOT EXISTS docker_smoke_persistence_probe')) {
        return { exitCode: 0, stderr: '', stdout: '' };
      }

      if (sql.includes('SELECT COUNT(*) FROM docker_smoke_persistence_probe')) {
        return {
          exitCode: 0,
          stderr: '',
          stdout: `${postgresPersistenceCount}\n`,
        };
      }
    }

    if (isComposeCommand && args.includes('logs')) {
      return {
        exitCode: 0,
        stderr: '',
        stdout: env?.HARMONIARR_BOOTSTRAP_OWNER_USERNAME === 'docker-smoke-owner'
          ? failureLogs
          : (successfulStartupCount > 1 ? restartLogs : logs),
      };
    }

    if (isComposeCommand && args.includes('/app/server-dist/check-migrations.js')) {
      return { exitCode: 0, stderr: '', stdout: `${migrationCheckOutput}\n` };
    }

    throw new Error(`Unexpected docker invocation: docker ${joinedArgs}`);
  }

  return {
    calls,
    runCommandFn,
  };
}

test('validateDockerFreshInstall verifies ffmpeg and ffprobe in the running image', async () => {
  const { calls, runCommandFn } = createRunCommandStub({
    ffmpegVersion: 'ffmpeg version 7.2.0-static',
    ffprobeVersion: 'ffprobe version 7.2.0-static',
  });
  const removedDirectories = [];

  const result = await validateDockerFreshInstall({
    fetchFn: async () => createFetchResponse({
      ok: true,
      pendingMigrations: 0,
      service: 'ok',
    }),
    getAvailablePortFn: async () => 4300,
    makeDirectoryLayoutFn: async () => ({
      appData: '/tmp/appdata',
      downloads: '/tmp/downloads',
      music: '/tmp/music',
      staging: '/tmp/staging',
      transcodeTemp: '/tmp/transcode-temp',
    }),
    mkdtempFn: async () => '/tmp/harmoniarr-smoke',
    processEnv: {},
    projectName: 'harmoniarrsmoke-test',
    removeFn: async (path) => {
      removedDirectories.push(path);
    },
    runCommandFn,
    tempRootDir: '/tmp',
    verifyExistingDataRestart: true,
  });

  assert.deepEqual(result.existingDataRestart?.embeddedPostgres, {
    databaseName: 'harmoniarr',
    readyMessage: '127.0.0.1:5432 - accepting connections',
    user: 'harmoniarr',
  });
  assert.deepEqual(result.embeddedPostgresPersistence, {
    persisted: true,
    probeKey: 'probe_harmoniarrsmoke-test',
    rowCount: 1,
  });
  assert.deepEqual(result.freshInstall.mediaTooling, {
    ffmpegVersion: 'ffmpeg version 7.2.0-static',
    ffprobeVersion: 'ffprobe version 7.2.0-static',
  });
  assert.deepEqual(result.startupFailure, {
    composeExitCode: 1,
    expectedLogSnippet: 'HARMONIARR_BOOTSTRAP_OWNER_CLAIM_CODE is required when HARMONIARR_BOOTSTRAP_OWNER_USERNAME or HARMONIARR_BOOTSTRAP_OWNER_EMAIL is configured.',
    serviceExitCode: 1,
    serviceStatus: 'exited',
  });
  assert.equal(removedDirectories[0], '/tmp/harmoniarr-smoke');

  const execCalls = calls
    .filter(({ args }) => args.includes('exec'))
    .map(({ args }) => args.join(' '));

  assert.ok(execCalls.some((command) => command.includes(' ffmpeg -version')));
  assert.ok(execCalls.some((command) => command.includes(' ffprobe -version')));
  assert.ok(execCalls.filter((command) => command.includes(' pg_isready ')).length >= 2);
  assert.ok(execCalls.filter((command) => command.includes("SELECT current_database() || '|' || current_user")).length >= 2);
  assert.ok(execCalls.some((command) => command.includes('node /app/server-dist/check-migrations.js')));
  assert.ok(execCalls.some((command) => command.includes('CREATE TABLE IF NOT EXISTS docker_smoke_persistence_probe')));
  assert.ok(execCalls.some((command) => command.includes("SELECT COUNT(*) FROM docker_smoke_persistence_probe WHERE probe_key = 'probe_harmoniarrsmoke-test'")));

  assert.ok(calls.some(({ args }) => args.includes('--abort-on-container-failure')));
  assert.ok(calls.some(({ args }) => args.includes('{{json .State}}')));
});

test('validateDockerFreshInstall fails when a tooling version probe returns no version line', async () => {
  const { runCommandFn } = createRunCommandStub({
    ffprobeVersion: '',
  });

  await assert.rejects(
    () => validateDockerFreshInstall({
      fetchFn: async () => createFetchResponse({
        ok: true,
        pendingMigrations: 0,
        service: 'ok',
      }),
      getAvailablePortFn: async () => 4301,
      makeDirectoryLayoutFn: async () => ({
        appData: '/tmp/appdata',
        downloads: '/tmp/downloads',
        music: '/tmp/music',
        staging: '/tmp/staging',
        transcodeTemp: '/tmp/transcode-temp',
      }),
      mkdtempFn: async () => '/tmp/harmoniarr-smoke',
      processEnv: {},
      projectName: 'harmoniarrsmoke-test',
      removeFn: async () => {},
      runCommandFn,
      tempRootDir: '/tmp',
    }),
    /could not read a version line from ffprobe -version/,
  );
});

test('validateDockerFreshInstall fails when the existing-data restart reinitializes embedded PostgreSQL', async () => {
  const { runCommandFn } = createRunCommandStub({
    restartLogs: '[harmoniarr-entrypoint] initializing embedded PostgreSQL cluster at /app/data/postgres/18/data\n[harmoniarr-entrypoint] starting embedded PostgreSQL on 127.0.0.1:5432\n[harmoniarr-entrypoint] preparing database state',
  });

  await assert.rejects(
    () => validateDockerFreshInstall({
      fetchFn: async () => createFetchResponse({
        ok: true,
        pendingMigrations: 0,
        service: 'ok',
      }),
      getAvailablePortFn: async () => 4303,
      makeDirectoryLayoutFn: async () => ({
        appData: '/tmp/appdata',
        downloads: '/tmp/downloads',
        music: '/tmp/music',
        staging: '/tmp/staging',
        transcodeTemp: '/tmp/transcode-temp',
      }),
      mkdtempFn: async () => '/tmp/harmoniarr-smoke',
      processEnv: {},
      projectName: 'harmoniarrsmoke-test',
      removeFn: async () => {},
      runCommandFn,
      tempRootDir: '/tmp',
      verifyExistingDataRestart: true,
    }),
    /unexpectedly reinitialized the embedded PostgreSQL cluster/,
  );
});

test('validateDockerFreshInstall fails when the invalid-startup scenario does not emit the expected refusal log', async () => {
  const { runCommandFn } = createRunCommandStub({
    failureLogs: '[harmoniarr] startup failed: unexpected startup error',
  });

  await assert.rejects(
    () => validateDockerFreshInstall({
      fetchFn: async () => createFetchResponse({
        ok: true,
        pendingMigrations: 0,
        service: 'ok',
      }),
      getAvailablePortFn: async () => 4302,
      makeDirectoryLayoutFn: async () => ({
        appData: '/tmp/appdata',
        downloads: '/tmp/downloads',
        music: '/tmp/music',
        staging: '/tmp/staging',
        transcodeTemp: '/tmp/transcode-temp',
      }),
      mkdtempFn: async () => '/tmp/harmoniarr-smoke',
      processEnv: {},
      projectName: 'harmoniarrsmoke-test',
      removeFn: async () => {},
      runCommandFn,
      tempRootDir: '/tmp',
    }),
    /did not observe the expected startup-refusal log/,
  );
});

test('validateDockerFreshInstall validates backup export and restore preview/apply through the running control plane', async () => {
  const { fetchFn } = createSmokeApiFetchStub();
  const { runCommandFn } = createRunCommandStub();

  const result = await validateDockerFreshInstall({
    fetchFn,
    getAvailablePortFn: async () => 4304,
    makeDirectoryLayoutFn: async () => ({
      appData: '/tmp/appdata',
      downloads: '/tmp/downloads',
      music: '/tmp/music',
      staging: '/tmp/staging',
      transcodeTemp: '/tmp/transcode-temp',
    }),
    mkdtempFn: async () => '/tmp/harmoniarr-smoke',
    processEnv: {},
    projectName: 'harmoniarrsmoke-test',
    removeFn: async () => {},
    runCommandFn,
    tempRootDir: '/tmp',
    verifyBackupRestoreFlow: true,
  });

  assert.deepEqual(result.backupRestoreFlow, {
    appliedScopes: ['settings'],
    backupArtifactFilename: 'harmoniarr_backup_2026-05-04T12-00-00-000Z.json',
    backupArtifactId: 'backup-1',
    blockedRestoreApplyCode: 'recovery_lock_conflict',
    createdArtifactCount: 1,
    initialLockCount: 0,
    postApplyLockCount: 0,
    restoreApplyRunId: 'run-1',
    restoreApplyStatus: 'completed',
    restorePreviewChecksum: 'sha-backup-1',
    restorePreviewCompatibility: true,
  });
});

test('validateDockerFreshInstall validates delegated request music summary and notifications through the running control plane', async () => {
  const { fetchFn } = createSmokeApiFetchStub();
  const { runCommandFn } = createRunCommandStub();

  const result = await validateDockerFreshInstall({
    fetchFn,
    getAvailablePortFn: async () => 4306,
    makeDirectoryLayoutFn: async () => ({
      appData: '/tmp/appdata',
      downloads: '/tmp/downloads',
      music: '/tmp/music',
      staging: '/tmp/staging',
      transcodeTemp: '/tmp/transcode-temp',
    }),
    mkdtempFn: async () => '/tmp/harmoniarr-smoke',
    processEnv: {},
    projectName: 'harmoniarrsmoke-test',
    removeFn: async () => {},
    runCommandFn,
    tempRootDir: '/tmp',
    verifyRequestMusicFlow: true,
  });

  assert.deepEqual(result.requestMusicFlow, {
    delegatedRequestId: 'request-1',
    fulfillmentCode: 'queued',
    listCount: 1,
    listScope: 'mine',
    notificationTitles: ['Music requested for you', 'Request queued'],
    requestedByUsername: 'smoke-admin',
    requestedForUsername: 'smoke-listener',
    summaryScope: 'mine',
  });
});

test('validateDockerUpgradePath validates persisted settings across a baseline-to-candidate upgrade', async () => {
  const { fetchFn } = createSmokeApiFetchStub();
  const { calls, runCommandFn } = createRunCommandStub();

  const result = await validateDockerUpgradePath({
    baselineImageRef: 'ghcr.io/example/harmoniarr:v0.0.9',
    fetchFn,
    getAvailablePortFn: async () => 4305,
    makeDirectoryLayoutFn: async () => ({
      appData: '/tmp/appdata',
      downloads: '/tmp/downloads',
      music: '/tmp/music',
      staging: '/tmp/staging',
      transcodeTemp: '/tmp/transcode-temp',
    }),
    mkdtempFn: async () => '/tmp/harmoniarr-upgrade',
    processEnv: {},
    projectName: 'harmoniarrupgrade-test',
    removeFn: async () => {},
    runCommandFn,
    tempRootDir: '/tmp',
  });

  assert.equal(result.baselineImageRef, 'ghcr.io/example/harmoniarr:v0.0.9');
  assert.equal(result.candidateImageRef, null);
  assert.deepEqual(result.settingsPersistence, {
    baselineLogLevel: 'debug',
    expectedLogLevel: 'debug',
    observedLogLevel: 'debug',
    persisted: true,
  });
  assert.equal(result.baselineRuntime.sawBootstrapLog, true);
  assert.equal(result.upgradedRuntime.sawBootstrapLog, false);

  const composeUpCalls = calls.filter(({ args }) => args.includes('up'));
  assert.equal(composeUpCalls.length, 2);
  assert.ok(composeUpCalls[0].args.includes('--no-build'));
  assert.ok(composeUpCalls[1].args.includes('--build'));
});
