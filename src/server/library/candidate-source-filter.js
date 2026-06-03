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

const MAX_IGNORED_USERNAMES = 1000;
const MAX_BLACKLIST_TERMS = 1000;

/**
 * Normalizes a collection of ignored usernames into a lookup set of lowercased,
 * trimmed names. Accepts arrays or comma-delimited strings; bounded to protect
 * against pathological inputs.
 */
export function normalizeIgnoredUsernames(values) {
  const result = new Set();
  if (values == null) {
    return result;
  }

  const list = Array.isArray(values)
    ? values
    : typeof values === 'string'
      ? values.split(',')
      : [];

  for (const value of list) {
    if (result.size >= MAX_IGNORED_USERNAMES) {
      break;
    }
    if (typeof value !== 'string') {
      continue;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized) {
      result.add(normalized);
    }
  }

  return result;
}

/**
 * Normalizes blacklist terms into a deduplicated, lowercased, trimmed array.
 * Accepts arrays or comma-delimited strings; bounded for safety.
 */
export function normalizeBlacklistTerms(values) {
  const result = [];
  const seen = new Set();
  if (values == null) {
    return result;
  }

  const list = Array.isArray(values)
    ? values
    : typeof values === 'string'
      ? values.split(',')
      : [];

  for (const value of list) {
    if (result.length >= MAX_BLACKLIST_TERMS) {
      break;
    }
    if (typeof value !== 'string') {
      continue;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }

  return result;
}

export function isUsernameIgnored(username, ignoredUsernameSet) {
  if (!(ignoredUsernameSet instanceof Set) || ignoredUsernameSet.size === 0) {
    return false;
  }
  if (typeof username !== 'string') {
    return false;
  }
  return ignoredUsernameSet.has(username.trim().toLowerCase());
}

/**
 * Returns the first blacklisted term found within a remote filename/path, or
 * null when the value is clean. Matching is a case-insensitive substring test
 * over the raw remote path (folder + filename), mirroring slskd-side intent.
 */
export function matchBlacklistedTerm(remoteFilename, blacklistTerms) {
  if (!Array.isArray(blacklistTerms) || blacklistTerms.length === 0) {
    return null;
  }
  if (typeof remoteFilename !== 'string' || !remoteFilename) {
    return null;
  }
  const haystack = remoteFilename.toLowerCase();
  for (const term of blacklistTerms) {
    if (term && haystack.includes(term)) {
      return term;
    }
  }
  return null;
}

function filterFileList(files, blacklistTerms, summary) {
  if (!Array.isArray(files)) {
    return [];
  }
  if (!Array.isArray(blacklistTerms) || blacklistTerms.length === 0) {
    return files;
  }

  const kept = [];
  for (const file of files) {
    const matched = matchBlacklistedTerm(file?.filename, blacklistTerms);
    if (matched) {
      summary.blacklistedFileCount += 1;
    } else {
      kept.push(file);
    }
  }
  return kept;
}

/**
 * Pre-candidate filter applied to raw slskd search/browse responses before they
 * are normalized into import candidates. Drops responses from ignored uploaders
 * outright and removes files whose remote path contains a blacklisted term.
 *
 * Pure and side-effect free: callers receive a new responses array plus a
 * summary describing what was removed. With no filters configured this is a
 * structural no-op (returns the original responses reference).
 */
export function filterSlskdResponsesForCandidates({
  responses = [],
  ignoredUsernames = null,
  blacklistedTitleTerms = null,
} = {}) {
  const ignoredSet = ignoredUsernames instanceof Set
    ? ignoredUsernames
    : normalizeIgnoredUsernames(ignoredUsernames);
  const blacklistTerms = Array.isArray(blacklistedTitleTerms)
    ? blacklistedTitleTerms
    : normalizeBlacklistTerms(blacklistedTitleTerms);

  const summary = {
    blacklistedFileCount: 0,
    ignoredUserResponseCount: 0,
    emptyResponseCount: 0,
  };

  if (!Array.isArray(responses)) {
    return { responses: [], summary };
  }

  if (ignoredSet.size === 0 && blacklistTerms.length === 0) {
    return { responses, summary };
  }

  const filtered = [];
  for (const response of responses) {
    if (isUsernameIgnored(response?.username, ignoredSet)) {
      summary.ignoredUserResponseCount += 1;
      continue;
    }

    const files = filterFileList(response?.files, blacklistTerms, summary);
    const lockedFiles = filterFileList(response?.lockedFiles, blacklistTerms, summary);

    if (files.length === 0 && lockedFiles.length === 0) {
      summary.emptyResponseCount += 1;
      continue;
    }

    filtered.push({
      ...response,
      files,
      lockedFiles,
    });
  }

  return { responses: filtered, summary };
}
