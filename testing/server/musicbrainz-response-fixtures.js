/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
export function largeMusicBrainzRelease() {
  return { id: 'fixture-release', title: 'Multi-disc fixture',
    'release-group': { id: 'fixture-group', title: 'Fixture group' },
    'artist-credit': [{ name: 'Fixture artist', artist: { id: 'fixture-artist', name: 'Fixture artist' } }],
    media: Array.from({ length: 60 }, (_, disc) => ({ position: disc + 1, 'track-count': 50,
      tracks: Array.from({ length: 50 }, (unused, index) => ({ id: `track-${disc}-${index}`, position: index + 1,
        title: 'Synthetic title '.repeat(50), length: 180000,
        recording: { id: `recording-${disc}-${index}`, title: 'Fixture recording' } })) })) };
}
