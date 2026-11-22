/**
 * Cong cu Quet cau truc trang & Ghi mau thao tac mang an toan.
 * Tu dong an mat khau, cookie, token va thong tin ca nhan khach hang ([REDACTED]).
 */

export const SENSITIVE_HEADER_RE =
  /^(authorization|cookie|set-cookie|x-csrf-token|x-xsrf-token|x-auth-token|api-key|x-api-key|proxy-authorization)$/i;

export const SENSITIVE_KEY_RE =
  /(pass|pwd|secret|token|cookie|auth|otp|pin|phone|mobile|sdt|tel|cmnd|cccd|id_card|identity|email|mail|address|dia_chi|customer_name|fullname|ho_ten|ten_kh)/i;

const SAFE_TECHNICAL_KEY_RE = /^(mac|ip|port|olt|onu)_?address$|mapping/i;

function isSensitiveKey(key) {
  const k = String(key || '');
  if (SAFE_TECHNICAL_KEY_RE.test(k)) {
    return false;
  }
  return SENSITIVE_KEY_RE.test(k);
}

const OPS_KEYWORD_RE =
  /(mac|reset|kill|session|osp|port|ipnat|ipv6|tra|tìm|search|thu\s*hồi|camera|clear|submit|cấp|xem|kiểm\s*tra|cập\s*nhật)/i;

const MAX_STR_LEN = 80;
const MAX_CONTROLS = 80;
const MAX_RECORDED_REQUESTS = 40;

function truncateStr(str, maxLen = MAX_STR_LEN) {
  if (typeof str !== 'string') {
    return str;
  }
  if (str.length <= maxLen) {
    return str;
  }
  return str.slice(0, maxLen) + '…';
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceContractToken(str, contractId) {
  if (typeof str !== 'string') {
    return str;
  }
  let out = str;
  if (contractId && contractId.length >= 4) {
    const re = new RegExp(escapeRegExp(contractId), 'gi');
    out = out.replace(re, '<CONTRACT_ID>');
  }
  // An chuoi co dang Bearer token hoac session dai bat thuong
  out = out.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]');
  return truncateStr(out);
}

/**
 * Loai bo hoan toan cac header xac thuc nhay cam.
 */
export function redactHeaders(headers) {
  if (!headers || typeof headers !== 'object') {
    return {};
  }
  const safe = {};
  const entries =
    typeof headers.entries === 'function'
      ? Array.from(headers.entries())
      : Object.entries(headers);

  for (const [k, v] of entries) {
    const key = String(k || '').trim();
    if (!key || SENSITIVE_HEADER_RE.test(key)) {
      continue;
    }
    safe[key] = truncateStr(String(v ?? ''));
  }
  return safe;
}

/**
 * Lam sach du lieu gui len (JSON, URLSearchParams, hoac Object/Array).
 */
export function redactPayload(input, contractId = '', depth = 0) {
  if (input === null || input === undefined) {
    return null;
  }
  if (depth > 6) {
    return '[MAX_DEPTH]';
  }

  if (typeof URLSearchParams !== 'undefined' && input instanceof URLSearchParams) {
    const out = {};
    for (const [k, v] of input.entries()) {
      out[k] = isSensitiveKey(k) ? '[REDACTED]' : replaceContractToken(v, contractId);
    }
    return out;
  }

  if (typeof FormData !== 'undefined' && input instanceof FormData) {
    const out = {};
    for (const [k, v] of input.entries()) {
      out[k] = isSensitiveKey(k)
        ? '[REDACTED]'
        : typeof v === 'string'
        ? replaceContractToken(v, contractId)
        : '[FILE]';
    }
    return out;
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) {
      return '';
    }
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        return redactPayload(JSON.parse(trimmed), contractId, depth + 1);
      } catch {
        // Fallback xu ly nhu chuoi thuong
      }
    }
    if (trimmed.includes('=') && !trimmed.includes('<')) {
      try {
        const params = new URLSearchParams(trimmed);
        const out = {};
        let hasAny = false;
        for (const [k, v] of params.entries()) {
          hasAny = true;
          out[k] = isSensitiveKey(k)
            ? '[REDACTED]'
            : replaceContractToken(v, contractId);
        }
        if (hasAny) {
          return out;
        }
      } catch {
        // Bo qua neu khong phai query string
      }
    }
    return replaceContractToken(trimmed, contractId);
  }

  if (Array.isArray(input)) {
    return input.slice(0, 10).map((item) => redactPayload(item, contractId, depth + 1));
  }

  if (typeof input === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(input)) {
      if (isSensitiveKey(k)) {
        out[k] = '[REDACTED]';
      } else if (typeof v === 'string') {
        out[k] = replaceContractToken(v, contractId);
      } else {
        out[k] = redactPayload(v, contractId, depth + 1);
      }
    }
    return out;
  }

  return input;
}

