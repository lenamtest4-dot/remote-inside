/**
 * Adapter nghiep vu cho Radius Portal (radius-portal.fpt.net / radius-apigateway.fpt.net).
 * Ho tro tra cuu Thong so ket noi (GetbyObjID) va cap nhat IPNAT (statusNAT), IPv6 (statusIPv6) + Kill Session.
 */

import { PORTALS, validateContractId } from '../config/portals.js';
import {
  canWarmPortalSession,
  isAndroidAppEnv,
  isUserscriptEnv,
  requestPortal,
  sleep,
  warmPortalSession,
} from '../core/transport.js';

export const RADIUS_ENDPOINTS = {
  PORTAL_URL: 'http://radius-portal.fpt.net/networkConnection',
  API_BASE: 'http://radius-apigateway.fpt.net/api/v2',
  GET_BY_OBJ_ID: 'http://radius-apigateway.fpt.net/api/v2/NetworkConnection/GetbyObjID',
  CHANGE: 'http://radius-apigateway.fpt.net/api/v2/NetworkConnection/Change',
};

export const RADIUS_NAT_OPTIONS = [
  { value: '1', label: 'Default NAT' },
  { value: '3', label: 'Khách hàng dùng Camera' },
  { value: '5', label: 'ByPass NAT' },
];

export const RADIUS_IPV6_STATUS = {
  RULE: 0,
  ACTIVE: 2,
  DEACTIVATE: 3,
};

export const RADIUS_IPV6_OPTIONS = [
  { value: 3, label: 'Deactivate' },
  { value: 2, label: 'Active' },
  { value: 0, label: 'Rule' },
];

export const RADIUS_CONTRACT_STATUS_LABELS = {
  1: 'Bình thường',
  2: 'Tạm ngưng',
  3: 'Tạm ngưng',
  4: 'Tạm ngưng',
  5: 'Chủ TB đi vắng',
  6: 'Hủy',
  7: 'Đổi địa điểm',
  99: 'Chờ thanh lý',
};

export const RADIUS_IPV6_ONLY_LABELS = {
  '-2': 'Action fail',
  0: 'Deactivate',
  1: 'Active',
  2: 'Processing',
};

export const RADIUS_NAT_NOTE_PRESETS = [
  'KH yeu cau bo IPNAT',
  'KH su dung Camera',
  'Khoi phuc Default NAT',
];

export const RADIUS_IPV6_NOTE_PRESETS = [
  'Bo IPv6 cho KH',
  'Bat IPv6 cho KH',
  'Chuyen IPv6 ve Rule',
];

const VALID_NAT_VALUES = new Set(RADIUS_NAT_OPTIONS.map((o) => String(o.value)));
const VALID_IPV6_VALUES = new Set(RADIUS_IPV6_OPTIONS.map((o) => Number(o.value)));
const NON_ASCII_RE = /[^\u0000-\u007F]/;

const demoRadiusRecords = new Map();

function buildDefaultDemoRecord(contractId) {
  return {
    objID: 1000012345,
    contract: contractId,
    name: `${contractId.toLowerCase()}-demo`,
    macAddress: 'AA:BB:CC:DD:EE:01',
    status: 1,
    locationID: 8,
    locationName: 'Khu vực Demo',
    localType: 519,
    localTypeName: 'Giga',
    dpi: 0,
    statusNAT: '1',
    descriptionNAT: 'Default NAT',
    spamPool: 1,
    poolListName: 'DEFAULT_POOL',
    spampoolLocation: 'Vung Demo',
    spampoolLocaltype: 'Giga',
    spampoolHD: '',
    spampoolOnline: 'DEFAULT_POOL',
    ipAddress: '100.64.10.25',
    callerID: 'AA:BB:CC:DD:EE:01',
    ipFront: '',
    ipRoute: '',
    ipRouteIPv6: '2405:4800:demo::/64',
    coAID: 0,
    descriptionCoA: '',
    serviceAddOn: '-',
    ipV6Only: 0,
    isIpv6Support: true,
    statusIPv6: RADIUS_IPV6_STATUS.ACTIVE,
    descriptionIPv6: 'Bat IPv6 cho KH',
  };
}

