/**
 * Diem khoi dong cua Remote Inside (tu dong chon che do Userscript tren trang FPT
 * hoac che do xem thu doc lap khi mo preview.html).
 */

import { mountRemoteInside } from './ui/app.js';

function bootstrapRemoteInside() {
  if (typeof document === 'undefined' || !document.body) {
    return;
  }

  const cssText =
    typeof __REMOTE_INSIDE_CSS__ !== 'undefined' ? __REMOTE_INSIDE_CSS__ : '';
  const standaloneRoot = document.getElementById('remote-inside-standalone');

  if (standaloneRoot) {
    mountRemoteInside({
      rootContainer: standaloneRoot,
      cssText,
      standalone: true,
      pageWindow: window,
      pageDocument: document,
    });
    return;
  }

  // Bo qua trang <frameset> goc va cac frame menu/tieu de nho
  if (document.body.tagName === 'FRAMESET') {
    return;
  }
  try {
    if (window.top !== window.self) {
      const pathLower = ((window.location && window.location.pathname) || '').toLowerCase();
      if (
        window.innerWidth < 240 ||
        window.innerHeight < 220 ||
        pathLower.startsWith('/public/partial/') ||
        pathLower.startsWith('/iptvinfo/')
      ) {
        return;
      }
    }
  } catch {
    // Bo qua loi cross-origin neu co
  }

  if (document.getElementById('remote-inside-host')) {
    return;
  }

  const host = document.createElement('div');
  host.id = 'remote-inside-host';
  document.body.appendChild(host);

  const isOuterShell =
    window.location &&
    window.location.hostname === 'inside.fpt.net' &&
    window.location.pathname.toLowerCase() === '/default.asp';

  const shadowRoot = host.attachShadow({ mode: 'open' });
  const app = mountRemoteInside({
    rootContainer: shadowRoot,
    cssText,
    standalone: false,
    fabPosition: isOuterShell ? 'bottom-left' : 'bottom-right',
    fabLabelDefault: isOuterShell ? 'Remote Inside (Khung ngoài)' : 'Remote Inside',
    pageWindow: typeof unsafeWindow !== 'undefined' ? unsafeWindow : window,
    pageDocument: document,
  });

  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('Mở Remote Inside', () => app.open());
  }

  if (window.location && window.location.hash === '#remote-inside') {
    app.open();
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapRemoteInside, { once: true });
  } else {
    bootstrapRemoteInside();
  }
}
