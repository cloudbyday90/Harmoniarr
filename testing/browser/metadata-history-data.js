/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

export const historyEvent = title => ({ id: title, title, primaryType: 'Album', occurredAt: '2026-10-21T00:00:00.000Z', monitoringDecision: 'already_satisfied', resultingWantedStatus: 'none' });
export const historyPage = (count, hasMore, prefix = 'Appended') => ({ entries: Array.from({ length: count }, (_, index) => historyEvent(`${prefix} discovery ${index}`)), pageInfo: { hasMore, nextCursor: hasMore ? 'next-cursor' : null } });
