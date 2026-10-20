/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { nativeAudioFiles } from './native-audio-data.js';
import { nativePeer } from './fixture-data.js';
import { wireFrame, wireInteger, wireString } from './wire-codec.js';

export const nativeSearchPeers = Object.freeze([nativePeer, 'controlled-review-peer']);
export const nativeSearchPlans = Object.freeze(nativeAudioFiles.map(file => Object.freeze({ file,
  query: 'Controlled ' + file.kind + ' ' + file.filename.split('\\')[0] })));
export const nativeSearchPayloadLimit = 4096;

export function resolveNativeSearchPlan(query) {
  const plan = nativeSearchPlans.find(row => row.query === query);
  if (!plan) throw new TypeError('Unowned native search query');
  return plan;
}

export function encodeNativeSearchResponse({ plan, peer, token }) {
  if (!nativeSearchPlans.includes(plan) || !nativeSearchPeers.includes(peer)
    || !Number.isSafeInteger(token) || token < 0 || token > 0x7fffffff) throw new TypeError('Unowned native search response');
  const size = Buffer.alloc(8); size.writeBigUInt64LE(BigInt(plan.file.size));
  const attributes = [[0, 1411], [1, 2], [4, 44100], [5, 16]];
  const payload = Buffer.concat([wireString(peer), wireInteger(token), wireInteger(1),
    Buffer.from([1]), wireString(plan.file.filename), size, wireString('wav'), wireInteger(attributes.length),
    ...attributes.flatMap(([kind, value]) => [wireInteger(kind), wireInteger(value)]),
    Buffer.from([1]), wireInteger(1_000_000), wireInteger(0), wireInteger(0), wireInteger(0)]);
  if (payload.length > nativeSearchPayloadLimit) throw new RangeError('Native search payload exceeds bound');
  const compressed = deflateSync(payload, { maxOutputLength: nativeSearchPayloadLimit });
  if (compressed.length > nativeSearchPayloadLimit) throw new RangeError('Native search compressed payload exceeds bound');
  const init = Buffer.concat([Buffer.from([1]), wireString(peer), wireString('P'), wireInteger(0)]);
  return { bytes: Buffer.concat([wireInteger(init.length), init, wireFrame(9, compressed)]),
    evidence: { peer, token, query: plan.query, filename: plan.file.filename, payloadBytes: payload.length,
      compressedBytes: compressed.length, payloadSha256: createHash('sha256').update(payload).digest('hex') } };
}
