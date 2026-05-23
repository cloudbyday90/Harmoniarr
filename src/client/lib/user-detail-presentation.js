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

export function formatSessionStatus(session) {
  if (session.isRevoked) return { label: 'Revoked', tone: 'danger' };
  if (new Date(session.expiresAt) < new Date()) return { label: 'Expired', tone: 'warning' };
  return { label: 'Active', tone: 'success' };
}

export function formatAuditEventType(eventType) {
  if (!eventType || typeof eventType !== 'string') return eventType ?? 'Unknown';
  return eventType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatAuditEventTypeTone(eventType) {
  if (!eventType) return undefined;
  const lower = eventType.toLowerCase();
  if (lower.includes('delete') || lower.includes('remove') || lower.includes('revoke') || lower.includes('disable')) return 'danger';
  if (lower.includes('create') || lower.includes('link') || lower.includes('enable')) return 'success';
  if (lower.includes('update') || lower.includes('change') || lower.includes('reassign')) return 'warning';
  if (lower.includes('login') || lower.includes('auth')) return 'info';
  return undefined;
}

export function formatRelativeTime(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 30) return `${diffDay}d ago`;
    return date.toLocaleDateString();
  } catch {
    return isoString;
  }
}

export function summarizeRequestCounts(summary) {
  if (!summary) return [];
  return [
    { label: 'Total', value: summary.total ?? 0, tone: undefined },
    { label: 'Needs fetch', value: (summary.asTarget?.needsFetch ?? 0) + (summary.asRequester?.needsFetch ?? 0), tone: 'info' },
    { label: 'Needs review', value: (summary.asTarget?.needsReview ?? 0) + (summary.asRequester?.needsReview ?? 0), tone: 'warning' },
    { label: 'Cancelled', value: (summary.asTarget?.cancelled ?? 0) + (summary.asRequester?.cancelled ?? 0), tone: 'danger' },
  ];
}
