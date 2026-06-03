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

// Pure, dependency-free per-track filename matching for Soulseek candidates.
//
// The similarity metric is a faithful re-implementation of Python's
// difflib.SequenceMatcher.ratio() (the "gestalt"/Ratcliff-Obershelp longest
// contiguous matching subsequence approach), which is the metric the de-facto
// reference implementation (mrusse/soularr `album_match`) calibrates its 0.5
// match threshold against. Re-implementing it in-house avoids a third-party
// fuzzy-match dependency for a small amount of pure logic.
//
// Inputs originate from an untrusted P2P network, so every public entry point
// guards types and bounds the work it performs (string length and collection
// size caps) to keep matching deterministic and cheap.

export const DEFAULT_MINIMUM_MATCH_RATIO = 0.5;

// Bounds chosen so a hostile peer cannot make matching expensive. Filenames and
// track titles are short in practice; anything longer is truncated for scoring.
const MAX_COMPARE_LENGTH = 300;
const MAX_EXPECTED_TRACKS = 200;
const MAX_CANDIDATE_FILES = 400;

export const AUDIO_EXTENSIONS = new Set([
  'flac', 'wav', 'aiff', 'aif', 'alac', 'ape', 'wv',
  'mp3', 'aac', 'ogg', 'opus', 'wma', 'm4a',
]);

function findLongestMatch(a, b, alo, ahi, blo, bhi, b2j) {
  let besti = alo;
  let bestj = blo;
  let bestsize = 0;
  let j2len = new Map();

  for (let i = alo; i < ahi; i += 1) {
    const newj2len = new Map();
    const indices = b2j.get(a[i]);
    if (indices) {
      for (const j of indices) {
        if (j < blo) {
          continue;
        }
        if (j >= bhi) {
          break;
        }
        const k = (j2len.get(j - 1) ?? 0) + 1;
        newj2len.set(j, k);
        if (k > bestsize) {
          besti = i - k + 1;
          bestj = j - k + 1;
          bestsize = k;
        }
      }
    }
    j2len = newj2len;
  }

  return [besti, bestj, bestsize];
}

function totalMatchingSize(a, b) {
  const la = a.length;
  const lb = b.length;

  const b2j = new Map();
  for (let j = 0; j < lb; j += 1) {
    const element = b[j];
    const existing = b2j.get(element);
    if (existing) {
      existing.push(j);
    } else {
      b2j.set(element, [j]);
    }
  }

  let total = 0;
  const queue = [[0, la, 0, lb]];
  while (queue.length > 0) {
    const [alo, ahi, blo, bhi] = queue.pop();
    const [i, j, k] = findLongestMatch(a, b, alo, ahi, blo, bhi, b2j);
    if (k > 0) {
      total += k;
      if (alo < i && blo < j) {
        queue.push([alo, i, blo, j]);
      }
      if (i + k < ahi && j + k < bhi) {
        queue.push([i + k, ahi, j + k, bhi]);
      }
    }
  }

  return total;
}

/**
 * difflib.SequenceMatcher.ratio() equivalent: 2 * M / (len(a) + len(b)), where M
 * is the total size of the matching blocks. Returns a float in [0, 1].
 */
export function sequenceMatchRatio(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return 0;
  }

  const left = a.length > MAX_COMPARE_LENGTH ? a.slice(0, MAX_COMPARE_LENGTH) : a;
  const right = b.length > MAX_COMPARE_LENGTH ? b.slice(0, MAX_COMPARE_LENGTH) : b;

  const la = left.length;
  const lb = right.length;
  if (la === 0 && lb === 0) {
    return 1;
  }
  if (la === 0 || lb === 0) {
    return 0;
  }

  const matches = totalMatchingSize(left, right);
  return (2 * matches) / (la + lb);
}

function basename(value) {
  const parts = String(value).split(/[\\/]/);
  return parts[parts.length - 1] ?? '';
}

function fileExtension(filename) {
  const base = basename(filename);
  const dotIndex = base.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === base.length - 1) {
    return '';
  }
  return base.slice(dotIndex + 1).toLowerCase();
}

