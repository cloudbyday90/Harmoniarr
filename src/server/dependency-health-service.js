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

const safeDetailKeys = new Set([
  'attempts',
  'ffmpegAvailable',
  'ffprobeAvailable',
  'maxRetries',
  'isConnected',
  'isLoggedIn',
  'isTransitioning',
  'retryAfterMs',
  'retryable',
  'status',
  'throttled',
]);

function copySafeDetails(details) {
  if (!details || typeof details !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(details).filter(([key, value]) => safeDetailKeys.has(key) && value != null),
  );
}

function createDependencyStatus({
  provider,
  status,
  code = null,
  message = null,
  details = {},
}) {
  return {
    provider,
    status,
    ...(code ? { code } : {}),
    ...(message ? { message } : {}),
    ...(Object.keys(details).length ? { details } : {}),
  };
}

export function classifyMusicBrainzDependencyError(error) {
  const provider = 'musicbrainz';

  switch (error?.code) {
    case 'musicbrainz_misconfigured':
      return createDependencyStatus({
        provider,
        status: 'misconfigured',
        code: error.code,
        message: error.message,
      });
    case 'musicbrainz_unavailable': {
      const details = copySafeDetails(error.details);
      return createDependencyStatus({
        provider,
        status: details.throttled ? 'degraded' : 'unavailable',
        code: error.code,
        message: details.throttled
          ? 'MusicBrainz is throttling requests'
          : 'MusicBrainz is temporarily unavailable',
        details,
      });
    }
    case 'musicbrainz_request_failed':
      return createDependencyStatus({
        provider,
        status: 'degraded',
        code: error.code,
        message: error.message,
        details: copySafeDetails(error.details),
      });
    case 'musicbrainz_not_found':
      return createDependencyStatus({
        provider,
        status: 'healthy',
      });
    default:
      return createDependencyStatus({
        provider,
        status: 'unavailable',
        code: 'dependency_check_failed',
        message: 'MusicBrainz dependency check failed',
      });
  }
}

export function classifySlskdDependencyError(error) {
  const provider = 'slskd';

  switch (error?.code) {
    case 'slskd_misconfigured':
      return createDependencyStatus({
        provider,
        status: 'misconfigured',
        code: error.code,
        message: error.message,
      });
    case 'slskd_unauthorized':
      return createDependencyStatus({
        provider,
        status: 'misconfigured',
        code: error.code,
        message: 'slskd authentication failed',
        details: copySafeDetails(error.details),
      });
    case 'slskd_unavailable':
      return createDependencyStatus({
        provider,
        status: 'unavailable',
        code: error.code,
        message: 'slskd is temporarily unavailable',
        details: copySafeDetails(error.details),
      });
    case 'slskd_request_failed':
      return createDependencyStatus({
        provider,
        status: 'degraded',
        code: error.code,
        message: error.message,
        details: copySafeDetails(error.details),
      });
    default:
      return createDependencyStatus({
        provider,
        status: 'unavailable',
        code: 'dependency_check_failed',
        message: 'slskd dependency check failed',
      });
  }
}

function classifyDependencyError(provider, error) {
  if (provider === 'musicbrainz') {
    return classifyMusicBrainzDependencyError(error);
  }

  if (provider === 'slskd') {
    return classifySlskdDependencyError(error);
  }

  return createDependencyStatus({
    provider,
    status: 'unavailable',
    code: error?.code ?? 'dependency_check_failed',
    message: `${provider} dependency check failed`,
  });
}

function normalizeDependencyStatus(provider, result) {
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    return createDependencyStatus({
      provider,
      status: result.status ?? 'healthy',
      code: result.code ?? null,
      message: result.message ?? null,
      details: copySafeDetails(result.details),
    });
  }

  return createDependencyStatus({
    provider,
    status: 'healthy',
  });
}

function addObservedAt(status, observedAt) {
  return {
    ...status,
    observedAt,
  };
}

export function createProviderHealthRecorder({ now = () => new Date() } = {}) {
  const statuses = new Map();

  function recordStatus(provider, status) {
    const observedAt = now().toISOString();
    const normalized = normalizeDependencyStatus(provider, status);
    statuses.set(provider, addObservedAt(normalized, observedAt));
    return statuses.get(provider);
  }

  function recordSuccess(provider) {
    return recordStatus(provider, { status: 'healthy' });
  }

  function recordError(provider, error) {
    const observedAt = now().toISOString();
    const classified = classifyDependencyError(provider, error);
    statuses.set(provider, addObservedAt(classified, observedAt));
    return statuses.get(provider);
  }

  function getSnapshots() {
    return Array.from(statuses.values());
  }

  return {
    getSnapshots,
    recordError,
    recordStatus,
    recordSuccess,
  };
}

export function createDependencyHealthService({ checks = [], recorder = null } = {}) {
  async function getDependencyHealth({ providers = null } = {}) {
    const selectedProviders = Array.isArray(providers) && providers.length > 0
      ? new Set(providers)
      : null;
    const selectedChecks = selectedProviders
      ? checks.filter(({ provider }) => selectedProviders.has(provider))
      : checks;
    const checkResults = await Promise.all(selectedChecks.map(async ({ provider, check }) => {
      try {
        return normalizeDependencyStatus(provider, await check());
      } catch (error) {
        return classifyDependencyError(provider, error);
      }
    }));

    const statusesByProvider = new Map();
    for (const status of recorder?.getSnapshots?.() ?? []) {
      if (selectedProviders && !selectedProviders.has(status.provider)) {
        continue;
      }

      statusesByProvider.set(status.provider, status);
    }
    for (const status of checkResults) {
      statusesByProvider.set(status.provider, status);
    }

    return Array.from(statusesByProvider.values());
  }

  return {
    getDependencyHealth,
  };
}
