/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { executeFixtureProbeCommand } from './fixture-probe-command.js';
import { probeIntegrationTool } from './integration-tool-probe.js';
import { integrationImageId, integrationPreflightError } from './integration-preflight-policy.js';

/** Availability requires returned command close and acknowledged image-probe retirement. */
export async function verifyLibraryAddMediaTooling({ mediaImage, phaseObserver = null, signal,
  executeFileFn = executeFixtureProbeCommand, probe = probeIntegrationTool, log = message => console.log(message) } = {}) {
  if (typeof executeFileFn !== 'function' || typeof log !== 'function' || typeof probe !== 'function'
    || (phaseObserver !== null && typeof phaseObserver?.measure !== 'function')) {
    throw new TypeError('Invalid library-add tooling observer');
  }
  const measure = (phase, operation) => phaseObserver ? phaseObserver.measure(phase, operation) : operation();
  try {
    if (signal?.aborted) throw signal.reason;
    if (mediaImage) {
      const image = await measure('media_image_inspect', async () => {
        const rows = JSON.parse((await executeFileFn('docker', ['image', 'inspect', mediaImage], { signal })).stdout);
        const row = rows?.[0];
        if (!Array.isArray(rows) || rows.length !== 1 || !integrationImageId.test(row?.Id ?? '') || row.Os !== 'linux'
          || Object.keys(row.Config?.Volumes ?? {}).length || (integrationImageId.test(mediaImage) && mediaImage !== row.Id)) {
          throw integrationPreflightError();
        }
        return row.Id;
      });
      const version = await measure('media_version', () => probe({ image, tool: 'ffprobe', signal,
        invoke: (args, options) => executeFileFn('docker', args, options) }));
      if (signal?.aborted) throw signal.reason;
      log(`Local media fixture: ${mediaImage} ${image}; ffprobe version ${version}`);
    } else {
      await measure('media_version', () => executeFileFn('ffprobe', ['-version'], { signal }));
      if (signal?.aborted) throw signal.reason;
      await measure('media_version', () => executeFileFn('ffmpeg', ['-version'], { signal }));
    }
    if (signal?.aborted) throw signal.reason;
    return null;
  } catch { return 'Local ffmpeg/ffprobe fixture unavailable; configure HARMONIARR_INTEGRATION_MEDIA_IMAGE or install local tools'; }
}
