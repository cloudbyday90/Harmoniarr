import assert from 'node:assert/strict';
import test from 'node:test';

import {
  maintainDockerHubTags,
  renderDockerHubTagMaintenanceSummaryLines,
  selectDockerHubTagDeletionCandidates,
} from '../../scripts/docker-hub-tag-maintenance.js';

test('selectDockerHubTagDeletionCandidates keeps latest plus the newest non-protected tags', () => {
  const selection = selectDockerHubTagDeletionCandidates([
    { last_updated: '2026-05-01T00:00:00Z', name: 'latest' },
    { last_updated: '2026-04-30T00:00:00Z', name: 'v0.4.0-beta' },
    { last_updated: '2026-04-29T00:00:00Z', name: 'v0.3.0-beta' },
    { last_updated: '2026-04-28T00:00:00Z', name: 'v0.2.0-beta' },
  ], {
    keepCount: 2,
    protectedTags: ['latest'],
  });

  assert.deepEqual(selection.keptTags.map((tag) => tag.name), [
    'latest',
    'v0.4.0-beta',
    'v0.3.0-beta',
  ]);
  assert.deepEqual(selection.deleteCandidates.map((tag) => tag.name), ['v0.2.0-beta']);
});

test('maintainDockerHubTags paginates tag listings and previews deletions during dry runs', async () => {
  const fetchCalls = [];
  const responses = new Map([
    ['POST https://hub.docker.com/v2/auth/token', {
      json: async () => ({ access_token: 'docker-hub-access-token' }),
      ok: true,
    }],
    ['GET https://hub.docker.com/v2/namespaces/cloudbyday90/repositories/harmoniarr/tags?page_size=100', {
      json: async () => ({
        next: 'https://hub.docker.com/v2/namespaces/cloudbyday90/repositories/harmoniarr/tags?page=2&page_size=100',
        results: [
          { last_updated: '2026-05-01T00:00:00Z', name: 'latest' },
          { last_updated: '2026-04-30T00:00:00Z', name: 'v0.4.0-beta' },
        ],
      }),
      ok: true,
    }],
    ['GET https://hub.docker.com/v2/namespaces/cloudbyday90/repositories/harmoniarr/tags?page=2&page_size=100', {
      json: async () => ({
        next: null,
        results: [
          { last_updated: '2026-04-29T00:00:00Z', name: 'v0.3.0-beta' },
          { last_updated: '2026-04-28T00:00:00Z', name: 'v0.2.0-beta' },
        ],
      }),
      ok: true,
    }],
  ]);

  const fetchImpl = async (url, init = {}) => {
    const key = `${init.method ?? 'GET'} ${url}`;
    fetchCalls.push(key);
    const response = responses.get(key);

    if (!response) {
      throw new Error(`Unexpected fetch call: ${key}`);
    }

    return response;
  };

  const result = await maintainDockerHubTags({
    dryRun: true,
    fetchImpl,
    keepCount: 2,
    namespace: 'cloudbyday90',
    protectedTags: ['latest'],
    repository: 'harmoniarr',
    token: 'dockerhub-token',
    username: 'cloudbyday90',
  });

  assert.deepEqual(result.deletedTags, ['v0.2.0-beta']);
  assert.equal(fetchCalls.filter((call) => call.startsWith('DELETE ')).length, 0);
});

test('maintainDockerHubTags deletes outdated tags when dryRun is false', async () => {
  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    const key = `${init.method ?? 'GET'} ${url}`;
    fetchCalls.push(key);

    if (key === 'POST https://hub.docker.com/v2/auth/token') {
      return {
        json: async () => ({ access_token: 'docker-hub-access-token' }),
        ok: true,
      };
    }

    if (key === 'GET https://hub.docker.com/v2/namespaces/cloudbyday90/repositories/harmoniarr/tags?page_size=100') {
      return {
        json: async () => ({
          next: null,
          results: [
            { last_updated: '2026-05-01T00:00:00Z', name: 'latest' },
            { last_updated: '2026-04-30T00:00:00Z', name: 'v0.4.0-beta' },
            { last_updated: '2026-04-29T00:00:00Z', name: 'v0.3.0-beta' },
          ],
        }),
        ok: true,
      };
    }

    if (key === 'DELETE https://hub.docker.com/v2/repositories/cloudbyday90/harmoniarr/tags/v0.3.0-beta/') {
      return {
        ok: true,
        text: async () => '',
      };
    }

    throw new Error(`Unexpected fetch call: ${key}`);
  };

  const result = await maintainDockerHubTags({
    dryRun: false,
    fetchImpl,
    keepCount: 1,
    namespace: 'cloudbyday90',
    protectedTags: ['latest'],
    repository: 'harmoniarr',
    token: 'dockerhub-token',
    username: 'cloudbyday90',
  });

  assert.deepEqual(result.deletedTags, ['v0.3.0-beta']);
  assert.ok(fetchCalls.includes('DELETE https://hub.docker.com/v2/repositories/cloudbyday90/harmoniarr/tags/v0.3.0-beta/'));
});

test('renderDockerHubTagMaintenanceSummaryLines renders kept and deleted tag sections', () => {
  assert.deepEqual(renderDockerHubTagMaintenanceSummaryLines({
    deletedTags: ['v0.3.0-beta'],
    dryRun: false,
    keepCount: 2,
    keptTags: ['latest', 'v0.4.0-beta'],
    repository: 'cloudbyday90/harmoniarr',
    totalTags: 3,
  }), [
    '## Docker Hub Maintenance',
    '',
    '- Repository: cloudbyday90/harmoniarr',
    '- Dry run: false',
    '- Total tags observed: 3',
    '- Non-protected tags kept: 2',
    '',
    '### Kept tags',
    '- latest\n- v0.4.0-beta',
    '',
    '### Deleted tags',
    '- v0.3.0-beta',
    '',
  ]);
});