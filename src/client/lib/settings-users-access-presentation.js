/*
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
*/

function asUserList(users) {
  return Array.isArray(users) ? users : [];
}

function normalizeTotalCount(totalCount, loadedCount) {
  return Number.isFinite(totalCount) && totalCount >= loadedCount
    ? totalCount
    : loadedCount;
}

function formatUserCount(count) {
  return `${count} ${count === 1 ? 'user' : 'users'}`;
}

export function buildUsersAccessPosture({
  isFiltered = false,
  isLoading = false,
  plexOwnerLinked = false,
  totalCount,
  users,
} = {}) {
  const listedUsers = asUserList(users);
  const loadedCount = listedUsers.length;
  const accountCount = normalizeTotalCount(totalCount, loadedCount);
  const isCompleteList = accountCount === loadedCount;
  const activeCount = listedUsers.filter((user) => !user?.isDisabled).length;
  const disabledCount = listedUsers.filter((user) => user?.isDisabled).length;
  const adminCount = listedUsers.filter((user) => user?.role === 'admin').length;
  const scopeLabel = isCompleteList ? '' : ' shown';
  const accountLabel = `${formatUserCount(accountCount)}${isFiltered ? ' matching' : ''}`;

  if (isLoading && loadedCount === 0) {
    return {
      checks: [],
      message: 'Loading saved account access and role information.',
      statusLabel: 'Loading access',
      tone: 'info',
    };
  }

  return {
    checks: [
      {
        label: 'Accounts',
        statusLabel: accountLabel,
        tone: accountCount > 0 ? 'info' : 'warning',
      },
      {
        label: 'Active',
        statusLabel: `${activeCount} active${scopeLabel}`,
        tone: activeCount > 0 ? 'success' : 'info',
      },
      {
        label: 'Administrators',
        statusLabel: `${adminCount} shown`,
        tone: adminCount > 0 ? 'warning' : 'info',
      },
      {
        label: 'Plex owner',
        statusLabel: plexOwnerLinked ? 'Connected' : 'Not connected',
        tone: plexOwnerLinked ? 'success' : 'info',
      },
    ],
    message: accountCount > 0
      ? `Review ${isFiltered ? 'the matching accounts' : (isCompleteList ? 'the listed accounts' : `${loadedCount} loaded accounts`)} below. Role and sign-in changes take effect only after saving, and the server authorizes every action.`
      : 'No accounts are loaded yet. Add a user only when someone needs their own sign-in or personal library folder.',
    statusLabel: accountCount > 0 ? 'Access overview' : 'No accounts loaded',
    tone: disabledCount > 0 ? 'warning' : 'info',
  };
}
