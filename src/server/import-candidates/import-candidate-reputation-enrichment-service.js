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
