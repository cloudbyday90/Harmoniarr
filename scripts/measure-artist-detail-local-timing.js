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

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { chromium } from 'playwright';

import {
  defaultArtistDetailPresentationWaitMs,
  observeArtistDetailPresentation,
} from './artist-detail-local-presentation-observer.js';
import {
  createArtistDetailLocalTimingEvidence,
  createArtistDetailTimingRequest,
} from './artist-detail-local-timing-evidence.js';
import {
  assertArtistDetailLocalTimingArtifactContract,
  createArtistDetailLocalTimingBatchEvidence,
  maximumArtistDetailTimingBatchSamples,
} from './artist-detail-local-timing-batch-evidence.js';
import { resolveBrowserTestEvidencePath } from './browser-test-evidence.js';
import { getRequiredSecretFileInput } from './secret-input.js';
import {
  getBooleanInput,
  getOptionalStringInput,
  getRequiredStringInput,
  parseStrictScriptOptions,
} from './script-input-resolution.js';
import { runDirectScriptTask } from './script-runtime.js';

export const defaultArtistDetailTimingBaseUrl = 'http://127.0.0.1:47956';
export const artistDetailTimingPasswordFileEnvVar = 'HARMONIARR_ARTIST_DETAIL_TIMING_PASSWORD_FILE';
export const artistDetailTimingEvidencePathEnvVar = 'HARMONIARR_ARTIST_DETAIL_TIMING_EVIDENCE_PATH';
export const artistDetailTimingTransitionWaitMs = 2_000;
export const defaultArtistDetailTimingTimeoutMs = 30_000;
export const defaultArtistDetailTimingRuns = 1;

export const artistDetailTimingCliOptions = Object.freeze({
  'artist-mbid': { type: 'string' },
  'base-url': { type: 'string' },
  'evidence-path': { type: 'string' },
  headless: { type: 'boolean' },
  'password-file': { type: 'string' },
  runs: { type: 'string' },
  'timeout-ms': { type: 'string' },
  username: { type: 'string' },
});

const loopbackHostnames = new Set(['127.0.0.1', '::1', 'localhost']);
const musicBrainzArtistIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

function parsePositiveInteger(value, fieldName, defaultValue, maximum) {
  if (value == null || String(value).trim() === '') {
    return defaultValue;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || (maximum != null && parsed > maximum)) {
    const constraint = maximum == null
      ? 'a positive integer'
      : `a positive integer no greater than ${maximum}`;
    throw new Error(`${fieldName} must be ${constraint}`);
  }

  return parsed;
}

function assertArtistMbid(value) {
  if (!musicBrainzArtistIdPattern.test(value)) {
    throw new Error('artist-mbid must be a MusicBrainz artist identifier');
  }

  return value.toLowerCase();
}

/**
 * Keeps a diagnostic browser session on the deployment host. This prevents a
 * locally invoked measurement command from becoming a generic authenticated
 * browser client for arbitrary network destinations.
 */
