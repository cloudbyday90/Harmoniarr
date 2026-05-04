/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { once } from 'node:events';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSessionHttpClient } from '../src/shared/http-session-client.js';
import { runBufferedCommand } from './process-runtime.js';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const embeddedPostgresInitLogSnippet = 'initializing embedded PostgreSQL cluster at';
const embeddedPostgresPrepareLogSnippet = 'preparing database state';
const embeddedPostgresStartLogSnippet = 'starting embedded PostgreSQL on 127.0.0.1:';
const schemaBootstrapLogSnippet = 'loaded schema snapshot from';
const harmoniarrServiceName = 'harmoniarr';
const defaultSessionRequestTimeoutMs = 15_000;
const defaultSmokeAdminCredentials = Object.freeze({
  password: 'DockerSmokePass123!',
  username: 'smoke-admin',
});
const defaultSmokeRequestTargetCredentials = Object.freeze({
  password: 'DockerSmokeListener123!',
  role: 'requester',
  username: 'smoke-listener',
});
const defaultUpgradeSettingsProbe = Object.freeze({
  system: {
    logLevel: 'debug',
  },
});
const defaultStartupValidationFailureScenario = Object.freeze({
  env: {
    HARMONIARR_BOOTSTRAP_OWNER_CLAIM_CODE: '',
    HARMONIARR_BOOTSTRAP_OWNER_EMAIL: '',
    HARMONIARR_BOOTSTRAP_OWNER_USERNAME: 'docker-smoke-owner',
  },
  expectedLogSnippet: 'HARMONIARR_BOOTSTRAP_OWNER_CLAIM_CODE is required when HARMONIARR_BOOTSTRAP_OWNER_USERNAME or HARMONIARR_BOOTSTRAP_OWNER_EMAIL is configured.',
});

function createProjectName(prefix = 'harmoniarrsmoke') {
  return `${prefix}${Date.now()}`;
}

function buildValidationBaseUrl(port) {
  return `http://127.0.0.1:${port}`;
}

function getPayloadErrorSummary(payload) {
  const errorCode = typeof payload?.error?.code === 'string' ? payload.error.code : null;
  const errorMessage = typeof payload?.error?.message === 'string' ? payload.error.message : null;

  if (!errorCode && !errorMessage) {
    return '';
  }

  if (errorCode && errorMessage) {
    return ` (${errorCode}: ${errorMessage})`;
  }

  return ` (${errorCode ?? errorMessage})`;
}

function assertJsonResponseStatus({ expectedStatus, label, payload, response }) {
  if (response.status !== expectedStatus) {
    throw new Error(
      `Docker smoke validation expected ${label} to return HTTP ${expectedStatus}, but received ${response.status}${getPayloadErrorSummary(payload)}`,
    );
  }
}

function createValidationSessionClient({ fetchFn, port, requestTimeoutMs = defaultSessionRequestTimeoutMs } = {}) {
  return createSessionHttpClient(buildValidationBaseUrl(port), {
    fetchFn,
    requestTimeoutMs,
  });
}

function buildValidationIdempotencyKey(projectName, scope) {
  return `docker-smoke-${scope}-${projectName}`;
}

async function bootstrapSmokeAdminSession({
  client,
  credentials = defaultSmokeAdminCredentials,
} = {}) {
  const response = await client.requestJson('/api/v1/bootstrap/admin', {
    json: {
      password: credentials.password,
      username: credentials.username,
    },
    method: 'POST',
  });

  assertJsonResponseStatus({
    expectedStatus: 201,
    label: 'bootstrap-admin session creation',
    payload: response.payload,
    response: response.response,
  });

  if (response.payload?.ok !== true || response.payload?.user?.username !== credentials.username) {
    throw new Error('Docker smoke validation did not receive the expected bootstrap-admin session payload');
  }

  return response;
}

async function loginSmokeAdminSession({
  client,
  credentials = defaultSmokeAdminCredentials,
} = {}) {
  const response = await client.requestJson('/api/v1/auth/login', {
    json: {
      password: credentials.password,
      username: credentials.username,
    },
    method: 'POST',
  });

  assertJsonResponseStatus({
    expectedStatus: 200,
    label: 'admin login',
    payload: response.payload,
    response: response.response,
  });

  if (response.payload?.ok !== true || response.payload?.user?.username !== credentials.username) {
    throw new Error('Docker smoke validation did not receive the expected admin login payload');
  }

  return response;
}

async function createSmokeAppUser({
  client,
  credentials = defaultSmokeRequestTargetCredentials,
} = {}) {
  const response = await client.requestJson('/api/v1/users', {
    json: {
      password: credentials.password,
      role: credentials.role,
      username: credentials.username,
    },
    method: 'POST',
  });

  assertJsonResponseStatus({
    expectedStatus: 201,
    label: 'app-user creation',
    payload: response.payload,
    response: response.response,
  });

  if (response.payload?.ok !== true || response.payload?.user?.username !== credentials.username) {
    throw new Error('Docker smoke validation did not receive the expected app-user creation payload');
  }

  return response.payload.user;
}

async function createSmokeMediaRequest({
  client,
  payload,
} = {}) {
  const response = await client.requestJson('/api/v1/library/media-requests', {
    json: payload,
    method: 'POST',
  });

  assertJsonResponseStatus({
    expectedStatus: 201,
    label: 'media request creation',
    payload: response.payload,
    response: response.response,
  });

  if (response.payload?.ok !== true || typeof response.payload?.mediaRequest?.id !== 'string') {
    throw new Error('Docker smoke validation did not receive the expected media request creation payload');
  }

  return response.payload.mediaRequest;
}