function stripExtension(base) {
  const dotIndex = base.lastIndexOf('.');
  return dotIndex > 0 ? base.slice(0, dotIndex) : base;
}

/**
 * Lowercase, strip diacritics, and reduce to alphanumeric tokens separated by
 * single spaces. Punctuation, separators, and case never affect the comparison.
 */
export function normalizeMatchText(value) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return '';
  }

  const decomposed = String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return decomposed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Removes a single leading short numeric token (a track number such as "07")
// when more text follows it. Only applied to the candidate filename side, never
// to the expected title side, so titles that legitimately start with a number
// (e.g. "100 Years") are still matched via the un-stripped strategy.
function stripLeadingTrackNumber(normalized) {
  return normalized.replace(/^\d{1,3}\s+(?=\S)/, '');
}

function buildExpectedComparisons(trackTitle, albumTitle) {
  const titleNorm = normalizeMatchText(trackTitle);
  const comparisons = [titleNorm];

  const albumNorm = normalizeMatchText(albumTitle);
  if (albumNorm) {
    comparisons.push(`${albumNorm} ${titleNorm}`.trim());
  }

  return comparisons.filter(Boolean);
}

function bestRatioForFile(expectedComparisons, candidateNorm, candidateStripped) {
  let best = 0;
  for (const expected of expectedComparisons) {
    const direct = sequenceMatchRatio(expected, candidateNorm);
    if (direct > best) {
      best = direct;
    }
    if (candidateStripped !== candidateNorm) {
      const stripped = sequenceMatchRatio(expected, candidateStripped);
      if (stripped > best) {
        best = stripped;
      }
    }
    if (best >= 1) {
      return 1;
    }
  }
  return best;
}

function clampRatio(value, fallback) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

/**
 * Match a release's expected track titles against a candidate folder's audio
 * filenames. Each candidate file is assigned to at most one expected track
 * (greedy, highest-ratio-first), producing explainable per-track evidence plus
 * an album-level summary.
 *
 * @returns {object|null} summary, or null when there is nothing to match.
 */
