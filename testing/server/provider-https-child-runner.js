/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** A new process owns all proxy/trust configuration; never inherit operator secrets. */
export async function runProviderHttpsChild({ proxyUrl, caFile, scenario, signal,
  consumerUrl = new URL('./provider-https-consumer.js', import.meta.url) }) {
  signal?.throwIfAborted();
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|LANG|TZ)$/iu.test(key)));
  Object.assign(env, { NODE_USE_ENV_PROXY: '1', HTTPS_PROXY: proxyUrl, HTTP_PROXY: proxyUrl, NO_PROXY: '' });
  if (caFile) env.NODE_EXTRA_CA_CERTS = caFile;
  const child = spawn(process.execPath, [fileURLToPath(consumerUrl), scenario], {
    env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let failure;
  let failed = false;
  let bytes = 0;
  const stdout = []; const stderr = [];
  const stop = error => { if (!failed) { failed = true; failure = error; } child.kill(); };
  child.on('error', stop);
  const closed = new Promise(resolve => { child.once('close', (code, exitSignal) => resolve({ code, exitSignal })); });
  const collect = target => chunk => {
    bytes += chunk.length;
    if (bytes > 32_768) stop(new Error('Provider HTTPS child exceeded its output budget'));
    else target.push(chunk);
  };
  child.stdout.on('data', collect(stdout)); child.stderr.on('data', collect(stderr));
  child.stdout.on('error', stop); child.stderr.on('error', stop);
  const abort = () => stop(signal.reason);
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  try {
    const result = await closed;
    if (failed) throw failure;
    if (result.code !== 0 || result.exitSignal || stderr.length) {
      throw new Error(`Provider HTTPS child failed (${result.code ?? result.exitSignal}): ${Buffer.concat(stderr).toString()}`);
    }
    return JSON.parse(Buffer.concat(stdout).toString());
  } finally {
    signal?.removeEventListener('abort', abort);
  }
}
