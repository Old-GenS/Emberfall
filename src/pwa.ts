import { registerSW } from 'virtual:pwa-register';

type InitPwaOptions = { isBusy: () => boolean };

/**
 * Registers the service worker and owns the two small PWA toasts.
 * Updates never reload on their own: only the Reload button calls updateSW(true).
 */
export function initPwa(opts: InitPwaOptions): void {
  let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;
  let pendingUpdate = false;
  let pollId = 0;
  let offlineShown = false;
  let toast: HTMLElement | null = null;

  const clearPoll = (): void => {
    if (pollId) {
      window.clearInterval(pollId);
      pollId = 0;
    }
  };

  const removeToast = (): void => {
    toast?.remove();
    toast = null;
  };

  const mountToast = (kind: 'update' | 'offline', html: string): HTMLElement => {
    removeToast();
    const el = document.createElement('div');
    el.className = 'pwa-toast';
    el.dataset.kind = kind;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = html;
    toast = el;
    document.body.appendChild(el);
    return el;
  };

  const showOfflineReady = (): void => {
    if (offlineShown) return;
    offlineShown = true;
    if (toast) return; // never stomp a pending update prompt
    const el = mountToast('offline', '<span class="pwa-toast-text">Emberfall is ready to play offline</span>');
    window.setTimeout(() => {
      if (toast === el) removeToast();
    }, 4000);
  };

  const showUpdateToast = (): void => {
    const el = mountToast(
      'update',
      '<span class="pwa-toast-text">A new version of Emberfall is ready.</span>' +
        '<button class="pwa-toast-action" type="button" data-pwa="reload">Reload</button>' +
        '<button class="pwa-toast-close" type="button" data-pwa="dismiss" aria-label="Dismiss">\u2715</button>',
    );
    el.querySelector<HTMLButtonElement>('[data-pwa="reload"]')?.addEventListener('click', () => {
      void updateSW?.(true);
    });
    el.querySelector<HTMLButtonElement>('[data-pwa="dismiss"]')?.addEventListener('click', () => {
      pendingUpdate = false;
      clearPoll();
      if (toast === el) removeToast();
    });
  };

  const checkForUpdatePrompt = (): void => {
    if (!pendingUpdate) {
      clearPoll();
      return;
    }
    if (opts.isBusy()) {
      // A battle is on screen; wait it out and check again every couple of seconds.
      if (!pollId) pollId = window.setInterval(checkForUpdatePrompt, 2000);
      return;
    }
    clearPoll();
    if (toast?.dataset.kind === 'update') return;
    showUpdateToast();
  };

  const onNeedRefresh = (): void => {
    pendingUpdate = true;
    checkForUpdatePrompt();
  };

  updateSW = registerSW({
    immediate: true,
    onNeedRefresh,
    onOfflineReady: showOfflineReady,
  });

  if (location.search.includes('debug=1')) {
    (window as unknown as Record<string, unknown>).__emberfallPwa = {
      needRefresh: onNeedRefresh,
      offlineReady: showOfflineReady,
    };
  }
}
