/**
 * Adapter xu ly nghiep vu FTTH NEW Port cho cong port.fpt.net / mvcport.fpt.net:
 * - Xem Port hien tai (Index_Search + Insert/<ID> / LoadData)
 * - Cap / Doi Port (Cascade Vung -> Chi nhanh -> POP -> Hop dau noi -> Port + Lich su Port)
 * - Thu hoi Port (Insert_UpdateContact voi status=6)
 */

import { PORTALS, validateContractId } from '../config/portals.js';
import {
  detectIamRedirect,
  isUserscriptEnv,
  requestPortal,
  sleep,
} from '../core/transport.js';

export const PORT_ENDPOINTS = {
  lookup_port: 'http://mvcport.fpt.net/FTTH_NewPort/Contract/Index_Search',
  assign_port: 'http://mvcport.fpt.net/FTTH_NewPort/Contract/InsertContract',
  release_port: 'http://mvcport.fpt.net/FTTH_NewPort/Contract/Insert_UpdateContact',
  portIndexPage: 'http://port.fpt.net/Index.aspx',
  indexPage: 'http://mvcport.fpt.net/ftth_newport/contract/index',
  insertPage: 'http://mvcport.fpt.net/FTTH_NewPort/Contract/Insert',
  search: 'http://mvcport.fpt.net/FTTH_NewPort/Contract/Index_Search',
  loadData: 'http://mvcport.fpt.net/FTTH_NewPort/Contract/LoadData',
  loadPort: 'http://mvcport.fpt.net/Contract/Load_PortContract',
  loadPortHistory: 'http://mvcport.fpt.net/FTTH_NewPort/Contract/LoadPortHistoryList',
  insertContract: 'http://mvcport.fpt.net/FTTH_NewPort/Contract/InsertContract',
  updateContract: 'http://mvcport.fpt.net/FTTH_NewPort/Contract/Insert_UpdateContact',
  locations: 'http://mvcport.fpt.net/Location/LocationID',
  branches: 'http://mvcport.fpt.net/Location/GetBranch',
  pops: 'http://mvcport.fpt.net/FTTH/Switch_FTTH/GetPopINF',
  conboxes: 'http://mvcport.fpt.net/Location/Load_ConnectingBox_ByName_DeployCapacity',
  libJs: 'http://mvcport.fpt.net/js/lib.js',
};

const PORT_AJAX_HEADERS = {
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
  'X-Requested-With': 'XMLHttpRequest',
};

const PORT_CONTRACT_CACHE = new Map();
const CONTRACT_TTL_MS = 5 * 60 * 1000;
const META_TTL_MS = 10 * 60 * 1000;

let cachedLocations = { items: null, expiresAt: 0 };
const cachedBranchesByLoc = new Map();
let cachedConboxParamSpec = { specs: null, expiresAt: 0 };

