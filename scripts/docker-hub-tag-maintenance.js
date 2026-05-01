/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { appendGitHubStepSummary, createMarkdownBulletList } from './github-actions-summary.js';
import { resolveDockerHubTagMaintenanceInputs } from './container-maintenance-inputs.js';
import { runDirectScriptTask } from './script-runtime.js';

const dockerHubApiBaseUrl = 'https://hub.docker.com';

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function parsePositiveInteger(value, fieldName) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative integer`);
  }

  return parsed;
}

function compareByLastUpdatedDescending(left, right) {
  const leftTimestamp = Date.parse(left.lastUpdated || '') || 0;
  const rightTimestamp = Date.parse(right.lastUpdated || '') || 0;

  if (leftTimestamp !== rightTimestamp) {
    return rightTimestamp - leftTimestamp;
  }

  return left.name.localeCompare(right.name);
}

function normalizeTagRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error('Docker Hub tag records must be JSON objects');
  }

  if (!isNonEmptyString(record.name)) {
    throw new Error('Docker Hub tag records must include a non-empty name');
  }

  return {
    lastUpdated: isNonEmptyString(record.last_updated) ? record.last_updated.trim() : '',
    name: record.name.trim(),
  };
}

function formatHttpError(errorPrefix, response, bodyText) {
  const excerpt = bodyText.trim().slice(0, 400);
  const detail = excerpt ? ` ${excerpt}` : '';
  return `${errorPrefix} (HTTP ${response.status} ${response.statusText}).${detail}`;
}

async function fetchJson(url, init, errorPrefix, fetchImpl = fetch) {
  const response = await fetchImpl(url, init);
  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(formatHttpError(errorPrefix, response, bodyText));
  }

  return response.json();
}

export function renderDockerHubTagMaintenanceSummaryLines(result) {
  return [
    '## Docker Hub Maintenance',
    '',
    `- Repository: ${result.repository}`,
    `- Dry run: ${result.dryRun}`,
    `- Total tags observed: ${result.totalTags}`,
    `- Non-protected tags kept: ${result.keepCount}`,
    '',
    '### Kept tags',
    createMarkdownBulletList(result.keptTags),
    '',
    '### Deleted tags',
    createMarkdownBulletList(result.deletedTags),
    '',
  ];
}

export function selectDockerHubTagDeletionCandidates(tags, {
  keepCount = 5,
  protectedTags = ['latest'],
} = {}) {
  const normalizedKeepCount = parsePositiveInteger(keepCount, 'keepCount');
  const normalizedProtectedTags = new Set(
    protectedTags
      .filter(isNonEmptyString)
      .map((tagName) => tagName.trim()),
  );

  const normalizedTags = tags.map((tag) => normalizeTagRecord(tag));
  const protectedMatches = [];
  const eligibleTags = [];

  for (const tag of normalizedTags) {
    if (normalizedProtectedTags.has(tag.name)) {
      protectedMatches.push(tag);
      continue;
    }

    eligibleTags.push(tag);
  }

  eligibleTags.sort(compareByLastUpdatedDescending);

  return {
    deleteCandidates: eligibleTags.slice(normalizedKeepCount),
    keptTags: protectedMatches.concat(eligibleTags.slice(0, normalizedKeepCount)),
    protectedTags: protectedMatches,
    totalTags: normalizedTags.length,
  };
}

export async function createDockerHubAccessToken({
  fetchImpl = fetch,
  token,
  username,
} = {}) {
  const payload = await fetchJson(
    `${dockerHubApiBaseUrl}/v2/auth/token`,
    {
      body: JSON.stringify({
        identifier: username,
        secret: token,
      }),
      headers: {
        'content-type': 'application/json',
      },
      method: 'POST',
    },
    'Docker Hub access token request failed',
    fetchImpl,
  );

  if (!isNonEmptyString(payload.access_token)) {
    throw new Error('Docker Hub access token response did not include access_token');
  }

  return payload.access_token.trim();
}

export async function listDockerHubTags({
  accessToken,
  fetchImpl = fetch,
  namespace,
  pageSize = 100,
  repository,
} = {}) {
  const normalizedPageSize = parsePositiveInteger(pageSize, 'pageSize');
  const tags = [];
  let nextUrl = `${dockerHubApiBaseUrl}/v2/namespaces/${encodeURIComponent(namespace)}/repositories/${encodeURIComponent(repository)}/tags?page_size=${normalizedPageSize}`;

  while (nextUrl) {
    const payload = await fetchJson(
      nextUrl,
      {
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        method: 'GET',
      },
      'Docker Hub tag listing failed',
      fetchImpl,
    );

    if (!Array.isArray(payload.results)) {
      throw new Error('Docker Hub tag listing response did not include results');
    }

    tags.push(...payload.results);
    nextUrl = isNonEmptyString(payload.next) ? payload.next.trim() : null;
  }

  return tags;
}

export async function deleteDockerHubTag({
  accessToken,
  fetchImpl = fetch,
  namespace,
  repository,
  tagName,
} = {}) {
  const response = await fetchImpl(
    `${dockerHubApiBaseUrl}/v2/repositories/${encodeURIComponent(namespace)}/${encodeURIComponent(repository)}/tags/${encodeURIComponent(tagName)}/`,
    {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'DELETE',
    },
  );

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(formatHttpError(`Docker Hub tag deletion failed for ${tagName}`, response, bodyText));
  }

  return tagName;
}

export async function maintainDockerHubTags({
  dryRun = false,
  fetchImpl = fetch,
  keepCount = 5,
  namespace,
  protectedTags = ['latest'],
  repository,
  token,
  username,
} = {}) {
  const accessToken = await createDockerHubAccessToken({
    fetchImpl,
    token,
    username,
  });
  const tags = await listDockerHubTags({
    accessToken,
    fetchImpl,
    namespace,
    repository,
  });
  const selection = selectDockerHubTagDeletionCandidates(tags, {
    keepCount,
    protectedTags,
  });

  const deletedTags = [];
  if (!dryRun) {
    for (const tag of selection.deleteCandidates) {
      deletedTags.push(await deleteDockerHubTag({
        accessToken,
        fetchImpl,
        namespace,
        repository,
        tagName: tag.name,
      }));
    }
  }

  return {
    deletedTags: dryRun
      ? selection.deleteCandidates.map((tag) => tag.name)
      : deletedTags,
    dryRun,
    keepCount: parsePositiveInteger(keepCount, 'keepCount'),
    keptTags: selection.keptTags.map((tag) => tag.name),
    protectedTags: selection.protectedTags.map((tag) => tag.name),
    repository: `${namespace}/${repository}`,
    totalTags: selection.totalTags,
  };
}

async function writeGitHubStepSummary(result, summaryPath) {
  if (!summaryPath) {
    return;
  }

  await appendGitHubStepSummary(summaryPath, renderDockerHubTagMaintenanceSummaryLines(result));
}

await runDirectScriptTask(import.meta, {
    prefix: 'harmoniarr-docker-hub-tag-maintenance',
    renderSuccessMessage: ({ deletedTags, dryRun, repository, totalTags }) => {
      const mode = dryRun ? 'previewed' : 'deleted';
      return `Docker Hub maintenance ${mode} ${deletedTags.length} outdated tag${deletedTags.length === 1 ? '' : 's'} for ${repository} (${totalTags} tag${totalTags === 1 ? '' : 's'} scanned)`;
    },
    run: async () => {
      const { summaryPath, ...inputs } = resolveDockerHubTagMaintenanceInputs();
      const result = await maintainDockerHubTags(inputs);

      await writeGitHubStepSummary(result, summaryPath);
      return result;
    },
  });