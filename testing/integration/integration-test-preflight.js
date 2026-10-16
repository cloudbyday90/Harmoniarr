/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createIntegrationTestEnvironment } from './integration-test-environment.js';
import { integrationImageId, integrationPreflightError } from './integration-preflight-policy.js';
import { supportsPostgresStartupImage } from './postgres-startup-config.js';
import { probeIntegrationTool } from './integration-tool-probe.js';

const executeFile = promisify(execFile);

/** Prove the selected local image capabilities before any database/server admission. */
export async function preflightIntegrationTests({ env = process.env, signal, executeFileFn = executeFile,
  probe = probeIntegrationTool } = {}) {
  if (signal?.aborted) throw signal.reason;
  const environment = createIntegrationTestEnvironment(env);
  const postgres = environment.HARMONIARR_INTEGRATION_POSTGRES_IMAGE ?? 'postgres:18-alpine';
  const media = environment.HARMONIARR_INTEGRATION_MEDIA_IMAGE; const reader = environment.HARMONIARR_INTEGRATION_LINUX_READER_IMAGE;
  if (!supportsPostgresStartupImage(postgres) || ![media, reader].every(value => integrationImageId.test(value ?? ''))) {
    throw integrationPreflightError();
  }
  const checkCancellation = () => { if (signal?.aborted) throw signal.reason; };
  const invoke = (args, options = {}) => executeFileFn('docker', args, { env: environment,
    timeout: 30_000, maxBuffer: 2 * 1024 * 1024, windowsHide: true, shell: false, ...options });
  async function inspectImage(reference, pg = false) {
    checkCancellation();
    const rows = JSON.parse((await invoke(['image', 'inspect', reference])).stdout);
    const image = rows?.[0]; const volumes = Object.keys(image?.Config?.Volumes ?? {});
    if (!Array.isArray(rows) || rows.length !== 1 || !integrationImageId.test(image?.Id ?? '') || image.Os !== 'linux'
      || (pg ? volumes.length !== 1 || volumes[0] !== '/var/lib/postgresql' : volumes.length !== 0)
      || (integrationImageId.test(reference) && image.Id !== reference)) throw integrationPreflightError();
    return image;
  }
  checkCancellation();
  const pgImage = await inspectImage(postgres, true);
  let pgReference = postgres;
  if (!postgres.includes('@')) {
    const digests = pgImage.RepoDigests?.filter(value => /^postgres@sha256:[a-f0-9]{64}$/u.test(value));
    if (digests?.length !== 1) throw integrationPreflightError();
    pgReference = postgres + '@' + digests[0].split('@')[1];
  }
  if ((await inspectImage(pgReference, true)).Id !== pgImage.Id) throw integrationPreflightError();
  await inspectImage(media); await inspectImage(reader);
  const versions = {};
  for (const [tool, image] of [['postgres', pgImage.Id], ['ffmpeg', media], ['ffprobe', media], ['node', reader], ['docker', reader]]) {
    checkCancellation(); versions[tool] = await probe({ tool, image, signal, invoke }); checkCancellation();
  }
  return Object.freeze({ env: Object.freeze({ ...environment, HARMONIARR_INTEGRATION_POSTGRES_IMAGE: pgReference }),
    evidence: Object.freeze({ postgres: pgImage.Id, media, reader, versions: Object.freeze(versions) }) });
}
