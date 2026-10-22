/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { normalizeOutboundBaseUrl, resolveAllowedOutboundHosts, resolveAllowedOutboundHostSuffixes } from '../../outbound-url-policy.js';
import { createArtworkImageDownloadService } from '../../artwork/artwork-image-download-service.js';

function failure(code, message, details = {}, diagnosticCode) {
  return Object.assign(new Error(message), { code, details, diagnosticCode });
}

function integer(value, fallback, minimum = 1, maximum = 2_147_483_647) {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isSafeInteger(result) || result < minimum || result > maximum) {
    throw failure('coverartarchive_misconfigured', 'Invalid Cover Art Archive request policy');
  }
  return result;
}

export function createCoverArtArchiveClient({
  allowedHosts = process.env.COVERARTARCHIVE_ALLOWED_HOSTS == null ? ['coverartarchive.org', 'archive.org']
    : resolveAllowedOutboundHosts(process.env.COVERARTARCHIVE_ALLOWED_HOSTS, { envName: 'COVERARTARCHIVE_ALLOWED_HOSTS' }),
  allowedHostSuffixes = resolveAllowedOutboundHostSuffixes(process.env.COVERARTARCHIVE_ALLOWED_HOST_SUFFIXES, { envName: 'COVERARTARCHIVE_ALLOWED_HOST_SUFFIXES' }),
  baseUrl = process.env.COVERARTARCHIVE_BASE_URL,
  applicationName = 'Harmoniarr',
  applicationVersion = process.env.HARMONIARR_VERSION ?? '0.1.0-beta',
  contactEmail = process.env.HARMONIARR_CONTACT_EMAIL,
  contactUrl = process.env.HARMONIARR_CONTACT_URL,
  minIntervalMs = process.env.COVERARTARCHIVE_MIN_INTERVAL_MS,
  requestTimeoutMs = process.env.COVERARTARCHIVE_REQUEST_TIMEOUT_MS,
  maxRetries = process.env.COVERARTARCHIVE_MAX_RETRIES,
  fetchImpl,
  sleepImpl = delay => new Promise(resolve => { setTimeout(resolve, delay); }),
} = {}) {
  let normalizedBaseUrl;
  try {
    normalizedBaseUrl = normalizeOutboundBaseUrl(baseUrl ?? 'https://coverartarchive.org', {
      allowHttp: false, allowHttps: true, allowLocalhost: false, allowPrivateHosts: false,
      allowedHosts, allowedHostSuffixes, defaultPathname: '/', fieldName: 'COVERARTARCHIVE_BASE_URL',
    });
  } catch { throw failure('coverartarchive_misconfigured', 'Invalid Cover Art Archive base URL'); }
  const interval = Math.max(integer(minIntervalMs, 1100), 1000);
  const retries = integer(maxRetries, 2, 0, 10);
  const images = createArtworkImageDownloadService({ fetchImpl, requestTimeoutMs: integer(requestTimeoutMs, 15000) });
  const userAgent = `${applicationName}/${applicationVersion} (${contactUrl ?? contactEmail ?? 'https://github.com/cloudbyday90/harmoniarr'})`;
  let queue = Promise.resolve(); let nextRequestAt = 0;

  async function enqueue(operation) {
    const execute = async () => {
      const wait = Math.max(0, nextRequestAt - Date.now());
      if (wait) await sleepImpl(wait);
      nextRequestAt = Date.now() + interval;
      return operation();
    };
    const result = queue.then(execute, execute); queue = result.catch(() => {});
    return result;
  }

  async function fetchFrontImage({ mbid, mbidType = 'release', limits }) {
    if (typeof mbid !== 'string' || mbid.trim().length === 0) throw failure('coverartarchive_validation_error', 'mbid must be a non-empty string');
    const segment = mbidType === 'release-group' ? 'release-group' : 'release';
    const url = new URL(`/${segment}/${encodeURIComponent(mbid)}/front`, normalizedBaseUrl);
    return enqueue(async () => {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try { return await images.downloadImage(url, { sourceProvider: 'coverArtArchive', limits, userAgent }); }
        catch (error) {
          const { status = null, retryable = false, retryAfterMs = null } = error.details ?? {};
          if (retryable && error.diagnosticCode !== 'retry_deferred' && attempt < retries) {
            const backoff = Math.min(2_147_483_647, interval * (2 ** Math.min(attempt + 1, 4)) + Math.floor(Math.random() * 250));
            await sleepImpl(Math.max(backoff, retryAfterMs ?? 0)); continue;
          }
          throw failure(retryable ? 'coverartarchive_unavailable' : 'coverartarchive_request_failed',
            'Cover Art Archive image request could not be completed', {
              attempts: attempt + 1, maxRetries: retries, retryable, retryAfterMs, status,
              throttled: status === 429 || status === 503,
            }, error.diagnosticCode);
        }
      }
    });
  }
  return { fetchFrontImage };
}
