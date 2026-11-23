/**
 * Adapter xu ly cho trang uu tien so 1: inside.fpt.net (qua mvc.inside.fpt.net)
 * Da noi API that cho Tra thong tin HD; cac lenh tac dong manh cho quet mau tung man hinh.
 */

import { PORTALS, normalizeContractId, validateContractId } from '../config/portals.js';
import {
  checkPortalSession,
  detectIamRedirect,
  isUserscriptEnv,
  requestPortal,
  sleep,
} from '../core/transport.js';

/**
 * Ban do endpoint that cua inside.fpt.net & mvc.inside.fpt.net.
 */
export const INSIDE_ENDPOINTS = {
  lookup: {
    detail: 'http://mvc.inside.fpt.net/Contract/StatusNew/ViewReportDetail',
    objectType: 'http://mvc.inside.fpt.net/Contract/StatusNew/LoadObjectType',
    statusDevice: 'http://mvc.inside.fpt.net/Contract/StatusNew/LoadStatusDevice',
    statusRadius: 'http://mvc.inside.fpt.net/Contract/StatusNew/LoadStatusRadius',
    information: 'http://mvc.inside.fpt.net/Contract/StatusNew/GetInformation',
    radiusParams: 'http://radius-portal.fpt.net/public/partial/connection-parameters',
    radiusOnline: 'http://radius-portal.fpt.net/public/partial/online-session',
  },
  reset_mac: 'http://mvc.inside.fpt.net/DSLLLine/ResetMAC/ChangeMAC',
  reset_mac_box: {
    list: 'http://mvc.inside.fpt.net/Contract/IPTVReplaceMAC/ReplaceMAC/GetMacContract',
    update: 'http://mvc.inside.fpt.net/Contract/IPTVReplaceMAC/ReplaceMAC/UpdateMAC',
    log: 'http://mvc.inside.fpt.net/Contract/IPTVReplaceMAC/ReplaceMAC/GetLogByContract',
  },
  kill_session: {
    search: 'http://mvc.inside.fpt.net/KillSession/KillSession/SearchListForKillSession',
    delete: 'http://mvc.inside.fpt.net/KillSession/KillSession/DeleteSession',
  },
  clear_osp: {
    monitor: 'http://inside.fpt.net/Functions/NetAdmin/PowerDSL/MonitorOLT/',
    viewport: 'http://inside.fpt.net/Functions/NetAdmin/PowerDSL/MonitorOLT/ViewPortPON.Asp',
    oltList: 'http://inside.fpt.net/Functions/NetAdmin/PowerDSL/MonitorOLT/GetOLTList.asp',
    clearSerial: 'http://inside.fpt.net/Functions/NetAdmin/PowerDSL/MonitorOLT/ClearSerial.asp',
  },
};

export const INSIDE_CONTRACT_CACHE = new Map();
export const INSIDE_OLT_HINT_CACHE = new Map();
export const INSIDE_OLT_CACHE = {
  locations: [],
  defaultLocationId: '',
  ports: [],
  oltsByLocation: new Map(),
  fetchedAt: 0,
};

export function setInsideOltHint(objId, info = {}) {
  const key = String(objId || '').trim();
  const oltPop = String(info.oltPop || '').trim();
  if (!key || !oltPop) return null;
  const entry = {
    objId: key,
    oltPop,
    slot: String(info.slot || '').trim(),
    port: String(info.port || '').trim(),
    onu: String(info.onu || '').trim(),
    ipOlt: String(info.ipOlt || '').trim(),
    updatedAt: Date.now(),
  };
  INSIDE_OLT_HINT_CACHE.set(key, entry);
  return entry;
}

export function getInsideOltHint(objId) {
  const key = String(objId || '').trim();
  if (!key) return null;
  const entry = INSIDE_OLT_HINT_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.updatedAt >= CACHE_TTL_MS) {
    INSIDE_OLT_HINT_CACHE.delete(key);
    return null;
  }
  return entry;
}

export function isSameOltDetectedInfo(a, b) {
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') {
    return false;
  }
  const norm = (v) => String(v || '').trim();
  return (
    norm(a.objId) === norm(b.objId) &&
    norm(a.oltPop).toUpperCase() === norm(b.oltPop).toUpperCase() &&
    norm(a.slot) === norm(b.slot) &&
    norm(a.port) === norm(b.port) &&
    norm(a.onu) === norm(b.onu) &&
    norm(a.ipOlt) === norm(b.ipOlt)
  );
}

export function getCachedInsideContract(rawContractId) {
  const check = validateContractId(rawContractId);
  if (!check.valid) return null;
  return INSIDE_CONTRACT_CACHE.get(check.value) || null;
}

const AJAX_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'X-Requested-With': 'XMLHttpRequest',
};

function decodeHtmlEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, num) => {
      const code = Number(num);
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    });
}

function stripHtmlTags(raw) {
  return decodeHtmlEntities(String(raw || '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Trich xuat cac cap nhan - gia tri sach se tu HTML partial cua Radius (khong dung innerHTML).
 */
export function extractHtmlTablePairs(htmlText) {
  if (!htmlText || typeof htmlText !== 'string') {
    return [];
  }

  const cleanedHtml = htmlText
    .replace(new RegExp('<script\\b[\\s\\S]*?</' + 'script>', 'gi'), ' ')
    .replace(new RegExp('<style\\b[\\s\\S]*?</' + 'style>', 'gi'), ' ');

  const pairs = [];
  const seenLabels = new Set();

  function pushPair(rawLabel, rawValue) {
    const label = stripHtmlTags(rawLabel).replace(/:$/, '').trim();
    const value = stripHtmlTags(rawValue);
    if (!label || !value || label.length > 60) {
      return;
    }
    const key = label.toLowerCase();
    if (seenLabels.has(key)) {
      return;
    }
    seenLabels.add(key);
    pairs.push({ label, value });
  }

  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRe.exec(cleanedHtml)) !== null && pairs.length < 14) {
    const rowHtml = rowMatch[1];
    const cells = [];
    const cellRe = /<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let cellMatch;
    while ((cellMatch = cellRe.exec(rowHtml)) !== null) {
      cells.push({ tag: cellMatch[1].toLowerCase(), html: cellMatch[2] });
    }

    if (cells.length === 2) {
      pushPair(cells[0].html, cells[1].html);
    } else if (
      cells.length === 4 &&
      cells[0].tag === 'th' &&
      cells[2].tag === 'th'
    ) {
      pushPair(cells[0].html, cells[1].html);
      if (pairs.length < 14) {
        pushPair(cells[2].html, cells[3].html);
      }
    } else if (cells.length >= 3 && cells[0].tag === 'th') {
      pushPair(
        cells[0].html,
        cells
          .slice(1)
          .map((c) => stripHtmlTags(c.html))
          .filter(Boolean)
          .join(' | ')
      );
    }
  }

  if (pairs.length === 0) {
    const labelFallbackRe =
      /<label\b[^>]*>([\s\S]*?)<\/label>\s*(?:<(?:span|div|p|strong|b)\b[^>]*>([\s\S]*?)<\/(?:span|div|p|strong|b)>|([^<\n]{1,120}))/gi;
    let labelMatch;
    while ((labelMatch = labelFallbackRe.exec(cleanedHtml)) !== null && pairs.length < 14) {
      pushPair(labelMatch[1], labelMatch[2] || labelMatch[3] || '');
    }
  }

  return pairs.slice(0, 14);
}

function safeJsonParse(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return null;
  }
  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}

function pickFirstRow(detailJson) {
  const raw = detailJson && detailJson.data;
  if (Array.isArray(raw)) {
    return raw.length > 0 && raw[0] && typeof raw[0] === 'object' ? raw[0] : null;
  }
  if (raw && typeof raw === 'object') {
    return raw;
  }
  return null;
}

function nonEmptyStr(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return '';
  return String(val).trim();
}

/**
 * Chuan hoa du lieu tra cuu tu nhieu API cua mvc.inside.fpt.net & radius-portal thanh the tom tat gon.
 */