function safeJsonParse(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return null;
  }
  const trimmed = rawText.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getHtmlAttr(attrs, attrName) {
  const re = new RegExp(`\\b${escapeRegExp(attrName)}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const m = String(attrs || '').match(re);
  if (!m) return '';
  return m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3] || '';
}

/**
 * Giai ma HTML entities (bao gom ma thap phan & hex tieng Viet trong ASP.NET MVC).
 */
export function decodeHtmlEntities(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (orig, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : orig;
    })
    .replace(/&#x([0-9a-f]+);/gi, (orig, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : orig;
    });
}

function stripHtmlClean(html) {
  return decodeHtmlEntities(
    String(html || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

export function clearPortContractCache(rawContractId) {
  if (!rawContractId) {
    PORT_CONTRACT_CACHE.clear();
    return;
  }
  const clean = String(rawContractId).trim().toUpperCase();
  for (const key of Array.from(PORT_CONTRACT_CACHE.keys())) {
    if (key.startsWith(`${clean}:`)) {
      PORT_CONTRACT_CACHE.delete(key);
    }
  }
}

let cachedMvcPortToken = '';
let portBootstrapInFlight = null;

function safeDecodeToken(raw) {
  if (!raw || typeof raw !== 'string') return '';
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

export function parseMvcPortTokenFromCookieString(rawCookies) {
  if (!rawCookies || typeof rawCookies !== 'string') {
    return '';
  }
  let baseMatch = '';
  let suffixedMatch = '';
  for (const part of rawCookies.split(';')) {
    const trimmed = part.trim();
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx <= 0) continue;
    const name = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!val) continue;
    if (name === 'MVCPORT_TOKEN') {
      baseMatch = safeDecodeToken(val);
    } else if (name.indexOf('MVCPORT_TOKEN_') === 0) {
      suffixedMatch = safeDecodeToken(val);
    }
  }
  return suffixedMatch || baseMatch || '';
}

export function extractMvcPortTokenFromText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  const mvcMatch = text.match(
    /https?:\\?\/\\?\/mvcport\.fpt\.net\\?\/[^"'<>\s]*?(?:[?&]|&amp;)Token=([^"'&<>\s#\\]+)/i
  );
  if (mvcMatch && mvcMatch[1]) {
    return safeDecodeToken(mvcMatch[1]);
  }
  const leftMenuMatch = text.match(
    /LeftMenu\.aspx[^"'<>\s]*?(?:[?&]|&amp;)mvct=([^"'&<>\s#\\]+)/i
  );
  if (leftMenuMatch && leftMenuMatch[1]) {
    return safeDecodeToken(leftMenuMatch[1]);
  }
  const mvctParamMatch = text.match(/(?:[?&]|&amp;)mvct=([^"'&<>\s#\\]+)/i);
  if (mvctParamMatch && mvctParamMatch[1]) {
    return safeDecodeToken(mvctParamMatch[1]);
  }
  return '';
}

function readTokenFromPortLocation(loc) {
  try {
    if (!loc) return '';
    const host = String(loc.hostname || '').toLowerCase();
    if (!host.endsWith('mvcport.fpt.net') && !host.endsWith('port.fpt.net')) {
      return '';
    }
    const rawSearch = String(loc.search || '');
    const tokenMatch = rawSearch.match(/[?&]Token=([^&#]+)/i);
    if (tokenMatch && tokenMatch[1]) {
      return safeDecodeToken(tokenMatch[1]);
    }
    if (host.endsWith('port.fpt.net')) {
      const mvctMatch = rawSearch.match(/[?&]mvct=([^&#]+)/i);
      if (mvctMatch && mvctMatch[1]) {
        return safeDecodeToken(mvctMatch[1]);
      }
    }
    return '';
  } catch {
    return '';
  }
}

function appendPortTokenToUrl(rawUrl, token) {
  if (!token) return rawUrl;
  try {
    const u = new URL(rawUrl);
    if (!/mvcport\.fpt\.net$/i.test(u.hostname) || u.searchParams.has('Token')) {
      return rawUrl;
    }
    u.searchParams.set('Token', token);
    return u.toString();
  } catch {
    return rawUrl;
  }
}

function collectPortCandidateWindows(entryWin) {
  if (!entryWin) return [];
  const roots = [entryWin];
  try {
    if (entryWin.top) roots.push(entryWin.top);
  } catch {
    // ignore cross-origin top access
  }
  try {
    if (typeof unsafeWindow !== 'undefined' && unsafeWindow && unsafeWindow.top) {
      roots.push(unsafeWindow.top);
    }
  } catch {
    // ignore cross-origin unsafeWindow top access
  }

  const visited = new Set();
  const list = [];
  for (const rootWin of roots) {
    const windowsToCheck = [rootWin];
    try {
      const frameCount = rootWin && rootWin.frames ? Math.min(rootWin.frames.length, 12) : 0;
      for (let i = 0; i < frameCount; i += 1) {
        windowsToCheck.push(rootWin.frames[i]);
      }
    } catch {
      // ignore cross-origin frame list
    }
    for (const candidateWin of windowsToCheck) {
      if (!candidateWin || visited.has(candidateWin)) continue;
      visited.add(candidateWin);
      list.push(candidateWin);
    }
  }
  return list;
}

function readTokenFromPortFrame(win) {
  try {
    if (!win || !win.location) return '';
    const host = String(win.location.hostname || '').toLowerCase();
    if (!host.endsWith('mvcport.fpt.net') && !host.endsWith('port.fpt.net')) {
      return '';
    }
    const locToken = readTokenFromPortLocation(win.location);
    if (locToken) return locToken;

    const doc = win.document;
    if (!doc) return '';

    const cookieToken = parseMvcPortTokenFromCookieString(
      typeof doc.cookie === 'string' ? doc.cookie : ''
    );
    if (cookieToken) return cookieToken;

    const frameEls = doc.querySelectorAll('frame[src], iframe[src]');
    for (const frameEl of frameEls) {
      const srcAttr = frameEl.getAttribute('src') || '';
      const extracted = extractMvcPortTokenFromText(srcAttr) || extractMvcPortTokenFromText(frameEl.src || '');
      if (extracted) return extracted;
      if (frameEl.src) {
        try {
          const parsedFrameUrl = new URL(frameEl.src);
          const locTok = readTokenFromPortLocation(parsedFrameUrl);
          if (locTok) return locTok;
        } catch {
          // ignore invalid frame URL
        }
      }
    }

    const candidates = doc.querySelectorAll(
      'a[href*="mvcport.fpt.net"], a[href*="Token="], [onclick*="mvcport.fpt.net"], [onclick*="Token="]'
    );
    for (const node of candidates) {
      const hrefAttr = node.getAttribute('href') || '';
      const onclickAttr = node.getAttribute('onclick') || '';
      const extracted =
        extractMvcPortTokenFromText(hrefAttr) ||
        extractMvcPortTokenFromText(onclickAttr) ||
        extractMvcPortTokenFromText(node.href || '');
      if (extracted) return extracted;
      if (node.href) {
        try {
          const u = new URL(node.href);
          if (u.hostname.toLowerCase().endsWith('mvcport.fpt.net')) {
            const qTok = readTokenFromPortLocation(u);
            if (qTok) return qTok;
          }
        } catch {
          // ignore invalid href URL
        }
      }
    }

    if (host.endsWith('port.fpt.net') && doc.documentElement) {
      const htmlToken = extractMvcPortTokenFromText(doc.documentElement.innerHTML || '');
      if (htmlToken) return htmlToken;
    }
  } catch {
    return '';
  }
  return '';
}

function getMvcPortTokenFromPage() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return '';
  }
  try {
    const host = (window.location && window.location.hostname ? window.location.hostname : '').toLowerCase();
    if (host === 'fpt.net' || host.endsWith('.fpt.net')) {
      const docToken = parseMvcPortTokenFromCookieString(
        typeof document.cookie === 'string' ? document.cookie : ''
      );
      if (docToken) {
        cachedMvcPortToken = docToken;
        return docToken;
      }
      try {
        if (typeof unsafeWindow !== 'undefined' && unsafeWindow && unsafeWindow.document) {
          const unsafeToken = parseMvcPortTokenFromCookieString(
            typeof unsafeWindow.document.cookie === 'string' ? unsafeWindow.document.cookie : ''
          );
          if (unsafeToken) {
            cachedMvcPortToken = unsafeToken;
            return unsafeToken;
          }
        }
      } catch {
        // ignore unsafeWindow cookie access errors
      }
    }

    const locToken = readTokenFromPortLocation(window.location);
    if (locToken) {
      cachedMvcPortToken = locToken;
      return locToken;
    }

    const candidateWins = collectPortCandidateWindows(window);
    for (const candidateWin of candidateWins) {
      const frameToken = readTokenFromPortFrame(candidateWin);
      if (frameToken) {
        cachedMvcPortToken = frameToken;
        return frameToken;
      }
    }

    return cachedMvcPortToken || '';
  } catch {
    return cachedMvcPortToken || '';
  }
}

export function buildPortUrl(rawUrl) {
  return appendPortTokenToUrl(rawUrl, getMvcPortTokenFromPage());
}

export async function bootstrapMvcPortSession() {
  if (!isUserscriptEnv()) {
    return { ok: false, reason: 'preview' };
  }
  if (portBootstrapInFlight) {
    return portBootstrapInFlight;
  }

  portBootstrapInFlight = (async () => {
    async function fetchTokenFromPortIndex() {
      const idxRes = await requestPortal({
        url: PORT_ENDPOINTS.portIndexPage,
        method: 'GET',
        timeout: 8000,
      });
      if (!idxRes || !idxRes.ok) {
        return '';
      }
      const idxFinalUrl = String(idxRes.finalUrl || '');
      const idxBody = String(idxRes.responseText || '');
      if (
        /\/LoginPage\.aspx(?:\?|$|#)/i.test(idxFinalUrl) ||
        /https?:\/\/[^/]*(?:iam|sso|login|auth|signin|oauth|cas)/i.test(idxFinalUrl) ||
        /<input[^>]+type\s*=\s*["']?password["']?/i.test(idxBody)
      ) {
        return '';
      }
      const extracted = extractMvcPortTokenFromText(idxBody);
      if (extracted) {
        cachedMvcPortToken = extracted;
        return extracted;
      }
      return '';
    }

    let token = getMvcPortTokenFromPage();
    let fetchedIndex = false;
    if (!token) {
      fetchedIndex = true;
      token = await fetchTokenFromPortIndex();
    }
    if (!token) {
      return { ok: false, reason: 'no_token' };
    }

    const warmUrl = appendPortTokenToUrl(PORT_ENDPOINTS.indexPage, token);
    const warmRes = await requestPortal({ url: warmUrl, method: 'GET', timeout: 10000 });
    if (warmRes && warmRes.ok && !detectPortSessionExpired(warmRes, warmUrl).expired) {
      return { ok: true, res: warmRes };
    }

    if (!fetchedIndex) {
      cachedMvcPortToken = '';
      const freshToken = await fetchTokenFromPortIndex();
      if (freshToken && freshToken !== token) {
        const warmUrl2 = appendPortTokenToUrl(PORT_ENDPOINTS.indexPage, freshToken);
        const warmRes2 = await requestPortal({ url: warmUrl2, method: 'GET', timeout: 10000 });
        if (warmRes2 && warmRes2.ok && !detectPortSessionExpired(warmRes2, warmUrl2).expired) {
          return { ok: true, res: warmRes2 };
        }
      }
    }

    return { ok: false, reason: 'warmup_rejected', res: warmRes };
  })().finally(() => {
    portBootstrapInFlight = null;
  });

  return portBootstrapInFlight;
}

export function triggerPortFtthMenuAction(win = typeof window !== 'undefined' ? window : null) {
  if (!win) return false;
  const candidateWins = collectPortCandidateWindows(win);
  for (const candidate of candidateWins) {
    try {
      const frameName = String(candidate.name || '').toLowerCase();
      const pathname =
        candidate.location && candidate.location.pathname
          ? String(candidate.location.pathname).toLowerCase()
          : '';
      if (frameName !== 'leftframe' && !pathname.includes('leftmenu.aspx')) {
        continue;
      }
      if (typeof candidate.Action === 'function') {
        candidate.Action(1322);
        return true;
      }
      const doc = candidate.document;
      if (doc && doc.querySelector) {
        const link = doc.querySelector('[onclick*="Action(1322)"]');
        if (link && typeof link.click === 'function') {
          link.click();
          return true;
        }
      }
    } catch {
      // ignore cross-origin or detached frame errors
    }
  }
  return false;
}

export function detectPortSessionExpired(res, requestedUrl) {
  const status = (res && res.status) || 0;
  const finalUrl = (res && res.finalUrl) || '';
  const body = (res && res.responseText) || '';

  const iam = detectIamRedirect({
    status,
    finalUrl,
    responseText: body,
    requestedUrl,
  });
  if (iam.expired) {
    return { expired: true, reason: iam.reason };
  }
  if (/LoginPage\.aspx/i.test(finalUrl)) {
    return {
      expired: true,
      reason: 'Phiên đăng nhập port.fpt.net đã chuyển về trang LoginPage.aspx.',
    };
  }
  const trimmedBody = body.trim();
  const looksHtmlPage = /<(?:!doctype|html|head|body|script|div|select|input|table)\b/i.test(trimmedBody);
  if (
    !looksHtmlPage &&
    trimmedBody.length < 500 &&
    /Hết thời gian làm việc|Vui lòng Refesh/i.test(trimmedBody)
  ) {
    return {
      expired: true,
      reason: 'Máy chủ Port báo hết thời gian làm việc (cần đăng nhập lại port.fpt.net).',
    };
  }
  return { expired: false, reason: '' };
}

async function portRequest({
  url,
  method = 'POST',
  data = null,
  headers = PORT_AJAX_HEADERS,
  timeout = 15000,
  _didBootstrap = false,
}) {
  const targetUrl = buildPortUrl(url);
  const res = await requestPortal({ url: targetUrl, method, data, headers, timeout });

  if (res.error === 'NETWORK_ERROR' || res.error === 'TIMEOUT' || res.status === 0) {
    return {
      ok: false,
      statusType: 'error',
      message: 'Không kết nối được tới mvcport.fpt.net. Hãy kiểm tra VPN công ty.',
      loginUrl: PORTALS.port.url,
      res,
    };
  }

  const expiredCheck = detectPortSessionExpired(res, targetUrl);
  if (expiredCheck.expired) {
    if (!_didBootstrap) {
      const boot = await bootstrapMvcPortSession();
      if (boot && boot.ok) {
        return portRequest({ url, method, data, headers, timeout, _didBootstrap: true });
      }
    }
    if (_didBootstrap) {
      cachedMvcPortToken = '';
    }
    let onLoggedInPortHost = false;
    try {
      if (typeof window !== 'undefined' && window.location) {
        const h = String(window.location.hostname || '').toLowerCase();
        const p = String(window.location.pathname || '');
        onLoggedInPortHost = h === 'port.fpt.net' && !/LoginPage\.aspx/i.test(p);
      }
    } catch {
      onLoggedInPortHost = false;
    }
    return {
      ok: false,
      statusType: 'iam_expired',
      message: onLoggedInPortHost
        ? 'Bạn đã đăng nhập port.fpt.net nhưng phiên FTTH NEW (mvcport.fpt.net) chưa được kích hoạt. Bấm nút "Kích hoạt FTTH NEW ngay" bên dưới hoặc chọn menu trái: FTTH NEW → Hợp đồng → Tìm kiếm 1 lần rồi bấm thử lại (không cần đăng nhập lại hay F5).'
        : 'Phiên đăng nhập Port (port.fpt.net) đã hết hạn hoặc chưa kích hoạt FTTH NEW. Bấm nút bên dưới để mở port.fpt.net đăng nhập rồi vào menu FTTH NEW → Hợp đồng → Tìm kiếm 1 lần (không cần F5).',
      loginUrl: PORTALS.port.url,
      res,
    };
  }

  if (!res.ok) {
    return {
      ok: false,
      statusType: 'error',
      message: `Máy chủ Port trả về mã HTTP ${res.status}.`,
      loginUrl: PORTALS.port.url,
      res,
    };
  }

  return { ok: true, res };
}

/**
 * Tach danh sach { value, label } tu API dropdown ASP.NET MVC [{ Value, Text }].
 */
export function parseDropdownOptions(json) {
  const list = Array.isArray(json)
    ? json
    : json && typeof json === 'object' && Array.isArray(json.data)
    ? json.data
    : [];
  const options = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const rawVal =
      item.Value !== undefined
        ? item.Value
        : item.value !== undefined
        ? item.value
        : '';
    const rawLabel =
      item.Text !== undefined
        ? item.Text
        : item.text !== undefined
        ? item.text
        : '';
    const value = String(rawVal ?? '').trim();
    const label = decodeHtmlEntities(String(rawLabel ?? '')).trim();
    if (!value && !label) continue;
    options.push({ value, label: label || value });
  }
  return options;
}

const DEFAULT_CONBOX_PARAM_SPECS = [
  { key: 'PopName', argIndex: 0 },
  { key: 'type', argIndex: 1 },
  { key: 'status', argIndex: 2 },
];

/**
 * Tu dong doc ten tham so POST cua Load_ConnectingBox_ByName_DeployCapacity trong /js/lib.js.
 */
export function parseConboxParamsFromLibJs(jsText) {
  if (!jsText || typeof jsText !== 'string') {
    return DEFAULT_CONBOX_PARAM_SPECS;
  }
  const fnMatch = jsText.match(/function\s+Load_ConnectingBox_ByName_DeployCapacity\s*\(([^)]*)\)/i);
  if (!fnMatch || fnMatch.index === undefined) {
    return DEFAULT_CONBOX_PARAM_SPECS;
  }
  const formalParams = fnMatch[1]
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  const fnSlice = jsText.slice(fnMatch.index, fnMatch.index + 1600);
  if (!/Load_ConnectingBox_ByName_DeployCapacity/i.test(fnSlice)) {
    return DEFAULT_CONBOX_PARAM_SPECS;
  }
  const dataMatch = fnSlice.match(/\bdata\s*:\s*\{([^}]*)\}/i);
  if (!dataMatch) {
    return DEFAULT_CONBOX_PARAM_SPECS;
  }

  const specs = [];
  const entries = dataMatch[1].split(',');
  for (const entry of entries) {
    const colonIdx = entry.indexOf(':');
    if (colonIdx <= 0) continue;
    const key = entry.slice(0, colonIdx).replace(/['"\s]/g, '').trim();
    const rhs = entry.slice(colonIdx + 1).trim();
    if (!key) continue;

    let matchedArgIdx = -1;
    for (let i = 0; i < formalParams.length; i += 1) {
      const pName = formalParams[i];
      if (new RegExp(`\\b${escapeRegExp(pName)}\\b`).test(rhs)) {
        matchedArgIdx = i;
        break;
      }
    }
    if (matchedArgIdx >= 0) {
      specs.push({ key, argIndex: matchedArgIdx });
    } else if (/^['"]?[-.\w]+['"]?$/.test(rhs)) {
      specs.push({ key, argIndex: -1, literalValue: rhs.replace(/^['"]|['"]$/g, '') });
    }
  }

  return specs.length > 0 ? specs : DEFAULT_CONBOX_PARAM_SPECS;
}

function readInputValueById(html, id) {
  const inputRe = /<input\b([^>]*)>/gi;
  const target = id.toLowerCase();
  let m;
  while ((m = inputRe.exec(html)) !== null) {
    const attrs = m[1] || '';
    const elId = getHtmlAttr(attrs, 'id').toLowerCase();
    const elName = getHtmlAttr(attrs, 'name').toLowerCase();
    if (elId === target || elName === target) {
      return decodeHtmlEntities(getHtmlAttr(attrs, 'value')).trim();
    }
  }
  return '';
}

function readTextareaValueById(html, id) {
  const re = new RegExp(
    `<textarea\\b[^>]*\\b(?:id|name)\\s*=\\s*["']${escapeRegExp(id)}["'][^>]*>([\\s\\S]*?)<\\/textarea>`,
    'i'
  );
  const m = String(html || '').match(re);
  return m ? decodeHtmlEntities(m[1]).trim() : '';
}

function readSelectOptionsById(html, id) {
  const selectRe = /<select\b([^>]*)>([\s\S]*?)<\/select>/gi;
  const target = id.toLowerCase();
  let sm;
  while ((sm = selectRe.exec(html)) !== null) {
    const attrs = sm[1] || '';
    const elId = getHtmlAttr(attrs, 'id').toLowerCase();
    const elName = getHtmlAttr(attrs, 'name').toLowerCase();
    if (elId !== target && elName !== target) {
      continue;
    }
    const body = sm[2] || '';
    const opts = [];
    const optRe = /<option\b([^>]*)>([\s\S]*?)<\/option>/gi;
    let om;
    while ((om = optRe.exec(body)) !== null) {
      const oAttrs = om[1] || '';
      const value = decodeHtmlEntities(getHtmlAttr(oAttrs, 'value')).trim();
      const label = stripHtmlClean(om[2] || '');
      const selected = /\bselected\b/i.test(oAttrs);
      opts.push({ value, label: label || value, selected });
    }
    return opts;
  }
  return [];
}

function extractElementTextById(html, id) {
  const escaped = escapeRegExp(id);
  const blockRe = new RegExp(
    `<(div|span|td|p|label|lable)\\b[^>]*\\bid\\s*=\\s*["']${escaped}["'][^>]*>([\\s\\S]*?)<\\/\\1>`,
    'i'
  );
  const m = String(html || '').match(blockRe);
  return m ? stripHtmlClean(m[2]) : '';
}

/**
 * Phan tich trang chi tiet hop dong /FTTH_NewPort/Contract/Insert/<ID>.
 */
export function parsePortContractDetailHtml(htmlText) {
  if (!htmlText || typeof htmlText !== 'string') {
    return null;
  }
  const cleanHtml = htmlText
    .replace(new RegExp('<script\\b[^>]*>[\\s\\S]*?</' + 'script>', 'gi'), ' ')
    .replace(new RegExp('<style\\b[^>]*>[\\s\\S]*?</' + 'style>', 'gi'), ' ');

  const typeContractOptions = readSelectOptionsById(cleanHtml, 'cbo_typeContract');
  const statusOptions = readSelectOptionsById(cleanHtml, 'cbo_Status');
  const statusPortOptions = readSelectOptionsById(cleanHtml, 'cbo_statusPort');

  const id = readInputValueById(cleanHtml, 'h_id');
  const rawTypeContract =
    readInputValueById(cleanHtml, 'h_typeContract') ||
    (typeContractOptions.find((o) => o.selected) || {}).value ||
    '3';
  const rawStatus =
    readInputValueById(cleanHtml, 'h_status') ||
    (statusOptions.find((o) => o.selected) || {}).value ||
    '';
  const rawStatusPort =
    readInputValueById(cleanHtml, 'h_valueStatusPort') ||
    (statusPortOptions.find((o) => o.selected) || {}).value ||
    '';

  const statusMatched = statusOptions.find((o) => o.value === rawStatus) || statusOptions.find((o) => o.selected);
  const typeMatched =
    typeContractOptions.find((o) => o.value === rawTypeContract) ||
    typeContractOptions.find((o) => o.selected);
  const statusPortMatched =
    statusPortOptions.find((o) => o.value === rawStatusPort) ||
    statusPortOptions.find((o) => o.selected);

  const releaseOpt = statusPortOptions.find((o) => /thu\s*h[oồ]i/i.test(o.label));
  const reassignOpt =
    statusPortOptions.find((o) => o.value === '3') ||
    statusPortOptions.find((o) => /c[aấ]p\s*(?:l[aạ]i|port)/i.test(o.label));

  return {
    id,
    contractName: readInputValueById(cleanHtml, 'txtContact'),
    typeContract: rawTypeContract,
    typeContractLabel: (typeMatched && typeMatched.label) || (rawTypeContract === '5' ? 'FTTH_NEW LeaseLine' : 'FTTH_New'),
    status: rawStatus,
    statusLabel: (statusMatched && statusMatched.label) || (rawStatus === '6' ? 'Đã thu hồi port' : rawStatus === '1' ? 'Bình thường' : ''),
    statusPort: rawStatusPort,
    statusPortLabel: (statusPortMatched && statusPortMatched.label) || '',
    releaseStatusPortValue: (releaseOpt && releaseOpt.value) || '2',
    reassignStatusPortValue: (reassignOpt && reassignOpt.value) || '3',
    customer: readInputValueById(cleanHtml, 'txtCustomer'),
    cmnd: readInputValueById(cleanHtml, 'txtCMND'),
    company: readInputValueById(cleanHtml, 'txtCompany'),
    address: readInputValueById(cleanHtml, 'txtAddress'),
    email: readInputValueById(cleanHtml, 'txtEmail'),
    // Luu y: trang Insert gốc gan handphone <- #txtHomePhone va telephone <- #txtTelephone
    handphone: readInputValueById(cleanHtml, 'txtHomePhone'),
    telephone: readInputValueById(cleanHtml, 'txtTelephone'),
    localType: readInputValueById(cleanHtml, 'txtLocalType'),
    cardNumber: readInputValueById(cleanHtml, 'txtCardNumber'),
    description: readTextareaValueById(cleanHtml, 'txtDescription'),
    createBy: readInputValueById(cleanHtml, 'txtCreateBy'),
    createDate: readInputValueById(cleanHtml, 'txtCreateDate'),
    updateBy: readInputValueById(cleanHtml, 'txtUpdateBy'),
    updateDate: readInputValueById(cleanHtml, 'txtUpdateCreate'),
    tstc: extractElementTextById(cleanHtml, 'dvTSTC'),
    pc: extractElementTextById(cleanHtml, 'dvPC'),
    typeContractOptions,
    statusOptions,
    statusPortOptions,
  };
}

/**
 * Tach danh sach Port trong hop dau noi tu /Contract/Load_PortContract.
 */
export function parsePortOptionsFromHtml(rawResponse) {
  if (!rawResponse || typeof rawResponse !== 'string') {
    return [];
  }
  const maybeJson = safeJsonParse(rawResponse);
  const html = typeof maybeJson === 'string' ? maybeJson : rawResponse;

  const cleanHtml = html
    .replace(new RegExp('<script\\b[^>]*>[\\s\\S]*?</' + 'script>', 'gi'), ' ')
    .replace(new RegExp('<style\\b[^>]*>[\\s\\S]*?</' + 'style>', 'gi'), ' ');

  const slots = [];
  const seen = new Set();
  const inputRe = /<input\b([^>]*)>/gi;
  let im;

  while ((im = inputRe.exec(cleanHtml)) !== null) {
    const attrs = im[1] || '';
    const type = getHtmlAttr(attrs, 'type').toLowerCase();
    const id = getHtmlAttr(attrs, 'id');
    if (type !== 'radio' && id.toLowerCase() !== 'radport') {
      continue;
    }
    const portID = decodeHtmlEntities(getHtmlAttr(attrs, 'value')).trim();
    if (!portID || seen.has(portID)) {
      continue;
    }
    seen.add(portID);

    const disabled = /\bdisabled\b/i.test(attrs);
    const checked = /\bchecked\b/i.test(attrs);

    const tail = cleanHtml.slice(inputRe.lastIndex, inputRe.lastIndex + 160);
    const stopMatch = tail.match(/^([\s\S]*?)(?:<\/label>|<\/li>|<\/td>|<\/span>|<\/div>|<br\b|<input\b|$)/i);
    let portLabel = stripHtmlClean(stopMatch ? stopMatch[1] : '');

    if (!portLabel) {
      const before = cleanHtml.slice(Math.max(0, im.index - 120), im.index);
      const afterTag = before.replace(/^[\s\S]*<(?:label|li|td|span|div)[^>]*>/i, '');
      portLabel = stripHtmlClean(afterTag);
    }

    slots.push({
      portID,
      port: portLabel || portID,
      disabled,
      checked,
    });
  }

  return slots;
}

/**
 * Chuan hoa bang Lich su Port tu /FTTH_NewPort/Contract/LoadPortHistoryList.
 */
export function parsePortHistoryRows(json) {
  const rows = Array.isArray(json)
    ? json
    : json && typeof json === 'object' && Array.isArray(json.data)
    ? json.data
    : [];

  return rows
    .filter((r) => r && typeof r === 'object')
    .slice(0, 40)
    .map((r, idx) => ({
      stt: r.STT !== undefined && r.STT !== null ? String(r.STT) : String(idx + 1),
      actionDate: decodeHtmlEntities(String(r.ActionDate ?? r.actionDate ?? '')).trim(),
      createBy: decodeHtmlEntities(String(r.CreateBy ?? r.createBy ?? '')).trim(),
      port: decodeHtmlEntities(String(r.Port ?? r.port ?? '')).trim(),
      ip: decodeHtmlEntities(String(r.IP ?? r.ip ?? '')).trim(),
      action: decodeHtmlEntities(String(r.Action ?? r.action ?? '')).trim(),
      contractName: decodeHtmlEntities(String(r.ContractName ?? r.contractName ?? '')).trim(),
      data: decodeHtmlEntities(String(r.Data ?? r.data ?? '')).trim(),
    }));
}

/**
 * Chuan hoa phan hoi InsertContract / Insert_UpdateContact ([code, msg, tstc, pc]).
 */
export function parsePortMutationResponse(rawText, actionLabel, contractId) {
  const parsed = safeJsonParse(rawText);
  const summaryFields = [{ label: 'Mã hợp đồng', value: contractId }];

  if (Array.isArray(parsed) && parsed.length > 0) {
    const code = String(parsed[0] ?? '').trim();
    const msg = stripHtmlClean(String(parsed[1] ?? ''));
    const tstc = stripHtmlClean(String(parsed[2] ?? ''));
    const pc = stripHtmlClean(String(parsed[3] ?? ''));

    if (tstc) summaryFields.push({ label: 'Thông số Tập điểm / Port', value: tstc });
    if (pc) summaryFields.push({ label: 'Thông số kết nối', value: pc });
    if (msg) summaryFields.push({ label: 'Phản hồi hệ thống', value: msg });

    if (code === '1') {
      return {
        status: 'ok',
        mode: 'live',
        title: `${actionLabel} thành công (${contractId})`,
        message: msg || 'Máy chủ mvcport.fpt.net đã xác nhận cập nhật thành công.',
        tstc,
        pc,
        summaryFields,
      };
    }

    return {
      status: 'error',
      mode: 'live',
      title: `${actionLabel} chưa thành công`,
      message: msg || code || 'Máy chủ mvcport.fpt.net từ chối yêu cầu.',
      tstc,
      pc,
      summaryFields,
    };
  }

  const textMsg = stripHtmlClean(
    typeof parsed === 'string'
      ? parsed
      : parsed && typeof parsed === 'object'
      ? parsed.message || parsed.msg || parsed.Message || JSON.stringify(parsed)
      : String(rawText || '')
  );

  const looksError =
    !textMsg ||
    /(lỗi|error|fail|không|chưa|đã sử dụng|hết thời gian|trùng|từ chối)/i.test(textMsg);
  if (textMsg) {
    summaryFields.push({ label: 'Phản hồi hệ thống', value: textMsg });
  }

  if (looksError && !/thành công/i.test(textMsg)) {
    return {
      status: 'error',
      mode: 'live',
      title: `${actionLabel} chưa thành công`,
      message: textMsg || 'Máy chủ mvcport.fpt.net không trả về kết quả xác nhận.',
      summaryFields,
    };
  }

  return {
    status: 'ok',
    mode: 'live',
    title: `${actionLabel} thành công (${contractId})`,
    message: textMsg || 'Đã thực thi thành công trên mvcport.fpt.net.',
    summaryFields,
  };
}

export async function fetchPortLocations({ forceRefresh = false, forceDemo = false } = {}) {
  if (!isUserscriptEnv() || forceDemo) {
    return {
      status: 'ok',
      locations: [{ value: '35', label: 'VTU - Bà Rịa - Vũng Tàu (Mẫu)' }],
    };
  }
  if (!forceRefresh && cachedLocations.items && Date.now() < cachedLocations.expiresAt) {
    return { status: 'ok', locations: cachedLocations.items };
  }
  const resp = await portRequest({
    url: PORT_ENDPOINTS.locations,
    method: 'POST',
    data: '',
  });
  if (!resp.ok) {
    return { status: resp.statusType, message: resp.message, loginUrl: resp.loginUrl, locations: [] };
  }
  const items = parseDropdownOptions(safeJsonParse(resp.res.responseText));
  if (items.length > 0) {
    cachedLocations = { items, expiresAt: Date.now() + META_TTL_MS };
  }
  return { status: 'ok', locations: items };
}

export async function fetchPortBranches(locationId, { forceDemo = false } = {}) {
  if (!isUserscriptEnv() || forceDemo) {
    return {
      status: 'ok',
      branches: [{ value: '1', label: 'TP. Vũng Tàu (Mẫu)' }],
    };
  }
  const locKey = String(locationId || '0').trim();
  const cached = cachedBranchesByLoc.get(locKey);
  if (cached && Date.now() < cached.expiresAt) {
    return { status: 'ok', branches: cached.items };
  }
  const body = new URLSearchParams({
    locationid: String(Number(locKey) || 0),
    type: '0',
  }).toString();
  const resp = await portRequest({
    url: PORT_ENDPOINTS.branches,
    method: 'POST',
    data: body,
  });
  if (!resp.ok) {
    return { status: resp.statusType, message: resp.message, loginUrl: resp.loginUrl, branches: [] };
  }
  const items = parseDropdownOptions(safeJsonParse(resp.res.responseText));
  if (items.length > 0) {
    cachedBranchesByLoc.set(locKey, { items, expiresAt: Date.now() + META_TTL_MS });
  }
  return { status: 'ok', branches: items };
}

export async function fetchPortPops(locationId, branchId, { forceDemo = false } = {}) {
  if (!isUserscriptEnv() || forceDemo) {
    return {
      status: 'ok',
      pops: [
        { value: '101', label: 'BRUP07501' },
        { value: '102', label: 'BRUP00101' },
      ],
    };
  }
  const body = new URLSearchParams({
    locationID: String(locationId || ''),
    branchID: String(branchId || '0'),
    type: '0',
  }).toString();
  const resp = await portRequest({
    url: PORT_ENDPOINTS.pops,
    method: 'POST',
    data: body,
  });
  if (!resp.ok) {
    return { status: resp.statusType, message: resp.message, loginUrl: resp.loginUrl, pops: [] };
  }
  return {
    status: 'ok',
    pops: parseDropdownOptions(safeJsonParse(resp.res.responseText)),
  };
}

async function getConboxParamSpecs() {
  if (cachedConboxParamSpec.specs && Date.now() < cachedConboxParamSpec.expiresAt) {
    return cachedConboxParamSpec.specs;
  }
  try {
    const res = await requestPortal({
      url: buildPortUrl(PORT_ENDPOINTS.libJs),
      method: 'GET',
      headers: { Accept: 'application/javascript, text/javascript, */*' },
      timeout: 10000,
    });
    if (res && res.ok && res.responseText) {
      const specs = parseConboxParamsFromLibJs(res.responseText);
      cachedConboxParamSpec = { specs, expiresAt: Date.now() + META_TTL_MS };
      return specs;
    }
  } catch {
    // Su dung danh sach tham so mac dinh neu khong tai duoc lib.js
  }
  return DEFAULT_CONBOX_PARAM_SPECS;
}

export async function fetchPortConboxes(popName, { forceDemo = false } = {}) {
  if (!popName) {
    return { status: 'ok', conboxes: [] };
  }
  if (!isUserscriptEnv() || forceDemo) {
    return {
      status: 'ok',
      conboxes: [
        { value: '55101', label: `${popName}-SPL-01` },
        { value: '55102', label: `${popName}-SPL-02` },
      ],
    };
  }
  const specs = await getConboxParamSpecs();
  const args = [String(popName).trim(), '0', '0'];
  const params = new URLSearchParams();
  for (const s of specs) {
    if (s.literalValue !== undefined) {
      params.set(s.key, s.literalValue);
    } else {
      const v = s.argIndex >= 0 && s.argIndex < args.length ? args[s.argIndex] : '0';
      params.set(s.key, v);
    }
  }
  const resp = await portRequest({
    url: PORT_ENDPOINTS.conboxes,
    method: 'POST',
    data: params.toString(),
  });
  if (!resp.ok) {
    return { status: resp.statusType, message: resp.message, loginUrl: resp.loginUrl, conboxes: [] };
  }
  return {
    status: 'ok',
    conboxes: parseDropdownOptions(safeJsonParse(resp.res.responseText)),
  };
}

export async function fetchPortSlotList(deviceId, { forceDemo = false } = {}) {
  if (!deviceId || deviceId === '0') {
    return { status: 'ok', slots: [] };
  }
  if (!isUserscriptEnv() || forceDemo) {
    return {
      status: 'ok',
      slots: [
        { portID: '9001', port: 'Port 01', disabled: true, checked: false },
        { portID: '9002', port: 'Port 02', disabled: false, checked: false },
        { portID: '9003', port: 'Port 03', disabled: true, checked: false },
        { portID: '9004', port: 'Port 04', disabled: false, checked: false },
        { portID: '9005', port: 'Port 05', disabled: false, checked: false },
        { portID: '9006', port: 'Port 06', disabled: true, checked: false },
        { portID: '9007', port: 'Port 07', disabled: false, checked: false },
        { portID: '9008', port: 'Port 08', disabled: false, checked: false },
      ],
    };
  }
  const body = new URLSearchParams({ pDeviceID: String(Number(deviceId) || 0) }).toString();
  const resp = await portRequest({
    url: PORT_ENDPOINTS.loadPort,
    method: 'POST',
    data: body,
  });
  if (!resp.ok) {
    return { status: resp.statusType, message: resp.message, loginUrl: resp.loginUrl, slots: [] };
  }
  return {
    status: 'ok',
    slots: parsePortOptionsFromHtml(resp.res.responseText),
  };
}

export async function fetchPortHistory({ pointName = '', port = '', locationID = '', forceDemo = false } = {}) {
  if (!pointName) {
    return { status: 'validation_error', message: 'Hãy chọn Hộp đấu nối trước khi xem lịch sử Port.', rows: [] };
  }
  if (!isUserscriptEnv() || forceDemo) {
    return {
      status: 'ok',
      rows: [
        {
          stt: '1',
          actionDate: '11/23/2026 11:38:42',
          createBy: 'phuongnam.namlp',
          port: port || 'Port 04',
          ip: '10.10.20.5',
          action: 'Thu hồi port',
          contractName: 'VTAAR2501',
          data: 'Status=6 (Đã thu hồi port)',
        },
        {
          stt: '2',
          actionDate: '11/21/2026 08:49:42',
          createBy: 'VTU.ThaoPT81',
          port: port || 'Port 04',
          ip: '10.10.20.5',
          action: 'Cấp mới port',
          contractName: 'VTAAR2501',
          data: `${pointName} • Port 04`,
        },
      ],
    };
  }
  const body = new URLSearchParams({
    pointName: String(pointName || ''),
    port: String(port || ''),
    locationID: String(locationID || ''),
  }).toString();
  const resp = await portRequest({
    url: PORT_ENDPOINTS.loadPortHistory,
    method: 'POST',
    data: body,
  });
  if (!resp.ok) {
    return { status: resp.statusType, message: resp.message, loginUrl: resp.loginUrl, rows: [] };
  }
  return {
    status: 'ok',
    rows: parsePortHistoryRows(safeJsonParse(resp.res.responseText)),
  };
}

function makeDemoContext(contractId, typeContract = '3') {
  return {
    status: 'ok',
    mode: 'demo',
    recordMode: 'existing',
    sourceUrl: `${PORT_ENDPOINTS.insertPage}/155123602`,
    detail: {
      id: '155123602',
      contractName: contractId,
      typeContract,
      typeContractLabel: typeContract === '5' ? 'FTTH_NEW LeaseLine' : 'FTTH_New',
      status: '1',
      statusLabel: 'Bình thường (Mẫu)',
      statusPort: '1',
      statusPortLabel: 'Bình thường',
      releaseStatusPortValue: '2',
      reassignStatusPortValue: '3',
      customer: 'Khách hàng mẫu FTTH NEW',
      cmnd: '',
      company: '',
      address: '2 Hải Đăng, Phường Vũng Tàu, TP. Hồ Chí Minh',
      email: '',
      handphone: '',
      telephone: '',
      localType: '188',
      cardNumber: '1',
      description: '',
      createBy: 'VTU.ThaoPT81',
      createDate: '11/21/2026 8:49:42 AM',
      updateBy: 'Phuongnam.namlp',
      updateDate: '11/23/2026 11:38:42 AM',
      tstc: 'BRUP07501GC16 • SPL-07 • Port 04 (Mẫu)',
      pc: 'BRUP07501 • PON 0/8 • VLAN 188 (Mẫu)',
      typeContractOptions: [
        { value: '3', label: 'FTTH_New', selected: typeContract !== '5' },
        { value: '5', label: 'FTTH_NEW LeaseLine', selected: typeContract === '5' },
      ],
      statusOptions: [
        { value: '1', label: 'Bình thường', selected: true },
        { value: '6', label: 'Đã thu hồi port', selected: false },
      ],
      statusPortOptions: [
        { value: '1', label: 'Bình thường', selected: true },
        { value: '2', label: 'Thu hồi port', selected: false },
        { value: '3', label: 'Cấp lại port', selected: false },
      ],
    },
    locations: [{ value: '35', label: 'VTU - Bà Rịa - Vũng Tàu (Mẫu)' }],
    defaultLocationId: '35',
    branches: [{ value: '1', label: 'TP. Vũng Tàu (Mẫu)' }],
    defaultBranchId: '1',
  };
}

/**
 * Tai day du thong tin Port hien tai cua hop dong tren mvcport.fpt.net (Index_Search + Insert/<ID> hoac LoadData).
 */
export async function fetchPortContractContext(
  rawContractId,
  { typeContract = '3', forceRefresh = false, forceDemo = false } = {}
) {
  const check = validateContractId(rawContractId);
  if (!check.valid) {
    return { status: 'validation_error', message: check.error };
  }

  const contractId = check.value;
  const cacheKey = `${contractId}:${typeContract}`;
  if (!forceRefresh) {
    const cached = PORT_CONTRACT_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < CONTRACT_TTL_MS) {
      return cached.payload;
    }
  }

  if (!isUserscriptEnv() || forceDemo) {
    const demo = makeDemoContext(contractId, typeContract);
    PORT_CONTRACT_CACHE.set(cacheKey, { cachedAt: Date.now(), payload: demo });
    return demo;
  }

  const locRes = await fetchPortLocations({ forceRefresh });
  if (locRes.status !== 'ok') {
    return { status: locRes.status, message: locRes.message, loginUrl: locRes.loginUrl };
  }
  const locations = locRes.locations || [];
  const defaultLocationId = (locations[0] && locations[0].value) || '0';

  const branchRes = await fetchPortBranches(defaultLocationId);
  if (branchRes.status !== 'ok') {
    return { status: branchRes.status, message: branchRes.message, loginUrl: branchRes.loginUrl };
  }
  const branches = branchRes.branches || [];
  const defaultBranchId = (branches[0] && branches[0].value) || '0';

  async function runIndexSearch(pLocation, pBranch) {
    const body = new URLSearchParams({
      typeSearch: '1',
      pLocation: String(pLocation || ''),
      pBranch: String(pBranch || '0'),
      pPOpID: '0',
      pConBoxId: '0',
      contract: contractId,
    }).toString();
    const resp = await portRequest({
      url: PORT_ENDPOINTS.search,
      method: 'POST',
      data: body,
    });
    if (!resp.ok) {
      return resp;
    }
    const parsed = safeJsonParse(resp.res.responseText);
    return { ok: true, rows: Array.isArray(parsed) ? parsed : [] };
  }

  let searchRes = await runIndexSearch(defaultLocationId, defaultBranchId);
  if (!searchRes.ok) {
    return { status: searchRes.statusType, message: searchRes.message, loginUrl: searchRes.loginUrl };
  }
  let rows = searchRes.rows;
  if (rows.length === 0 && defaultBranchId !== '0') {
    const retryRes = await runIndexSearch(defaultLocationId, '0');
    if (retryRes.ok && Array.isArray(retryRes.rows)) {
      rows = retryRes.rows;
    }
  }

  const exactRow =
    rows.find((r) => r && String(r.ContractName || '').trim().toUpperCase() === contractId) ||
    (rows.length === 1 ? rows[0] : null);

  if (exactRow && exactRow.ID) {
    const insertUrl = `${PORT_ENDPOINTS.insertPage}/${encodeURIComponent(String(exactRow.ID))}`;
    const detailResp = await portRequest({
      url: insertUrl,
      method: 'GET',
      headers: { Accept: 'text/html, */*' },
    });
    if (!detailResp.ok) {
      return {
        status: detailResp.statusType,
        message: detailResp.message,
        loginUrl: detailResp.loginUrl,
      };
    }

    const parsedDetail = parsePortContractDetailHtml(detailResp.res.responseText) || {};
    const detail = {
      ...parsedDetail,
      id: parsedDetail.id || String(exactRow.ID),
      contractName: parsedDetail.contractName || String(exactRow.ContractName || contractId),
      customer: parsedDetail.customer || decodeHtmlEntities(String(exactRow.CusName || '')),
      address: parsedDetail.address || decodeHtmlEntities(String(exactRow.Address || '')),
      cardNumber: parsedDetail.cardNumber || String(exactRow.CardNumber || ''),
      email: parsedDetail.email || String(exactRow.Email || ''),
      localType: parsedDetail.localType || String(exactRow.LocalType || ''),
    };

    const result = {
      status: 'ok',
      mode: 'live',
      recordMode: 'existing',
      sourceUrl: insertUrl,
      detail,
      locations,
      defaultLocationId,
      branches,
      defaultBranchId,
    };
    PORT_CONTRACT_CACHE.set(cacheKey, { cachedAt: Date.now(), payload: result });
    return result;
  }

  // Chua co tren Index_Search -> nap tu /FTTH_NewPort/Contract/LoadData de cap Port moi
  const loadBody = new URLSearchParams({
    ContractName: contractId,
    TypeContract: String(typeContract || '3'),
  }).toString();
  const loadResp = await portRequest({
    url: PORT_ENDPOINTS.loadData,
    method: 'POST',
    data: loadBody,
  });
  if (!loadResp.ok) {
    return {
      status: loadResp.statusType,
      message: loadResp.message,
      loginUrl: loadResp.loginUrl,
    };
  }

  const loadParsed = safeJsonParse(loadResp.res.responseText);
  if (Array.isArray(loadParsed) && loadParsed.length >= 10) {
    const detail = {
      id: '',
      contractName: contractId,
      typeContract: String(typeContract || '3'),
      typeContractLabel: String(typeContract) === '5' ? 'FTTH_NEW LeaseLine' : 'FTTH_New',
      status: '1',
      statusLabel: 'Chưa cấp Port (HĐ mới)',
      statusPort: '',
      statusPortLabel: '',
      releaseStatusPortValue: '2',
      reassignStatusPortValue: '3',
      customer: decodeHtmlEntities(String(loadParsed[0] || '')).trim(),
      company: decodeHtmlEntities(String(loadParsed[1] || '')).trim(),
      address: decodeHtmlEntities(String(loadParsed[2] || '')).trim(),
      email: decodeHtmlEntities(String(loadParsed[3] || '')).trim(),
      handphone: decodeHtmlEntities(String(loadParsed[4] || '')).trim(),
      telephone: decodeHtmlEntities(String(loadParsed[5] || '')).trim(),
      localType: decodeHtmlEntities(String(loadParsed[6] || '')).trim(),
      description: decodeHtmlEntities(String(loadParsed[7] || '')).trim(),
      cmnd: decodeHtmlEntities(String(loadParsed[8] || '')).trim(),
      cardNumber: '1',
      createBy: '',
      createDate: '',
      updateBy: '',
      updateDate: '',
      tstc: '',
      pc: '',
      typeContractOptions: [
        { value: '3', label: 'FTTH_New', selected: String(typeContract) !== '5' },
        { value: '5', label: 'FTTH_NEW LeaseLine', selected: String(typeContract) === '5' },
      ],
      statusOptions: [
        { value: '1', label: 'Bình thường', selected: true },
        { value: '6', label: 'Đã thu hồi port', selected: false },
      ],
      statusPortOptions: [],
    };
    const result = {
      status: 'ok',
      mode: 'live',
      recordMode: 'new',
      sourceUrl: PORT_ENDPOINTS.insertPage,
      detail,
      locations,
      defaultLocationId,
      branches,
      defaultBranchId,
    };
    PORT_CONTRACT_CACHE.set(cacheKey, { cachedAt: Date.now(), payload: result });
    return result;
  }

  const loadMsg = stripHtmlClean(
    typeof loadParsed === 'string'
      ? loadParsed
      : Array.isArray(loadParsed)
      ? loadParsed[0] || ''
      : loadResp.res.responseText || ''
  );

  return {
    status: 'ok',
    mode: 'live',
    recordMode: 'not_found',
    loadDataError:
      loadMsg ||
      `Không tìm thấy hợp đồng ${contractId} trên FTTH NEW (Tìm kiếm lẫn LoadData). Hãy thử đổi Loại HĐ (FTTH_New / LeaseLine).`,
    sourceUrl: PORT_ENDPOINTS.indexPage,
    detail: {
      id: '',
      contractName: contractId,
      typeContract: String(typeContract || '3'),
      typeContractLabel: String(typeContract) === '5' ? 'FTTH_NEW LeaseLine' : 'FTTH_New',
      status: '',
      statusLabel: 'Chưa có trên FTTH NEW',
      customer: '',
      address: '',
      cardNumber: '1',
      localType: '',
      tstc: '',
      pc: '',
      typeContractOptions: [
        { value: '3', label: 'FTTH_New', selected: String(typeContract) !== '5' },
        { value: '5', label: 'FTTH_NEW LeaseLine', selected: String(typeContract) === '5' },
      ],
    },
    locations,
    defaultLocationId,
    branches,
    defaultBranchId,
  };
}

