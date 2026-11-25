/**
 * Lop giao tiep mang qua Userscript (GM_xmlhttpRequest) hoac Android Native WebView Bridge
 * giu nguyen phien IAM & VPN chinh chu.
 * Khi mo file preview.html doc lap, tu dong chay che do xem thu (Demo).
 */

import { IAM_SSO_TARGETS } from '../config/portals.js';

const IAM_HOST_RE = /(iam|sso|login|auth|signin|oauth|cas)/i;
const LOGIN_PASSWORD_INPUT_RE = /<input[^>]+type\s*=\s*["']?password["']?/i;
const LOGIN_TITLE_RE = /<title[^>]*>[^<]*(iam|sign\s*in|đăng\s*nhập|login)[^<]*<\/title>/i;
const WARM_CACHE_TTL_MS = 25000;

let androidReqSeq = 0;
const warmCacheByHost = new Map();
const inFlightWarmByHost = new Map();

function getGmXhr() {
  if (typeof GM_xmlhttpRequest === 'function') {
    return GM_xmlhttpRequest;
  }
  if (typeof GM !== 'undefined' && GM && typeof GM.xmlHttpRequest === 'function') {
    return GM.xmlHttpRequest.bind(GM);
  }
  return null;
}

export function isAndroidAppEnv() {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.RemoteInsideNative) &&
    typeof window.RemoteInsideNative.httpRequest === 'function'
  );
}

export function getNativeAppPlatform() {
  if (!isAndroidAppEnv()) return '';
  try {
    if (
      window.RemoteInsideNative &&
      typeof window.RemoteInsideNative.getPlatform === 'function'
    ) {
      const p = String(window.RemoteInsideNative.getPlatform() || '').trim().toLowerCase();
      if (p === 'ios' || p === 'android') return p;
    }
    if (
      window.RemoteInsideNative &&
      typeof window.RemoteInsideNative.platform === 'string'
    ) {
      const p = window.RemoteInsideNative.platform.trim().toLowerCase();
      if (p === 'ios' || p === 'android') return p;
    }
  } catch {
    // ignore
  }
  return 'android';
}

export function isIosAppEnv() {
  return getNativeAppPlatform() === 'ios';
}

export function getRuntimeEnv() {
  if (isAndroidAppEnv()) {
    return getNativeAppPlatform() === 'ios' ? 'ios' : 'android';
  }
  if (getGmXhr()) {
    return 'userscript';
  }
  return 'preview';
}

export function isUserscriptEnv() {
  return Boolean(getGmXhr()) || isAndroidAppEnv();
}

export function openExternalOrPortalUrl(
  url,
  {
    mode = 'portal',
    title = '',
    pageWindow = typeof window !== 'undefined' ? window : null,
  } = {}
) {
  if (!url || typeof url !== 'string') {
    return false;
  }
  if (
    isAndroidAppEnv() &&
    typeof window.RemoteInsideNative.openPortal === 'function'
  ) {
    window.RemoteInsideNative.openPortal(
      String(url || ''),
      String(mode || 'portal'),
      String(title || '')
    );
    return true;
  }
  if (pageWindow && typeof pageWindow.open === 'function') {
    pageWindow.open(url, '_blank', 'noopener');
    return true;
  }
  return false;
}

