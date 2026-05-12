import assert from 'node:assert/strict';
import test from 'node:test';
import { urlBase64ToUint8Array } from '../../src/client/lib/push-encoding.js';

// ---------------------------------------------------------------------------
// urlBase64ToUint8Array
// ---------------------------------------------------------------------------

// Helper: encode a byte array to base64url (unpadded) for test fixtures.
function toBase64url(bytes) {
  return Buffer.from(bytes).toString('base64url');
}

// Helper: encode a byte array to standard base64 (padded) for test fixtures.
function toBase64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

test('urlBase64ToUint8Array returns a Uint8Array', () => {
  const input = toBase64url([1, 2, 3, 4]);
  const result = urlBase64ToUint8Array(input);
  assert.ok(result instanceof Uint8Array);
});

test('urlBase64ToUint8Array decodes an unpadded base64url string correctly', () => {
  const bytes = [104, 101, 108, 108, 111]; // "hello"
  const input = toBase64url(bytes);
  const result = urlBase64ToUint8Array(input);
  assert.deepEqual(Array.from(result), bytes);
});

test('urlBase64ToUint8Array decodes a padded base64 string correctly', () => {
  const bytes = [104, 101, 108, 108, 111]; // "hello"
  const input = toBase64(bytes);
  const result = urlBase64ToUint8Array(input);
  assert.deepEqual(Array.from(result), bytes);
});

test('urlBase64ToUint8Array converts url-safe minus to plus before decoding', () => {
  // byte 0xFB = 251 encodes to base64 chunk containing '-' in base64url
  const bytes = [0xFB, 0xFC, 0xFD];
  const b64url = toBase64url(bytes);
  assert.ok(b64url.includes('-') || b64url.includes('_'), 'fixture should use url-safe chars');
  const result = urlBase64ToUint8Array(b64url);
  assert.deepEqual(Array.from(result), bytes);
});

test('urlBase64ToUint8Array decodes a known VAPID key-shaped string to the correct length', () => {
  // A real VAPID public key is 65 bytes uncompressed, encoded as 88-char base64url.
  const bytes = new Uint8Array(65).fill(0xAB);
  const input = toBase64url(Array.from(bytes));
  const result = urlBase64ToUint8Array(input);
  assert.equal(result.length, 65);
  assert.ok(result.every((b) => b === 0xAB));
});

test('urlBase64ToUint8Array strips existing padding before re-padding', () => {
  // 1 byte encodes to 2 base64 chars + '==' padding, 2 bytes → 3 chars + '=' padding.
  const bytes = [0x42, 0x43]; // 2 bytes → standard base64 ends with '='
  const padded = toBase64(bytes);
  assert.ok(padded.endsWith('='), 'fixture should have padding');
  const result = urlBase64ToUint8Array(padded);
  assert.deepEqual(Array.from(result), bytes);
});

test('urlBase64ToUint8Array handles input that needs no padding (length divisible by 4)', () => {
  const bytes = [0x00, 0x10, 0x83]; // encodes to exactly 4 base64 chars, no padding needed
  const input = toBase64url(bytes);
  const result = urlBase64ToUint8Array(input);
  assert.deepEqual(Array.from(result), bytes);
});

test('urlBase64ToUint8Array handles empty string and returns empty Uint8Array', () => {
  const result = urlBase64ToUint8Array('');
  assert.ok(result instanceof Uint8Array);
  assert.equal(result.length, 0);
});

test('urlBase64ToUint8Array round-trips arbitrary byte sequences', () => {
  const original = Array.from({ length: 32 }, (_, i) => i * 8);
  const encoded = toBase64url(original);
  const decoded = urlBase64ToUint8Array(encoded);
  assert.deepEqual(Array.from(decoded), original);
});

test('urlBase64ToUint8Array output length matches input byte count', () => {
  for (const len of [1, 2, 3, 4, 16, 32, 65]) {
    const bytes = new Array(len).fill(0x42);
    const encoded = toBase64url(bytes);
    const result = urlBase64ToUint8Array(encoded);
    assert.equal(result.length, len, `expected length ${len} for ${len}-byte input`);
  }
});