async function getMediaRequestSummary({
  client,
  scope = 'mine',
} = {}) {
  const response = await client.requestJson(`/api/v1/library/media-request-summary?scope=${encodeURIComponent(scope)}`);

  assertJsonResponseStatus({
    expectedStatus: 200,
    label: 'media request summary read',
    payload: response.payload,
    response: response.response,
  });

  if (response.payload?.ok !== true || typeof response.payload?.scope !== 'string') {
    throw new Error('Docker smoke validation did not receive the expected media request summary payload');
  }

  return response.payload;
}

async function getMediaRequests({
  client,
  scope = 'mine',
} = {}) {
  const response = await client.requestJson(`/api/v1/library/media-requests?scope=${encodeURIComponent(scope)}`);

  assertJsonResponseStatus({
    expectedStatus: 200,
    label: 'media request list read',
    payload: response.payload,
    response: response.response,
  });

  if (response.payload?.ok !== true || !Array.isArray(response.payload?.mediaRequests)) {
    throw new Error('Docker smoke validation did not receive the expected media request list payload');
  }

  return response.payload;
}

async function getSettingsSnapshot({ client } = {}) {
  const response = await client.requestJson('/api/v1/settings');

  assertJsonResponseStatus({
    expectedStatus: 200,
    label: 'settings read',
    payload: response.payload,
    response: response.response,
  });

  if (response.payload?.ok !== true || typeof response.payload?.settings !== 'object' || !response.payload.settings) {
    throw new Error('Docker smoke validation did not receive the expected settings payload');
  }

  return response.payload.settings;
}

async function updateSettingsProbe({ client, settingsPatch = defaultUpgradeSettingsProbe } = {}) {
  const response = await client.requestJson('/api/v1/settings', {
    json: settingsPatch,
    method: 'PUT',
  });

  assertJsonResponseStatus({
    expectedStatus: 200,
    label: 'settings update',
    payload: response.payload,
    response: response.response,
  });

  if (response.payload?.ok !== true || typeof response.payload?.settings !== 'object' || !response.payload.settings) {
    throw new Error('Docker smoke validation did not receive the expected settings update payload');
  }

  return response.payload.settings;
}

async function getMaintenanceLockStatus({ client } = {}) {
  const response = await client.requestJson('/api/v1/recovery/maintenance-locks');

  assertJsonResponseStatus({
    expectedStatus: 200,
    label: 'maintenance lock status read',
    payload: response.payload,
    response: response.response,
  });

  return response.payload;
}

async function enterMaintenanceLock({ client, projectName } = {}) {
  const response = await client.requestJson('/api/v1/recovery/maintenance-locks', {
    headers: {
      'idempotency-key': buildValidationIdempotencyKey(projectName, 'maintenance-enter'),
    },
    json: {
      lockType: 'maintenance',
      reason: 'Docker smoke restore conflict validation',
    },
    method: 'POST',
  });

  assertJsonResponseStatus({
    expectedStatus: 202,
    label: 'maintenance lock entry',
    payload: response.payload,
    response: response.response,
  });

  if (response.payload?.ok !== true || typeof response.payload?.lock?.id !== 'string') {
    throw new Error('Docker smoke validation did not receive the expected maintenance lock payload');
  }

  return response.payload.lock;
}

async function releaseMaintenanceLock({ client, lockId, projectName } = {}) {
  const response = await client.requestJson(`/api/v1/recovery/maintenance-locks/${encodeURIComponent(lockId)}/release`, {
    headers: {
      'idempotency-key': buildValidationIdempotencyKey(projectName, 'maintenance-release'),
    },
    method: 'POST',
  });

  assertJsonResponseStatus({
    expectedStatus: 200,
    label: 'maintenance lock release',
    payload: response.payload,
    response: response.response,
  });

  if (response.payload?.ok !== true || response.payload?.lock?.status !== 'released') {
    throw new Error('Docker smoke validation did not observe the expected maintenance lock release payload');
  }

  return response.payload.lock;
}

async function createBackupArtifact({ client, projectName } = {}) {
  const response = await client.requestJson('/api/v1/recovery/backups', {
    headers: {
      'idempotency-key': buildValidationIdempotencyKey(projectName, 'backup-create'),
    },
    method: 'POST',
  });

  assertJsonResponseStatus({
    expectedStatus: 202,
    label: 'backup export creation',
    payload: response.payload,
    response: response.response,
  });

  if (response.payload?.ok !== true || typeof response.payload?.backupArtifact?.id !== 'string') {
    throw new Error('Docker smoke validation did not receive the expected backup artifact payload');
  }

  return response.payload.backupArtifact;
}

async function getBackupArtifacts({ client } = {}) {
  const response = await client.requestJson('/api/v1/recovery/backups?limit=10');

  assertJsonResponseStatus({
    expectedStatus: 200,
    label: 'backup export list',
    payload: response.payload,
    response: response.response,
  });

  return Array.isArray(response.payload?.backupArtifacts) ? response.payload.backupArtifacts : [];
}

async function getBackupArtifactDetail({ backupArtifactId, client } = {}) {
  const response = await client.requestJson(`/api/v1/recovery/backups/${encodeURIComponent(backupArtifactId)}`);

  assertJsonResponseStatus({
    expectedStatus: 200,
    label: 'backup export detail',
    payload: response.payload,
    response: response.response,
  });

  if (response.payload?.ok !== true || response.payload?.backupArtifact?.id !== backupArtifactId) {
    throw new Error('Docker smoke validation did not receive the expected backup artifact detail payload');
  }

  return response.payload.backupArtifact;
}

async function getBackupRestorePreview({ backupArtifactId, client } = {}) {
  const response = await client.requestJson(`/api/v1/recovery/backups/${encodeURIComponent(backupArtifactId)}/restore-preview`);

  assertJsonResponseStatus({
    expectedStatus: 200,
    label: 'backup restore preview',
    payload: response.payload,
    response: response.response,
  });

  if (response.payload?.ok !== true || response.payload?.backupArtifact?.id !== backupArtifactId) {
    throw new Error('Docker smoke validation did not receive the expected restore preview payload');
  }

  return response.payload;
}

