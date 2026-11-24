/**
 * Cong cu Quet cau truc trang & Ghi mau thao tac mang an toan.
 * Tu dong an mat khau, cookie, token va thong tin ca nhan khach hang ([REDACTED]).
 */

export const SENSITIVE_HEADER_RE =
  /^(authorization|cookie|set-cookie|x-csrf-token|x-xsrf-token|x-auth-token|x-resource-grant|api-key|x-api-key|proxy-authorization)$/i;

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
  /(mac|reset|kill|session|osp|port|ipnat|ipv6|tra|tìm|search|thu\s*hồi|camera|clear|submit|cấp|xem|kiểm\s*tra|cập\s*nhật|hợp\s*đồng|tình\s*trạng|kỹ\s*thuật|contract|inside)/i;

const VENDOR_SCRIPT_RE =
  /(jquery(?!\.isc\b)|bootstrap|kendo|popper|jszip|moment|fontawesome|lodash|polyfill|angular|amcharts|spin\.min|ladda\.min|filesaver|canvg|rgbcolor)/i;

const API_PATH_HINT_RE =
  /(?:\/api\/|\/public\/|\/iptvinfo\/|\/Contract\/|\/DSLLLine\/|\/KillSession\/|\/networkConnection|\/radius)/i;

const JS_ENDPOINT_RE =
  /(?:\/api\/|\/public\/|\/iptvinfo\/|\/DSLLLine\/|\/KillSession\/|\/networkConnection|\/connection-parameters|\/online-session|\/last-access-error)[a-zA-Z0-9_\/\-${}.?=&]*/g;

const MAX_STR_LEN = 80;
const MAX_CONTROLS = 80;
const MAX_RECORDED_REQUESTS = 120;

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

