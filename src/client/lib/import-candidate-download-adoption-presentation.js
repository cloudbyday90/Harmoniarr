/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export const MAX_DOWNLOAD_ADOPTION_FILES = 200;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const text = (value, fallback = '') => typeof value === 'string' && value.trim() ? value.trim() : fallback;
const explanations = {
  active_download_work: 'The download worker is still active. Wait for it to finish before reviewing this request.',
  immutable_download_evidence_missing: 'This request lacks the saved file and source evidence needed to link existing downloads safely.',
  download_episode_not_current: 'A newer download request owns this match. Review its current status before continuing.',
  download_episode_not_available: 'This download request is no longer available for linking existing downloads.',
  download_policy_not_current: 'The match or its saved requirements changed. Review the current release before continuing.',
};

function sizeLabel(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes; let index = 0;
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index += 1; }
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: index ? 1 : 0 }).format(value)} ${units[index]}`;
}

export function buildImportCandidateDownloadAdoptionPresentation(review) {
  const files = Array.isArray(review?.files) ? review.files.slice(0, MAX_DOWNLOAD_ADOPTION_FILES).map((file) => {
    const choice = Array.isArray(file.choices) && file.choices.length === 1 ? file.choices[0] : null;
    return { label: text(file.label, 'Unknown file').split(/[\\/]/u).at(-1),
      size: file.size, sizeLabel: Number.isSafeInteger(file.size) && file.size > 0 ? sizeLabel(file.size) : 'Unavailable',
      transferId: text(choice?.id).toLowerCase(), stateLabel: text(choice?.stateLabel, 'Progress not verified') };
  }) : [];
  const requestedFileCount = Number.isInteger(review?.requestedFileCount) ? review.requestedFileCount : 0;
  const digest = text(review?.reviewDigest);
  const validFiles = files.length > 0 && review.files.length === requestedFileCount && files.length === requestedFileCount && requestedFileCount <= MAX_DOWNLOAD_ADOPTION_FILES
    && files.every((file) => uuid.test(file.transferId) && Number.isSafeInteger(file.size) && file.size > 0)
    && new Set(files.map((file) => file.transferId)).size === files.length;
  const canAdopt = review?.canAdopt === true && validFiles && digest.length > 0 && digest.length <= 4096;
  return { canAdopt, files, transferIds: canAdopt ? files.map((file) => file.transferId).sort() : [], requestedFileCount,
    reviewDigest: canAdopt ? digest : null,
    explanation: canAdopt ? 'These existing downloads cover the full saved file list and have verified progress.'
      : explanations[review?.reasonCode] ?? 'This request still needs review. Its existing downloads cannot be linked safely yet.',
    uncertainty: 'The earlier request’s outcome remains uncertain. This choice uses the reviewed existing downloads for this match.',
    confirmation: 'Harmoniarr will link the reviewed downloads and continue using the saved policy. Library quality and file checks still apply.' };
}
