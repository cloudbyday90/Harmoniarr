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
 * Pure pagination math for incremental "show more" lists.
 *
 * Extracted from the grid component so the reveal logic can be unit-tested with
 * the native Node runner without a DOM. The component owns the reactive
 * `visibleCount` state and delegates every count transition to these helpers.
 */

/**
 * Clamp a desired visible count into the valid range `[min(total, step), total]`.
 *
 * Never returns more than `total` and never less than a single page (`step`),
 * unless `total` is smaller, in which case `total` is the floor and ceiling.
 *
 * @param {number} desired - The requested visible count.
 * @param {number} total - Total number of available items (>= 0).
 * @param {number} [step=12] - Page size; also the minimum initial reveal.
 * @returns {number} A safe visible count within bounds.
 */
export function clampVisibleCount(desired, total, step = 12) {
  const safeTotal = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  if (safeTotal === 0) {
    return 0;
  }
  const safeStep = Number.isFinite(step) && step > 0 ? Math.floor(step) : 1;
  const floor = Math.min(safeStep, safeTotal);
  const safeDesired = Number.isFinite(desired) ? Math.floor(desired) : floor;
  return Math.max(floor, Math.min(safeDesired, safeTotal));
}

/**
 * Compute the next visible count after a "show more" interaction.
 *
 * Advances by one page (`step`) without exceeding `total`.
 *
 * @param {number} current - The current visible count.
 * @param {number} total - Total number of available items.
 * @param {number} [step=12] - Page size to advance by.
 * @returns {number} The next visible count, capped at `total`.
 */
export function resolveNextVisibleCount(current, total, step = 12) {
  const safeCurrent = clampVisibleCount(current, total, step);
  return clampVisibleCount(safeCurrent + (Number.isFinite(step) && step > 0 ? Math.floor(step) : 1), total, step);
}

/**
 * Number of items still hidden beyond the current visible window.
 *
 * @param {number} visibleCount - Items currently shown.
 * @param {number} total - Total number of available items.
 * @returns {number} Remaining hidden count (>= 0).
 */
export function resolveRemainingCount(visibleCount, total) {
  const safeTotal = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  const safeVisible = Number.isFinite(visibleCount) && visibleCount > 0 ? Math.floor(visibleCount) : 0;
  return Math.max(0, safeTotal - safeVisible);
}
