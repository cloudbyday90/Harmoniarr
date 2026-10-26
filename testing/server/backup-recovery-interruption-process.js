/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { posix } from 'node:path';
import { parseBackupRecoveryInterruptionMessage, validateBackupRecoveryInterruptionCase } from './backup-recovery-interruption-plan.js';

const failure = code => Object.assign(new Error('Backup recovery interruption process failed'), { code });
export function startBackupRecoveryInterruptionProcess({ caseName, runId, root, mode = 'interrupt', spawnFn = spawn }) {
  validateBackupRecoveryInterruptionCase(caseName);
  if (!['interrupt', 'resume'].includes(mode) || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iu.test(runId)
    || typeof root !== 'string' || !root.startsWith('/app/data/') || root.includes('\0') || posix.resolve(root) !== root) throw new TypeError('Invalid recovery process input');
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(?:PATH|LANG|TZ|PGHOST|PGPORT|PGUSER|PGPASSWORD|PGDATABASE|PGDATA|POSTGRES_USER|POSTGRES_PASSWORD|HARMONIARR_MEMORY_PROFILE_GIB)$/u.test(key)));
  env.HARMONIARR_BACKUPS = root;
  const child = spawnFn(process.execPath, [fileURLToPath(new URL('./backup-recovery-interruption-child.js', import.meta.url)), caseName, runId, mode],
    { env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], shell: false, windowsHide: true });
  const closed = Promise.withResolvers(), fault = Promise.withResolvers();
  const events = new Map(['checkpoint', 'draining', 'finished'].map(event => [event, Promise.withResolvers()]));
  const seen = new Set(); let outcome, primary, bytes = 0, diagnostics = '';
  const fail = code => { primary ??= failure(code); fault.resolve({ error: primary }); };
  child.once('error', () => fail('recovery_spawn_failed'));
  child.once('close', (code, signal) => { outcome = { code, signal }; closed.resolve(outcome); });
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', chunk => { bytes += chunk.length; if (bytes > 32768) fail('recovery_output_budget'); else diagnostics += chunk.toString('utf8'); });
    stream.on('error', () => fail('recovery_stream_failed'));
  }
  child.on('message', value => {
    try {
      bytes += Buffer.byteLength(JSON.stringify(value));
      if (bytes > 32768 || seen.has(value?.event)) throw failure('recovery_protocol_failed');
      const message = parseBackupRecoveryInterruptionMessage(value, { caseName, runId, pid: child.pid });
      if (mode === 'resume' && message.event !== 'finished') throw failure('recovery_protocol_failed');
      if (message.event === 'draining' && !seen.has('checkpoint')) throw failure('recovery_protocol_failed');
      seen.add(message.event); events.get(message.event).resolve({ value: message });
    } catch { fail('recovery_protocol_failed'); }
  });
  async function bounded(work, timeoutMs = 20_000) {
    let timer;
    try { return await Promise.race([work, new Promise((_, reject) => { timer = setTimeout(() => reject(failure('recovery_wait_expired')), timeoutMs); })]); }
    finally { clearTimeout(timer); }
  }
  async function waitFor(event) {
    if (primary) throw primary;
    if (!events.has(event)) throw new TypeError('Invalid recovery event wait');
    const result = await bounded(Promise.race([events.get(event).promise, fault.promise, closed.promise.then(() => ({ error: failure('recovery_closed_early') }))]), mode === 'resume' ? 45_000 : 20_000);
    if (primary || result.error) throw primary ?? result.error;
    return result.value;
  }
  async function command(event) {
    if (primary || outcome || !seen.has('checkpoint') || !['release', 'shutdown'].includes(event)) throw primary ?? failure('recovery_command_refused');
    await bounded(new Promise((resolve, reject) => { child.send({ event }, error => error ? reject(failure('recovery_send_failed')) : resolve()); }));
  }
  async function killAndClose() {
    if (!outcome && Number.isInteger(child.pid) && child.pid > 1) child.kill('SIGKILL');
    return bounded(closed.promise, 5000);
  }
  return {
    waitFor, command, isClosed: () => Boolean(outcome), diagnostics: () => diagnostics,
    async crash() {
      if (!seen.has('checkpoint') || primary) throw primary ?? failure('recovery_crash_unacknowledged');
      const result = await killAndClose();
      if (result.code !== null || result.signal !== 'SIGKILL') throw failure('recovery_sigkill_unverified');
    },
    async complete() {
      await waitFor('finished');
      const result = await bounded(closed.promise);
      if (primary || result.code !== 0 || result.signal) throw primary ?? failure('recovery_exit_failed');
    },
    dispose: killAndClose,
  };
}
