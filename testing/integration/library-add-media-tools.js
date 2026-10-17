/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { verifyLibraryAddMediaTooling } from './library-add-media-tooling.js';

const executeFile = promisify(execFile);
export const libraryAddRuntimePath = (value) => process.platform === 'win32' ? value.replace(/^[a-z]:/iu, '').replaceAll('\\', '/') : value;

/** Every media invocation is scoped to the scenario's own directory and has no provider/network access. */
export function createLibraryAddMediaFixture({ getFixtureRoot, isToolingReady = () => true,
  mediaImage = process.env.HARMONIARR_INTEGRATION_MEDIA_IMAGE, inspectionExecutor = null, phaseObserver = null } = {}) {
  function mountedPath(pathValue) {
    const scoped = relative(resolve(getFixtureRoot()), resolve(pathValue));
    assert.ok(scoped && scoped !== '..' && !scoped.startsWith(`..${sep}`) && !isAbsolute(scoped), 'media fixture must stay in the test-owned workspace');
    return `/fixtures/${scoped.split(sep).join('/')}`;
  }
  async function mediaCommand(binary, args, { readonly = true } = {}) {
    if (inspectionExecutor && binary === 'ffprobe') return inspectionExecutor.run(binary, args, { readonly });
    if (!mediaImage) return executeFile(binary, args, { timeout: 20_000, maxBuffer: 2 * 1024 * 1024 });
    const mappedArgs = args.map((value) => typeof value === 'string' && isAbsolute(value) ? mountedPath(value) : value);
    return executeFile('docker', ['run', '--rm', '--network', 'none', '--entrypoint', binary, '--mount',
      `type=bind,source=${resolve(getFixtureRoot())},target=/fixtures${readonly ? ',readonly' : ''}`, mediaImage, ...mappedArgs],
    { timeout: 30_000, maxBuffer: 2 * 1024 * 1024 });
  }
  async function generateAudio(pathValue, bitrate = null) {
    await mkdir(dirname(pathValue), { recursive: true });
    await mediaCommand('ffmpeg', ['-v', 'error', '-nostdin', '-y', '-f', 'lavfi', '-i', 'sine=frequency=1000:sample_rate=44100',
      '-t', '2', '-ac', '2', '-metadata', 'artist=Controlled fixture', '-metadata', 'album=Controlled release',
      '-metadata', 'title=Controlled song', '-metadata', 'track=1', ...(bitrate ? ['-c:a', 'libmp3lame', '-b:a', `${bitrate}k`] : ['-c:a', 'pcm_s16le']), pathValue], { readonly: false });
  }
  const verifyTooling = () => verifyLibraryAddMediaTooling({ mediaImage, phaseObserver });
  const getTooling = async () => ({ status: isToolingReady() ? 'healthy' : 'degraded',
    details: { ffprobeAvailable: isToolingReady(), ffmpegAvailable: isToolingReady() } });
  return { generateAudio, getTooling, mediaCommand, verifyTooling };
}
