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

import { computed, ref } from 'vue';

/**
 * Reactive password-match state for forms with a confirm-password field.
 *
 * Tracks whether the confirm field has been interacted with (touched) so the
 * indicator is only shown after the user has started filling in the field,
 * not on initial render.
 *
 * Usage in a component:
 *   const { markTouched, showMatch, showMismatch } = usePasswordMatch(
 *     () => form.password,
 *     () => form.confirmPassword,
 *   );
 *
 * In the template:
 *   <input @input="markTouched" v-model="form.confirmPassword" ... />
 *   <p v-if="showMismatch" class="auth-pw-hint auth-pw-hint--mismatch">Passwords do not match.</p>
 *   <p v-else-if="showMatch" class="auth-pw-hint auth-pw-hint--match">Passwords match.</p>
 *
 * @param {() => string} getPassword  Getter for the primary password value.
 * @param {() => string} getConfirm   Getter for the confirm password value.
 * @returns {{ isMatch, isTouched, markTouched, reset, showMatch, showMismatch }}
 */
export function usePasswordMatch(getPassword, getConfirm) {
  const isTouched = ref(false);

  const isMatch = computed(() => getPassword() === getConfirm());

  const showMismatch = computed(
    () => isTouched.value && !isMatch.value,
  );

  const showMatch = computed(
    () => isTouched.value && isMatch.value && getConfirm().length > 0,
  );

  function markTouched() {
    isTouched.value = true;
  }

  function reset() {
    isTouched.value = false;
  }

  return { isMatch, isTouched, markTouched, reset, showMatch, showMismatch };
}
