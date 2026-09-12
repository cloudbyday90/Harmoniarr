/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createReleaseDraftCommand } from './release-draft-lifecycle-command.js';

export function createReleaseDraftClient({ env = process.env, runCommandFn = createReleaseDraftCommand() } = {}) {
  const writeEnv = { ...env, GH_HOST: 'github.com' };
  delete writeEnv.HARMONIARR_RELEASE_POLICY_TOKEN;
  async function request(path, { method = 'GET', fields = [], policy = false, uploadPath = null } = {}) {
    let childEnv = writeEnv;
    if (policy) {
      if (typeof env.HARMONIARR_RELEASE_POLICY_TOKEN !== 'string' || !env.HARMONIARR_RELEASE_POLICY_TOKEN.trim()) {
        throw new Error('A read-only release policy token is required');
      }
      childEnv = { ...writeEnv, GH_TOKEN: env.HARMONIARR_RELEASE_POLICY_TOKEN };
      delete childEnv.GITHUB_TOKEN;
    }
    const result = await runCommandFn({ env: childEnv, timeoutMs: uploadPath ? 120_000 : 60_000,
      args: ['api', '--hostname', 'github.com', '--method', method,
        '--header', 'Accept: application/vnd.github+json', '--header', 'X-GitHub-Api-Version: 2022-11-28',
        ...(uploadPath ? ['--header', 'Content-Type: application/octet-stream', '--input', uploadPath] : []),
        ...fields, path],
    });
    if (result?.exitCode !== 0 || typeof result.stdout !== 'string' || Buffer.byteLength(result.stdout) > 2_097_152) {
      throw new Error('Invalid GitHub release response');
    }
    return JSON.parse(result.stdout);
  }
  async function assertImmutablePolicy({ repository }) {
    const result = await request(`repos/${repository}/immutable-releases`, { policy: true });
    if (result?.enabled !== true) throw new Error('Repository immutable releases must be enabled');
  }
  async function resolveTag({ repository, releaseTag, revision }) {
    const ref = await request(`repos/${repository}/git/ref/tags/${encodeURIComponent(releaseTag)}`);
    if (ref?.ref !== `refs/tags/${releaseTag}`) throw new Error('Expected pre-existing release tag was not found');
    let object = ref.object;
    const seen = new Set();
    for (let depth = 0; object?.type === 'tag' && depth < 5; depth += 1) {
      if (!/^[a-f0-9]{40}$/.test(object.sha ?? '') || seen.has(object.sha)) throw new Error('Invalid release tag chain');
      seen.add(object.sha);
      const tag = await request(`repos/${repository}/git/tags/${object.sha}`);
      if (tag?.sha !== object.sha) throw new Error('Release tag object mismatch');
      object = tag.object;
    }
    if (object?.type !== 'commit' || object.sha !== revision) throw new Error('Release tag does not match the workflow source commit');
  }
  async function findReleases({ repository, releaseTag }) {
    const matches = [];
    for (let page = 1; page <= 5; page += 1) {
      const releases = await request(`repos/${repository}/releases?per_page=100&page=${page}`);
      if (!Array.isArray(releases) || releases.length > 100) throw new Error('Invalid release listing');
      matches.push(...releases.filter((release) => release?.tag_name === releaseTag));
      if (releases.length < 100) return matches;
    }
    throw new Error('Release listing exceeds the bounded draft lookup');
  }
  async function getRelease({ repository, releaseId }) {
    return request(`repos/${repository}/releases/${releaseId}`);
  }
  async function createDraft(inputs) {
    return request(`repos/${inputs.repository}/releases`, { method: 'POST', fields: [
      '--raw-field', `tag_name=${inputs.releaseTag}`, '--raw-field', `target_commitish=${inputs.revision}`,
      '--raw-field', `name=${inputs.releaseTag}`, '--raw-field', `body=${inputs.marker}`,
      '--field', 'draft=true', '--field', `prerelease=${inputs.isPrerelease}`, '--raw-field', 'make_latest=false',
    ] });
  }
  async function listAssets({ repository, releaseId }) {
    return request(`repos/${repository}/releases/${releaseId}/assets?per_page=5`);
  }
  async function uploadAsset({ repository, releaseId, release, asset }) {
    if (typeof release.upload_url !== 'string' || !release.upload_url.endsWith('{?name,label}')) throw new Error('Invalid release upload endpoint');
    const endpoint = new URL(release.upload_url.slice(0, -'{?name,label}'.length));
    if (endpoint.protocol !== 'https:' || endpoint.hostname !== 'uploads.github.com' || endpoint.port
      || endpoint.username || endpoint.password || endpoint.search || endpoint.hash
      || endpoint.pathname.toLowerCase() !== `/repos/${repository}/releases/${releaseId}/assets`.toLowerCase()) {
      throw new Error('Release upload endpoint does not match the owned release');
    }
    endpoint.searchParams.set('name', asset.name);
    return request(endpoint.href, { method: 'POST', uploadPath: asset.path });
  }
  async function publishDraft({ repository, releaseId, isPrerelease }) {
    return request(`repos/${repository}/releases/${releaseId}`, { method: 'PATCH', fields: [
      '--field', 'draft=false', '--field', `prerelease=${isPrerelease}`, '--raw-field', 'make_latest=false',
    ] });
  }
  async function verifyPublishedRelease({ repository, releaseTag }) {
    const result = await runCommandFn({ env: writeEnv, timeoutMs: 90_000,
      args: ['release', 'verify', releaseTag, '--repo', `github.com/${repository}`, '--format', 'json'] });
    if (result?.exitCode !== 0 || typeof result.stdout !== 'string' || Buffer.byteLength(result.stdout) > 2_097_152) {
      throw new Error('Release attestation verification failed');
    }
    const verified = JSON.parse(result.stdout);
    if (!verified || typeof verified !== 'object' || Array.isArray(verified) && verified.length === 0) {
      throw new Error('Release attestation verification returned no evidence');
    }
  }
  return { assertImmutablePolicy, resolveTag, findReleases, getRelease, createDraft, listAssets, uploadAsset, publishDraft, verifyPublishedRelease };
}