function getOrCreateDemoRecord(contractId) {
  if (!demoRadiusRecords.has(contractId)) {
    demoRadiusRecords.set(contractId, buildDefaultDemoRecord(contractId));
  }
  return { ...demoRadiusRecords.get(contractId) };
}

/**
 * Tra ve nhan hien thi cho Tinh trang NAT ("1" | "3" | "5").
 */
export function getRadiusNatLabel(code) {
  const key = code === undefined || code === null ? '' : String(code).trim();
  const matched = RADIUS_NAT_OPTIONS.find((item) => String(item.value) === key);
  return matched ? matched.label : key ? `Mã ${key}` : 'Không xác định';
}

/**
 * Tra ve nhan hien thi cho IPv6 Status (0 | 2 | 3).
 */
export function getRadiusIpv6Label(code) {
  if (code === undefined || code === null || code === '') {
    return 'Không xác định';
  }
  const num = Number(code);
  const matched = RADIUS_IPV6_OPTIONS.find((item) => Number(item.value) === num);
  return matched ? matched.label : `Mã ${num}`;
}

/**
 * Tra ve nhan tinh trang hop dong Radius.
 */
export function getRadiusContractStatusLabel(code) {
  if (code === undefined || code === null || code === '') {
    return '—';
  }
  const num = Number(code);
  return RADIUS_CONTRACT_STATUS_LABELS[num] || `Mã ${num}`;
}

/**
 * Tra ve nhan IPv6 Only Status (-2 | 0 | 1 | 2).
 */
export function getRadiusIpv6OnlyLabel(code) {
  if (code === undefined || code === null || code === '') {
    return 'Deactivate';
  }
  const key = String(Number(code));
  return RADIUS_IPV6_ONLY_LABELS[key] || `Mã ${key}`;
}

/**
 * Chuyen chuoi tieng Viet co dau thanh ASCII khong dau hop le cho Radius API.
 */
export function stripVietnameseDiacritics(raw) {
  if (raw === undefined || raw === null) {
    return '';
  }
  return String(raw)
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\u0000-\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Kiem tra ghi chu Radius: bat buoc nhap va chi cho phep tieng Viet khong dau (ASCII).
 */
export function validateRadiusNote(raw, fieldLabel = '') {
  const value = typeof raw === 'string' ? raw.trim() : '';
  const prefix = fieldLabel ? `[${fieldLabel}] ` : '';
  if (!value) {
    return {
      valid: false,
      value: '',
      error: `${prefix}Ghi chú không được để trống (nhập tiếng Việt không dấu).`,
    };
  }
  if (NON_ASCII_RE.test(value)) {
    return {
      valid: false,
      value,
      error: `${prefix}Ghi chú bắt buộc là tiếng Việt KHÔNG DẤU (bấm "Bỏ dấu" để chuyển nhanh).`,
    };
  }
  return { valid: true, value, error: '' };
}

/**
 * Doc tam cookie accesstoken_iam_radius tu chuoi Cookie (khong luu tru).
 */
export function parseRadiusTokenFromCookieString(cookieStr) {
  if (!cookieStr || typeof cookieStr !== 'string') {
    return '';
  }
  const parts = cookieStr.split(';');
  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx <= 0) continue;
    const name = part.slice(0, eqIdx).trim();
    if (name !== 'accesstoken_iam_radius') continue;
    const rawVal = part
      .slice(eqIdx + 1)
      .trim()
      .replace(/^"|"$/g, '');
    if (!rawVal) return '';
    try {
      return decodeURIComponent(rawVal).trim();
    } catch {
      return rawVal;
    }
  }
  return '';
}

/**
 * Chuan hoa 1 ban ghi ket noi Radius tu NetworkConnection/GetbyObjID.
 */
