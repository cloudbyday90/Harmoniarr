import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeOutboundBaseUrl,
  resolveAllowedOutboundHosts,
  resolveAllowedOutboundHostSuffixes,
} from '../../src/server/outbound-url-policy.js';

test('normalizeOutboundBaseUrl rejects query strings credentials and private hosts when policy forbids them', () => {
  assert.throws(
    () => normalizeOutboundBaseUrl('https://user:secret@127.0.0.1/ws/2?fmt=json', {
      allowHttp: false,
      allowHttps: true,
      allowLocalhost: false,
      allowPrivateHosts: false,
      defaultPathname: '/ws/2/',
      fieldName: 'MUSICBRAINZ_BASE_URL',
      protocolErrorCode: 'musicbrainz_misconfigured',
      validationErrorCode: 'musicbrainz_misconfigured',
    }),
    (error) => error?.code === 'musicbrainz_misconfigured',
  );
});

test('normalizeOutboundBaseUrl allows internal slskd-style endpoints and normalizes the pathname', () => {
  const normalized = normalizeOutboundBaseUrl('http://slskd.internal:5030', {
    allowHttp: true,
    allowHttps: true,
    allowLocalhost: true,
    allowPrivateHosts: true,
    defaultPathname: '/api/v0/',
    fieldName: 'SLSKD_BASE_URL',
    protocolErrorCode: 'slskd_misconfigured',
    validationErrorCode: 'slskd_misconfigured',
  });

  assert.equal(normalized.toString(), 'http://slskd.internal:5030/api/v0/');
});

test('normalizeOutboundBaseUrl enforces exact allowed host matches when configured', () => {
  const normalized = normalizeOutboundBaseUrl('https://musicbrainz.org/ws/2', {
    allowHttp: false,
    allowHttps: true,
    allowedHosts: ['musicbrainz.org'],
    allowLocalhost: false,
    allowPrivateHosts: false,
    defaultPathname: '/ws/2/',
    fieldName: 'MUSICBRAINZ_BASE_URL',
    protocolErrorCode: 'musicbrainz_misconfigured',
    validationErrorCode: 'musicbrainz_misconfigured',
  });

  assert.equal(normalized.toString(), 'https://musicbrainz.org/ws/2/');
  assert.throws(
    () => normalizeOutboundBaseUrl('https://musicbrainz.test/ws/2', {
      allowHttp: false,
      allowHttps: true,
      allowedHosts: ['musicbrainz.org'],
      allowLocalhost: false,
      allowPrivateHosts: false,
      defaultPathname: '/ws/2/',
      fieldName: 'MUSICBRAINZ_BASE_URL',
      protocolErrorCode: 'musicbrainz_misconfigured',
      validationErrorCode: 'musicbrainz_misconfigured',
    }),
    (error) => error?.code === 'musicbrainz_misconfigured'
      && error?.message === 'MUSICBRAINZ_BASE_URL must target an explicitly allowed host',
  );
});

test('allowed outbound host resolvers normalize comma-separated exact and wildcard suffix entries', () => {
  assert.deepEqual(
    resolveAllowedOutboundHosts('musicbrainz.org, [::1], slskd.internal', {
      envName: 'TEST_ALLOWED_HOSTS',
    }),
    ['musicbrainz.org', '::1', 'slskd.internal'],
  );
  assert.deepEqual(
    resolveAllowedOutboundHostSuffixes('*.musicbrainz.org, .archive.org', {
      envName: 'TEST_ALLOWED_HOST_SUFFIXES',
    }),
    ['musicbrainz.org', 'archive.org'],
  );
});