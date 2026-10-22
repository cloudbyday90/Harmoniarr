/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

// Project decoded-byte budgets, not vendor catalogue maxima. Keep the larger
// release allowance local: other providers retain their existing 2 MB ceiling.
const budgets = Object.freeze({
  'artist lookup': 2_000_000,
  'artist relations lookup': 4_000_000,
  'release lookup': 8_000_000,
  'release-group lookup': 4_000_000,
  'artist search': 2_000_000,
  'release search': 4_000_000,
  'artist release-group browse': 2_000_000,
  'release-group release browse': 8_000_000,
});

export function musicBrainzResponseBudget(operation) {
  if (!Object.hasOwn(budgets, operation)) throw new Error('Unknown MusicBrainz operation');
  return budgets[operation];
}
