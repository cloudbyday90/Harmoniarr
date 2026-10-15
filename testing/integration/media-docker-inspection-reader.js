/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { resolveMediaDockerEndpoint, assertMediaDockerVersion, mediaDockerApiVersion } from './media-docker-endpoint-policy.js';
import { createMediaDockerJsonReader } from './media-docker-json-reader.js';
import { mediaExecutorError } from './owned-media-inspection-policy.js';

/** Bootstrap is read-only and completes before container creation is admitted. */
export async function createMediaDockerInspectionReader({ invoke, env, transportObserver, setEnvironment,
  createReader = createMediaDockerJsonReader, platform = process.platform }) {
  const endpoint = await resolveMediaDockerEndpoint({ invoke, env, platform });
  setEnvironment(endpoint.env);
  const version = JSON.parse((await invoke('reader_version_cli', ['version', '--format', '{{json .Server}}'])).stdout);
  assertMediaDockerVersion(version);
  const daemon = (await invoke('reader_identity_cli', ['info', '--format', '{{.ID}}'])).stdout.trim();
  if (!daemon || daemon.length > 256) throw mediaExecutorError('fixture_media_daemon_refused');
  const reader = createReader({ socketPath: endpoint.socketPath });
  try {
    const actual = await transportObserver.measure('reader_version_api', () => reader.get(`/v${mediaDockerApiVersion}/version`));
    assertMediaDockerVersion(actual);
    const info = await transportObserver.measure('reader_identity_api', () => reader.get(`/v${mediaDockerApiVersion}/info`));
    if (actual.Version !== version.Version || actual.ApiVersion !== version.ApiVersion || actual.MinAPIVersion !== version.MinAPIVersion
      || info.ID !== daemon) throw mediaExecutorError('fixture_media_daemon_refused');
  } catch (error) { try { await reader.close(); } catch { /* Bootstrap failure is primary. */ } throw error; }
  return Object.freeze({ inspect: id => {
    if (!/^[a-f0-9]{64}$/u.test(id)) return Promise.reject(mediaExecutorError('fixture_media_owner_unknown'));
    return reader.get(`/v${mediaDockerApiVersion}/containers/${id}/json`);
  }, close: reader.close });
}