export function parseInsideLookupPayload({
  contractId,
  detailJson = null,
  objectTypeJson = null,
  deviceJson = null,
  radiusBool = null,
  infoJson = null,
  connPartialHtml = '',
  sessionPartialHtml = '',
} = {}) {
  const row = pickFirstRow(detailJson) || {};
  const objType =
    objectTypeJson && objectTypeJson.data && typeof objectTypeJson.data === 'object'
      ? objectTypeJson.data
      : {};
  const infoData =
    infoJson && infoJson.data && typeof infoJson.data === 'object' ? infoJson.data : {};
  const dtMain = Array.isArray(infoData.dtMain)
    ? infoData.dtMain[0] || {}
    : infoData.dtMain && typeof infoData.dtMain === 'object'
    ? infoData.dtMain
    : {};
  const dtHiFPT = Array.isArray(infoData.dtHiFPT) ? infoData.dtHiFPT : [];

  const objID = row.ID ?? objType.ObjId ?? null;
  const contractCode =
    nonEmptyStr(objType.Contract) ||
    nonEmptyStr(row.Contract) ||
    nonEmptyStr(dtHiFPT[0] && dtHiFPT[0].Contract) ||
    contractId;
  const accountName =
    nonEmptyStr(row.Name) ||
    nonEmptyStr(row.Account) ||
    nonEmptyStr(row.UserName) ||
    nonEmptyStr(row.Name1);
  const customerName =
    nonEmptyStr(row.FullName) || nonEmptyStr(objType.FullName) || nonEmptyStr(objType.TenKh);
  const rawStatus =
    nonEmptyStr(row.StatusName) || nonEmptyStr(row.Status) || nonEmptyStr(row.Status_Name);
  const contractStatus =
    rawStatus === '1'
      ? 'Bình thường (1)'
      : rawStatus === '0'
      ? 'Chưa kích hoạt / Khóa (0)'
      : rawStatus;
  const suspendReason = nonEmptyStr(row.Suspend_Reason);
  const warning = nonEmptyStr(dtMain.Warning);
  const packageName =
    nonEmptyStr(objType.GoiDv) ||
    nonEmptyStr(row.NameLocalType) ||
    nonEmptyStr(dtMain.TypeOfService) ||
    nonEmptyStr(objType.LocalTypeName);
  const customerCategory = [objType.LoaiHinhC1, objType.LoaiHinhC2, objType.DoiTuongKh]
    .map(nonEmptyStr)
    .filter(Boolean)
    .join(' / ');
  const deviceStatus =
    deviceJson && typeof deviceJson.data === 'string' ? deviceJson.data.trim() : '';
  const radiusText = radiusBool === true ? 'Có trên Radius' : '';
  const macAddress =
    typeof row.MACAddress === 'string' && row.MACAddress.trim() ? row.MACAddress.trim() : '';
  const promotion = nonEmptyStr(row.DesPromotion);
  const contactPhone =
    nonEmptyStr(dtMain.Phone) ||
    nonEmptyStr(row.Phone) ||
    nonEmptyStr(dtHiFPT[0] && dtHiFPT[0].Phone);
  const address =
    nonEmptyStr(row.Address) ||
    [
      dtMain.Location_Number,
      dtMain.Location_Street,
      dtMain.Location_Ward,
      dtMain.Location_District,
    ]
      .map(nonEmptyStr)
      .filter(Boolean)
      .join(', ');

  const summaryFields = [{ label: 'Mã hợp đồng', value: contractCode }];
  if (objID !== null && objID !== undefined && objID !== '') {
    summaryFields.push({ label: 'ObjID', value: String(objID) });
  }
  if (accountName) summaryFields.push({ label: 'Tên truy nhập', value: accountName });
  if (customerName) summaryFields.push({ label: 'Khách hàng', value: customerName });
  if (contractStatus) summaryFields.push({ label: 'Tình trạng HĐ', value: contractStatus });
  if (warning) summaryFields.push({ label: 'Cảnh báo', value: warning });
  if (suspendReason) summaryFields.push({ label: 'Lý do tạm ngưng', value: suspendReason });
  if (packageName) summaryFields.push({ label: 'Gói cước', value: packageName });
  if (customerCategory) summaryFields.push({ label: 'Phân loại KH', value: customerCategory });
  if (deviceStatus) summaryFields.push({ label: 'Thiết bị / Modem', value: deviceStatus });
  if (radiusText) summaryFields.push({ label: 'Trạng thái Radius', value: radiusText });
  if (macAddress) summaryFields.push({ label: 'Địa chỉ MAC', value: macAddress });
  if (promotion) summaryFields.push({ label: 'Khuyến mãi', value: promotion });
  if (contactPhone) summaryFields.push({ label: 'Điện thoại liên hệ', value: contactPhone });
  if (address) summaryFields.push({ label: 'Địa chỉ lắp đặt', value: address });

  const extraSections = [];
  const connPairs = extractHtmlTablePairs(connPartialHtml);
  if (connPairs.length > 0) {
    extraSections.push({
      title: 'Thông số kết nối (Radius)',
      fields: connPairs,
    });
  }
  const sessionPairs = extractHtmlTablePairs(sessionPartialHtml);
  if (sessionPairs.length > 0) {
    extraSections.push({
      title: 'Phiên đang online (Radius)',
      fields: sessionPairs,
    });
  }

  const embeddedViews = [];
  if (objID !== null && objID !== undefined && objID !== '') {
    const encodedObjId = encodeURIComponent(objID);
    const encodedQuery = encodeURIComponent(accountName || contractCode);
    embeddedViews.push(
      {
        id: 'radius_params',
        title: 'Thông số kết nối',
        badge: 'Radius',
        url: `http://radius-portal.fpt.net/public/partial/connection-parameters?ObjID=${encodedObjId}`,
        defaultOpen: true,
        height: 480,
      },
      {
        id: 'radius_online',
        title: 'Online Connections',
        badge: 'Phiên mạng',
        url: `http://radius-portal.fpt.net/public/partial/online-session?query=${encodedQuery}`,
        defaultOpen: true,
        height: 250,
      },
      {
        id: 'radius_errors',
        title: 'Last Access Errors',
        badge: 'Lịch sử lỗi',
        url: `http://radius-portal.fpt.net/public/partial/last-access-error?query=${encodedQuery}`,
        defaultOpen: false,
        height: 250,
      },
      {
        id: 'iptv',
        title: 'IPTV',
        badge: 'Nếu có dùng',
        url: `http://mvc.inside.fpt.net/iptvinfo/infobox?objid=${encodedObjId}`,
        defaultOpen: false,
        height: 360,
      },
      {
        id: 'camera',
        title: 'FPT Camera',
        badge: 'Nếu có dùng',
        url: `http://mvc.inside.fpt.net/iptvinfo/infocamera?objid=${encodedObjId}`,
        defaultOpen: false,
        height: 340,
      }
    );
  }

  return {
    status: 'ok',
    mode: 'live',
    title: `Thông tin hợp đồng ${contractCode}`,
    message: 'Đã lấy dữ liệu trực tiếp từ mvc.inside.fpt.net.',
    objID,
    accountName,
    macAddress,
    summaryFields,
    extraSections,
    embeddedViews,
  };
}

const MUTATION_ERROR_RE =
  /(?:lỗi(?!.*không có lỗi)|thất\s*bại|fail|error|không\s*thành\s*công|không\s*tồn\s*tại|không\s*có\s*quyền)/i;

function extractServerResponseMessage(responseText, json) {
  if (typeof json === 'string') {
    return json.trim();
  }
  if (typeof json === 'boolean') {
    return json ? 'Thành công' : 'Thất bại';
  }
  if (typeof json === 'number') {
    return json === 1
      ? 'Thành công (mã 1)'
      : json === 0
      ? 'Thất bại (máy chủ trả về 0)'
      : `Mã phản hồi ${json}`;
  }
  if (json && typeof json === 'object') {
    const candidates = [json.msg, json.message, json.Message, json.Msg, json.error, json.Error];
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim()) {
        return c.trim();
      }
    }
    if (typeof json.data === 'string' && json.data.trim()) {
      return json.data.trim();
    }
  }
  if (typeof responseText === 'string' && responseText.trim()) {
    const cleaned = stripHtmlTags(
      responseText
        .replace(new RegExp('<script\\b[\\s\\S]*?</' + 'script>', 'gi'), ' ')
        .replace(new RegExp('<style\\b[\\s\\S]*?</' + 'style>', 'gi'), ' ')
    );
    return cleaned.slice(0, 180);
  }
  return '';
}

/**
 * Chuan hoa ket qua tra ve tu cac lenh tac dong (Kill Session, Reset MAC Modem...).
 */
export function parseInsideMutationResponse({
  actionLabel,
  contractId,
  objID = null,
  httpStatus = 0,
  responseText = '',
  extraFields = [],
} = {}) {
  const summaryFields = [{ label: 'Mã hợp đồng', value: contractId }];
  if (objID !== null && objID !== undefined && objID !== '') {
    summaryFields.push({ label: 'ObjID', value: String(objID) });
  }
  for (const field of extraFields) {
    if (field && field.label && field.value !== undefined && field.value !== '') {
      summaryFields.push({ label: field.label, value: String(field.value) });
    }
  }

  const json = safeJsonParse(responseText);
  const rawMsg = extractServerResponseMessage(responseText, json);

  if (httpStatus < 200 || httpStatus >= 400) {
    if (rawMsg) {
      summaryFields.push({ label: 'Phản hồi hệ thống', value: rawMsg });
    }
    return {
      status: 'error',
      mode: 'live',
      title: `${actionLabel} thất bại (HTTP ${httpStatus})`,
      message: rawMsg || `Máy chủ Inside trả về mã lỗi ${httpStatus}.`,
      summaryFields,
    };
  }

  const isJsonFailure =
    json === false ||
    json === 0 ||
    json === -1 ||
    (json &&
      typeof json === 'object' &&
      (json.status === false ||
        json.success === false ||
        json.result === 0 ||
        json.result === -1));

  const isTextFailure = Boolean(rawMsg && MUTATION_ERROR_RE.test(rawMsg));

  if (isJsonFailure || isTextFailure) {
    const errText = rawMsg || 'Hệ thống Inside từ chối hoặc xử lý không thành công.';
    summaryFields.push({ label: 'Phản hồi hệ thống', value: errText });
    return {
      status: 'error',
      mode: 'live',
      title: `${actionLabel} chưa thành công`,
      message: errText,
      summaryFields,
    };
  }

  const okText = rawMsg || 'Hệ thống Inside đã tiếp nhận lệnh thành công.';
  summaryFields.push({ label: 'Phản hồi hệ thống', value: okText });
  return {
    status: 'ok',
    mode: 'live',
    title: `Đã ${actionLabel} cho ${contractId}`,
    message: okText,
    summaryFields,
  };
}

function getLocationCandidates() {
  const candidates = [];
  if (typeof document !== 'undefined' && document.querySelector) {
    const domEl = document.querySelector(
      '#ddlLocation, #Location, select[name*="location" i], input[name*="location" i]'
    );
    if (domEl && domEl.value && String(domEl.value).trim()) {
      candidates.push(String(domEl.value).trim());
    }
  }
  for (const fallback of ['0', '', '-1']) {
    if (!candidates.includes(fallback)) {
      candidates.push(fallback);
    }
  }
  return candidates;
}

async function fetchInsideEndpoint(url, acceptHtml = false) {
  const res = await requestPortal({
    url,
    method: 'GET',
    headers: acceptHtml
      ? { Accept: 'text/html, */*', 'X-Requested-With': 'XMLHttpRequest' }
      : AJAX_HEADERS,
    timeout: 12000,
  });

  if (res.error === 'NETWORK_ERROR' || res.error === 'TIMEOUT' || res.status === 0) {
    return { networkError: true, res };
  }

  const iam = detectIamRedirect({
    status: res.status,
    finalUrl: res.finalUrl,
    responseText: res.responseText,
    requestedUrl: url,
  });
  if (iam.expired) {
    return { iamExpired: true, loginUrl: res.finalUrl || PORTALS.inside.url };
  }

  return {
    ok: res.ok,
    text: res.responseText || '',
    json: acceptHtml ? null : safeJsonParse(res.responseText),
  };
}

