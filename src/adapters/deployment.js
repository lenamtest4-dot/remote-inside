/**
 * Adapter thao tac Phieu trien khai FOX-ERP (fox-erp.fpt.net & partner.fpt.net).
 * Chay truc tiep qua VPN & phien IAM hien tai, khong luu mat khau hay x-resource-grant xuong bo nho.
 */

import { normalizeContractId } from '../config/portals.js';
import { detectIamRedirect, isUserscriptEnv, requestPortal } from '../core/transport.js';

export const DEPLOYMENT_ENDPOINTS = {
  partnerMonitor: 'http://partner.fpt.net/pt-portal/monitor',
  partnerGetContract: 'http://partner.fpt.net/pt-portal/api/portals/configs/getContract',
  foxBase: 'https://fox-erp.fpt.net/app/tkbt/tk',
  foxTicketPage: 'https://fox-erp.fpt.net/app/tkbt/tk/ticket',
  getTicketInfo: 'https://fox-erp.fpt.net/app/tkbt/tk/api/ticket/get-ticket-info',
  getConfigByParent: 'https://fox-erp.fpt.net/app/tkbt/tk/api/config/get-config-by-parent',
  getEquipmentOnDep: 'https://fox-erp.fpt.net/app/tkbt/tk/api/equipment/get-equipment-on-dep',
  clearEquipment: 'https://fox-erp.fpt.net/app/tkbt/tk/api/equipment/clear-equipment',
  getContractPhone: 'https://fox-erp.fpt.net/app/tkbt/tk/api/contract/get-contract-phone',
  revealPhone: 'https://fox-erp.fpt.net/app/tkbt/tk/api/contract/reveal-phone',
  getEContractRecord: 'https://fox-erp.fpt.net/app/tkbt/tk/api/record/get-e-contract-record',
  signEContract: 'https://fox-erp.fpt.net/app/tkbt/tk/api/record/sign-econtract',
  getModemMetrics: 'https://fox-erp.fpt.net/app/tkbt/tk/api/product-service/internet/get-modem-metrics',
  syncOnline: 'https://fox-erp.fpt.net/app/tkbt/tk/api/contract/sync-online',
  updateDeploymentInfo: 'https://fox-erp.fpt.net/app/tkbt/tk/api/ticket/update-deployment-info',
  statusCompleted: 'https://fox-erp.fpt.net/app/tkbt/tk/api/status/completed',
  getPaymentInfo: 'https://fox-erp.fpt.net/app/tkbt/tk/api/payment/get-payment-info',
  updateCameraPhone: 'https://fox-erp.fpt.net/app/tkbt/tk/api/contract/update-number-phone-camera',
};

export const DEPLOYMENT_EQUIPMENT_TYPE = {
  DEPLOY: 1,
  REVOKE: 2,
  EXTRA: 3,
};

export const DEPLOYMENT_CAMERA_PHONE_TYPE = 96;

export const DEPLOYMENT_CATALOG_KEYS = {
  SUPPORT_STATUS: 'Deloyment_SupportINFStatus',
  REASON_DELAY: 'ReasonCheckInLate',
  REASON_HIFPT: 'ReasonNonSetHiFPT',
  NOT_COMPLETE_WIFI: 'NoneCompleteWifi',
  REASON_UNUSE_CAP_LAN: 'ReasonUnuseCapLan',
  CABLE_TYPE: 'SupportINF_CableType',
};

const DEMO_DATA_FILTER = [
  {
    ParentName: DEPLOYMENT_CATALOG_KEYS.SUPPORT_STATUS,
    Datas: [
      { Code: 0, Tittle: 'Đang xử lý', Position: 1 },
      { Code: 1, Tittle: 'Hoàn tất', Position: 2 },
    ],
  },
  {
    ParentName: DEPLOYMENT_CATALOG_KEYS.REASON_DELAY,
    Datas: [
      { Code: 0, Tittle: 'Không xác định', Position: 1 },
      { Code: 1, Tittle: 'Khách hàng hẹn lại giờ', Position: 2 },
      { Code: 2, Tittle: 'Kẹt hạ tầng tập điểm', Position: 3 },
    ],
  },
  {
    ParentName: DEPLOYMENT_CATALOG_KEYS.REASON_HIFPT,
    Datas: [
      { Code: 0, Tittle: 'Không chọn', Position: 1 },
      { Code: 1, Tittle: 'Không gặp chủ hợp đồng', Position: 2 },
      { Code: 2, Tittle: 'Không dùng smartphone', Position: 3 },
      { Code: 3, Tittle: 'Lý do khác', Position: 4 },
    ],
  },
  {
    ParentName: DEPLOYMENT_CATALOG_KEYS.NOT_COMPLETE_WIFI,
    Datas: [
      { Code: 0, Tittle: 'Không chọn', Position: 1 },
      { Code: 1, Tittle: 'Vật tư/thiết bị đang chờ đồng bộ', Position: 2 },
      { Code: 2, Tittle: 'Khách hàng yêu cầu tự cấu hình', Position: 3 },
    ],
  },
  {
    ParentName: DEPLOYMENT_CATALOG_KEYS.REASON_UNUSE_CAP_LAN,
    Datas: [
      { Code: 0, Tittle: 'Không chọn', Position: 1 },
      { Code: 1, Tittle: 'KH không đồng ý đi dây LAN do mất thẩm mỹ nhà', Position: 2 },
      { Code: 2, Tittle: 'KH muốn sử dụng wifi để di chuyển các vị trí khác nhau', Position: 3 },
    ],
  },
];

function decodeSafeQueryParam(rawVal) {
  if (!rawVal) return '';
  try {
    return decodeURIComponent(String(rawVal));
  } catch {
    return String(rawVal);
  }
}

/**
 * Lay tham so q tu URL ticket ma van giu nguyen ky tu + hoac base64url.
 */
