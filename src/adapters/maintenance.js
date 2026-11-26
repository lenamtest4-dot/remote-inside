/**
 * Adapter thao tac Phieu bao tri & Chuyen Cloud Camera FOX-ERP / Partner.
 * Chay truc tiep qua VPN & phien IAM hien tai, khong luu mat khau xuong bo nho.
 */

import { normalizeContractId } from '../config/portals.js';
import {
  canWarmPortalSession,
  detectIamRedirect,
  isUserscriptEnv,
  requestPortal,
  warmPortalSession,
} from '../core/transport.js';

export const MAINT_ENDPOINTS = {
  partnerMonitor: 'http://partner.fpt.net/pt-portal/monitor',
  partnerGetContract: 'http://partner.fpt.net/pt-portal/api/portals/configs/getContract',
  partnerTicketPage: 'http://partner.fpt.net/tkbt/bt/ticket',
  foxBase: 'https://fox-erp.fpt.net/app/tkbt/bt',
  foxTicketPage: 'https://fox-erp.fpt.net/app/tkbt/bt/ticket',
  userInfo: 'https://fox-erp.fpt.net/app/tkbt/bt/api/user/info',
  loadComboConfig: 'https://fox-erp.fpt.net/app/tkbt/bt/api/configs/load-combo-config',
  getTicketStatus: 'https://fox-erp.fpt.net/app/tkbt/bt/api/tickets/get-ticket-status',
  decryptRequest: 'https://fox-erp.fpt.net/app/tkbt/bt/api/contracts/decrypt-request',
  encryptGeneral: 'https://fox-erp.fpt.net/app/tkbt/bt/api/generals/encrypt',
  getContractFromMicro:
    'https://fox-erp.fpt.net/app/tkbt/bt/api/contracts/get-contract-from-micro',
  getContractInfo: 'https://fox-erp.fpt.net/app/tkbt/bt/api/contracts/get-contract-info',
  getListContractInfo: 'https://fox-erp.fpt.net/app/tkbt/bt/api/contracts/get-list-contract-info',
  getContractProduct: 'https://fox-erp.fpt.net/app/tkbt/bt/api/contracts/get-contract-product',
  checkOnlineSession:
    'https://fox-erp.fpt.net/app/tkbt/bt/api/contracts/check-online-session-by-objid',
  getTicketEquipments:
    'https://fox-erp.fpt.net/app/tkbt/bt/api/materials/get-ticket-equipments',
  getEquipmentInfos: 'https://fox-erp.fpt.net/app/tkbt/bt/api/materials/get-equipment-infos',
  getEquipmentExport: 'https://fox-erp.fpt.net/app/tkbt/bt/api/materials/get-equipment-export',
  getEquipmentMac: 'https://fox-erp.fpt.net/app/tkbt/bt/api/materials/get-equipment-mac',
  updateEquipment: 'https://fox-erp.fpt.net/app/tkbt/bt/api/materials/update-equipment',
  getMacHistoryCameraOtt:
    'https://fox-erp.fpt.net/app/tkbt/bt/api/materials/get-mac-history-camera-ott',
  getMacHistoryCameraCombo:
    'https://fox-erp.fpt.net/app/tkbt/bt/api/materials/get-mac-history-camera-combo',
  getInitAndErrorByTicket:
    'https://fox-erp.fpt.net/app/tkbt/bt/api/origins/get-init-status-and-error-complete-by-ticket',
  catalogGetInfoInit: 'https://fox-erp.fpt.net/app/tkbt/bt/api/origins/catalog-get-info-init',
  updateServiceInit: 'https://fox-erp.fpt.net/app/tkbt/bt/api/origins/update-service-init',
  getInfoErrorComplete:
    'https://fox-erp.fpt.net/app/tkbt/bt/api/contracts/get-info-errror-complete',
  ticketUpdateErrorComplete:
    'https://fox-erp.fpt.net/app/tkbt/bt/api/contracts/ticket-update-error-complete',
  getDiscussionByCode:
    'https://fox-erp.fpt.net/app/tkbt/bt/api/contracts/get-discussion-by-code',
  updateDiscussion: 'https://fox-erp.fpt.net/app/tkbt/bt/api/contracts/update-discussion',
  ticketUpdateAndComplete:
    'https://fox-erp.fpt.net/app/tkbt/bt/api/contracts/ticket-update-and-complete',
  returnFinalStatus:
    'https://fox-erp.fpt.net/app/tkbt/bt/api/maintenances/return-final-status',
  getReimbursementStatusNextGen:
    'https://fox-erp.fpt.net/app/tkbt/bt/api/maintenances/get-reimbursement-status-nextgen',
  getReimbursementStatus:
    'https://fox-erp.fpt.net/app/tkbt/bt/api/maintenances/get-reimbursement-status',
  getListRecordTicket:
    'https://fox-erp.fpt.net/app/tkbt/bt/api/maintenances/get-list-record-ticket',
  updateFlag: 'https://fox-erp.fpt.net/app/tkbt/bt/api/implementfunctions/update-flag',
};

export const MAINT_STATUS = {
  DaPhanCong: 0,
  DaXuLy: 1,
  ChuaPhanCong: 2,
  DaXuLyHoanTatQuaPhone: 3,
  DaXuLyVaDangTheoDoi: 5,
  DaNhanCa: 6,
  DangDiChuyen: 7,
  DangXuLy: 10,
  DongCheckList: 97,
  HuyCheckList: 100,
};

export const MAINT_CATALOG_KEYS = {
  TICKET_STATUS: 'MaintenanceTicketStatus',
  URGENT: 'MaintenanceTicketUrgent',
  NON_SET_HIFPT: 'MaintenanceReasonNonSetHiFPT',
  REASON_IN_CABLE: 'MaintenanceReasonUseCapbleJoinR',
  REASON_MY_BAO: 'MaintenanceReasonMyBaoUnAcceptance',
  EQUIP_RETURN_CAUSE: 'MaintenanceEquipReturnCause',
  SERVICES: 'MaintenanceServices',
  WEB_NAVIGATE: 'MaintenanceWebNavigate',
};

export const MAINT_DISCUSSION_CODES = {
  TICKET_NOTE: 'TICKET_NOTE',
  ERROR_REASON_DESC: 'ERROR_REASON_DESC',
  CUSTOMER_URGENT: 'CUSTOMER_URGENT',
};

const MAINT_CONTRACT_FIELDS = [
  'objid',
  'contract',
  'status',
  'name',
  'fullname',
  'fullnamevn',
  'createdate',
  'firstaccess',
  'localtype',
  'localtypedesc',
  'branchcode',
  'locationid',
  'location',
  'locationl3',
  'locationname',
  'locationnumber',
  'locationstreet',
  'locationward',
  'locationdistrict',
  'macstb',
  'grouppoints',
  'odccabletype',
  'locationphone',
  'type',
  'email',
  'macaddress',
  'idclength',
  'odclength',
  'isvip',
];

function maintDecodeSafeQueryParam(rawVal) {
  if (!rawVal) return '';
  try {
    return decodeURIComponent(String(rawVal));
  } catch {
    return String(rawVal);
  }
}