async function startBackupRestoreApply({ backupArtifactId, client, expectedPayloadSha256, projectName } = {}) {
  const response = await client.requestJson(`/api/v1/recovery/backups/${encodeURIComponent(backupArtifactId)}/restore-apply`, {
    headers: {
      'idempotency-key': buildValidationIdempotencyKey(projectName, 'restore-apply'),
    },
    json: {
      expectedPayloadSha256,
    },
    method: 'POST',
  });

  assertJsonResponseStatus({
    expectedStatus: 202,
    label: 'backup restore apply',
    payload: response.payload,
    response: response.response,
  });

  if (
    response.payload?.ok !== true
    || response.payload?.accepted !== true
    || typeof response.payload?.run?.id !== 'string'
  ) {
    throw new Error('Docker smoke validation did not receive the expected restore-apply payload');
  }

  return response.payload;
}

async function validateBackupRestoreFlow({
  client = null,
  fetchFn,
  port,
  projectName,
  requestTimeoutMs = defaultSessionRequestTimeoutMs,
  smokeAdminCredentials = defaultSmokeAdminCredentials,
} = {}) {
  const sessionClient = client ?? createValidationSessionClient({
    fetchFn,
    port,
    requestTimeoutMs,
  });

  if (!client) {
    await bootstrapSmokeAdminSession({
      client: sessionClient,
      credentials: smokeAdminCredentials,
    });
  }

  const initialLockStatus = await getMaintenanceLockStatus({ client: sessionClient });
  const backupArtifact = await createBackupArtifact({ client: sessionClient, projectName });
  const backupArtifacts = await getBackupArtifacts({ client: sessionClient });
  const backupDetail = await getBackupArtifactDetail({
    backupArtifactId: backupArtifact.id,
    client: sessionClient,
  });
  const restorePreview = await getBackupRestorePreview({
    backupArtifactId: backupArtifact.id,
    client: sessionClient,
  });

  if (!backupArtifacts.some((artifact) => artifact?.id === backupArtifact.id)) {
    throw new Error(`Docker smoke validation did not observe backup artifact ${backupArtifact.id} in the backup inventory`);
  }

  if (restorePreview.integrity?.status !== 'passed' || restorePreview.compatibility?.compatible !== true || restorePreview.canApplyRestore !== true) {
    throw new Error('Docker smoke validation expected restore preview to be applicable before lock conflict injection');
  }

  const blockingLock = await enterMaintenanceLock({ client: sessionClient, projectName });
  const blockedRestorePreview = await getBackupRestorePreview({
    backupArtifactId: backupArtifact.id,
    client: sessionClient,
  });

  if (blockedRestorePreview.restoreReadiness?.blockedByLock !== true || blockedRestorePreview.canApplyRestore !== false) {
    throw new Error('Docker smoke validation expected restore preview to surface the injected maintenance-lock conflict');
  }

  const blockedRestoreApply = await sessionClient.requestJson(`/api/v1/recovery/backups/${encodeURIComponent(backupArtifact.id)}/restore-apply`, {
    headers: {
      'idempotency-key': buildValidationIdempotencyKey(projectName, 'restore-apply-blocked'),
    },
    json: {
      expectedPayloadSha256: restorePreview.integrity?.expectedPayloadSha256 ?? null,
    },
    method: 'POST',
  });

  assertJsonResponseStatus({
    expectedStatus: 409,
    label: 'blocked backup restore apply',
    payload: blockedRestoreApply.payload,
    response: blockedRestoreApply.response,
  });

  if (blockedRestoreApply.payload?.error?.code !== 'recovery_lock_conflict') {
    throw new Error('Docker smoke validation expected blocked restore apply to fail with recovery_lock_conflict');
  }

  await releaseMaintenanceLock({
    client: sessionClient,
    lockId: blockingLock.id,
    projectName,
  });

  const appliedRestore = await startBackupRestoreApply({
    backupArtifactId: backupArtifact.id,
    client: sessionClient,
    expectedPayloadSha256: restorePreview.integrity?.expectedPayloadSha256 ?? null,
    projectName,
  });
  const finalLockStatus = await getMaintenanceLockStatus({ client: sessionClient });
  const appliedScopes = Array.isArray(appliedRestore.restoreResult?.appliedScopes)
    ? appliedRestore.restoreResult.appliedScopes
    : [];

  if (appliedScopes.length === 0) {
    throw new Error('Docker smoke validation expected restore apply to report at least one applied scope');
  }

  if ((finalLockStatus.lockCount ?? finalLockStatus.activeLocks?.length ?? 0) !== 0) {
    throw new Error('Docker smoke validation expected restore apply and injected maintenance locks to be fully released');
  }

  return {
    appliedScopes,
    backupArtifactFilename: backupDetail.filename ?? backupArtifact.filename ?? null,
    backupArtifactId: backupArtifact.id,
    blockedRestoreApplyCode: blockedRestoreApply.payload?.error?.code ?? null,
    createdArtifactCount: backupArtifacts.length,
    initialLockCount: initialLockStatus.lockCount ?? initialLockStatus.activeLocks?.length ?? 0,
    postApplyLockCount: finalLockStatus.lockCount ?? finalLockStatus.activeLocks?.length ?? 0,
    restoreApplyRunId: appliedRestore.run.id,
    restoreApplyStatus: appliedRestore.run.status ?? null,
    restorePreviewChecksum: restorePreview.integrity?.expectedPayloadSha256 ?? null,
    restorePreviewCompatibility: restorePreview.compatibility?.compatible ?? false,
  };
}