function buildLookupResult(ctxRes, contractId) {
  const d = ctxRes.detail || {};
  if (ctxRes.recordMode === 'not_found') {
    return {
      status: 'warn',
      mode: 'live',
      title: `Chưa có dữ liệu Port FTTH NEW cho ${contractId}`,
      message: ctxRes.loadDataError,
      sourceUrl: ctxRes.sourceUrl,
      sourceLabel: 'Mở trang Port gốc',
    };
  }

  const summaryFields = [{ label: 'Mã hợp đồng', value: d.contractName || contractId }];
  summaryFields.push({
    label: 'Trạng thái Port',
    value: d.statusLabel || (ctxRes.recordMode === 'new' ? 'Chưa cấp Port (HĐ mới)' : 'Không rõ'),
  });
  if (d.tstc) summaryFields.push({ label: 'Thông số Tập điểm / Port', value: d.tstc });
  if (d.pc) summaryFields.push({ label: 'Thông số kết nối', value: d.pc });
  if (d.typeContractLabel) summaryFields.push({ label: 'Loại hợp đồng', value: d.typeContractLabel });
  if (d.customer) summaryFields.push({ label: 'Khách hàng', value: d.customer });
  if (d.address) summaryFields.push({ label: 'Địa chỉ', value: d.address });
  if (d.cardNumber) summaryFields.push({ label: 'Số thẻ', value: d.cardNumber });
  if (d.localType) summaryFields.push({ label: 'LocalType', value: d.localType });
  if (d.description) summaryFields.push({ label: 'Ghi chú', value: d.description });
  if (d.createBy || d.createDate) {
    summaryFields.push({
      label: 'Người cấp / Ngày cấp',
      value: [d.createBy, d.createDate].filter(Boolean).join(' • '),
    });
  }
  if (d.updateBy || d.updateDate) {
    summaryFields.push({
      label: 'Cập nhật cuối',
      value: [d.updateBy, d.updateDate].filter(Boolean).join(' • '),
    });
  }

  return {
    status: 'ok',
    mode: 'live',
    title:
      ctxRes.recordMode === 'new'
        ? `Hợp đồng mới ${contractId} (chưa cấp Port FTTH NEW)`
        : `Thông tin Port FTTH NEW — ${contractId}`,
    message:
      ctxRes.recordMode === 'new'
        ? 'Hợp đồng chưa có bản ghi trên FTTH NEW (đã lấy sẵn thông tin từ LoadData). Bấm "Cấp / Đổi Port" để chọn Tập điểm & Port trống.'
        : 'Đã lấy dữ liệu trực tiếp từ mvcport.fpt.net (FTTH NEW).',
    summaryFields,
    sourceUrl: ctxRes.sourceUrl,
    sourceLabel: 'Mở trang Port gốc',
  };
}

