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

const providerLabels = {
  coverArtArchive: 'Cover Art Archive',
  fanartTv: 'Fanart.tv',
};

export function formatProviderLabel(provider) {
  return providerLabels[provider] ?? provider;
}

export function formatQuotaUsage(used, limit) {
  if (!limit) return String(used);
  return `${used} / ${limit}`;
}

export function formatQuotaPercentage(used, limit) {
  if (!limit) return 0;
  return Math.min(Math.round((used / limit) * 100), 100);
}

export function formatQuotaRemaining(remaining) {
  if (remaining === 0) return 'Limit reached';
  return `${remaining} remaining`;
}

export function resolveQuotaTone(exceeded, used, limit) {
  if (exceeded) return 'danger';
  if (limit && used / limit >= 0.8) return 'warning';
  return 'success';
}

export function buildSparklineData(history, limit) {
  if (!history || history.length === 0) return [];
  const max = Math.max(limit, ...history.map((d) => d.requestCount), 1);
  return history.map((d) => ({
    date: d.date,
    height: Math.max((d.requestCount / max) * 100, 1),
    requestCount: d.requestCount,
    tone: resolveQuotaTone(d.requestCount >= limit, d.requestCount, limit),
  }));
}