async function validateRequestMusicFlow({
  adminClient = null,
  fetchFn,
  port,
  requestTimeoutMs = defaultSessionRequestTimeoutMs,
  smokeAdminCredentials = defaultSmokeAdminCredentials,
  targetUserCredentials = defaultSmokeRequestTargetCredentials,
} = {}) {
  const sessionClient = adminClient ?? createValidationSessionClient({
    fetchFn,
    port,
    requestTimeoutMs,
  });

  if (!adminClient) {
    await bootstrapSmokeAdminSession({
      client: sessionClient,
      credentials: smokeAdminCredentials,
    });
  }

  const targetUser = await createSmokeAppUser({
    client: sessionClient,
    credentials: targetUserCredentials,
  });
  const mediaRequest = await createSmokeMediaRequest({
    client: sessionClient,
    payload: {
      artistName: 'Autechre',
      releaseTitle: 'Amber',
      requestKind: 'release',
      requestedForUserId: targetUser.id,
    },
  });

  const targetClient = createValidationSessionClient({
    fetchFn,
    port,
    requestTimeoutMs,
  });
  await loginSmokeAdminSession({
    client: targetClient,
    credentials: targetUserCredentials,
  });

  const summary = await getMediaRequestSummary({
    client: targetClient,
    scope: 'all',
  });
  const list = await getMediaRequests({
    client: targetClient,
    scope: 'all',
  });
  const sortedNotificationTitles = Array.isArray(summary.notificationFeed?.notifications)
    ? summary.notificationFeed.notifications.map((notification) => notification?.title ?? '').sort()
    : [];
  const recentRequest = Array.isArray(summary.recentRequests) ? summary.recentRequests[0] : null;
  const listedRequest = Array.isArray(list.mediaRequests) ? list.mediaRequests[0] : null;

  if (summary.scope !== 'mine') {
    throw new Error(`Docker smoke validation expected delegated media request summary scope to resolve to mine, but observed ${summary.scope}`);
  }

  if ((summary.counts?.totalRequests ?? 0) !== 1) {
    throw new Error(`Docker smoke validation expected one delegated media request in the target summary, but observed ${summary.counts?.totalRequests ?? 0}`);
  }

  if ((summary.fulfillmentCounts?.queued ?? 0) !== 1 || (summary.fulfillmentCounts?.active ?? 0) !== 1) {
    throw new Error('Docker smoke validation expected delegated media request fulfillment to remain queued and active');
  }

  if ((summary.notificationFeed?.counts?.total ?? 0) !== 2) {
    throw new Error(`Docker smoke validation expected two delegated media request notifications, but observed ${summary.notificationFeed?.counts?.total ?? 0}`);
  }

  if (
    (summary.notificationFeed?.counts?.byCategory?.delegated_request ?? 0) !== 1
    || (summary.notificationFeed?.counts?.byCategory?.fulfillment ?? 0) !== 1
  ) {
    throw new Error('Docker smoke validation expected delegated-request and fulfillment notification counts to each equal one');
  }

  if (sortedNotificationTitles.join('|') !== ['Music requested for you', 'Request queued'].join('|')) {
    throw new Error(`Docker smoke validation observed unexpected delegated media request notification titles: ${sortedNotificationTitles.join(', ')}`);
  }

  if (recentRequest?.fulfillmentStatus?.code !== 'queued') {
    throw new Error(`Docker smoke validation expected delegated media request fulfillment code queued, but observed ${recentRequest?.fulfillmentStatus?.code ?? 'missing'}`);
  }

  if (list.scope !== 'mine' || !listedRequest || list.mediaRequests.length !== 1) {
    throw new Error('Docker smoke validation expected delegated media request list scope to remain mine with exactly one visible request');
  }

  if (listedRequest.requestedByUser?.username !== smokeAdminCredentials.username || listedRequest.requestedForUser?.username !== targetUserCredentials.username) {
    throw new Error('Docker smoke validation observed unexpected delegated media request ownership in the target user list');
  }

  return {
    delegatedRequestId: mediaRequest.id,
    fulfillmentCode: recentRequest.fulfillmentStatus.code,
    listCount: list.mediaRequests.length,
    listScope: list.scope,
    notificationTitles: sortedNotificationTitles,
    requestedByUsername: listedRequest.requestedByUser.username,
    requestedForUsername: listedRequest.requestedForUser.username,
    summaryScope: summary.scope,
  };
}

async function validateUpgradeSettingsPersistence({
  fetchFn,
  port,
  requestTimeoutMs = defaultSessionRequestTimeoutMs,
  settingsProbe = defaultUpgradeSettingsProbe,
  smokeAdminCredentials = defaultSmokeAdminCredentials,
} = {}) {
  const client = createValidationSessionClient({
    fetchFn,
    port,
    requestTimeoutMs,
  });

  await loginSmokeAdminSession({
    client,
    credentials: smokeAdminCredentials,
  });

  const settings = await getSettingsSnapshot({ client });
  const expectedLogLevel = settingsProbe?.system?.logLevel ?? null;
  const observedLogLevel = settings?.system?.logLevel ?? null;

  if (expectedLogLevel !== observedLogLevel) {
    throw new Error(`Docker smoke validation expected upgraded settings log level ${expectedLogLevel}, but observed ${observedLogLevel}`);
  }

  return {
    expectedLogLevel,
    observedLogLevel,
    persisted: true,
  };
}

async function getAvailablePort() {
  const server = createServer();

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : null;
  server.close();
  await once(server, 'close');

  if (!Number.isInteger(port)) {
    throw new Error('Unable to allocate an available host port for the Docker smoke test');
  }

  return port;
}

async function ensureDirectoryLayout({ baseDir, mkdirFn = mkdir } = {}) {
  const directories = {
    appData: resolve(baseDir, 'appdata'),
    downloads: resolve(baseDir, 'downloads'),
    music: resolve(baseDir, 'music'),
    staging: resolve(baseDir, 'staging'),
    transcodeTemp: resolve(baseDir, 'transcode-temp'),
  };

  await Promise.all(
    Object.values(directories).map((directory) => mkdirFn(directory, { recursive: true })),
  );

  return directories;
}

