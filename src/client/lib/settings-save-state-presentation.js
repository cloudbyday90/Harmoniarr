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

const SENSITIVE_ERROR_PATTERN = /(?:https?:\/\/|api[ _-]?key|authorization|cookie|password|secret|stack trace|token|\bat\s+\w+\s*\()/i;
const MAX_ERROR_MESSAGE_LENGTH = 180;

function normalizeErrorMessage(errorMessage) {
  if (typeof errorMessage !== 'string') return '';

  return errorMessage.replace(/\s+/g, ' ').trim();
}

/**
 * Keeps short validation guidance available while suppressing messages that
 * could expose credentials, URLs, stack traces, or unbounded diagnostics.
 *
 * @param {unknown} errorMessage
 * @returns {string}
 */
export function buildSettingsSaveFailureMessage(errorMessage) {
  const message = normalizeErrorMessage(errorMessage);
  const isSafeMessage = (
    message
    && message.length <= MAX_ERROR_MESSAGE_LENGTH
    && !SENSITIVE_ERROR_PATTERN.test(message)
  );

  if (!isSafeMessage) {
    return 'Settings could not be saved. Review the affected setting and try again.';
  }

  return `Settings could not be saved: ${message.replace(/[.!]+$/, '')}. Review the affected setting and try again.`;
}

function buildInitialState() {
  return {
    actionLabel: 'Save settings',
    canSubmit: true,
    message: '',
    state: 'initial',
    statusLabel: '',
    tone: 'neutral',
    verificationActionLabel: '',
  };
}

/**
 * Builds the shared, bounded presentation state for primary Settings forms.
 * It intentionally receives only scalar state, never a provider response,
 * filesystem path, secret, or error object.
 *
 * @param {object} options
 * @param {boolean} [options.hasSaved]
 * @param {boolean} [options.isDirty]
 * @param {boolean} [options.isSaving]
 * @param {boolean} [options.requiresVerification]
 * @param {string} [options.saveErrorMessage]
 * @param {string} [options.successMessage]
 * @returns {object}
 */
export function buildSettingsSaveState({
  hasSaved = false,
  isDirty = false,
  isSaving = false,
  requiresVerification = false,
  saveErrorMessage = '',
  successMessage = '',
} = {}) {
  if (isSaving) {
    return {
      actionLabel: 'Saving settings...',
      canSubmit: false,
      message: 'Saving your changes. Keep this page open until Harmoniarr confirms them.',
      state: 'saving',
      statusLabel: 'Saving',
      tone: 'info',
      verificationActionLabel: '',
    };
  }

  if (saveErrorMessage) {
    return {
      actionLabel: 'Try saving again',
      canSubmit: true,
      message: buildSettingsSaveFailureMessage(saveErrorMessage),
      state: 'save_failed',
      statusLabel: 'Not saved',
      tone: 'danger',
      verificationActionLabel: '',
    };
  }

  if (isDirty) {
    return {
      actionLabel: 'Save changes',
      canSubmit: true,
      message: 'Your changes have not been saved yet.',
      state: 'unsaved',
      statusLabel: 'Unsaved changes',
      tone: 'warning',
      verificationActionLabel: '',
    };
  }

  if (hasSaved && requiresVerification) {
    return {
      actionLabel: 'Saved',
      canSubmit: false,
      message: `${successMessage || 'Settings saved.'} Test the saved connection before relying on automatic downloads.`,
      state: 'saved_unverified',
      statusLabel: 'Saved - test needed',
      tone: 'warning',
      verificationActionLabel: 'Test saved connection',
    };
  }

  if (hasSaved) {
    return {
      actionLabel: 'Saved',
      canSubmit: false,
      message: successMessage || 'Settings saved.',
      state: 'saved',
      statusLabel: 'Saved',
      tone: 'success',
      verificationActionLabel: '',
    };
  }

  return buildInitialState();
}
