/**
 * Lop giao tiep mang qua Userscript (GM_xmlhttpRequest) giu nguyen phien IAM & VPN chinh chu.
 * Khi mo file preview.html doc lap, tu dong chay che do xem thu (Demo).
 */

const IAM_HOST_RE = /(iam|sso|login|auth|signin|oauth|cas)/i;
const LOGIN_PASSWORD_INPUT_RE = /<input[^>]+type\s*=\s*["']?password["']?/i;
const LOGIN_TITLE_RE = /<title[^>]*>[^<]*(iam|sign\s*in|đăng\s*nhập|login)[^<]*<\/title>/i;

export function isUserscriptEnv() {
  return typeof GM_xmlhttpRequest === 'function';
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

  if (typeof responseText === 'string' && responseText.length > 0) {
    if (LOGIN_PASSWORD_INPUT_RE.test(responseText) || LOGIN_TITLE_RE.test(responseText)) {
      return {
        expired: true,
        reason: 'Phát hiện màn hình đăng nhập IAM trong phản hồi.',
      };
    }
  }

  return { expired: false, reason: '' };
}

/**
 * Gui yeu cau HTTP bang GM_xmlhttpRequest (khong bi chan CORS giua 5 trang FPT).
 */
export function requestPortal({
  url,
  method = 'GET',
  headers = {},
  data = null,
  timeout = 15000,
} = {}) {
  if (!isUserscriptEnv()) {
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
export async function checkPortalSession(portal) {
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

  const checkUrl = portal.sessionCheckUrl || portal.url;
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
      loginUrl: res.finalUrl || portal.url,
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