function replaceContractToken(str, contractId, maxLen = MAX_STR_LEN) {
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
  return truncateStr(out, maxLen);
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
 * Chi ghi nhan ten header nhay cam va loai auth (Bearer/Basic/Custom), tuyet doi khong luu token.
 */
export function summarizeSensitiveHeaders(headers) {
  if (!headers || typeof headers !== 'object') {
    return { sensitiveHeaderNames: [], authScheme: '' };
  }
  const names = new Set();
  let authScheme = '';
  const entries =
    typeof headers.entries === 'function'
      ? Array.from(headers.entries())
      : Object.entries(headers);

  for (const [k, v] of entries) {
    const rawKey = String(k || '').trim();
    if (!rawKey) continue;
    const lowerKey = rawKey.toLowerCase();
    if (SENSITIVE_HEADER_RE.test(lowerKey)) {
      names.add(lowerKey);
      if (lowerKey === 'authorization' && !authScheme) {
        const val = String(v ?? '').trim();
        if (/^bearer\s+/i.test(val)) {
          authScheme = 'Bearer';
        } else if (/^basic\s+/i.test(val)) {
          authScheme = 'Basic';
        } else if (val) {
          authScheme = 'Custom';
        }
      }
    }
  }

  return {
    sensitiveHeaderNames: Array.from(names).sort(),
    authScheme,
  };
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
  if (depth > 5) {
    return '[DEPTH_LIMIT]';
  }
  if (Array.isArray(node)) {
    return node.length > 0
      ? [`Array(${node.length})`, summarizeJsonShape(node[0], contractId, depth + 1)]
      : [];
  }
  if (typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node).slice(0, 60)) {
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

function parseSafeUrlParts(rawUrl, baseHref = 'https://inside.fpt.net/', contractId = '') {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { origin: '', pathname: '', queryParamNames: [] };
  }
  const trimmed = rawUrl.trim();
  if (/^javascript:/i.test(trimmed)) {
    return {
      origin: '',
      pathname: replaceContractToken(trimmed, contractId),
      queryParamNames: [],
    };
  }
  try {
    const u = new URL(trimmed, baseHref);
    return {
      origin: u.origin && u.origin !== 'null' ? u.origin : '',
      pathname: u.pathname || '',
      queryParamNames: Array.from(new Set(u.searchParams.keys())),
    };
  } catch {
    return {
      origin: '',
      pathname: replaceContractToken(trimmed.split('?')[0], contractId),
      queryParamNames: [],
    };
  }
}

function collectFrameElements(targetDoc, baseHref, contractId) {
  if (!targetDoc || !targetDoc.querySelectorAll) {
    return [];
  }
  return Array.from(targetDoc.querySelectorAll('iframe, frame'))
    .slice(0, 20)
    .map((node) => {
      const parsed = parseSafeUrlParts(node.getAttribute('src') || '', baseHref, contractId);
      return {
        tag: node.tagName.toLowerCase(),
        id: node.id || '',
        name: node.getAttribute('name') || '',
        srcOrigin: parsed.origin,
        srcPath: parsed.pathname,
        srcQueryParamNames: parsed.queryParamNames,
      };
    });
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
    doc.querySelectorAll(
      'button, input[type="button"], input[type="submit"], input[type="image"], a[href], [onclick]'
    )
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

    const isJsHref = /^\s*javascript:/i.test(hrefRaw);
    const hrefPath = hrefRaw
      ? isJsHref
        ? replaceContractToken(hrefRaw, contractId)
        : safeUrlPath(hrefRaw, baseHref)
      : '';

    scoredControls.push({
      priority,
      item: {
        tag: el.tagName.toLowerCase(),
        text: replaceContractToken(rawText, contractId),
        id,
        name,
        classes: truncateStr(typeof el.className === 'string' ? el.className.trim() : '', 60),
        hrefPath,
        onclickSnippet: replaceContractToken(onclickRaw, contractId, 180),
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

  const frameElements = collectFrameElements(doc, baseHref, contractId);

  let isInFrame = false;
  const frameMap = [];
  const sameOriginFrameSummary = [];
  if (win) {
    try {
      isInFrame = win.top !== win.self;
      const topWin = win.top;
      if (topWin && topWin.frames) {
        for (let i = 0; i < Math.min(topWin.frames.length, 20); i += 1) {
          try {
            const f = topWin.frames[i];
            const fLoc = f.location;
            const fDoc = f.document;
            const fBase = (fLoc && fLoc.href) || baseHref;
            frameMap.push({
              index: i,
              name: String(f.name || ''),
              pathname: fLoc ? fLoc.pathname || '' : '',
              queryParamNames: fLoc && fLoc.href ? getQueryParamNames(fLoc.href, baseHref) : [],
              title: replaceContractToken((fDoc && fDoc.title) || '', contractId),
            });

            if (fDoc && fDoc !== doc && sameOriginFrameSummary.length < 10) {
              const nestedFrames = collectFrameElements(fDoc, fBase, contractId);
              const rawLinks = fDoc.querySelectorAll
                ? Array.from(fDoc.querySelectorAll('a[href], [onclick]'))
                : [];
              const scoredLinks = [];
              const criticalMenuRe = /(osp|clear|reset|kill|session|mac|tình\s*trạng|status)/i;
              for (const link of rawLinks) {
                const text = (link.textContent || link.getAttribute('title') || '')
                  .replace(/\s+/g, ' ')
                  .trim();
                const hrefRaw = link.getAttribute('href') || '';
                const onclickRaw = link.getAttribute('onclick') || '';
                const id = link.id || '';
                const name = link.getAttribute('name') || '';
                const combinedMenu = `${text} ${id} ${name} ${onclickRaw} ${hrefRaw}`;
                if (!OPS_KEYWORD_RE.test(combinedMenu)) {
                  continue;
                }
                const parsedHref = parseSafeUrlParts(hrefRaw, fBase, contractId);
                scoredLinks.push({
                  priority: criticalMenuRe.test(combinedMenu) ? 1 : 0,
                  item: {
                    text: replaceContractToken(text, contractId),
                    hrefOrigin: parsedHref.origin,
                    hrefPath: parsedHref.pathname,
                    hrefQueryParamNames: parsedHref.queryParamNames,
                    onclickSnippet: replaceContractToken(onclickRaw, contractId, 180),
                  },
                });
              }
              scoredLinks.sort((a, b) => b.priority - a.priority);
              const menuLinks = scoredLinks.slice(0, 200).map((entry) => entry.item);
              sameOriginFrameSummary.push({
                index: i,
                name: String(f.name || ''),
                pathname: fLoc ? fLoc.pathname || '' : '',
                nestedFrames,
                menuLinks,
              });
            }
          } catch {
            frameMap.push({ index: i, crossOrigin: true });
          }
        }
      }
    } catch {
      isInFrame = true;
    }
  }

  const ajaxCollector = createAjaxCallCollector(baseHref, contractId);
  try {
    const inlineScripts = doc.querySelectorAll
      ? Array.from(doc.querySelectorAll('script:not([src])'))
      : [];
    for (const sc of inlineScripts.slice(0, 30)) {
      const code = sc && sc.textContent ? sc.textContent : '';
      if (code.trim()) {
        extractAjaxSignaturesFromCode(code, ajaxCollector.addCall);
      }
    }
  } catch {
    // Bo qua neu khong doc duoc inline script
  }

  const storageKeyNames = { local: [], session: [] };
  try {
    const storageWin =
      (doc && doc.defaultView) ||
      (typeof window !== 'undefined' ? window : null);
    if (
      storageWin &&
      storageWin.localStorage &&
      typeof storageWin.localStorage.length === 'number' &&
      typeof storageWin.localStorage.key === 'function'
    ) {
      for (
        let i = 0;
        i < storageWin.localStorage.length && storageKeyNames.local.length < 50;
        i++
      ) {
        const keyName = storageWin.localStorage.key(i);
        if (keyName) {
          storageKeyNames.local.push(truncateStr(String(keyName)));
        }
      }
    }
    if (
      storageWin &&
      storageWin.sessionStorage &&
      typeof storageWin.sessionStorage.length === 'number' &&
      typeof storageWin.sessionStorage.key === 'function'
    ) {
      for (
        let i = 0;
        i < storageWin.sessionStorage.length && storageKeyNames.session.length < 50;
        i++
      ) {
        const keyName = storageWin.sessionStorage.key(i);
        if (keyName) {
          storageKeyNames.session.push(truncateStr(String(keyName)));
        }
      }
    }
  } catch {
    // Bo qua neu khong doc duoc danh sach key storage
  }

  return {
    scannedAt: new Date().toISOString(),
    origin: (loc && loc.origin) || '',
    pathname: (loc && loc.pathname) || '',
    queryParamNames: loc && loc.href ? getQueryParamNames(loc.href, baseHref) : [],
    title: replaceContractToken(doc.title || '', contractId),
    isInFrame,
    frameMap,
    frameElements,
    sameOriginFrameSummary,
    forms,
    actionControls,
    ajaxCalls: ajaxCollector.getCalls(),
    storageKeyNames,
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
    return /(\.fpt\.net|\.fpt\.vn|\.fpt\.com\.vn|\.fcam\.vn)$/i.test(u.hostname);
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
  let origXhrSetHeader = null;
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
            const rawReqHeaders = (init && init.headers) || (input && input.headers) || {};
            const reqHeaders = redactHeaders(rawReqHeaders);
            const authHints = summarizeSensitiveHeaders(rawReqHeaders);
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
                  authHints,
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
      origXhrSetHeader = proto.setRequestHeader;
      origXhrSend = proto.send;

      proto.open = function wrappedOpen(method, url) {
        try {
          xhrMetaMap.set(this, {
            method: String(method || 'GET').toUpperCase(),
            url: String(url || ''),
            rawHeaders: {},
          });
        } catch {
          // ignore
        }
        return origXhrOpen.apply(this, arguments);
      };

      if (typeof origXhrSetHeader === 'function') {
        proto.setRequestHeader = function wrappedSetRequestHeader(header, value) {
          try {
            const meta = xhrMetaMap.get(this);
            if (meta && header) {
              meta.rawHeaders[String(header)] = String(value ?? '');
            }
          } catch {
            // ignore
          }
          return origXhrSetHeader.apply(this, arguments);
        };
      }

      proto.send = function wrappedSend(body) {
        const meta = xhrMetaMap.get(this);
        if (meta && isTargetFptHost(meta.url, currentOrigin)) {
          this.addEventListener('loadend', () => {
            if (!recording) return;
            try {
              const contractId = getContractId ? getContractId() : '';
              const u = new URL(meta.url, currentOrigin);
              const rawReqHeaders = meta.rawHeaders || {};
              const reqHeaders = redactHeaders(rawReqHeaders);
              const authHints = summarizeSensitiveHeaders(rawReqHeaders);
              const reqCt = reqHeaders['content-type'] || reqHeaders['Content-Type'] || '';
              const resCt = this.getResponseHeader('content-type') || '';
              let bodyText = '';
              if (this.responseType === '' || this.responseType === 'text') {
                bodyText = this.responseText || '';
              } else if (this.responseType === 'json') {
                try {
                  bodyText =
                    this.response !== null && this.response !== undefined
                      ? JSON.stringify(this.response)
                      : '';
                } catch {
                  bodyText = '';
                }
              }
              pushEntry({
                time: new Date().toISOString(),
                transport: 'xhr',
                method: meta.method,
                origin: u.origin,
                pathname: u.pathname,
                queryParamNames: Array.from(new Set(u.searchParams.keys())),
                requestContentType: reqCt,
                requestHeaders: reqHeaders,
                authHints,
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
      if (origXhrSetHeader) {
        proto.setRequestHeader = origXhrSetHeader;
        origXhrSetHeader = null;
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

function sanitizeApiHint(rawHint, baseUrl = '', contractId = '') {
  if (!rawHint || typeof rawHint !== 'string') {
    return '';
  }
  const trimmed = rawHint.trim();
  if (!trimmed || /^javascript:/i.test(trimmed) || /^data:/i.test(trimmed) || trimmed === '#') {
    return '';
  }
  const parts = parseSafeUrlParts(trimmed, baseUrl || 'http://inside.fpt.net/', contractId);
  const queryPart =
    parts.queryParamNames.length > 0 ? `?${parts.queryParamNames.join('&')}` : '';
  const pathWithQuery = `${parts.pathname}${queryPart}`;
  if (!pathWithQuery) return '';
  if (parts.origin && /^https?:\/\//i.test(trimmed)) {
    return replaceContractToken(`${parts.origin}${pathWithQuery}`, contractId, 160);
  }
  return replaceContractToken(pathWithQuery, contractId, 160);
}

function getAttrValue(attrStr, attrName) {
  const re = new RegExp(`\\b${attrName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const m = attrStr.match(re);
  if (!m) return '';
  return m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3] || '';
}

/**
 * Quet an toan cac goi y API va bieu mau tu chuoi HTML (chi doc cau truc, khong doc PII/value).
 */
export function extractApiHintsFromHtml(htmlText, baseUrl = '', contractId = '') {
  if (!htmlText || typeof htmlText !== 'string') {
    return { scriptUrls: [], apiHints: [], forms: [], fields: [], buttons: [] };
  }

  const withoutStyles = htmlText.replace(
    new RegExp('<style\\b[^>]*>[\\s\\S]*?</' + 'style>', 'gi'),
    ' '
  );

  const scriptUrls = [];
  const seenScripts = new Set();
  const apiHints = [];
  const seenHints = new Set();

  let baseOrigin = '';
  if (baseUrl) {
    try {
      baseOrigin = new URL(baseUrl).origin;
    } catch {
      baseOrigin = '';
    }
  }

  function addHint(raw) {
    const clean = sanitizeApiHint(raw, baseUrl, contractId);
    if (!clean || seenHints.has(clean) || apiHints.length >= 60) return;
    seenHints.add(clean);
    apiHints.push(clean);
  }

  function scanScriptCode(codeText) {
    const patterns = [
      /url\s*:\s*['"`]([^'"`\n]{2,200})['"`]/gi,
      /fetch\s*\(\s*['"`]([^'"`\n]{2,200})['"`]/gi,
      /\$\.(?:get|post|getJSON|ajax)\s*\(\s*['"]([^'"\n]{2,200})['"]/gi,
      /axios\.(?:get|post|put|delete|patch)\s*\(\s*['"`]([^'"`\n]{2,200})['"`]/gi,
    ];
    for (const re of patterns) {
      let m;
      while ((m = re.exec(codeText)) !== null) {
        addHint(m[1]);
      }
    }
    const litRe = /['"`]([^'"`\s<>]{4,200})['"`]/g;
    let lm;
    while ((lm = litRe.exec(codeText)) !== null) {
      if (API_PATH_HINT_RE.test(lm[1])) {
        addHint(lm[1]);
      }
    }
  }

  const scriptRe = new RegExp('<script\\b([^>]*)>([\\s\\S]*?)</' + 'script>', 'gi');
  let sm;
  while ((sm = scriptRe.exec(withoutStyles)) !== null) {
    const attrs = sm[1] || '';
    const body = sm[2] || '';
    const src = getAttrValue(attrs, 'src');
    if (src) {
      if (VENDOR_SCRIPT_RE.test(src)) continue;
      try {
        const u = new URL(src, baseUrl || 'http://inside.fpt.net/');
        if (baseOrigin && u.origin !== baseOrigin) continue;
        const cleanUrl = `${u.origin}${u.pathname}`;
        if (!seenScripts.has(cleanUrl) && scriptUrls.length < 20) {
          seenScripts.add(cleanUrl);
          scriptUrls.push(cleanUrl);
        }
      } catch {
        // Bo qua URL khong hop le
      }
    } else if (body.trim()) {
      scanScriptCode(body);
    }
  }

  const forms = [];
  const formRe = /<form\b([^>]*)>/gi;
  let fm;
  while ((fm = formRe.exec(withoutStyles)) !== null && forms.length < 20) {
    const attrs = fm[1] || '';
    const actionRaw = getAttrValue(attrs, 'action');
    const parsedAction = parseSafeUrlParts(
      actionRaw,
      baseUrl || 'http://inside.fpt.net/',
      contractId
    );
    forms.push({
      id: getAttrValue(attrs, 'id'),
      name: getAttrValue(attrs, 'name'),
      method: (getAttrValue(attrs, 'method') || 'GET').toUpperCase(),
      actionPath: parsedAction.pathname,
      queryParamNames: parsedAction.queryParamNames,
    });
  }

  const fields = [];
  const fieldRe = /<(input|select|textarea)\b([^>]*)>/gi;
  let flm;
  while ((flm = fieldRe.exec(withoutStyles)) !== null && fields.length < 60) {
    const tag = flm[1].toLowerCase();
    const attrs = flm[2] || '';
    fields.push({
      tag,
      type: getAttrValue(attrs, 'type').toLowerCase(),
      id: getAttrValue(attrs, 'id'),
      name: getAttrValue(attrs, 'name'),
      placeholder: truncateStr(getAttrValue(attrs, 'placeholder'), 40),
    });
  }

  const buttons = [];
  const btnRe = /<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let bm;
  while ((bm = btnRe.exec(withoutStyles)) !== null && buttons.length < 50) {
    const tag = bm[1].toLowerCase();
    const attrs = bm[2] || '';
    const innerText = bm[3].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const id = getAttrValue(attrs, 'id');
    const name = getAttrValue(attrs, 'name');
    const onclick = getAttrValue(attrs, 'onclick');
    const href = getAttrValue(attrs, 'href');
    if (tag === 'button' || id || onclick || API_PATH_HINT_RE.test(href)) {
      const parsedHref = parseSafeUrlParts(
        href,
        baseUrl || 'http://inside.fpt.net/',
        contractId
      );
      buttons.push({
        tag,
        id,
        name,
        text: replaceContractToken(innerText, contractId, 60),
        hrefPath: parsedHref.pathname,
        onclickSnippet: replaceContractToken(onclick, contractId, 180),
      });
    }
  }

  return { scriptUrls, apiHints, forms, fields, buttons };
}

/**
 * Quet an toan cac duong dan API tu file JS rieng (khong doc du lieu nhay cam).
 */
export function extractApiHintsFromJs(jsText, contractId = '') {
  if (!jsText || typeof jsText !== 'string') {
    return [];
  }

  const hints = [];
  const seen = new Set();

  function addJsHint(raw) {
    const clean = sanitizeApiHint(raw, '', contractId);
    if (!clean || seen.has(clean) || hints.length >= 60) return;
    seen.add(clean);
    hints.push(clean);
  }

  let m;
  const pathRe = new RegExp(JS_ENDPOINT_RE.source, 'g');
  while ((m = pathRe.exec(jsText)) !== null) {
    addJsHint(m[0]);
  }

  const callPatterns = [
    /url\s*:\s*['"`]([^'"`\n]{3,200})['"`]/gi,
    /fetch\s*\(\s*['"`]([^'"`\n]{3,200})['"`]/gi,
    /axios\.(?:get|post|put|delete|patch)\s*\(\s*['"`]([^'"`\n]{3,200})['"`]/gi,
  ];
  for (const re of callPatterns) {
    while ((m = re.exec(jsText)) !== null) {
      addJsHint(m[1]);
    }
  }

  const fptUrlRe =
    /https?:\/\/[a-zA-Z0-9.-]*(?:\.fpt\.net|\.fcam\.vn)\/[a-zA-Z0-9_\/\-${}.?=&]*/gi;
  while ((m = fptUrlRe.exec(jsText)) !== null) {
    addJsHint(m[0]);
  }

  return hints;
}

function extractBalancedBraces(str, openIdx, maxLen = 1200) {
  if (!str || str[openIdx] !== '{') return '';
  let depth = 0;
  let quote = '';
  let escaped = false;
  const end = Math.min(str.length, openIdx + maxLen);

  for (let i = openIdx; i < end; i += 1) {
    const ch = str[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote) {
      if (ch === '\\') {
        escaped = true;
      } else if (ch === quote) {
        quote = '';
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
    } else if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return str.slice(openIdx, i + 1);
      }
    }
  }
  return str.slice(openIdx, end);
}

function findEnclosingFnHint(codeText, index) {
  const start = Math.max(0, index - 600);
  const before = codeText.slice(start, index);
  const fnMatches = Array.from(
    before.matchAll(
      /(?:function\s+([A-Za-z0-9_$]+)\s*\(|\$\(\s*['"](#[^'"]+)['"]\s*\)\s*\.(?:click|on\s*\(\s*['"]click['"]))|(?:(?:var|let|const)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?function)/g
    )
  );
  if (fnMatches.length === 0) return '';
  const last = fnMatches[fnMatches.length - 1];
  return last[1] || last[2] || last[3] || '';
}

function extractDataKeysFromExpr(block) {
  const keys = new Set();
  const objIdx = block.search(/(?:data\s*:\s*\{|JSON\.stringify\s*\(\s*\{|^\s*,\s*\{)/i);
  if (objIdx !== -1) {
    const braceIdx = block.indexOf('{', objIdx);
    const objText = braceIdx !== -1 ? extractBalancedBraces(block, braceIdx, 600) : '';
    const keyRe = /['"]?([A-Za-z0-9_$]+)['"]?\s*:/g;
    let km;
    while ((km = keyRe.exec(objText)) !== null) {
      keys.add(km[1]);
    }
  }
  const qpRe = /[?&"'\s]([A-Za-z0-9_]+)\s*=/g;
  let qm;
  while ((qm = qpRe.exec(block)) !== null) {
    if (!['type', 'method', 'url', 'contentType', 'dataType', 'async'].includes(qm[1])) {
      keys.add(qm[1]);
    }
  }
  return Array.from(keys).slice(0, 20);
}

function extractConcatenatedUrlExpr(block) {
  const m = block.match(/url\s*:\s*([^\n,}]+(?:\s*\+\s*[^\n,}]+)*)/i);
  if (!m) return '';
  const litRe = /['"`]([^'"`]+)['"`]/g;
  const parts = [];
  let lm;
  while ((lm = litRe.exec(m[1])) !== null) {
    parts.push(lm[1]);
  }
  return parts.join('');
}

function createAjaxCallCollector(baseUrl, contractId) {
  const ajaxCalls = [];
  const seenCalls = new Set();

  function addCall({ fnHint, method, rawUrl, contentType, extraDataKeys = [] }) {
    if (!rawUrl || ajaxCalls.length >= 30) return;
    const parsed = parseSafeUrlParts(
      rawUrl,
      baseUrl || 'http://mvc.inside.fpt.net/',
      contractId
    );
    if (!parsed.pathname) return;
    const dataKeys = Array.from(new Set([...parsed.queryParamNames, ...extraDataKeys])).slice(0, 20);
    const sigKey = `${method}|${parsed.pathname}|${dataKeys.join(',')}`;
    if (seenCalls.has(sigKey)) return;
    seenCalls.add(sigKey);
    ajaxCalls.push({
      fnHint: replaceContractToken(fnHint || '', contractId, 50),
      method: method.toUpperCase(),
      urlPath: parsed.pathname,
      queryParamNames: parsed.queryParamNames,
      contentType: truncateStr(contentType || '', 60),
      dataKeys,
    });
  }

  return { addCall, getCalls: () => ajaxCalls };
}

function extractAjaxSignaturesFromCode(code, addCall) {
  const ajaxRe = /\$\.ajax\s*\(\s*\{/g;
  let am;
  while ((am = ajaxRe.exec(code)) !== null) {
    const braceStart = am.index + am[0].length - 1;
    const block = extractBalancedBraces(code, braceStart, 1000);
    const methodMatch = block.match(/\b(?:type|method)\s*:\s*['"]([A-Za-z]+)['"]/i);
    const ctMatch = block.match(/\bcontentType\s*:\s*['"]([^'"]+)['"]/i);
    const rawUrl = extractConcatenatedUrlExpr(block);
    const dataKeys = extractDataKeysFromExpr(block);
    addCall({
      fnHint: findEnclosingFnHint(code, am.index),
      method: methodMatch ? methodMatch[1] : 'GET',
      rawUrl,
      contentType: ctMatch ? ctMatch[1] : '',
      extraDataKeys: dataKeys,
    });
  }

  const shortRe = /\$\.(post|get|getJSON)\s*\(\s*['"`]([^'"`\n]+)['"`]([^)]{0,320})\)/gi;
  let shm;
  while ((shm = shortRe.exec(code)) !== null) {
    const fnName = shm[1].toLowerCase();
    const rawUrl = shm[2];
    const tail = shm[3] || '';
    const dataKeys = extractDataKeysFromExpr(tail);
    addCall({
      fnHint: findEnclosingFnHint(code, shm.index),
      method: fnName === 'post' ? 'POST' : 'GET',
      rawUrl,
      contentType: fnName === 'post' ? 'application/x-www-form-urlencoded' : '',
      extraDataKeys: dataKeys,
    });
  }
}

/**
 * Quet chi tiet chu ky goi AJAX ($.ajax, $.post, $.get) va cac o chon <select> tu HTML (chi doc cau truc).
 */
export function extractAjaxSignaturesFromHtml(htmlText, baseUrl = '', contractId = '') {
  if (!htmlText || typeof htmlText !== 'string') {
    return { ajaxCalls: [], selects: [] };
  }

  const withoutStyles = htmlText.replace(
    new RegExp('<style\\b[^>]*>[\\s\\S]*?</' + 'style>', 'gi'),
    ' '
  );

  const collector = createAjaxCallCollector(baseUrl || 'http://mvc.inside.fpt.net/', contractId);

  const scriptRe = new RegExp('<script\\b([^>]*)>([\\s\\S]*?)</' + 'script>', 'gi');
  let sm;
  while ((sm = scriptRe.exec(withoutStyles)) !== null) {
    const attrs = sm[1] || '';
    if (getAttrValue(attrs, 'src')) continue;
    const code = sm[2] || '';
    if (!code.trim()) continue;
    extractAjaxSignaturesFromCode(code, collector.addCall);
  }

  const selects = [];
  const selectRe = /<select\b([^>]*)>([\s\S]*?)<\/select>/gi;
  let slm;
  while ((slm = selectRe.exec(withoutStyles)) !== null && selects.length < 10) {
    const attrs = slm[1] || '';
    const inner = slm[2] || '';
    const options = [];
    const optRe = /<option\b([^>]*)>([\s\S]*?)<\/option>/gi;
    let om;
    while ((om = optRe.exec(inner)) !== null && options.length < 15) {
      const optText = om[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      options.push({
        value: truncateStr(getAttrValue(om[1] || '', 'value'), 40),
        text: replaceContractToken(optText, contractId, 60),
      });
    }
    selects.push({
      id: getAttrValue(attrs, 'id'),
      name: getAttrValue(attrs, 'name'),
      options,
    });
  }

  return { ajaxCalls: collector.getCalls(), selects };
}

const LEFT_OPS_MENU_RE =
  /(mac|box|osp|kill|session|port|reset|replace|clear|kỹ\s*thuật|mạng|iptv|camera|dsl|line|olt|pon)/i;

/**
 * Quet danh sach cac muc ky thuat / thao tac trong menu Left.Asp (tim Clear OSP, Reset MAC Box...).
 */
export function extractOpsMenuFromLeftAsp(htmlText, baseUrl = 'http://inside.fpt.net/Left.Asp') {
  if (!htmlText || typeof htmlText !== 'string') {
    return [];
  }

  const items = [];
  const seen = new Set();
  const seenPaths = new Set();

  function pushItem(label, rawUrl) {
    if (!rawUrl || items.length >= 120) return;
    const cleanText = String(label || '').replace(/\s+/g, ' ').trim();
    if (!LEFT_OPS_MENU_RE.test(`${cleanText} ${rawUrl}`)) return;
    const parsed = parseSafeUrlParts(rawUrl, baseUrl, '');
    if (!parsed.pathname) return;
    const pathKey = `${parsed.origin}|${parsed.pathname}`;
    if (!cleanText && seenPaths.has(pathKey)) return;
    const key = `${cleanText}|${pathKey}`;
    if (seen.has(key)) return;
    seen.add(key);
    seenPaths.add(pathKey);
    items.push({
      text: truncateStr(cleanText, 80),
      targetOrigin: parsed.origin,
      targetPath: parsed.pathname,
      targetQueryParamNames: parsed.queryParamNames,
    });
  }

  const anchorRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let am;
  while ((am = anchorRe.exec(htmlText)) !== null) {
    const attrs = am[1] || '';
    const text = am[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const onclick = getAttrValue(attrs, 'onclick');
    const href = getAttrValue(attrs, 'href');
    const goMatch = onclick.match(/GoPage\s*\(\s*['"]([^'"]+)['"]/i);
    if (goMatch) {
      pushItem(text, goMatch[1]);
    } else if (href && href !== '#' && !/^\s*javascript:/i.test(href)) {
      pushItem(text, href);
    }
  }

  const goStandaloneRe = /GoPage\s*\(\s*['"]([^'"]+)['"]/gi;
  let gm;
  while ((gm = goStandaloneRe.exec(htmlText)) !== null) {
    pushItem('', gm[1]);
  }

  return items;
}

/**
 * Trich xuat tieu de, frame/iframe va danh sach lien ket dieu huong tu HTML (khong luu gia tri query nhay cam).
 */
export function extractFramesAndLinksFromHtml(
  htmlText,
  baseUrl = 'http://port.fpt.net/',
  contractId = ''
) {
  if (!htmlText || typeof htmlText !== 'string') {
    return { title: '', frames: [], links: [] };
  }

  const withoutStyles = htmlText.replace(
    new RegExp('<style\\b[^>]*>[\\s\\S]*?</' + 'style>', 'gi'),
    ' '
  );

  const titleMatch = withoutStyles.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const rawTitle = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';
  const title = rawTitle ? replaceContractToken(rawTitle, contractId, 80) : '';

  const frames = [];
  const seenFrames = new Set();
  const frameRe = /<(i?frame)\b([^>]*)>/gi;
  let frm;
  while ((frm = frameRe.exec(withoutStyles)) !== null && frames.length < 20) {
    const tag = frm[1].toLowerCase();
    const attrs = frm[2] || '';
    const src = getAttrValue(attrs, 'src').trim();
    if (!src || /^about:blank$/i.test(src) || /^\s*javascript:/i.test(src)) {
      continue;
    }
    const parsed = parseSafeUrlParts(src, baseUrl, contractId);
    if (!parsed.pathname) continue;
    const key = `${parsed.origin}|${parsed.pathname}`;
    if (seenFrames.has(key)) continue;
    seenFrames.add(key);
    frames.push({
      tag,
      id: getAttrValue(attrs, 'id'),
      name: getAttrValue(attrs, 'name'),
      origin: parsed.origin,
      pathname: parsed.pathname,
      queryParamNames: parsed.queryParamNames,
    });
  }

  const links = [];
  const seenLinks = new Set();
  const anchorRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let am;
  while ((am = anchorRe.exec(withoutStyles)) !== null && links.length < 120) {
    const attrs = am[1] || '';
    const innerText = am[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const onclick = getAttrValue(attrs, 'onclick');
    const dataUrl = getAttrValue(attrs, 'data-url');
    const href = getAttrValue(attrs, 'href');

    let rawTarget = '';
    if (onclick) {
      const mGo = onclick.match(/GoPage\s*\(\s*['"]([^'"]+)['"]/i);
      const mOpen = onclick.match(/window\.open\s*\(\s*['"]([^'"]+)['"]/i);
      const mLoc = onclick.match(/(?:window\.|top\.|self\.)?location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/i);
      rawTarget = (mGo && mGo[1]) || (mOpen && mOpen[1]) || (mLoc && mLoc[1]) || '';
    }
    if (!rawTarget && dataUrl) {
      rawTarget = dataUrl.trim();
    }
    if (!rawTarget && href) {
      rawTarget = href.trim();
    }

    if (
      !rawTarget ||
      rawTarget === '#' ||
      rawTarget.startsWith('#') ||
      /^\s*(?:mailto:|tel:|javascript:)/i.test(rawTarget)
    ) {
      continue;
    }

    const parsed = parseSafeUrlParts(rawTarget, baseUrl, contractId);
    if (!parsed.pathname) continue;
    const linkKey = `${parsed.origin}|${parsed.pathname}`;
    if (seenLinks.has(linkKey)) continue;
    seenLinks.add(linkKey);

    links.push({
      text: replaceContractToken(innerText, contractId, 80),
      origin: parsed.origin,
      pathname: parsed.pathname,
      queryParamNames: parsed.queryParamNames,
    });
  }

  return { title, frames, links };
}

const DEFAULT_JS_FN_KEYWORD_RE =
  /(?:ClearSerial|testOID|ViewPort|MonitorOLT|Swap|ReplaceMAC|GetMac|Ajax|OLT|Port)/i;

function sanitizeCodeSnippet(code, contractId = '', maxLen = 12000) {
  if (!code || typeof code !== 'string') {
    return '';
  }
  let out = code;
  if (contractId && contractId.length >= 4) {
    const re = new RegExp(escapeRegExp(contractId), 'gi');
    out = out.replace(re, '<CONTRACT_ID>');
  }
  out = out.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]');
  out = out.replace(
    /(["']?(?:pass|pwd|secret|token|cookie|auth|otp|api_?key)[a-z0-9_-]*["']?\s*[:=]\s*)(['"`])[^'"`]{1,200}\2/gi,
    '$1$2[REDACTED]$2'
  );
  out = out.replace(
    /([?&](?:vR\d+|token|auth|secret|key|pass|pwd)=)[^&'"`\s]+/gi,
    '$1[REDACTED]'
  );
  out = out.replace(/\b0[35789]\d{8}\b/g, '[REDACTED_PHONE]');
  out = out.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');
  out = out.trim();
  if (maxLen > 0 && out.length > maxLen) {
    return `${out.slice(0, maxLen)}\n/* ...truncated... */`;
  }
  return out;
}

/**
 * Trich xuat va lam sach cac doan inline script de xem ro cach trang goi API / submit.
 */
export function extractInlineScriptsSanitized(
  htmlText,
  contractId = '',
  { maxPerScript = 12000, maxTotal = 28000 } = {}
) {
  if (!htmlText || typeof htmlText !== 'string') {
    return [];
  }

  const withoutStyles = htmlText.replace(
    new RegExp('<style\\b[^>]*>[\\s\\S]*?</' + 'style>', 'gi'),
    ' '
  );
  const scriptRe = new RegExp('<script\\b([^>]*)>([\\s\\S]*?)</' + 'script>', 'gi');

  const scripts = [];
  let remaining = maxTotal;
  let inlineIndex = 0;
  let sm;

  while ((sm = scriptRe.exec(withoutStyles)) !== null && remaining > 0) {
    const attrs = sm[1] || '';
    if (getAttrValue(attrs, 'src')) {
      continue;
    }
    const rawBody = sm[2] || '';
    if (!rawBody.trim()) {
      inlineIndex += 1;
      continue;
    }
    const limit = Math.min(maxPerScript, remaining);
    const cleaned = sanitizeCodeSnippet(rawBody, contractId, limit);
    if (cleaned) {
      scripts.push({
        index: inlineIndex,
        originalLength: rawBody.length,
        code: cleaned,
      });
      remaining -= cleaned.length;
    }
    inlineIndex += 1;
  }

  return scripts;
}

/**
 * Trich xuat thong tin cau truc the select, checkbox/radio va hidden input (da loc gia tri nhay cam).
 */
export function extractFormControlsMeta(htmlText, contractId = '') {
  if (!htmlText || typeof htmlText !== 'string') {
    return { selects: [], checkboxes: [], hiddenInputs: [] };
  }

  const cleanedHtml = htmlText
    .replace(new RegExp('<script\\b[^>]*>[\\s\\S]*?</' + 'script>', 'gi'), ' ')
    .replace(new RegExp('<style\\b[^>]*>[\\s\\S]*?</' + 'style>', 'gi'), ' ');

  const selects = [];
  const selectRe = /<select\b([^>]*)>([\s\S]*?)<\/select>/gi;
  let slm;
  while ((slm = selectRe.exec(cleanedHtml)) !== null && selects.length < 15) {
    const attrs = slm[1] || '';
    const inner = slm[2] || '';
    const id = getAttrValue(attrs, 'id');
    const name = getAttrValue(attrs, 'name');
    const sensitiveSelect = isSensitiveKey(name) || isSensitiveKey(id);
    const onchange = replaceContractToken(getAttrValue(attrs, 'onchange'), contractId, 160);

    const optRe = /<option\b([^>]*)>([\s\S]*?)(?=<option\b|<\/option>|<\/select>|$)/gi;
    let optionCount = 0;
    let selectedValue = '';
    const sampleOptions = [];
    let om;

    while ((om = optRe.exec(inner)) !== null) {
      optionCount += 1;
      const optAttrs = om[1] || '';
      const isSelected = /\bselected\b/i.test(optAttrs);
      const rawOptVal = getAttrValue(optAttrs, 'value');
      const rawOptText = om[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const safeVal = sensitiveSelect
        ? '[REDACTED]'
        : replaceContractToken(rawOptVal, contractId, 60);
      const safeText = sensitiveSelect
        ? '[REDACTED]'
        : replaceContractToken(rawOptText, contractId, 60);

      if (isSelected && !selectedValue) {
        selectedValue = safeVal;
      }
      if (sampleOptions.length < 12) {
        sampleOptions.push({
          value: safeVal,
          text: safeText,
          selected: isSelected,
        });
      }
    }

    selects.push({
      id,
      name,
      onchange,
      optionCount,
      selectedValue,
      sampleOptions,
    });
  }

  const checkboxes = [];
  const hiddenInputs = [];
  const inputRe = /<input\b([^>]*)>/gi;
  let im;
  while ((im = inputRe.exec(cleanedHtml)) !== null) {
    if (checkboxes.length >= 15 && hiddenInputs.length >= 15) {
      break;
    }
    const attrs = im[1] || '';
    const type = getAttrValue(attrs, 'type').toLowerCase();
    const id = getAttrValue(attrs, 'id');
    const name = getAttrValue(attrs, 'name');
    const rawVal = getAttrValue(attrs, 'value');

    if ((type === 'checkbox' || type === 'radio') && checkboxes.length < 15) {
      const sensitiveField = isSensitiveKey(name) || isSensitiveKey(id);
      checkboxes.push({
        type,
        id,
        name,
        className: truncateStr(getAttrValue(attrs, 'class'), 60),
        value: sensitiveField ? '[REDACTED]' : replaceContractToken(rawVal, contractId, 60),
        onclick: replaceContractToken(getAttrValue(attrs, 'onclick'), contractId, 160),
        onchange: replaceContractToken(getAttrValue(attrs, 'onchange'), contractId, 160),
      });
    } else if (type === 'hidden' && hiddenInputs.length < 15) {
      const sensitiveHidden =
        isSensitiveKey(name) ||
        isSensitiveKey(id) ||
        /viewstate|eventvalidation|requestverification|antiforgery|token|vr\d+/i.test(
          `${name} ${id}`
        );
      hiddenInputs.push({
        id,
        name,
        value: sensitiveHidden ? '[REDACTED]' : replaceContractToken(rawVal, contractId, 60),
      });
    }
  }

  return { selects, checkboxes, hiddenInputs };
}

/**
 * Trich xuat cac ham JS lien quan den ClearSerial / ReplaceMAC / OLT / Port tu file JS ben ngoai.
 */
export function extractMatchingFunctionsFromJs(
  jsText,
  keywordRe = DEFAULT_JS_FN_KEYWORD_RE,
  contractId = '',
  maxTotal = 12000
) {
  if (!jsText || typeof jsText !== 'string') {
    return [];
  }
  const re = keywordRe instanceof RegExp ? keywordRe : DEFAULT_JS_FN_KEYWORD_RE;
  const fnRe =
    /(?:function\s+([A-Za-z0-9_$]+)\s*\([^)]*\)|(?:(?:var|let|const)\s+)?([A-Za-z0-9_$]+)\s*=\s*(?:async\s+)?function\s*\([^)]*\))\s*\{/g;

  const functions = [];
  const seenNames = new Set();
  let remaining = maxTotal;
  let m;

  while ((m = fnRe.exec(jsText)) !== null && remaining > 0) {
    const name = m[1] || m[2] || '';
    if (!name || seenNames.has(name)) {
      continue;
    }
    const braceIdx = m.index + m[0].length - 1;
    const block = extractBalancedBraces(jsText, braceIdx, 4500);
    if (!re.test(name) && !re.test(block)) {
      continue;
    }
    seenNames.add(name);
    const fullCode = jsText.slice(m.index, braceIdx) + block;
    const cleaned = sanitizeCodeSnippet(fullCode, contractId, Math.min(4500, remaining));
    if (cleaned) {
      functions.push({
        name,
        code: cleaned,
      });
      remaining -= cleaned.length;
    }
  }

  return functions;
}

const DEFAULT_JS_CONTEXT_RE =
  /(?:fetch\s*\(|axios\.|\/api\/|connection-parameters|online-session|OLT|oltName|slot|port|ObjID|ipnat|ipv6)/gi;

const SPA_VENDOR_CHUNK_RE =
  /(?:jquery|kendo|bootstrap|modernizr|toastr|jszip|xlsx|moment|lodash|popper|fontawesome|select2|datatables|chart\.js|echarts|polyfill|fullcalendar|vuetify|iconify|mdi)/i;
const SPA_ROUTE_CHUNK_RE = /(?:\/chunks\/app\/|\/page-)/i;
const MAX_SPA_CHUNK_URLS = 60;

/**
 * Trich xuat danh sach chunk JS/MJS cung origin tu HTML (<link modulepreload>, <script src>) va PerformanceResourceTiming.
 */
export function extractSpaChunkUrls(htmlText, baseUrl = '', perfEntries = []) {
  let baseOrigin = '';
  if (baseUrl) {
    try {
      baseOrigin = new URL(baseUrl).origin;
    } catch {
      baseOrigin = '';
    }
  }

  const urls = [];
  const seen = new Set();

  function addCandidate(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string' || urls.length >= MAX_SPA_CHUNK_URLS) {
      return;
    }
    const trimmed = rawUrl.trim();
    if (!trimmed || /^\s*(?:javascript:|data:|blob:)/i.test(trimmed)) {
      return;
    }
    try {
      const parsed = baseUrl ? new URL(trimmed, baseUrl) : new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return;
      }
      if (baseOrigin && parsed.origin !== baseOrigin) {
        return;
      }
      if (!/\.(?:m?js)$/i.test(parsed.pathname || '')) {
        return;
      }
      if (SPA_VENDOR_CHUNK_RE.test(parsed.pathname || '')) {
        return;
      }
      if (!seen.has(parsed.href)) {
        seen.add(parsed.href);
        urls.push(parsed.href);
      }
    } catch {
      // Bo qua URL khong hop le
    }
  }

  if (typeof htmlText === 'string' && htmlText) {
    const cleanedHtml = htmlText.replace(
      new RegExp('<style\\b[^>]*>[\\s\\S]*?</' + 'style>', 'gi'),
      ' '
    );
    const linkRe = /<link\b([^>]*)>/gi;
    let lm;
    while ((lm = linkRe.exec(cleanedHtml)) !== null && urls.length < MAX_SPA_CHUNK_URLS) {
      const attrs = lm[1] || '';
      const rel = getAttrValue(attrs, 'rel');
      if (!/\b(?:modulepreload|preload|prefetch)\b/i.test(rel)) {
        continue;
      }
      const href = getAttrValue(attrs, 'href');
      if (href) {
        addCandidate(href);
      }
    }

    const scriptTagRe = /<script\b([^>]*)>/gi;
    let sm;
    while ((sm = scriptTagRe.exec(cleanedHtml)) !== null && urls.length < MAX_SPA_CHUNK_URLS) {
      const src = getAttrValue(sm[1] || '', 'src');
      if (src) {
        addCandidate(src);
      }
    }
  }

  if (Array.isArray(perfEntries)) {
    for (const entry of perfEntries) {
      if (urls.length >= MAX_SPA_CHUNK_URLS) break;
      const rawName = typeof entry === 'string' ? entry : entry && entry.name;
      if (typeof rawName === 'string' && rawName) {
        addCandidate(rawName);
      }
    }
  }

  const routeUrls = [];
  const otherUrls = [];
  for (const u of urls) {
    if (SPA_ROUTE_CHUNK_RE.test(u)) {
      routeUrls.push(u);
    } else {
      otherUrls.push(u);
    }
  }
  return [...routeUrls, ...otherUrls];
}

/**
 * Trich xuat URL Next.js App Router chunk (app/.../page-*.js) tu HTML/RSC payload.
 */
export function extractNextAppChunkUrls(
  htmlText,
  baseUrl = 'http://radius-portal.fpt.net/'
) {
  if (!htmlText || typeof htmlText !== 'string') {
    return [];
  }
  let origin = 'http://radius-portal.fpt.net';
  try {
    origin = new URL(baseUrl || 'http://radius-portal.fpt.net/').origin;
  } catch {
    origin = 'http://radius-portal.fpt.net';
  }

  const normalized = htmlText.replace(/\\\//g, '/');
  const chunkRe = /(?:\/_next\/)?static\/chunks\/app\/[a-zA-Z0-9_\/-]+\.js/g;
  const routeUrls = [];
  const otherUrls = [];
  const seen = new Set();
  let m;

  while ((m = chunkRe.exec(normalized)) !== null && seen.size < 20) {
    const cleanRel = m[0].replace(/^\/?_next\//, '').replace(/^\//, '');
    if (SPA_VENDOR_CHUNK_RE.test(cleanRel)) {
      continue;
    }
    const fullUrl = `${origin}/_next/${cleanRel}`;
    if (!seen.has(fullUrl)) {
      seen.add(fullUrl);
      if (/\/(?:public\/partial\/|page-[^/]+\.js$)/.test(fullUrl) || !/\/(?:layout|loading|not-found)-/.test(fullUrl)) {
        routeUrls.push(fullUrl);
      } else {
        otherUrls.push(fullUrl);
      }
    }
  }

  return [...routeUrls, ...otherUrls].slice(0, 16);
}

/**
 * Trich xuat doan code ngu canh quanh tu khoa API / OLT trong bundle JS (da an du lieu nhay cam).
 */
export function extractCodeContextsFromJs(
  jsText,
  keywordRe = DEFAULT_JS_CONTEXT_RE,
  contractId = '',
  maxTotalOrOpts = 10000
) {
  if (!jsText || typeof jsText !== 'string') {
    return [];
  }
  const opts =
    typeof maxTotalOrOpts === 'object' && maxTotalOrOpts !== null
      ? maxTotalOrOpts
      : { maxTotal: Number(maxTotalOrOpts) || 10000 };
  const maxTotal = Math.max(500, Number(opts.maxTotal) || 10000);
  const maxContexts = Math.max(1, Number(opts.maxContexts) || 30);
  const radius = Math.max(80, Number(opts.radius) || 220);

  const baseRe = keywordRe instanceof RegExp ? keywordRe : DEFAULT_JS_CONTEXT_RE;
  const flags = baseRe.flags.includes('g') ? baseRe.flags : `${baseRe.flags}g`;
  const re = new RegExp(baseRe.source, flags);

  const contexts = [];
  let remaining = maxTotal;
  let lastCenter = -1000;
  const minSpacing = Math.max(160, Math.floor(radius * 0.9));
  let m;

  while ((m = re.exec(jsText)) !== null && remaining > 0 && contexts.length < maxContexts) {
    if (m.index - lastCenter < minSpacing) {
      continue;
    }
    lastCenter = m.index;
    const start = Math.max(0, m.index - Math.floor(radius * 0.65));
    const end = Math.min(jsText.length, m.index + radius);
    const slice = jsText.slice(start, end);
    const cleaned = sanitizeCodeSnippet(slice, contractId, Math.min(radius * 2, remaining));
    if (cleaned) {
      contexts.push(cleaned);
      remaining -= cleaned.length;
    }
  }

  return contexts;
}

/**
 * Dong goi bao cao JSON sach se de nguoi dung copy hoac tai ve gui AI ghep API.
 */
export function buildScanReport({
  domSnapshot = null,
  networkEntries = [],
  deepScan = null,
  portalId = 'inside',
}) {
  const payload = {
    reportVersion: 'remote-inside-scan-v1',
    portalId,
    generatedAt: new Date().toISOString(),
    privacyNote:
      'Mat khau, cookie, token va thong tin ca nhan khach hang da duoc an tu dong.',
    domSnapshot,
    networkEntries,
  };
  if (deepScan) {
    payload.deepScan = deepScan;
  }
  return JSON.stringify(payload, null, 2);
}