export function normalizeLoopbackBaseUrl(value) {
  let parsedUrl;
  try {
    parsedUrl = new URL(value);
  } catch {
    throw new Error('base-url must be a valid loopback HTTP URL');
  }

  if ((parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:')
    || !loopbackHostnames.has(parsedUrl.hostname.toLowerCase())
    || parsedUrl.username
    || parsedUrl.password
    || parsedUrl.search
    || parsedUrl.hash
    || parsedUrl.pathname !== '/') {
    throw new Error('base-url must be a loopback HTTP URL without credentials, path, query, or fragment');
  }

  return parsedUrl.origin;
}

function getArtistDetailEndpoint(url, artistMbid) {
  const parsedUrl = new URL(url);
  const encodedArtistMbid = encodeURIComponent(artistMbid);
  const localMetadataPath = `/api/v1/metadata/musicbrainz/artists/${encodedArtistMbid}/local`;
  const discographyPath = `/api/v1/metadata/musicbrainz/artists/${encodedArtistMbid}/release-groups`;

  if (parsedUrl.pathname === localMetadataPath) {
    return 'local_metadata';
  }

  if (parsedUrl.pathname === discographyPath) {
    return 'discography';
  }

  if (/^\/api\/v1\/metadata\/artists\/[^/]+\/operator$/u.test(parsedUrl.pathname)) {
    return 'operator_projection';
  }

  return null;
}

function createDeferred() {
  let reject;
  let resolve;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

/**
 * Converts Playwright's request timing object into capture-relative values.
 * Playwright reports `startTime` on an absolute clock while the other request
 * milestones are relative to that value; the evidence contract deliberately
 * retains no absolute timestamp for an individual request.
 */
export function normalizeArtistDetailRequestTiming(timing, captureStartTimeMs) {
  const startTime = timing?.startTime;
  const responseEnd = timing?.responseEnd;

  if (!Number.isFinite(startTime) || !Number.isFinite(responseEnd) || responseEnd < 0
    || !Number.isFinite(captureStartTimeMs) || startTime < captureStartTimeMs) {
    throw new Error('Artist Detail request timing is invalid');
  }

  const startTimeMs = startTime - captureStartTimeMs;
  return {
    duration: responseEnd,
    responseEnd: startTimeMs + responseEnd,
    startTime: startTimeMs,
  };
}

/**
 * Observes only the three request categories relevant to an Artist Detail
 * visit. Raw URL and response objects remain internal and are discarded as
 * soon as their bounded timing record has been created.
 */
export function createArtistDetailTimingObserver({ artistMbid, page } = {}) {
  const completedRequests = new Map();
  const startedRequests = new Set();
  const completionWaiters = new Map();
  const startWaiters = new Map();
  const requestFailures = new Map();
  let captureStartTimeMs = null;

  function getEndpointFromRequest(request) {
    try {
      return getArtistDetailEndpoint(request.url(), artistMbid);
    } catch {
      return null;
    }
  }

  function resolveStartWaiter(endpoint) {
    const waiter = startWaiters.get(endpoint);
    if (waiter) {
      startWaiters.delete(endpoint);
      waiter.resolve();
    }
  }

  function rejectCompletionWaiter(endpoint) {
    const waiter = completionWaiters.get(endpoint);
    if (waiter) {
      completionWaiters.delete(endpoint);
      waiter.reject(new Error(`${endpoint} request did not complete`));
    }
  }

  function resolveCompletionWaiter(endpoint, observation) {
    const waiter = completionWaiters.get(endpoint);
    if (waiter) {
      completionWaiters.delete(endpoint);
      waiter.resolve(observation);
    }
  }

  function handleRequest(request) {
    const endpoint = getEndpointFromRequest(request);
    if (!endpoint || startedRequests.has(endpoint)) {
      return;
    }

    startedRequests.add(endpoint);
    resolveStartWaiter(endpoint);
  }

  async function recordFinishedRequest(request) {
    const endpoint = getEndpointFromRequest(request);
    if (!endpoint || completedRequests.has(endpoint)) {
      return;
    }

    try {
      const response = await request.response();
      if (!response) {
        requestFailures.set(endpoint, true);
        rejectCompletionWaiter(endpoint);
        return;
      }

      const requestTiming = request.timing();
      captureStartTimeMs ??= requestTiming.startTime;
      const observation = createArtistDetailTimingRequest({
        endpoint,
        status: response.status(),
        timing: normalizeArtistDetailRequestTiming(requestTiming, captureStartTimeMs),
      });
      completedRequests.set(endpoint, observation);
      resolveCompletionWaiter(endpoint, observation);
    } catch {
      requestFailures.set(endpoint, true);
      rejectCompletionWaiter(endpoint);
    }
  }

  function handleRequestFinished(request) {
    void recordFinishedRequest(request);
  }

  function handleRequestFailed(request) {
    const endpoint = getEndpointFromRequest(request);
    if (!endpoint) {
      return;
    }

    requestFailures.set(endpoint, true);
    rejectCompletionWaiter(endpoint);
  }

  function waitForStart(endpoint, timeoutMs) {
    if (startedRequests.has(endpoint)) {
      return Promise.resolve();
    }

    const waiter = createDeferred();
    startWaiters.set(endpoint, waiter);
    const timeout = setTimeout(() => {
      if (startWaiters.get(endpoint) === waiter) {
        startWaiters.delete(endpoint);
        waiter.reject(new Error(`${endpoint} request did not begin`));
      }
    }, timeoutMs);

    return waiter.promise.finally(() => clearTimeout(timeout));
  }

  function waitForCompletion(endpoint) {
    if (completedRequests.has(endpoint)) {
      return Promise.resolve(completedRequests.get(endpoint));
    }

    if (requestFailures.has(endpoint)) {
      return Promise.reject(new Error(`${endpoint} request did not complete`));
    }

    const waiter = createDeferred();
    completionWaiters.set(endpoint, waiter);
    return waiter.promise;
  }

  page.on('request', handleRequest);
  page.on('requestfailed', handleRequestFailed);
  page.on('requestfinished', handleRequestFinished);

  return {
    getCompletedRequest(endpoint) {
      return completedRequests.get(endpoint) ?? null;
    },
    stop() {
      page.off('request', handleRequest);
      page.off('requestfailed', handleRequestFailed);
      page.off('requestfinished', handleRequestFinished);
    },
    waitForCompletion,
    waitForStart,
  };
}

async function doesEndpointBegin(observer, endpoint) {
  try {
    await observer.waitForStart(endpoint, artistDetailTimingTransitionWaitMs);
    return true;
  } catch {
    return false;
  }
}

async function logInThroughUi({ baseUrl, page, password, username }) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Log in to Harmoniarr' }).waitFor();
  await page.getByLabel('Username or email').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL(/\/app(?:\?.*)?$/u);
}

async function createTimingEvidenceWithPresentation({
  outcome,
  presentationObservation,
  requests,
}) {
  const presentation = await presentationObservation;
  return createArtistDetailLocalTimingEvidence({
    outcome,
    presentation,
    requests,
  });
}

/**
 * Runs one read-only Artist Detail visit and returns only a bounded diagnostic
 * artifact. It does not create, alter, export, or persist application data.
 */
export async function measureArtistDetailLocalTiming({
  artistMbid,
  baseUrl,
  headless = true,
  launchBrowserFn,
  observePresentationFn = observeArtistDetailPresentation,
  password,
  presentationTimeoutMs = defaultArtistDetailPresentationWaitMs,
  timeoutMs = defaultArtistDetailTimingTimeoutMs,
  username,
} = {}) {
  const openBrowser = launchBrowserFn ?? (() => chromium.launch({ headless }));
  const browser = await openBrowser();
  const browserContext = await browser.newContext({ serviceWorkers: 'block' });
  const page = await browserContext.newPage();
  page.setDefaultTimeout(timeoutMs);

  try {
    await logInThroughUi({ baseUrl, page, password, username });

    const observer = createArtistDetailTimingObserver({ artistMbid, page });
    let presentationObservation = null;
    try {
      await page.goto(`${baseUrl}/app/artists/${encodeURIComponent(artistMbid)}`, {
        waitUntil: 'domcontentloaded',
      });
      presentationObservation = Promise.resolve(observePresentationFn({
        page,
        timeoutMs: presentationTimeoutMs,
      }));

      const localMetadata = await observer.waitForCompletion('local_metadata');
      const hasOperatorProjection = localMetadata.statusFamily === '2xx'
        && await doesEndpointBegin(observer, 'operator_projection');

      if (hasOperatorProjection) {
        const operatorProjection = await observer.waitForCompletion('operator_projection');
        const hasProviderFallback = await doesEndpointBegin(observer, 'discography');
        if (!hasProviderFallback) {
          const evidence = await createTimingEvidenceWithPresentation({
            outcome: 'local_projection',
            presentationObservation,
            requests: [localMetadata, operatorProjection],
          });
          return evidence;
        }

        const discography = await observer.waitForCompletion('discography');
        const evidence = await createTimingEvidenceWithPresentation({
          outcome: 'provider_fallback_after_operator_projection',
          presentationObservation,
          requests: [localMetadata, operatorProjection, discography],
        });
        return evidence;
      }

      const discography = await observer.waitForCompletion('discography');
      const evidence = await createTimingEvidenceWithPresentation({
        outcome: 'provider_fallback_after_local_lookup',
        presentationObservation,
        requests: [localMetadata, discography],
      });
      return evidence;
    } finally {
      if (presentationObservation) {
        await presentationObservation.catch(() => {});
      }
      observer.stop();
    }
  } finally {
    await browserContext.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

/**
 * Repeats the same read-only local Artist Detail visit sequentially. Every
 * visit starts a separate browser context, which avoids carrying browser
 * session-cache state from one timing sample to the next.
 */
export async function measureArtistDetailLocalTimingRuns({
  measureTimingFn = measureArtistDetailLocalTiming,
  runs = defaultArtistDetailTimingRuns,
  ...inputs
} = {}) {
  if (!Number.isSafeInteger(runs) || runs < 1 || runs > maximumArtistDetailTimingBatchSamples) {
    throw new Error(`runs must be a positive integer no greater than ${maximumArtistDetailTimingBatchSamples}`);
  }

  const samples = [];
  for (let index = 0; index < runs; index += 1) {
    samples.push(await measureTimingFn(inputs));
  }

  return runs === 1
    ? samples[0]
    : createArtistDetailLocalTimingBatchEvidence({ samples });
}

export async function writeArtistDetailLocalTimingEvidence({
  cwd = process.cwd(),
  evidence,
  evidencePath,
  mkdirFn = mkdir,
  writeFileFn = writeFile,
} = {}) {
  const resolvedEvidencePath = resolveBrowserTestEvidencePath(evidencePath, { cwd });
  const validatedEvidence = assertArtistDetailLocalTimingArtifactContract(evidence);
  await mkdirFn(dirname(resolvedEvidencePath), { recursive: true });
  await writeFileFn(resolvedEvidencePath, `${JSON.stringify(validatedEvidence, null, 2)}\n`, 'utf8');
  return resolvedEvidencePath;
}

export async function resolveArtistDetailTimingInputs({
  args = process.argv.slice(2),
  env = process.env,
  readFileFn,
} = {}) {
  const { values } = parseStrictScriptOptions(artistDetailTimingCliOptions, { args });
  const artistMbid = assertArtistMbid(getRequiredStringInput(
    values,
    'artist-mbid',
    'HARMONIARR_ARTIST_DETAIL_TIMING_ARTIST_MBID',
    env,
  ));

  return {
    artistMbid,
    baseUrl: normalizeLoopbackBaseUrl(
      getOptionalStringInput(values, 'base-url', 'HARMONIARR_ARTIST_DETAIL_TIMING_BASE_URL', env)
        ?? defaultArtistDetailTimingBaseUrl,
    ),
    evidencePath: getOptionalStringInput(values, 'evidence-path', artistDetailTimingEvidencePathEnvVar, env),
    headless: getBooleanInput(values, 'headless', 'HARMONIARR_ARTIST_DETAIL_TIMING_HEADLESS', env, true),
    password: await getRequiredSecretFileInput({
      env,
      fileEnvName: artistDetailTimingPasswordFileEnvVar,
      fileOptionName: 'password-file',
      readFileFn,
      values,
    }),
    timeoutMs: parsePositiveInteger(
      values['timeout-ms'] ?? env.HARMONIARR_ARTIST_DETAIL_TIMING_TIMEOUT_MS,
      'timeout-ms',
      defaultArtistDetailTimingTimeoutMs,
    ),
    runs: parsePositiveInteger(
      values.runs ?? env.HARMONIARR_ARTIST_DETAIL_TIMING_RUNS,
      'runs',
      defaultArtistDetailTimingRuns,
      maximumArtistDetailTimingBatchSamples,
    ),
    username: getRequiredStringInput(values, 'username', 'HARMONIARR_ARTIST_DETAIL_TIMING_USERNAME', env),
  };
}

export async function runArtistDetailTimingFromEnvironment(env = process.env, {
  args = process.argv.slice(2),
  cwd = process.cwd(),
} = {}) {
  const inputs = await resolveArtistDetailTimingInputs({ args, env });
  const evidence = await measureArtistDetailLocalTimingRuns(inputs);

  if (inputs.evidencePath) {
    await writeArtistDetailLocalTimingEvidence({
      cwd,
      evidence,
      evidencePath: inputs.evidencePath,
    });
  }

  return evidence;
}

await runDirectScriptTask(import.meta, {
  prefix: 'harmoniarr-measure-artist-detail-local-timing',
  renderSuccessMessage: (evidence) => JSON.stringify(evidence),
  run: () => runArtistDetailTimingFromEnvironment(),
  stdoutStyle: 'raw',
});
