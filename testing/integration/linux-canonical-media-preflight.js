/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createMediaDockerInspectionReader } from './media-docker-inspection-reader.js';
import { disabledMediaTransportObserver } from './media-transport-phase-observer.js';
import { linuxCanonicalMediaError } from './linux-canonical-media-policy.js';

const executeFile = promisify(execFile);

/** Read-only prerequisites, including acknowledged local CLI/API daemon identity, before PostgreSQL. */
export async function preflightLinuxCanonicalMedia({ env, executeFileFn = executeFile, createReader = createMediaDockerInspectionReader }) {
  let pinned = { ...env };
  const invoke = (_phase, args) => executeFileFn('docker', args,
    { env: pinned, timeout: 30_000, maxBuffer: 2 * 1024 * 1024, windowsHide: true, shell: false });
  const reader = await createReader({ env: pinned, invoke, transportObserver: disabledMediaTransportObserver,
    setEnvironment: value => { pinned = value; } });
  let failed = false; let failure;
  try {
    const [image] = JSON.parse((await invoke(null, ['image', 'inspect', env.HARMONIARR_INTEGRATION_MEDIA_IMAGE])).stdout);
    if (image?.Id !== env.HARMONIARR_INTEGRATION_MEDIA_IMAGE || image.Os !== 'linux') throw linuxCanonicalMediaError();
  } catch (error) { failed = true; failure = error; }
  try { await reader.close(); } catch (error) { if (!failed) { failed = true; failure = error; } }
  if (failed) throw failure;
  // The canonical executor resolves/pins its own reviewed API; an explicit API override is refused there.
  const { DOCKER_API_VERSION: _apiVersion, ...childEnv } = pinned;
  return childEnv;
}