/**
 * Tom tat cau truc phan hoi (chi giu ten truong JSON hoac marker HTML an toan, khong giu PII).
 */
export function redactResponseStructure(bodyText, contentType = '', contractId = '') {
  if (!bodyText || typeof bodyText !== 'string') {
    return null;
  }
  const trimmed = bodyText.trim();
  const isJson =
    /json/i.test(contentType) || trimmed.startsWith('{') || trimmed.startsWith('[');

  if (isJson) {
    try {
      const parsed = JSON.parse(trimmed);
      return summarizeJsonShape(parsed, contractId, 0);
    } catch {
      return { kind: 'text', length: trimmed.length };
    }
  }

  const titleMatch = trimmed.match(/<title[^>]*>([^<]{1,80})<\/title>/i);
  const formActions = [];
  const actionRe = /<form[^>]*action\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = actionRe.exec(trimmed)) !== null && formActions.length < 6) {
    formActions.push(safeUrlPath(m[1]));
  }

  return {
    kind: /html/i.test(contentType) || trimmed.startsWith('<') ? 'html' : 'text',
    length: trimmed.length,
    title: titleMatch ? replaceContractToken(titleMatch[1].trim(), contractId) : '',
    formActions,
  };
}

function summarizeJsonShape(node, contractId, depth) {
  if (node === null || node === undefined) {
    return null;
  }
  if (depth > 4) {
    return '[DEPTH_LIMIT]';
  }
  if (Array.isArray(node)) {
    return node.length > 0
      ? [`Array(${node.length})`, summarizeJsonShape(node[0], contractId, depth + 1)]
      : [];
  }
  if (typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node).slice(0, 25)) {
      if (isSensitiveKey(k)) {
        out[k] = '[REDACTED]';
      } else if (typeof v === 'object' && v !== null) {
        out[k] = summarizeJsonShape(v, contractId, depth + 1);
      } else if (typeof v === 'string') {
        out[k] = contractId && v.toUpperCase().includes(contractId.toUpperCase())
          ? '<CONTRACT_ID>'
          : `string(${v.length})`;
      } else {
        out[k] = typeof v;
      }
    }
    return out;
  }
  return typeof node;
}

function safeUrlPath(rawUrl, baseHref = 'https://inside.fpt.net/') {
  if (!rawUrl) {
    return '';
  }
  try {
    const u = new URL(rawUrl, baseHref);
    return u.pathname;
  } catch {
    return String(rawUrl).split('?')[0];
  }
}

function getQueryParamNames(rawUrl, baseHref = 'https://inside.fpt.net/') {
  try {
    const u = new URL(rawUrl, baseHref);
    return Array.from(new Set(u.searchParams.keys()));
  } catch {
    return [];
  }
}

/**
 * Quet cau truc DOM hien tai (Form, nut bam, script framework) - KHONG doc .value input.
 */
