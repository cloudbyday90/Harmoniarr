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

export const DEFAULT_LOSSY_DERIVATIVE_DECISION_TYPE = 'allow_lossy_derivative';

export function createMediaLosslessRetentionPolicyService({
  lossyDerivativeDecisionType = DEFAULT_LOSSY_DERIVATIVE_DECISION_TYPE,
} = {}) {
  function evaluateCandidatePolicy({
    decision = null,
    transcodePlan = null,
  } = {}) {
    const requiresLossyAcknowledgement = transcodePlan?.recommendedAction === 'transcode_candidate';
    const lossyDerivativeAcknowledged = decision?.decisionType === lossyDerivativeDecisionType;

    if (!requiresLossyAcknowledgement) {
      return {
        lossyDerivativeAcknowledged: false,
        requiresLossyAcknowledgement: false,
        warnings: [],
      };
    }

    if (!lossyDerivativeAcknowledged) {
      return {
        lossyDerivativeAcknowledged: false,
        requiresLossyAcknowledgement: true,
        warnings: [{
          code: 'media_transcode_lossy_derivative_ack_required',
          message: 'This file is a lossy transcode candidate. Default retention policy preserves the canonical source, and import apply requires an explicit allow-lossy-derivative decision before continuing.',
        }],
      };
    }

    return {
      lossyDerivativeAcknowledged: true,
      requiresLossyAcknowledgement: true,
      warnings: [{
        code: 'media_transcode_lossy_derivative_acknowledged',
        message: 'Operator explicitly allowed a lossy derivative path for this file. Canonical-source retention should remain in place for shared-library reuse.',
      }],
    };
  }

  return {
    evaluateCandidatePolicy,
  };
}