export function normalizeRadiusRecord(raw = {}) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const rawNat =
    src.statusNAT !== undefined && src.statusNAT !== null && String(src.statusNAT).trim() !== ''
      ? String(src.statusNAT).trim()
      : '1';
  const rawIpv6Num =
    src.statusIPv6 !== undefined && src.statusIPv6 !== null && src.statusIPv6 !== ''
      ? Number(src.statusIPv6)
      : RADIUS_IPV6_STATUS.RULE;
  const parsedObjId = Number(src.objID ?? src.objId ?? 0);

  return {
    objID: Number.isFinite(parsedObjId) ? parsedObjId : 0,
    contract: String(src.contract || '').trim().toUpperCase(),
    name: String(src.name || '').trim(),
    macAddress: String(src.macAddress || '').trim(),
    status:
      src.status !== undefined && src.status !== null && src.status !== ''
        ? Number(src.status)
        : 0,
    locationID:
      src.locationID !== undefined && src.locationID !== null ? Number(src.locationID) : 0,
    locationName: String(src.locationName || '').trim(),
    localTypeName: String(src.localTypeName || '').trim(),
    statusNAT: rawNat,
    descriptionNAT: String(src.descriptionNAT || '').trim(),
    statusIPv6: Number.isFinite(rawIpv6Num) ? rawIpv6Num : RADIUS_IPV6_STATUS.RULE,
    descriptionIPv6: String(src.descriptionIPv6 || '').trim(),
    ipV6Only:
      src.ipV6Only !== undefined && src.ipV6Only !== null && src.ipV6Only !== ''
        ? Number(src.ipV6Only)
        : 0,
    isIpv6Support: Boolean(src.isIpv6Support),
    dpi: src.dpi !== undefined && src.dpi !== null && src.dpi !== '' ? Number(src.dpi) : 0,
    coAID: src.coAID !== undefined && src.coAID !== null && src.coAID !== '' ? Number(src.coAID) : 0,
    poolListName: String(src.poolListName || '').trim(),
    ipAddress: String(src.ipAddress || '').trim(),
    callerID: String(src.callerID || '').trim(),
    ipRoute: String(src.ipRoute || '').trim(),
    ipRouteIPv6: String(src.ipRouteIPv6 || '').trim(),
  };
}

/**
 * Tao danh sach summaryFields de hien thi tren the ket qua Radius.
 */
export function buildRadiusSummaryFields(rawRecord) {
  const rec = normalizeRadiusRecord(rawRecord);
  const ipMac =
    rec.ipAddress || rec.callerID
      ? [rec.ipAddress, rec.callerID].filter(Boolean).join(' / ')
      : '—';
  const regionLocalType =
    [rec.locationName, rec.localTypeName].filter(Boolean).join(' • ') || '—';

  return [
    { label: 'Số hợp đồng', value: rec.contract || '—' },
    { label: 'Mã đối tượng (ObjID)', value: rec.objID ? String(rec.objID) : '—' },
    { label: 'Tên truy nhập', value: rec.name || '—' },
    { label: 'Tình trạng HĐ', value: getRadiusContractStatusLabel(rec.status) },
    { label: 'Tình trạng NAT', value: `${getRadiusNatLabel(rec.statusNAT)} (${rec.statusNAT})` },
    { label: 'Ghi chú NAT', value: rec.descriptionNAT || '—' },
    { label: 'IPv6 Status', value: getRadiusIpv6Label(rec.statusIPv6) },
    { label: 'Ghi chú IPv6', value: rec.descriptionIPv6 || '—' },
    { label: 'Hỗ trợ IPv6', value: rec.isIpv6Support ? 'Có' : 'Không' },
    { label: 'IPv6 Only', value: getRadiusIpv6OnlyLabel(rec.ipV6Only) },
    { label: 'IP / MAC kết nối', value: ipMac },
    { label: 'Spam Pool', value: rec.poolListName || '—' },
    { label: 'Vùng miền / Gói cước', value: regionLocalType },
  ];
}