export function scanPageStructure(doc = document, loc = window.location, contractId = '') {
  const baseHref = (loc && loc.href) || 'https://inside.fpt.net/';
  const forms = [];

  const formNodes = Array.from(doc.querySelectorAll('form'));
  for (const form of formNodes.slice(0, 20)) {
    const fields = [];
    const fieldNodes = Array.from(form.querySelectorAll('input, select, textarea, button'));
    for (const field of fieldNodes.slice(0, 40)) {
      const id = field.id || '';
      let labelText = '';
      if (id) {
        const labelEl = doc.querySelector(`label[for="${cssEscapeSimple(id)}"]`);
        if (labelEl) {
          labelText = labelEl.textContent.trim();
        }
      }
      if (!labelText && field.closest) {
        const parentLabel = field.closest('label');
        if (parentLabel) {
          labelText = parentLabel.textContent.trim();
        }
      }
      fields.push({
        tag: field.tagName.toLowerCase(),
        type: (field.getAttribute('type') || '').toLowerCase(),
        name: field.getAttribute('name') || '',
        id,
        placeholder: truncateStr(field.getAttribute('placeholder') || '', 40),
        label: replaceContractToken(labelText, contractId),
        hasValue: Boolean(field.value && String(field.value).length > 0),
      });
    }

    forms.push({
      id: form.id || '',
      name: form.getAttribute('name') || '',
      method: (form.getAttribute('method') || 'GET').toUpperCase(),
      actionPath: safeUrlPath(form.getAttribute('action') || '', baseHref),
      fields,
    });
  }

  const controlNodes = Array.from(
    doc.querySelectorAll('button, input[type="button"], input[type="submit"], a[href], [onclick]')
  );
  const scoredControls = [];

  for (const el of controlNodes) {
    // Bo qua cac phan tu thuoc chinh Remote Inside
    if (el.closest && el.closest('#remote-inside-host')) {
      continue;
    }

    const rawText = (el.textContent || el.getAttribute('value') || el.getAttribute('title') || '')
      .replace(/\s+/g, ' ')
      .trim();
    const id = el.id || '';
    const name = el.getAttribute('name') || '';
    const onclickRaw = el.getAttribute('onclick') || '';
    const hrefRaw = el.getAttribute('href') || '';
    const combined = `${rawText} ${id} ${name} ${onclickRaw} ${hrefRaw}`;
    const priority = OPS_KEYWORD_RE.test(combined) ? 1 : 0;

    const dataAttrs = {};
    if (el.attributes) {
      for (const attr of Array.from(el.attributes)) {
        if (attr.name.startsWith('data-') && !isSensitiveKey(attr.name)) {
          dataAttrs[attr.name] = replaceContractToken(attr.value, contractId);
        }
      }
    }

    scoredControls.push({
      priority,
      item: {
        tag: el.tagName.toLowerCase(),
        text: replaceContractToken(rawText, contractId),
        id,
        name,
        classes: truncateStr(typeof el.className === 'string' ? el.className.trim() : '', 60),
        hrefPath: hrefRaw ? safeUrlPath(hrefRaw, baseHref) : '',
        onclickSnippet: replaceContractToken(onclickRaw, contractId),
        dataAttrs,
      },
    });
  }

  scoredControls.sort((a, b) => b.priority - a.priority);
  const actionControls = scoredControls.slice(0, MAX_CONTROLS).map((entry) => entry.item);

  const externalScripts = Array.from(doc.querySelectorAll('script[src]'))
    .map((s) => {
      const p = safeUrlPath(s.getAttribute('src') || '', baseHref);
      const parts = p.split('/').filter(Boolean);
      return parts[parts.length - 1] || p;
    })
    .filter(Boolean)
    .slice(0, 30);

  const frameworks = [];
  const win = doc.defaultView || (typeof window !== 'undefined' ? window : null);
  if (win) {
    if (win.jQuery || win.$) frameworks.push('jQuery');
    if (win.Vue || doc.querySelector('[data-v-app]')) frameworks.push('Vue');
    if (win.React || doc.querySelector('[data-reactroot]')) frameworks.push('React');
    if (win.angular || doc.querySelector('[ng-app], [ng-controller]')) frameworks.push('Angular');
  }
  if (doc.querySelector('input[name="__VIEWSTATE"]')) {
    frameworks.push('ASP.NET WebForms');
  }

  return {
    scannedAt: new Date().toISOString(),
    origin: (loc && loc.origin) || '',
    pathname: (loc && loc.pathname) || '',
    queryParamNames: loc && loc.href ? getQueryParamNames(loc.href, baseHref) : [],
    title: replaceContractToken(doc.title || '', contractId),
    forms,
    actionControls,
    scriptHints: {
      frameworks,
      externalFiles: externalScripts,
    },
  };
}

