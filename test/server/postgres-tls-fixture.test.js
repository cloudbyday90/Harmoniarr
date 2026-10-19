/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { createPrivateKey, X509Certificate } from 'node:crypto';
import { access, readFile, rm } from 'node:fs/promises';
import test from 'node:test';
import { dirname } from 'node:path';
import certificates from '../../testing/integration/fixtures/postgres-tls.json' with { type: 'json' };
import { withPostgresTlsFixture } from '../../testing/integration/postgres-tls-fixture.js';
import { createFixtureGate, waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';

test('TLS fixtures have valid signed key pairs and distinct SAN identity/trust controls', () => {
  const ca = new X509Certificate(certificates.ca); const wrongCa = new X509Certificate(certificates.untrustedCa);
  for (const profile of ['matched', 'mismatched']) {
    const leaf = new X509Certificate(certificates[profile].cert);
    assert.equal(leaf.verify(ca.publicKey), true); assert.equal(leaf.verify(wrongCa.publicKey), false);
    assert.equal(leaf.checkPrivateKey(createPrivateKey(certificates[profile].key)), true);
    assert.ok(Date.parse(leaf.validFrom) <= Date.now()); assert.ok(Date.parse(leaf.validTo) > Date.now());
    if (profile === 'matched') {
      assert.equal(leaf.checkIP('127.0.0.1'), '127.0.0.1'); assert.equal(leaf.checkHost('localhost', { subject: 'never' }), 'localhost');
    } else {
      assert.equal(leaf.checkIP('127.0.0.1'), undefined); assert.equal(leaf.checkHost('localhost'), undefined);
      assert.match(leaf.subject, /CN=localhost/u);
    }
  }
});

for (const primary of [new Error('controlled scenario'), null]) {
  test(`TLS fixture retains certificate files through held server retirement and preserves ${primary === null ? 'null' : 'Error'}`, async t => {
    const entered = createFixtureGate({ signal: t.signal }); const hold = createFixtureGate({ signal: t.signal });
    let root; let cleanupCalls = 0; let settled = false;
    const pending = withPostgresTlsFixture({ config: {},
      createContainer: input => { root = dirname(input.key); return input; },
      createRuntime: async options => {
        const input = options.createPostgresContainer();
        assert.equal(await readFile(input.cert, 'utf8'), certificates.matched.cert);
        assert.equal(await readFile(input.key, 'utf8'), certificates.matched.key);
        return { runIsolatedDatabase: run => run({}), cleanup: async () => {
          cleanupCalls++; entered.release(); await hold.promise;
        } };
      } }, async () => { throw primary; });
    void pending.then(() => { settled = true; }, () => { settled = true; });
    try {
      await waitForFixtureReady({ ready: entered.promise, operation: pending, signal: t.signal });
      assert.equal(settled, false); await access(root);
      hold.release(); await assert.rejects(pending, error => error === primary);
      assert.equal(cleanupCalls, 1); await assert.rejects(access(root), error => error.code === 'ENOENT');
    } finally { hold.release(); await pending.catch(() => {}); }
  });
}

test('unknown TLS profiles and pre-cancellation admit no runtime', async () => {
  let calls = 0; const createRuntime = () => { calls++; throw new Error('unexpected'); };
  await assert.rejects(withPostgresTlsFixture({ config: {}, profile: 'unknown', createRuntime }, () => {}), TypeError);
  const controller = new AbortController(); controller.abort(null);
  await assert.rejects(withPostgresTlsFixture({ config: {}, signal: controller.signal, createRuntime }, () => {}), error => error === null);
  assert.equal(calls, 0);
});

test('uncertain server retirement retains certificate files and preserves the original scenario failure', async () => {
  const primary = new Error('original scenario'); let root;
  try {
    await assert.rejects(withPostgresTlsFixture({ config: {}, createContainer: input => { root = dirname(input.key); },
      createRuntime: async options => {
        options.createPostgresContainer();
        return { runIsolatedDatabase: run => run({}), cleanup: async () => { throw new Error('uncertain stop'); } };
      } }, () => { throw primary; }), error => error === primary);
    await access(root);
  } finally {
    // This controlled runtime created no native resource; retire its known files.
    if (root) { assert.match(root, /harmoniarr-pg-tls-/u); await rm(root, { recursive: true, force: true }); }
  }
});
