/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { executeFixtureProbeCommand } from '../../testing/integration/fixture-probe-command.js';
import { verifyLibraryAddMediaTooling } from '../../testing/integration/library-add-media-tooling.js';
import { probeIntegrationTool } from '../../testing/integration/integration-tool-probe.js';
import { assertIntegrationProbeOwner, integrationImageId, integrationProbeLabel } from '../../testing/integration/integration-preflight-policy.js';

const image = process.env.HARMONIARR_INTEGRATION_MEDIA_IMAGE;
const active = new Set();
after(async () => { await Promise.allSettled([...active]); }, { timeout: 90_000 });
function owned(work) {
  const task = work(); active.add(task);
  task.then(() => active.delete(task), () => active.delete(task));
  return task;
}
function fixture() {
  const calls = []; let id; let token;
  const invoke = async (args, options) => {
    calls.push(args[0]); const result = await executeFixtureProbeCommand('docker', args, options);
    if (args[0] === 'create') { id = result.stdout.trim(); token = args[args.indexOf('--label') + 1].slice(integrationProbeLabel.length + 1); }
    return result;
  };
  async function assertRemoved() {
    assert.match(id, /^[a-f0-9]{64}$/u);
    assert.equal((await executeFixtureProbeCommand('docker', ['container', 'ls', '-a', '--no-trunc', '--filter', `id=${id}`, '--format', '{{.ID}}'])).stdout.trim(), '');
  }
  async function cleanup() {
    if (!id) return;
    assert.match(id, /^[a-f0-9]{64}$/u);
    const present = (await executeFixtureProbeCommand('docker', ['container', 'ls', '-a', '--no-trunc', '--filter', `id=${id}`, '--format', '{{.ID}}'])).stdout.trim();
    if (!present) return;
    assert.equal(present, id);
    const rows = JSON.parse((await executeFixtureProbeCommand('docker', ['inspect', id])).stdout);
    assert.equal(rows.length, 1); assertIntegrationProbeOwner(rows[0], { id, image, tool: 'ffprobe', token });
    assert.equal(rows[0].State.Running, false); assert.equal(rows[0].ExecIDs?.length ?? 0, 0);
    await executeFixtureProbeCommand('docker', ['rm', id]);
  }
  return { invoke, calls, assertRemoved, cleanup };
}

test('native prerequisite availability returns only after its confined acknowledged probe is removed', { timeout: 60_000 }, t => owned(async () => {
  if (!integrationImageId.test(image ?? '')) { t.skip('An immutable local integration media image is required'); return; }
  const f = fixture();
  try {
    assert.equal(await verifyLibraryAddMediaTooling({ mediaImage: image, signal: t.signal, log: () => {},
      executeFileFn: (binary, args, options) => { assert.equal(binary, 'docker'); return f.invoke(args, options); } }), null);
    assert.deepEqual(f.calls, ['image', 'create', 'inspect', 'start', 'inspect', 'inspect', 'inspect', 'rm']);
    await f.assertRemoved();
  } finally { await f.cleanup(); }
}));

test('native cancellation after acknowledged create retires that stopped probe without starting it', { timeout: 60_000 }, t => owned(async () => {
  if (!integrationImageId.test(image ?? '')) { t.skip('An immutable local integration media image is required'); return; }
  const f = fixture(); const controller = new AbortController();
  try {
    assert.match(await verifyLibraryAddMediaTooling({ mediaImage: image, signal: controller.signal, log: () => assert.fail('Cancelled success log'),
      executeFileFn: async (binary, args, options) => {
        assert.equal(binary, 'docker'); const result = await f.invoke(args, options);
        if (args[0] === 'create') controller.abort(null);
        return result;
      } }), /unavailable/u);
    assert.equal(f.calls.includes('start'), false); assert.equal(f.calls.at(-1), 'rm'); await f.assertRemoved();
  } finally { await f.cleanup(); }
}));

test('native acknowledged probe preserves original null after attached command completion and actual retirement', { timeout: 60_000 }, t => owned(async () => {
  if (!integrationImageId.test(image ?? '')) { t.skip('An immutable local integration media image is required'); return; }
  const f = fixture();
  try {
    await assert.rejects(probeIntegrationTool({ image, tool: 'ffprobe', signal: t.signal, invoke: async (args, options) => {
      const result = await f.invoke(args, options); if (args[0] === 'start') throw null; return result;
    } }), error => error === null);
    assert.equal(f.calls.includes('start'), true); assert.equal(f.calls.at(-1), 'rm'); await f.assertRemoved();
  } finally { await f.cleanup(); }
}));