async function lookupInsideLive(contractId) {
  const ep = INSIDE_ENDPOINTS.lookup;
  const locationCandidates = getLocationCandidates();

  let detailJson = null;
  let matchedRow = null;

  for (const loc of locationCandidates) {
    const detailUrl = `${ep.detail}?location=${encodeURIComponent(loc)}&contract=${encodeURIComponent(
      contractId
    )}`;
    const outcome = await fetchInsideEndpoint(detailUrl, false);
    if (outcome.iamExpired) {
      return {
        status: 'iam_expired',
        message: 'Phiên đăng nhập IAM đã hết hạn. Bấm nút bên dưới để đăng nhập lại.',
        loginUrl: outcome.loginUrl || PORTALS.inside.url,
      };
    }
    if (outcome.networkError) {
      return {
        status: 'error',
        message: 'Không kết nối được tới mvc.inside.fpt.net. Hãy kiểm tra VPN công ty đã bật chưa.',
        loginUrl: PORTALS.inside.url,
      };
    }

    const row = pickFirstRow(outcome.json);
    if (row) {
      detailJson = outcome.json;
      matchedRow = row;
      break;
    }
  }

  if (!matchedRow) {
    return {
      status: 'warn',
      title: `Không tìm thấy hợp đồng ${contractId}`,
      message:
        'Hệ thống mvc.inside.fpt.net không trả về dữ liệu cho mã này. Hãy kiểm tra lại Mã HĐ hoặc mở trang Tình trạng gốc để đối chiếu.',
      loginUrl: PORTALS.inside.url,
    };
  }

  const objID = matchedRow.ID ?? null;

  const taskMap = {
    objectType: objID
      ? fetchInsideEndpoint(`${ep.objectType}?objID=${encodeURIComponent(objID)}`, false)
      : Promise.resolve(null),
    statusDevice: objID
      ? fetchInsideEndpoint(`${ep.statusDevice}?objID=${encodeURIComponent(objID)}`, false)
      : Promise.resolve(null),
    statusRadius: fetchInsideEndpoint(
      `${ep.statusRadius}?contract=${encodeURIComponent(contractId)}`,
      false
    ),
    information: objID
      ? fetchInsideEndpoint(`${ep.information}?objID=${encodeURIComponent(objID)}`, false)
      : Promise.resolve(null),
  };

  const keys = Object.keys(taskMap);
  const settled = await Promise.allSettled(keys.map((k) => taskMap[k]));
  const values = {};
  keys.forEach((k, idx) => {
    const item = settled[idx];
    values[k] = item && item.status === 'fulfilled' ? item.value : null;
  });

  const result = parseInsideLookupPayload({
    contractId,
    detailJson,
    objectTypeJson: values.objectType && values.objectType.json,
    deviceJson: values.statusDevice && values.statusDevice.json,
    radiusBool:
      values.statusRadius && typeof values.statusRadius.json === 'boolean'
        ? values.statusRadius.json
        : null,
    infoJson: values.information && values.information.json,
  });

  INSIDE_CONTRACT_CACHE.set(contractId, {
    contractId,
    objID: result.objID,
    accountName: result.accountName,
    macAddress: result.macAddress || '',
    fetchedAt: Date.now(),
  });

  return result;
}

const CACHE_TTL_MS = 15 * 60 * 1000;

async function resolveInsideObjId(contractId) {
  const cached = INSIDE_CONTRACT_CACHE.get(contractId);
  if (cached && cached.objID && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { objID: cached.objID };
  }

  const lookupRes = await lookupInsideLive(contractId);
  if (!lookupRes || lookupRes.status !== 'ok') {
    return { errorResult: lookupRes };
  }
  if (!lookupRes.objID) {
    return {
      errorResult: {
        status: 'error',
        title: `Không tìm thấy ObjID cho ${contractId}`,
        message: 'Inside chưa trả về ObjID của hợp đồng này nên chưa thể gửi lệnh.',
        loginUrl: PORTALS.inside.url,
      },
    };
  }
  return { objID: lookupRes.objID };
}

async function executeInsideGetMutation({
  actionLabel,
  contractId,
  objID,
  url,
  extraFields = [],
}) {
  const res = await requestPortal({
    url,
    method: 'GET',
    headers: AJAX_HEADERS,
    timeout: 15000,
  });

  if (res.error === 'NETWORK_ERROR' || res.error === 'TIMEOUT' || res.status === 0) {
    return {
      status: 'error',
      message: `Không kết nối được tới mvc.inside.fpt.net để chạy ${actionLabel}. Hãy kiểm tra VPN công ty đã bật chưa.`,
      loginUrl: PORTALS.inside.url,
    };
  }

  const iam = detectIamRedirect({
    status: res.status,
    finalUrl: res.finalUrl,
    responseText: res.responseText,
    requestedUrl: url,
  });
  if (iam.expired) {
    return {
      status: 'iam_expired',
      message: 'Phiên đăng nhập IAM đã hết hạn. Bấm nút bên dưới để đăng nhập lại.',
      loginUrl: res.finalUrl || PORTALS.inside.url,
    };
  }

  return parseInsideMutationResponse({
    actionLabel,
    contractId,
    objID,
    httpStatus: res.status,
    responseText: res.responseText,
    extraFields,
  });
}

/**
 * Chuan hoa danh sach phien online tu KillSession/SearchListForKillSession.
 */
export function parseKillSessionRows(json) {
  const rows = Array.isArray(json)
    ? json
    : json && typeof json === 'object' && Array.isArray(json.data)
    ? json.data
    : [];

  return rows
    .filter((r) => r && typeof r === 'object')
    .slice(0, 20)
    .map((r) => ({
      objID: nonEmptyStr(r.ObjID ?? r.objID ?? r.objId ?? r.ID),
      date: formatInsideTimestamp(r.Date ?? r.date ?? r.StartTime),
      name: nonEmptyStr(r.Name ?? r.UserName),
      nasName: nonEmptyStr(r.NASName ?? r.NAS),
      ipAddress: nonEmptyStr(r.IPAddress ?? r.IP),
      callerId: nonEmptyStr(r.CallerID ?? r.MAC),
    }))
    .filter((row) => row.objID || row.ipAddress);
}

/**
 * Lay danh sach phien đang online theo hop dong tu KillSession/SearchListForKillSession.
 */
