/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { computed, getCurrentScope, nextTick, onScopeDispose, readonly, ref } from 'vue';

const labels = { spotify: 'Spotify', youtube: 'YouTube' };

export function useProviderAuthorizationActions({ start, clear, redirectToUrl, canRun = () => true,
  onCleared = () => {}, onFeedback = () => {}, onAdmitted = () => {}, onReviewNeeded = () => {}, pageTarget = globalThis.window } = {}) {
  const pendingAction = ref(null), feedback = ref(null);
  let active = null, disposed = false;
  const owns = request => !disposed && active === request;
  function publish(value) { feedback.value = value; onFeedback(value); }
  function release(request) { if (owns(request)) { active = null; pendingAction.value = null; } }
  function clearFeedback() { if (!disposed && !active) publish(null); }
  function returned(event) {
    if (event.persisted !== true || !active || active.phase !== 'handoff' || disposed) return;
    const request = active;
    publish({ message: `Returned from ${labels[request.provider]} authorization. Review the saved link before starting again.`, tone: 'info' });
    release(request);
    if (!disposed) onReviewNeeded(request.provider);
  }
  async function run(provider, kind) {
    if (disposed || active || typeof provider !== 'string' || !Object.hasOwn(labels, provider)
      || !['start', 'clear'].includes(kind) || !canRun(provider, kind)) return false;
    const request = { provider, kind, phase: 'request' }, label = labels[provider];
    active = request; pendingAction.value = `${provider}_${kind}`;
    try {
      onAdmitted();
      publish({ message: `${label} authorization ${kind === 'start' ? 'is starting' : 'is being cleared'}…`, tone: 'info' });
      await nextTick();
      if (!owns(request)) return false;
      const payload = await (kind === 'start' ? start[provider]() : clear[provider]());
      if (!owns(request)) return false;
      if (kind === 'clear') {
        if (payload?.status?.linked !== false) throw new TypeError('Unconfirmed authorization clear');
        onCleared(provider, payload.status);
        if (!owns(request)) return false;
        publish({ message: `${label} authorization cleared.`, tone: 'success' });
        release(request); return true;
      }
      if (typeof payload?.authorizationUrl !== 'string' || !payload.authorizationUrl) throw new TypeError('Missing authorization URL');
      request.phase = 'handoff'; publish({ message: `Opening ${label} authorization…`, tone: 'info' });
      if (!owns(request)) return false;
      await redirectToUrl(payload.authorizationUrl);
      return owns(request);
    } catch {
      if (!owns(request)) return false;
      const message = request.phase === 'handoff'
        ? `${label} authorization could not be opened. Review Connections before trying again.`
        : `${label} authorization ${kind} could not be confirmed. Review Connections before trying again.`;
      publish({ message, tone: 'danger' }); release(request);
      if (!disposed) onReviewNeeded(provider);
      return false;
    }
  }
  function dispose() {
    disposed = true; active = null; pendingAction.value = null; feedback.value = null;
    pageTarget?.removeEventListener?.('pageshow', returned);
  }
  pageTarget?.addEventListener?.('pageshow', returned);
  if (getCurrentScope()) onScopeDispose(dispose);
  return { run, pendingAction: readonly(pendingAction), isPending: computed(() => pendingAction.value !== null),
    feedback: readonly(feedback), clearFeedback, dispose };
}
