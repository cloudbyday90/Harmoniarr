/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
const ownedErrors = new WeakSet();

export function isArtworkImageError(error) { return ownedErrors.has(error); }

export function artworkImageError(diagnosticCode, { status = null, retryable = false, retryAfterMs = null } = {}) {
  const error = Object.assign(new Error('Artwork image request could not be completed safely'), {
    code: 'artwork_image_unavailable', diagnosticCode, details: { status, retryable, retryAfterMs },
  });
  ownedErrors.add(error); return error;
}

export function admitArtworkImageUrl(value, sourceProvider, { base, redirect = false } = {}) {
  try {
    if (!(value instanceof URL) && (typeof value !== 'string' || value.trim().length === 0)) throw new Error();
    const url = new URL(value, base);
    const host = url.hostname;
    const archive = host === 'archive.org' || host.endsWith('.archive.org');
    const allowed = sourceProvider === 'fanartTv' ? host === 'assets.fanart.tv'
      : sourceProvider === 'theAudioDb' ? ['theaudiodb.com', 'www.theaudiodb.com'].includes(host)
        : sourceProvider === 'coverArtArchive' && (host === 'coverartarchive.org' || archive);
    if (redirect && sourceProvider === 'coverArtArchive' && archive && url.protocol === 'http:' && !url.port) url.protocol = 'https:';
    if (!allowed || url.protocol !== 'https:' || url.port || url.username || url.password || url.search || url.hash) throw new Error();
    return url;
  } catch { throw artworkImageError('url_refused'); }
}

export function artworkImageByteLimit(limits) {
  const value = limits?.maxOriginalFileSizeBytes ?? 20 * 1024 * 1024;
  if (!Number.isSafeInteger(value) || value < 1 || value > 100 * 1024 * 1024) throw artworkImageError('policy_invalid');
  return value;
}

export function artworkImageRetryAfter(value) {
  if (!value) return null;
  const ms = /^\d+$/u.test(value) ? Number(value) * 1000 : Math.max(0, Date.parse(value) - Date.now());
  if (Number.isNaN(ms)) return null;
  return ms;
}
