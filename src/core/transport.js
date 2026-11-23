/**
 * Lop giao tiep mang qua Userscript (GM_xmlhttpRequest) hoac Android Native WebView Bridge
 * giu nguyen phien IAM & VPN chinh chu.
 * Khi mo file preview.html doc lap, tu dong chay che do xem thu (Demo).
 */

const IAM_HOST_RE = /(iam|sso|login|auth|signin|oauth|cas)/i;
const LOGIN_PASSWORD_INPUT_RE = /<input[^>]+type\s*=\s*["']?password["']?/i;
const LOGIN_TITLE_RE = /<title[^>]*>[^<]*(iam|sign\s*in|đăng\s*nhập|login)[^<]*<\/title>/i;

let androidReqSeq = 0;

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
          status: 0,
          finalUrl: entry.url || '',
          responseText: '',
          responseHeaders: '',
          error: 'INVALID_BRIDGE_RESPONSE',
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
export async function checkPortalSession(portal, { checkUrlOverride = '' } = {}) {
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