async function runCommand({
  args,
  command,
  cwd = rootDir,
  env,
  expectedExitCodes,
} = {}) {
  return runBufferedCommand({
    args,
    command,
    cwd,
    env,
    expectedExitCodes,
  });
}

async function runComposeCommand({
  composeArgs,
  env,
  args,
  expectedExitCodes,
  runCommandFn,
} = {}) {
  return runCommandFn({
    args: [...composeArgs, ...args],
    command: 'docker',
    env,
    expectedExitCodes,
  });
}

function buildComposeUpArgs({
  buildImage,
  detach = true,
  serviceName = harmoniarrServiceName,
} = {}) {
  const args = ['up'];

  if (buildImage) {
    args.push('--build');
  } else {
    args.push('--no-build');
  }

  if (detach) {
    args.push('--detach', '--wait', '--wait-timeout', '180');
    return args;
  }

  args.push('--abort-on-container-failure', '--exit-code-from', serviceName, '--no-color');
  return args;
}

async function startComposeProject({
  buildImage,
  composeArgs,
  env,
  runCommandFn,
} = {}) {
  await runComposeCommand({
    args: buildComposeUpArgs({
      buildImage,
      detach: true,
    }),
    composeArgs,
    env,
    runCommandFn,
  });
}

async function stopComposeProject({
  composeArgs,
  env,
  removeVolumes,
  runCommandFn,
} = {}) {
  const args = ['down'];

  if (removeVolumes) {
    args.push('--volumes');
  }

  args.push('--remove-orphans');

  await runComposeCommand({
    args,
    composeArgs,
    env,
    runCommandFn,
  });
}

async function getServiceContainerId({
  composeArgs,
  env,
  includeStopped = false,
  runCommandFn,
  serviceName = harmoniarrServiceName,
} = {}) {
  const containerResult = await runComposeCommand({
    args: ['ps', includeStopped ? '-aq' : '-q', serviceName],
    composeArgs,
    env,
    runCommandFn,
  });
  const containerId = containerResult.stdout.trim();

  if (!containerId) {
    throw new Error(`Docker smoke validation could not resolve the ${serviceName} container ID`);
  }

  return containerId;
}

async function assertReadonlyRootFilesystem({
  composeArgs,
  env,
  runCommandFn,
} = {}) {
  const containerId = await getServiceContainerId({
    composeArgs,
    env,
    runCommandFn,
  });

  const inspectResult = await runCommandFn({
    args: ['inspect', '--format', '{{json .HostConfig.ReadonlyRootfs}}', containerId],
    command: 'docker',
    env,
  });
  const readonlyRootfs = inspectResult.stdout.trim();

  if (readonlyRootfs !== 'true') {
    throw new Error(`Docker container ${containerId} is not running with a read-only root filesystem`);
  }
}

function getFirstNonEmptyLine(output = '') {
  return output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? '';
}

function getRequiredEnvValue(env, key, fallback) {
  const value = env?.[key];

  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  return fallback;
}

async function getBinaryVersion({
  binary,
  composeArgs,
  env,
  runCommandFn,
  serviceName = harmoniarrServiceName,
} = {}) {
  const versionResult = await runComposeCommand({
    args: ['exec', '-T', serviceName, binary, '-version'],
    composeArgs,
    env,
    runCommandFn,
  });
  const version = getFirstNonEmptyLine(versionResult.stdout);

  if (!version) {
    throw new Error(`Docker smoke validation could not read a version line from ${binary} -version`);
  }

  return version;
}

async function getMediaToolingSummary({
  composeArgs,
  env,
  runCommandFn,
} = {}) {
  const [ffmpegVersion, ffprobeVersion] = await Promise.all([
    getBinaryVersion({
      binary: 'ffmpeg',
      composeArgs,
      env,
      runCommandFn,
    }),
    getBinaryVersion({
      binary: 'ffprobe',
      composeArgs,
      env,
      runCommandFn,
    }),
  ]);

  return {
    ffmpegVersion,
    ffprobeVersion,
  };
}

async function runEmbeddedPostgresCommand({
  args,
  composeArgs,
  env,
  runCommandFn,
  serviceName = harmoniarrServiceName,
} = {}) {
  return runComposeCommand({
    args: ['exec', '-T', serviceName, ...args],
    composeArgs,
    env,
    runCommandFn,
  });
}

async function runEmbeddedPostgresSql({
  composeArgs,
  database,
  env,
  runCommandFn,
  sql,
  serviceName = harmoniarrServiceName,
} = {}) {
  return runEmbeddedPostgresCommand({
    args: [
      'psql',
      '-h', '127.0.0.1',
      '-p', getRequiredEnvValue(env, 'POSTGRES_PORT', '5432'),
      '-U', getRequiredEnvValue(env, 'POSTGRES_USER', 'harmoniarr'),
      '-d', database ?? getRequiredEnvValue(env, 'POSTGRES_DB', 'harmoniarr'),
      '-v', 'ON_ERROR_STOP=1',
      '-Atqc',
      sql,
    ],
    composeArgs,
    env,
    runCommandFn,
    serviceName,
  });
}

