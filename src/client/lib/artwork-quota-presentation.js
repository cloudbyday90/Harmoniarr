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
