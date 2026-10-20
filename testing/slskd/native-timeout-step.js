/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { nativePeer, nativeTimeoutFile } from './fixture-data.js';

const { apiKey, expectedVersion } = JSON.parse(await readFile('/run/fixture.json', 'utf8'));
const statePath = '/tmp/native-timeout.json';
async function api(path, method = 'GET', body) {
  const response = await fetch('http://provider:5030/api/v0/' + path, {
    method, headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(2000),
  });
  return { status: response.status, body: response.status === 204 ? null : await response.json() };
}
const transferPath = id => 'transfers/downloads/' + nativePeer + '/' + id;
async function enqueue() {
  const id = randomUUID();
  const result = await api('transfers/downloads/batches', 'POST', { id, username: nativePeer, files: [nativeTimeoutFile] });
  assert.equal(result.body.batch.id, id);
  assert.equal(result.body.batch.username, nativePeer);
  assert.equal(result.body.batch.direction, 'Download');
  return result;
}
function exact(row, id, batchId) {
  assert.equal(row.id, id); assert.equal(row.batchId, batchId);
  assert.equal(row.username, nativePeer); assert.equal(row.filename, nativeTimeoutFile.filename);
  assert.equal(row.size, nativeTimeoutFile.size); assert.equal(row.bytesTransferred, 0);
}
const phase = process.argv[2];
let result;
if (phase === 'start') {
  const deadline = performance.now() + 15_000;
  while ((await api('server')).body.isLoggedIn !== true) {
    assert.ok(performance.now() < deadline, 'Native provider must log in');
    await delay(100);
  }
  const version = await api('application/version');
  assert.equal(version.status, 200); assert.equal(version.body, expectedVersion);
  const submitted = await enqueue();
  assert.equal(submitted.status, 201); assert.equal(submitted.body.batch.transfers.length, 1);
  assert.deepEqual(submitted.body.failures, []);
  const receipt = submitted.body.batch.transfers[0];
  assert.match(receipt.id, /^[a-f0-9-]{36}$/u);
  exact(receipt, receipt.id, submitted.body.batch.id);
  result = { id: receipt.id, batchId: receipt.batchId, rawVersion: version.body, postStatus: submitted.status };
  await writeFile(statePath, JSON.stringify(result), { flag: 'wx', mode: 0o600 });
} else {
  const original = JSON.parse(await readFile(statePath, 'utf8'));
  const response = await api(transferPath(original.id));
  assert.equal(response.status, 200); exact(response.body, original.id, original.batchId);
  const terminal = response.body.state.split(', ').includes('Completed');
  result = { terminal, state: response.body.state, exception: response.body.exception, ...original };
  if (phase === 'retry') {
    assert.equal(terminal, true);
    const candidate = original.rawVersion === '0.26.1.0';
    if (candidate) {
      const debug = await api('debug/transfers');
      assert.equal(debug.status, 200); assert.deepEqual(debug.body.soulseek.downloads, []);
    }
    const retried = await enqueue();
    result.retryStatus = retried.status;
    if (candidate) {
      assert.equal(retried.status, 201); assert.equal(retried.body.failures.length, 0);
      assert.equal(retried.body.batch.transfers.length, 1);
      const next = retried.body.batch.transfers[0];
      assert.notEqual(next.id, original.id); assert.notEqual(next.batchId, original.batchId);
      const deadline = performance.now() + 15_000;
      let queued;
      do {
        queued = await api(transferPath(next.id));
        assert.equal(queued.status, 200); exact(queued.body, next.id, next.batchId);
        if (queued.body.state === 'Queued, Remotely') break;
        await delay(100);
      } while (performance.now() < deadline);
      assert.equal(queued.body.state, 'Queued, Remotely');
      const after = await api('debug/transfers');
      assert.equal(after.status, 200); assert.equal(after.body.soulseek.downloads.length, 1);
      assert.equal(after.body.soulseek.downloads[0].filename, nativeTimeoutFile.filename);
      const prior = await api(transferPath(original.id));
      assert.equal(prior.status, 200); exact(prior.body, original.id, original.batchId);
      assert.equal(prior.body.state, response.body.state);
      result.retryState = queued.body.state;
      result.internalRetirementVerified = true;
    } else {
      assert.equal(retried.status, 200); assert.equal(retried.body.batch.transfers.length, 0);
      assert.equal(retried.body.failures.length, 1);
      assert.match(JSON.stringify(retried.body.failures), /already.*(?:progress|queued|exists)/iu);
      result.retryBlocked = true;
    }
  } else assert.equal(phase, 'observe');
}
console.log(JSON.stringify(result));