export function matchExpectedTracklist({
  expectedTrackTitles = null,
  candidateFilenames = [],
  albumTitle = null,
  minimumRatio = DEFAULT_MINIMUM_MATCH_RATIO,
} = {}) {
  const threshold = clampRatio(minimumRatio, DEFAULT_MINIMUM_MATCH_RATIO);

  const expectedTitles = Array.isArray(expectedTrackTitles)
    ? expectedTrackTitles
      .filter((title) => typeof title === 'string' && title.trim().length > 0)
      .slice(0, MAX_EXPECTED_TRACKS)
    : [];

  if (expectedTitles.length === 0) {
    return null;
  }

  const audioFiles = (Array.isArray(candidateFilenames) ? candidateFilenames : [])
    .filter((name) => typeof name === 'string' && name.trim().length > 0)
    .filter((name) => AUDIO_EXTENSIONS.has(fileExtension(name)))
    .slice(0, MAX_CANDIDATE_FILES);

  const expected = expectedTitles.map((trackTitle, index) => ({
    index,
    trackTitle,
    comparisons: buildExpectedComparisons(trackTitle, albumTitle),
  }));

  const files = audioFiles.map((filename, index) => {
    const norm = normalizeMatchText(stripExtension(basename(filename)));
    return {
      index,
      filename,
      norm,
      stripped: stripLeadingTrackNumber(norm),
    };
  });

  // Score every (expected track, candidate file) pair once.
  const pairs = [];
  for (const track of expected) {
    for (const file of files) {
      const ratio = bestRatioForFile(track.comparisons, file.norm, file.stripped);
      if (ratio > 0) {
        pairs.push({ trackIndex: track.index, fileIndex: file.index, ratio });
      }
    }
  }

  // Greedy unique assignment: best ratios first, each track and file used once.
  pairs.sort((left, right) => (
    right.ratio - left.ratio
    || left.trackIndex - right.trackIndex
    || left.fileIndex - right.fileIndex
  ));

  const trackAssignment = new Map();
  const usedFiles = new Set();
  for (const pair of pairs) {
    if (pair.ratio < threshold) {
      break;
    }
    if (trackAssignment.has(pair.trackIndex) || usedFiles.has(pair.fileIndex)) {
      continue;
    }
    trackAssignment.set(pair.trackIndex, pair);
    usedFiles.add(pair.fileIndex);
  }

  // Best available ratio per track (even below threshold) for evidence display.
  const bestPerTrack = new Map();
  for (const pair of pairs) {
    const current = bestPerTrack.get(pair.trackIndex);
    if (!current || pair.ratio > current.ratio) {
      bestPerTrack.set(pair.trackIndex, pair);
    }
  }

  const perTrack = expected.map((track) => {
    const assigned = trackAssignment.get(track.index);
    const best = bestPerTrack.get(track.index);
    const evidence = assigned ?? best ?? null;
    return {
      trackTitle: track.trackTitle,
      matched: Boolean(assigned),
      matchedFilename: assigned ? files[assigned.fileIndex].filename : null,
      ratio: evidence ? Math.round(evidence.ratio * 1000) / 1000 : 0,
    };
  });

  const matchedTrackCount = trackAssignment.size;
  const matchedRatios = Array.from(trackAssignment.values()).map((pair) => pair.ratio);
  const averageMatchRatio = matchedRatios.length > 0
    ? matchedRatios.reduce((sum, ratio) => sum + ratio, 0) / matchedRatios.length
    : 0;
  const minimumMatchedRatio = matchedRatios.length > 0 ? Math.min(...matchedRatios) : 0;

  return {
    minimumRatio: threshold,
    expectedTrackCount: expected.length,
    matchedTrackCount,
    coverageRatio: Math.round((matchedTrackCount / expected.length) * 1000) / 1000,
    averageMatchRatio: Math.round(averageMatchRatio * 1000) / 1000,
    minimumMatchedRatio: Math.round(minimumMatchedRatio * 1000) / 1000,
    audioFileCount: files.length,
    extraFileCount: Math.max(0, files.length - matchedTrackCount),
    unmatchedTrackTitles: perTrack.filter((track) => !track.matched).map((track) => track.trackTitle),
    perTrack,
  };
}

/**
 * Collapse an album match summary into a 0–100 score. Coverage (how many tracks
 * were matched) is primary; the average match quality scales it so a folder that
 * matches every track by a thin margin scores below one that matches cleanly. A
 * null summary (no expected tracklist) yields a neutral 50.
 */
export function scoreTracklistMatch(summary) {
  if (!summary || !(summary.expectedTrackCount > 0)) {
    return 50;
  }

  const coverage = clampRatio(summary.coverageRatio, 0);
  if (summary.matchedTrackCount <= 0) {
    return 0;
  }

  const avg = clampRatio(summary.averageMatchRatio, 0);
  // Average ratio scales the coverage score within [0.6, 1.0] so weak-but-present
  // matches are discounted without collapsing an otherwise complete album.
  const qualityFactor = 0.6 + (0.4 * avg);
  const score = coverage * 100 * qualityFactor;

  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Builds the expected-tracklist inputs (titles, count, total duration) from
 * metadata track rows for a release. Pure: accepts already-loaded rows.
 */
export function buildReleaseTracklistExpectations(trackRows) {
  const rows = Array.isArray(trackRows) ? trackRows : [];

  const expectedTrackTitles = rows
    .map((row) => (typeof row?.title === 'string' ? row.title.trim() : ''))
    .filter((title) => title.length > 0);

  let totalLengthMs = 0;
  let hasDuration = false;
  for (const row of rows) {
    const lengthMs = row?.length_ms ?? row?.recording_length_ms ?? null;
    if (typeof lengthMs === 'number' && Number.isFinite(lengthMs) && lengthMs > 0) {
      totalLengthMs += lengthMs;
      hasDuration = true;
    }
  }

  return {
    expectedTrackTitles,
    expectedTrackCount: rows.length > 0 ? rows.length : null,
    expectedDurationSeconds: hasDuration ? Math.round(totalLengthMs / 1000) : null,
  };
}
