/**
 * Adapter xu ly cho trang uu tien so 1: inside.fpt.net (qua mvc.inside.fpt.net)
 * Da noi API that cho Tra thong tin HD; cac lenh tac dong manh cho quet mau tung man hinh.
 */

import { PORTALS, validateContractId } from '../config/portals.js';
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
  reset_mac: null,
  reset_mac_box: null,
  kill_session: null,
  clear_osp: null,
};

export const INSIDE_CONTRACT_CACHE = new Map();

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
    summaryFields,
    extraSections,
    embeddedViews,
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
    fetchedAt: Date.now(),
  });

  return result;
}

function buildInsideMockResult(actionId, contractId) {
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
    case 'reset_mac':
      return {
        status: 'ok',
        mode: 'demo',
        title: `Đã Reset MAC Modem cho ${contractId} (Dữ liệu mô phỏng)`,
        message: 'Lệnh mô phỏng thành công: MAC Modem cũ đã được xóa trên bản xem thử.',
      };
    case 'reset_mac_box':
      return {
        status: 'ok',
        mode: 'demo',
        title: `Đã Reset MAC Box cho ${contractId} (Dữ liệu mô phỏng)`,
        message: 'Lệnh mô phỏng thành công: MAC đầu thu Box giả lập đã được xử lý.',
      };
    case 'kill_session':
      return {
        status: 'ok',
        mode: 'demo',
        title: `Đã Kill Session cho ${contractId} (Dữ liệu mô phỏng)`,
        message: 'Lệnh mô phỏng thành công: Phiên PPPoE giả lập đã được ngắt để quay lại phiên mới.',
      };
    case 'clear_osp':
      return {
        status: 'ok',
        mode: 'demo',
        title: `Đã Clear OSP cho ${contractId} (Dữ liệu mô phỏng)`,
        message: 'Lệnh mô phỏng thành công: Dữ liệu OSP giả lập đã được làm sạch.',
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
 * Thuc thi mot lenh tren inside.fpt.net.
 */
export async function runInsideAction(actionId, rawContractId, ctx = {}) {
  const check = validateContractId(rawContractId);
  if (!check.valid) {
    return {
      status: 'validation_error',
      message: check.error,
    };
  }

  const contractId = check.value;
  const portal = PORTALS.inside;

  if (!isUserscriptEnv() || ctx.forceDemo) {
    await sleep(350);
    return buildInsideMockResult(actionId, contractId);
  }

  if (actionId === 'lookup' && INSIDE_ENDPOINTS.lookup) {
    return lookupInsideLive(contractId);
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