function ensureNativePendingBridge() {
  if (typeof window === 'undefined') {
    return;
  }
  if (!window.__riNativePending || typeof window.__riNativePending.set !== 'function') {
    window.__riNativePending = new Map();
  }

  if (typeof window.__riNativeResolve !== 'function') {
    window.__riNativeResolve = (reqId, inlineRawJson) => {
      const pending = window.__riNativePending;
      const entry = pending && pending.get(reqId);
      if (!entry) {
        return;
      }
      pending.delete(reqId);
      if (entry.timer) {
        clearTimeout(entry.timer);
      }

      let rawJson = typeof inlineRawJson === 'string' ? inlineRawJson : '';
      if (!rawJson) {
        try {
          if (
            window.RemoteInsideNative &&
            typeof window.RemoteInsideNative.consumeResponse === 'function'
          ) {
            rawJson = window.RemoteInsideNative.consumeResponse(reqId) || '';
          }
        } catch {
          rawJson = '';
        }
      }

      let parsed = null;
      try {
        parsed = rawJson ? JSON.parse(rawJson) : null;
      } catch {
        parsed = null;
      }

      if (!parsed || typeof parsed !== 'object') {
        entry.resolve({
          ok: false,
          mode: 'android',
          status: entry.kind === 'warm' ? 'invalid_response' : 0,
          finalUrl: entry.url || '',
          responseText: '',
          responseHeaders: '',
          error: 'INVALID_BRIDGE_RESPONSE',
        });
        return;
      }

      if (
        entry.kind === 'warm' ||
        entry.kind === 'portal_bg' ||
        entry.kind === 'portal_eval' ||
        entry.kind === 'clipboard' ||
        typeof parsed.status === 'string'
      ) {
        entry.resolve({
          ok: Boolean(parsed.ok),
          mode: 'android',
          status: typeof parsed.status === 'string' ? parsed.status : parsed.ok ? 'ok' : 'error',
          finalUrl: String(parsed.finalUrl || entry.url || ''),
          sawAuth: Boolean(parsed.sawAuth),
          reused: Boolean(parsed.reused),
          value: parsed.value !== undefined ? parsed.value : null,
          error: parsed.error ? String(parsed.error) : undefined,
        });
        return;
      }

      entry.resolve({
        ok: Boolean(parsed.ok),
        mode: 'android',
        status: Number(parsed.status) || 0,
        finalUrl: String(parsed.finalUrl || entry.url || ''),
        responseText: String(parsed.responseText || ''),
        responseHeaders: String(parsed.responseHeaders || ''),
        error: parsed.error ? String(parsed.error) : undefined,
      });
    };
  }
}

function requestViaAndroidNative({
  url,
  method = 'GET',
  headers = {},
  data = null,
  timeout = 15000,
  useRadiusBearer = false,
} = {}) {
  if (typeof window === 'undefined' || !isAndroidAppEnv()) {
    return Promise.resolve({
      ok: false,
      mode: 'android',
      status: 0,
      finalUrl: url || '',
      responseText: '',
      error: 'BRIDGE_UNAVAILABLE',
    });
  }

  ensureNativePendingBridge();

  const reqId = `ri_${++androidReqSeq}_${Date.now()}`;
  const numericTimeout = Math.max(1000, Number(timeout) || 15000);

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (window.__riNativePending && window.__riNativePending.has(reqId)) {
        window.__riNativePending.delete(reqId);
        resolve({
          ok: false,
          mode: 'android',
          status: 0,
          finalUrl: url || '',
          responseText: '',
          responseHeaders: '',
          error: 'TIMEOUT',
        });
      }
    }, numericTimeout + 3000);

    window.__riNativePending.set(reqId, {
      kind: 'http',
      resolve,
      timer,
      url: url || '',
    });

    try {
      window.RemoteInsideNative.httpRequest(
        JSON.stringify({
          reqId,
          url: url || '',
          method: method || 'GET',
          headers: headers || {},
          data: data === null || data === undefined ? null : String(data),
          timeout: numericTimeout,
          useRadiusBearer: Boolean(useRadiusBearer),
        })
      );
    } catch (err) {
      if (window.__riNativePending) {
        window.__riNativePending.delete(reqId);
      }
      clearTimeout(timer);
      resolve({
        ok: false,
        mode: 'android',
        status: 0,
        finalUrl: url || '',
        responseText: '',
        responseHeaders: '',
        error: err && err.message ? err.message : 'REQUEST_FAILED',
      });
    }
  });
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function canWarmPortalSession() {
  return (
    isAndroidAppEnv() &&
    typeof window !== 'undefined' &&
    Boolean(window.RemoteInsideNative) &&
    typeof window.RemoteInsideNative.warmPortalSession === 'function'
  );
}

export function canControlAndroidPortal() {
  return (
    isAndroidAppEnv() &&
    typeof window !== 'undefined' &&
    Boolean(window.RemoteInsideNative) &&
    typeof window.RemoteInsideNative.loadPortalBackground === 'function' &&
    typeof window.RemoteInsideNative.evalPortalJs === 'function'
  );
}

