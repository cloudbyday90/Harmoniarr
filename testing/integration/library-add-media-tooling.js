/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const executeFile = promisify(execFile);

/** Observe the original prerequisite commands without changing their work or failure policy. */
export async function verifyLibraryAddMediaTooling({ mediaImage, phaseObserver = null,
  executeFileFn = executeFile, log = message => console.log(message) } = {}) {
  if (typeof executeFileFn !== 'function' || typeof log !== 'function'
    || (phaseObserver !== null && typeof phaseObserver?.measure !== 'function')) {
    throw new TypeError('Invalid library-add tooling observer');
  }
  const measure = (phase, operation) => phaseObserver ? phaseObserver.measure(phase, operation) : operation();
  try {
    if (mediaImage) {
      const identity = await measure('media_image_inspect', () => executeFileFn('docker', ['image', 'inspect', mediaImage, '--format', '{{.Id}}']));
      const version = await measure('media_version', () => executeFileFn('docker', ['run', '--rm', '--network', 'none', '--entrypoint', 'ffprobe', mediaImage, '-version']));
      log(`Local media fixture: ${mediaImage} ${identity.stdout.trim()}; ${version.stdout.split('\n')[0]}`);
    } else {
      await measure('media_version', () => executeFileFn('ffprobe', ['-version']));
      await measure('media_version', () => executeFileFn('ffmpeg', ['-version']));
    }
    return null;
  } catch { return 'Local ffmpeg/ffprobe fixture unavailable; configure HARMONIARR_INTEGRATION_MEDIA_IMAGE or install local tools'; }
}