async function getEmbeddedPostgresSummary({
  composeArgs,
  env,
  runCommandFn,
  serviceName = harmoniarrServiceName,
} = {}) {
  const databaseName = getRequiredEnvValue(env, 'POSTGRES_DB', 'harmoniarr');
  const port = getRequiredEnvValue(env, 'POSTGRES_PORT', '5432');
  const user = getRequiredEnvValue(env, 'POSTGRES_USER', 'harmoniarr');
  const readinessResult = await runEmbeddedPostgresCommand({
    args: ['pg_isready', '-h', '127.0.0.1', '-p', port, '-U', user, '-d', databaseName],
    composeArgs,
    env,
    runCommandFn,
    serviceName,
  });
  const identityResult = await runEmbeddedPostgresSql({
    composeArgs,
    env,
    runCommandFn,
    serviceName,
    sql: "SELECT current_database() || '|' || current_user",
  });
  const identity = getFirstNonEmptyLine(identityResult.stdout);
  const [reportedDatabaseName, reportedUser] = identity.split('|');

  if (!reportedDatabaseName || !reportedUser) {
    throw new Error('Docker smoke validation could not parse the embedded PostgreSQL identity query output');
  }

  return {
    databaseName: reportedDatabaseName,
    readyMessage: getFirstNonEmptyLine(readinessResult.stdout),
    user: reportedUser,
  };
}

async function seedEmbeddedPostgresPersistenceProbe({
  composeArgs,
  env,
  probeKey,
  runCommandFn,
} = {}) {
  await runEmbeddedPostgresSql({
    composeArgs,
    env,
    runCommandFn,
    sql: `
      CREATE TABLE IF NOT EXISTS docker_smoke_persistence_probe (
        probe_key text PRIMARY KEY,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      INSERT INTO docker_smoke_persistence_probe (probe_key)
      VALUES ('${probeKey}')
      ON CONFLICT (probe_key) DO NOTHING;
    `,
  });
}

async function verifyEmbeddedPostgresPersistenceProbe({
  composeArgs,
  env,
  probeKey,
  runCommandFn,
} = {}) {
  const persistenceResult = await runEmbeddedPostgresSql({
    composeArgs,
    env,
    runCommandFn,
    sql: `SELECT COUNT(*) FROM docker_smoke_persistence_probe WHERE probe_key = '${probeKey}'`,
  });
  const rowCount = Number.parseInt(getFirstNonEmptyLine(persistenceResult.stdout), 10);

  if (!Number.isInteger(rowCount)) {
    throw new Error('Docker smoke validation could not parse the embedded PostgreSQL persistence probe result');
  }

  if (rowCount !== 1) {
    throw new Error(`Docker smoke validation expected the embedded PostgreSQL persistence probe ${probeKey} to survive restart, but observed row count ${rowCount}`);
  }

  return {
    persisted: true,
    probeKey,
    rowCount,
  };
}

async function getServiceState({
  composeArgs,
  env,
  runCommandFn,
  serviceName = harmoniarrServiceName,
} = {}) {
  const containerId = await getServiceContainerId({
    composeArgs,
    env,
    includeStopped: true,
    runCommandFn,
    serviceName,
  });
  const inspectResult = await runCommandFn({
    args: ['inspect', '--format', '{{json .State}}', containerId],
    command: 'docker',
    env,
  });

  let state;

  try {
    state = JSON.parse(inspectResult.stdout.trim());
  } catch {
    throw new Error(`Docker smoke validation could not parse state inspection for container ${containerId}`);
  }

  if (!state || typeof state.ExitCode !== 'number' || typeof state.Status !== 'string') {
    throw new Error(`Docker smoke validation could not read the exit state for container ${containerId}`);
  }

  return {
    containerId,
    exitCode: state.ExitCode,
    status: state.Status,
  };
}

async function getHealthSummary({ fetchFn, port } = {}) {
  const healthResponse = await fetchFn(`http://127.0.0.1:${port}/healthz`);
  if (!healthResponse.ok) {
    throw new Error(`Health check returned HTTP ${healthResponse.status}`);
  }

  return healthResponse.json();
}

async function getServiceLogs({
  composeArgs,
  env,
  serviceName = harmoniarrServiceName,
  runCommandFn,
} = {}) {
  const logResult = await runComposeCommand({
    args: ['logs', '--no-color', serviceName],
    composeArgs,
    env,
    runCommandFn,
  });

  return logResult.stdout;
}

async function runMigrationCheck({
  composeArgs,
  env,
  runCommandFn,
} = {}) {
  const migrationCheck = await runComposeCommand({
    args: ['exec', '-T', 'harmoniarr', 'node', '/app/server-dist/check-migrations.js'],
    composeArgs,
    env,
    runCommandFn,
  });

  return migrationCheck.stdout.trim();
}

async function validateRunningStack({
  composeArgs,
  env,
  expectEmbeddedPostgresInitialization,
  expectBootstrapLog,
  fetchFn,
  port,
  runCommandFn,
} = {}) {
  await assertReadonlyRootFilesystem({
    composeArgs,
    env,
    runCommandFn,
  });

  const healthBody = await getHealthSummary({
    fetchFn,
    port,
  });
  const mediaTooling = await getMediaToolingSummary({
    composeArgs,
    env,
    runCommandFn,
  });
  const logs = await getServiceLogs({
    composeArgs,
    env,
    runCommandFn,
  });
  const embeddedPostgres = await getEmbeddedPostgresSummary({
    composeArgs,
    env,
    runCommandFn,
  });
  const sawBootstrapLog = logs.includes(schemaBootstrapLogSnippet);
  const sawEmbeddedPostgresInitialization = logs.includes(embeddedPostgresInitLogSnippet);

  if (!logs.includes(embeddedPostgresStartLogSnippet)) {
    throw new Error('Docker smoke validation did not observe embedded PostgreSQL startup in the container logs');
  }

  if (!logs.includes(embeddedPostgresPrepareLogSnippet)) {
    throw new Error('Docker smoke validation did not observe embedded PostgreSQL database preparation in the container logs');
  }

  if (expectEmbeddedPostgresInitialization && !sawEmbeddedPostgresInitialization) {
    throw new Error('Fresh-install startup logs did not confirm embedded PostgreSQL cluster initialization');
  }

  if (!expectEmbeddedPostgresInitialization && sawEmbeddedPostgresInitialization) {
    throw new Error('Existing-data restart unexpectedly reinitialized the embedded PostgreSQL cluster');
  }

  if (expectBootstrapLog && !sawBootstrapLog) {
    throw new Error('Fresh-install startup logs did not confirm schema snapshot bootstrap');
  }

  if (!expectBootstrapLog && sawBootstrapLog) {
    throw new Error('Existing-data restart unexpectedly reloaded the schema snapshot');
  }

  const migrationCheckOutput = await runMigrationCheck({
    composeArgs,
    env,
    runCommandFn,
  });

  return {
    embeddedPostgres,
    healthBody,
    mediaTooling,
    migrationCheckOutput,
    sawEmbeddedPostgresInitialization,
    sawBootstrapLog,
  };
}