export function showAndroidPortalOverlay(title = '') {
  if (
    !isAndroidAppEnv() ||
    typeof window === 'undefined' ||
    !window.RemoteInsideNative ||
    typeof window.RemoteInsideNative.showPortalOverlay !== 'function'
  ) {
    return false;
  }
  try {
    window.RemoteInsideNative.showPortalOverlay(String(title || ''));
    return true;
  } catch {
    return false;
  }
}

export function readNativeClipboardAsync({ timeout = 4000 } = {}) {
  if (
    !isAndroidAppEnv() ||
    typeof window === 'undefined' ||
    !window.RemoteInsideNative ||
    typeof window.RemoteInsideNative.readClipboardAsync !== 'function'
  ) {
    return Promise.resolve('');
  }

  ensureNativePendingBridge();
  const reqId = `ri_clip_${++androidReqSeq}_${Date.now()}`;
  const numericTimeout = Math.max(1000, Math.min(10000, Number(timeout) || 4000));

  return new Promise((resolve) => {
    const finish = (outcome) => {
      resolve(outcome && outcome.ok && outcome.value !== null && outcome.value !== undefined ? String(outcome.value) : '');
    };
    const timer = setTimeout(() => {
      if (window.__riNativePending && window.__riNativePending.has(reqId)) {
        window.__riNativePending.delete(reqId);
      }
      resolve('');
    }, numericTimeout);

    window.__riNativePending.set(reqId, {
      kind: 'clipboard',
      resolve: finish,
      timer,
      url: '',
    });

    try {
      window.RemoteInsideNative.readClipboardAsync(JSON.stringify({ reqId }));
    } catch {
      if (window.__riNativePending) {
        window.__riNativePending.delete(reqId);
      }
      clearTimeout(timer);
      resolve('');
    }
  });
}

export function loadAndroidPortalBackground(
  url,
  { reusePrefix = '', timeout = 18000 } = {}
) {
  if (!url || typeof url !== 'string') {
    return Promise.resolve({ ok: false, status: 'invalid_url', finalUrl: '' });
  }
  if (!canControlAndroidPortal()) {
    return Promise.resolve({ ok: false, status: 'unsupported', finalUrl: url });
  }

  ensureNativePendingBridge();
  const reqId = `ri_pbg_${++androidReqSeq}_${Date.now()}`;
  const numericTimeout = Math.max(3000, Math.min(30000, Number(timeout) || 18000));

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (window.__riNativePending && window.__riNativePending.has(reqId)) {
        window.__riNativePending.delete(reqId);
      }
      resolve({ ok: false, status: 'timeout', finalUrl: url });
    }, numericTimeout + 4000);

    window.__riNativePending.set(reqId, {
      kind: 'portal_bg',
      resolve,
      timer,
      url,
    });

    try {
      window.RemoteInsideNative.loadPortalBackground(
        JSON.stringify({
          reqId,
          url,
          reusePrefix: String(reusePrefix || ''),
          timeout: numericTimeout,
        })
      );
    } catch (err) {
      if (window.__riNativePending) {
        window.__riNativePending.delete(reqId);
      }
      clearTimeout(timer);
      resolve({
        ok: false,
        status: 'error',
        finalUrl: url,
        error: err && err.message ? err.message : 'PORTAL_BG_FAILED',
      });
    }
  });
}

export function evalAndroidPortalJs(script, { timeout = 8000 } = {}) {
  if (!script || typeof script !== 'string') {
    return Promise.resolve({ ok: false, status: 'empty_script', value: null });
  }
  if (!canControlAndroidPortal()) {
    return Promise.resolve({ ok: false, status: 'unsupported', value: null });
  }

  ensureNativePendingBridge();
  const reqId = `ri_peval_${++androidReqSeq}_${Date.now()}`;
  const numericTimeout = Math.max(1000, Math.min(20000, Number(timeout) || 8000));

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (window.__riNativePending && window.__riNativePending.has(reqId)) {
        window.__riNativePending.delete(reqId);
      }
      resolve({ ok: false, status: 'timeout', value: null });
    }, numericTimeout + 2000);

    window.__riNativePending.set(reqId, {
      kind: 'portal_eval',
      resolve,
      timer,
      url: '',
    });

    try {
      window.RemoteInsideNative.evalPortalJs(
        JSON.stringify({
          reqId,
          script,
        })
      );
    } catch (err) {
      if (window.__riNativePending) {
        window.__riNativePending.delete(reqId);
      }
      clearTimeout(timer);
      resolve({
        ok: false,
        status: 'error',
        value: null,
        error: err && err.message ? err.message : 'PORTAL_EVAL_FAILED',
      });
    }
  });
}

