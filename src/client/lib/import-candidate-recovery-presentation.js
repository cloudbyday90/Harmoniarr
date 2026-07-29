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

import { candidateStatusLabel } from './import-candidate-presentation.js';

function firstBlocker(preview) {
  return preview?.validation?.blockers?.find((blocker) => blocker?.message) ?? null;
}

function createPresentation({
  action = null,
  description,
  label,
  tone,
  title,
} = {}) {
  return {
    action,
    description,
    label,
    tone,
    title,
  };
}

/**
 * Build the concise recovery state for a raw import-match diagnostic. This
 * intentionally exposes no provider response, filesystem path, or file-level
 * detail; those remain in the evidence disclosure.
 *
 * @param {{ candidate?: object|null, canManageCandidates?: boolean, preview?: object|null }} options
 * @returns {{ action: null|{id: string, label: string}, description: string, label: string, tone: string, title: string }}
 */
export function buildImportCandidateRecoveryPresentation({
  candidate = null,
  canManageCandidates = false,
  preview = null,
} = {}) {
  if (!candidate) {
    return createPresentation({
      description: 'Choose a match from the diagnostic list to see its current state.',
      label: 'No match selected',
      tone: 'neutral',
      title: 'Select a match',
    });
  }

  switch (candidate.status) {
    case 'failed':
    case 'rejected':
      return createPresentation({
        action: canManageCandidates ? { id: 'reopen', label: 'Try this match again' } : null,
        description: candidate.status === 'failed'
          ? 'The last attempt did not complete. Reopen it to let the normal recovery flow evaluate it again.'
          : 'This match was previously declined. Reopen it only when it should be reconsidered.',
        label: candidateStatusLabel(candidate.status),
        tone: 'danger',
        title: candidate.status === 'failed' ? 'This match needs a retry' : 'This match is not in use',
      });
    case 'held':
      return createPresentation({
        action: canManageCandidates ? { id: 'select', label: 'Resume this match' } : null,
        description: 'This match is paused and will not move forward until it is resumed.',
        label: 'Paused',
        tone: 'warning',
        title: 'This match is paused',
      });
    case 'pending':
      return createPresentation({
        action: canManageCandidates ? { id: 'select', label: 'Use this match' } : null,
        description: 'This match is available for review. Selecting it makes it eligible for the normal download flow.',
        label: 'Available',
        tone: 'neutral',
        title: 'This match is ready to use',
      });
    case 'selected':
      {
        const blocker = firstBlocker(preview);
        if (blocker && canManageCandidates) {
          return createPresentation({
            action: { id: 'reopen', label: 'Reopen for review' },
            description: blocker.message,
            label: 'Needs attention',
            tone: 'warning',
            title: 'This match needs attention',
          });
        }

        return createPresentation({
          description: 'Harmoniarr has selected this match. The normal download flow will continue when its next run is available.',
          label: 'Selected',
          tone: 'info',
          title: 'Waiting for download',
        });
      }
    case 'downloading':
      return createPresentation({
        description: 'The download client is handling this match. Follow live transfer progress in Downloader.',
        label: 'Downloading',
        tone: 'info',
        title: 'Download in progress',
      });
    case 'import_pending':
      return createPresentation({
        description: 'The download is complete and is waiting for the normal add-to-library checks.',
        label: 'Ready to add',
        tone: 'success',
        title: 'Waiting to add to library',
      });
    case 'applied':
      return createPresentation({
        description: 'The library add completed. Detailed evidence remains available below for troubleshooting.',
        label: 'In library',
        tone: 'success',
        title: 'Added to library',
      });
    default:
      return createPresentation({
        description: 'Harmoniarr is determining the next safe step for this match.',
        label: candidateStatusLabel(candidate.status),
        tone: 'neutral',
        title: 'Checking this match',
      });
  }
}

/**
 * Return the non-primary transitions so rare diagnostic decisions remain
 * available without competing with the safe recovery action.
 *
 * @param {object|null} candidate
 * @param {string|null|undefined} primaryActionId
 * @returns {Array<{id: string, label: string, tone: 'default'|'danger'}>}
 */
export function buildImportCandidateSecondaryActions(candidate, primaryActionId) {
  if (!candidate) {
    return [];
  }

  const actions = [];
  if (candidate.status === 'pending' && primaryActionId !== 'hold') {
    actions.push({ id: 'hold', label: 'Pause this match', tone: 'default' });
  }
  if (['pending', 'held', 'selected'].includes(candidate.status)) {
    actions.push({ id: 'reject', label: 'Do not use this match', tone: 'danger' });
  }
  if (['held', 'selected', 'failed', 'rejected'].includes(candidate.status) && primaryActionId !== 'reopen') {
    actions.push({ id: 'reopen', label: 'Reopen for review', tone: 'default' });
  }

  return actions;
}