/**
 * Kiem tra va dung payload chuan cho POST /api/v2/NetworkConnection/Change.
 */
export function buildRadiusChangePayload(rawRecord, draft = {}) {
  const rec = normalizeRadiusRecord(rawRecord);
  if (!rec.objID || rec.objID <= 0) {
    return {
      ok: false,
      error: 'Không có ObjID hợp lệ của hợp đồng để gửi cập nhật Radius.',
    };
  }

  const nextNatStatus =
    draft.natStatus !== undefined && draft.natStatus !== null && String(draft.natStatus).trim() !== ''
      ? String(draft.natStatus).trim()
      : rec.statusNAT;
  const natChanged = nextNatStatus !== String(rec.statusNAT);

  const hasDraftIpv6Status =
    draft.ipv6Status !== undefined &&
    draft.ipv6Status !== null &&
    String(draft.ipv6Status).trim() !== '';
  const nextIpv6Status = hasDraftIpv6Status ? Number(draft.ipv6Status) : Number(rec.statusIPv6);
  const rawDraftIpv6Note =
    typeof draft.ipv6Description === 'string'
      ? draft.ipv6Description.trim()
      : rec.descriptionIPv6;
  const ipv6StatusChanged = Number(nextIpv6Status) !== Number(rec.statusIPv6);
  const ipv6NoteEdited =
    typeof draft.ipv6Description === 'string' &&
    rawDraftIpv6Note.length > 0 &&
    rawDraftIpv6Note !== String(rec.descriptionIPv6 || '').trim();
  const ipv6Changed = ipv6StatusChanged || ipv6NoteEdited;

  const payload = {
    objID: Number(rec.objID),
    isKillSession: draft.isKillSession !== false,
  };
  const changes = { nat: false, ipv6: false };

  if (natChanged) {
    if (!VALID_NAT_VALUES.has(nextNatStatus)) {
      return {
        ok: false,
        error: 'Giá trị Tình trạng NAT không hợp lệ (chỉ chấp nhận 1, 3 hoặc 5).',
      };
    }
    const rawNatNote =
      typeof draft.natDescription === 'string' ? draft.natDescription : rec.descriptionNAT;
    const natNoteCheck = validateRadiusNote(rawNatNote, 'NAT');
    if (!natNoteCheck.valid) {
      return { ok: false, error: natNoteCheck.error };
    }
    payload.changeNAT = {
      natStatus: nextNatStatus,
      natDescription: natNoteCheck.value,
    };
    changes.nat = true;
  }

  if (ipv6Changed) {
    if (!VALID_IPV6_VALUES.has(nextIpv6Status)) {
      return {
        ok: false,
        error: 'Giá trị IPv6 Status không hợp lệ (chỉ chấp nhận Deactivate, Active hoặc Rule).',
      };
    }
    if (Number(rec.ipV6Only) === 1 && nextIpv6Status === RADIUS_IPV6_STATUS.DEACTIVATE) {
      return {
        ok: false,
        error: 'Thuê bao đang bật IPv6 Only, không thể chuyển IPv6 Status về Deactivate.',
      };
    }
    const ipv6NoteCheck = validateRadiusNote(rawDraftIpv6Note, 'IPv6');
    if (!ipv6NoteCheck.valid) {
      return { ok: false, error: ipv6NoteCheck.error };
    }
    payload.changeIpv6 = {
      ipv6Status: Number(nextIpv6Status),
      ipv6Description: ipv6NoteCheck.value,
    };
    changes.ipv6 = true;
  }

  if (!changes.nat && !changes.ipv6) {
    return {
      ok: false,
      error: 'Bạn chưa thay đổi Tình trạng NAT hoặc IPv6 Status nào so với hiện tại.',
    };
  }

  return {
    ok: true,
    payload,
    changes,
    nextNatStatus,
    nextIpv6Status,
  };
}

