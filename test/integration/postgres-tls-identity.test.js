/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import certificates from '../../testing/integration/fixtures/postgres-tls.json' with { type: 'json' };
import { withPostgresTlsFixture } from '../../testing/integration/postgres-tls-fixture.js';
import { observePostgresTlsAttempt } from '../../testing/integration/pg-tls-attempt.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const config = resolveIntegrationTestRuntimeConfig(); const active = new Set();
function registered(operation) {
  active.add(operation); operation.then(() => active.delete(operation), () => active.delete(operation)); return operation;
}
after(async () => { await Promise.allSettled([...active]); }, { timeout: config.suiteTeardownTimeoutMs });

function assertRetired(proof) {
  assert.equal(proof.poolEnded, true); assert.equal(proof.socketsClosed, true); assert.equal(proof.restored, true);
  assert.equal(proof.record.observation, 'observed'); assert.equal(proof.record.targetMatch, 'matched');
  // Native pg queues startup synchronously on sslconnect, before TLS verification.
  assert.equal(proof.atStream.lastStage, 'startup_dispatched');
  assert.equal(proof.atStream.tlsConnectedMs, null); assert.ok(proof.atStream.startupDispatchedMs >= proof.atStream.tlsStreamCreatedMs);
  assert.equal(/localhost|127\.0\.0\.1|BEGIN CERTIFICATE|PRIVATE KEY/u.test(JSON.stringify(proof.record)), false);
}

for (const host of ['127.0.0.1', 'localhost']) {
  for (const profile of ['matched', 'mismatched']) {
    test(`native verified TLS ${profile} ${host === 'localhost' ? 'DNS callback' : 'IP promise'} identity drains its sockets`, {
      timeout: config.scenarioTimeoutMs,
    }, t => registered(withPostgresTlsFixture({ config, profile, signal: t.signal }, async ({ databaseConfig, ca }) => {
      const proof = await observePostgresTlsAttempt({ databaseConfig, config, host, ca, callback: host === 'localhost', signal: t.signal });
      assertRetired(proof);
      if (profile === 'matched') {
        assert.equal(proof.failed, false); assert.equal(proof.authorized, true); assert.equal(proof.secureConnects, 1);
        assert.equal(proof.atHandshake.lastStage, 'tls_connected');
        assert.ok(proof.atHandshake.tlsConnectedMs >= proof.atHandshake.startupDispatchedMs);
        assert.equal(proof.record.lastStage, 'backend_ready'); assert.ok(proof.record.tlsConnectedMs >= proof.record.tlsStreamCreatedMs);
        assert.equal(proof.sslRow.ssl, true); assert.match(proof.sslRow.version, /^TLSv1\.[23]$/u);
        assert.equal(proof.record.startupWrite.observation, 'observed'); assert.equal(proof.record.startupWrite.callbackOutcome, 'passed');
      } else {
        assert.equal(proof.failed, true); assert.equal(proof.error.code, 'ERR_TLS_CERT_ALTNAME_INVALID');
        assert.equal(proof.authorized, false); assert.equal(proof.secureConnects, 0); assert.equal(proof.atHandshake, null);
        assert.equal(proof.record.lastStage, 'startup_dispatched'); assert.equal(proof.record.tlsConnectedMs, null);
        assert.equal(proof.record.authenticationRequestedMs, null);
        assert.equal(proof.record.backendReadyMs, null); assert.equal(proof.sslRow, null);
      }
    })));
  }
}

test('native verified TLS rejects an untrusted CA before authentication and retires the failed handshake', {
  timeout: config.scenarioTimeoutMs,
}, t => registered(withPostgresTlsFixture({ config, signal: t.signal }, async ({ databaseConfig }) => {
  const proof = await observePostgresTlsAttempt({ databaseConfig, config, host: '127.0.0.1', ca: certificates.untrustedCa, signal: t.signal });
  assertRetired(proof); assert.equal(proof.failed, true);
  assert.ok(['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY'].includes(proof.error.code));
  assert.equal(proof.secureConnects, 0); assert.equal(proof.record.tlsConnectedMs, null);
  assert.equal(proof.record.authenticationRequestedMs, null); assert.equal(proof.record.backendReadyMs, null);
})));