function maintExtractQueryQ(rawUrl) {
  const m = String(rawUrl || '').match(/[?&]q=([^&#]+)/i);
  return m && m[1] ? maintDecodeSafeQueryParam(m[1]).trim() : '';
}

function maintFoldText(raw) {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim();
}

function maintSafeJsonParse(rawText) {
  if (typeof rawText !== 'string') return rawText;
  const trimmed = rawText.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

/**
 * Tao cap URL mo Phieu bao tri tren FOX-ERP va Partner Blazor tu cung ma hash q.
 */
export function buildMaintenanceTicketUrls(hash) {
  const clean = String(hash || '').trim();
  if (!clean) {
    return { foxUrl: '', partnerUrl: '' };
  }
  const encoded = encodeURIComponent(clean);
  return {
    foxUrl: `${MAINT_ENDPOINTS.foxTicketPage}?q=${encoded}`,
    partnerUrl: `${MAINT_ENDPOINTS.partnerTicketPage}?q=${encoded}`,
  };
}

/**
 * Tim lien ket phieu bao tri (/tkbt/bt/ticket) trong phan hoi getContract cua Partner.
 */
export function extractMaintenanceTicketLink(partnerData) {
  const list = Array.isArray(partnerData) ? partnerData : [];
  if (list.length === 0) {
    return {
      found: false,
      reason: 'not_found',
      message: 'Partner không trả về phiếu đang mở cho hợp đồng này.',
    };
  }

  for (const item of list) {
    if (!item || typeof item.url !== 'string') continue;
    const rawUrl = item.url.trim();
    if (/\/(?:app\/)?tkbt\/bt\/ticket/i.test(rawUrl)) {
      const hash = maintExtractQueryQ(rawUrl);
      if (hash) {
        const urls = buildMaintenanceTicketUrls(hash);
        const foxUrl = /\/app\/tkbt\/bt\/ticket/i.test(rawUrl) && /^https?:\/\//i.test(rawUrl)
          ? rawUrl
          : urls.foxUrl;
        return {
          found: true,
          url: foxUrl,
          partnerUrl: urls.partnerUrl,
          hash,
          isBackLog: Boolean(item.isBackLog),
          type: String(item.type || ''),
        };
      }
    }
  }

  return {
    found: false,
    reason: 'not_found',
    message: 'Hợp đồng này chưa có phiếu Bảo trì (/bt/ticket) trong kết quả Partner.',
  };
}

/**
 * Trich tham so q khi nguoi dung dang mo san trang bao tri tren fox-erp.fpt.net hoac partner.fpt.net.
 */
export function extractMaintenanceHashFromLocation(loc) {
  if (!loc) return '';
  try {
    const hostname = String(loc.hostname || '').toLowerCase();
    const pathname = String(loc.pathname || '').toLowerCase();
    const isFoxBt =
      hostname === 'fox-erp.fpt.net' &&
      (pathname.startsWith('/app/tkbt/bt/ticket') ||
        pathname.startsWith('/app/tkbt/bt/temp/ticket'));
    const isPartnerBt =
      hostname === 'partner.fpt.net' && pathname.startsWith('/tkbt/bt/ticket');
    if (!isFoxBt && !isPartnerBt) {
      return '';
    }
    return maintExtractQueryQ(String(loc.search || loc.href || ''));
  } catch {
    return '';
  }
}

/**
 * Doc danh sach lua chon tu mang load-combo-config theo ParentName.
 */
export function parseMaintenanceComboOptions(comboConfig, parentName) {
  if (!Array.isArray(comboConfig) || !parentName) {
    return [];
  }
  const group = comboConfig.find((g) => g && g.ParentName === parentName);
  const datas = group && Array.isArray(group.Datas) ? group.Datas : [];
  return datas
    .filter((d) => d && (d.Code !== undefined || d.Value !== undefined))
    .map((d) => ({
      code: d.Code !== undefined && d.Code !== null ? String(d.Code) : '',
      value: d.Value !== undefined && d.Value !== null ? Number(d.Value) : null,
      title: String(d.Tittle ?? d.Title ?? d.Desc ?? '').trim(),
      enabled: d.Enabled !== false,
      position: Number(d.Position ?? 0),
      content: String(d.Content ?? ''),
    }))
    .sort((a, b) => a.position - b.position);
}

/**
 * Sinh ma phieu chuan theo cong thuc ae(contract, createdate, index) cua FOX-ERP BT.
 */
export function buildMaintenanceTicketNo(contract, createDate, index1Based = 1, isOld = false) {
  const cleanContract = String(contract || '').trim();
  let stamp = '';
  if (createDate) {
    const d = createDate instanceof Date ? createDate : new Date(createDate);
    if (!Number.isNaN(d.getTime())) {
      const yy = String(d.getFullYear()).slice(-2);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      stamp = `${yy}${mm}${dd}${hh}${mi}`;
    }
  }
  return `BT.${cleanContract}.${stamp}${isOld ? ' [cũ]' : `-${index1Based}`}`;
}

function maintResolveTicketStatusBucket(finalStatus, ticketStatusCfg) {
  const num = Number(finalStatus);
  const cfg = ticketStatusCfg && typeof ticketStatusCfg === 'object' ? ticketStatusCfg : {};
  const checkIn = (arr) =>
    Array.isArray(arr) &&
    arr.some((x) => {
      if (typeof x === 'number' || typeof x === 'string') return Number(x) === num;
      return x && Number(x.Value ?? x.Code ?? x.Id) === num;
    });
  if (checkIn(cfg.Backlogs)) return 'backlog';
  if (checkIn(cfg.Completes)) return 'complete';
  if (checkIn(cfg.Closes)) return 'close';
  if (checkIn(cfg.Others)) return 'other';
  if ([0, 2, 6, 7, 10].includes(num)) return 'backlog';
  if ([1, 3, 5].includes(num)) return 'complete';
  if ([97, 100].includes(num)) return 'close';
  return 'other';
}

function maintResolveStatusTitle(comboConfig, finalStatus) {
  const opts = parseMaintenanceComboOptions(comboConfig, MAINT_CATALOG_KEYS.TICKET_STATUS);
  const hit = opts.find((o) => Number(o.value) === Number(finalStatus));
  if (hit && hit.title) return hit.title;
  const fallback = {
    0: 'Đã phân công',
    1: 'Đã xử lý',
    2: 'Chưa phân công',
    3: 'Đã xử lý hoàn tất qua Phone',
    5: 'Đã xử lý và đang theo dõi',
    6: 'Đã nhận ca',
    7: 'Đang di chuyển',
    10: 'Đang xử lý',
    97: 'Đóng CheckList',
    100: 'Hủy CheckList',
  };
  return fallback[Number(finalStatus)] || `Mã ${finalStatus}`;
}

function maintFormatAppointmentSummary(appt) {
  if (!appt || typeof appt !== 'object') return '';
  const pairs = [
    [appt.timezonered, appt.appointmentdatered],
    [appt.timezoneblue, appt.appointmentdateblue],
  ];
  for (const [tz, dt] of pairs) {
    const parts = [String(tz || '').trim(), String(dt || '').trim()].filter(Boolean);
    if (parts.length) {
      const count =
        Number(appt.appointmenttimes || 0) + Number(appt.appointmenttimestinpn || 0);
      return count > 0 ? `${parts.join(' • ')} (${count} lần)` : parts.join(' • ');
    }
  }
  return '';
}

function maintCalcBacklogHours(dateRef) {
  if (!dateRef) return 0;
  const d = new Date(dateRef);
  if (Number.isNaN(d.getTime())) return 0;
  const start = new Date(d);
  start.setMinutes(0, 0, 0);
  const now = new Date();
  now.setMinutes(0, 0, 0);
  return Math.max(0, Math.floor((now.getTime() - start.getTime()) / 3600000));
}

/**
 * Chuan hoa du lieu hop dong tu get-contract-from-micro hoac get-contract-info.
 */
export function normalizeMaintenanceContract(contractData, queryInfo = {}) {
  const microList =
    contractData &&
    contractData.ContractFromMicro &&
    Array.isArray(contractData.ContractFromMicro.maintenancecontract)
      ? contractData.ContractFromMicro.maintenancecontract
      : Array.isArray(contractData && contractData.maintenancecontract)
      ? contractData.maintenancecontract
      : null;

  const row = (microList && microList[0]) || (contractData && contractData.Contract) || contractData || {};
  const objPhones = Array.isArray(row.objphone)
    ? row.objphone
    : Array.isArray(contractData && contractData.Objphone)
    ? contractData.Objphone
    : [];
  const mainPhoneObj = objPhones.find((p) => p && Number(p.type) === 5) || objPhones[0] || null;
  const statusNum = Number(row.status ?? 0);

  return {
    objId: Number(row.objid ?? row.id ?? queryInfo.ObjId ?? 0),
    contract: String(row.contract || queryInfo.Contract || '').trim(),
    fullName: String(row.fullnamevn || row.fullname || row.name || '').trim(),
    address: String(row.location || row.address || row.locationl3 || '').trim(),
    status: statusNum,
    statusName: statusNum === 1 ? 'Bình thường' : statusNum === 0 ? 'Chờ kích hoạt' : `Mã ${statusNum}`,
    localType: Number(row.localtype ?? 0),
    localTypeDesc: String(row.localtypedesc || row.detailservice || '').trim(),
    phone: String(row.locationphone || (mainPhoneObj && mainPhoneObj.phone) || '').trim(),
    accessName: String(row.name || '').trim(),
    firstAccess: String(row.firstaccess || '').trim(),
    locationId: Number(row.locationid ?? 0),
    branchCode: Number(row.branchcode ?? 0),
    groupPoints: String(row.grouppoints || '').trim(),
    odcCableType: String(row.odccabletype || '').trim(),
    macAddress: String(row.macaddress || '').trim(),
    isVip: Number(row.isvip ?? row.typeVip ?? 0),
    idclength: Number(row.idclength ?? 0),
    odclength: Number(row.odclength ?? 0),
  };
}

/**
 * Chuan hoa danh sach phieu bao tri tu /api/contracts/get-list-contract-info.
 */
export function normalizeMaintenanceTicketList(
  rawListData,
  contract,
  comboConfig = [],
  ticketStatusCfg = null
) {
  const src = rawListData && typeof rawListData === 'object' ? rawListData : {};
  const splists = Array.isArray(src.splist) ? src.splist : [];
  const details = Array.isArray(src.splistdetail) ? src.splistdetail : [];
  const appts = Array.isArray(src.maintenance_appointment) ? src.maintenance_appointment : [];
  const assigns = Array.isArray(src.maintenance_assignment) ? src.maintenance_assignment : [];

  const filtered = splists
    .filter((t) => t && (t.lladdressid == null || Number(t.lladdressid) === 0))
    .slice()
    .sort((a, b) => {
      const ta = a.createdate ? new Date(a.createdate).getTime() : 0;
      const tb = b.createdate ? new Date(b.createdate).getTime() : 0;
      return ta - tb;
    });

  const mapped = filtered.map((t, idx) => {
    const supId = Number(t.id ?? 0);
    const det = details.find((d) => d && Number(d.supportlistid) === supId) || {};
    const appt = appts.find((a) => a && Number(a.supid) === supId) || {};
    const ticketAssigns = assigns.filter((a) => a && Number(a.supid) === supId);
    const mainAssign = ticketAssigns.find((a) => Number(a.empstatus) === 1) || {};
    const extraAssigns = ticketAssigns.filter((a) => Number(a.empstatus) === 2);

    const finalStatus = Number(t.finalstatus ?? MAINT_STATUS.DaXuLy);
    const no = buildMaintenanceTicketNo(contract, t.createdate, idx + 1, false);
    const flag = Number(t.flag ?? 0);
    const statusBucket = maintResolveTicketStatusBucket(finalStatus, ticketStatusCfg);

    return {
      objId: Number(t.objid ?? 0),
      supId,
      no,
      flag,
      isActive: flag === 1,
      finalStatus,
      statusName: maintResolveStatusTitle(comboConfig, finalStatus),
      statusBucket,
      createDate: String(t.createdate || '').trim(),
      finishDate: String(t.finishdate || '').trim(),
      createBy: String(t.createby || '').trim(),
      addressUse: String(t.supportlocation || '').trim(),
      locationId: Number(det.locationid ?? 0),
      deptId: Number(t.deptid ?? 0),
      partnerId: Number(det.partnerid ?? 0),
      description: String(t.description || '').trim(),
      initDesc: String(t.initdesc || '').trim(),
      initStatus: Number(t.initstatus ?? 0),
      urgentNew: t.urgentnew ?? null,
      nonSetHiFpt: t.nonsethifpt ?? null,
      reasonInCable: det.reasonincable ?? null,
      reasonMyBaoUnAcceptance: det.reasonmybaounacceptance ?? null,
      link1: String(t.link1 || '').trim(),
      link2: String(t.link2 || '').trim(),
      lengthLink: Number(t.lengthlink ?? 0),
      repreName: String(det.reprename || '').trim(),
      repreRelation: String(det.reprerelation || '').trim(),
      reprePhone: String(det.reprephone || '').trim(),
      supportPhone: String(t.supportphone || '').trim(),
      popCode: String(t.popcode || '').trim(),
      groupPoints: String(t.grouppoints || det.grouppointcore || '').trim(),
      odcCableType: String(t.odccabletype || '').trim(),
      thirtyRepeat: Math.max(0, Number(t.thirtyrepeat ?? 0) - 1),
      backlogHours: maintCalcBacklogHours(appt.appointmentdateblue || t.createdate),
      mainEmp: {
        account: String(mainAssign.accountemp || '').trim(),
        code: String(mainAssign.codeemp || '').trim(),
        phone: String(mainAssign.empphone || '').trim(),
        email: String(mainAssign.empemail || '').trim(),
        blockName: String(mainAssign.blocknameemp || det.blockname || '').trim(),
        partnerName: String(mainAssign.partnername || '').trim(),
        plotsName: String(mainAssign.plotsname || det.plotsname || '').trim(),
        deptId: Number(mainAssign.deptid ?? t.deptid ?? 0),
      },
      extraEmps: extraAssigns.map((e) => ({
        account: String(e.accountemp || '').trim(),
        code: String(e.codeemp || '').trim(),
        phone: String(e.empphone || '').trim(),
      })),
      appointmentSummary: maintFormatAppointmentSummary(appt),
      raw: {
        ObjId: Number(t.objid ?? 0),
        SupportListId: supId,
        Flag: flag,
        CheckListFinalStatus: finalStatus,
        FinishDate: t.finishdate || null,
        SupportListUrgentNew: t.urgentnew ?? null,
        NonSetHiFPT: t.nonsethifpt ?? null,
        SupportLIstDetail_ReasonInCable: det.reasonincable ?? null,
        SupportListDetail_ReasonMyBaoUnAcceptance: det.reasonmybaounacceptance ?? null,
        Link1: t.link1 ?? '',
        Link2: t.link2 ?? '',
        SupportListLengthLink: Number(t.lengthlink ?? 0),
        AssignmentMainDeptId: Number(mainAssign.deptid ?? t.deptid ?? 0),
        AssignmentAccountEmp: String(mainAssign.accountemp || '').trim(),
        SpListLocationId: Number(det.locationid ?? 0),
      },
    };
  });

  return mapped.sort((a, b) => {
    const ta = a.createDate ? new Date(a.createDate).getTime() : 0;
    const tb = b.createDate ? new Date(b.createDate).getTime() : 0;
    return tb - ta;
  });
}

/**
 * Chon phieu dang thao tac uu tien: selectedSupId -> Flag=1 -> dang xu ly (backlog) -> moi nhat.
 */
export function selectActiveMaintenanceTicket(tickets, selectedSupId = 0) {
  const list = Array.isArray(tickets) ? tickets : [];
  const target = Number(selectedSupId || 0);
  if (target > 0) {
    const byId = list.find((t) => Number(t && t.supId) === target);
    if (byId) return byId;
  }
  return (
    list.find((t) => t && Number(t.flag) === 1) ||
    list.find((t) => t && t.statusBucket === 'backlog') ||
    list[0] ||
    null
  );
}

function maintNormalizeEquipmentItem(raw, defaultIsReturn) {
  const item = raw && typeof raw === 'object' ? raw : {};
  return {
    ID: Number(item.ID ?? 0),
    CodeID: Number(item.CodeID ?? 0),
    EQuipmentName: String(item.EQuipmentName ?? item.Description ?? '').trim(),
    DBName: String(item.DBName ?? item.Name ?? '').trim(),
    FunctionName: String(item.FunctionName ?? '').trim(),
    Quantity: Number(item.Quantity ?? 1),
    MacAddress: String(item.MacAddress ?? '').trim(),
    Type: Number(item.Type ?? item.EQType ?? 0),
    ParentName: String(item.ParentName ?? '').trim(),
    Orderby: Number(item.Orderby ?? 0),
    ParentOrder: Number(item.ParentOrder ?? 0),
    AccountReplace: String(item.AccountReplace ?? '').trim(),
    CheckReplace: Number(item.CheckReplace ?? 0),
    IsMac: Number(item.IsMac ?? 0),
    CauseReturn: Number(item.CauseReturn ?? 0),
    IsReturn: Number(item.IsReturn ?? defaultIsReturn),
  };
}

function maintIsFptCamera(item) {
  return String((item && item.ParentName) || '').trim() === 'FPT Camera';
}

/**
 * Danh gia trang thai san sang Chuyen Cloud Camera tren Partner dua tren lstUse & lstReturn.
 */
export function evaluateMaintenanceCameraCloud(lstUse = [], lstReturn = []) {
  const useList = Array.isArray(lstUse) ? lstUse : [];
  const retList = Array.isArray(lstReturn) ? lstReturn : [];
  const useCams = useList.filter(maintIsFptCamera);
  const retCams = retList.filter(maintIsFptCamera);
  const hasCameras = useCams.length > 0 || retCams.length > 0;

  if (!hasCameras) {
    return {
      hasCameras: false,
      useCameraCount: 0,
      returnCameraCount: 0,
      countsMatch: true,
      allMacsFilled: false,
      transferredCount: 0,
      allTransferred: false,
      readyForPartnerCloud: false,
      statusCode: 'none',
      statusLabel: 'Chưa gắn thiết bị FPT Camera trên phiếu',
      hint: 'Thêm đủ Camera sử dụng (đã gắn mới trên FPT Fife) và Camera thu hồi để mở Chuyển Cloud trên Partner.',
    };
  }

  const countsMatch = useCams.length > 0 && useCams.length === retCams.length;
  const allUseMacs = useCams.every((c) => Boolean(String(c.MacAddress || '').trim()));
  const allRetMacs = retCams.every(
    (c) => Boolean(String(c.MacAddress || '').trim()) || Number(c.CauseReturn || 0) > 0
  );
  const allMacsFilled = countsMatch && allUseMacs && allRetMacs;
  const allCamRows = [...useCams, ...retCams];
  const transferredRows = allCamRows.filter((c) => Number(c.CheckReplace || 0) === 2);
  const transferredCount = transferredRows.length;
  const allTransferred = allCamRows.length > 0 && transferredCount === allCamRows.length;

  if (transferredCount > 0 && allTransferred) {
    return {
      hasCameras: true,
      useCameraCount: useCams.length,
      returnCameraCount: retCams.length,
      countsMatch,
      allMacsFilled,
      transferredCount,
      allTransferred: true,
      readyForPartnerCloud: false,
      statusCode: 'transferred',
      statusLabel: 'Đã chuyển Cloud (MAC Camera đã khóa)',
      hint: 'Hệ thống đánh dấu CheckReplace=2 (đã chuyển Cloud xong). Không xóa dòng thu hồi vì sẽ báo lỗi yêu cầu thao tác trên app Camera.',
    };
  }

  if (allMacsFilled) {
    return {
      hasCameras: true,
      useCameraCount: useCams.length,
      returnCameraCount: retCams.length,
      countsMatch: true,
      allMacsFilled: true,
      transferredCount,
      allTransferred: false,
      readyForPartnerCloud: true,
      statusCode: 'ready',
      statusLabel: `Sẵn sàng Chuyển Cloud (${useCams.length} giao / ${retCams.length} thu hồi)`,
      hint: 'Đã có đủ Camera giao và Camera thu hồi. Lưu vật tư trên phiếu rồi bấm "Mở Chuyển Cloud (Partner)" để bấm nút chuyển Cloud 1 chạm.',
    };
  }

  let reason = `Camera sử dụng: ${useCams.length} • Camera thu hồi: ${retCams.length}.`;
  if (!countsMatch) {
    reason = `Số lượng Camera sử dụng (${useCams.length}) chưa bằng Camera thu hồi (${retCams.length}).`;
  } else if (!allUseMacs || !allRetMacs) {
    reason = 'Vui lòng chọn đủ MAC Camera sử dụng và MAC Camera thu hồi (hoặc nguyên nhân không thu hồi).';
  }

  return {
    hasCameras: true,
    useCameraCount: useCams.length,
    returnCameraCount: retCams.length,
    countsMatch,
    allMacsFilled,
    transferredCount,
    allTransferred: false,
    readyForPartnerCloud: false,
    statusCode: 'incomplete',
    statusLabel: 'Chưa đủ điều kiện Chuyển Cloud',
    hint: `${reason} Lưu ý: Camera sử dụng phải đã thêm mới trên ứng dụng FPT Fife.`,
  };
}

/**
 * Chuan hoa danh sach vat tu bao tri (lstUse & lstReturn) + danh gia trang thai Camera Cloud.
 */
export function normalizeMaintenanceMaterials(rawData) {
  const src = rawData && typeof rawData === 'object' ? rawData : {};
  const lstUse = (Array.isArray(src.lstUse) ? src.lstUse : []).map((r) =>
    maintNormalizeEquipmentItem(r, 2)
  );
  const lstReturn = (Array.isArray(src.lstReturn) ? src.lstReturn : []).map((r) =>
    maintNormalizeEquipmentItem(r, 1)
  );
  return {
    lstUse,
    lstReturn,
    cameraCloudSummary: evaluateMaintenanceCameraCloud(lstUse, lstReturn),
  };
}

/**
 * Kiem tra quy tac nghiep vu vat tu bao tri truoc khi goi /api/materials/update-equipment.
 */
export function validateMaintenanceMaterials({
  objId = 0,
  supId = 0,
  locationId = 0,
  logonUser = '',
  lstUse = [],
  lstReturn = [],
} = {}) {
  const useRows = Array.isArray(lstUse) ? lstUse.map((r) => maintNormalizeEquipmentItem(r, 2)) : [];
  const retRows = Array.isArray(lstReturn)
    ? lstReturn.map((r) => maintNormalizeEquipmentItem(r, 1))
    : [];

  if (
    useRows.some((e) => e.MacAddress.length > 50) ||
    retRows.some((e) => e.MacAddress.length > 50)
  ) {
    return { valid: false, error: 'MAC thiết bị không được vượt quá 50 ký tự!' };
  }
  if (useRows.some((e) => !e.FunctionName)) {
    return { valid: false, error: 'Vui lòng chọn chức năng thiết bị sử dụng!' };
  }
  if (useRows.some((e) => Number(e.IsMac) === 1 && !e.MacAddress)) {
    return { valid: false, error: 'Vui lòng chọn MAC thiết bị sử dụng!' };
  }

  const macCounts = new Map();
  for (const row of [...useRows, ...retRows]) {
    const key = row.MacAddress.toUpperCase();
    if (!key) continue;
    macCounts.set(key, (macCounts.get(key) || 0) + 1);
  }
  for (const [, count] of macCounts.entries()) {
    if (count > 1) {
      return { valid: false, error: 'MAC thiết bị không được trùng!' };
    }
  }

  if (retRows.some((e) => Number(e.IsMac) === 1 && Number(e.CauseReturn || 0) === 0 && !e.MacAddress)) {
    return {
      valid: false,
      error: 'Vui lòng chọn MAC thu hồi, nếu không thu hồi vui lòng chọn nguyên nhân!',
    };
  }

  const useCamCount = useRows.filter(maintIsFptCamera).length;
  const retCamCount = retRows.filter(maintIsFptCamera).length;
  if (useCamCount !== retCamCount) {
    return {
      valid: false,
      error: 'Vui lòng chọn số lượng camera sử dụng = số lượng camera thu hồi!',
    };
  }

  let useCamIdx = 0;
  let retCamIdx = 0;
  const mapRow = (e, isRetFlag) => {
    const isCam = maintIsFptCamera(e);
    let parentOrder = 0;
    if (isCam) {
      parentOrder = isRetFlag === 2 ? ++useCamIdx : ++retCamIdx;
    }
    return {
      ID: Number(e.ID || 0),
      CauseReturn: Number(e.CauseReturn || 0),
      CodeID: Number(e.CodeID || 0),
      EQType: Number(e.Type || 0),
      FunctionName: String(e.FunctionName || ''),
      IsReturn: isRetFlag,
      MacAddress: String(e.MacAddress || '').trim(),
      ParentOrder: parentOrder,
      Quantity: Number(e.Quantity ?? 1),
      Description: String(e.EQuipmentName || ''),
    };
  };

  return {
    valid: true,
    error: '',
    payload: {
      ObjId: Number(objId || 0),
      SupId: Number(supId || 0),
      LogonUser: String(logonUser || '').trim(),
      LocationID: Number(locationId || 0),
      Request: 0,
      Equipment: [...useRows.map((r) => mapRow(r, 2)), ...retRows.map((r) => mapRow(r, 1))],
    },
  };
}

/**
 * Loc danh sach trang thai ket qua xu ly cho phep chuyen doi theo trang thai hien tai & quyen user.
 */
export function filterAllowedMaintenanceStatuses(
  comboConfig,
  currentFinalStatus,
  canCompleteAndFollowing = false
) {
  const cur = Number(currentFinalStatus ?? MAINT_STATUS.DaXuLy);
  const all = parseMaintenanceComboOptions(comboConfig, MAINT_CATALOG_KEYS.TICKET_STATUS);

  let filtered =
    cur === MAINT_STATUS.ChuaPhanCong
      ? all.filter((s) => Number(s.value) === MAINT_STATUS.ChuaPhanCong)
      : all.filter((s) => {
          const v = Number(s.value);
          if (v === MAINT_STATUS.ChuaPhanCong) return false;
          if (v === MAINT_STATUS.DaNhanCa && cur !== MAINT_STATUS.DaNhanCa) return false;
          if (v === MAINT_STATUS.DangDiChuyen && cur !== MAINT_STATUS.DangDiChuyen) return false;
          if (v === MAINT_STATUS.DangXuLy && cur !== MAINT_STATUS.DangXuLy) return false;
          if (
            v === MAINT_STATUS.DaXuLyVaDangTheoDoi &&
            !canCompleteAndFollowing &&
            cur !== MAINT_STATUS.DaXuLyVaDangTheoDoi
          ) {
            return false;
          }
          return v === cur || Boolean(s.enabled);
        });

  if (!filtered.some((s) => Number(s.value) === cur)) {
    const curOpt = all.find((s) => Number(s.value) === cur);
    if (curOpt) {
      filtered = [...filtered, curOpt];
    }
  }

  return filtered.slice().sort((a, b) => a.position - b.position);
}

/**
 * Kiem tra dinh dang So dien thoai nguoi dai dien (bo trong duoc phep).
 */
export function validateMaintenanceRepPhone(phone) {
  const cleaned = String(phone || '')
    .trim()
    .replace(/[\s.-]/g, '');
  if (!cleaned) {
    return { valid: true, cleaned: '', error: '' };
  }
  if (!/^(0[35789]\d{8}|84[35789]\d{8})$/.test(cleaned)) {
    return {
      valid: false,
      cleaned,
      error: 'Số điện thoại người đại diện không hợp lệ (cần 10 số 03/05/07/08/09 hoặc 84...).',
    };
  }
  return { valid: true, cleaned, error: '' };
}

/**
 * Tao payload cho POST /api/contracts/ticket-update-and-complete.
 */
export function buildMaintenanceUpdateAndCompletePayload({
  contract = '',
  objId = 0,
  supId = 0,
  accountModify = '',
  urgentType = null,
  nonSetHiFpt = null,
  reasonInCable = null,
  reasonMyBao = null,
  link1 = '',
  link2 = '',
  lengthLink = 0,
  finalStatus = 0,
  statusCode = '',
  errorCompletes = [],
  repreName,
  repreRelation,
  reprePhone,
} = {}) {
  const payload = {
    Contract: String(contract || '').trim(),
    ObjId: Number(objId || 0),
    SupId: Number(supId || 0),
    Request: 5,
    AccountModify: String(accountModify || '').trim(),
    Final_Status: Number(finalStatus ?? 0),
  };

  if (repreName !== undefined || repreRelation !== undefined || reprePhone !== undefined) {
    payload.RepreName = String(repreName || '').trim();
    payload.RepreRelation = String(repreRelation || '').trim();
    payload.ReprePhone = String(reprePhone || '').trim();
  } else {
    payload.UrgentType = urgentType !== undefined && urgentType !== '' ? urgentType : null;
    payload.NonSetHiFPT = nonSetHiFpt !== undefined && nonSetHiFpt !== '' ? nonSetHiFpt : null;
    payload.ReasonInCable =
      reasonInCable !== undefined && reasonInCable !== '' ? reasonInCable : null;
    payload.Link1 = String(link1 || '');
    payload.Link2 = String(link2 || '');
    payload.LengthLink = Number(lengthLink) || 0;
    payload.ReasonMyBaoUnAcceptance =
      reasonMyBao !== undefined && reasonMyBao !== '' ? reasonMyBao : null;
    if (String(statusCode || '') === 'Complete') {
      payload.ErrrorCompletes = Array.isArray(errorCompletes) ? errorCompletes : [];
    }
  }

  return payload;
}

function maintYearMonthKey(dateVal) {
  if (!dateVal) return '';
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Kiem tra dieu kien hien nut "Tra tinh trang" tren phieu da hoan tat.
 */
export function canReturnMaintenanceTicketStatus({
  ticket,
  permissions,
  reimbursementStatus = 0,
  nowDate = new Date(),
} = {}) {
  if (!ticket) return false;
  const isFinished = ticket.statusBucket === 'complete' || ticket.statusBucket === 'close';
  if (!isFinished) return false;
  if (Number(reimbursementStatus ?? 0) > 0) return false;
  if (Number(ticket.flag ?? 0) !== 1) return false;
  if (!(permissions && permissions.IsReturnStatus)) return false;
  const finYm = maintYearMonthKey(ticket.finishDate);
  const nowYm = maintYearMonthKey(nowDate);
  return Boolean(finYm && nowYm && finYm === nowYm);
}

// --- Du lieu mau cho che do Preview / Demo (100% gia lap, 0 PII) ---

const DEMO_MAINT_USER_INFO = {
  Info: {
    UserName: 'demo.ktv',
    Email: 'demo@example.invalid',
    LocationId: 4,
    SubParentDesc: 'Vùng Demo',
  },
  Permissions: {
    Permission: {
      Maintenance: {
        IsUpdateTicket: 1,
        IsReturnStatus: 1,
        IsUpdateCompleteAndFollowing: true,
      },
    },
  },
};

const DEMO_MAINT_COMBO_CONFIG = [
  {
    ParentName: MAINT_CATALOG_KEYS.TICKET_STATUS,
    Datas: [
      { Code: 'Backlog', Value: 10, Tittle: 'Đang xử lý', Position: 1, Enabled: true },
      { Code: 'Complete', Value: 1, Tittle: 'Đã xử lý', Position: 2, Enabled: true },
      {
        Code: 'CompletePhone',
        Value: 3,
        Tittle: 'Đã xử lý hoàn tất qua Phone',
        Position: 3,
        Enabled: true,
      },
      {
        Code: 'Complete',
        Value: 5,
        Tittle: 'Đã xử lý và đang theo dõi',
        Position: 4,
        Enabled: true,
      },
    ],
  },
  {
    ParentName: MAINT_CATALOG_KEYS.URGENT,
    Datas: [
      { Code: '0', Tittle: 'Bình thường', Position: 1 },
      { Code: '1', Tittle: 'Gấp / KH hối', Position: 2 },
    ],
  },
  {
    ParentName: MAINT_CATALOG_KEYS.NON_SET_HIFPT,
    Datas: [
      { Code: '0', Tittle: 'Không chọn', Position: 1 },
      { Code: '1', Tittle: 'KH không dùng smartphone', Position: 2 },
    ],
  },
  {
    ParentName: MAINT_CATALOG_KEYS.REASON_IN_CABLE,
    Datas: [
      { Code: '0', Tittle: 'Không chọn', Position: 1 },
      { Code: '1', Tittle: 'Đứt cáp ngang đường không kéo mới được', Position: 2 },
    ],
  },
  {
    ParentName: MAINT_CATALOG_KEYS.REASON_MY_BAO,
    Datas: [
      { Code: '0', Tittle: 'Không chọn', Position: 1 },
      { Code: '2', Tittle: 'Mặc định', Position: 2 },
    ],
  },
  {
    ParentName: MAINT_CATALOG_KEYS.EQUIP_RETURN_CAUSE,
    Datas: [
      { Code: '0', Value: 0, Tittle: 'Thu hồi bình thường (nhập MAC)', Position: 1 },
      { Code: '1', Value: 1, Tittle: 'KH giữ thiết bị / không thu hồi được', Position: 2 },
    ],
  },
  {
    ParentName: MAINT_CATALOG_KEYS.SERVICES,
    Datas: [
      { Code: '1', Tittle: 'Internet', Position: 1 },
      { Code: '96', Tittle: 'FPT Camera', Position: 2 },
    ],
  },
];

const DEMO_MAINT_TICKET_STATUS_CFG = {
  Backlogs: [0, 2, 6, 7, 10],
  Completes: [1, 3, 5],
  Closes: [97, 100],
  Others: [],
};

const DEMO_MAINT_EQUIP_INFOS = [
  {
    IdCode: 4906,
    Name: 'FCAM-IQ 3S',
    Description: 'FCAM-IQ 3S [1]',
    Type: 96,
    ParentName: 'FPT Camera',
    ReturnType: 1,
    IsMac: 1,
    UnitName: 'Cái',
    Enabled: true,
  },
  {
    IdCode: 4907,
    Name: 'FCAM-IQ 4S',
    Description: 'FCAM-IQ 4S [1]',
    Type: 96,
    ParentName: 'FPT Camera',
    ReturnType: 1,
    IsMac: 1,
    UnitName: 'Cái',
    Enabled: true,
  },
  {
    IdCode: 101,
    Name: 'AX1800GZ',
    Description: 'Modem Wi-Fi 6 AX1800GZ',
    Type: 1,
    ParentName: 'Modem',
    ReturnType: 1,
    IsMac: 1,
    UnitName: 'Cái',
    Enabled: true,
  },
  {
    IdCode: 5001,
    Name: 'Dây thuê bao quang 1 core',
    Description: 'Cáp thuê bao quang 1 core',
    Type: 3,
    ParentName: 'Cáp',
    ReturnType: 0,
    IsMac: 0,
    UnitName: 'Mét',
    Enabled: true,
  },
];

const DEMO_MAINT_CATALOG_INIT = {
  Service: {
    Infos: [
      { Code: '96', Desc: 'FPT Camera', Enabled: true, Position: 1 },
      { Code: '1', Desc: 'Internet', Enabled: true, Position: 2 },
    ],
  },
  InitStatus: {
    Infos: [
      {
        Code: '9601',
        Desc: 'Camera mất kết nối / ngoại tuyến',
        Enabled: true,
        Position: 1,
        InfoBases: [{ LevelId: 1, Code: '96' }],
      },
      {
        Code: '1001',
        Desc: 'Modem mất tín hiệu LOS đỏ',
        Enabled: true,
        Position: 2,
        InfoBases: [{ LevelId: 1, Code: '1' }],
      },
    ],
  },
};

const DEMO_MAINT_ERROR_CATALOG = {
  ErrorElement: {
    Infos: [
      {
        Code: 'EL_CAM',
        Desc: 'Thiết bị Camera hư hỏng',
        Enabled: true,
        InfoBases: [{ LevelId: 2, Code: '9601' }],
      },
      {
        Code: 'EL_ONT',
        Desc: 'Cáp quang đứt / suy hao cao',
        Enabled: true,
        InfoBases: [{ LevelId: 2, Code: '1001' }],
      },
    ],
  },
  ErrorReason: {
    Infos: [
      {
        Code: 'RS_CAM_HW',
        Desc: 'Lỗi phần cứng Camera — cần đổi mới & chuyển Cloud',
        Enabled: true,
        InfoBases: [{ LevelId: 3, Code: 'EL_CAM' }],
      },
      {
        Code: 'RS_FIBER',
        Desc: 'Đứt dây thuê bao ngoài trời',
        Enabled: true,
        InfoBases: [{ LevelId: 3, Code: 'EL_ONT' }],
      },
    ],
  },
  ProcessingDiretions: {
    Infos: [
      {
        Code: 'DIR_SWAP_CAM',
        Desc: 'Đổi Camera mới & Chuyển Cloud trên Partner',
        Enabled: true,
        LevelId: 4,
        InfoBases: [{ LevelId: 4, Code: 'RS_CAM_HW' }],
      },
      {
        Code: 'DIR_SPLICE',
        Desc: 'Hàn nối lại cáp thuê bao',
        Enabled: true,
        LevelId: 4,
        InfoBases: [{ LevelId: 4, Code: 'RS_FIBER' }],
      },
    ],
  },
};

function buildDemoMaintenanceState(contractId = 'SGN123456', selectedSupId = 0) {
  const cleanContract = normalizeContractId(contractId) || 'SGN123456';
  const objId = 2000001;
  const rawList = {
    splist: [
      {
        id: 880101,
        objid: objId,
        createby: 'demo.cskh',
        createdate: '2026-06-14T09:00:00',
        finishdate: '2026-06-14T14:30:00',
        finalstatus: 1,
        flag: 0,
        description: 'Kiểm tra suy hao quang định kỳ',
        initdesc: 'Mất kết nối Internet',
        supportlocation: '100 Đường Mẫu A, Phường Bến Nghé, TP.HCM',
        popcode: 'POP-DEMO-01',
        grouppoints: 'GP-DEMO-01',
        odccabletype: 'GP-DEMO-01/1',
        deptid: 10,
      },
      {
        id: 880202,
        objid: objId,
        createby: 'demo.cskh',
        createdate: '2026-11-26T08:15:00',
        finishdate: null,
        finalstatus: 10,
        flag: 1,
        description: 'Khách hàng báo Camera ngoại tuyến, yêu cầu kiểm tra đổi thiết bị',
        initdesc: 'Camera ngoại tuyến',
        supportlocation: '100 Đường Mẫu A, Phường Bến Nghé, TP.HCM',
        popcode: 'POP-DEMO-01',
        grouppoints: 'GP-DEMO-01',
        odccabletype: 'GP-DEMO-01/1',
        deptid: 10,
        urgentnew: 0,
        nonsethifpt: 0,
        link1: '',
        link2: '',
        lengthlink: 0,
      },
    ],
    splistdetail: [
      {
        supportlistid: 880101,
        locationid: 4,
        partnerid: 10,
        blockname: 'Block Demo 1',
      },
      {
        supportlistid: 880202,
        locationid: 4,
        partnerid: 10,
        blockname: 'Block Demo 1',
        reprename: 'Nguyễn Văn Mẫu',
        reprerelation: 'Chính chủ',
        reprephone: '0901234567',
        reasonincable: 0,
        reasonmybaounacceptance: 2,
      },
    ],
    maintenance_appointment: [
      {
        supid: 880202,
        timezoneblue: '08:00 - 10:00',
        appointmentdateblue: '2026-11-26T10:00:00',
        appointmenttimes: 1,
        appointmenttimestinpn: 0,
      },
    ],
    maintenance_assignment: [
      {
        supid: 880101,
        empstatus: 1,
        accountemp: 'demo.ktv1',
        codeemp: 'KTV001',
        empphone: '0900000001',
        blocknameemp: 'Block Demo 1',
        deptid: 10,
      },
      {
        supid: 880202,
        empstatus: 1,
        accountemp: 'demo.ktv',
        codeemp: 'KTV002',
        empphone: '0900000002',
        blocknameemp: 'Block Demo 1',
        deptid: 10,
      },
    ],
  };

  const contract = normalizeMaintenanceContract({
    objid: objId,
    contract: cleanContract,
    fullname: 'Khách hàng Bảo Trì Mẫu',
    location: '100 Đường Mẫu A, Phường Bến Nghé, TP.HCM',
    status: 1,
    localtypedesc: 'Internet + FPT Camera (Mẫu)',
    locationphone: '0901234567',
    locationid: 4,
    grouppoints: 'GP-DEMO-01',
    odccabletype: 'GP-DEMO-01/1',
  });

  const tickets = normalizeMaintenanceTicketList(
    rawList,
    cleanContract,
    DEMO_MAINT_COMBO_CONFIG,
    DEMO_MAINT_TICKET_STATUS_CFG
  );
  const ticket = selectActiveMaintenanceTicket(tickets, selectedSupId);
  const materials = normalizeMaintenanceMaterials({
    lstUse: [
      {
        ID: 1,
        CodeID: 4906,
        EQuipmentName: 'FCAM-IQ 3S [1]',
        DBName: 'FCAM-IQ 3S',
        FunctionName: 'FPT Camera',
        Quantity: 1,
        MacAddress: 'DEMO-CAM-NEW-0001',
        Type: 96,
        ParentName: 'FPT Camera',
        ParentOrder: 1,
        CheckReplace: 0,
        IsMac: 1,
        CauseReturn: 0,
        IsReturn: 2,
      },
    ],
    lstReturn: [
      {
        ID: 2,
        CodeID: 4907,
        EQuipmentName: 'FCAM-IQ 4S [1]',
        DBName: 'FCAM-IQ 4S',
        FunctionName: '',
        Quantity: 1,
        MacAddress: 'DEMO-CAM-OLD-0001',
        Type: 96,
        ParentName: 'FPT Camera',
        ParentOrder: 1,
        CheckReplace: 0,
        IsMac: 1,
        CauseReturn: 0,
        IsReturn: 1,
      },
    ],
  });

  return {
    contract,
    tickets,
    ticket,
    materials,
    urls: buildMaintenanceTicketUrls('demo_bt_token'),
  };
}

// --- Tang giao tiep HTTP JSON cho FOX-ERP /app/tkbt/bt ---

async function maintRequestJson(
  url,
  bodyObj = null,
  { method = 'POST', timeout = 15000, loginUrl = MAINT_ENDPOINTS.foxTicketPage } = {}
) {
  const headers = { Accept: 'application/json' };
  let data = null;
  if (method !== 'GET' && bodyObj !== null && bodyObj !== undefined) {
    headers['Content-Type'] = 'application/json';
    data = typeof bodyObj === 'string' ? bodyObj : JSON.stringify(bodyObj);
  }

  const res = await requestPortal({
    url,
    method,
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
      message: 'Máy chủ trả về trang đăng nhập thay vì JSON. Vui lòng đăng nhập IAM lại.',
      loginUrl,
    };
  }

  const json = maintSafeJsonParse(rawText);
  if (json === null || (typeof json !== 'object' && !Array.isArray(json))) {
    return {
      status: 'error',
      message: `Phản hồi không đúng định dạng JSON (HTTP ${res.status}).`,
      httpStatus: res.status,
      loginUrl,
    };
  }

  return { status: 'ok', httpStatus: res.status, json, loginUrl };
}

async function maintWarmupAndRetryJson(url, bodyObj, warmupUrl, opts = {}) {
  const first = await maintRequestJson(url, bodyObj, opts);
  if (first.status !== 'iam_expired' || !warmupUrl) {
    return first;
  }
  if (canWarmPortalSession()) {
    await warmPortalSession(warmupUrl, { timeout: 12000 });
  } else {
    await requestPortal({ url: warmupUrl, method: 'GET', timeout: 10000 });
  }
  return maintRequestJson(url, bodyObj, opts);
}

function maintBuildContractMicroQuery(contractId) {
  const escaped = String(contractId || '').replace(/"/g, '\\"');
  return `{ maintenancecontract ( contract:"${escaped}" ){ ${MAINT_CONTRACT_FIELDS.join(',')} } }`;
}

function maintBuildCoreContractQuery(contractId) {
  const escaped = String(contractId || '').replace(/"/g, '\\"');
  return `query{contractInfo(contractNo:"${escaped}"){contractId,contractNo,status,createBy,name,fullName,fullNameVn,startDate,firstAccess,localType,localTypeDesc,branchCode,locationId,location,locationName,locationNumber,locationStreet,locationWard,locationDistrict,macstb,groupPoints,odccableType,locationPhone,email,type,macaddress,idclength,odclength},objPhones(contractNo:"${escaped}"){contractNo,contractId,type,phone},customerVips(contractNo:"${escaped}"){contractNo,contractId,typeVip,status}}`;
}

function maintNormalizeCoreFallbackContract(coreData, contractId) {
  const ci = (coreData && coreData.contractInfo) || null;
  if (!ci) return null;
  const vips = Array.isArray(coreData.customerVips) ? coreData.customerVips : [];
  const activeVips = vips.filter((v) => v && Number(v.status) === 1).map((v) => Number(v.typeVip ?? 0));
  return normalizeMaintenanceContract({
    objid: ci.contractId ?? 0,
    contract: ci.contractNo || contractId,
    fullname: ci.fullName || '',
    fullnamevn: ci.fullNameVn || '',
    name: ci.name || '',
    status: ci.status ?? 0,
    firstaccess: ci.firstAccess || '',
    localtype: ci.localType ?? 0,
    localtypedesc: ci.localTypeDesc || '',
    branchcode: ci.branchCode ?? 0,
    locationid: ci.locationId ?? 0,
    location: ci.location || '',
    locationphone: ci.locationPhone || '',
    grouppoints: ci.groupPoints || '',
    odccabletype: ci.odccableType || '',
    macaddress: ci.macaddress || '',
    idclength: ci.idclength ?? 0,
    odclength: ci.odclength ?? 0,
    isvip: activeVips.length ? Math.max(...activeVips) : 0,
    objphone: coreData.objPhones || [],
  });
}

/**
 * Tai thong tin chi tiet (vat tu, loi ban dau, ghi chu, BBNT, hoan ung) cho 1 phieu bao tri cu the.
 */
export async function fetchMaintenanceTicketDetail({
  objId = 0,
  supId = 0,
  ticket = null,
  forceDemo = false,
} = {}) {
  if (!isUserscriptEnv() || forceDemo) {
    const demo = buildDemoMaintenanceState(
      (ticket && ticket.raw && ticket.raw.Contract) || 'SGN123456',
      supId
    );
    return {
      status: 'ok',
      mode: 'demo',
      materials: demo.materials,
      initAndErrors: [
        {
          ServiceCode: '96',
          InitStatusCode: '9601',
          ErrorElementCode: 'EL_CAM',
          ErrorReasonCode: 'RS_CAM_HW',
          ProcessingDiretions: [{ ProcessingDiretionCode: 'DIR_SWAP_CAM', LevelId: 4 }],
        },
      ],
      discussions: [
        {
          Code: MAINT_DISCUSSION_CODES.TICKET_NOTE,
          CreateBy: 'demo.cskh',
          CreateAt: '2026-11-26 08:20:00',
          Note: 'Khách hàng báo Camera ngoại tuyến (Mẫu)',
        },
      ],
      reimbursementStatus: 0,
      bbntRecords: [
        {
          SupId: Number(supId || 880202),
          Code: 'BT-BBNT-DEMO-01',
          Name: 'Biên bản nghiệm thu Bảo trì',
          CreateDate: '26/11/2026 08:30:00',
          StatusRender: 1,
          Confirm: false,
        },
      ],
    };
  }

  const numObjId = Number(objId || (ticket && ticket.objId) || 0);
  const numSupId = Number(supId || (ticket && ticket.supId) || 0);
  if (!numObjId || !numSupId) {
    return {
      status: 'ok',
      mode: 'live',
      materials: normalizeMaintenanceMaterials({}),
      initAndErrors: [],
      discussions: [],
      reimbursementStatus: 0,
      bbntRecords: [],
    };
  }

  const [eqRes, initErrRes, discRes, reimbRes, bbntRes] = await Promise.allSettled([
    maintRequestJson(MAINT_ENDPOINTS.getTicketEquipments, { ObjId: numObjId, SupId: numSupId }),
    maintRequestJson(MAINT_ENDPOINTS.getInitAndErrorByTicket, {
      ObjId: numObjId,
      SupId: numSupId,
      Request: 1,
    }),
    maintRequestJson(MAINT_ENDPOINTS.getDiscussionByCode, {
      objId: numObjId,
      supId: numSupId,
      Codes: [
        MAINT_DISCUSSION_CODES.TICKET_NOTE,
        MAINT_DISCUSSION_CODES.ERROR_REASON_DESC,
        MAINT_DISCUSSION_CODES.CUSTOMER_URGENT,
      ],
    }),
    maintRequestJson(MAINT_ENDPOINTS.getReimbursementStatusNextGen, {
      supId: numSupId,
      objId: numObjId,
    }),
    maintRequestJson(MAINT_ENDPOINTS.getListRecordTicket, { ObjId: numObjId }),
  ]);

  let reimbVal =
    reimbRes.status === 'fulfilled' && reimbRes.value && reimbRes.value.status === 'ok'
      ? Number(reimbRes.value.json?.data ?? reimbRes.value.json?.Data ?? 0)
      : NaN;
  if (!Number.isFinite(reimbVal)) {
    const fb = await maintRequestJson(MAINT_ENDPOINTS.getReimbursementStatus, {
      supId: numSupId,
      objId: numObjId,
    });
    reimbVal = fb.status === 'ok' ? Number(fb.json?.data ?? fb.json?.Data ?? 0) || 0 : 0;
  }

  const eqData =
    eqRes.status === 'fulfilled' && eqRes.value && eqRes.value.status === 'ok'
      ? eqRes.value.json?.Data || {}
      : {};
  const initData =
    initErrRes.status === 'fulfilled' && initErrRes.value && initErrRes.value.status === 'ok'
      ? initErrRes.value.json?.Data || []
      : [];
  const discData =
    discRes.status === 'fulfilled' && discRes.value && discRes.value.status === 'ok'
      ? discRes.value.json?.Data || []
      : [];
  const bbntAll =
    bbntRes.status === 'fulfilled' && bbntRes.value && bbntRes.value.status === 'ok'
      ? bbntRes.value.json?.Data || []
      : [];

  return {
    status: 'ok',
    mode: 'live',
    materials: normalizeMaintenanceMaterials(eqData),
    initAndErrors: Array.isArray(initData) ? initData : [],
    discussions: Array.isArray(discData) ? discData : [],
    reimbursementStatus: reimbVal,
    bbntRecords: Array.isArray(bbntAll)
      ? bbntAll.filter((r) => r && Number(r.SupId) === numSupId)
      : [],
  };
}

/**
 * Tai day du thong tin Phieu bao tri tu Partner & FOX-ERP (tu fallback sang Micro/Core + Encrypt neu Partner khong co /bt/ticket).
 */
export async function fetchMaintenanceTicket(
  contractId = '',
  { pageLocation = null, selectedSupId = 0, cachedObjId = 0, forceDemo = false } = {}
) {
  const cleanContract = normalizeContractId(contractId);

  if (!isUserscriptEnv() || forceDemo) {
    const demo = buildDemoMaintenanceState(cleanContract || 'SGN123456', selectedSupId);
    const detail = await fetchMaintenanceTicketDetail({
      objId: demo.contract.objId,
      supId: demo.ticket ? demo.ticket.supId : 0,
      ticket: demo.ticket,
      forceDemo: true,
    });
    return {
      status: 'ok',
      mode: 'demo',
      hash: 'demo_bt_token',
      foxTicketUrl: demo.urls.foxUrl,
      partnerTicketUrl: demo.urls.partnerUrl,
      contract: demo.contract,
      userInfo: DEMO_MAINT_USER_INFO.Info,
      permissions: DEMO_MAINT_USER_INFO.Permissions.Permission.Maintenance,
      comboConfig: DEMO_MAINT_COMBO_CONFIG,
      ticketStatusCfg: DEMO_MAINT_TICKET_STATUS_CFG,
      catalogInit: DEMO_MAINT_CATALOG_INIT,
      contractProducts: [
        { ServiceId: 1, ServiceName: 'Internet' },
        { ServiceId: 96, ServiceName: 'FPT Camera' },
      ],
      tickets: demo.tickets,
      ticket: demo.ticket,
      materials: detail.materials,
      initAndErrors: detail.initAndErrors,
      discussions: detail.discussions,
      reimbursementStatus: detail.reimbursementStatus,
      bbntRecords: detail.bbntRecords,
    };
  }

  let hash = '';
  let resolvedContract = cleanContract;
  let objId = Number(cachedObjId || 0);
  let contract = null;

  if (!cleanContract) {
    hash = extractMaintenanceHashFromLocation(pageLocation);
    if (!hash) {
      return {
        status: 'error',
        message: 'Vui lòng nhập Mã hợp đồng trước khi mở Phiếu bảo trì.',
      };
    }
    const decRes = await maintWarmupAndRetryJson(
      MAINT_ENDPOINTS.decryptRequest,
      { Q: hash },
      MAINT_ENDPOINTS.foxTicketPage,
      { loginUrl: MAINT_ENDPOINTS.foxTicketPage }
    );
    if (decRes.status !== 'ok') {
      return {
        status: decRes.status,
        message: decRes.message,
        loginUrl: MAINT_ENDPOINTS.foxTicketPage,
        loginLabel: 'Đăng nhập FOX-ERP',
      };
    }
    const parsed = maintSafeJsonParse(decRes.json?.Data);
    if (!parsed || !parsed.Contract) {
      return {
        status: 'error',
        message: 'Không giải mã được thông tin hợp đồng từ liên kết phiếu bảo trì.',
      };
    }
    resolvedContract = normalizeContractId(parsed.Contract);
    objId = Number(parsed.ObjId || 0);
  } else {
    const partnerRes = await maintWarmupAndRetryJson(
      MAINT_ENDPOINTS.partnerGetContract,
      { Contract: cleanContract },
      MAINT_ENDPOINTS.partnerMonitor,
      { loginUrl: MAINT_ENDPOINTS.partnerMonitor }
    );
    if (partnerRes.status !== 'ok') {
      return {
        status: partnerRes.status,
        message: partnerRes.message,
        loginUrl: MAINT_ENDPOINTS.partnerMonitor,
        loginLabel: 'Đăng nhập Partner',
      };
    }
    const linkInfo = extractMaintenanceTicketLink(partnerRes.json?.Data);
    if (linkInfo.found) {
      hash = linkInfo.hash;
      const decRes = await maintWarmupAndRetryJson(
        MAINT_ENDPOINTS.decryptRequest,
        { Q: hash },
        linkInfo.url || MAINT_ENDPOINTS.foxTicketPage,
        { loginUrl: MAINT_ENDPOINTS.foxTicketPage }
      );
      if (decRes.status !== 'ok') {
        return {
          status: decRes.status,
          message: decRes.message,
          loginUrl: MAINT_ENDPOINTS.foxTicketPage,
          loginLabel: 'Đăng nhập FOX-ERP',
        };
      }
      const parsed = maintSafeJsonParse(decRes.json?.Data);
      if (parsed && parsed.ObjId) {
        objId = Number(parsed.ObjId);
      }
      if (parsed && parsed.Contract) {
        resolvedContract = normalizeContractId(parsed.Contract);
      }
    }
  }

  // Tai thong tin hop dong tu FOX-ERP (neu chua co ObjId hoac de hien day du thong tin khach hang)
  const microRes = await maintWarmupAndRetryJson(
    MAINT_ENDPOINTS.getContractFromMicro,
    { query: maintBuildContractMicroQuery(resolvedContract) },
    MAINT_ENDPOINTS.foxTicketPage,
    { loginUrl: MAINT_ENDPOINTS.foxTicketPage }
  );
  if (microRes.status === 'iam_expired' || microRes.status === 'offline') {
    return {
      status: microRes.status,
      message: microRes.message,
      loginUrl: MAINT_ENDPOINTS.foxTicketPage,
      loginLabel: 'Đăng nhập FOX-ERP',
    };
  }
  const microRows = microRes.status === 'ok' ? microRes.json?.Data?.maintenancecontract : null;
  if (Array.isArray(microRows) && microRows.length > 0) {
    contract = normalizeMaintenanceContract(
      { ContractFromMicro: microRes.json.Data },
      { Contract: resolvedContract, ObjId: objId }
    );
    if (!objId && contract.objId) objId = contract.objId;
  } else {
    const coreRes = await maintRequestJson(MAINT_ENDPOINTS.getContractInfo, {
      query: maintBuildCoreContractQuery(resolvedContract),
    });
    if (coreRes.status === 'ok' && coreRes.json?.data) {
      contract = maintNormalizeCoreFallbackContract(coreRes.json.data, resolvedContract);
      if (contract && !objId && contract.objId) objId = contract.objId;
    }
  }

  if (!contract) {
    contract = normalizeMaintenanceContract({}, { Contract: resolvedContract, ObjId: objId });
  }
  if (!objId) {
    return {
      status: 'error',
      message: `Không tìm thấy thông tin ObjId / Phiếu bảo trì cho hợp đồng ${resolvedContract}.`,
    };
  }

  // Neu Partner khong tra ve ?q= (vi du phieu da hoan tat), goi /api/generals/encrypt de tao q dung chuan
  if (!hash) {
    const encRes = await maintRequestJson(
      MAINT_ENDPOINTS.encryptGeneral,
      JSON.stringify({ Id: 0, ObjId: objId, Contract: resolvedContract })
    );
    if (encRes.status === 'ok' && encRes.json?.Data) {
      hash = String(encRes.json.Data).trim();
    }
  }

  const [userRes, comboRes, statusCfgRes, listRes, catInitRes, prodRes] = await Promise.allSettled([
    maintRequestJson(MAINT_ENDPOINTS.userInfo, null, { method: 'POST' }),
    maintRequestJson(MAINT_ENDPOINTS.loadComboConfig, {}),
    maintRequestJson(MAINT_ENDPOINTS.getTicketStatus, {}),
    maintRequestJson(MAINT_ENDPOINTS.getListContractInfo, {
      objId,
      contract: resolvedContract,
      supId: objId,
    }),
    maintRequestJson(MAINT_ENDPOINTS.catalogGetInfoInit, { ObjId: 0, IsGetAll: true }),
    maintRequestJson(MAINT_ENDPOINTS.getContractProduct, {
      query: `query { contractProducts(contractId: ${objId}) { contractId, contractNo, productId, productName } }`,
    }),
  ]);

  const userJson =
    userRes.status === 'fulfilled' && userRes.value?.status === 'ok' ? userRes.value.json : null;
  const comboConfig =
    comboRes.status === 'fulfilled' && comboRes.value?.status === 'ok'
      ? comboRes.value.json?.Data || comboRes.value.json || []
      : [];
  const ticketStatusCfg =
    statusCfgRes.status === 'fulfilled' && statusCfgRes.value?.status === 'ok'
      ? statusCfgRes.value.json?.Data || {}
      : {};
  const listRaw =
    listRes.status === 'fulfilled' && listRes.value?.status === 'ok'
      ? listRes.value.json?.Data || {}
      : {};
  const catalogInit =
    catInitRes.status === 'fulfilled' && catInitRes.value?.status === 'ok'
      ? catInitRes.value.json?.Data || {}
      : {};
  const prodRaw =
    prodRes.status === 'fulfilled' && prodRes.value?.status === 'ok'
      ? prodRes.value.json?.data?.contractProducts || []
      : [];

  const tickets = normalizeMaintenanceTicketList(
    listRaw,
    resolvedContract,
    Array.isArray(comboConfig) ? comboConfig : [],
    ticketStatusCfg
  );
  const ticket = selectActiveMaintenanceTicket(tickets, selectedSupId);

  const detail = ticket
    ? await fetchMaintenanceTicketDetail({
        objId: ticket.objId || objId,
        supId: ticket.supId,
        ticket,
        forceDemo: false,
      })
    : {
        materials: normalizeMaintenanceMaterials({}),
        initAndErrors: [],
        discussions: [],
        reimbursementStatus: 0,
        bbntRecords: [],
      };

  const urls = buildMaintenanceTicketUrls(hash);

  return {
    status: 'ok',
    mode: 'live',
    hash,
    foxTicketUrl: urls.foxUrl || MAINT_ENDPOINTS.foxTicketPage,
    partnerTicketUrl: urls.partnerUrl || MAINT_ENDPOINTS.partnerTicketPage,
    contract,
    userInfo: (userJson && userJson.Info) || null,
    permissions: (userJson && userJson.Permissions && userJson.Permissions.Permission && userJson.Permissions.Permission.Maintenance) || {},
    comboConfig: Array.isArray(comboConfig) ? comboConfig : [],
    ticketStatusCfg,
    catalogInit,
    contractProducts: Array.isArray(prodRaw)
      ? prodRaw.map((p) => ({ ServiceId: p.productId, ServiceName: p.productName }))
      : [],
    tickets,
    ticket,
    materials: detail.materials,
    initAndErrors: detail.initAndErrors,
    discussions: detail.discussions,
    reimbursementStatus: detail.reimbursementStatus,
    bbntRecords: detail.bbntRecords,
  };
}

/**
 * Tai danh muc vat tu, kho MAC KTV (macPartners / macUseds), lich su MAC Camera & phien online Modem.
 */
export async function fetchMaintenanceMaterialCatalogs({
  objId = 0,
  supId = 0,
  locationId = 0,
  accountEmp = '',
  forceDemo = false,
} = {}) {
  if (!isUserscriptEnv() || forceDemo) {
    return {
      status: 'ok',
      mode: 'demo',
      equipInfos: DEMO_MAINT_EQUIP_INFOS.slice(),
      macPartners: [
        { id: 4906, mac: 'DEMO-CAM-NEW-0001' },
        { id: 4906, mac: 'DEMO-CAM-NEW-0002' },
        { id: 101, mac: '00:11:22:33:44:66' },
      ],
      macUseds: [
        { id: 4907, mac: 'DEMO-CAM-OLD-0001' },
        { id: 4907, mac: 'DEMO-CAM-OLD-0002' },
      ],
      camHistoryMacs: ['DEMO-CAM-OLD-0001', 'DEMO-CAM-OLD-0002'],
      modemCallerId: '00:11:22:33:44:55',
    };
  }

  const numObjId = Number(objId || 0);
  const numSupId = Number(supId || 0);
  const numLoc = Number(locationId || 0);
  const emp = String(accountEmp || '').trim();

  async function fetchCamHistory(baseUrl) {
    const qUrl = `${baseUrl}?ObjId=${encodeURIComponent(numObjId)}`;
    const g = await maintRequestJson(qUrl, null, { method: 'GET' });
    if (g.status === 'ok') {
      const arr = Array.isArray(g.json?.data) ? g.json.data : Array.isArray(g.json?.Data) ? g.json.Data : Array.isArray(g.json) ? g.json : [];
      if (arr.length > 0) return arr;
    }
    const p = await maintRequestJson(baseUrl, { ObjId: numObjId }, { method: 'POST' });
    if (p.status === 'ok') {
      return Array.isArray(p.json?.data) ? p.json.data : Array.isArray(p.json?.Data) ? p.json.Data : [];
    }
    return [];
  }

  const [infosRes, exportRes, ottRes, comboRes, onlineRes] = await Promise.allSettled([
    maintRequestJson(MAINT_ENDPOINTS.getEquipmentInfos, {
      ParentName: '',
      IsReturn: -1,
      IsMac: -1,
      SaleClub: 0,
    }),
    maintRequestJson(MAINT_ENDPOINTS.getEquipmentExport, {
      LocationId: numLoc,
      ObjId: numObjId,
      SupId: numSupId,
      AccountEmp: emp,
      TypeId: 2,
    }),
    fetchCamHistory(MAINT_ENDPOINTS.getMacHistoryCameraOtt),
    fetchCamHistory(MAINT_ENDPOINTS.getMacHistoryCameraCombo),
    maintRequestJson(MAINT_ENDPOINTS.checkOnlineSession, { objId: numObjId }),
  ]);

  const rawInfos =
    infosRes.status === 'fulfilled' && infosRes.value?.status === 'ok'
      ? infosRes.value.json?.data || infosRes.value.json?.Data || []
      : [];
  const equipInfos = Array.isArray(rawInfos)
    ? rawInfos.map((e) => ({
        IdCode: Number(e.id ?? e.IdCode ?? 0),
        Name: String(e.name ?? e.Name ?? '').trim(),
        Description: String(e.description ?? e.Description ?? '').trim(),
        Type: Number(e.type ?? e.Type ?? 0),
        ParentName: String(e.parentName ?? e.ParentName ?? '').trim(),
        ReturnType: Number(e.returnType ?? e.ReturnType ?? 0),
        IsMac: Number(e.isMac ?? e.IsMac ?? 0),
        UnitName: String(e.unitName ?? e.UnitName ?? '').trim(),
        Enabled: (e.enabled ?? e.Enabled) == 1 || e.enabled === true,
      }))
    : [];

  let macExportData =
    exportRes.status === 'fulfilled' && exportRes.value?.status === 'ok'
      ? exportRes.value.json?.data || exportRes.value.json?.Data || {}
      : {};
  let macPartners = Array.isArray(macExportData.macPartners) ? macExportData.macPartners : [];
  let macUseds = Array.isArray(macExportData.macUseds) ? macExportData.macUseds : [];

  if (macPartners.length === 0 && macUseds.length === 0) {
    const fbMac = await maintRequestJson(MAINT_ENDPOINTS.getEquipmentMac, {
      LocationId: numLoc,
      AccountEmp: emp,
      ObjId: numObjId,
      SupListId: numSupId,
    });
    if (fbMac.status === 'ok') {
      const fbData = fbMac.json?.data || fbMac.json?.Data || {};
      macPartners = Array.isArray(fbData.macPartners) ? fbData.macPartners : [];
      macUseds = Array.isArray(fbData.macUseds) ? fbData.macUseds : [];
    }
  }

  const ottList = ottRes.status === 'fulfilled' && Array.isArray(ottRes.value) ? ottRes.value : [];
  const comboList =
    comboRes.status === 'fulfilled' && Array.isArray(comboRes.value)
      ? comboRes.value.map((c) => (typeof c === 'string' ? c : c && (c.SerialNumber || c.mac || ''))).filter(Boolean)
      : [];
  const camIdCodes = new Set(equipInfos.filter((e) => e.ParentName === 'FPT Camera').map((e) => e.IdCode));
  const usedCamMacs = macUseds.filter((u) => u && camIdCodes.has(Number(u.id))).map((u) => u.mac || '').filter(Boolean);
  const camHistoryMacs = [...new Set([...ottList, ...comboList, ...usedCamMacs].map((s) => String(s || '').trim()).filter(Boolean))];

  const onlineData =
    onlineRes.status === 'fulfilled' && onlineRes.value?.status === 'ok'
      ? onlineRes.value.json?.Data?.[0] || null
      : null;

  return {
    status: 'ok',
    mode: 'live',
    equipInfos,
    macPartners,
    macUseds,
    camHistoryMacs,
    modemCallerId: String((onlineData && onlineData.CallerID) || '').trim(),
  };
}

/**
 * Luu dieu chinh vat tu su dung & vat tu thu hoi len /api/materials/update-equipment.
 */
export async function updateMaintenanceEquipments({
  objId = 0,
  supId = 0,
  locationId = 0,
  logonUser = '',
  lstUse = [],
  lstReturn = [],
  forceDemo = false,
} = {}) {
  const check = validateMaintenanceMaterials({
    objId,
    supId,
    locationId,
    logonUser,
    lstUse,
    lstReturn,
  });
  if (!check.valid) {
    return { status: 'validation_error', message: check.error };
  }

  if (!isUserscriptEnv() || forceDemo) {
    const normalized = normalizeMaintenanceMaterials({ lstUse, lstReturn });
    return {
      status: 'ok',
      mode: 'demo',
      message: 'Cập nhật vật tư thành công! (Mô phỏng)',
      materials: normalized,
      payload: check.payload,
    };
  }

  const res = await maintRequestJson(MAINT_ENDPOINTS.updateEquipment, check.payload);
  if (res.status !== 'ok') return res;

  const j = res.json || {};
  const ok = Number(j.Data ?? j.data ?? 0) > 0 || j.Succeeded === true;
  if (!ok) {
    return {
      status: 'error',
      message: j.Message || j.message || 'Cập nhật vật tư không thành công.',
    };
  }
  return {
    status: 'ok',
    mode: 'live',
    message: j.Message || 'Cập nhật vật tư thành công!',
  };
}

/**
 * Tai danh muc Phan tu loi / Nguyen nhan loi / Huong xu ly cho ma dich vu.
 */
export async function fetchMaintenanceErrorCatalog({
  objId = 0,
  supId = 0,
  serviceCodes = [],
  forceDemo = false,
} = {}) {
  if (!isUserscriptEnv() || forceDemo) {
    return { status: 'ok', mode: 'demo', data: DEMO_MAINT_ERROR_CATALOG };
  }

  const codes = (Array.isArray(serviceCodes) ? serviceCodes : [serviceCodes])
    .map((c) => Number(c))
    .filter((n) => Number.isFinite(n) && n > 0);
  const res = await maintRequestJson(MAINT_ENDPOINTS.getInfoErrorComplete, {
    ObjId: Number(objId || 0),
    SupId: Number(supId || 0),
    Request: 1,
    IsGetAll: true,
    ServiceCodes: codes,
  });
  if (res.status !== 'ok') return res;
  const j = res.json || {};
  if (j.Succeeded === false || j.error === true) {
    return { status: 'error', message: j.Message || 'Không tải được danh mục nguyên nhân lỗi.' };
  }
  return { status: 'ok', mode: 'live', data: j.Data || {} };
}

/**
 * Cap nhat ghi nhan ban dau (/api/origins/update-service-init).
 */
export async function updateMaintenanceServiceInit({
  supId = 0,
  accountModify = '',
  dataUpdates = [],
  forceDemo = false,
} = {}) {
  const uniquePairs = [];
  const seen = new Set();
  for (const row of Array.isArray(dataUpdates) ? dataUpdates : []) {
    const svc = String(row?.ServiceCode || '').trim();
    const init = String(row?.InitStatusCode || '').trim();
    if (!svc || !init) continue;
    const key = `${svc},${init}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniquePairs.push({ ServiceCode: svc, InitStatusCode: init });
    }
  }
  if (uniquePairs.length === 0) {
    return { status: 'validation_error', message: 'Vui lòng chọn ít nhất 1 Dịch vụ & Tình trạng ban đầu.' };
  }

  const body = {
    Request: 1,
    SupId: Number(supId || 0),
    AccountModify: String(accountModify || '').trim(),
    Dataupdates: uniquePairs,
  };

  if (!isUserscriptEnv() || forceDemo) {
    return { status: 'ok', mode: 'demo', message: 'Cập nhật ghi nhận ban đầu thành công! (Mô phỏng)', body };
  }

  const res = await maintRequestJson(MAINT_ENDPOINTS.updateServiceInit, body);
  if (res.status !== 'ok') return res;
  const j = res.json || {};
  if (!(j.Succeeded === true || Number(j.Data ?? 0) === 1)) {
    return { status: 'error', message: j.Message || 'Cập nhật ghi nhận ban đầu thất bại.' };
  }
  return { status: 'ok', mode: 'live', message: 'Cập nhật ghi nhận ban đầu thành công!' };
}

/**
 * Cap nhat Phan tu loi / Nguyen nhan loi / Huong xu ly (/api/contracts/ticket-update-error-complete).
 */
export async function updateMaintenanceErrorComplete({
  objId = 0,
  supId = 0,
  updateBy = '',
  dataUpdates = [],
  forceDemo = false,
} = {}) {
  const rows = Array.isArray(dataUpdates) ? dataUpdates : [];
  if (rows.length === 0) {
    return { status: 'validation_error', message: 'Chưa có dòng dịch vụ / nguyên nhân lỗi nào để cập nhật.' };
  }

  const body = {
    ObjId: Number(objId || 0),
    SupId: Number(supId || 0),
    Request: 5,
    UpdateBy: String(updateBy || '').trim(),
    DataUpdates: rows.map((r) => ({
      ServiceCode: String(r.ServiceCode || ''),
      InitStatusCode: String(r.InitStatusCode || ''),
      ErrorElementCode: String(r.ErrorElementCode || ''),
      ErrorReasonCode: String(r.ErrorReasonCode || ''),
      ProcessingDiretions: Array.isArray(r.ProcessingDiretions)
        ? r.ProcessingDiretions.map((d) => ({
            ProcessingDiretionCode: String(d.ProcessingDiretionCode || d.Code || ''),
            LevelId: Number(d.LevelId ?? d.Value ?? 4),
          }))
        : [],
    })),
  };

  if (!isUserscriptEnv() || forceDemo) {
    return { status: 'ok', mode: 'demo', message: 'Cập nhật nguyên nhân lỗi thành công! (Mô phỏng)', body };
  }

  const res = await maintRequestJson(MAINT_ENDPOINTS.ticketUpdateErrorComplete, body);
  if (res.status !== 'ok') return res;
  const j = res.json || {};
  if (!(Number(j.Data ?? 0) === 1 || j.Succeeded === true)) {
    return { status: 'error', message: j.Message || 'Cập nhật nguyên nhân lỗi thất bại.' };
  }
  return { status: 'ok', mode: 'live', message: 'Cập nhật nguyên nhân lỗi thành công!' };
}

/**
 * Gui ghi chu moi len phieu bao tri (/api/contracts/update-discussion).
 */
export async function addMaintenanceDiscussion({
  objId = 0,
  supId = 0,
  logonUser = '',
  newDescription = '',
  code = MAINT_DISCUSSION_CODES.TICKET_NOTE,
  forceDemo = false,
} = {}) {
  const cleanNote = String(newDescription || '').trim();
  if (!cleanNote) {
    return { status: 'validation_error', message: 'Vui lòng nhập nội dung ghi chú.' };
  }

  const body = {
    SupId: Number(supId || 0),
    ObjId: Number(objId || 0),
    LogonUser: String(logonUser || '').trim(),
    NewDescription: cleanNote,
    Code: String(code || MAINT_DISCUSSION_CODES.TICKET_NOTE),
  };

  if (!isUserscriptEnv() || forceDemo) {
    return {
      status: 'ok',
      mode: 'demo',
      message: 'Đã thêm ghi chú (Mô phỏng).',
      item: {
        Code: body.Code,
        CreateBy: body.LogonUser || 'demo.ktv',
        CreateAt: 'Vừa xong',
        Note: body.NewDescription,
      },
    };
  }

  const res = await maintRequestJson(MAINT_ENDPOINTS.updateDiscussion, body);
  if (res.status !== 'ok') return res;
  const j = res.json || {};
  if (!(Number(j.Data ?? j.data ?? 0) === 1 || j.Succeeded === true)) {
    return { status: 'error', message: j.Message || 'Không gửi được ghi chú.' };
  }
  return { status: 'ok', mode: 'live', message: 'Đã thêm ghi chú lên phiếu!' };
}

/**
 * Cap nhat Thong tin bao tri, Dai dien, hoac Dong / Cap nhat ket qua xu ly (/api/contracts/ticket-update-and-complete).
 */
export async function updateMaintenanceTicketInfoAndStatus(params = {}) {
  if (params.reprePhone !== undefined) {
    const phoneCheck = validateMaintenanceRepPhone(params.reprePhone);
    if (!phoneCheck.valid) {
      return { status: 'validation_error', message: phoneCheck.error };
    }
    params = { ...params, reprePhone: phoneCheck.cleaned };
  }

  const payload = buildMaintenanceUpdateAndCompletePayload(params);

  if (!isUserscriptEnv() || params.forceDemo) {
    return {
      status: 'ok',
      mode: 'demo',
      message: 'Cập nhật phiếu bảo trì thành công! (Mô phỏng)',
      payload,
    };
  }

  const res = await maintRequestJson(MAINT_ENDPOINTS.ticketUpdateAndComplete, payload);
  if (res.status !== 'ok') return res;
  const j = res.json || {};
  if (!(Number(j.Data ?? 0) === 1 || j.Succeeded === true)) {
    return { status: 'error', message: j.Message || 'Cập nhật không thành công.' };
  }
  return { status: 'ok', mode: 'live', message: j.Message || 'Cập nhật thành công!' };
}

/**
 * Tra tinh trang phieu bao tri da hoan tat (/api/maintenances/return-final-status).
 */
export async function returnMaintenanceTicketStatus({
  objId = 0,
  supId = 0,
  updateBy = '',
  forceDemo = false,
} = {}) {
  const body = {
    SupId: Number(supId || 0),
    ObjId: Number(objId || 0),
    Final_Status: 0,
    UpdateBy: String(updateBy || '').trim(),
  };

  if (!isUserscriptEnv() || forceDemo) {
    return { status: 'ok', mode: 'demo', message: 'Trả tình trạng phiếu thành công! (Mô phỏng)', body };
  }

  const res = await maintRequestJson(MAINT_ENDPOINTS.returnFinalStatus, body);
  if (res.status !== 'ok') return res;
  const j = res.json || {};
  if (!(j.Succeeded === true && Number(j.Data ?? 0) === 1)) {
    return { status: 'error', message: j.Message || 'Trả tình trạng không thành công!' };
  }
  return { status: 'ok', mode: 'live', message: 'Trả tình trạng phiếu thành công!' };
}

/**
 * Dat phieu hien tai lam phieu cuoi (/api/implementfunctions/update-flag).
 */
export async function swapMaintenanceLastTicket({
  objId = 0,
  supId = 0,
  updateBy = '',
  forceDemo = false,
} = {}) {
  const body = {
    ObjId: Number(objId || 0),
    SupId: Number(supId || 0),
    UpdateBy: String(updateBy || '').trim(),
  };

  if (!isUserscriptEnv() || forceDemo) {
    return { status: 'ok', mode: 'demo', message: 'Đổi phiếu cuối thành công! (Mô phỏng)', body };
  }

  const res = await maintRequestJson(MAINT_ENDPOINTS.updateFlag, body);
  if (res.status !== 'ok') return res;
  const j = res.json || {};
  if (!(Number(j.Data ?? j.data ?? 0) >= 1 || j.Succeeded === true)) {
    return { status: 'error', message: j.Message || 'Đổi phiếu cuối không thành công.' };
  }
  return { status: 'ok', mode: 'live', message: 'Đã đặt làm phiếu cuối!' };
}

export { maintFoldText };