export async function fetchInsideOnlineSessions(rawContractId, ctx = {}) {
  const check = validateContractId(rawContractId);
  if (!check.valid) {
    return {
      status: 'validation_error',
      message: check.error,
      sessions: [],
    };
  }

  const contractId = check.value;
  if (!isUserscriptEnv() || ctx.forceDemo) {
    return {
      status: 'ok',
      mode: 'demo',
      sessions: [
        {
          objID: '1162622263',
          date: '23/11/2026 04:16:30',
          name: `Vtfdl-${contractId.toLowerCase()}`,
          nasName: 'HCM-BRAS-CTR-03-05',
          ipAddress: '21.174.165.216',
          callerId: 'd4:61:95:a0:6e:41',
        },
      ],
    };
  }

  const body = new URLSearchParams({
    searchBy: '1',
    searchValue: contractId,
  });

  const res = await requestPortal({
    url: INSIDE_ENDPOINTS.kill_session.search,
    method: 'POST',
    headers: {
      ...AJAX_HEADERS,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    data: body.toString(),
    timeout: 15000,
  });

  if (res.error === 'NETWORK_ERROR' || res.error === 'TIMEOUT' || res.status === 0) {
    return {
      status: 'error',
      message: 'Không kết nối được tới mvc.inside.fpt.net để tìm phiên đang chạy. Hãy kiểm tra VPN.',
      loginUrl: PORTALS.inside.url,
      sessions: [],
    };
  }

  const iam = detectIamRedirect({
    status: res.status,
    finalUrl: res.finalUrl,
    responseText: res.responseText,
    requestedUrl: INSIDE_ENDPOINTS.kill_session.search,
  });
  if (iam.expired) {
    return {
      status: 'iam_expired',
      message: 'Phiên đăng nhập IAM đã hết hạn. Bấm nút bên dưới để đăng nhập lại.',
      loginUrl: res.finalUrl || PORTALS.inside.url,
      sessions: [],
    };
  }

  if (!res.ok) {
    return {
      status: 'error',
      message: `Không tải được danh sách phiên đang chạy (HTTP ${res.status}).`,
      loginUrl: PORTALS.inside.url,
      sessions: [],
    };
  }

  return {
    status: 'ok',
    mode: 'live',
    sessions: parseKillSessionRows(safeJsonParse(res.responseText)),
  };
}

async function killSessionLive(contractId, ctx = {}) {
  let objID =
    ctx.objID !== undefined && ctx.objID !== null ? String(ctx.objID).trim() : '';

  if (!objID) {
    const resolved = await resolveInsideObjId(contractId);
    if (resolved.errorResult) {
      return resolved.errorResult;
    }
    objID = resolved.objID;
  }

  const extraFields = [];
  if (ctx.ipAddress) extraFields.push({ label: 'IP đã Kill', value: String(ctx.ipAddress) });
  if (ctx.nasName) extraFields.push({ label: 'BRAS / NAS', value: String(ctx.nasName) });
  if (ctx.sessionName) extraFields.push({ label: 'Tên truy nhập', value: String(ctx.sessionName) });

  const url = `${INSIDE_ENDPOINTS.kill_session.delete}?objID=${encodeURIComponent(objID)}`;
  return executeInsideGetMutation({
    actionLabel: 'Kill Session',
    contractId,
    objID,
    url,
    extraFields,
  });
}

/**
 * Tai thong tin nhanh (ObjID, Account, MAC Modem dang chay) cua hop dong tu ViewReportDetail.
 */
export async function fetchInsideModemInfo(rawContractId, ctx = {}) {
  const check = validateContractId(rawContractId);
  if (!check.valid) {
    return {
      status: 'validation_error',
      message: check.error,
    };
  }

  const contractId = check.value;
  if (!isUserscriptEnv() || ctx.forceDemo) {
    return {
      status: 'ok',
      mode: 'demo',
      contractId,
      objID: '1162622263',
      accountName: 'vtfdl-demo-2393',
      macAddress: 'd4:61:95:a0:6e:41',
      customerName: 'Khách hàng mẫu',
    };
  }

  const locationCandidates = getLocationCandidates();
  let matchedRow = null;

  for (const loc of locationCandidates) {
    const detailUrl = `${INSIDE_ENDPOINTS.lookup.detail}?location=${encodeURIComponent(
      loc
    )}&contract=${encodeURIComponent(contractId)}`;
    const outcome = await fetchInsideEndpoint(detailUrl, false);
    if (outcome.iamExpired) {
      return {
        status: 'iam_expired',
        message: 'Phiên đăng nhập IAM đã hết hạn. Bấm nút bên dưới để đăng nhập lại.',
        loginUrl: outcome.loginUrl || PORTALS.inside.url,
      };
    }
    if (outcome.networkError) {
      return {
        status: 'error',
        message: 'Không kết nối được tới mvc.inside.fpt.net. Hãy kiểm tra VPN công ty đã bật chưa.',
        loginUrl: PORTALS.inside.url,
      };
    }

    const row = pickFirstRow(outcome.json);
    if (row) {
      matchedRow = row;
      break;
    }
  }

  if (!matchedRow) {
    return {
      status: 'warn',
      message: `Không tìm thấy hợp đồng ${contractId} trên hệ thống Inside.`,
      loginUrl: PORTALS.inside.url,
    };
  }

  const objID =
    matchedRow.ID !== null && matchedRow.ID !== undefined ? String(matchedRow.ID).trim() : '';
  const accountName =
    nonEmptyStr(matchedRow.Name) ||
    nonEmptyStr(matchedRow.Account) ||
    nonEmptyStr(matchedRow.UserName) ||
    nonEmptyStr(matchedRow.Name1);
  const macAddress = nonEmptyStr(matchedRow.MACAddress);
  const customerName = nonEmptyStr(matchedRow.FullName);

  INSIDE_CONTRACT_CACHE.set(contractId, {
    contractId,
    objID: objID || null,
    accountName,
    macAddress,
    fetchedAt: Date.now(),
  });

  return {
    status: 'ok',
    mode: 'live',
    contractId,
    objID,
    accountName,
    macAddress,
    customerName,
  };
}

async function resetMacModemLive(contractId, rawNewMac = '', ctx = {}) {
  const resolved = await resolveInsideObjId(contractId);
  if (resolved.errorResult) {
    return resolved.errorResult;
  }

  const objID = resolved.objID;
  const newMac = String(rawNewMac || '').replace(/\s+/g, '').trim();
  const url = `${INSIDE_ENDPOINTS.reset_mac}?ObjID=${encodeURIComponent(
    objID
  )}&NewMAC=${encodeURIComponent(newMac)}`;

  const extraFields = [];
  if (ctx.previousMac && String(ctx.previousMac).trim()) {
    extraFields.push({
      label: 'MAC trước khi đổi',
      value: String(ctx.previousMac).trim(),
    });
  }
  extraFields.push({
    label: 'Chế độ Reset MAC',
    value: newMac ? `Đổi sang ${newMac}` : 'Xóa trắng MAC (NewMAC trống)',
  });

  const res = await executeInsideGetMutation({
    actionLabel: 'Reset MAC Modem',
    contractId,
    objID,
    url,
    extraFields,
  });

  if (res && res.status === 'ok') {
    const existing = INSIDE_CONTRACT_CACHE.get(contractId);
    if (existing) {
      existing.macAddress = newMac;
      existing.fetchedAt = Date.now();
    }
  }

  return res;
}

function buildInsideMockResult(actionId, contractId, ctx = {}) {
  switch (actionId) {
    case 'lookup':
      return {
        status: 'ok',
        mode: 'demo',
        title: `Thông tin hợp đồng ${contractId} (Dữ liệu mô phỏng)`,
        message: 'Đã tải thông tin mẫu để bạn kiểm tra giao diện trước khi ghép API thật.',
        summaryFields: [
          { label: 'Mã hợp đồng', value: contractId },
          { label: 'Trạng thái thuê bao', value: 'Đang hoạt động (Online)' },
          { label: 'Gói cước', value: 'Sky / Giga 300Mbps (Mô phỏng)' },
          { label: 'Địa chỉ MAC hiện tại', value: 'A4:2B:8C:10:9E:4F' },
          { label: 'Phiên PPPoE', value: 'Đang giữ phiên • 1 giờ 42 phút' },
          { label: 'Trạng thái OSP', value: 'Đã đồng bộ port bình thường' },
          { label: 'Nguồn dữ liệu', value: 'Dữ liệu mô phỏng (chưa bật VPN/Userscript)' },
        ],
        embeddedViews: [
          {
            id: 'radius_params',
            title: 'Thông số kết nối',
            badge: 'Radius',
            url: '',
            defaultOpen: true,
            height: 480,
            demoNote:
              'Khi bật VPN và cài Tampermonkey, khung này sẽ tải trực tiếp dữ liệu thật từ radius-portal.fpt.net (Tín hiệu quang, Hạ tầng OLT, Modem, IPv6/CoA).',
          },
          {
            id: 'radius_online',
            title: 'Online Connections',
            badge: 'Phiên mạng',
            url: '',
            defaultOpen: true,
            height: 250,
            demoNote:
              'Khi bật VPN và cài Tampermonkey, khung này sẽ tải trực tiếp phiên kết nối đang online từ radius-portal.fpt.net (BRAS, IPNAT, IPv6 PD, MAC online).',
          },
          {
            id: 'radius_errors',
            title: 'Last Access Errors',
            badge: 'Lịch sử lỗi',
            url: '',
            defaultOpen: false,
            height: 250,
            demoNote:
              'Khi bật VPN và cài Tampermonkey, khung này sẽ tải trực tiếp lịch sử lỗi truy cập gần nhất từ radius-portal.fpt.net.',
          },
          {
            id: 'iptv',
            title: 'IPTV',
            badge: 'Nếu có dùng',
            url: '',
            defaultOpen: false,
            height: 360,
            demoNote:
              'Khi bật VPN và cài Tampermonkey, khung này sẽ tải trực tiếp thông tin dịch vụ & danh sách đầu thu IPTV từ mvc.inside.fpt.net.',
          },
          {
            id: 'camera',
            title: 'FPT Camera',
            badge: 'Nếu có dùng',
            url: '',
            defaultOpen: false,
            height: 340,
            demoNote:
              'Khi bật VPN và cài Tampermonkey, khung này sẽ tải trực tiếp danh sách thiết bị & gói Cloud FPT Camera từ mvc.inside.fpt.net.',
          },
        ],
      };
    case 'reset_mac': {
      const newMac = String(ctx.newMac || '').replace(/\s+/g, '').trim();
      const prevMac = String(ctx.previousMac || '').trim();
      const fields = [{ label: 'Mã hợp đồng', value: contractId }];
      if (prevMac) fields.push({ label: 'MAC trước khi đổi', value: prevMac });
      fields.push({
        label: 'Chế độ Reset MAC',
        value: newMac ? `Đổi sang ${newMac}` : 'Xóa trắng MAC (NewMAC trống)',
      });
      return {
        status: 'ok',
        mode: 'demo',
        title: `Đã Reset MAC Modem cho ${contractId} (Dữ liệu mô phỏng)`,
        message: newMac
          ? `Lệnh mô phỏng thành công: Đã cập nhật MAC Modem sang ${newMac}.`
          : 'Lệnh mô phỏng thành công: MAC Modem đã được xóa trắng để thiết bị nhận kết nối mới.',
        summaryFields: fields,
      };
    }
    case 'reset_mac_box': {
      const oldMac = String(ctx.oldMac || `FBOX${contractId}`).trim();
      const newMac = normalizeBoxMac(ctx.newMac || '') || 'FBOX001122334455';
      return {
        status: 'ok',
        mode: 'demo',
        title: `Đã Reset MAC Box cho ${contractId} (Dữ liệu mô phỏng)`,
        message: 'Lệnh mô phỏng thành công: Thay thế MAC Box thành công trên bản xem thử.',
        summaryFields: [
          { label: 'Mã hợp đồng', value: contractId },
          { label: 'MAC Box cũ', value: oldMac },
          { label: 'MAC Box mới', value: newMac },
          { label: 'Mã trạng thái', value: '9' },
        ],
      };
    }
    case 'kill_session': {
      const fields = [{ label: 'Mã hợp đồng', value: contractId }];
      if (ctx.objID) fields.push({ label: 'ObjID', value: String(ctx.objID) });
      if (ctx.ipAddress) fields.push({ label: 'IP đã Kill', value: String(ctx.ipAddress) });
      if (ctx.nasName) fields.push({ label: 'BRAS / NAS', value: String(ctx.nasName) });
      return {
        status: 'ok',
        mode: 'demo',
        title: `Đã Kill Session cho ${contractId} (Dữ liệu mô phỏng)`,
        message: ctx.ipAddress
          ? `Lệnh mô phỏng thành công: Đã ngắt phiên IP ${ctx.ipAddress} để thiết bị quay lại phiên mới.`
          : 'Lệnh mô phỏng thành công: Phiên PPPoE giả lập đã được ngắt để quay lại phiên mới.',
        summaryFields: ctx.ipAddress || ctx.objID ? fields : undefined,
      };
    }
    case 'clear_osp': {
      const oltLabel = ctx.oltName || (ctx.oltId ? `OLT ${ctx.oltId}` : 'BRUP00101GC16');
      const portsCsv =
        Array.isArray(ctx.ports) && ctx.ports.length > 0 ? ctx.ports.join(',') : '1';
      const fields = [];
      if (contractId) fields.push({ label: 'Mã hợp đồng', value: contractId });
      fields.push(
        { label: 'POP OLT', value: oltLabel },
        { label: 'Port đã chọn', value: portsCsv },
        { label: 'Lệnh thực hiện', value: 'Clear Serial' }
      );
      return {
        status: 'ok',
        mode: 'demo',
        title: `Đã Clear Serial cho ${oltLabel} (Dữ liệu mô phỏng)`,
        message: `Lệnh mô phỏng Clear Serial trên Port ${portsCsv} của ${oltLabel} thành công.`,
        summaryFields: fields,
      };
    }
    default:
      return {
        status: 'error',
        mode: 'demo',
        message: 'Không nhận diện được thao tác yêu cầu.',
      };
  }
}

function makeDefaultOltPorts() {
  return Array.from({ length: 16 }, (_, idx) => {
    const portNum = idx + 1;
    return {
      value: String(portNum),
      label: `Port ${portNum}`,
      isType2: portNum > 8,
    };
  });
}

/**
 * Chuan hoa MAC Box: bo khoang trang, dau :, dau -, viet hoa.
 */
export function normalizeBoxMac(raw) {
  return String(raw || '')
    .replace(/[\s:-]+/g, '')
    .trim()
    .toUpperCase();
}

/**
 * Kiem tra quy tac MAC Box moi giong trang ReplaceMAC cua Inside:
 * 12 ky tu (khong co FBOX o dau) hoac 16 ky tu (bat dau bang FBOX).
 */
export function validateBoxNewMac(raw) {
  const value = normalizeBoxMac(raw);
  if (!value) {
    return {
      valid: false,
      value: '',
      error: 'Vui lòng nhập MAC Box mới (12 ký tự không gồm FBOX, hoặc 16 ký tự bắt đầu bằng FBOX).',
    };
  }
  if (!/^[A-Z0-9]+$/.test(value)) {
    return {
      valid: false,
      value,
      error: 'MAC Box chỉ gồm chữ cái và số (không chứa ký tự đặc biệt).',
    };
  }
  if (value.length === 12) {
    if (value.startsWith('FBOX')) {
      return {
        valid: false,
        value,
        error: 'Nếu nhập 12 ký tự thì không có tiền tố FBOX ở đầu.',
      };
    }
    return { valid: true, value, error: '' };
  }
  if (value.length === 16) {
    if (!value.startsWith('FBOX')) {
      return {
        valid: false,
        value,
        error: 'Nếu nhập 16 ký tự thì bắt buộc phải bắt đầu bằng FBOX.',
      };
    }
    return { valid: true, value, error: '' };
  }
  return {
    valid: false,
    value,
    error: 'Địa chỉ MAC Box phải dài đúng 12 hoặc 16 ký tự.',
  };
}

/**
 * Lay danh sach MAC Box dang gan voi hop dong tu ReplaceMAC/GetMacContract.
 */
export async function fetchInsideBoxMacs(rawContractId, ctx = {}) {
  const check = validateContractId(rawContractId);
  if (!check.valid) {
    return {
      status: 'validation_error',
      message: check.error,
      items: [],
    };
  }

  const contractId = check.value;
  if (!isUserscriptEnv() || ctx.forceDemo) {
    return {
      status: 'ok',
      mode: 'demo',
      items: [
        {
          MAC: `FBOX${contractId}`,
          Contract: contractId,
          IdContract: '1162622263',
          MacNew: '',
        },
        {
          MAC: 'A42B8C109E4F',
          Contract: contractId,
          IdContract: '1162622263',
          MacNew: '',
        },
      ],
    };
  }

  const url = `${INSIDE_ENDPOINTS.reset_mac_box.list}?Contract=${encodeURIComponent(
    contractId
  )}&NotMAC=`;
  const outcome = await fetchInsideEndpoint(url, false);
  if (outcome.iamExpired) {
    return {
      status: 'iam_expired',
      message: 'Phiên đăng nhập IAM đã hết hạn. Bấm nút bên dưới để đăng nhập lại.',
      loginUrl: outcome.loginUrl || PORTALS.inside.url,
      items: [],
    };
  }
  if (outcome.networkError) {
    return {
      status: 'error',
      message: 'Không kết nối được tới mvc.inside.fpt.net. Hãy kiểm tra VPN công ty đã bật chưa.',
      loginUrl: PORTALS.inside.url,
      items: [],
    };
  }
  if (!outcome.ok) {
    return {
      status: 'error',
      message: 'Không lấy được danh sách MAC Box từ máy chủ Inside.',
      loginUrl: PORTALS.inside.url,
      items: [],
    };
  }

  const rawList = Array.isArray(outcome.json && outcome.json.data) ? outcome.json.data : [];
  const items = rawList
    .map((row) => ({
      MAC: nonEmptyStr(row && row.MAC),
      Contract: nonEmptyStr(row && row.Contract) || contractId,
      IdContract: nonEmptyStr(row && row.IdContract),
      MacNew: nonEmptyStr(row && row.MacNew),
    }))
    .filter((item) => item.MAC);

  return {
    status: 'ok',
    mode: 'live',
    items,
  };
}

/**
 * Chuyen dinh dang ngay ASP.NET /Date(ms)/ sang DD/MM/YYYY HH:mm:ss.
 */
export function formatInsideTimestamp(raw) {
  if (raw === null || raw === undefined) return '';
  const s = String(raw).trim();
  if (!s) return '';
  const aspMatch = s.match(/^\/Date\((-?\d+)(?:[+-]\d{4})?\)\/$/i);
  if (aspMatch) {
    const ms = Number(aspMatch[1]);
    if (Number.isFinite(ms)) {
      const d = new Date(ms);
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
        d.getHours()
      )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
  }
  return s;
}

const LOG_PII_KEY_RE =
  /(pass|pwd|secret|token|cookie|auth|otp|phone|mobile|sdt|tel|cmnd|cccd|email|address|fullname|tenkh)/i;

/**
 * Chuan hoa danh sach lich su thay the MAC Box tu ReplaceMAC/GetLogByContract.
 */
export function parseBoxMacLogItems(json) {
  const rows = Array.isArray(json)
    ? json
    : json && typeof json === 'object'
    ? Array.isArray(json.data)
      ? json.data
      : Array.isArray(json.Data)
      ? json.Data
      : Array.isArray(json.logs)
      ? json.logs
      : []
    : [];

  function pickField(lowerMap, candidates, formatTimeVal = false) {
    for (const c of candidates) {
      if (lowerMap.has(c)) {
        const entry = lowerMap.get(c);
        const text = formatTimeVal
          ? formatInsideTimestamp(entry.val)
          : nonEmptyStr(entry.val);
        if (text) {
          return { key: c, value: text };
        }
      }
    }
    return { key: '', value: '' };
  }

  return rows
    .filter((row) => row && typeof row === 'object')
    .slice(0, 40)
    .map((row) => {
      const lowerMap = new Map();
      for (const [k, v] of Object.entries(row)) {
        lowerMap.set(k.toLowerCase(), { origKey: k, val: v });
      }

      const oldHit = pickField(lowerMap, ['oldmac', 'macold', 'mac_old', 'old_mac', 'mac']);
      const newHit = pickField(lowerMap, [
        'newmac',
        'macnew',
        'mac_new',
        'new_mac',
        'macreplace',
        'replacemac',
      ]);
      const timeHit = pickField(
        lowerMap,
        [
          'modifydate',
          'createdate',
          'createddate',
          'createdat',
          'date',
          'logdate',
          'updatedate',
          'updateddate',
          'time',
          'thoigian',
          'ngaythuchien',
          'actiondate',
        ],
        true
      );
      const actorHit = pickField(lowerMap, [
        'modifyby',
        'createby',
        'createdby',
        'user',
        'username',
        'actor',
        'nguoithuchien',
        'staff',
        'employee',
        'updateby',
        'updatedby',
      ]);
      const oldBoxTypeHit = pickField(lowerMap, ['oldboxtype_name', 'oldboxtype']);
      const newBoxTypeHit = pickField(lowerMap, ['newboxtype_name', 'newboxtype']);
      const noteHit = pickField(lowerMap, [
        'note',
        'description',
        'des',
        'statusname',
        'status',
        'msg',
        'message',
        'reason',
        'ghichu',
        'action',
        'type',
      ]);

      const usedKeys = new Set(
        [
          oldHit.key,
          newHit.key,
          timeHit.key,
          actorHit.key,
          oldBoxTypeHit.key,
          newBoxTypeHit.key,
          noteHit.key,
        ].filter(Boolean)
      );

      const skippedExtra = new Set([
        'contract',
        'idcontract',
        'id',
        'objid',
        'oldboxtype',
        'newboxtype',
        'oldboxtype_name',
        'newboxtype_name',
      ]);

      const extraFields = [];
      for (const [lk, { origKey, val }] of lowerMap.entries()) {
        if (usedKeys.has(lk) || skippedExtra.has(lk) || LOG_PII_KEY_RE.test(origKey)) {
          continue;
        }
        const formatted = formatInsideTimestamp(val);
        if (formatted) {
          extraFields.push({ label: origKey, value: formatted });
        }
      }

      return {
        oldMac: oldHit.value,
        newMac: newHit.value,
        time: timeHit.value,
        actor: actorHit.value,
        oldBoxType: oldBoxTypeHit.value,
        newBoxType: newBoxTypeHit.value,
        note: noteHit.value,
        extraFields,
      };
    });
}

/**
 * Lay lich su hoan doi / Reset MAC Box theo hop dong tu GetLogByContract.
 */
export async function fetchInsideBoxMacLogs(rawContractId, ctx = {}) {
  const check = validateContractId(rawContractId);
  if (!check.valid) {
    return {
      status: 'validation_error',
      message: check.error,
      logs: [],
    };
  }

  const contractId = check.value;
  if (!isUserscriptEnv() || ctx.forceDemo) {
    return {
      status: 'ok',
      mode: 'demo',
      logs: [
        {
          oldMac: 'FBOXOLD001122334',
          newMac: `FBOX${contractId}`,
          time: '20/11/2026 10:46:16',
          actor: 'ktv.demo',
          oldBoxType: 'FPT Play Box S550',
          newBoxType: 'FPT Play Box 650',
          note: 'Đổi Box tại nhà khách hàng (Mô phỏng)',
          extraFields: [],
        },
        {
          oldMac: 'A42B8C109E00',
          newMac: 'A42B8C109E4F',
          time: '12/09/2026 15:18:02',
          actor: 'ktv.demo2',
          oldBoxType: 'FPT Play Box T590',
          newBoxType: 'FPT Play Box S550',
          note: 'Thay thế thành công',
          extraFields: [],
        },
      ],
    };
  }

  const url = `${INSIDE_ENDPOINTS.reset_mac_box.log}?contract=${encodeURIComponent(
    contractId
  )}&_=${Date.now()}`;
  const outcome = await fetchInsideEndpoint(url, false);
  if (outcome.iamExpired) {
    return {
      status: 'iam_expired',
      message: 'Phiên đăng nhập IAM đã hết hạn. Bấm nút bên dưới để đăng nhập lại.',
      loginUrl: outcome.loginUrl || PORTALS.inside.url,
      logs: [],
    };
  }
  if (outcome.networkError) {
    return {
      status: 'error',
      message: 'Không kết nối được tới mvc.inside.fpt.net để xem lịch sử MAC Box. Hãy kiểm tra VPN.',
      loginUrl: PORTALS.inside.url,
      logs: [],
    };
  }
  if (!outcome.ok) {
    return {
      status: 'error',
      message: 'Không tải được lịch sử Reset MAC Box từ máy chủ Inside.',
      loginUrl: PORTALS.inside.url,
      logs: [],
    };
  }

  return {
    status: 'ok',
    mode: 'live',
    logs: parseBoxMacLogItems(outcome.json),
  };
}

/**
 * Chuan hoa ket qua tra ve tu ReplaceMAC/UpdateMAC.
 */
export function parseReplaceMacBoxResponse({
  contractId,
  oldMac = '',
  newMac = '',
  idContract = '',
  httpStatus = 0,
  responseText = '',
} = {}) {
  const summaryFields = [{ label: 'Mã hợp đồng', value: contractId }];
  if (oldMac) summaryFields.push({ label: 'MAC Box cũ', value: oldMac });
  if (newMac) summaryFields.push({ label: 'MAC Box mới', value: newMac });
  if (idContract) summaryFields.push({ label: 'IdContract', value: String(idContract) });

  const json = safeJsonParse(responseText);
  const rawMsg = extractServerResponseMessage(responseText, json);

  if (httpStatus < 200 || httpStatus >= 400) {
    if (rawMsg) {
      summaryFields.push({ label: 'Phản hồi hệ thống', value: rawMsg });
    }
    return {
      status: 'error',
      mode: 'live',
      title: `Reset MAC Box thất bại (HTTP ${httpStatus})`,
      message: rawMsg || `Máy chủ Inside trả về mã lỗi ${httpStatus}.`,
      summaryFields,
    };
  }

  const statusVal = json && typeof json === 'object' ? json.status : undefined;
  if (typeof statusVal === 'number') {
    summaryFields.push({ label: 'Mã trạng thái', value: String(statusVal) });
  }

  const isSuccess = statusVal === 9 || statusVal === true;
  const isFailure =
    statusVal === 0 ||
    statusVal === false ||
    (typeof statusVal === 'number' && statusVal !== 9) ||
    json === false ||
    (json &&
      typeof json === 'object' &&
      (json.success === false || json.result === 0 || json.result === -1)) ||
    (!isSuccess && Boolean(rawMsg && MUTATION_ERROR_RE.test(rawMsg)));

  const defaultMsg = isFailure
    ? statusVal === 0
      ? 'Số hợp đồng hoặc thông tin MAC chưa đúng (status = 0).'
      : 'Hệ thống Inside không chấp nhận yêu cầu đổi MAC Box này.'
    : 'Thay thế MAC Box thành công!';
  const finalMsg = rawMsg || defaultMsg;
  summaryFields.push({ label: 'Phản hồi hệ thống', value: finalMsg });

  if (isFailure) {
    return {
      status: 'error',
      mode: 'live',
      title: 'Reset MAC Box chưa thành công',
      message: finalMsg,
      summaryFields,
    };
  }

  return {
    status: 'ok',
    mode: 'live',
    title: `Đã Reset MAC Box cho ${contractId}`,
    message: finalMsg,
    summaryFields,
  };
}

async function resetMacBoxLive(contractId, ctx = {}) {
  const oldMac = String(ctx.oldMac || '').trim();
  if (!oldMac) {
    return {
      status: 'validation_error',
      title: 'Chưa chọn MAC Box cũ',
      message: 'Vui lòng chọn MAC Box hiện tại cần thay thế trước khi xác nhận.',
    };
  }

  const macCheck = validateBoxNewMac(ctx.newMac || '');
  if (!macCheck.valid) {
    return {
      status: 'validation_error',
      title: 'MAC Box mới chưa hợp lệ',
      message: macCheck.error,
    };
  }

  let idContract = String(ctx.idContract || '').trim();
  if (!idContract) {
    const cached = INSIDE_CONTRACT_CACHE.get(contractId);
    if (cached && cached.objID) {
      idContract = String(cached.objID);
    }
  }

  const body = new URLSearchParams({
    contract: contractId,
    newmac: macCheck.value,
    oldmac: oldMac,
    idcontract: idContract,
  });

  const res = await requestPortal({
    url: INSIDE_ENDPOINTS.reset_mac_box.update,
    method: 'POST',
    headers: {
      ...AJAX_HEADERS,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    data: body.toString(),
    timeout: 15000,
  });

  if (res.error === 'NETWORK_ERROR' || res.error === 'TIMEOUT' || res.status === 0) {
    return {
      status: 'error',
      message:
        'Không kết nối được tới mvc.inside.fpt.net để đổi MAC Box. Hãy kiểm tra VPN công ty đã bật chưa.',
      loginUrl: PORTALS.inside.url,
    };
  }

  const iam = detectIamRedirect({
    status: res.status,
    finalUrl: res.finalUrl,
    responseText: res.responseText,
    requestedUrl: INSIDE_ENDPOINTS.reset_mac_box.update,
  });
  if (iam.expired) {
    return {
      status: 'iam_expired',
      message: 'Phiên đăng nhập IAM đã hết hạn. Bấm nút bên dưới để đăng nhập lại.',
      loginUrl: res.finalUrl || PORTALS.inside.url,
    };
  }

  return parseReplaceMacBoxResponse({
    contractId,
    oldMac,
    newMac: macCheck.value,
    idContract,
    httpStatus: res.status,
    responseText: res.responseText,
  });
}

/**
 * Tach danh sach POP OLT tu phan hoi GetOLTList.asp (dinh dang id@name$id2@name2).
 */
export function parseOltListResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return [];
  }
  const tokens = rawText.split('$');
  const olts = [];
  const seenIds = new Set();

  for (const token of tokens) {
    const trimmed = token.trim();
    if (!trimmed) continue;
    const atIdx = trimmed.indexOf('@');
    if (atIdx === -1) continue;
    const id = trimmed.slice(0, atIdx).trim();
    const name = trimmed.slice(atIdx + 1).trim();
    if (!id || id === '0' || !name || seenIds.has(id)) {
      continue;
    }
    seenIds.add(id);
    olts.push({ id, name });
  }

  return olts;
}

