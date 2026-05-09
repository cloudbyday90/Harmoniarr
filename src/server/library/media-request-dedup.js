const MATCH_MODE_MBID = 'mbid';
const MATCH_MODE_TEXT = 'text';

function normalizeTextForMatch(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function buildDedupLookupKey({ musicbrainzReleaseId, artistName, releaseTitle }) {
  if (musicbrainzReleaseId && typeof musicbrainzReleaseId === 'string' && musicbrainzReleaseId.trim()) {
    return { mode: MATCH_MODE_MBID, value: musicbrainzReleaseId.trim() };
  }

  const artist = normalizeTextForMatch(artistName);
  const title = normalizeTextForMatch(releaseTitle);

  if (!artist && !title) {
    return null;
  }

  return { mode: MATCH_MODE_TEXT, value: `${artist}\0${title}` };
}

export function findDuplicateRequest({ activeRequests = [], musicbrainzReleaseId, artistName, releaseTitle, requestedForUserId }) {
  const key = buildDedupLookupKey({ musicbrainzReleaseId, artistName, releaseTitle });
  if (!key) return null;

  for (const request of activeRequests) {
    if (request.requestedForUser?.id === requestedForUserId) {
      continue;
    }

    if (key.mode === MATCH_MODE_MBID) {
      const requestMbid = request.musicbrainzReleaseId ?? request.existingMatch?.musicbrainzReleaseId ?? null;
      if (requestMbid === key.value) {
        return request;
      }
    }

    if (key.mode === MATCH_MODE_TEXT) {
      const requestArtist = normalizeTextForMatch(request.artistName);
      const requestTitle = normalizeTextForMatch(request.releaseTitle);
      const candidateKey = `${requestArtist}\0${requestTitle}`;
      if (candidateKey === key.value) {
        return request;
      }
    }
  }

  return null;
}

export function isRequestActive(request) {
  if (!request) return false;
  const state = request.requestState ?? request.request_state;
  return state !== 'cancelled' && state !== 'failed';
}