async function validateStartupRefusal({
  buildImage,
  composeArgs,
  env,
  runCommandFn,
  startupValidationFailureScenario,
  serviceName = harmoniarrServiceName,
} = {}) {
  const failureEnv = {
    ...env,
    ...startupValidationFailureScenario.env,
  };
  const composeResult = await runComposeCommand({
    args: buildComposeUpArgs({
      buildImage,
      detach: false,
      serviceName,
    }),
    composeArgs,
    env: failureEnv,
    expectedExitCodes: [1],
    runCommandFn,
  });
  const serviceState = await getServiceState({
    composeArgs,
    env: failureEnv,
    runCommandFn,
    serviceName,
  });

  if (serviceState.status !== 'exited') {
    throw new Error(`Docker smoke validation expected ${serviceName} to exit during invalid startup validation, but container ${serviceState.containerId} is ${serviceState.status}`);
  }

  if (serviceState.exitCode !== 1) {
    throw new Error(`Docker smoke validation expected ${serviceName} to exit with code 1 during invalid startup validation, but container ${serviceState.containerId} exited with ${serviceState.exitCode}`);
  }

  const logs = await getServiceLogs({
    composeArgs,
    env: failureEnv,
    serviceName,
    runCommandFn,
  });

  if (!logs.includes(startupValidationFailureScenario.expectedLogSnippet)) {
    throw new Error('Docker smoke validation did not observe the expected startup-refusal log for the invalid configuration scenario');
  }

  return {
    composeExitCode: composeResult.exitCode,
    expectedLogSnippet: startupValidationFailureScenario.expectedLogSnippet,
    serviceExitCode: serviceState.exitCode,
    serviceStatus: serviceState.status,
  };
}

function buildValidationEnvironment({
  directories,
  imageRef,
  port,
  processEnv = process.env,
} = {}) {
  return {
    ...processEnv,
    APP_PORT: '3000',
    HARMONIARR_APPDATA: directories.appData,
    HARMONIARR_CONTACT_EMAIL: processEnv.HARMONIARR_CONTACT_EMAIL ?? '',
    HARMONIARR_CONTACT_URL: processEnv.HARMONIARR_CONTACT_URL ?? 'https://github.com/cloudbyday90/harmoniarr',
    HARMONIARR_DOWNLOADS: directories.downloads,
    ...(imageRef ? { HARMONIARR_IMAGE: imageRef } : {}),
    HARMONIARR_MUSIC: directories.music,
    HARMONIARR_PORT: String(port),
    HARMONIARR_STAGING: directories.staging,
    HARMONIARR_TRANSCODE_TEMP: directories.transcodeTemp,
    POSTGRES_DB: processEnv.POSTGRES_DB ?? 'harmoniarr',
    POSTGRES_PORT: processEnv.POSTGRES_PORT ?? '5432',
    POSTGRES_USER: processEnv.POSTGRES_USER ?? 'harmoniarr',
  };
}

export async function validateDockerFreshInstall({
  buildImage = true,
  composeFilePath = resolve(rootDir, 'compose.yaml'),
  fetchFn = fetch,
  getAvailablePortFn = getAvailablePort,
  imageRef,
  makeDirectoryLayoutFn = ensureDirectoryLayout,
  mkdtempFn = mkdtemp,
  processEnv = process.env,
  projectName = createProjectName(),
  removeFn = rm,
  requestTimeoutMs = defaultSessionRequestTimeoutMs,
  runCommandFn = runCommand,
  smokeAdminCredentials = defaultSmokeAdminCredentials,
  startupValidationFailureScenario = defaultStartupValidationFailureScenario,
  tempRootDir = tmpdir(),
  verifyBackupRestoreFlow = false,
  verifyExistingDataRestart = false,
  verifyRequestMusicFlow = false,
} = {}) {
  const workspaceRoot = await mkdtempFn(resolve(tempRootDir, 'harmoniarr-docker-smoke-'));
  const port = await getAvailablePortFn();
  const directories = await makeDirectoryLayoutFn({ baseDir: workspaceRoot });
  const composeArgs = ['compose', '-f', composeFilePath, '-p', projectName];
  const env = buildValidationEnvironment({
    directories,
    imageRef,
    port,
    processEnv,
  });

  try {
    await startComposeProject({
      buildImage,
      composeArgs,
      env,
      runCommandFn,
    });

    const freshInstall = await validateRunningStack({
      composeArgs,
      env,
      expectEmbeddedPostgresInitialization: true,
      expectBootstrapLog: true,
      fetchFn,
      port,
      runCommandFn,
    });

    let backupRestoreFlow = null;
    let embeddedPostgresPersistence = null;
    let existingDataRestart = null;
    let requestMusicFlow = null;
    let startupFailure = null;

    let adminClient = null;
    if (verifyBackupRestoreFlow || verifyRequestMusicFlow) {
      adminClient = createValidationSessionClient({
        fetchFn,
        port,
        requestTimeoutMs,
      });

      await bootstrapSmokeAdminSession({
        client: adminClient,
        credentials: smokeAdminCredentials,
      });
    }

    if (verifyBackupRestoreFlow) {
      backupRestoreFlow = await validateBackupRestoreFlow({
        client: adminClient,
        fetchFn,
        port,
        projectName,
        requestTimeoutMs,
        smokeAdminCredentials,
      });
    }

    if (verifyRequestMusicFlow) {
      requestMusicFlow = await validateRequestMusicFlow({
        adminClient,
        fetchFn,
        port,
        requestTimeoutMs,
        smokeAdminCredentials,
      });
    }

    if (verifyExistingDataRestart) {
      const probeKey = `probe_${projectName}`;
      await seedEmbeddedPostgresPersistenceProbe({
        composeArgs,
        env,
        probeKey,
        runCommandFn,
      });

      await stopComposeProject({
        composeArgs,
        env,
        removeVolumes: false,
        runCommandFn,
      });

      await startComposeProject({
        buildImage: false,
        composeArgs,
        env,
        runCommandFn,
      });

      existingDataRestart = await validateRunningStack({
        composeArgs,
        env,
        expectEmbeddedPostgresInitialization: false,
        expectBootstrapLog: false,
        fetchFn,
        port,
        runCommandFn,
      });
      embeddedPostgresPersistence = await verifyEmbeddedPostgresPersistenceProbe({
        composeArgs,
        env,
        probeKey,
        runCommandFn,
      });
    }

    if (startupValidationFailureScenario) {
      await stopComposeProject({
        composeArgs,
        env,
        removeVolumes: false,
        runCommandFn,
      });

      startupFailure = await validateStartupRefusal({
        buildImage: false,
        composeArgs,
        env,
        runCommandFn,
        startupValidationFailureScenario,
      });
    }

    return {
      backupRestoreFlow,
      embeddedPostgresPersistence,
      existingDataRestart,
      freshInstall,
      imageRef: imageRef ?? null,
      port,
      projectName,
      requestMusicFlow,
      startupFailure,
      workspaceRoot,
    };
  } finally {
    try {
      await stopComposeProject({
        composeArgs,
        env,
        removeVolumes: true,
        runCommandFn,
      });
    } catch {
      // Best-effort cleanup keeps the validation idempotent without masking the original failure.
    }

    await removeFn(workspaceRoot, { force: true, recursive: true });
  }
}