function extractQueryQFromUrl(rawUrl) {
  const m = String(rawUrl || '').match(/[?&]q=([^&#]+)/i);
  return m && m[1] ? decodeSafeQueryParam(m[1]).trim() : '';
}

export function extractDeploymentTicketLink(partnerData) {
  const list = Array.isArray(partnerData) ? partnerData : [];
  if (list.length === 0) {
    return {
      found: false,
      reason: 'not_found',
      message: 'Không tìm thấy phiếu đang mở trên Partner cho hợp đồng này.',
    };
  }

  for (const item of list) {
    if (!item || typeof item.url !== 'string') continue;
    const rawUrl = item.url.trim();
    if (/\/app\/tkbt\/tk\/ticket/i.test(rawUrl)) {
      const hash = extractQueryQFromUrl(rawUrl);
      if (hash) {
        const normalizedUrl = /^https?:\/\//i.test(rawUrl)
          ? rawUrl
          : rawUrl.startsWith('/')
          ? `https://fox-erp.fpt.net${rawUrl}`
          : `${DEPLOYMENT_ENDPOINTS.foxTicketPage}?q=${encodeURIComponent(hash)}`;
        return {
          found: true,
          url: normalizedUrl,
          hash,
          isBackLog: Boolean(item.isBackLog),
          type: String(item.type || ''),
        };
      }
    }
  }

  const hasMaintenanceOnly = list.some(
    (item) => item && typeof item.url === 'string' && /\/app\/tkbt\/bt\/ticket/i.test(item.url)
  );
  if (hasMaintenanceOnly) {
    return {
      found: false,
      reason: 'maintenance_only',
      message: 'Hợp đồng này chỉ thấy phiếu Bảo trì (/bt/ticket), chưa có phiếu Triển khai (/tk/ticket).',
    };
  }

  return {
    found: false,
    reason: 'not_found',
    message: 'Partner chưa trả về đường dẫn phiếu triển khai (/app/tkbt/tk/ticket) hợp lệ.',
  };
}

export function extractHashFromLocation(loc) {
  if (!loc) return '';
  try {
    const hostname = String(loc.hostname || '').toLowerCase();
    const pathname = String(loc.pathname || '').toLowerCase();
    if (hostname !== 'fox-erp.fpt.net' || !pathname.startsWith('/app/tkbt/tk/ticket')) {
      return '';
    }
    const rawSearch = String(loc.search || loc.href || '');
    return extractQueryQFromUrl(rawSearch);
  } catch {
    return '';
  }
}

export function parseDataFilterOptions(dataFilter, parentName) {
  if (!Array.isArray(dataFilter) || !parentName) {
    return [];
  }
  const group = dataFilter.find((g) => g && g.ParentName === parentName);
  const datas = group && Array.isArray(group.Datas) ? group.Datas : [];
  return datas
    .filter((item) => item && item.Code !== null && item.Code !== undefined && item.Tittle != null)
    .map((item) => ({
      id: String(item.Code),
      text: String(item.Tittle),
      position: Number(item.Position ?? 0),
    }))
    .sort((a, b) => a.position - b.position);
}

export function findDataFilterText(dataFilter, parentName, code) {
  const opts = parseDataFilterOptions(dataFilter, parentName);
  const numCode = Number(code);
  const hit = opts.find((o) =>
    Number.isFinite(numCode) && o.id !== '' ? Number(o.id) === numCode : o.id === String(code ?? '')
  );
  return hit ? hit.text : '';
}

function mapAssignedEmployee(emp) {
  if (!emp || typeof emp !== 'object') return null;
  return {
    account: String(emp.EmpAccount || emp.InsideAccount || emp.Account || '').trim(),
    name: String(emp.EmpName || emp.Name || '').trim(),
    phone: String(emp.EmpPhone || emp.Phone || '').trim(),
    code: String(emp.Empcode || emp.EmpCode || emp.EmployeeCode || '').trim(),
    status: Number(emp.EmpStatus ?? 0),
  };
}

function formatDeploymentAppointment(ticketObj) {
  if (!ticketObj || typeof ticketObj !== 'object') return '';
  const direct = String(ticketObj.AppointmentDate || ticketObj.TimeAppointment || '').trim();
  if (direct) return direct;

  const info =
    ticketObj.AppointmentInfo && typeof ticketObj.AppointmentInfo === 'object'
      ? ticketObj.AppointmentInfo
      : null;
  if (!info) return '';

  const pairs = [
    [info.TimeZoneRed, info.AppointmentDateRed],
    [info.TimeZoneBlue, info.AppointmentDateBlue],
    [info.TimeZone, info.AppointmentDate],
  ];
  let chosen = '';
  for (const [tz, dt] of pairs) {
    const parts = [String(tz || '').trim(), String(dt || '').trim()].filter(Boolean);
    if (parts.length > 0) {
      chosen = parts.join(' • ');
      break;
    }
  }
  if (!chosen) return '';
  const count = Number(info.Appointment ?? 0);
  return count > 0 ? `${chosen} (${count} lần)` : chosen;
}

export function normalizeTicketSummary(contractData, selectedSupId = 0) {
  const src = contractData && typeof contractData === 'object' ? contractData : {};
  const contract = String(src.Contract || '').trim();
  const dataFilter = Array.isArray(src.DataFilter) ? src.DataFilter : [];
  const rawTickets = Array.isArray(src.SupportInfInfo) ? src.SupportInfInfo : [];

  const tickets = rawTickets.map((t) => {
    const supId = Number(t.SupId ?? 0);
    const assignList = Array.isArray(t.AssignEmpInfo) ? t.AssignEmpInfo : [];
    const mainRaw = assignList.find((e) => Number(e && e.EmpStatus) === 1) || null;
    const supportRaws = assignList.filter((e) => Number(e && e.EmpStatus) === 2);
    const construc = t && t.ConstrucInfo && typeof t.ConstrucInfo === 'object' ? t.ConstrucInfo : {};
    const status = Number(t.Status ?? 0);
    const statusDesc =
      String(t.StatusDesc || '').trim() ||
      findDataFilterText(dataFilter, DEPLOYMENT_CATALOG_KEYS.SUPPORT_STATUS, status) ||
      (status === 1 ? 'Hoàn tất' : 'Đang xử lý');

    return {
      supId,
      depCode: String(t.DepCode || (contract && supId ? `TK.${contract}.${supId}` : '')).trim(),
      status,
      statusDesc,
      flag: Number(t.Flag ?? 0),
      location: String(t.Location || '').trim(),
      groupPoints: String(t.GroupPoints || '').trim(),
      odcCableType: String(t.ODCCableType || '').trim(),
      blockDepName: String(t.BlockDepName || t.BlockName || '').trim(),
      plotsName: String(t.PlotsName || '').trim(),
      finishDate: String(t.FinishDate || '').trim(),
      descriptionCs: String(t.DescriptionCs || '').trim(),
      mainEmp: mapAssignedEmployee(mainRaw),
      supportEmps: supportRaws.map(mapAssignedEmployee).filter(Boolean),
      reasonDelay: String(t.ReasonDelay ?? 0),
      descriptionRd: String(t.DescriptionRd ?? ''),
      outDoorReUsed: Number(construc.OutDoorReUsed ?? 0),
      indoor: String(construc.Indoor || ''),
      outdoor: String(construc.Outdoor || ''),
      reasonHiFPT: String(t.ReasonHiFPT ?? 0),
      notCompleteWifi: String(t.NotCompleteWifi ?? 0),
      reasonUnuseCapLan: String(t.ReasonUnuseCapLan ?? 0),
      ordersCount: Array.isArray(t.OrdersInfo) ? t.OrdersInfo.length : 0,
      appointmentDate: formatDeploymentAppointment(t),
      depTypeDesc: String(t.CustypeDesc || t.DepTypeDesc || t.TypeDesc || '').trim(),
    };
  });

  const targetSupId = Number(selectedSupId || 0);
  const ticket =
    (targetSupId > 0 ? tickets.find((t) => t.supId === targetSupId) : null) ||
    tickets.find((t) => t.flag === 1) ||
    tickets[0] ||
    null;

  return {
    objId: Number(src.ObjId ?? 0),
    contract,
    fullName: String(src.FullName || '').trim(),
    address: String(src.Address || (ticket && ticket.location) || '').trim(),
    nameObj: String(src.NameObj || '').trim(),
    localTypeName: String(src.LocalTypeName || '').trim(),
    statusContract: Number(src.StatusContract ?? 0),
    statusContractDesc: String(src.StatusContractDesc || 'Bình thường').trim(),
    customerPhone: String(src.CustomerPhone || '').trim(),
    customerPhoneToken: String(src.CustomerPhoneToken || '').trim(),
    firstAccess: String(src.FirstAccess || '').trim(),
    grant: String(src.Grant || ''),
    dataFilter,
    tickets,
    ticket,
  };
}

export function normalizeEquipmentList(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const mapped = list.map((r) => {
    const typeId = Number(r.TypeId ?? 0);
    const mac = String(r.Mac || '').trim();
    const isRevoke = typeId === DEPLOYMENT_EQUIPMENT_TYPE.REVOKE;
    const isMac = Number(r.IsMac ?? 0) === 1 || Boolean(mac);
    return {
      efId: Number(r.EfId ?? 0),
      idCode: Number(r.IdCode ?? 0),
      name: String(r.Name || r.EquipmentName || '').trim(),
      description: String(r.Description || '').trim(),
      quantity: Number(r.Quantity ?? 0),
      typeId,
      isRevoke,
      isDeploy: Number(r.IsDeploy ?? 0) === 1,
      returnStatus: Number(r.ReturnStatus ?? 0),
      causeReturn: Number(r.CauseReturn ?? 0),
      isMac,
      mac,
      functionName: String(r.FunctionName || '').trim(),
      serviceName: String(r.ServiceName || '').trim(),
      policy: String(r.Policy || '').trim(),
    };
  });

  const importItems = mapped
    .filter((item) => !item.isRevoke)
    .sort((a, b) => Number(b.isMac) - Number(a.isMac) || a.typeId - b.typeId);
  const revokeItems = mapped
    .filter((item) => item.isRevoke)
    .sort((a, b) => Number(b.isMac) - Number(a.isMac));
  const macCount = mapped.filter((item) => !item.isRevoke && item.isMac && item.mac).length;

  return { importItems, revokeItems, macCount };
}

export function validateConstructionUpdate({ outDoorReUsed, descriptionRD } = {}) {
  const cleanedDesc = String(descriptionRD ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleanedDesc.length > 500) {
    return {
      valid: false,
      error: 'Ghi chú nguyên nhân trễ hạn không được vượt quá 500 ký tự.',
      outDoorReUsed: 0,
      descriptionRD: cleanedDesc,
    };
  }

  const rawOutdoor =
    outDoorReUsed === null || outDoorReUsed === undefined || String(outDoorReUsed).trim() === ''
      ? 0
      : Number(String(outDoorReUsed).trim());
  if (!Number.isInteger(rawOutdoor) || rawOutdoor < 0 || rawOutdoor > 9999) {
    return {
      valid: false,
      error: 'Số lượng cáp tận dụng Outdoor phải là số nguyên từ 0 đến 9999.',
      outDoorReUsed: rawOutdoor,
      descriptionRD: cleanedDesc,
    };
  }

  return {
    valid: true,
    error: '',
    outDoorReUsed: rawOutdoor,
    descriptionRD: cleanedDesc,
  };
}

export function buildCompletedPayload({
  objId,
  supId,
  outDoorReUsed = 0,
  descriptionRD = '',
  reasonDelay = 0,
  reasonHiFPT = 0,
  notCompleteWifi = 0,
  reasonUnuseCapLan = 0,
} = {}) {
  const payload = {
    ObjId: Number(objId) || 0,
    SupId: Number(supId) || 0,
    OutDoorReUsed: Number(outDoorReUsed) || 0,
    DescriptionRD: String(descriptionRD || '').trim(),
    ReasonDelay: Number(reasonDelay) || 0,
  };
  const numHi = Number(reasonHiFPT) || 0;
  const numWifi = Number(notCompleteWifi) || 0;
  const numLan = Number(reasonUnuseCapLan) || 0;
  if (numHi > 0) payload.ReasonHiFPT = numHi;
  if (numWifi > 0) payload.NotCompleteWifi = numWifi;
  if (numLan > 0) payload.ReasonUnuseCapLan = numLan;
  return payload;
}

function buildDemoTicketPayload(contractId = 'SGN123456') {
  const cleanId = normalizeContractId(contractId) || 'SGN123456';
  return {
    ObjId: 1000001,
    Contract: cleanId,
    FullName: 'NGUYEN VAN MAU',
    NameObj: 'Giga',
    LocalTypeName: 'Giga - FTTx (Demo)',
    StatusContract: 1,
    StatusContractDesc: 'Bình thường',
    CustomerPhone: '090****001',
    CustomerPhoneToken: 'demo_phone_token_1',
    FirstAccess: '23/11/2026 08:30:00',
    Grant: '',
    DataFilter: DEMO_DATA_FILTER,
    SupportInfInfo: [
      {
        SupId: 900001,
        DepCode: `TK.${cleanId}.900001`,
        Status: 0,
        StatusDesc: 'Đang xử lý',
        Flag: 1,
        Location: '123 Duong Mau, Phuong Mau, TP.HCM',
        GroupPoints: 'HCM-ODC-01/HO',
        ODCCableType: 'HCM-ODC-01/HO-1/1-G',
        BlockDepName: 'Khu vuc Mau 01',
        PlotsName: 'L01',
        DescriptionCs: 'Ghi chu CS mau',
        ReasonDelay: 0,
        DescriptionRd: '',
        ReasonHiFPT: 0,
        NotCompleteWifi: 0,
        ReasonUnuseCapLan: 0,
        AppointmentInfo: {
          Appointment: 1,
          TimeZoneBlue: '10:00 - 12:00',
          AppointmentDateBlue: '26/11/2026 12:00:00',
        },
        CustypeDesc: 'Triển khai mới',
        ConstrucInfo: { Indoor: '70', Outdoor: '35', OutDoorReUsed: 0 },
        OrdersInfo: [{ OrderId: 1 }, { OrderId: 2 }],
        AssignEmpInfo: [
          {
            EmpStatus: 1,
            EmpAccount: 'ktv.mau01',
            EmpName: 'KTV Mau 01',
            EmpPhone: '0900000002',
            Empcode: 'MAU0001',
          },
        ],
      },
    ],
  };
}

const DEMO_EQUIPMENTS = [
  {
    EfId: 1,
    IdCode: 33096,
    Name: 'Internet Hub AX3000GZV3',
    Description: 'Modem WiFi 6',
    Quantity: 1,
    TypeId: 1,
    IsMac: 1,
    Mac: '001122334455',
    FunctionName: 'Cấp mới',
    ServiceName: 'Internet',
  },
  {
    EfId: 2,
    IdCode: 1111,
    Name: 'Access Point AX3000CV2',
    Description: 'AP Mesh',
    Quantity: 1,
    TypeId: 1,
    IsMac: 1,
    Mac: 'AABBCCDDEEFF',
    FunctionName: 'Cấp mới',
    ServiceName: 'Internet',
  },
  {
    EfId: 3,
    IdCode: 1881,
    Name: 'FCAM-IQ 4S',
    Description: 'FPT Camera',
    Quantity: 1,
    TypeId: 1,
    IsMac: 1,
    Mac: 'DEMO-CAM-0001',
    FunctionName: 'Cấp mới',
    ServiceName: 'FPT Camera',
  },
  {
    EfId: 4,
    IdCode: 5001,
    Name: 'Dây thuê bao quang đệm chặt 1 core',
    Description: 'Cáp FTTH',
    Quantity: 70,
    TypeId: 3,
    IsMac: 0,
    Mac: '',
    ServiceName: 'Cáp',
  },
  {
    EfId: 5,
    IdCode: 5002,
    Name: 'Dây rút / Vật tư phụ',
    Description: 'Vật tư phụ khác',
    Quantity: 10,
    TypeId: 3,
    IsMac: 0,
    Mac: '',
    ServiceName: 'Vật tư phụ khác',
  },
];

const DEMO_PHONES = [
  { ObjId: 1000001, Type: 5, Phone: '090****001', PhoneToken: 'demo_tok_main', DescriptionVn: 'Số chính chủ' },
  { ObjId: 1000001, Type: 96, Phone: '090****001', PhoneToken: 'demo_tok_cmr', DescriptionVn: 'SĐT CMR' },
  { ObjId: 1000001, Type: 3, Phone: '090****001', PhoneToken: 'demo_tok_play', DescriptionVn: 'SĐT FPTPlay' },
];

const DEMO_PAYMENT = {
  SumMoneyPaid: 300000,
  SumMoneyUnPaid: 0,
  PaymentStatus: true,
  PaymentStatusDesc: 'Đã thanh toán',
  PaymentStatusCode: 1,
  ServiceFeesDetail: [
    {
      ShortNameVN: 'Phí lắp đặt Internet',
      Money: 300000,
      Status: 1,
    },
  ],
  TicketFeesDetail: [],
};

const DEMO_RECORDS = [
  {
    Id: 1,
    Guid: '00000000-0000-0000-0000-000000000001',
    Code: 'TK-BBNT-DEMO-01',
    Name: 'Biên bản nghiệm thu triển khai',
    State: 'Pending',
    CreateDate: '23/11/2026 15:42:01',
  },
  {
    Id: 2,
    Guid: '00000000-0000-0000-0000-000000000002',
    Code: 'HD-DEMO-0001',
    Name: 'Hợp đồng điện tử',
    State: 'Signed',
    CreateDate: '16/11/2026 16:21:26',
  },
];

export async function postFoxJson(
  url,
  bodyObj = null,
  { grant = '', timeout = 15000, loginUrl = DEPLOYMENT_ENDPOINTS.foxTicketPage } = {}
) {
  const headers = {
    Accept: 'application/json',
  };
  let data = null;
  if (bodyObj !== null && bodyObj !== undefined) {
    headers['Content-Type'] = 'application/json';
    data = JSON.stringify(bodyObj);
  }
  if (grant) {
    headers['x-resource-grant'] = String(grant);
  }

  const res = await requestPortal({
    url,
    method: 'POST',
    headers,
    data,
    timeout,
  });

  if (res.error === 'NETWORK_ERROR' || res.error === 'TIMEOUT' || res.status === 0) {
    return {
      status: 'offline',
      message: 'Không kết nối được tới FOX-ERP / Partner. Hãy kiểm tra lại VPN công ty.',
      loginUrl,
    };
  }

  const iamCheck = detectIamRedirect({
    status: res.status,
    finalUrl: res.finalUrl,
    responseText: res.responseText,
    requestedUrl: url,
  });
  if (iamCheck.expired) {
    return {
      status: 'iam_expired',
      message: iamCheck.reason || 'Phiên đăng nhập IAM chưa sẵn sàng hoặc đã hết hạn.',
      loginUrl,
    };
  }

  const rawText = String(res.responseText || '').trim();
  if (rawText.startsWith('<')) {
    return {
      status: 'iam_expired',
      message: 'Máy chủ trả về trang đăng nhập thay vì dữ liệu JSON. Vui lòng đăng nhập IAM lại.',
      loginUrl,
    };
  }

  let json = null;
  try {
    json = rawText ? JSON.parse(rawText) : null;
  } catch {
    json = null;
  }

  if (!json || typeof json !== 'object') {
    return {
      status: 'error',
      message: `Phản hồi không đúng định dạng JSON (HTTP ${res.status}).`,
      httpStatus: res.status,
      loginUrl,
    };
  }

  return {
    status: 'ok',
    httpStatus: res.status,
    json,
    loginUrl,
  };
}

async function warmupAndRetryFoxJson(url, bodyObj, warmupUrl, opts = {}) {
  const first = await postFoxJson(url, bodyObj, opts);
  if (first.status !== 'iam_expired' || !warmupUrl) {
    return first;
  }
  await requestPortal({ url: warmupUrl, method: 'GET', timeout: 10000 });
  return postFoxJson(url, bodyObj, opts);
}

export async function fetchDeploymentTicket(
  contractId = '',
  { pageLocation = null, selectedSupId = 0, forceDemo = false } = {}
) {
  const cleanContract = normalizeContractId(contractId);

  if (!isUserscriptEnv() || forceDemo) {
    const demoRaw = buildDemoTicketPayload(cleanContract || 'SGN123456');
    const summary = normalizeTicketSummary(demoRaw, selectedSupId);
    return {
      status: 'ok',
      mode: 'demo',
      ticketUrl: `${DEPLOYMENT_ENDPOINTS.foxTicketPage}?q=demo`,
      hash: 'demo',
      grant: '',
      summary,
      dataFilter: summary.dataFilter,
      equipments: normalizeEquipmentList(DEMO_EQUIPMENTS),
      paymentInfo: normalizePaymentInfo(DEMO_PAYMENT),
      modemMetrics: {
        Ip: '192.0.2.10',
        MacAddress: '00:11:22:33:44:55',
        RxGroupPoints: -19.2,
        OnuRxPower: -20.1,
        OnuTxPower: 2.3,
        LastMile: 70,
        StatusByPass: 'Normal (Mẫu)',
        FirstOnlineMacDate: '23/11/2026 08:30:00',
      },
    };
  }

  let hash = '';
  let ticketUrl = '';

  if (cleanContract) {
    const partnerRes = await warmupAndRetryFoxJson(
      DEPLOYMENT_ENDPOINTS.partnerGetContract,
      { Contract: cleanContract },
      DEPLOYMENT_ENDPOINTS.partnerMonitor,
      { loginUrl: DEPLOYMENT_ENDPOINTS.partnerMonitor }
    );
    if (partnerRes.status !== 'ok') {
      return {
        status: partnerRes.status,
        message: partnerRes.message,
        loginUrl: DEPLOYMENT_ENDPOINTS.partnerMonitor,
        loginLabel: 'Đăng nhập Partner',
      };
    }
    const partnerJson = partnerRes.json;
    if (!partnerJson.Succeeded) {
      return {
        status: 'error',
        message: partnerJson.Message || `Không tra cứu được phiếu triển khai cho ${cleanContract}.`,
      };
    }
    const linkInfo = extractDeploymentTicketLink(partnerJson.Data);
    if (!linkInfo.found) {
      return {
        status: 'error',
        message: linkInfo.message,
      };
    }
    hash = linkInfo.hash;
    ticketUrl = linkInfo.url;
  } else {
    const pageHash = extractHashFromLocation(pageLocation);
    if (!pageHash) {
      return {
        status: 'error',
        message: 'Vui lòng nhập Mã hợp đồng trước khi mở Phiếu triển khai.',
      };
    }
    hash = pageHash;
    ticketUrl = (pageLocation && pageLocation.href) || DEPLOYMENT_ENDPOINTS.foxTicketPage;
  }

  const ticketRes = await warmupAndRetryFoxJson(
    DEPLOYMENT_ENDPOINTS.getTicketInfo,
    { Hash: hash },
    ticketUrl,
    { loginUrl: ticketUrl || DEPLOYMENT_ENDPOINTS.foxTicketPage }
  );
  if (ticketRes.status !== 'ok') {
    return {
      status: ticketRes.status,
      message: ticketRes.message,
      loginUrl: ticketUrl || DEPLOYMENT_ENDPOINTS.foxTicketPage,
      loginLabel: 'Đăng nhập FOX-ERP',
    };
  }

  const ticketJson = ticketRes.json;
  if (!ticketJson.Succeeded || !ticketJson.Data) {
    return {
      status: 'error',
      message: ticketJson.Message || 'Không tải được chi tiết phiếu triển khai trên FOX-ERP.',
    };
  }

  const summary = normalizeTicketSummary(ticketJson.Data, selectedSupId);
  const grant = summary.grant || '';
  const activeSupId = summary.ticket ? summary.ticket.supId : 0;

  const [cfgSet, eqSet, metricsSet, paySet] = await Promise.allSettled([
    summary.dataFilter.length === 0
      ? postFoxJson(DEPLOYMENT_ENDPOINTS.getConfigByParent, null, { grant })
      : Promise.resolve({ status: 'ok', json: { Succeeded: true, Data: summary.dataFilter } }),
    summary.objId && activeSupId
      ? postFoxJson(
          DEPLOYMENT_ENDPOINTS.getEquipmentOnDep,
          { ObjId: summary.objId, SupId: activeSupId },
          { grant }
        )
      : Promise.resolve({ status: 'ok', json: { Succeeded: true, Data: [] } }),
    summary.contract
      ? postFoxJson(DEPLOYMENT_ENDPOINTS.getModemMetrics, { Contract: summary.contract }, { grant })
      : Promise.resolve({ status: 'ok', json: { Succeeded: false, Data: null } }),
    summary.objId && activeSupId
      ? postFoxJson(
          DEPLOYMENT_ENDPOINTS.getPaymentInfo,
          { ObjId: summary.objId, SupId: activeSupId },
          { grant }
        )
      : Promise.resolve({ status: 'ok', json: { Succeeded: false, Data: null } }),
  ]);

  let dataFilter = summary.dataFilter;
  if (
    dataFilter.length === 0 &&
    cfgSet.status === 'fulfilled' &&
    cfgSet.value &&
    cfgSet.value.status === 'ok' &&
    cfgSet.value.json &&
    Array.isArray(cfgSet.value.json.Data)
  ) {
    dataFilter = cfgSet.value.json.Data;
  }

  const rawEquipments =
    eqSet.status === 'fulfilled' &&
    eqSet.value &&
    eqSet.value.status === 'ok' &&
    eqSet.value.json &&
    eqSet.value.json.Succeeded
      ? eqSet.value.json.Data
      : [];

  const modemMetrics =
    metricsSet.status === 'fulfilled' &&
    metricsSet.value &&
    metricsSet.value.status === 'ok' &&
    metricsSet.value.json &&
    metricsSet.value.json.Succeeded
      ? metricsSet.value.json.Data || null
      : null;

  const rawPayment =
    paySet.status === 'fulfilled' &&
    paySet.value &&
    paySet.value.status === 'ok' &&
    paySet.value.json &&
    paySet.value.json.Succeeded
      ? paySet.value.json.Data || null
      : null;

  return {
    status: 'ok',
    mode: 'live',
    ticketUrl,
    hash,
    grant,
    summary: { ...summary, dataFilter },
    dataFilter,
    equipments: normalizeEquipmentList(rawEquipments),
    paymentInfo: normalizePaymentInfo(rawPayment),
    modemMetrics,
  };
}

export async function fetchDeploymentEquipments({ objId, supId, grant = '', forceDemo = false } = {}) {
  if (!isUserscriptEnv() || forceDemo) {
    return { status: 'ok', mode: 'demo', equipments: normalizeEquipmentList(DEMO_EQUIPMENTS) };
  }
  const res = await postFoxJson(
    DEPLOYMENT_ENDPOINTS.getEquipmentOnDep,
    { ObjId: Number(objId) || 0, SupId: Number(supId) || 0 },
    { grant }
  );
  if (res.status !== 'ok') return res;
  if (!res.json.Succeeded) {
    return { status: 'error', message: res.json.Message || 'Không tải được danh sách vật tư.' };
  }
  return { status: 'ok', mode: 'live', equipments: normalizeEquipmentList(res.json.Data) };
}

export async function clearDeploymentTicketMac({ objId, supId, grant = '', forceDemo = false } = {}) {
  if (!isUserscriptEnv() || forceDemo) {
    return { status: 'ok', mode: 'demo', message: 'Đã Clear Mac thiết bị trên phiếu (mẫu mô phỏng).' };
  }
  const res = await postFoxJson(
    DEPLOYMENT_ENDPOINTS.clearEquipment,
    { ObjId: Number(objId) || 0, SupId: Number(supId) || 0 },
    { grant }
  );
  if (res.status !== 'ok') return res;
  const succeeded = Boolean(res.json.Succeeded) || Number(res.json.Data ?? 0) > 0;
  return {
    status: succeeded ? 'ok' : 'error',
    mode: 'live',
    message:
      res.json.Message ||
      (succeeded ? 'Clear Mac thiết bị trên phiếu thành công.' : 'Không Clear được MAC thiết bị.'),
  };
}

export async function fetchDeploymentModemMetrics({ contract, grant = '', forceDemo = false } = {}) {
  if (!isUserscriptEnv() || forceDemo) {
    return {
      status: 'ok',
      mode: 'demo',
      data: {
        Ip: '192.0.2.10',
        MacAddress: '00:11:22:33:44:55',
        RxGroupPoints: -19.2,
        OnuRxPower: -20.1,
        OnuTxPower: 2.3,
        LastMile: 70,
        StatusByPass: 'Normal (Mẫu)',
        FirstOnlineMacDate: '23/11/2026 08:30:00',
      },
    };
  }
  const res = await postFoxJson(
    DEPLOYMENT_ENDPOINTS.getModemMetrics,
    { Contract: normalizeContractId(contract) },
    { grant }
  );
  if (res.status !== 'ok') return res;
  if (!res.json.Succeeded || !res.json.Data) {
    return { status: 'error', message: res.json.Message || 'Không tải được thông số kết nối NET.' };
  }
  return { status: 'ok', mode: 'live', data: res.json.Data };
}

export async function fetchDeploymentPhones({ contract, objId, grant = '', forceDemo = false } = {}) {
  if (!isUserscriptEnv() || forceDemo) {
    return { status: 'ok', mode: 'demo', rows: DEMO_PHONES };
  }
  const res = await postFoxJson(
    DEPLOYMENT_ENDPOINTS.getContractPhone,
    { Contract: normalizeContractId(contract), ContractId: Number(objId) || 0 },
    { grant }
  );
  if (res.status !== 'ok') return res;
  if (!res.json.Succeeded) {
    return { status: 'error', message: res.json.Message || 'Không tải được danh sách SĐT User.' };
  }
  return { status: 'ok', mode: 'live', rows: Array.isArray(res.json.Data) ? res.json.Data : [] };
}

export async function revealDeploymentPhone({ token, objId, supId, grant = '', forceDemo = false } = {}) {
  if (!isUserscriptEnv() || forceDemo) {
    return { status: 'ok', mode: 'demo', phone: '0901000001' };
  }
  const res = await postFoxJson(
    DEPLOYMENT_ENDPOINTS.revealPhone,
    { Token: String(token || ''), ObjId: Number(objId) || 0, SupId: Number(supId) || 0 },
    { grant }
  );
  if (res.status !== 'ok') return res;
  if (!res.json.Succeeded || !res.json.Data) {
    return { status: 'error', message: res.json.Message || 'Không giải mã được số điện thoại.' };
  }
  return { status: 'ok', mode: 'live', phone: String(res.json.Data) };
}

export function normalizePaymentInfo(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const rawService = Array.isArray(raw.ServiceFeesDetail) ? raw.ServiceFeesDetail : [];
  const rawTicket = Array.isArray(raw.TicketFeesDetail) ? raw.TicketFeesDetail : [];
  return {
    sumMoneyPaid: Number(raw.SumMoneyPaid ?? 0),
    sumMoneyUnPaid: Number(raw.SumMoneyUnPaid ?? 0),
    paymentStatus: Boolean(raw.PaymentStatus),
    paymentStatusDesc: String(raw.PaymentStatusDesc || 'Không có khoản thu').trim(),
    serviceFees: rawService.map((f) => ({
      name: String(f.ShortNameVN || f.ShortName || 'Khoản thu').trim(),
      money: Number(f.Money ?? 0),
      status: Number(f.Status ?? 0),
    })),
    ticketFees: rawTicket.map((f) => ({
      description: String(f.PaymentDescription || '').trim(),
      feePayment: Number(f.FeePayment ?? 0),
      feePaymentPaid: Number(f.FeePaymentPaid ?? 0),
      statusPayment: Number(f.StatusPayment ?? 0),
      paymentQuantity: Number(f.PaymentQuantity ?? 0),
      unit: String(f.EquipmentUnit || '').trim(),
    })),
  };
}

export async function fetchDeploymentPayment({ objId, supId, grant = '', forceDemo = false } = {}) {
  if (!isUserscriptEnv() || forceDemo) {
    return { status: 'ok', mode: 'demo', paymentInfo: normalizePaymentInfo(DEMO_PAYMENT) };
  }
  const res = await postFoxJson(
    DEPLOYMENT_ENDPOINTS.getPaymentInfo,
    { ObjId: Number(objId) || 0, SupId: Number(supId) || 0 },
    { grant }
  );
  if (res.status !== 'ok') return res;
  if (!res.json.Succeeded) {
    return { status: 'error', message: res.json.Message || 'Không tải được thông tin Khoản thu.' };
  }
  return { status: 'ok', mode: 'live', paymentInfo: normalizePaymentInfo(res.json.Data) };
}

export function validateCameraPhoneNumber(raw) {
  const value = String(raw ?? '').trim();
  if (!value) {
    return { valid: false, value: '', error: 'Vui lòng nhập số điện thoại CMR mới.' };
  }
  if (!/^\d+$/.test(value)) {
    return { valid: false, value, error: 'Số điện thoại CMR chỉ được gồm chữ số.' };
  }
  return { valid: true, value, error: '' };
}

export function canEditDeploymentCameraPhone(phoneItem, summary) {
  if (!phoneItem || !summary) return false;
  return (
    Number(phoneItem.Type) === DEPLOYMENT_CAMERA_PHONE_TYPE &&
    Boolean(phoneItem.PhoneToken) &&
    Number(summary.statusContract) === 1 &&
    Boolean(summary.ticket && summary.ticket.supId)
  );
}

export async function updateDeploymentCameraPhone({
  objId,
  supId,
  contract,
  oldPhoneNumberToken,
  phoneNumber,
  grant = '',
  forceDemo = false,
} = {}) {
  const check = validateCameraPhoneNumber(phoneNumber);
  if (!check.valid) {
    return { status: 'error', message: check.error };
  }
  if (!isUserscriptEnv() || forceDemo) {
    return {
      status: 'ok',
      mode: 'demo',
      message: `Đã cập nhật SĐT CMR sang ${check.value} (mẫu mô phỏng).`,
    };
  }
  const res = await postFoxJson(
    DEPLOYMENT_ENDPOINTS.updateCameraPhone,
    {
      ObjId: Number(objId) || 0,
      SupId: Number(supId) || 0,
      Contract: normalizeContractId(contract),
      OldPhoneNumberToken: String(oldPhoneNumberToken || ''),
      PhoneNumber: check.value,
    },
    { grant }
  );
  if (res.status !== 'ok') return res;
  return {
    status: res.json.Succeeded ? 'ok' : 'error',
    mode: 'live',
    message:
      res.json.Message ||
      (res.json.Succeeded
        ? `Cập nhật SĐT CMR thành công (${check.value}).`
        : 'Không cập nhật được SĐT CMR.'),
  };
}

export async function fetchDeploymentEContracts({ objId, grant = '', forceDemo = false } = {}) {
  if (!isUserscriptEnv() || forceDemo) {
    return { status: 'ok', mode: 'demo', rows: DEMO_RECORDS };
  }
  const res = await postFoxJson(
    DEPLOYMENT_ENDPOINTS.getEContractRecord,
    { ObjId: Number(objId) || 0 },
    { grant }
  );
  if (res.status !== 'ok') return res;
  if (!res.json.Succeeded) {
    return { status: 'error', message: res.json.Message || 'Không tải được Biên bản điện tử.' };
  }
  return { status: 'ok', mode: 'live', rows: Array.isArray(res.json.Data) ? res.json.Data : [] };
}

export async function signDeploymentEContract({
  objId,
  supId,
  guid,
  name,
  code,
  grant = '',
  forceDemo = false,
} = {}) {
  if (!isUserscriptEnv() || forceDemo) {
    return { status: 'ok', mode: 'demo', message: `Đã gửi yêu cầu ký biên bản ${code} (mẫu mô phỏng).` };
  }
  const res = await postFoxJson(
    DEPLOYMENT_ENDPOINTS.signEContract,
    {
      ObjId: Number(objId) || 0,
      SupId: Number(supId) || 0,
      EContractId: String(guid || ''),
      EContractName: String(name || ''),
      EContractCode: String(code || ''),
    },
    { grant }
  );
  if (res.status !== 'ok') return res;
  return {
    status: res.json.Succeeded ? 'ok' : 'error',
    mode: 'live',
    message:
      res.json.Message ||
      (res.json.Succeeded ? `Ký biên bản ${code} thành công.` : `Chưa ký được biên bản ${code}.`),
  };
}

export async function syncDeploymentOnline({
  objId,
  supId,
  contract,
  grant = '',
  forceDemo = false,
} = {}) {
  if (!isUserscriptEnv() || forceDemo) {
    return {
      status: 'ok',
      mode: 'demo',
      message: 'Hệ thống ghi nhận đồng bộ thông tin Online thành công (mẫu mô phỏng).',
    };
  }
  const res = await postFoxJson(
    DEPLOYMENT_ENDPOINTS.syncOnline,
    {
      Contract: normalizeContractId(contract),
      ObjId: Number(objId) || 0,
      SupId: Number(supId) || 0,
    },
    { grant }
  );
  if (res.status !== 'ok') return res;
  return {
    status: res.json.Succeeded ? 'ok' : 'error',
    mode: 'live',
    message:
      res.json.Message ||
      (res.json.Succeeded
        ? 'Hệ thống ghi nhận đồng bộ dữ liệu thành công. Vui lòng đợi 1-3 phút.'
        : 'Đồng bộ thông tin Online chưa thành công.'),
  };
}

export async function updateDeploymentConstruction({
  objId,
  supId,
  contract,
  outDoorReUsed = 0,
  descriptionRD = '',
  reasonDelay = 0,
  grant = '',
  forceDemo = false,
} = {}) {
  const check = validateConstructionUpdate({ outDoorReUsed, descriptionRD });
  if (!check.valid) {
    return { status: 'error', message: check.error };
  }
  if (!isUserscriptEnv() || forceDemo) {
    return {
      status: 'ok',
      mode: 'demo',
      message: 'Đã lưu thông tin thi công phiếu triển khai (mẫu mô phỏng).',
    };
  }
  const res = await postFoxJson(
    DEPLOYMENT_ENDPOINTS.updateDeploymentInfo,
    {
      ObjId: Number(objId) || 0,
      SupId: Number(supId) || 0,
      Contract: normalizeContractId(contract),
      DescriptionRD: check.descriptionRD,
      ReasonDelay: Number(reasonDelay) || 0,
      OutDoorReUsed: check.outDoorReUsed,
    },
    { grant }
  );
  if (res.status !== 'ok') return res;
  return {
    status: res.json.Succeeded ? 'ok' : 'error',
    mode: 'live',
    message:
      res.json.Message ||
      (res.json.Succeeded ? 'Cập nhật thông tin thi công thành công.' : 'Cập nhật thông tin thi công thất bại.'),
  };
}

export async function completeDeploymentTicket({
  objId,
  supId,
  outDoorReUsed = 0,
  descriptionRD = '',
  reasonDelay = 0,
  reasonHiFPT = 0,
  notCompleteWifi = 0,
  reasonUnuseCapLan = 0,
  grant = '',
  forceDemo = false,
} = {}) {
  const check = validateConstructionUpdate({ outDoorReUsed, descriptionRD });
  if (!check.valid) {
    return { status: 'error', message: check.error };
  }
  const payload = buildCompletedPayload({
    objId,
    supId,
    outDoorReUsed: check.outDoorReUsed,
    descriptionRD: check.descriptionRD,
    reasonDelay,
    reasonHiFPT,
    notCompleteWifi,
    reasonUnuseCapLan,
  });

  if (!isUserscriptEnv() || forceDemo) {
    return {
      status: 'ok',
      mode: 'demo',
      message: 'Đã xác nhận hoàn tất phiếu triển khai (mẫu mô phỏng).',
      payload,
    };
  }

  const res = await postFoxJson(DEPLOYMENT_ENDPOINTS.statusCompleted, payload, { grant });
  if (res.status !== 'ok') return res;
  return {
    status: res.json.Succeeded ? 'ok' : 'error',
    mode: 'live',
    message:
      res.json.Message ||
      (res.json.Succeeded ? 'Hoàn tất phiếu triển khai thành công.' : 'Không hoàn tất được phiếu.'),
  };
}
