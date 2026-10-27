/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
const validSubject = value => typeof value === 'string' && value.length > 0 && value.length <= 256 && value === value.trim();

export function selectPlexLoginSubjects(input) {
  const { plexId, plexUuid } = input ?? {};
  const values = [plexUuid, plexId].filter(value => value != null && value !== '');
  if (values.some(value => !validSubject(value))) return [];
  return [...new Set(values)];
}

// This descriptor comes from the verified server-side provider lookup, never a request body.
export function selectLinkedLoginIdentity(input) {
  const { provider, subject, userId } = input ?? {};
  return provider === 'plex' && validSubject(subject) && typeof userId === 'string' && userId.trim()
    ? { provider, subject, userId } : null;
}