export async function validateDockerUpgradePath({
  baselineImageRef,
  buildCandidateImage = true,
  candidateImageRef = null,
  composeFilePath = resolve(rootDir, 'compose.yaml'),
  fetchFn = fetch,
  getAvailablePortFn = getAvailablePort,
  makeDirectoryLayoutFn = ensureDirectoryLayout,
  mkdtempFn = mkdtemp,
  processEnv = process.env,
  projectName = createProjectName('harmoniarrupgrade'),
  removeFn = rm,
  requestTimeoutMs = defaultSessionRequestTimeoutMs,
  runCommandFn = runCommand,
  settingsProbe = defaultUpgradeSettingsProbe,
  smokeAdminCredentials = defaultSmokeAdminCredentials,
  tempRootDir = tmpdir(),
} = {}) {
  if (typeof baselineImageRef !== 'string' || baselineImageRef.trim().length === 0) {
    throw new Error('baselineImageRef is required to validate the Docker upgrade path');
  }

  const workspaceRoot = await mkdtempFn(resolve(tempRootDir, 'harmoniarr-docker-upgrade-'));
  const port = await getAvailablePortFn();
  const directories = await makeDirectoryLayoutFn({ baseDir: workspaceRoot });
  const composeArgs = ['compose', '-f', composeFilePath, '-p', projectName];
  const baselineEnv = buildValidationEnvironment({
    directories,
    imageRef: baselineImageRef,
    port,
    processEnv,
  });
  const candidateEnv = buildValidationEnvironment({
    directories,
    imageRef: candidateImageRef,
    port,
    processEnv,
  });

  try {
    await startComposeProject({
      buildImage: false,
      composeArgs,
      env: baselineEnv,
      runCommandFn,
    });

    const baselineRuntime = await validateRunningStack({
      composeArgs,
      env: baselineEnv,
      expectEmbeddedPostgresInitialization: true,
      expectBootstrapLog: true,
      fetchFn,
      port,
      runCommandFn,
    });

    const baselineClient = createValidationSessionClient({
      fetchFn,
      port,
      requestTimeoutMs,
    });

    await bootstrapSmokeAdminSession({
      client: baselineClient,
      credentials: smokeAdminCredentials,
    });

    const baselineSettings = await updateSettingsProbe({
      client: baselineClient,
      settingsPatch: settingsProbe,
    });

    await stopComposeProject({
      composeArgs,
      env: baselineEnv,
      removeVolumes: false,
      runCommandFn,
    });

    await startComposeProject({
      buildImage: candidateImageRef ? false : buildCandidateImage,
      composeArgs,
      env: candidateEnv,
      runCommandFn,
    });

    const upgradedRuntime = await validateRunningStack({
      composeArgs,
      env: candidateEnv,
      expectEmbeddedPostgresInitialization: false,
      expectBootstrapLog: false,
      fetchFn,
      port,
      runCommandFn,
    });
    const settingsPersistence = await validateUpgradeSettingsPersistence({
      fetchFn,
      port,
      requestTimeoutMs,
      settingsProbe,
      smokeAdminCredentials,
    });

    return {
      baselineImageRef,
      baselineRuntime,
      candidateImageRef: candidateImageRef ?? null,
      port,
      projectName,
      settingsPersistence: {
        ...settingsPersistence,
        baselineLogLevel: baselineSettings?.system?.logLevel ?? null,
      },
      upgradedRuntime,
      workspaceRoot,
    };
  } finally {
    try {
      await stopComposeProject({
        composeArgs,
        env: candidateEnv,
        removeVolumes: true,
        runCommandFn,
      });
    } catch {
      // Best-effort cleanup keeps the validation idempotent without masking the original failure.
    }

    await removeFn(workspaceRoot, { force: true, recursive: true });
  }
}
