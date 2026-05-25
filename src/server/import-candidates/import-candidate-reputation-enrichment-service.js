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

import { buildSourceUserUsernameKey } from '../activity/source-user-trust-service.js';

export function createImportCandidateReputationEnrichmentService({
  listSourceUserReputationIndexFn = async () => new Map(),
} = {}) {
  async function enrichCandidatesWithUploaderReputation(candidates) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return [];
    }

    const usernames = [...new Set(
      candidates
        .map((candidate) => candidate?.username)
        .filter((username) => typeof username === 'string' && username.trim()),
    )];

    if (usernames.length === 0) {
      return candidates.map((candidate) => ({ ...candidate, uploaderReputation: null }));
    }

    let reputationIndex;
    try {
      reputationIndex = await listSourceUserReputationIndexFn({ usernames });
    } catch {
      reputationIndex = new Map();
    }

    return candidates.map((candidate) => {
      const usernameKey = buildSourceUserUsernameKey(candidate?.username);
      const reputation = reputationIndex.get(usernameKey) ?? null;

      return {
        ...candidate,
        uploaderReputation: reputation
          ? {
              reviewState: reputation.reviewState ?? null,
              trustState: reputation.trustState ?? 'neutral',
              successCount: reputation.successCount ?? 0,
              failureCount: reputation.failureCount ?? 0,
              evidenceCount: (reputation.successCount ?? 0) + (reputation.failureCount ?? 0),
              successRate: reputation.successCount + reputation.failureCount > 0
                ? reputation.successCount / (reputation.successCount + reputation.failureCount)
                : null,
              reliability: resolveReputationReliability(reputation),
            }
          : null,
      };
    });
  }

  function buildCandidateReputationSummary(enrichedCandidates) {
    if (!Array.isArray(enrichedCandidates) || enrichedCandidates.length === 0) {
      return {
        fromBlockedUploaders: 0,
        fromPreferredUploaders: 0,
        fromUnknownUploaders: 0,
        fromWatchUploaders: 0,
        withReputation: 0,
        total: 0,
      };
    }

    let fromBlockedUploaders = 0;
    let fromPreferredUploaders = 0;
    let fromUnknownUploaders = 0;
    let fromWatchUploaders = 0;
    let withReputation = 0;

    for (const candidate of enrichedCandidates) {
      const rep = candidate?.uploaderReputation;
      if (!rep) {
        fromUnknownUploaders += 1;
        continue;
      }

      if (rep.evidenceCount > 0) {
        withReputation += 1;
      }

      switch (rep.reviewState) {
        case 'excluded':
          fromBlockedUploaders += 1;
          break;
        case 'preferred':
          fromPreferredUploaders += 1;
          break;
        case 'watch':
          fromWatchUploaders += 1;
          break;
        case 'unknown':
          fromUnknownUploaders += 1;
          break;
        default:
          break;
      }
    }

    return {
      fromBlockedUploaders,
      fromPreferredUploaders,
      fromUnknownUploaders,
      fromWatchUploaders,
      withReputation,
      total: enrichedCandidates.length,
    };
  }

  return {
    buildCandidateReputationSummary,
    enrichCandidatesWithUploaderReputation,
  };
}

function resolveReputationReliability(reputation) {
  const evidenceCount = (reputation.successCount ?? 0) + (reputation.failureCount ?? 0);
  if (evidenceCount === 0) {
    return 'unknown';
  }

  const successRate = reputation.successCount / evidenceCount;

  if (successRate >= 0.9 && evidenceCount >= 5) return 'strong';
  if (successRate >= 0.7) return 'good';
  if (successRate >= 0.4) return 'mixed';
  return 'poor';
}
