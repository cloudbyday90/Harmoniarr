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

function formatOtherSessionCount(count) {
  return `${count} other signed-in ${count === 1 ? 'device' : 'devices'}`;
}

/**
 * Presents a small account-safety summary without claiming that the browser
 * client is authoritative for session validity or revocation.
 *
 * @param {{
 *   isLoadingSessions?: boolean,
 *   mustChangePassword?: boolean,
 *   sessionErrorMessage?: string,
 *   sessions?: Array<{ isCurrent?: boolean }>,
 * }} input
 * @returns {{ copy: string, status: string, tone: 'danger' | 'info' | 'success' | 'warning' }}
 */
export function buildAccountSecurityPosture({
  isLoadingSessions = false,
  mustChangePassword = false,
  sessionErrorMessage = '',
  sessions = [],
} = {}) {
  if (mustChangePassword) {
    return {
      copy: 'Update your password before continuing. Other signed-in devices will be signed out after the change.',
      status: 'Password update required',
      tone: 'danger',
    };
  }

  if (isLoadingSessions) {
    return {
      copy: 'Checking the signed-in devices for this account.',
      status: 'Checking devices',
      tone: 'info',
    };
  }

  if (sessionErrorMessage) {
    return {
      copy: 'Signed-in devices could not be checked. Refresh the device list to try again.',
      status: 'Device check unavailable',
      tone: 'warning',
    };
  }

  if (!sessions.length) {
    return {
      copy: 'No signed-in devices were returned. Refresh the device list to check again.',
      status: 'No active devices found',
      tone: 'warning',
    };
  }

  const otherSessionCount = sessions.filter((session) => !session?.isCurrent).length;
  if (otherSessionCount > 0) {
    return {
      copy: 'Review unfamiliar devices and remove access you do not recognize.',
      status: formatOtherSessionCount(otherSessionCount),
      tone: 'info',
    };
  }

  return {
    copy: 'No other signed-in devices are currently shown for this account.',
    status: 'This is the only signed-in device',
    tone: 'success',
  };
}
