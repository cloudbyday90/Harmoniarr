/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { BlockList, isIP, SocketAddress } from 'node:net';

// Conservative IANA special-purpose exclusions, reviewed September 2026.
// Some special-purpose ranges are globally reachable; they are deliberately
// excluded from this ordinary public Web Push destination policy.
// Sources: https://www.iana.org/assignments/iana-ipv4-special-registry
// https://www.iana.org/assignments/iana-ipv6-special-registry
// Design and compatibility limits: docs/PUSH_ENDPOINT_SECURITY_DESIGN.md.
const excludedIpv4 = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.31.196.0', 24], ['192.52.193.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['192.175.48.0', 24], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
]) excludedIpv4.addSubnet(address, prefix, 'ipv4');

const globalIpv6 = new BlockList();
globalIpv6.addSubnet('2000::', 3, 'ipv6');
const excludedIpv6 = new BlockList();
for (const [address, prefix] of [
  ['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['2620:4f:8000::', 48], ['3fff::', 20],
]) excludedIpv6.addSubnet(address, prefix, 'ipv6');

function isIsatap(address) {
  // Native parsing canonicalizes dotted IPv4 tails before inspecting the
  // ISATAP interface identifier; the input was already validated as IPv6.
  const canonical = SocketAddress.parse(`[${address}]:443`)?.address;
  if (!canonical) return true;
  const [left, right = ''] = canonical.split('::');
  const first = left ? left.split(':') : [];
  const last = right ? right.split(':') : [];
  const words = [...first, ...Array(8 - first.length - last.length).fill('0'), ...last];
  return [0, 0x200].includes(Number.parseInt(words[4], 16)) && Number.parseInt(words[5], 16) === 0x5efe;
}

/** Accepts only ordinary public unicast addresses, never hostnames or scoped IPs. */
export function isPublicPushAddress(address) {
  if (typeof address !== 'string' || address.includes('%')) return false;
  const family = isIP(address);
  if (family === 4) return !excludedIpv4.check(address, 'ipv4');
  if (family !== 6 || !globalIpv6.check(address, 'ipv6') || excludedIpv6.check(address, 'ipv6')) return false;
  // The positive IPv6 range also rejects mapped/compatible IPv4, NAT64,
  // unspecified, loopback, ULA, link-local, site-local, and multicast addresses.
  return !isIsatap(address);
}
