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

function buildSkippedResult({
  code = null,
  message,
  provider = 'slskd',
  reason = 'setup_required',
}) {
  return {
    allowed: false,
    message,
    pauseCode: code,
    provider,
    reason,
  };
}

function buildPausedResult({
  code = null,
  message,
  provider = 'slskd',
  reason = 'paused',
}) {
  return {
    allowed: false,
    pauseCode: code,
    pauseMessage: message,
    provider,
    reason,
  };
}

export function createLibraryDiscoveryDispatchPolicyService() {
  function resolveDispatchReadiness({ dependencyStatuses = [] } = {}) {
    const slskdStatus = dependencyStatuses.find((status) => status?.provider === 'slskd');

    if (!slskdStatus) {
      return { allowed: true };
    }

    if (slskdStatus.status === 'disabled' || slskdStatus.code === 'slskd_not_configured') {
      return buildSkippedResult({
        code: slskdStatus.code ?? 'slskd_not_configured',
        message: slskdStatus.message ?? 'Configure Soulseek (slskd) in Settings to enable discovery searches.',
      });
    }

    if (slskdStatus.status === 'misconfigured') {
      return buildPausedResult({
        code: slskdStatus.code ?? 'slskd_misconfigured',
        message: slskdStatus.message ?? 'Soulseek (slskd) needs configuration before discovery searches can run.',
      });
    }

    if (slskdStatus.status === 'unavailable') {
      return buildPausedResult({
        code: slskdStatus.code ?? 'slskd_unavailable',
        message: slskdStatus.message ?? 'Soulseek (slskd) is temporarily unavailable.',
      });
    }

    if (slskdStatus.status === 'degraded') {
      return buildPausedResult({
        code: slskdStatus.code ?? 'slskd_degraded',
        message: slskdStatus.message ?? 'Soulseek (slskd) is not ready for discovery searches.',
      });
    }

    return { allowed: true };
  }

  return {
    resolveDispatchReadiness,
  };
}