function tryParseJson(text) {
  if (!text || typeof text !== 'string') return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractMessageList(rawMsg) {
  if (!rawMsg) return [];
  if (Array.isArray(rawMsg)) {
    return rawMsg
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          return String(item.message || item.error_message || item.detail || item.status || '').trim();
        }
        return '';
      })
      .filter(Boolean);
  }
  if (typeof rawMsg === 'string') {
    return rawMsg.trim() ? [rawMsg.trim()] : [];
  }
  return [];
}

/**
 * Phan tich phan hoi HTTP cua GetbyObjID.
 */
export function parseRadiusLookupResponse(rawText, httpStatus = 200, contractId = '') {
  if (httpStatus === 401) {
    return {
      ok: false,
      authRequired: true,
      error: 'Phiên token Radius đã hết hạn hoặc chưa đồng bộ (HTTP 401).',
    };
  }
  if (httpStatus === 403) {
    return {
      ok: false,
      forbidden: true,
      error: 'Tài khoản không có quyền truy cập dữ liệu Radius (HTTP 403).',
    };
  }

  const json = tryParseJson(rawText);
  if (httpStatus < 200 || httpStatus >= 300) {
    const apiErr =
      (json && (json.error?.message || json.error_message || json.message)) ||
      `Lỗi máy chủ Radius (HTTP ${httpStatus || 0}).`;
    return { ok: false, error: String(apiErr) };
  }

  if (!json || typeof json !== 'object') {
    return {
      ok: false,
      error: 'Phản hồi từ Radius API không đúng định dạng JSON.',
    };
  }

  if (json.error_code !== undefined && Number(json.error_code) !== 0) {
    return {
      ok: false,
      error: String(json.error_message || json.status || 'Tra cứu Radius thất bại.'),
    };
  }

  const rows = Array.isArray(json.data) ? json.data : [];
  if (rows.length === 0) {
    return {
      ok: false,
      notFound: true,
      error:
        String(json.error_message || '').trim() ||
        `Không tìm thấy thông số kết nối trên Radius cho ${contractId || 'hợp đồng này'}.`,
    };
  }

  const normalizedRows = rows.map(normalizeRadiusRecord);
  const preferred =
    (contractId && normalizedRows.find((r) => r.contract === contractId)) || normalizedRows[0];

  return {
    ok: true,
    record: preferred,
    records: normalizedRows,
  };
}

/**
 * Phan tich phan hoi HTTP cua POST /api/v2/NetworkConnection/Change.
 */
export function parseRadiusChangeResponse(rawText, httpStatus = 200) {
  if (httpStatus === 401) {
    return {
      ok: false,
      authRequired: true,
      error: 'Phiên token Radius đã hết hạn (HTTP 401). Hãy đồng bộ IAM hoặc đăng nhập lại Radius.',
    };
  }
  if (httpStatus === 403) {
    return {
      ok: false,
      forbidden: true,
      error: 'Tài khoản không có quyền cập nhật cấu hình Radius (HTTP 403).',
    };
  }

  const json = tryParseJson(rawText);
  if (httpStatus < 200 || httpStatus >= 300) {
    const apiErr =
      (json &&
        ((json.error && json.error.message) ||
          json.error_message ||
          extractMessageList(json.message).join(' • '))) ||
      `Cập nhật Radius thất bại (HTTP ${httpStatus || 0}).`;
    return { ok: false, error: String(apiErr) };
  }

  if (!json || typeof json !== 'object') {
    return {
      ok: true,
      message: 'Đã gửi yêu cầu cập nhật Radius thành công.',
      details: [],
    };
  }

  const msgList = extractMessageList(json.message);
  const statusText = String(json.status || '').trim();
  const errCode =
    json.error_code !== undefined && json.error_code !== null ? Number(json.error_code) : 0;

  if ((Number.isFinite(errCode) && errCode !== 0 && errCode !== 200) || /^fail$/i.test(statusText)) {
    return {
      ok: false,
      error:
        String(json.error_message || '').trim() ||
        msgList.join(' • ') ||
        'Radius trả về trạng thái cập nhật không thành công.',
      details: msgList,
    };
  }

  const combinedMsg =
    msgList.join(' • ') ||
    String(json.error_message || '').trim() ||
    'Đã cập nhật thông số Radius thành công.';

  return {
    ok: true,
    message: combinedMsg,
    details: msgList,
  };
}