function buildPortMockResult(actionId, contractId, ctx = {}) {
  switch (actionId) {
    case 'lookup_port':
      return {
        status: 'ok',
        mode: 'demo',
        title: `Thông tin Port của ${contractId} (Dữ liệu mô phỏng)`,
        message:
          'Đã tải thông tin Port mẫu để kiểm tra giao diện trước khi chạy thật trên mvcport.fpt.net.',
        summaryFields: [
          { label: 'Mã hợp đồng', value: contractId },
          { label: 'Trạng thái Port', value: 'Bình thường (Đã cấp)' },
          { label: 'Thông số Tập điểm / Port', value: 'BRUP07501GC16 • SPL-07 • Port 04' },
          { label: 'Thông số kết nối', value: 'BRUP07501 • PON 0/8 • VLAN 188' },
          { label: 'Loại hợp đồng', value: 'FTTH_New' },
          { label: 'Nguồn dữ liệu', value: 'Dữ liệu mô phỏng (chưa bật VPN/Userscript)' },
        ],
      };
    case 'assign_port':
      return {
        status: 'ok',
        mode: 'demo',
        title: `Đã cấp Port cho ${contractId} (Dữ liệu mô phỏng)`,
        message:
          'Lệnh mô phỏng thành công: Port mới đã được gán cho hợp đồng trên bản xem thử.',
        summaryFields: [
          { label: 'Mã hợp đồng', value: contractId },
          { label: 'Tập điểm / Hộp đấu nối', value: ctx.deviceName || 'BRUP07501-SPL-01' },
          { label: 'Port đã chọn', value: ctx.port || 'Port 04' },
        ],
      };
    case 'release_port':
      return {
        status: 'ok',
        mode: 'demo',
        title: `Đã thu hồi Port của ${contractId} (Dữ liệu mô phỏng)`,
        message:
          'Lệnh mô phỏng thành công: Port đã được giải phóng khỏi hợp đồng trên bản xem thử.',
      };
    default:
      return {
        status: 'error',
        mode: 'demo',
        message: 'Không nhận diện được thao tác yêu cầu.',
      };
  }
}

