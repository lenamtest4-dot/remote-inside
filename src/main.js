/**
 * Diem khoi dong cua Remote Inside (tu dong chon che do Userscript tren trang FPT
 * hoac che do xem thu doc lap khi mo preview.html).
 */

import { normalizeContractId } from './config/portals.js';
import { parseRadiusOltFromText } from './adapters/inside.js';
import { mountRemoteInside } from './ui/app.js';

export function parseRemoteInsideHashIntent(rawHash) {
  const cleaned = String(rawHash || '').replace(/^#/, '').trim();
  if (!cleaned) {
    return { open: false, portalId: '', contractId: '' };
  }
  const tokens = cleaned.split('&').filter(Boolean);
  const head = String(tokens[0] || '').toLowerCase();
  if (head !== 'remote-inside' && head !== 'ri-open') {
    return { open: false, portalId: '', contractId: '' };
  }
  let portalId = '';
  let contractId = '';
  try {
    const params = new URLSearchParams(tokens.slice(1).join('&'));
    portalId = String(params.get('portal') || '').trim().toLowerCase();
    const rawContract = String(params.get('contract') || '').trim();
    if (rawContract) {
      contractId = normalizeContractId(rawContract);
    }
  } catch {
    // Bo qua tham so hash loi
  }
  return { open: true, portalId, contractId };
}

function startRadiusParamsBridge() {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !document.body) {
    return false;
  }
  const loc = window.location;
  const hostLower = ((loc && loc.hostname) || '').toLowerCase();
  const pathLower = ((loc && loc.pathname) || '').toLowerCase();

  let inFrame = false;
  try {
    inFrame = window.top !== window.self;
  } catch {
    inFrame = true;
  }

  if (
    !inFrame ||
    !hostLower.endsWith('radius-portal.fpt.net') ||
    !pathLower.startsWith('/public/partial/connection-parameters')
  ) {
    return false;
  }

  let objId = '';
  try {
    const sp = new URLSearchParams(loc.search || '');
    objId = sp.get('ObjID') || sp.get('objId') || sp.get('objid') || '';
  } catch {
    objId = '';
  }

  let lastKey = '';
  let observer = null;
  function tryPost() {
    try {
      const text = document.body.innerText || document.body.textContent || '';
      const parsed = parseRadiusOltFromText(text);
      if (!parsed || !parsed.oltPop) return;
      const nextKey = `${parsed.oltPop}|${parsed.slot}|${parsed.port}|${parsed.onu}|${parsed.ipOlt}`;
      if (nextKey === lastKey) return;
      lastKey = nextKey;
      if (window.parent && typeof window.parent.postMessage === 'function') {
        window.parent.postMessage(
          {
            type: 'RI_RADIUS_OLT_INFO',
            objId: String(objId || '').trim(),
            ...parsed,
          },
          '*'
        );
      }
      if (parsed.oltPop && parsed.ipOlt && observer) {
        observer.disconnect();
        observer = null;
      }
    } catch {
      // Bo qua loi doc/gui thong so tu iframe
    }
  }

  tryPost();

  if (typeof MutationObserver === 'function' && !(lastKey && !lastKey.endsWith('|'))) {
    observer = new MutationObserver(() => {
      tryPost();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    setTimeout(() => {
      try {
        if (observer) {
          observer.disconnect();
          observer = null;
        }
      } catch {
        // ignore
      }
    }, 10000);
  }

  return true;
}

function bootstrapRemoteInside() {
  if (typeof document === 'undefined' || !document.body) {
    return;
  }

  if (startRadiusParamsBridge()) {
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
  } else if (typeof GM !== 'undefined' && GM && typeof GM.registerMenuCommand === 'function') {
    GM.registerMenuCommand('Mở Remote Inside', () => app.open());
  }

  const hashIntent =
    window.location && window.location.hash
      ? parseRemoteInsideHashIntent(window.location.hash)
      : { open: false, portalId: '', contractId: '' };
  if (hashIntent.open) {
    app.open({ portalId: hashIntent.portalId, contractId: hashIntent.contractId });
    try {
      if (window.history && typeof window.history.replaceState === 'function') {
        window.history.replaceState(
          null,
          '',
          (window.location.pathname || '/') + (window.location.search || '')
        );
      }
    } catch {
      // Bo qua neu trinh duyet chan replaceState
    }
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapRemoteInside, { once: true });
  } else {
    bootstrapRemoteInside();
  }
}