function getTransientPageToken(ctx = {}) {
  const doc =
    ctx.pageDocument || (typeof document !== 'undefined' ? document : null);
  if (!doc || typeof doc.cookie !== 'string') {
    return '';
  }
  return parseRadiusTokenFromCookieString(doc.cookie);
}

async function requestRadiusApi(url, { method = 'POST', body = null, ctx = {}, allowWarmRetry = true } = {}) {
  const payloadStr = body !== null && body !== undefined ? JSON.stringify(body) : null;

  if (isAndroidAppEnv()) {
    const res = await requestPortal({
      url,
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      data: payloadStr,
      timeout: 15000,
      useRadiusBearer: true,
    });

    const missingTokenOr401 =
      res.status === 401 || res.error === 'RADIUS_TOKEN_MISSING';
    if (missingTokenOr401 && allowWarmRetry && canWarmPortalSession()) {
      const warmRes = await warmPortalSession(RADIUS_ENDPOINTS.PORTAL_URL, {
        force: true,
        timeout: 15000,
      });
      if (warmRes && warmRes.ok) {
        return requestRadiusApi(url, { method, body, ctx, allowWarmRetry: false });
      }
      return {
        ok: false,
        status: 401,
        responseText: '',
        error: 'RADIUS_TOKEN_MISSING',
        authRequired: true,
      };
    }
    return res;
  }

  const pageToken = getTransientPageToken(ctx);
  if (!pageToken) {
    return {
      ok: false,
      status: 401,
      responseText: '',
      error: 'RADIUS_PORTAL_COOKIE_UNAVAILABLE',
      authRequired: true,
    };
  }

  return requestPortal({
    url,
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${pageToken}`,
    },
    data: payloadStr,
    timeout: 15000,
  });
}

function buildRadiusAuthErrorResult(detail = '') {
  const onAndroid = isAndroidAppEnv();
  return {
    status: 'iam_expired',
    message:
      detail ||
      (onAndroid
        ? 'Chưa có token truy cập Radius (accesstoken_iam_radius). Bấm "Đăng nhập Radius (IAM)" để đồng bộ phiên và thử lại.'
        : 'Đang chạy ở tab khác nên trình duyệt chưa đọc được cookie Radius. Hãy mở trang http://radius-portal.fpt.net/networkConnection đang đăng nhập IAM rồi bấm lại.'),
    loginUrl: RADIUS_ENDPOINTS.PORTAL_URL,
  };
}

/**
 * Tra cuu thong tin ket noi Radius theo So HD / ObjID / Username.
 */
export async function fetchRadiusConnection(rawContractId, ctx = {}) {
  const check = validateContractId(rawContractId);
  if (!check.valid) {
    return {
      status: 'validation_error',
      message: check.error,
    };
  }
  const contractId = check.value;

  if (!isUserscriptEnv() || ctx.forceDemo) {
    await sleep(220);
    const demoRec = getOrCreateDemoRecord(contractId);
    return {
      status: 'ok',
      mode: 'demo',
      record: demoRec,
      summaryFields: buildRadiusSummaryFields(demoRec),
    };
  }

  const res = await requestRadiusApi(RADIUS_ENDPOINTS.GET_BY_OBJ_ID, {
    method: 'POST',
    body: { searchType: 1, searchValue: contractId },
    ctx,
  });

  if (res.authRequired) {
    return buildRadiusAuthErrorResult();
  }
  if (!res.status && res.error) {
    return {
      status: 'error',
      message: `Không thể kết nối máy chủ Radius (${res.error}). Kiểm tra lại VPN công ty.`,
      loginUrl: RADIUS_ENDPOINTS.PORTAL_URL,
    };
  }

  const parsed = parseRadiusLookupResponse(res.responseText, res.status, contractId);
  if (parsed.authRequired) {
    return buildRadiusAuthErrorResult(parsed.error);
  }
  if (!parsed.ok) {
    return {
      status: 'error',
      message: parsed.error,
      loginUrl: RADIUS_ENDPOINTS.PORTAL_URL,
    };
  }

  return {
    status: 'ok',
    mode: 'live',
    record: parsed.record,
    records: parsed.records,
    summaryFields: buildRadiusSummaryFields(parsed.record),
  };
}

/**
 * Gui thay doi IPNAT / IPv6 / Kill Session len POST /api/v2/NetworkConnection/Change.
 */
export async function submitRadiusConnectionChange(rawRecord, draft = {}, ctx = {}) {
  const rec = normalizeRadiusRecord(rawRecord);
  const built = buildRadiusChangePayload(rec, draft);
  if (!built.ok) {
    return {
      status: 'validation_error',
      message: built.error,
    };
  }

  if (!isUserscriptEnv() || ctx.forceDemo) {
    await sleep(250);
    const updated = { ...rec };
    if (built.payload.changeNAT) {
      updated.statusNAT = built.payload.changeNAT.natStatus;
      updated.descriptionNAT = built.payload.changeNAT.natDescription;
    }
    if (built.payload.changeIpv6) {
      updated.statusIPv6 = built.payload.changeIpv6.ipv6Status;
      updated.descriptionIPv6 = built.payload.changeIpv6.ipv6Description;
    }
    if (updated.contract) {
      demoRadiusRecords.set(updated.contract, updated);
    }
    return {
      status: 'ok',
      mode: 'demo',
      record: updated,
      payload: built.payload,
      changes: built.changes,
      summaryFields: buildRadiusSummaryFields(updated),
      message: `Đã mô phỏng cập nhật Radius cho ${updated.contract || updated.objID} (${
        built.payload.isKillSession ? 'kèm Kill Session' : 'không Kill Session'
      }).`,
    };
  }

  const res = await requestRadiusApi(RADIUS_ENDPOINTS.CHANGE, {
    method: 'POST',
    body: built.payload,
    ctx,
  });

  if (res.authRequired) {
    return buildRadiusAuthErrorResult();
  }
  if (!res.status && res.error) {
    return {
      status: 'error',
      message: `Không thể gửi lệnh cập nhật Radius (${res.error}). Kiểm tra lại VPN công ty.`,
      loginUrl: RADIUS_ENDPOINTS.PORTAL_URL,
    };
  }

  const parsed = parseRadiusChangeResponse(res.responseText, res.status);
  if (parsed.authRequired) {
    return buildRadiusAuthErrorResult(parsed.error);
  }
  if (!parsed.ok) {
    return {
      status: 'error',
      message: parsed.error,
      loginUrl: RADIUS_ENDPOINTS.PORTAL_URL,
    };
  }

  let freshRecord = {
    ...rec,
    ...(built.payload.changeNAT
      ? {
          statusNAT: built.payload.changeNAT.natStatus,
          descriptionNAT: built.payload.changeNAT.natDescription,
        }
      : {}),
    ...(built.payload.changeIpv6
      ? {
          statusIPv6: built.payload.changeIpv6.ipv6Status,
          descriptionIPv6: built.payload.changeIpv6.ipv6Description,
        }
      : {}),
  };

  if (rec.contract) {
    const refreshed = await fetchRadiusConnection(rec.contract, ctx);
    if (refreshed.status === 'ok' && refreshed.record) {
      freshRecord = refreshed.record;
    }
  }

  return {
    status: 'ok',
    mode: 'live',
    record: freshRecord,
    payload: built.payload,
    changes: built.changes,
    summaryFields: buildRadiusSummaryFields(freshRecord),
    message: parsed.message,
  };
}

/**
 * Thuc thi hanh dong tu giao dien cho cong Radius Portal.
 */
export async function runRadiusAction(actionId, rawContractId, ctx = {}) {
  const portal = PORTALS.radius;
  const action = portal.actions.find((a) => a.id === actionId);
  if (!action) {
    return {
      status: 'error',
      message: 'Thao tác không hợp lệ trên Radius Portal.',
    };
  }

  const check = validateContractId(rawContractId);
  if (!check.valid) {
    return {
      status: 'validation_error',
      message: check.error,
    };
  }
  const contractId = check.value;

  if (actionId === 'check_radius') {
    const lookup = await fetchRadiusConnection(contractId, ctx);
    if (lookup.status !== 'ok') {
      return lookup;
    }
    const demoSuffix = lookup.mode === 'demo' ? ' (Dữ liệu mô phỏng)' : '';
    return {
      status: 'ok',
      mode: lookup.mode,
      title: `Thông số Radius — ${contractId}${demoSuffix}`,
      message: `NAT: ${getRadiusNatLabel(lookup.record.statusNAT)} • IPv6: ${getRadiusIpv6Label(
        lookup.record.statusIPv6
      )}`,
      summaryFields: lookup.summaryFields,
      radiusRecord: lookup.record,
      sourceUrl: RADIUS_ENDPOINTS.PORTAL_URL,
      sourceLabel: 'Mở Radius Portal',
    };
  }

  let baseRecord = ctx.record ? normalizeRadiusRecord(ctx.record) : null;
  if (!baseRecord || !baseRecord.objID) {
    const lookup = await fetchRadiusConnection(contractId, ctx);
    if (lookup.status !== 'ok') {
      return lookup;
    }
    baseRecord = lookup.record;
  }

  let draft = {
    natStatus: ctx.natStatus !== undefined ? ctx.natStatus : baseRecord.statusNAT,
    natDescription:
      ctx.natDescription !== undefined ? ctx.natDescription : baseRecord.descriptionNAT,
    ipv6Status: ctx.ipv6Status !== undefined ? ctx.ipv6Status : baseRecord.statusIPv6,
    ipv6Description:
      ctx.ipv6Description !== undefined ? ctx.ipv6Description : baseRecord.descriptionIPv6,
    isKillSession: ctx.isKillSession !== false,
  };

  if (actionId === 'remove_ipnat' && ctx.natStatus === undefined) {
    draft.natStatus = '5';
    draft.natDescription = draft.natDescription || 'KH yeu cau bo IPNAT';
  }
  if (actionId === 'remove_ipv6' && ctx.ipv6Status === undefined) {
    draft.ipv6Status = RADIUS_IPV6_STATUS.DEACTIVATE;
    draft.ipv6Description = draft.ipv6Description || 'Bo IPv6 cho KH';
  }

  const submitRes = await submitRadiusConnectionChange(baseRecord, draft, ctx);
  if (submitRes.status !== 'ok') {
    return submitRes;
  }

  const changedParts = [];
  if (submitRes.changes.nat) {
    changedParts.push(`NAT -> ${getRadiusNatLabel(submitRes.record.statusNAT)}`);
  }
  if (submitRes.changes.ipv6) {
    changedParts.push(`IPv6 -> ${getRadiusIpv6Label(submitRes.record.statusIPv6)}`);
  }
  const killNote = submitRes.payload.isKillSession ? 'Có Kill Session' : 'Không Kill Session';
  const demoSuffix = submitRes.mode === 'demo' ? ' (Mô phỏng)' : '';

  return {
    status: 'ok',
    mode: submitRes.mode,
    title: `Đã cập nhật Radius — ${contractId}${demoSuffix}`,
    message: `${submitRes.message} (${[...changedParts, killNote].join(' • ')})`,
    summaryFields: submitRes.summaryFields,
    radiusRecord: submitRes.record,
    sourceUrl: RADIUS_ENDPOINTS.PORTAL_URL,
    sourceLabel: 'Mở Radius Portal',
  };
}
