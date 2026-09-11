/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

function quantity(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function validCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function buildCollectionPreparationProgressPresentation({ collection, progress }) {
  if (!progress || !collection || collection.targetMatches !== true
    || collection.revision !== progress.revision
    || !['preparing', 'blocked', 'ready', 'reviewed'].includes(collection.status)
    || !['total', 'completed', 'pending', 'failed', 'processing', 'unsupported'].every((key) => validCount(progress.work?.[key]))
    || !['queued', 'running'].every((key) => validCount(progress.operations?.[key]))
    || !['completed', 'pending', 'failed'].every((key) => validCount(progress.pages?.[key]))
    || !(progress.pages.total === null || validCount(progress.pages.total))
    || !validCount(progress.entriesSeen) || !validCount(progress.leavesCaptured)) return null;
  const { work, operations, pages } = progress;
  const prepared = ['ready', 'reviewed'].includes(collection.status);
  const blocked = collection.status === 'blocked';
  let label = prepared ? 'Metadata preparation complete' : blocked ? 'Metadata preparation blocked'
    : work.failed > 0 ? 'Metadata preparation needs attention' : 'Waiting for the next preparation batch';
  if (!prepared && !blocked && operations.running > 0) label = `${quantity(operations.running, 'preparation batch', 'preparation batches')} running`;
  else if (!prepared && !blocked && operations.queued > 0) label = `${quantity(operations.queued, 'preparation batch', 'preparation batches')} queued`;
  const traversalComplete = !blocked && pages.traversalComplete === true && pages.total === pages.completed && pages.total > 0;
  return {
    label,
    tone: blocked || work.failed > 0 ? 'warning' : prepared ? 'success' : 'info',
    workSummary: `${quantity(work.total, 'captured metadata task')} · ${work.completed} completed · ${work.pending} pending · ${work.failed} failed`,
    operationsSummary: prepared || blocked ? ''
      : `${quantity(operations.queued, 'preparation batch', 'preparation batches')} queued · ${quantity(operations.running, 'preparation batch', 'preparation batches')} running`,
    otherWorkSummary: work.processing || work.unsupported
      ? `${quantity(work.processing, 'task')} recorded as processing · ${quantity(work.unsupported, 'unsupported task')}` : '',
    pagesSummary: traversalComplete
      ? `${quantity(pages.completed, 'provider page')} captured · page traversal complete`
      : `${quantity(pages.completed, 'provider page')} captured · total pages unknown`,
    sourceSummary: `${quantity(progress.entriesSeen, 'source entry', 'source entries')} seen · ${quantity(progress.leavesCaptured, 'collection item')} captured`,
    detail: prepared ? 'Captured metadata is ready for collection review. Downloads and imports are tracked separately.'
      : blocked ? 'Review the preparation issue before continuing.'
        : traversalComplete ? 'Album metadata may still need preparation even though all provider pages were captured.'
          : 'More provider pages and metadata tasks may be discovered as preparation continues.',
  };
}
