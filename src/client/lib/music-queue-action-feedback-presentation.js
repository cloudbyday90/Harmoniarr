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

const MAX_MESSAGE_LENGTH = 280;

const PHASE_PRESENTATION = Object.freeze({
  error: Object.freeze({ label: 'Could not continue', role: 'alert', tone: 'danger' }),
  success: Object.freeze({ label: 'Updated', role: 'status', tone: 'success' }),
  working: Object.freeze({ label: 'Working', role: 'status', tone: 'info' }),
});

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function truncateMessage(message) {
  if (message.length <= MAX_MESSAGE_LENGTH) return message;
  return `${message.slice(0, MAX_MESSAGE_LENGTH - 3).trimEnd()}...`;
}

/**
 * Creates the one short-lived action result retained by Music Queue. It is
 * intentionally release-keyed and bounded so asynchronous feedback stays in
 * the current review context without becoming an in-page notification feed.
 *
 * @param {{ actionKey?: unknown, message?: unknown, phase?: unknown, wantedReleaseId?: unknown }} input
 * @returns {{ actionKey: string, message: string, phase: 'working'|'success'|'error', wantedReleaseId: string } | null}
 */
export function createMusicQueueActionFeedback({
  actionKey,
  message,
  phase,
  wantedReleaseId,
} = {}) {
  const normalizedActionKey = normalizeText(actionKey);
  const normalizedMessage = truncateMessage(normalizeText(message));
  const normalizedReleaseId = normalizeText(wantedReleaseId);

  if (!normalizedActionKey || !normalizedMessage || !normalizedReleaseId || !PHASE_PRESENTATION[phase]) {
    return null;
  }

  return {
    actionKey: normalizedActionKey,
    message: normalizedMessage,
    phase,
    wantedReleaseId: normalizedReleaseId,
  };
}

/**
 * Returns a display-safe action result only for the selected release.
 *
 * @param {ReturnType<typeof createMusicQueueActionFeedback> | null | undefined} feedback
 * @param {unknown} wantedReleaseId
 * @returns {{ actionKey: string, label: string, message: string, phase: 'working'|'success'|'error', role: 'status'|'alert', tone: 'info'|'success'|'danger', wantedReleaseId: string } | null}
 */
export function buildMusicQueueReleaseActionFeedback(feedback, wantedReleaseId) {
  const normalizedReleaseId = normalizeText(wantedReleaseId);
  const phasePresentation = PHASE_PRESENTATION[feedback?.phase];

  if (!normalizedReleaseId || feedback?.wantedReleaseId !== normalizedReleaseId || !phasePresentation) {
    return null;
  }

  return {
    ...feedback,
    ...phasePresentation,
  };
}
