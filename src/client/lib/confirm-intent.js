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

/**
 * Pure confirm-intent helpers shared by the imperative confirm service
 * (`composables/useConfirm.js`), the local confirm composable
 * (`composables/useConfirmDialog.js`), and the presentational dialog
 * (`components/ConfirmDialog.vue`).
 *
 * Keeping the gating logic and copy normalization here (framework-free) means
 * it can be unit-tested directly and stays consistent across every call site.
 */

/**
 * The escalation level of a confirmation gate.
 * - NONE: a plain confirm/cancel prompt (no extra acknowledgement).
 * - CHECKBOX: the operator must tick an "I understand" checkbox.
 * - TYPE_TO_CONFIRM: the operator must tick the checkbox AND type an exact phrase.
 */
export const CONFIRM_LEVEL = Object.freeze({
  NONE: 'none',
  CHECKBOX: 'checkbox',
  TYPE_TO_CONFIRM: 'type_to_confirm',
});

/**
 * The visual/semantic tone of the confirm button.
 * - DANGER: irreversible / destructive actions (red).
 * - PRIMARY: significant but non-destructive actions.
 */
export const CONFIRM_TONE = Object.freeze({
  DANGER: 'danger',
  PRIMARY: 'primary',
});

const VALID_LEVELS = new Set(Object.values(CONFIRM_LEVEL));
const VALID_TONES = new Set(Object.values(CONFIRM_TONE));

const DEFAULT_TITLE = 'Confirm';
const DEFAULT_GATE_LABEL = 'I understand this action cannot be undone.';
const DEFAULT_CONFIRM_LABEL = 'Confirm';
const DEFAULT_CANCEL_LABEL = 'Cancel';
const DEFAULT_ERROR_LABEL = 'Operation failed';

/**
 * Coerce an arbitrary value to a trimmed string, falling back when blank.
 * @param {unknown} value
 * @param {string} fallback
 * @returns {string}
 */
function normalizeString(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

/**
 * Normalize a confirm level to a known value (defaults to NONE).
 * @param {unknown} level
 * @returns {string}
 */
export function normalizeConfirmLevel(level) {
  return VALID_LEVELS.has(level) ? level : CONFIRM_LEVEL.NONE;
}

/**
 * Normalize a confirm tone to a known value (defaults to DANGER, since the
 * unified dialog exists primarily to gate destructive actions).
 * @param {unknown} tone
 * @returns {string}
 */
export function normalizeConfirmTone(tone) {
  return VALID_TONES.has(tone) ? tone : CONFIRM_TONE.DANGER;
}

/**
 * @typedef {object} ConfirmRequest
 * @property {string} title Heading shown in the dialog.
 * @property {string} message Body/description text (wired to aria-describedby).
 * @property {string} level One of CONFIRM_LEVEL.
 * @property {string} tone One of CONFIRM_TONE.
 * @property {string} confirmText Exact phrase required for TYPE_TO_CONFIRM.
 * @property {string} gateLabel Acknowledgement checkbox label.
 * @property {string} confirmLabel Confirm button label.
 * @property {string} cancelLabel Cancel button label.
 * @property {string} errorLabel Fallback message used when the action throws.
 */

/**
 * Normalize a caller-supplied options object into a fully-resolved request with
 * safe defaults. Never throws; unknown levels/tones degrade gracefully.
 *
 * @param {object} [options]
 * @returns {ConfirmRequest}
 */
export function normalizeConfirmRequest(options = {}) {
  const level = normalizeConfirmLevel(options.level);
  const confirmText =
    level === CONFIRM_LEVEL.TYPE_TO_CONFIRM
      ? normalizeString(options.confirmText, '')
      : '';

  return {
    title: normalizeString(options.title, DEFAULT_TITLE),
    message: normalizeString(options.message, ''),
    level,
    tone: normalizeConfirmTone(options.tone),
    confirmText,
    gateLabel: normalizeString(options.gateLabel, DEFAULT_GATE_LABEL),
    confirmLabel: normalizeString(options.confirmLabel, DEFAULT_CONFIRM_LABEL),
    cancelLabel: normalizeString(options.cancelLabel, DEFAULT_CANCEL_LABEL),
    errorLabel: normalizeString(options.errorLabel, DEFAULT_ERROR_LABEL),
  };
}

/**
 * Resolve whether the typed phrase matches the required confirm text. Only
 * meaningful for TYPE_TO_CONFIRM; every other level matches unconditionally.
 *
 * @param {{ level: string, confirmText: string, typed: string }} params
 * @returns {boolean}
 */
export function resolveTypedMatch({ level, confirmText, typed }) {
  if (normalizeConfirmLevel(level) !== CONFIRM_LEVEL.TYPE_TO_CONFIRM) return true;
  return typeof typed === 'string' && typed === confirmText;
}

/**
 * Resolve the gate state for a confirmation prompt.
 *
 * @param {{ level: string, confirmText?: string, acknowledged?: boolean, typed?: string }} params
 * @returns {{ matches: boolean, canConfirm: boolean }}
 */
export function resolveConfirmGate({ level, confirmText = '', acknowledged = false, typed = '' }) {
  const normalizedLevel = normalizeConfirmLevel(level);
  const matches = resolveTypedMatch({ level: normalizedLevel, confirmText, typed });

  let canConfirm;
  if (normalizedLevel === CONFIRM_LEVEL.NONE) {
    canConfirm = true;
  } else if (normalizedLevel === CONFIRM_LEVEL.CHECKBOX) {
    canConfirm = acknowledged === true;
  } else {
    canConfirm = acknowledged === true && matches;
  }

  return { matches, canConfirm };
}
