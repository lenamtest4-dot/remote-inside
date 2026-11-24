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

export function isAndroidAppEnv() {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.RemoteInsideNative) &&
    typeof window.RemoteInsideNative.httpRequest === 'function'
  );
}

export function getRuntimeEnv() {
  if (isAndroidAppEnv()) {
    return 'android';
  }
  if (typeof GM_xmlhttpRequest === 'function') {
    return 'userscript';
  }
  return 'preview';
}

export function isUserscriptEnv() {
  return typeof GM_xmlhttpRequest === 'function' || isAndroidAppEnv();
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

export function clearWarmSessionCache() {
  warmCacheByHost.clear();
}

export function warmPortalSession(url, { timeout = 12000, force = false } = {}) {
  if (!url || typeof url !== 'string') {
    return Promise.resolve({ ok: false, status: 'invalid_url', finalUrl: '' });
  }
  if (!canWarmPortalSession()) {
    return Promise.resolve({ ok: false, status: 'unsupported', finalUrl: url });
  }

  const host = extractHost(url);
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
        await afterTarget(target, res);
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
} = {}) {
  if (isAndroidAppEnv()) {
    return requestViaAndroidNative({ url, method, headers, data, timeout });
  }

  if (typeof GM_xmlhttpRequest !== 'function') {
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
    try {
      GM_xmlhttpRequest({
        method,
        url,
        headers,
        data,
        timeout,
        anonymous: false,
        onload(res) {
          resolve({
            ok: res.status >= 200 && res.status < 400,
            mode: 'userscript',
            status: res.status,
            finalUrl: res.finalUrl || url,
            responseText: res.responseText || '',
            responseHeaders: res.responseHeaders || '',
          });
        },
        onerror() {
          resolve({
            ok: false,
            mode: 'userscript',
            status: 0,
            finalUrl: url,
            responseText: '',
            error: 'NETWORK_ERROR',
          });
        },
        ontimeout() {
          resolve({
            ok: false,
            mode: 'userscript',
            status: 0,
            finalUrl: url,
            responseText: '',
            error: 'TIMEOUT',
          });
        },
      });
    } catch (err) {
      resolve({
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
      loginUrl: portal.url,
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
