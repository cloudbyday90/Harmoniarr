import assert from 'node:assert/strict';
import test from 'node:test';
import { buildClaimAccountRoute, buildLoginDescription, buildLoginInfoMessage } from '../../src/client/lib/login-presentation.js';

// ---------------------------------------------------------------------------
// buildLoginDescription
// ---------------------------------------------------------------------------

test('buildLoginDescription returns a non-empty string', () => {
  const result = buildLoginDescription();
  assert.equal(typeof result, 'string');
  assert.ok(result.length > 0);
});

test('buildLoginDescription copy references requesting music (requester persona)', () => {
  const result = buildLoginDescription();
  assert.ok(result.toLowerCase().includes('request'), `expected "request" in: ${result}`);
});

test('buildLoginDescription copy references library management (operator persona)', () => {
  const result = buildLoginDescription();
  assert.ok(
    result.toLowerCase().includes('operator') || result.toLowerCase().includes('administrator'),
    `expected operator/administrator mention in: ${result}`,
  );
});

test('buildLoginDescription is stable across multiple calls', () => {
  assert.equal(buildLoginDescription(), buildLoginDescription());
});

test('buildLoginDescription does not describe only operator tasks', () => {
  const result = buildLoginDescription();
  // The old copy was exclusively about operator tasks; the new copy must not open
  // with imports/diagnostics/recovery as the primary use-case.
  assert.ok(
    !result.startsWith('Use your local Harmoniarr account to manage'),
    `description still starts with old operator-only copy: ${result}`,
  );
});

// ---------------------------------------------------------------------------
// buildLoginInfoMessage
// ---------------------------------------------------------------------------

test('buildLoginInfoMessage returns claim-complete message for claim-complete reason', () => {
  assert.equal(
    buildLoginInfoMessage('claim-complete'),
    'Your account claim is complete. Log in with the password you just set.',
  );
});

test('buildLoginInfoMessage returns session-expired message for session-expired reason', () => {
  assert.equal(
    buildLoginInfoMessage('session-expired'),
    'Your session expired. Log in again to continue.',
  );
});

test('buildLoginInfoMessage returns reauth message for reauth-required reason', () => {
  assert.equal(
    buildLoginInfoMessage('reauth-required'),
    'A privileged action requires you to confirm your password again before continuing.',
  );
});

test('buildLoginInfoMessage returns empty string for unknown reason', () => {
  assert.equal(buildLoginInfoMessage('unknown-reason'), '');
});

test('buildLoginInfoMessage returns empty string for undefined reason', () => {
  assert.equal(buildLoginInfoMessage(undefined), '');
});

test('buildLoginInfoMessage returns empty string for null reason', () => {
  assert.equal(buildLoginInfoMessage(null), '');
});

test('buildLoginInfoMessage returns empty string for empty string reason', () => {
  assert.equal(buildLoginInfoMessage(''), '');
});

test('buildLoginInfoMessage all known reasons return non-empty strings', () => {
  const knownReasons = ['claim-complete', 'session-expired', 'reauth-required'];
  for (const reason of knownReasons) {
    const msg = buildLoginInfoMessage(reason);
    assert.ok(msg.length > 0, `expected non-empty message for reason: ${reason}`);
  }
});

// ---------------------------------------------------------------------------
// buildClaimAccountRoute
// ---------------------------------------------------------------------------

test('buildClaimAccountRoute with non-empty username includes username query param', () => {
  assert.deepEqual(buildClaimAccountRoute('alice'), {
    name: 'claim-account',
    query: { username: 'alice' },
  });
});

test('buildClaimAccountRoute trims whitespace from username', () => {
  assert.deepEqual(buildClaimAccountRoute('  bob  '), {
    name: 'claim-account',
    query: { username: 'bob' },
  });
});

test('buildClaimAccountRoute with empty string omits query param', () => {
  assert.deepEqual(buildClaimAccountRoute(''), { name: 'claim-account' });
});

test('buildClaimAccountRoute with whitespace-only string omits query param', () => {
  assert.deepEqual(buildClaimAccountRoute('   '), { name: 'claim-account' });
});

test('buildClaimAccountRoute with null omits query param', () => {
  assert.deepEqual(buildClaimAccountRoute(null), { name: 'claim-account' });
});

test('buildClaimAccountRoute with undefined omits query param', () => {
  assert.deepEqual(buildClaimAccountRoute(undefined), { name: 'claim-account' });
});

test('buildClaimAccountRoute preserves email address as username', () => {
  assert.deepEqual(buildClaimAccountRoute('user@example.com'), {
    name: 'claim-account',
    query: { username: 'user@example.com' },
  });
});