/**
 * OLT co 4 ky tu cuoi la GC16 hoac GC14 ho tro 16 port (type2).
 */
export function isExtendedPortOlt(oltName) {
  const s = String(oltName || '').trim().toUpperCase();
  const tail = s.slice(-4);
  return tail === 'GC16' || tail === 'GC14';
}

function cleanRadiusToken(raw) {
  const s = String(raw || '').trim();
  if (!s || s === '-' || /^n\/a$/i.test(s) || /^chưa/i.test(s) || /^không/i.test(s)) {
    return '';
  }
  return s;
}

/**
 * Trich xuat OLT POP, Slot, Port, ONU va IP OLT tu noi dung hien thi trang Thong so ket noi Radius.
 */
export function parseRadiusOltFromText(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return null;
  }
  const normalized = rawText.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');
  const m = normalized.match(
    /([A-Z0-9][A-Z0-9._-]{4,30})\s*\[\s*S\s*:\s*([^/\]]+?)\s*\/\s*P\s*:\s*([^/\]]+?)\s*\/\s*O\s*:\s*([^\]]+?)\s*\]/i
  );
  if (!m) {
    return null;
  }
  let oltPop = cleanRadiusToken(m[1]).replace(/^ONU(?=[A-Z]{2,}\d)/i, '');
  if (!oltPop) {
    return null;
  }
  const slot = cleanRadiusToken(m[2]);
  const port = cleanRadiusToken(m[3]);
  const onu = cleanRadiusToken(m[4]);
  const ipMatch = normalized.match(/IP\s*OLT[\s:]*(\d{1,3}(?:\.\d{1,3}){3})/i);
  const ipOlt = ipMatch ? ipMatch[1].trim() : '';

  return { oltPop, slot, port, onu, ipOlt };
}

