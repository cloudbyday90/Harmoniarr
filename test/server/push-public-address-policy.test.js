/* Harmoniarr - GPL-3.0; see LICENSE. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { isPublicPushAddress } from '../../src/server/push/push-public-address-policy.js';

test('public push address policy rejects both boundaries of each special IPv4 range', () => {
  for (const [first, last] of [
    ['0.0.0.0', '0.255.255.255'], ['10.0.0.0', '10.255.255.255'], ['100.64.0.0', '100.127.255.255'],
    ['127.0.0.0', '127.255.255.255'], ['169.254.0.0', '169.254.255.255'], ['172.16.0.0', '172.31.255.255'],
    ['192.0.0.0', '192.0.0.255'], ['192.0.2.0', '192.0.2.255'], ['192.31.196.0', '192.31.196.255'],
    ['192.52.193.0', '192.52.193.255'], ['192.88.99.0', '192.88.99.255'], ['192.168.0.0', '192.168.255.255'],
    ['192.175.48.0', '192.175.48.255'], ['198.18.0.0', '198.19.255.255'], ['198.51.100.0', '198.51.100.255'],
    ['203.0.113.0', '203.0.113.255'], ['224.0.0.0', '239.255.255.255'], ['240.0.0.0', '255.255.255.255'],
  ]) {
    assert.equal(isPublicPushAddress(first), false, first);
    assert.equal(isPublicPushAddress(last), false, last);
  }
  for (const address of ['1.1.1.1', '8.8.8.8', '100.63.255.255', '100.128.0.0', '172.15.255.255', '172.32.0.0',
    '192.0.1.0', '198.17.255.255', '198.20.0.0', '203.0.112.255', '203.0.114.0', '223.255.255.255']) {
    assert.equal(isPublicPushAddress(address), true, address);
  }
});

test('public push address policy accepts only ordinary global IPv6 and rejects special range boundaries', () => {
  for (const address of ['2000::', '2001:200::', '2001:4860:4860::8888', '2606:4700:4700::1111', '3ffe:ffff:ffff:ffff:ffff:ffff:ffff:ffff']) {
    assert.equal(isPublicPushAddress(address), true, address);
  }
  for (const address of ['1fff:ffff:ffff:ffff:ffff:ffff:ffff:ffff', '4000::', '2001::', '2001:1ff:ffff:ffff:ffff:ffff:ffff:ffff',
    '2001:db8::', '2001:db8:ffff:ffff:ffff:ffff:ffff:ffff', '2002::', '2002:ffff:ffff:ffff:ffff:ffff:ffff:ffff',
    '2620:4f:8000::', '2620:4f:8000:ffff:ffff:ffff:ffff:ffff', '3fff::', '3fff:fff:ffff:ffff:ffff:ffff:ffff:ffff']) {
    assert.equal(isPublicPushAddress(address), false, address);
  }
});

test('mapped, translated, scoped, transition and non-unicast IPv6 cannot disguise an eligible destination', () => {
  for (const address of ['::', '::1', '0:0:0:0:0:0:0:1', '::127.0.0.1', '::ffff:127.0.0.1', '::ffff:8.8.8.8',
    '::ffff:0808:0808', '64:ff9b::808:808', '64:ff9b:1::808:808', '2001::7f00:1', '2002:7f00:1::',
    '2001:4860::5efe:127.0.0.1', '2001:4860:0:0:200:5efe:808:808', '2001:4860:0:0:0:5efe:0808:0808',
    'fc00::1', 'fdff::1', 'fe80::1', 'fe80::1%eth0', '2001:4860::1%eth0', 'fec0::1', 'ff02::1']) {
    assert.equal(isPublicPushAddress(address), false, address);
  }
});

test('address policy never interprets hostnames, ambiguous IPv4 spellings or malformed values', () => {
  for (const address of [undefined, null, {}, 123, '', 'push.example.com', '127.1', '2130706433', '0x7f000001',
    '0177.0.0.1', ' 8.8.8.8', '8.8.8.8 ', '[2001:4860::1]', '2001:::1']) {
    assert.equal(isPublicPushAddress(address), false, String(address));
  }
});