export const FOX_ERP_HOME_URL = 'https://fox-erp.fpt.net/';

export const NEXTGEN_FOX_APPS = Object.freeze({
  equipment: {
    appCode: 'FTEL.RE',
    host: 'https://nextgen.fpt.net',
    path: '/resource/equipment',
  },
  recall: {
    appCode: 'FTEL.REM',
    host: 'https://nextgen.fpt.net',
    path: '/resource/recall',
  },
});

export function isNextGenSessionExpiredDocument(doc) {
  if (!doc) return false;
  const titleText = String(doc.title || '');
  if (/phiên đăng nhập.*hết hạn/i.test(titleText)) {
    return true;
  }
  const body = doc.body || null;
  const bodyText = body ? String(body.innerText !== undefined ? body.innerText : body.textContent || '') : '';
  return /phiên đăng nhập đã hết hạn|bắt buộc phải vào ứng dụng[\s\S]{0,60}trên fox-erp/i.test(
    bodyText
  );
}

function encodeBase64Utf8(str) {
  const s = String(str || '');
  if (typeof btoa === 'function') {
    try {
      return btoa(s);
    } catch {
      return btoa(unescape(encodeURIComponent(s)));
    }
  }
  if (typeof Buffer === 'function') {
    return Buffer.from(s, 'utf8').toString('base64');
  }
  return '';
}

export function buildFoxErpNextGenLaunchUrlFromStorage(appKey, storageObj = null) {
  const app = NEXTGEN_FOX_APPS[appKey] || null;
  if (!app) {
    return { ok: false, error: 'Ứng dụng NextGen không hợp lệ.' };
  }
  let rawAuth = '';
  try {
    const store = storageObj || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (store && typeof store.getItem === 'function') {
      rawAuth = store.getItem('auth') || '';
    }
  } catch {
    rawAuth = '';
  }
  if (!rawAuth) {
    return { ok: false, error: 'Chưa có phiên đăng nhập Fox-ERP trong localStorage.' };
  }
  let parsed = null;
  try {
    parsed = JSON.parse(rawAuth);
  } catch {
    parsed = null;
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'Dữ liệu phiên Fox-ERP không hợp lệ.' };
  }
  const sessionCode = String(parsed.sessionCode || parsed.currentSession || '').trim();
  const userName = String(
    (parsed.currentUser && parsed.currentUser.userName) || ''
  ).trim();
  const bearerToken = String(
    parsed.currentToken ||
      parsed.accessToken ||
      (parsed.currentUser && parsed.currentUser.accessToken) ||
      ''
  ).trim();

  if (!sessionCode || !userName) {
    return { ok: false, error: 'Fox-ERP chưa sẵn sàng SessionCode hoặc UserName.' };
  }

  const encoded = encodeBase64Utf8(
    JSON.stringify({
      SessionCode: sessionCode,
      AppCode: app.appCode,
      UserName: userName,
    })
  );
  if (!encoded) {
    return { ok: false, error: 'Không mã hóa được SessionCode sang Base64.' };
  }

  return {
    ok: true,
    url: `${app.host}${app.path}/?SessionCode=${encoded}`,
    appCode: app.appCode,
    bearerToken,
  };
}

