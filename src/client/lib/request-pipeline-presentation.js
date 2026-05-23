const pipelineStepLabels = new Map([
  ['pending', 'Discovered'],
  ['held', 'Held'],
  ['selected', 'Queued'],
  ['downloading', 'Downloading'],
  ['import_pending', 'Import pending'],
  ['applied', 'Applied'],
  ['rejected', 'Rejected'],
  ['failed', 'Failed'],
]);

const pipelineStepTones = new Map([
  ['pending', 'held'],
  ['held', 'held'],
  ['selected', 'held'],
  ['downloading', 'held'],
  ['import_pending', 'held'],
  ['applied', 'selected'],
  ['rejected', 'failed'],
  ['failed', 'failed'],
]);

export function candidateStatusLabel(status) {
  return pipelineStepLabels.get(status) ?? 'Unknown';
}

export function candidateStatusTone(status) {
  return pipelineStepTones.get(status) ?? 'held';
}

export function formatBytes(bytes) {
  if (bytes == null || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function runItemStatusLabel(runItem) {
  if (!runItem) return null;
  const status = runItem.itemStatus;
  if (!status) return null;

  const labels = new Map([
    ['pending', 'Pending'],
    ['queued', 'Queued'],
    ['in_progress', 'In progress'],
    ['completed', 'Completed'],
    ['failed', 'Failed'],
    ['skipped', 'Skipped'],
    ['blocked', 'Blocked'],
  ]);

  return labels.get(status) ?? status;
}

export function runItemStatusTone(runItem) {
  if (!runItem) return null;
  const status = runItem.itemStatus;
  if (!status) return null;

  const tones = new Map([
    ['pending', 'held'],
    ['queued', 'held'],
    ['in_progress', 'warning'],
    ['completed', 'selected'],
    ['failed', 'failed'],
    ['skipped', 'held'],
    ['blocked', 'failed'],
  ]);

  return tones.get(status) ?? 'held';
}

export function buildPipelineSteps(candidate) {
  if (!candidate) return [];

  const steps = [
    { key: 'discovery', label: 'Discovered', status: 'completed' },
  ];

  if (candidate.status === 'rejected') {
    steps.push({ key: 'review', label: 'Rejected', status: 'failed' });
    return steps;
  }

  if (candidate.status === 'held') {
    steps.push({ key: 'review', label: 'Under review', status: 'active' });
    return steps;
  }

  if (candidate.status === 'pending') {
    steps.push({ key: 'review', label: 'Awaiting review', status: 'pending' });
    return steps;
  }

  steps.push({ key: 'review', label: 'Reviewed', status: 'completed' });

  if (candidate.execution) {
    const exec = candidate.execution;
    const execStatus = exec.runStatus === 'completed' && exec.itemStatus === 'completed'
      ? 'completed'
      : exec.runStatus === 'failed' || exec.itemStatus === 'failed'
        ? 'failed'
        : exec.runStatus === 'running'
          ? 'active'
          : 'pending';

    steps.push({
      key: 'execution',
      label: execStatus === 'active' ? 'Downloading' : execStatus === 'completed' ? 'Downloaded' : execStatus === 'failed' ? 'Download failed' : 'Download',
      status: execStatus,
    });
  } else if (['selected', 'downloading', 'import_pending', 'applied'].includes(candidate.status)) {
    steps.push({ key: 'execution', label: 'Download', status: candidate.status === 'downloading' ? 'active' : 'pending' });
  }

  if (candidate.apply) {
    const apply = candidate.apply;
    const applyStatus = apply.runStatus === 'completed' && apply.itemStatus === 'completed'
      ? 'completed'
      : apply.runStatus === 'failed' || apply.itemStatus === 'failed'
        ? 'failed'
        : apply.runStatus === 'running'
          ? 'active'
          : 'pending';

    steps.push({
      key: 'apply',
      label: applyStatus === 'active' ? 'Importing' : applyStatus === 'completed' ? 'Imported' : applyStatus === 'failed' ? 'Import failed' : 'Import',
      status: applyStatus,
    });
  } else if (candidate.status === 'applied') {
    steps.push({ key: 'apply', label: 'Imported', status: 'completed' });
  } else if (candidate.status === 'import_pending') {
    steps.push({ key: 'apply', label: 'Import pending', status: 'pending' });
  }

  return steps;
}