/**
 * Tim POP OLT phu hop trong danh sach GetOLTList.asp theo ten OLT tu Thong so ket noi.
 */
export function findMatchingOltOption(oltList, oltPop) {
  const list = Array.isArray(oltList) ? oltList : [];
  const raw = String(oltPop || '').trim();
  if (!raw || list.length === 0) {
    return null;
  }

  const lower = raw.toLowerCase();
  const compact = raw.replace(/\s+/g, '').toUpperCase();

  const exact = list.find(
    (o) => String(o && o.name ? o.name : '').trim().toLowerCase() === lower
  );
  if (exact) return exact;

  const startsOrCompact = list.find((o) => {
    const oComp = String(o && o.name ? o.name : '').replace(/\s+/g, '').toUpperCase();
    if (!oComp) return false;
    return oComp === compact || oComp.startsWith(compact) || compact.startsWith(oComp);
  });
  if (startsOrCompact) return startsOrCompact;

  if (compact.length >= 6) {
    const partial = list.find((o) => {
      const oComp = String(o && o.name ? o.name : '').replace(/\s+/g, '').toUpperCase();
      if (oComp.length < 6) return false;
      return oComp.includes(compact) || compact.includes(oComp);
    });
    if (partial) return partial;
  }

  return null;
}

function getHtmlAttr(attrs, attrName) {
  const re = new RegExp(`\\b${attrName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const m = String(attrs || '').match(re);
  if (!m) return '';
  return m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3] || '';
}

/**
 * Trich xuat danh sach Vung mien (fLocationID) va ma mac dinh tu trang MonitorOLT/.
 */
export function parseLocationsFromMonitorHtml(htmlText) {
  if (!htmlText || typeof htmlText !== 'string') {
    return { locations: [], defaultLocationId: '' };
  }

  const locations = [];
  const seenIds = new Set();
  let selectedFromAttr = '';

  const selectRe = /<select\b([^>]*)>([\s\S]*?)<\/select>/gi;
  let sm;
  while ((sm = selectRe.exec(htmlText)) !== null) {
    const attrs = sm[1] || '';
    const selId = getHtmlAttr(attrs, 'id');
    const selName = getHtmlAttr(attrs, 'name');
    if (!/^fLocationID$/i.test(selId) && !/^fLocationID$/i.test(selName)) {
      continue;
    }

    const inner = sm[2] || '';
    const optRe = /<option\b([^>]*)>([\s\S]*?)(?=<option\b|<\/option>|<\/select>|$)/gi;
    let om;
    while ((om = optRe.exec(inner)) !== null) {
      const optAttrs = om[1] || '';
      const id = getHtmlAttr(optAttrs, 'value').trim();
      const name = stripHtmlTags(om[2]);
      const isSel = /\bselected\b/i.test(optAttrs);
      if (!id || id === '0' || id === '-1' || seenIds.has(id)) {
        continue;
      }
      seenIds.add(id);
      if (isSel && !selectedFromAttr) {
        selectedFromAttr = id;
      }
      locations.push({ id, name: name || `Vùng ${id}`, selected: isSel });
    }
    break;
  }

  const scriptMatch = htmlText.match(
    /SetCurrentOption\s*\([^,]*fLocationID[^,]*,\s*['"]([^'"]+)['"]\s*\)/i
  );
  const scriptDefault = scriptMatch ? scriptMatch[1].trim() : '';
  const defaultLocationId =
    selectedFromAttr || scriptDefault || (locations[0] && locations[0].id) || '';

  return {
    locations: locations.map((loc) => ({
      id: loc.id,
      name: loc.name,
      selected: loc.id === defaultLocationId,
    })),
    defaultLocationId,
  };
}

/**
 * Trich xuat danh sach Port checkbox tu ViewPortPON.Asp (fallback 1..16).
 */
export function parseOltPortsFromHtml(htmlText) {
  if (!htmlText || typeof htmlText !== 'string') {
    return makeDefaultOltPorts();
  }

  const cleanedHtml = htmlText
    .replace(new RegExp('<script\\b[\\s\\S]*?</' + 'script>', 'gi'), ' ')
    .replace(new RegExp('<style\\b[\\s\\S]*?</' + 'style>', 'gi'), ' ');

  const ports = [];
  const seenValues = new Set();
  const liRe = /<li\b([^>]*)>([\s\S]*?)<\/li>/gi;
  let lm;
  while ((lm = liRe.exec(cleanedHtml)) !== null) {
    const liAttrs = lm[1] || '';
    const liBody = lm[2] || '';
    const inputRe = /<input\b([^>]*)>/gi;
    let im;
    let cbValue = '';
    while ((im = inputRe.exec(liBody)) !== null) {
      const attrs = im[1] || '';
      if (getHtmlAttr(attrs, 'type').toLowerCase() === 'checkbox') {
        cbValue = getHtmlAttr(attrs, 'value').trim();
        break;
      }
    }
    if (!cbValue || seenValues.has(cbValue)) {
      continue;
    }
    seenValues.add(cbValue);
    const spanMatch = liBody.match(/<span\b[^>]*>([\s\S]*?)<\/span>/i);
    const labelText = spanMatch ? stripHtmlTags(spanMatch[1]) : stripHtmlTags(liBody);
    const numVal = Number(cbValue);
    const isType2 = /\btype2\b/i.test(liAttrs) || (Number.isFinite(numVal) && numVal > 8);
    ports.push({
      value: cbValue,
      label: labelText || `Port ${cbValue}`,
      isType2,
    });
  }

  return ports.length > 0 ? ports : makeDefaultOltPorts();
}

/**
 * Lay thong bao alert(...) tu HTML cua trang Classic ASP (ClearSerial.asp...).
 */
export function extractJsAlertMessages(htmlText) {
  if (!htmlText || typeof htmlText !== 'string') {
    return [];
  }
  const messages = [];
  const seen = new Set();
  const alertRe = /\balert\s*\(\s*(['"])((?:\\.|(?!\1)[\s\S])*?)\1\s*\)/gi;
  let am;
  while ((am = alertRe.exec(htmlText)) !== null && messages.length < 10) {
    const raw = am[2]
      .replace(/\\n/g, ' ')
      .replace(/\\r/g, ' ')
      .replace(/\\t/g, ' ')
      .replace(/\\(['"\\])/g, '$1');
    const clean = stripHtmlTags(raw);
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      messages.push(clean);
    }
  }
  return messages;
}

const CLEAR_OSP_ERROR_RE =
  /(?:lỗi(?!.*không có lỗi)|thất\s*bại|fail|không\s*thành\s*công|bạn chưa chọn|ban chua chon|không tìm thấy|khong tim thay|không có quyền|khong co quyen|\berror\b)/i;

/**
 * Chuan hoa ket qua tra ve tu ClearSerial.asp.
 */
export function parseClearSerialResponse({
  contractId = '',
  oltId = '',
  oltName = '',
  portsCsv = '',
  httpStatus = 0,
  responseText = '',
  sourceUrl = '',
} = {}) {
  const actionLabel = 'Clear Serial';
  const summaryFields = [];
  if (contractId) summaryFields.push({ label: 'Mã hợp đồng', value: contractId });
  summaryFields.push(
    { label: 'POP OLT', value: oltName ? `${oltName} (ID: ${oltId})` : String(oltId) },
    { label: 'Port đã chọn', value: portsCsv },
    { label: 'Lệnh thực hiện', value: actionLabel }
  );

  const alerts = extractJsAlertMessages(responseText);
  const json = safeJsonParse(responseText);
  const jsonMsg = json !== null ? extractServerResponseMessage(responseText, json) : '';
  const tablePairs = extractHtmlTablePairs(responseText);
  const extraSections = [];
  if (tablePairs.length > 0) {
    extraSections.push({
      title: 'Chi tiết kết quả từ OLT',
      fields: tablePairs,
    });
  }

  const cleanedBody = stripHtmlTags(
    String(responseText || '')
      .replace(new RegExp('<script\\b[\\s\\S]*?</' + 'script>', 'gi'), ' ')
      .replace(new RegExp('<style\\b[\\s\\S]*?</' + 'style>', 'gi'), ' ')
  );

  const rawMsg = alerts.join(' | ') || jsonMsg || cleanedBody.slice(0, 220);

  if (httpStatus < 200 || httpStatus >= 400) {
    if (rawMsg) {
      summaryFields.push({ label: 'Phản hồi hệ thống', value: rawMsg });
    }
    return {
      status: 'error',
      mode: 'live',
      title: `${actionLabel} thất bại (HTTP ${httpStatus})`,
      message: rawMsg || `Máy chủ Inside trả về mã lỗi ${httpStatus}.`,
      summaryFields,
      extraSections,
      sourceUrl,
    };
  }

  const isJsonFailure =
    json === false ||
    json === 0 ||
    json === -1 ||
    (json &&
      typeof json === 'object' &&
      (json.status === false ||
        json.success === false ||
        json.result === 0 ||
        json.result === -1));
  const isTextFailure = Boolean(rawMsg && CLEAR_OSP_ERROR_RE.test(rawMsg));

  const targetDisplay = oltName || `OLT ${oltId}`;
  const finalMsg =
    rawMsg || `Đã gửi lệnh ${actionLabel} trên Port ${portsCsv} của ${targetDisplay}.`;
  summaryFields.push({ label: 'Phản hồi hệ thống', value: finalMsg });

  if (isJsonFailure || isTextFailure) {
    return {
      status: 'error',
      mode: 'live',
      title: `${actionLabel} chưa thành công`,
      message: finalMsg,
      summaryFields,
      extraSections,
      sourceUrl,
    };
  }

  return {
    status: 'ok',
    mode: 'live',
    title: `Đã ${actionLabel} cho ${targetDisplay}`,
    message: finalMsg,
    summaryFields,
    extraSections,
    sourceUrl,
  };
}

/**
 * Tai danh sach POP OLT theo Vung mien (fLocationID) tu MonitorOLT/GetOLTList.asp.
 */
export async function fetchInsideOltListByLocation(
  locationId,
  { forceRefresh = false, forceDemo = false } = {}
) {
  const locId = String(locationId || '').trim();
  if (!locId) {
    return {
      status: 'validation_error',
      message: 'Chưa chọn vùng miền để tải danh sách POP OLT.',
      olts: [],
    };
  }

  if (!isUserscriptEnv() || forceDemo) {
    return {
      status: 'ok',
      mode: 'demo',
      olts: [
        { id: '101', name: 'BRUP00101GC16' },
        { id: '102', name: 'BRUP00201GC14' },
        { id: '103', name: 'BRUP00301GP08' },
      ],
    };
  }

  if (!forceRefresh) {
    const cached = INSIDE_OLT_CACHE.oltsByLocation.get(locId);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return {
        status: 'ok',
        mode: 'live',
        olts: cached.olts,
      };
    }
  }

  const url = `${INSIDE_ENDPOINTS.clear_osp.oltList}?fLocationID=${encodeURIComponent(
    locId
  )}&fRing=0&fSwitchID=0`;
  const res = await requestPortal({
    url,
    method: 'POST',
    headers: { Accept: 'text/plain, */*' },
    data: '',
    timeout: 15000,
  });

  if (res.error === 'NETWORK_ERROR' || res.error === 'TIMEOUT' || res.status === 0) {
    return {
      status: 'error',
      message: 'Không kết nối được tới inside.fpt.net để tải danh sách POP OLT. Hãy kiểm tra VPN.',
      loginUrl: PORTALS.inside.url,
      olts: [],
    };
  }

  const iam = detectIamRedirect({
    status: res.status,
    finalUrl: res.finalUrl,
    responseText: res.responseText,
    requestedUrl: url,
  });
  if (iam.expired) {
    return {
      status: 'iam_expired',
      message: 'Phiên đăng nhập IAM đã hết hạn. Bấm nút bên dưới để đăng nhập lại.',
      loginUrl: res.finalUrl || PORTALS.inside.url,
      olts: [],
    };
  }

  if (!res.ok) {
    return {
      status: 'error',
      message: `Không tải được danh sách POP OLT (HTTP ${res.status}).`,
      loginUrl: PORTALS.inside.url,
      olts: [],
    };
  }

  const olts = parseOltListResponse(res.responseText);
  INSIDE_OLT_CACHE.oltsByLocation.set(locId, {
    olts,
    fetchedAt: Date.now(),
  });

  return {
    status: 'ok',
    mode: 'live',
    olts,
  };
}

/**
 * Tai thong tin khoi tao cho Clear OSP: Vung mien + danh sach Port + danh sach POP OLT.
 */
export async function fetchInsideOltInit({ forceRefresh = false, forceDemo = false } = {}) {
  if (!isUserscriptEnv() || forceDemo) {
    const demoOltsRes = await fetchInsideOltListByLocation('64', { forceDemo: true });
    return {
      status: 'ok',
      mode: 'demo',
      locations: [
        {
          id: '64',
          name: 'VTU - Hồ Chí Minh - Bà Rịa - Vũng Tàu (Mô phỏng)',
          selected: true,
        },
      ],
      defaultLocationId: '64',
      olts: demoOltsRes.olts,
      ports: makeDefaultOltPorts(),
    };
  }

  if (
    !forceRefresh &&
    INSIDE_OLT_CACHE.locations.length > 0 &&
    INSIDE_OLT_CACHE.ports.length > 0 &&
    INSIDE_OLT_CACHE.defaultLocationId &&
    Date.now() - INSIDE_OLT_CACHE.fetchedAt < CACHE_TTL_MS
  ) {
    const oltsRes = await fetchInsideOltListByLocation(INSIDE_OLT_CACHE.defaultLocationId, {
      forceRefresh: false,
    });
    if (oltsRes.status === 'ok') {
      return {
        status: 'ok',
        mode: 'live',
        locations: INSIDE_OLT_CACHE.locations,
        defaultLocationId: INSIDE_OLT_CACHE.defaultLocationId,
        olts: oltsRes.olts,
        ports: INSIDE_OLT_CACHE.ports,
      };
    }
  }

  const [monitorRes, viewportRes] = await Promise.all([
    fetchInsideEndpoint(INSIDE_ENDPOINTS.clear_osp.monitor, true),
    fetchInsideEndpoint(INSIDE_ENDPOINTS.clear_osp.viewport, true),
  ]);

  for (const part of [monitorRes, viewportRes]) {
    if (part.iamExpired) {
      return {
        status: 'iam_expired',
        message: 'Phiên đăng nhập IAM đã hết hạn. Bấm nút bên dưới để đăng nhập lại.',
        loginUrl: part.loginUrl || PORTALS.inside.url,
      };
    }
    if (part.networkError) {
      return {
        status: 'error',
        message: 'Không kết nối được tới inside.fpt.net (MonitorOLT). Hãy kiểm tra VPN.',
        loginUrl: PORTALS.inside.url,
      };
    }
  }

  const parsedLocs = parseLocationsFromMonitorHtml(monitorRes.text || '');
  let { locations, defaultLocationId } = parsedLocs;

  if (!defaultLocationId && viewportRes.text) {
    const vpLocMatch = viewportRes.text.match(/\bfLocationID\s*=\s*(\d+)/);
    if (vpLocMatch) {
      defaultLocationId = vpLocMatch[1];
      locations = [{ id: defaultLocationId, name: `Vùng ${defaultLocationId}`, selected: true }];
    }
  }

  if (!defaultLocationId) {
    return {
      status: 'error',
      message: 'Không đọc được mã vùng miền (fLocationID) từ trang Tình trạng OLT.',
      loginUrl: INSIDE_ENDPOINTS.clear_osp.viewport,
    };
  }

  const ports = parseOltPortsFromHtml(viewportRes.text || '');
  const oltsRes = await fetchInsideOltListByLocation(defaultLocationId, { forceRefresh });
  if (oltsRes.status !== 'ok') {
    return oltsRes;
  }

  INSIDE_OLT_CACHE.locations = locations;
  INSIDE_OLT_CACHE.defaultLocationId = defaultLocationId;
  INSIDE_OLT_CACHE.ports = ports;
  INSIDE_OLT_CACHE.fetchedAt = Date.now();

  return {
    status: 'ok',
    mode: 'live',
    locations,
    defaultLocationId,
    olts: oltsRes.olts,
    ports,
  };
}

async function clearOspLive(contractId, ctx = {}) {
  const oltId = String(ctx.oltId || '').trim();
  const oltName = String(ctx.oltName || '').trim();
  const locationId = String(ctx.locationId || '').trim();
  const ports = Array.isArray(ctx.ports)
    ? ctx.ports.map((p) => String(p).trim()).filter(Boolean)
    : [];

  if (!oltId || oltId === '0') {
    return {
      status: 'validation_error',
      title: 'Chưa chọn POP OLT',
      message: 'Vui lòng chọn một POP OLT trước khi thực hiện.',
    };
  }
  if (ports.length === 0) {
    return {
      status: 'validation_error',
      title: 'Chưa chọn Port',
      message: 'Vui lòng chọn ít nhất một Port cần xử lý.',
    };
  }

  const portsCsv = ports.join(',');
  const vpQp = new URLSearchParams();
  if (locationId) vpQp.set('fLocationID', locationId);
  vpQp.set('fOLT', oltId);
  const sourceUrl = `${INSIDE_ENDPOINTS.clear_osp.viewport}?${vpQp.toString()}`;

  const targetUrl = `${INSIDE_ENDPOINTS.clear_osp.clearSerial}?OLTID=${encodeURIComponent(
    oltId
  )}&fPort=${encodeURIComponent(portsCsv)}`;

  const res = await requestPortal({
    url: targetUrl,
    method: 'GET',
    headers: { Accept: 'text/html, application/xhtml+xml, */*' },
    timeout: 25000,
  });

  if (res.error === 'NETWORK_ERROR' || res.error === 'TIMEOUT' || res.status === 0) {
    return {
      status: 'error',
      message:
        'Không kết nối được tới inside.fpt.net để chạy Clear Serial. Hãy kiểm tra VPN công ty đã bật chưa.',
      loginUrl: sourceUrl,
    };
  }

  const iam = detectIamRedirect({
    status: res.status,
    finalUrl: res.finalUrl,
    responseText: res.responseText,
    requestedUrl: targetUrl,
  });
  if (iam.expired) {
    return {
      status: 'iam_expired',
      message: 'Phiên đăng nhập IAM đã hết hạn. Bấm nút bên dưới để đăng nhập lại.',
      loginUrl: res.finalUrl || PORTALS.inside.url,
    };
  }

  return parseClearSerialResponse({
    contractId,
    oltId,
    oltName,
    portsCsv,
    httpStatus: res.status,
    responseText: res.responseText,
    sourceUrl,
  });
}

/**
 * Thuc thi mot lenh tren inside.fpt.net.
 */
export async function runInsideAction(actionId, rawContractId, ctx = {}) {
  const portal = PORTALS.inside;

  if (actionId === 'clear_osp') {
    const contractId = normalizeContractId(rawContractId || '');
    if (!isUserscriptEnv() || ctx.forceDemo) {
      await sleep(350);
      return buildInsideMockResult('clear_osp', contractId, ctx);
    }
    return clearOspLive(contractId, ctx);
  }

  const check = validateContractId(rawContractId);
  if (!check.valid) {
    return {
      status: 'validation_error',
      message: check.error,
    };
  }

  const contractId = check.value;

  if (!isUserscriptEnv() || ctx.forceDemo) {
    await sleep(350);
    return buildInsideMockResult(actionId, contractId, ctx);
  }

  if (actionId === 'lookup' && INSIDE_ENDPOINTS.lookup) {
    return lookupInsideLive(contractId);
  }
  if (actionId === 'kill_session' && INSIDE_ENDPOINTS.kill_session) {
    return killSessionLive(contractId, ctx);
  }
  if (actionId === 'reset_mac' && INSIDE_ENDPOINTS.reset_mac) {
    return resetMacModemLive(contractId, ctx.newMac || '', ctx);
  }
  if (actionId === 'reset_mac_box' && INSIDE_ENDPOINTS.reset_mac_box) {
    return resetMacBoxLive(contractId, ctx);
  }

  const endpoint = INSIDE_ENDPOINTS[actionId];
  if (!endpoint) {
    const session = await checkPortalSession(portal);
    if (session.state === 'iam_expired') {
      return {
        status: 'iam_expired',
        message: 'Phiên đăng nhập IAM đã hết hạn. Bấm nút bên dưới để đăng nhập lại.',
        loginUrl: session.loginUrl,
      };
    }
    if (session.state === 'offline') {
      return {
        status: 'error',
        message: session.detail,
        loginUrl: session.loginUrl,
      };
    }
    return {
      status: 'needs_scan',
      message:
        'Đã kết nối được inside.fpt.net (IAM hợp lệ). Hãy bấm nút "Quét cấu trúc" ở góc trên để lấy mẫu thao tác thật ghép vào nút này.',
      hint: 'Hoặc bấm "Mở trang inside.fpt.net gốc" bên dưới (Mã HĐ đã sẵn sàng để dán).',
      loginUrl: portal.url,
    };
  }

  return {
    status: 'needs_scan',
    message: 'Endpoint đang chờ cập nhật chi tiết.',
    loginUrl: portal.url,
  };
}
