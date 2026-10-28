/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { computed, getCurrentScope, nextTick, onScopeDispose, readonly, ref, watch } from 'vue';
import { fetchSession } from '../lib/auth-api.js';
import { fetchProviderStatus } from '../lib/provider-api.js';
import { readSavedProviderLink } from '../lib/provider-callback-feedback-policy.js';

const labels = { spotify: 'Spotify', youtube: 'YouTube' };

export function useProviderAuthorizationStatus({ getSession, fetchSessionFn = fetchSession,
  fetchStatusFn = fetchProviderStatus, canCheck = () => true, onObserved = () => {}, timeoutMs = 15_000 } = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) throw new TypeError('Invalid authorization status timeout');
  const provider = ref(null), state = ref('idle'), isChecking = ref(false), sessionBlocked = ref(false);
  let active = null, disposed = false;
  function actor() {
    const session = getSession();
    return session?.authenticated === true && typeof session.user?.id === 'string' && session.user.id.length > 0
      && session.user.role === 'admin' && session.user.mustChangePassword === false
      && typeof session.csrfToken === 'string' && session.csrfToken.length > 0
      ? { user: session.user, id: session.user.id, csrfToken: session.csrfToken } : null;
  }
  function owns(request) {
    const current = actor();
    return !disposed && active === request && current?.user === request.actor.user
      && current.id === request.actor.id && current.csrfToken === request.actor.csrfToken;
  }
  function invalidate() {
    const request = active; active = null; isChecking.value = false;
    if (request) { clearTimeout(request.timer); request.controller.abort(); }
  }
  function reset() {
    invalidate();
    if (sessionBlocked.value) state.value = 'session';
    else { provider.value = null; state.value = 'idle'; }
  }
  const stop = watch(() => {
    const session = getSession();
    return [session?.authenticated, session?.user, session?.user?.id, session?.user?.role, session?.user?.mustChangePassword, session?.csrfToken];
  }, () => { invalidate(); if (provider.value) { sessionBlocked.value = true; state.value = 'session'; } }, { flush: 'sync' });
  async function check() {
    if (disposed || active || !provider.value || !canCheck()) return false;
    const current = actor();
    if (!current) { sessionBlocked.value = true; state.value = 'session'; return false; }
    const request = { actor: current, provider: provider.value, controller: new AbortController(), timer: null, sessionVerified: false };
    active = request; isChecking.value = true; state.value = 'checking';
    request.timer = setTimeout(() => {
      if (!owns(request)) return;
      sessionBlocked.value = !request.sessionVerified; state.value = request.sessionVerified ? 'unknown' : 'session'; invalidate();
    }, timeoutMs);
    try {
      await nextTick(); if (!owns(request)) return false;
      const session = await fetchSessionFn({ signal: request.controller.signal });
      if (!owns(request)) return false;
      if (session?.user?.id !== current.id || session.user.role !== 'admin' || session.user.mustChangePassword !== false
        || session.csrfToken !== current.csrfToken) { sessionBlocked.value = true; state.value = 'session'; return false; }
      request.sessionVerified = true; sessionBlocked.value = false;
      const payload = await fetchStatusFn({ signal: request.controller.signal });
      if (!owns(request)) return false;
      const observation = readSavedProviderLink(payload, request.provider);
      if (observation === 'unknown') { state.value = 'unknown'; return false; }
      onObserved(request.provider, observation === 'present');
      if (!owns(request)) return false;
      state.value = observation; return true;
    } catch {
      if (owns(request)) { sessionBlocked.value = !request.sessionVerified; state.value = request.sessionVerified ? 'unknown' : 'session'; }
      return false;
    } finally {
      clearTimeout(request.timer);
      if (active === request) { active = null; isChecking.value = false; }
    }
  }
  function review(value) {
    if (disposed || !canCheck() || typeof value !== 'string' || !Object.hasOwn(labels, value)) return false;
    invalidate(); provider.value = value; return check();
  }
  function dispose() { disposed = true; invalidate(); stop(); provider.value = null; state.value = 'idle'; }
  if (getCurrentScope()) onScopeDispose(dispose);
  const feedback = computed(() => {
    if (!provider.value) return null;
    const label = labels[provider.value];
    const message = state.value === 'checking' ? `Checking saved ${label} link…`
      : state.value === 'present' ? `Last check found a saved ${label} link.`
        : state.value === 'absent' ? `Last check found no saved ${label} link.`
          : state.value === 'session' ? 'Current administrator session could not be confirmed. Use a current administrator session, then check saved status.'
            : `Saved ${label} link could not be checked. Try checking again.`;
    return { message, tone: ['unknown', 'session'].includes(state.value) ? 'warning' : 'info' };
  });
  return { provider: readonly(provider), feedback, isChecking: readonly(isChecking), sessionBlocked: readonly(sessionBlocked), check, review, reset, dispose };
}
