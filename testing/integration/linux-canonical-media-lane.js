/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { run } from 'node:test';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { createLinuxCanonicalMediaEvidence, resolveLinuxCanonicalMediaEnvironment } from './linux-canonical-media-policy.js';
import { preflightLinuxCanonicalMedia } from './linux-canonical-media-preflight.js';

let environmentOwned = false;

/** Standalone selected lane; drain all test events after evidence failure, never force-exit cleanup. */
export async function runLinuxCanonicalMedia({ env = process.env, platform = process.platform, nodeVersion = process.version,
  execArgv = process.execArgv, signal, preflight = preflightLinuxCanonicalMedia, runTests = run } = {}) {
  if (execArgv.some(value => /^(?:-[ep]+|--eval|--print|--input-type)(?:=|$)/u.test(value))) {
    throw new Error('Linux canonical media requires a file-based entrypoint');
  }
  const selected = resolveLinuxCanonicalMediaEnvironment({ env, platform, nodeVersion });
  if (signal?.aborted) throw signal.reason;
  const pinned = await preflight({ env: selected });
  if (signal?.aborted) throw signal.reason;
  const overrides = { ...pinned, DOCKER_CONTEXT: undefined, DOCKER_API_VERSION: undefined, NODE_TEST_CONTEXT: undefined,
    HARMONIARR_INTEGRATION_MEDIA_IMAGE: selected.HARMONIARR_INTEGRATION_MEDIA_IMAGE,
    HARMONIARR_LIBRARY_ADD_MEDIA_EXECUTION: 'owned-api', HARMONIARR_LIBRARY_ADD_MEDIA_DIAGNOSTICS: 'on' };
  if (environmentOwned) throw new Error('Linux canonical media environment is already owned');
  environmentOwned = true;
  const previous = { ...process.env };
  const evidence = createLinuxCanonicalMediaEvidence(); const started = performance.now();
  let failed = false; let failure;
  try {
    for (const key of Object.keys(process.env)) if (!Object.hasOwn(overrides, key)) delete process.env[key];
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    const stream = runTests({ files: [fileURLToPath(new URL('../../test/integration/missing-music-add-to-library.test.js', import.meta.url))],
      concurrency: 1, execArgv: [], signal });
    try {
      for await (const event of stream) {
        if (failed) continue;
        try { evidence.observe(event); } catch (error) { failed = true; failure = error; }
      }
    } catch (error) { if (!failed) { failed = true; failure = error; } }
    if (failed) throw failure;
    return { version: 1, platform, node: nodeVersion, mode: 'owned-api', engineApi: '1.56',
      ...evidence.finish(), elapsedMs: performance.now() - started };
  } finally {
    for (const key of Object.keys(process.env)) if (!Object.hasOwn(previous, key)) delete process.env[key];
    Object.assign(process.env, previous); environmentOwned = false;
  }
}