/**
 * Thuc thi lenh nghiep vu tren port.fpt.net / mvcport.fpt.net.
 */
export async function runPortAction(actionId, rawContractId, ctx = {}) {
  const check = validateContractId(rawContractId);
  if (!check.valid) {
    return {
      status: 'validation_error',
      message: check.error,
    };
  }

  const contractId = check.value;
  const portal = PORTALS.port;

  if (!portal.actions.some((a) => a.id === actionId)) {
    return {
      status: 'error',
      message: 'Thao tác không hợp lệ trên cổng này.',
    };
  }

  if (!isUserscriptEnv() || ctx.forceDemo) {
    await sleep(350);
    return buildPortMockResult(actionId, contractId, ctx);
  }

  if (actionId === 'lookup_port') {
    const ctxRes = await fetchPortContractContext(contractId, { forceRefresh: true });
    if (ctxRes.status !== 'ok') {
      return {
        status: ctxRes.status,
        message: ctxRes.message,
        loginUrl: ctxRes.loginUrl || portal.url,
      };
    }
    return buildLookupResult(ctxRes, contractId);
  }

  if (actionId === 'release_port') {
    let detail = ctx.detail || null;
    if (!detail || !detail.id) {
      const ctxRes = await fetchPortContractContext(contractId, { forceRefresh: true });
      if (ctxRes.status !== 'ok') {
        return {
          status: ctxRes.status,
          message: ctxRes.message,
          loginUrl: ctxRes.loginUrl || portal.url,
        };
      }
      if (ctxRes.recordMode !== 'existing' || !ctxRes.detail || !ctxRes.detail.id) {
        return {
          status: 'warn',
          title: `Không thể thu hồi Port cho ${contractId}`,
          message: `Hợp đồng ${contractId} hiện chưa có bản ghi Port trên FTTH NEW để thu hồi.`,
        };
      }
      detail = ctxRes.detail;
    }

    const body = new URLSearchParams({
      typeContract: String(detail.typeContract || '3'),
      customer: String(detail.customer || ''),
      address: String(detail.address || ''),
      cardNumber: String(ctx.cardNumber ?? detail.cardNumber ?? ''),
      email: String(detail.email || ''),
      status: '6',
      cmnd: String(detail.cmnd || ''),
      localType: String(detail.localType || ''),
      description: String(ctx.description ?? detail.description ?? ''),
      company: String(detail.company || ''),
      telephone: String(detail.telephone || ''),
      handphone: String(detail.handphone || ''),
      portID: '',
      port: '',
      deviceName: '',
      location: '',
      branch: '',
      id: String(detail.id),
      statusPort: String(ctx.statusPort || detail.releaseStatusPortValue || '2'),
    }).toString();

    const resp = await portRequest({
      url: PORT_ENDPOINTS.updateContract,
      method: 'POST',
      data: body,
    });
    if (!resp.ok) {
      return { status: resp.statusType, message: resp.message, loginUrl: resp.loginUrl };
    }
    clearPortContractCache(contractId);
    return parsePortMutationResponse(resp.res.responseText, 'Thu hồi Port', contractId);
  }

  if (actionId === 'assign_port') {
    const portID = String(ctx.portID || '').trim();
    const port = String(ctx.port || '').trim();
    const deviceName = String(ctx.deviceName || '').trim();
    const location = String(ctx.location || '').trim();
    const branch = String(ctx.branch || '').trim();
    if (!portID || !port || !deviceName || !location || !branch) {
      return {
        status: 'validation_error',
        message: 'Hãy chọn đủ Vùng, Chi nhánh, POP, Hộp đấu nối và Port còn trống trước khi xác nhận.',
      };
    }

    const d = ctx.detail || {};
    const typeContract = String(ctx.typeContract || d.typeContract || '3');
    const cardNumber = String(ctx.cardNumber ?? d.cardNumber ?? '1');
    const description = String(ctx.description ?? d.description ?? '');

    if (ctx.recordMode === 'existing' && d.id) {
      const body = new URLSearchParams({
        typeContract,
        customer: String(d.customer || ''),
        address: String(d.address || ''),
        cardNumber,
        email: String(d.email || ''),
        status: '1',
        cmnd: String(d.cmnd || ''),
        localType: String(d.localType || ''),
        description,
        company: String(d.company || ''),
        telephone: String(d.telephone || ''),
        handphone: String(d.handphone || ''),
        portID,
        port,
        deviceName,
        location,
        branch,
        id: String(d.id),
        statusPort: String(ctx.statusPort || d.reassignStatusPortValue || '3'),
      }).toString();

      const resp = await portRequest({
        url: PORT_ENDPOINTS.updateContract,
        method: 'POST',
        data: body,
      });
      if (!resp.ok) {
        return { status: resp.statusType, message: resp.message, loginUrl: resp.loginUrl };
      }
      clearPortContractCache(contractId);
      return parsePortMutationResponse(resp.res.responseText, 'Đổi / Cấp lại Port', contractId);
    }

    const body = new URLSearchParams({
      contractName: String(d.contractName || contractId),
      typeContract,
      customer: String(d.customer || ''),
      address: String(d.address || ''),
      cardNumber,
      email: String(d.email || ''),
      status: '1',
      cmnd: String(d.cmnd || ''),
      localType: String(d.localType || ''),
      description,
      company: String(d.company || ''),
      telephone: String(d.telephone || ''),
      handphone: String(d.handphone || ''),
      portID,
      port,
      location,
      branch,
      deviceName,
    }).toString();

    const resp = await portRequest({
      url: PORT_ENDPOINTS.insertContract,
      method: 'POST',
      data: body,
    });
    if (!resp.ok) {
      return { status: resp.statusType, message: resp.message, loginUrl: resp.loginUrl };
    }
    clearPortContractCache(contractId);
    return parsePortMutationResponse(resp.res.responseText, 'Cấp Port mới', contractId);
  }

  return {
    status: 'error',
    message: 'Thao tác Port không được hỗ trợ.',
  };
}
