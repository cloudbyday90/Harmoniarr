/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { mediaExecutorError } from './owned-media-inspection-policy.js';

export const mediaDockerApiVersion = '1.56';
const refused = () => mediaExecutorError('fixture_media_endpoint_refused');

/** Deliberately local-only; no URL normalization may turn a remote authority local. */
export function mediaDockerSocketPath(host, platform = process.platform) {
  if (typeof host !== 'string') throw refused();
  if (platform === 'win32' && /^npipe:\/\/\/\/\.\/pipe\/[a-zA-Z0-9_.-]+$/u.test(host)) {
    return host.slice('npipe:////./pipe/'.length).replace(/^/u, '\\\\.\\pipe\\');
  }
  if (platform !== 'win32' && /^unix:\/\/\/[a-zA-Z0-9_./-]+$/u.test(host)
    && !host.slice(7).split('/').some(part => part === '..' || part === '.')) return host.slice(7);
  throw refused();
}

export function assertMediaDockerVersion(version) {
  const api = value => typeof value === 'string' && /^1\.[0-9]{2}$/u.test(value) ? Number(value.slice(2)) : NaN;
  if (!version || typeof version.Version !== 'string' || !version.Version || version.Os !== 'linux'
    || !(api(version.MinAPIVersion) <= 56 && api(version.ApiVersion) >= 56)) throw refused();
}

/** Resolve once, then pin all CLI calls through a captured environment to the same socket. */
export async function resolveMediaDockerEndpoint({ invoke, env, platform = process.platform }) {
  for (const key of ['DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH', 'DOCKER_API_VERSION']) if (env[key]) throw refused();
  let host;
  if (!env.DOCKER_CONTEXT && env.DOCKER_HOST) host = env.DOCKER_HOST;
  else {
    const context = (await invoke('reader_context', ['context', 'show'])).stdout.trim();
    if (!context || context.length > 256 || !/^[a-zA-Z0-9_.-]+$/u.test(context)) throw refused();
    const [metadata] = JSON.parse((await invoke('reader_context', ['context', 'inspect', context])).stdout);
    const endpoint = metadata?.Endpoints?.docker;
    if (metadata?.Name !== context || endpoint?.SkipTLSVerify !== false
      || (metadata.TLSMaterial?.docker?.length ?? 0) !== 0) throw refused();
    host = endpoint.Host;
  }
  const socketPath = mediaDockerSocketPath(host, platform);
  const pinnedEnv = { ...env, DOCKER_HOST: host, DOCKER_API_VERSION: mediaDockerApiVersion };
  delete pinnedEnv.DOCKER_CONTEXT;
  return Object.freeze({ socketPath, env: Object.freeze(pinnedEnv) });
}