export async function triggerFoxErpPushUserSession(appCode, bearerToken = '', fetchFn = null) {
  const cleanCode = String(appCode || '').trim().toUpperCase();
  if (!cleanCode) return false;
  const doFetch =
    typeof fetchFn === 'function'
      ? fetchFn
      : typeof fetch === 'function'
      ? fetch
      : null;
  if (!doFetch) return false;

  const headers = { 'Content-Type': 'application/json' };
  if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`;
  }
  try {
    await doFetch(`${FOX_ERP_HOME_URL}gateway/center/UserSession/PushUserSession`, {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
      headers,
      body: JSON.stringify({ appCode: cleanCode }),
    });
    return true;
  } catch {
    return false;
  }
}

export async function bootstrapNextGenViaFoxErpAndroid(
  appKey,
  { onProgress = null } = {}
) {
  const app = NEXTGEN_FOX_APPS[appKey] || null;
  if (!app || !canControlAndroidPortal()) {
    return { ok: false, status: 'unsupported', loginUrl: FOX_ERP_HOME_URL };
  }

  const notify = (msg) => {
    if (typeof onProgress === 'function' && msg) {
      onProgress(msg);
    }
  };

  notify('Đang xin cấp phiên mới từ Fox-ERP…');
  let foxBg = await loadAndroidPortalBackground(FOX_ERP_HOME_URL, { timeout: 18000 });
  if (!foxBg.ok && foxBg.status === 'needs_login') {
    notify('Đang đồng bộ IAM cho Fox-ERP…');
    const warmRes = await warmPortalSession(FOX_ERP_HOME_URL, { timeout: 12000, force: true });
    if (warmRes.ok) {
      foxBg = await loadAndroidPortalBackground(FOX_ERP_HOME_URL, { timeout: 18000 });
    }
  }
  if (!foxBg.ok) {
    return {
      ok: false,
      status: foxBg.status === 'needs_login' ? 'needs_login' : 'error',
      loginUrl: FOX_ERP_HOME_URL,
      error: 'Phiên IAM trên Fox-ERP đã hết hạn.',
    };
  }

  let launchInfo = null;
  const deadline = Date.now() + 7000;
  while (Date.now() < deadline) {
    const evalRes = await evalAndroidPortalJs(`
      var rawAuth = '';
      try { rawAuth = localStorage.getItem('auth') || ''; } catch (e) { rawAuth = ''; }
      if (!rawAuth) return { ready: false };
      var a = null;
      try { a = JSON.parse(rawAuth); } catch (e) { a = null; }
      var sc = a && (a.sessionCode || a.currentSession) ? String(a.sessionCode || a.currentSession).trim() : '';
      var un = a && a.currentUser && a.currentUser.userName ? String(a.currentUser.userName).trim() : '';
      var tk = a ? String(a.currentToken || a.accessToken || (a.currentUser && a.currentUser.accessToken) || '').trim() : '';
      if (!sc || !un) return { ready: false };
      var payload = JSON.stringify({ SessionCode: sc, AppCode: ${JSON.stringify(app.appCode)}, UserName: un });
      var enc = '';
      try { enc = btoa(payload); } catch (e) { enc = btoa(unescape(encodeURIComponent(payload))); }
      try {
        var hdrs = { 'Content-Type': 'application/json' };
        if (tk) hdrs.Authorization = 'Bearer ' + tk;
        fetch(${JSON.stringify(`${FOX_ERP_HOME_URL}gateway/center/UserSession/PushUserSession`)}, {
          method: 'POST',
          credentials: 'include',
          keepalive: true,
          headers: hdrs,
          body: JSON.stringify({ appCode: ${JSON.stringify(app.appCode)} })
        }).catch(function() {});
      } catch (e) {}
      return { ready: true, url: ${JSON.stringify(`${app.host}${app.path}/?SessionCode=`)} + enc };
    `);
    if (evalRes.status === 'needs_login') {
      return {
        ok: false,
        status: 'needs_login',
        loginUrl: FOX_ERP_HOME_URL,
        error: 'Phiên IAM trên Fox-ERP đã hết hạn.',
      };
    }
    if (evalRes.ok && evalRes.value && evalRes.value.ready && evalRes.value.url) {
      launchInfo = evalRes.value;
      break;
    }
    await sleep(300);
  }

  if (!launchInfo || !launchInfo.url) {
    return {
      ok: false,
      status: 'needs_login',
      loginUrl: FOX_ERP_HOME_URL,
      error: 'Fox-ERP chưa sẵn sàng SessionCode để mở NextGen.',
    };
  }

  notify('Đang mở lại NextGen bằng phiên vừa cấp…');
  await sleep(300);
  const nextRes = await loadAndroidPortalBackground(launchInfo.url, { timeout: 20000 });
  return nextRes;
}

export function clearWarmSessionCache() {
  warmCacheByHost.clear();
}

export function warmPortalSession(
  url,
  { timeout = 12000, force = false, targetHost = '' } = {}
) {
  if (!url || typeof url !== 'string') {
    return Promise.resolve({ ok: false, status: 'invalid_url', finalUrl: '' });
  }
  if (!canWarmPortalSession()) {
    return Promise.resolve({ ok: false, status: 'unsupported', finalUrl: url });
  }

  const normalizedTargetHost = String(targetHost || '').trim().toLowerCase();
  const host = normalizedTargetHost || extractHost(url);
  if (!host) {
    return Promise.resolve({ ok: false, status: 'invalid_url', finalUrl: url });
  }

  if (!force) {
    const cached = warmCacheByHost.get(host);
    if (cached && Date.now() - cached.at < WARM_CACHE_TTL_MS) {
      return Promise.resolve({ ...cached, cached: true });
    }
  }

  const existingInFlight = inFlightWarmByHost.get(host);
  if (existingInFlight) {
    return existingInFlight;
  }

  ensureNativePendingBridge();
  const reqId = `ri_warm_${++androidReqSeq}_${Date.now()}`;
  const numericTimeout = Math.max(3000, Math.min(20000, Number(timeout) || 12000));

  const promise = new Promise((resolve) => {
    const finish = (outcome) => {
      const normalized = {
        ok: Boolean(outcome && outcome.ok),
        status: String((outcome && outcome.status) || 'error'),
        finalUrl: String((outcome && outcome.finalUrl) || url),
        sawAuth: Boolean(outcome && outcome.sawAuth),
        at: Date.now(),
      };
      warmCacheByHost.set(host, normalized);
      inFlightWarmByHost.delete(host);
      resolve(normalized);
    };

    const timer = setTimeout(() => {
      if (window.__riNativePending && window.__riNativePending.has(reqId)) {
        window.__riNativePending.delete(reqId);
      }
      finish({ ok: false, status: 'timeout', finalUrl: url });
    }, numericTimeout + 4000);

    window.__riNativePending.set(reqId, {
      kind: 'warm',
      resolve: finish,
      timer,
      url,
    });

    try {
      window.RemoteInsideNative.warmPortalSession(
        JSON.stringify({
          reqId,
          url,
          targetHost: normalizedTargetHost,
          timeout: numericTimeout,
        })
      );
    } catch {
      if (window.__riNativePending) {
        window.__riNativePending.delete(reqId);
      }
      clearTimeout(timer);
      finish({ ok: false, status: 'error', finalUrl: url });
    }
  });

  inFlightWarmByHost.set(host, promise);
  return promise;
}

export async function syncIamSsoSessions({
  targets = IAM_SSO_TARGETS,
  skipHost = '',
  force = true,
  onProgress = null,
  afterTarget = null,
} = {}) {
  const list = Array.isArray(targets) ? targets : [];
  const normalizedSkip = String(skipHost || '').trim().toLowerCase();
  if (force) {
    clearWarmSessionCache();
  }

  const okTargets = [];
  const needsLoginTargets = [];
  const offlineTargets = [];
  const results = [];

  for (let i = 0; i < list.length; i++) {
    const target = list[i];
    if (!target || !target.url) continue;
    const targetHost = extractHost(target.url);
    const matchesSkip =
      Boolean(normalizedSkip) &&
      (targetHost === normalizedSkip || targetHost.endsWith(`.${normalizedSkip}`));

    let res;
    if (matchesSkip) {
      res = { ok: true, status: 'already_signed_in', finalUrl: target.url, skipped: true };
    } else {
      res = await warmPortalSession(target.url, { timeout: 12000, force });
    }

    if (res.ok && typeof afterTarget === 'function') {
      try {
        const hookRes = await afterTarget(target, res);
        if (hookRes && hookRes.ok === false) {
          res = {
            ...res,
            ok: false,
            status: String(hookRes.status || 'needs_login'),
            loginUrl: hookRes.loginUrl || target.loginUrl || target.url,
          };
        }
      } catch {
        // ignore follow-up hook errors so remaining SSO targets still sync
      }
    }

    if (res.ok) {
      okTargets.push(target);
    } else if (res.status === 'network_error' || res.status === 'timeout' || res.status === 'ssl_error') {
      offlineTargets.push(target);
    } else {
      needsLoginTargets.push(target);
    }

    results.push({ target, res });
    if (typeof onProgress === 'function') {
      try {
        onProgress({ index: i + 1, total: list.length, target, res });
      } catch {
        // ignore UI callback errors
      }
    }
  }

  return { okTargets, needsLoginTargets, offlineTargets, results };
}

function extractHost(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return '';
  }
  try {
    return new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Nhan dien tinh huong trang noi bo tra ve man hinh dang nhap IAM hoac bi tu choi quyen.
 */
export function detectIamRedirect({
  status = 0,
  finalUrl = '',
  responseText = '',
  requestedUrl = '',
} = {}) {
  if (status === 401 || status === 403) {
    return {
      expired: true,
      reason: `Máy chủ trả về mã ${status} (cần đăng nhập lại IAM).`,
    };
  }

  const reqHost = extractHost(requestedUrl);
  const resHost = extractHost(finalUrl);

  if (reqHost && resHost && reqHost !== resHost && IAM_HOST_RE.test(resHost)) {
    return {
      expired: true,
      reason: `Trang đã chuyển hướng sang cổng đăng nhập (${resHost}).`,
    };
  }

  if (/\/LoginPage\.aspx(?:\?|$|#)/i.test(finalUrl)) {
    return {
      expired: true,
      reason: 'Trang đã chuyển hướng về màn hình đăng nhập (LoginPage.aspx).',
    };
  }

  if (typeof responseText === 'string' && responseText.length > 0) {
    const isPortLoggedInFrameset =
      /<frameset\b/i.test(responseText) &&
      /LeftMenu\.aspx/i.test(responseText) &&
      !LOGIN_PASSWORD_INPUT_RE.test(responseText);
    if (
      LOGIN_PASSWORD_INPUT_RE.test(responseText) ||
      (!isPortLoggedInFrameset && LOGIN_TITLE_RE.test(responseText))
    ) {
      return {
        expired: true,
        reason: 'Phát hiện màn hình đăng nhập IAM trong phản hồi.',
      };
    }
  }

  return { expired: false, reason: '' };
}

/**
 * Gui yeu cau HTTP bang Android Native Bridge hoac GM_xmlhttpRequest (khong bi chan CORS giua 5 trang FPT).
 */
export function requestPortal({
  url,
  method = 'GET',
  headers = {},
  data = null,
  timeout = 15000,
  useRadiusBearer = false,
} = {}) {
  if (isAndroidAppEnv()) {
    return requestViaAndroidNative({ url, method, headers, data, timeout, useRadiusBearer });
  }

  const gmXhr = getGmXhr();
  if (!gmXhr) {
    return Promise.resolve({
      ok: false,
      mode: 'preview',
      status: 0,
      finalUrl: url || '',
      responseText: '',
      error: 'PREVIEW_MODE',
    });
  }

  return new Promise((resolve) => {
    let settled = false;
    const settle = (val) => {
      if (settled) return;
      settled = true;
      resolve(val);
    };
    try {
      const maybePromise = gmXhr({
        method,
        url,
        headers,
        data,
        timeout,
        anonymous: false,
        onload(res) {
          settle({
            ok: res.status >= 200 && res.status < 400,
            mode: 'userscript',
            status: res.status,
            finalUrl: res.finalUrl || url,
            responseText: res.responseText || '',
            responseHeaders: res.responseHeaders || '',
          });
        },
        onerror() {
          settle({
            ok: false,
            mode: 'userscript',
            status: 0,
            finalUrl: url,
            responseText: '',
            error: 'NETWORK_ERROR',
          });
        },
        ontimeout() {
          settle({
            ok: false,
            mode: 'userscript',
            status: 0,
            finalUrl: url,
            responseText: '',
            error: 'TIMEOUT',
          });
        },
      });
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then(
          (res) => {
            if (res && typeof res.status === 'number') {
              settle({
                ok: res.status >= 200 && res.status < 400,
                mode: 'userscript',
                status: res.status,
                finalUrl: res.finalUrl || url,
                responseText: res.responseText || '',
                responseHeaders: res.responseHeaders || '',
              });
            }
          },
          (err) => {
            settle({
              ok: false,
              mode: 'userscript',
              status: 0,
              finalUrl: url,
              responseText: '',
              error: err && err.message ? err.message : 'NETWORK_ERROR',
            });
          }
        );
      }
    } catch (err) {
      settle({
        ok: false,
        mode: 'userscript',
        status: 0,
        finalUrl: url,
        responseText: '',
        error: err && err.message ? err.message : 'REQUEST_FAILED',
      });
    }
  });
}

/**
 * Kiem tra nhanh tinh trang ket noi VPN & phien dang nhap IAM cua 1 cong cu.
 */
export async function checkPortalSession(
  portal,
  { checkUrlOverride = '', allowSsoWarmup = true } = {}
) {
  if (!portal || !portal.url) {
    return {
      state: 'offline',
      label: 'Chưa rõ cổng',
      loginUrl: '',
      detail: 'Không tìm thấy đường dẫn cổng nội bộ.',
    };
  }

  if (!isUserscriptEnv()) {
    return {
      state: 'demo',
      label: 'Chế độ xem thử',
      loginUrl: portal.url,
      detail: 'Đang chạy thử cục bộ trên máy (chưa gắn Tampermonkey).',
    };
  }

  const checkUrl = checkUrlOverride || portal.sessionCheckUrl || portal.url;
  const res = await requestPortal({ url: checkUrl, method: 'GET', timeout: 10000 });

  if (res.error === 'NETWORK_ERROR' || res.error === 'TIMEOUT' || res.status === 0) {
    return {
      state: 'offline',
      label: 'Chưa thông mạng',
      loginUrl: portal.url,
      detail: `Không chạm tới được ${portal.fullName}. Hãy kiểm tra VPN công ty đã bật chưa.`,
    };
  }

  const iamCheck = detectIamRedirect({
    status: res.status,
    finalUrl: res.finalUrl,
    responseText: res.responseText,
    requestedUrl: checkUrl,
  });

  if (iamCheck.expired) {
    if (allowSsoWarmup && portal.iamSso && canWarmPortalSession()) {
      const warm = await warmPortalSession(portal.url, { timeout: 12000 });
      if (warm && warm.ok) {
        const retryRes = await requestPortal({ url: checkUrl, method: 'GET', timeout: 10000 });
        if (retryRes && retryRes.status >= 200 && retryRes.status < 400) {
          const retryIam = detectIamRedirect({
            status: retryRes.status,
            finalUrl: retryRes.finalUrl,
            responseText: retryRes.responseText,
            requestedUrl: checkUrl,
          });
          if (!retryIam.expired) {
            return {
              state: 'ok',
              label: 'IAM ổn',
              loginUrl: portal.url,
              detail: `Đã tự động đồng bộ phiên IAM cho ${portal.fullName}.`,
            };
          }
        }
      }
    }
    return {
      state: 'iam_expired',
      label: 'Cần đăng nhập IAM',
      loginUrl: portal.loginUrl || portal.url,
      detail: iamCheck.reason,
    };
  }

  if (res.status >= 200 && res.status < 400) {
    return {
      state: 'ok',
      label: 'IAM ổn',
      loginUrl: portal.url,
      detail: `Đã kết nối tốt tới ${portal.fullName} qua VPN & IAM.`,
    };
  }

  return {
    state: 'offline',
    label: `Lỗi HTTP ${res.status}`,
    loginUrl: portal.url,
    detail: `Cổng ${portal.fullName} phản hồi mã ${res.status}.`,
  };
}
