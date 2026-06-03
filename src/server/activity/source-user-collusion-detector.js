/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

// Pure cross-peer collusion / duplicate-source detector.
//
// Signal: the same confirmed-transcode content fingerprint surfacing from two or
// more distinct peers strongly implies a shared upstream source (one re-encoded
// file laundered through several uploader accounts). We treat each shared
// fingerprint as an edge connecting all the peers that delivered it, then use a
// union-find (disjoint-set) to collapse the peer graph into connected
// components. Each component with >= minRingSize peers is reported as a collusion
// ring. Union-find is the standard near-linear approach for this kind of
// entity-resolution / fraud-ring grouping and is fully deterministic.
//
// This module is pure: it derives rings from already-fetched correlation rows
// and performs no IO.

function normalizePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function createDisjointSet() {
  const parent = new Map();

  function find(key) {
    if (!parent.has(key)) {
      parent.set(key, key);
      return key;
    }
    // Path compression.
    let root = key;
    while (parent.get(root) !== root) {
      root = parent.get(root);
    }
    let cursor = key;
    while (parent.get(cursor) !== root) {
      const next = parent.get(cursor);
      parent.set(cursor, root);
      cursor = next;
    }
    return root;
  }

  function union(a, b) {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA === rootB) {
      return;
    }
    // Union by deterministic ordering keeps results stable across runs.
    if (rootA < rootB) {
      parent.set(rootB, rootA);
    } else {
      parent.set(rootA, rootB);
    }
  }

  return { find, union };
}

/**
 * @param {object} input
 * @param {Array<{ contentHash: string, members: Array<{ usernameKey: string, username?: string|null }>, estimatedSourceBitrate?: number|null }>} input.sharedFingerprints
 * @param {number} [input.minRingSize] - Minimum distinct peers for a component to count as a ring (default 2).
 * @returns {{
 *   rings: Array<{
 *     ringId: string,
 *     members: Array<{ usernameKey: string, username: string|null }>,
 *     memberCount: number,
 *     fingerprints: Array<{ contentHash: string, estimatedSourceBitrate: number|null }>,
 *     sharedFingerprintCount: number
 *   }>,
 *   ringCount: number,
 *   implicatedUserCount: number,
 *   analyzedFingerprintCount: number
 * }}
 */
export function detectCollusionRings({ sharedFingerprints = [], minRingSize = 2 } = {}) {
  const minMembers = Math.max(2, normalizePositiveInteger(minRingSize, 2));
  const fingerprints = Array.isArray(sharedFingerprints) ? sharedFingerprints : [];

  const disjointSet = createDisjointSet();
  const usernameDisplay = new Map();
  const normalizedFingerprints = [];

  for (const fingerprint of fingerprints) {
    const contentHash = typeof fingerprint?.contentHash === 'string' ? fingerprint.contentHash.trim() : '';
    if (!contentHash) {
      continue;
    }

    const memberKeys = [];
    const members = Array.isArray(fingerprint.members) ? fingerprint.members : [];
    for (const member of members) {
      const usernameKey = typeof member?.usernameKey === 'string' ? member.usernameKey.trim() : '';
      if (!usernameKey) {
        continue;
      }
      memberKeys.push(usernameKey);
      if (!usernameDisplay.has(usernameKey)) {
        usernameDisplay.set(usernameKey, typeof member.username === 'string' ? member.username : null);
      }
    }

    const distinctKeys = [...new Set(memberKeys)];
    if (distinctKeys.length < 2) {
      continue;
    }

    // Connect every peer that shares this fingerprint.
    for (let i = 1; i < distinctKeys.length; i += 1) {
      disjointSet.union(distinctKeys[0], distinctKeys[i]);
    }

    normalizedFingerprints.push({
      contentHash,
      memberKeys: distinctKeys,
      estimatedSourceBitrate: fingerprint.estimatedSourceBitrate === null || fingerprint.estimatedSourceBitrate === undefined
        ? null
        : Number(fingerprint.estimatedSourceBitrate),
    });
  }

  const componentMembers = new Map();
  const componentFingerprints = new Map();

  for (const fingerprint of normalizedFingerprints) {
    const root = disjointSet.find(fingerprint.memberKeys[0]);

    if (!componentMembers.has(root)) {
      componentMembers.set(root, new Set());
    }
    const memberSet = componentMembers.get(root);
    for (const key of fingerprint.memberKeys) {
      memberSet.add(key);
    }

    if (!componentFingerprints.has(root)) {
      componentFingerprints.set(root, []);
    }
    componentFingerprints.get(root).push({
      contentHash: fingerprint.contentHash,
      estimatedSourceBitrate: fingerprint.estimatedSourceBitrate,
    });
  }

  const rings = [];
  for (const [root, memberSet] of componentMembers.entries()) {
    if (memberSet.size < minMembers) {
      continue;
    }

    const members = [...memberSet]
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      .map((usernameKey) => ({ usernameKey, username: usernameDisplay.get(usernameKey) ?? null }));

    const ringFingerprints = (componentFingerprints.get(root) ?? [])
      .slice()
      .sort((a, b) => (a.contentHash < b.contentHash ? -1 : a.contentHash > b.contentHash ? 1 : 0));

    rings.push({
      members,
      memberCount: members.length,
      fingerprints: ringFingerprints,
      sharedFingerprintCount: ringFingerprints.length,
    });
  }

  rings.sort((a, b) => {
    if (b.sharedFingerprintCount !== a.sharedFingerprintCount) {
      return b.sharedFingerprintCount - a.sharedFingerprintCount;
    }
    if (b.memberCount !== a.memberCount) {
      return b.memberCount - a.memberCount;
    }
    const aKey = a.members[0]?.usernameKey ?? '';
    const bKey = b.members[0]?.usernameKey ?? '';
    return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
  });

  const rankedRings = rings.map((ring, index) => ({ ringId: `ring-${index + 1}`, ...ring }));

  const implicatedUsers = new Set();
  for (const ring of rankedRings) {
    for (const member of ring.members) {
      implicatedUsers.add(member.usernameKey);
    }
  }

  return {
    rings: rankedRings,
    ringCount: rankedRings.length,
    implicatedUserCount: implicatedUsers.size,
    analyzedFingerprintCount: normalizedFingerprints.length,
  };
}
