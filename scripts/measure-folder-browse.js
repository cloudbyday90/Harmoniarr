/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { open, writeFile } from 'node:fs/promises';
import { parseFolderProfileCommand } from '../testing/performance/folder-profile-policy.js';
import { runFolderProfile } from '../testing/performance/folder-profile-runner.js';

const controller = new AbortController();
const abort = () => controller.abort();
process.on('SIGINT', abort); process.on('SIGTERM', abort);
let output;
try {
  const selection = parseFolderProfileCommand(process.argv.slice(2));
  output = await open(selection.output, 'wx', 0o600);
  const result = await runFolderProfile(selection, { signal: controller.signal,
    onProgress: row => process.stdout.write(JSON.stringify({ kind: 'folder_profile_progress', ...row }) + '\n') });
  await output.writeFile(JSON.stringify(result.report, null, 2));
  if (result.failed) {
    await writeFile(selection.output + '.private.log', String(result.failure?.stack ?? result.failure) + '\n' + String(result.failure?.stderr ?? ''), { flag: 'wx', mode: 0o600 });
    process.exitCode = 1;
  }
  process.stdout.write(JSON.stringify({ kind: 'folder_profile_result', failed: result.failed, samples: result.report.samples.length, cleanup: result.report.cleanup }) + '\n');
} catch (error) {
  process.stderr.write(JSON.stringify({ kind: 'folder_profile_error', name: error?.name ?? 'Unknown', code: typeof error?.code === 'string' ? error.code : null }) + '\n'); process.exitCode = 1;
} finally { await output?.close(); process.off('SIGINT', abort); process.off('SIGTERM', abort); }