function cssEscapeSimple(value) {
  return String(value).replace(/["\\]/g, '\\$&');
}

function isTargetFptHost(rawUrl, currentOrigin) {
  try {
    const u = new URL(rawUrl, currentOrigin || 'https://inside.fpt.net/');
    if (currentOrigin && u.origin === currentOrigin) {
      return true;
    }
    return /(\.fpt\.net|\.fcam\.vn)$/i.test(u.hostname);
  } catch {
    return false;
  }
}

/**
 * Ghi lai cac request fetch / XHR trong luc nguoi dung bam thao tac thu tren trang goc.
 */
export function createNetworkRecorder(targetWindow, getContractId = () => '') {
  let recording = false;
  let entries = [];
  let origFetch = null;
  let origXhrOpen = null;
  let origXhrSend = null;
  const xhrMetaMap = new WeakMap();

  function pushEntry(entry) {
    if (entries.length >= MAX_RECORDED_REQUESTS) {
      return;
    }
    entries.push(entry);
  }

  function start() {
    if (recording || !targetWindow) {
      return false;
    }
    recording = true;
    const currentOrigin =
      (targetWindow.location && targetWindow.location.origin) || 'https://inside.fpt.net';

    if (typeof targetWindow.fetch === 'function') {
      origFetch = targetWindow.fetch;
      targetWindow.fetch = async function wrappedFetch(input, init = {}) {
        const rawUrl = typeof input === 'string' ? input : (input && input.url) || '';
        const method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
        const shouldCapture = isTargetFptHost(rawUrl, currentOrigin);
        const res = await origFetch.apply(this, arguments);

        if (shouldCapture && recording) {
          try {
            const contractId = getContractId ? getContractId() : '';
            const u = new URL(rawUrl, currentOrigin);
            const reqHeaders = redactHeaders((init && init.headers) || {});
            const reqCt = reqHeaders['content-type'] || reqHeaders['Content-Type'] || '';
            const clone = res.clone();
            const resCt = (res.headers && res.headers.get && res.headers.get('content-type')) || '';
            clone
              .text()
              .then((text) => {
                pushEntry({
                  time: new Date().toISOString(),
                  transport: 'fetch',
                  method,
                  origin: u.origin,
                  pathname: u.pathname,
                  queryParamNames: Array.from(new Set(u.searchParams.keys())),
                  requestContentType: reqCt,
                  requestHeaders: reqHeaders,
                  requestSchema: redactPayload(init ? init.body : null, contractId),
                  status: res.status,
                  responseContentType: resCt,
                  responseSchema: redactResponseStructure(text, resCt, contractId),
                });
              })
              .catch(() => {});
          } catch {
            // Khong lam anh huong request goc
          }
        }
        return res;
      };
    }

    if (targetWindow.XMLHttpRequest && targetWindow.XMLHttpRequest.prototype) {
      const proto = targetWindow.XMLHttpRequest.prototype;
      origXhrOpen = proto.open;
      origXhrSend = proto.send;

      proto.open = function wrappedOpen(method, url) {
        try {
          xhrMetaMap.set(this, {
            method: String(method || 'GET').toUpperCase(),
            url: String(url || ''),
          });
        } catch {
          // ignore
        }
        return origXhrOpen.apply(this, arguments);
      };

      proto.send = function wrappedSend(body) {
        const meta = xhrMetaMap.get(this);
        if (meta && isTargetFptHost(meta.url, currentOrigin)) {
          this.addEventListener('loadend', () => {
            if (!recording) return;
            try {
              const contractId = getContractId ? getContractId() : '';
              const u = new URL(meta.url, currentOrigin);
              const resCt = this.getResponseHeader('content-type') || '';
              const bodyText =
                this.responseType === '' || this.responseType === 'text'
                  ? this.responseText
                  : '';
              pushEntry({
                time: new Date().toISOString(),
                transport: 'xhr',
                method: meta.method,
                origin: u.origin,
                pathname: u.pathname,
                queryParamNames: Array.from(new Set(u.searchParams.keys())),
                requestContentType: '',
                requestHeaders: {},
                requestSchema: redactPayload(body, contractId),
                status: this.status,
                responseContentType: resCt,
                responseSchema: redactResponseStructure(bodyText, resCt, contractId),
              });
            } catch {
              // ignore
            }
          });
        }
        return origXhrSend.apply(this, arguments);
      };
    }

    return true;
  }

  function stop() {
    if (!recording || !targetWindow) {
      return false;
    }
    recording = false;

    if (origFetch) {
      targetWindow.fetch = origFetch;
      origFetch = null;
    }
    if (targetWindow.XMLHttpRequest && targetWindow.XMLHttpRequest.prototype) {
      const proto = targetWindow.XMLHttpRequest.prototype;
      if (origXhrOpen) {
        proto.open = origXhrOpen;
        origXhrOpen = null;
      }
      if (origXhrSend) {
        proto.send = origXhrSend;
        origXhrSend = null;
      }
    }
    return true;
  }

  function getEntries() {
    return entries.slice();
  }

  function clear() {
    entries = [];
  }

  function isRecording() {
    return recording;
  }

  return { start, stop, getEntries, clear, isRecording };
}

/**
 * Dong goi bao cao JSON sach se de nguoi dung copy hoac tai ve gui AI ghep API.
 */
export function buildScanReport({ domSnapshot = null, networkEntries = [], portalId = 'inside' }) {
  return JSON.stringify(
    {
      reportVersion: 'remote-inside-scan-v1',
      portalId,
      generatedAt: new Date().toISOString(),
      privacyNote:
        'Mat khau, cookie, token va thong tin ca nhan khach hang da duoc an tu dong.',
      domSnapshot,
      networkEntries,
    },
    null,
    2
  );
}
