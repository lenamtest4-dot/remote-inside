/**
 * Giao dien dieu khien Remote Inside (1 man hinh toi uu Android & MacBook).
 * Toan bo chuoi tu nguoi dung deu duoc gan bang textContent de dam bao an toan.
 */

import {
  IAM_SSO_TARGETS,
  PORTALS,
  PORTAL_ORDER,
  normalizeContractId,
  validateContractId,
} from '../config/portals.js';
import {
  DEFAULT_EQUIPMENT_DEBT_FILTER,
  STORAGE_KEYS,
  addRecentContract,
  clearRecentContracts,
  consumePendingRecallContract,
  getEffectiveEquipmentDebtFilter,
  getEquipmentDebtFilter,
  getRecentContracts,
  getState,
  setEquipmentDebtFilter,
  setPendingRecallContract,
  setState,
} from '../core/storage.js';
import {
  canWarmPortalSession,
  checkPortalSession,
  clearWarmSessionCache,
  detectIamRedirect,
  isAndroidAppEnv,
  isUserscriptEnv,
  openExternalOrPortalUrl,
  requestPortal,
  syncIamSsoSessions,
} from '../core/transport.js';
import {
  buildScanReport,
  createNetworkRecorder,
  extractAjaxSignaturesFromHtml,
  extractApiHintsFromHtml,
  extractApiHintsFromJs,
  extractCodeContextsFromJs,
  extractFormControlsMeta,
  extractFramesAndLinksFromHtml,
  extractInlineScriptsSanitized,
  extractNextAppChunkUrls,
  extractSpaChunkUrls,
  scanPageStructure,
} from '../core/inspector.js';
import {
  BYPASS_CHOICE_OPTIONS,
  BYPASS_REASON_BY_TYPE,
  BYPASS_TYPE_OPTIONS,
  fetchInsideBoxMacLogs,
  fetchInsideBoxMacs,
  fetchInsideByPassMeta,
  fetchInsideModemInfo,
  fetchInsideOltInit,
  fetchInsideOltListByLocation,
  fetchInsideOnlineSessions,
  findMatchingOltOption,
  getByPassTypeLabel,
  getCachedInsideContract,
  getInsideOltHint,
  isExtendedPortOlt,
  isSameOltDetectedInfo,
  runInsideAction,
  searchInsideByPass,
  setInsideOltHint,
  validateBoxNewMac,
  validateByPassPayload,
} from '../adapters/inside.js';
import {
  bootstrapMvcPortSession,
  buildPortUrl,
  fetchPortBranches,
  fetchPortConboxes,
  fetchPortContractContext,
  fetchPortHistory,
  fetchPortPops,
  fetchPortSlotList,
  parseMvcPortTokenFromCookieString,
  triggerPortFtthMenuAction,
} from '../adapters/port.js';
import {
  DEPLOYMENT_CATALOG_KEYS,
  DEPLOYMENT_ENDPOINTS,
  canEditDeploymentCameraPhone,
  clearDeploymentTicketMac,
  completeDeploymentTicket,
  fetchDeploymentEContracts,
  fetchDeploymentEquipments,
  fetchDeploymentModemMetrics,
  fetchDeploymentPayment,
  fetchDeploymentPhones,
  fetchDeploymentTicket,
  normalizeTicketSummary,
  parseDataFilterOptions,
  revealDeploymentPhone,
  signDeploymentEContract,
  syncDeploymentOnline,
  updateDeploymentCameraPhone,
  updateDeploymentConstruction,
  validateCameraPhoneNumber,
} from '../adapters/deployment.js';
import {
  RECALL_ENDPOINTS,
  findRecallSearchControls,
  isRecallPortalLocation,
  isRecallTicketLocation,
  loadRecallTicketContext,
  parseRecallTicketFromDocument,
  triggerRecallAddAccessory,
  triggerRecallAddEquipment,
  triggerRecallCreateTicket,
  triggerRecallEditEquipment,
  triggerRecallSearchOnPage,
  triggerRecallSelectTicket,
  triggerRecallSubmitNote,
} from '../adapters/recall.js';
import {
  EQUIPMENT_ENDPOINTS,
  applyEquipmentDebtFilterToPage,
  formatEquipmentDebtClipboardText,
  loadEquipmentDebtContext,
  normalizeEquipmentMatchKey,
  queryEquipmentDebtByStaff,
  queryEquipmentDebtHolders,
  readEquipmentFilterOptions,
  selectEquipmentFilterOption,
  triggerEquipmentDebtTab,
  triggerEquipmentDebtViewList,
  triggerEquipmentOpenDebtReportMenu,
  waitForEquipmentDebtTabOpen,
  waitForEquipmentReportLoad,
} from '../adapters/equipment.js';
import { executePortalAction } from '../adapters/portals.js';

function formatVndAmount(amount) {
  const num = Number(amount ?? 0);
  if (!Number.isFinite(num)) return '0 đ';
  return `${num.toLocaleString('vi-VN')} đ`;
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null) continue;
    if (k === 'className') {
      node.className = v;
    } else if (k === 'text') {
      node.textContent = v;
    } else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'disabled') {
      node.disabled = Boolean(v);
    } else {
      node.setAttribute(k, String(v));
    }
  }
  for (const child of children) {
    if (child === null || child === undefined) continue;
    if (typeof child === 'string') {
      node.appendChild(document.createTextNode(child));
    } else {
      node.appendChild(child);
    }
  }
  return node;
}

function formatTime(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

async function copyTextSafe(text) {
  if (!text) return false;
  try {
    if (
      isAndroidAppEnv() &&
      typeof window !== 'undefined' &&
      window.RemoteInsideNative &&
      typeof window.RemoteInsideNative.copyText === 'function'
    ) {
      if (window.RemoteInsideNative.copyText(String(text))) {
        return true;
      }
    }
  } catch {
    // Fallback sang GM_setClipboard / navigator.clipboard
  }
  try {
    if (typeof GM_setClipboard === 'function') {
      GM_setClipboard(text, 'text');
      return true;
    }
  } catch {
    // Fallback sang navigator.clipboard
  }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback textarea tam
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

function downloadJsonFile(filename, content) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Khoi tao va gan giao dien Remote Inside vao rootContainer.
 */
export function mountRemoteInside({
  rootContainer,
  cssText = '',
  standalone = false,
  fabPosition = 'bottom-right',
  fabLabelDefault = 'Remote Inside',
  pageWindow = typeof window !== 'undefined' ? window : null,
  pageDocument = typeof document !== 'undefined' ? document : null,
}) {
  const currentHost =
    pageWindow && pageWindow.location && pageWindow.location.hostname
      ? pageWindow.location.hostname.toLowerCase()
      : '';
  function isLoggedInPortHost() {
    try {
      return (
        currentHost === 'port.fpt.net' &&
        Boolean(pageWindow && pageWindow.location) &&
        !/LoginPage\.aspx/i.test(pageWindow.location.pathname || '')
      );
    } catch {
      return false;
    }
  }
  function createPortModalAuthButton(loginUrl) {
    if (isLoggedInPortHost()) {
      return el('button', {
        type: 'button',
        className: 'ri-secondary-btn',
        text: 'Kích hoạt FTTH NEW ngay',
        onClick: () => {
          const ok = triggerPortFtthMenuAction(pageWindow);
          if (!ok) {
            state.portModalError =
              'Chưa gọi được menu tự động. Bạn bấm ở menu bên trái: FTTH NEW → Hợp đồng → Tìm kiếm 1 lần rồi bấm "Thử tải lại".';
            renderConfirm();
          }
        },
      });
    }
    return el('button', {
      type: 'button',
      className: 'ri-secondary-btn',
      text: 'Mở trang Port đăng nhập',
      onClick: () => {
        openExternalOrPortalUrl(loginUrl, {
          mode: 'login',
          title: 'Đăng nhập Port',
          pageWindow,
        });
      },
    });
  }
  const matchedPortalId = currentHost
    ? PORTAL_ORDER.find(
        (id) =>
          Array.isArray(PORTALS[id].hosts) &&
          PORTALS[id].hosts.some((h) => h.toLowerCase() === currentHost)
      )
    : '';
  const savedPortal = getState(STORAGE_KEYS.ACTIVE_PORTAL, 'inside');
  const initialPortal = matchedPortalId || (PORTALS[savedPortal] ? savedPortal : 'inside');
  const initialContract = getState(STORAGE_KEYS.LAST_CONTRACT, '') || '';

  const state = {
    isOpen: standalone,
    activePortalId: initialPortal,
    contractInput: initialContract,
    recentContracts: getRecentContracts(),
    isRunning: false,
    runningActionId: '',
    sessionStatus: {
      state: isUserscriptEnv() ? 'checking' : 'demo',
      label: isUserscriptEnv() ? 'Đang kiểm tra…' : 'Chế độ xem thử',
      loginUrl: PORTALS[initialPortal].url,
      detail: '',
    },
    result: null,
    logs: [],
    isWide: false,
    iamSyncing: false,
    iamSyncText: '',
    openViews: {},
    viewReloadKeys: {},
    confirmAction: null,
    confirmNewMac: '',
    modemLoading: false,
    modemError: '',
    modemLoginUrl: '',
    modemInfo: null,
    boxTab: 'replace',
    boxLoading: false,
    boxError: '',
    boxLoginUrl: '',
    boxItems: [],
    boxSelectedMac: '',
    boxNewMac: '',
    boxLogLoading: false,
    boxLogError: '',
    boxLogs: [],
    oltLoading: false,
    oltError: '',
    oltLoginUrl: '',
    oltLocations: [],
    oltLocationId: '',
    oltList: [],
    oltSearch: '',
    oltSelectedId: '',
    oltPorts: [],
    oltSelectedPorts: [],
    oltShowAllPorts: false,
    oltContractLoading: false,
    oltContractObjId: '',
    oltContractError: '',
    oltConnOpen: true,
    oltConnManualOpen: false,
    oltDetectedInfo: null,
    oltAutoMatched: false,
    oltUserTouched: false,
    killLoading: false,
    killError: '',
    killLoginUrl: '',
    killSessions: [],
    killArmedObjId: '',
    bypassTab: 'create',
    bypassLoading: false,
    bypassError: '',
    bypassLoginUrl: '',
    bypassMeta: null,
    bypassChoice: 'Hợp đồng',
    bypassContract: '',
    bypassAcc: '',
    bypassType: 'Bo Gong Tam va Phai Xu Ly Gong Lai',
    bypassContent: '',
    bypassSearchQuery: '',
    bypassRows: [],
    bypassSelectedKey: '',
    bypassEditAcc: '',
    bypassEditType: '',
    bypassEditContent: '',
    bypassArmedDelete: '',
    portModalLoading: false,
    portModalError: '',
    portModalLoginUrl: '',
    portRecordMode: '',
    portDetail: null,
    portDetailWarn: '',
    portTypeContract: '3',
    portCardNumber: '1',
    portDescription: '',
    portLocations: [],
    portLocationId: '',
    portBranches: [],
    portBranchId: '',
    portPops: [],
    portPopId: '',
    portPopSearch: '',
    portConboxes: [],
    portConboxId: '',
    portConboxSearch: '',
    portSlotsLoading: false,
    portSlots: [],
    portSelectedPortId: '',
    portSelectedPortLabel: '',
    portCascadeLoading: false,
    portHistoryOpen: false,
    portHistoryLoading: false,
    portHistoryError: '',
    portHistoryRows: [],
    deployTab: 'overview',
    deployLoading: false,
    deployError: '',
    deployLoginUrl: '',
    deployLoginLabel: '',
    deployNotice: '',
    deployNoticeTone: 'info',
    deployTicketUrl: '',
    deployHash: '',
    deployGrant: '',
    deploySummary: null,
    deployDataFilter: [],
    deployEquipments: { importItems: [], revokeItems: [], macCount: 0 },
    deployModemMetrics: null,
    deployPhonesLoading: false,
    deployPhonesError: '',
    deployPhones: [],
    deployRevealedPhones: {},
    deployRevealingToken: '',
    deployEContractsLoading: false,
    deployEContractsError: '',
    deployEContracts: [],
    deployOutDoorReUsed: '0',
    deployReasonDelay: '0',
    deployDescriptionRD: '',
    deployReasonHiFPT: '0',
    deployNotCompleteWifi: '0',
    deployReasonUnuseCapLan: '0',
    deployBusyAction: '',
    deployArmedAction: '',
    recallLoading: false,
    recallError: '',
    recallStatus: '',
    recallMode: '',
    recallNotice: '',
    recallNoticeTone: 'info',
    recallSnapshot: null,
    recallContractMismatch: false,
    recallNoteInput: '',
    recallArmedCreate: false,
    recallReturnPending: false,
    recallReturnLabel: '',
    equipDebtLoading: false,
    equipDebtProgress: '',
    equipDebtError: '',
    equipDebtStatus: '',
    equipDebtMode: '',
    equipDebtNotice: '',
    equipDebtNoticeTone: 'info',
    equipDebtDataset: null,
    equipDebtHasTab: false,
    equipDebtTabActive: false,
    equipDebtHasViewBtn: false,
    equipDebtHasReportMenu: false,
    equipDebtFilterMissing: false,
    equipDebtFilterEditOpen: false,
    equipDebtFilterBusy: false,
    equipDebtDraftRegion: '',
    equipDebtDraftProvince: '',
    equipDebtDraftPartner: '',
    equipDebtRegionOpts: [],
    equipDebtProvinceOpts: [],
    equipDebtPartnerOpts: [],
    equipDebtSavedFilter: null,
    equipDebtViewMode: 'by_material',
    equipDebtGroup: '',
    equipDebtOnlyNonZero: true,
    equipDebtSearch: '',
    equipDebtSelectedKey: '',
    equipDebtSort: 'qty_desc',
    equipDebtSelectedStaff: '',
    scannerOpen: false,
    appMenuOpen: false,
    domSnapshot: null,
    recordedEntries: [],
    deepScan: null,
    isDeepScanning: false,
    isRecording: false,
    copyNotice: '',
  };

  const recorder = createNetworkRecorder(
    pageWindow,
    () => normalizeContractId(state.contractInput)
  );

  let pollTimer = null;

  const wrapper = el('div', { className: 'ri-root' });
  const mainLayer = el('div', { className: 'ri-layer-main' });
  const confirmLayer = el('div', { className: 'ri-layer-confirm' });
  const scannerLayer = el('div', { className: 'ri-layer-scanner' });
  wrapper.appendChild(mainLayer);
  wrapper.appendChild(confirmLayer);
  wrapper.appendChild(scannerLayer);
  if (cssText) {
    const styleEl = document.createElement('style');
    styleEl.textContent = cssText;
    rootContainer.appendChild(styleEl);
  }
  rootContainer.appendChild(wrapper);

  function addLog(portalLabel, actionLabel, contractId, statusKind) {
    state.logs = [
      {
        portalLabel,
        actionLabel,
        contractId: contractId || '—',
        statusKind,
        time: formatTime(),
      },
      ...state.logs,
    ].slice(0, 20);
  }

  function getUnifiedIamLoginUrl() {
    const active = PORTALS[state.activePortalId];
    if (active && active.iamSso && active.url) {
      return active.url;
    }
    return PORTALS.inside.url;
  }

  function syncSessionPillOrRenderMain() {
    const pillEl = mainLayer.querySelector('.ri-status-pill');
    if (pillEl) {
      const displayState = state.iamSyncing ? 'checking' : state.sessionStatus.state;
      const displayLabel = state.iamSyncing
        ? state.iamSyncText || 'Đang đồng bộ IAM…'
        : state.sessionStatus.label;
      pillEl.setAttribute('data-state', displayState);
      pillEl.title = state.sessionStatus.detail || 'Bấm để kiểm tra lại phiên IAM';
      const labelSpan = pillEl.querySelector('span:last-child');
      if (labelSpan) {
        labelSpan.textContent = displayLabel;
      }
      return;
    }
    renderMain();
  }

  async function runUnifiedIamSync({ skipHost = '', announceResult = true } = {}) {
    if (state.iamSyncing || !canWarmPortalSession()) {
      return null;
    }
    state.iamSyncing = true;
    state.iamSyncText = 'Đồng bộ IAM…';
    syncSessionPillOrRenderMain();

    let report = null;
    try {
      report = await syncIamSsoSessions({
        targets: IAM_SSO_TARGETS,
        skipHost,
        force: true,
        afterTarget: async (target) => {
          if (target.id === 'port') {
            await bootstrapMvcPortSession();
          }
        },
        onProgress: ({ index, total }) => {
          state.iamSyncText = `Đồng bộ IAM (${index}/${total})…`;
          syncSessionPillOrRenderMain();
        },
      });
    } finally {
      state.iamSyncing = false;
      state.iamSyncText = '';
    }

    await refreshSessionStatus();

    if (announceResult && report) {
      const okLabels = report.okTargets.map((t) => t.label);
      const needsLogin = report.needsLoginTargets;
      const offline = report.offlineTargets;

      if (needsLogin.length === 0 && offline.length === 0) {
        state.result = {
          status: 'ok',
          title: 'Đã đồng bộ IAM cho tất cả cổng',
          message: `Đăng nhập 1 lần hoàn tất. Đã sẵn sàng: ${okLabels.join(', ')}.`,
        };
      } else if (okLabels.length > 0) {
        const parts = [`Đã sẵn sàng: ${okLabels.join(', ')}.`];
        if (needsLogin.length > 0) {
          parts.push(
            `${needsLogin.map((t) => t.label).join(', ')} yêu cầu xác nhận Azure AD thêm 1 chạm khi mở.`
          );
        }
        if (offline.length > 0) {
          parts.push(
            `Chưa chạm tới được (kiểm tra VPN): ${offline.map((t) => t.label).join(', ')}.`
          );
        }
        state.result = {
          status: 'ok',
          title: `Đã đồng bộ ${okLabels.length}/${report.results.length} cổng IAM`,
          message: parts.join(' '),
          loginUrl: needsLogin.length > 0 ? needsLogin[0].url : '',
          showLoginBtn: needsLogin.length > 0,
        };
      } else {
        const parts = ['Phiên IAM (Azure AD) chưa sẵn sàng để đồng bộ.'];
        if (offline.length > 0) {
          parts.push(
            `Không chạm tới được (kiểm tra VPN): ${offline.map((t) => t.label).join(', ')}.`
          );
        }
        state.result = {
          status: 'iam_expired',
          title: 'Chưa hoàn tất đăng nhập IAM',
          message: parts.join(' '),
          loginUrl: needsLogin.length > 0 ? needsLogin[0].url : getUnifiedIamLoginUrl(),
        };
      }
      renderMain();
    }
    return report;
  }

  async function refreshSessionStatus() {
    const portal = PORTALS[state.activePortalId];
    if (!isUserscriptEnv()) {
      state.sessionStatus = {
        state: 'demo',
        label: 'Chế độ xem thử',
        loginUrl: portal.url,
        detail: 'Đang chạy mô phỏng cục bộ (chưa gắn Tampermonkey).',
      };
      syncSessionPillOrRenderMain();
      return;
    }

    state.sessionStatus = {
      state: 'checking',
      label: 'Đang kiểm tra…',
      loginUrl: portal.url,
      detail: '',
    };
    syncSessionPillOrRenderMain();
    const checkUrlOverride =
      portal.id === 'port' && portal.sessionCheckUrl
        ? buildPortUrl(portal.sessionCheckUrl)
        : '';
    let checked = await checkPortalSession(portal, { checkUrlOverride });
    if (portal.id === 'port' && checked.state === 'iam_expired') {
      const boot = await bootstrapMvcPortSession();
      if (boot && boot.ok) {
        checked = {
          state: 'ok',
          label: 'IAM ổn',
          loginUrl: portal.url,
          detail: 'Đã tự động kích hoạt và kết nối tốt tới port.fpt.net (FTTH NEW).',
        };
      } else if (isLoggedInPortHost()) {
        checked.label = 'Chưa bật FTTH NEW';
        checked.detail =
          'Bạn đã vào port.fpt.net nhưng FTTH NEW (mvcport.fpt.net) chưa kích hoạt. Bấm menu trái: FTTH NEW → Hợp đồng → Tìm kiếm 1 lần rồi bấm lại vào ô trạng thái này.';
      }
    }
    if (state.activePortalId === portal.id) {
      state.sessionStatus = checked;
      syncSessionPillOrRenderMain();
    }
  }

  function setContractValue(val) {
    state.contractInput = normalizeContractId(val);
    setState(STORAGE_KEYS.LAST_CONTRACT, state.contractInput);
    render();
  }

  async function handlePasteContract() {
    try {
      if (
        isAndroidAppEnv() &&
        typeof window !== 'undefined' &&
        window.RemoteInsideNative &&
        typeof window.RemoteInsideNative.readClipboard === 'function'
      ) {
        const nativeText = window.RemoteInsideNative.readClipboard();
        const nativeCleaned = normalizeContractId(nativeText);
        if (nativeCleaned) {
          setContractValue(nativeCleaned);
          return;
        }
      }
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        const cleaned = normalizeContractId(text);
        if (cleaned) {
          setContractValue(cleaned);
          return;
        }
      }
      state.result = {
        status: 'warn',
        title: 'Chưa dán được tự động',
        message: 'Trình duyệt đang chặn đọc bộ nhớ tạm. Bạn chạm trực tiếp vào ô Mã hợp đồng rồi chọn Dán nhé.',
      };
      render();
    } catch {
      state.result = {
        status: 'warn',
        title: 'Chưa dán được tự động',
        message: 'Bạn chạm trực tiếp vào ô Mã hợp đồng rồi chọn Dán nhé.',
      };
      render();
    }
  }

  function resetDeployModalState() {
    state.deployTab = 'overview';
    state.deployLoading = false;
    state.deployError = '';
    state.deployLoginUrl = '';
    state.deployLoginLabel = '';
    state.deployNotice = '';
    state.deployNoticeTone = 'info';
    state.deployTicketUrl = '';
    state.deployHash = '';
    state.deployGrant = '';
    state.deploySummary = null;
    state.deployDataFilter = [];
    state.deployEquipments = { importItems: [], revokeItems: [], macCount: 0 };
    state.deployPayment = null;
    state.deployModemMetrics = null;
    state.deployPhonesLoading = false;
    state.deployPhonesError = '';
    state.deployPhones = [];
    state.deployRevealedPhones = {};
    state.deployRevealingToken = '';
    state.deployEditingPhoneToken = '';
    state.deployEditingPhoneValue = '';
    state.deployEContractsLoading = false;
    state.deployEContractsError = '';
    state.deployEContracts = [];
    state.deployOutDoorReUsed = '0';
    state.deployReasonDelay = '0';
    state.deployDescriptionRD = '';
    state.deployReasonHiFPT = '0';
    state.deployNotCompleteWifi = '0';
    state.deployReasonUnuseCapLan = '0';
    state.deployBusyAction = '';
    state.deployArmedAction = '';
  }

  function resetRecallModalState() {
    state.recallLoading = false;
    state.recallError = '';
    state.recallStatus = '';
    state.recallMode = '';
    state.recallNotice = '';
    state.recallNoticeTone = 'info';
    state.recallSnapshot = null;
    state.recallContractMismatch = false;
    state.recallNoteInput = '';
    state.recallArmedCreate = false;
    state.recallReturnPending = false;
    state.recallReturnLabel = '';
  }

  function resetEquipDebtModalState() {
    state.equipDebtLoading = false;
    state.equipDebtProgress = '';
    state.equipDebtError = '';
    state.equipDebtStatus = '';
    state.equipDebtMode = '';
    state.equipDebtNotice = '';
    state.equipDebtNoticeTone = 'info';
    state.equipDebtDataset = null;
    state.equipDebtHasTab = false;
    state.equipDebtTabActive = false;
    state.equipDebtHasViewBtn = false;
    state.equipDebtHasReportMenu = false;
    state.equipDebtFilterMissing = false;
    state.equipDebtFilterEditOpen = false;
    state.equipDebtFilterBusy = false;
    state.equipDebtDraftRegion = '';
    state.equipDebtDraftProvince = '';
    state.equipDebtDraftPartner = '';
    state.equipDebtRegionOpts = [];
    state.equipDebtProvinceOpts = [];
    state.equipDebtPartnerOpts = [];
    state.equipDebtSavedFilter = null;
    state.equipDebtViewMode = 'by_material';
    state.equipDebtGroup = '';
    state.equipDebtOnlyNonZero = true;
    state.equipDebtSearch = '';
    state.equipDebtSelectedKey = '';
    state.equipDebtSort = 'qty_desc';
    state.equipDebtSelectedStaff = '';
  }

  function resetConfirmState() {
    state.confirmAction = null;
    state.confirmNewMac = '';
    state.modemLoading = false;
    state.modemError = '';
    state.modemLoginUrl = '';
    state.modemInfo = null;
    state.boxTab = 'replace';
    state.boxLoading = false;
    state.boxError = '';
    state.boxLoginUrl = '';
    state.boxItems = [];
    state.boxSelectedMac = '';
    state.boxNewMac = '';
    state.boxLogLoading = false;
    state.boxLogError = '';
    state.boxLogs = [];
    state.oltLoading = false;
    state.oltError = '';
    state.oltLoginUrl = '';
    state.oltLocations = [];
    state.oltLocationId = '';
    state.oltList = [];
    state.oltSearch = '';
    state.oltSelectedId = '';
    state.oltPorts = [];
    state.oltSelectedPorts = [];
    state.oltShowAllPorts = false;
    state.oltContractLoading = false;
    state.oltContractObjId = '';
    state.oltContractError = '';
    state.oltConnOpen = true;
    state.oltConnManualOpen = false;
    state.oltDetectedInfo = null;
    state.oltAutoMatched = false;
    state.oltUserTouched = false;
    state.killLoading = false;
    state.killError = '';
    state.killLoginUrl = '';
    state.killSessions = [];
    state.killArmedObjId = '';
    state.bypassTab = 'create';
    state.bypassLoading = false;
    state.bypassError = '';
    state.bypassLoginUrl = '';
    state.bypassMeta = null;
    state.bypassChoice = 'Hợp đồng';
    state.bypassContract = '';
    state.bypassAcc = '';
    state.bypassType = 'Bo Gong Tam va Phai Xu Ly Gong Lai';
    state.bypassContent = '';
    state.bypassSearchQuery = '';
    state.bypassRows = [];
    state.bypassSelectedKey = '';
    state.bypassEditAcc = '';
    state.bypassEditType = '';
    state.bypassEditContent = '';
    state.bypassArmedDelete = '';
    state.portModalLoading = false;
    state.portModalError = '';
    state.portModalLoginUrl = '';
    state.portRecordMode = '';
    state.portDetail = null;
    state.portDetailWarn = '';
    state.portTypeContract = '3';
    state.portCardNumber = '1';
    state.portDescription = '';
    state.portLocations = [];
    state.portLocationId = '';
    state.portBranches = [];
    state.portBranchId = '';
    state.portPops = [];
    state.portPopId = '';
    state.portPopSearch = '';
    state.portConboxes = [];
    state.portConboxId = '';
    state.portConboxSearch = '';
    state.portSlotsLoading = false;
    state.portSlots = [];
    state.portSelectedPortId = '';
    state.portSelectedPortLabel = '';
    state.portCascadeLoading = false;
    state.portHistoryOpen = false;
    state.portHistoryLoading = false;
    state.portHistoryError = '';
    state.portHistoryRows = [];
    resetDeployModalState();
    resetRecallModalState();
    resetEquipDebtModalState();
  }

  function applyDetectedOltToModal() {
    if (!state.oltDetectedInfo || state.oltUserTouched || state.oltList.length === 0) {
      return;
    }
    const matched = findMatchingOltOption(state.oltList, state.oltDetectedInfo.oltPop);
    if (!matched) {
      state.oltAutoMatched = false;
      return;
    }

    state.oltSelectedId = matched.id;
    state.oltSearch = '';
    state.oltAutoMatched = true;
    state.oltShowAllPorts = isExtendedPortOlt(matched.name);

    const detectedPort = String(state.oltDetectedInfo.port || '').trim();
    if (detectedPort) {
      const portsSrc =
        state.oltPorts.length > 0
          ? state.oltPorts
          : Array.from({ length: 16 }, (_, idx) => ({
              value: String(idx + 1),
              label: `Port ${idx + 1}`,
              isType2: idx + 1 > 8,
            }));
      const matchedPort = portsSrc.find(
        (p) =>
          String(p.value).trim() === detectedPort ||
          (Number.isFinite(Number(p.value)) &&
            Number.isFinite(Number(detectedPort)) &&
            Number(p.value) === Number(detectedPort))
      );
      if (matchedPort) {
        state.oltSelectedPorts = [matchedPort.value];
        if (matchedPort.isType2) {
          state.oltShowAllPorts = true;
        }
      }
    }
  }

  if (pageWindow && typeof pageWindow.addEventListener === 'function') {
    pageWindow.addEventListener('message', (event) => {
      if (
        event.origin !== 'http://radius-portal.fpt.net' &&
        event.origin !== 'https://radius-portal.fpt.net'
      ) {
        return;
      }
      const data = event.data;
      if (!data || data.type !== 'RI_RADIUS_OLT_INFO' || !data.oltPop) {
        return;
      }
      const saved = setInsideOltHint(data.objId, data);
      if (
        state.confirmAction &&
        state.confirmAction.id === 'clear_osp' &&
        state.activePortalId === 'inside'
      ) {
        if (!data.objId || !state.oltContractObjId || String(data.objId) === String(state.oltContractObjId)) {
          const nextInfo = saved || {
            objId: String(data.objId || ''),
            oltPop: String(data.oltPop || ''),
            slot: String(data.slot || ''),
            port: String(data.port || ''),
            onu: String(data.onu || ''),
            ipOlt: String(data.ipOlt || ''),
          };
          if (isSameOltDetectedInfo(state.oltDetectedInfo, nextInfo)) {
            return;
          }
          state.oltDetectedInfo = nextInfo;
          applyDetectedOltToModal();
          if (!state.oltConnManualOpen) {
            state.oltConnOpen = false;
          }
          renderConfirm();
        }
      }
    });
  }

  async function loadKillSessionsForModal(contractId) {
    state.killLoading = true;
    state.killError = '';
    state.killLoginUrl = '';
    state.killSessions = [];
    state.killArmedObjId = '';
    renderConfirm();

    try {
      const res = await fetchInsideOnlineSessions(contractId);
      if (!state.confirmAction || state.confirmAction.id !== 'kill_session') {
        return;
      }
      state.killLoading = false;
      if (res.status === 'ok') {
        state.killSessions = Array.isArray(res.sessions) ? res.sessions : [];
      } else {
        state.killError = res.message || 'Không tải được danh sách phiên đang chạy.';
        state.killLoginUrl = res.loginUrl || '';
      }
    } catch (err) {
      if (!state.confirmAction || state.confirmAction.id !== 'kill_session') {
        return;
      }
      state.killLoading = false;
      state.killError = err && err.message ? err.message : 'Lỗi tải danh sách phiên đang online.';
    }
    renderConfirm();
  }

  function getBypassRowKey(row, idx = 0) {
    return `${(row && row.contract) || ''}|${(row && row.date) || ''}|${idx}`;
  }

  function selectBypassRow(row, idx = 0) {
    if (!row) {
      state.bypassSelectedKey = '';
      state.bypassEditAcc = '';
      state.bypassEditType = '';
      state.bypassEditContent = '';
      state.bypassArmedDelete = '';
      return;
    }
    state.bypassSelectedKey = getBypassRowKey(row, idx);
    state.bypassEditAcc = row.accByPass || '';
    state.bypassEditType = row.flagByPass || 'Bo Gong';
    state.bypassEditContent = row.content || '';
    state.bypassArmedDelete = '';
  }

  async function runByPassSearchInModal(rawQuery) {
    const clean = String(rawQuery || '').trim();
    state.bypassSearchQuery = clean;
    state.bypassError = '';
    state.bypassArmedDelete = '';
    if (!clean) {
      state.bypassRows = [];
      selectBypassRow(null);
      renderConfirm();
      return;
    }
    state.bypassLoading = true;
    renderConfirm();
    try {
      const res = await searchInsideByPass(clean);
      if (!state.confirmAction || state.confirmAction.id !== 'bypass') {
        return;
      }
      state.bypassLoading = false;
      if (res.status === 'ok') {
        if (res.meta) state.bypassMeta = res.meta;
        state.bypassRows = Array.isArray(res.rows) ? res.rows : [];
        selectBypassRow(state.bypassRows[0] || null, 0);
      } else {
        state.bypassError = res.message || 'Không tra cứu được danh sách ByPass.';
        state.bypassLoginUrl = res.loginUrl || '';
      }
    } catch (err) {
      if (!state.confirmAction || state.confirmAction.id !== 'bypass') {
        return;
      }
      state.bypassLoading = false;
      state.bypassError = err && err.message ? err.message : 'Lỗi tra cứu CheckList ByPass.';
    }
    renderConfirm();
  }

  async function loadInsideByPassModal(contractId) {
    state.bypassLoading = true;
    state.bypassError = '';
    state.bypassLoginUrl = '';
    state.bypassTab = 'create';
    state.bypassChoice = 'Hợp đồng';
    state.bypassContract = contractId || '';
    state.bypassAcc = '';
    state.bypassType = 'Bo Gong Tam va Phai Xu Ly Gong Lai';
    state.bypassContent = '';
    state.bypassSearchQuery = contractId || '';
    state.bypassRows = [];
    selectBypassRow(null);
    renderConfirm();

    try {
      const metaRes = await fetchInsideByPassMeta();
      if (!state.confirmAction || state.confirmAction.id !== 'bypass') {
        return;
      }
      if (metaRes.status !== 'ok') {
        state.bypassLoading = false;
        state.bypassError = metaRes.message || 'Không tải được cấu hình CheckList ByPass.';
        state.bypassLoginUrl = metaRes.loginUrl || '';
        renderConfirm();
        return;
      }
      state.bypassMeta = metaRes.meta || null;

      if (contractId) {
        const searchRes = await searchInsideByPass(contractId);
        if (!state.confirmAction || state.confirmAction.id !== 'bypass') {
          return;
        }
        state.bypassLoading = false;
        if (searchRes.status === 'ok') {
          state.bypassRows = Array.isArray(searchRes.rows) ? searchRes.rows : [];
          selectBypassRow(state.bypassRows[0] || null, 0);
        } else {
          state.bypassError = searchRes.message || 'Không tra cứu được tình trạng ByPass hiện tại.';
          state.bypassLoginUrl = searchRes.loginUrl || '';
        }
      } else {
        state.bypassLoading = false;
      }
    } catch (err) {
      if (!state.confirmAction || state.confirmAction.id !== 'bypass') {
        return;
      }
      state.bypassLoading = false;
      state.bypassError = err && err.message ? err.message : 'Lỗi tải CheckList ByPass.';
    }
    renderConfirm();
  }

  function applyDeployTicketDraftFromSummary(summary) {
    const t = summary && summary.ticket ? summary.ticket : null;
    state.deployOutDoorReUsed = t ? String(t.outDoorReUsed ?? 0) : '0';
    state.deployReasonDelay = t ? String(t.reasonDelay ?? 0) : '0';
    state.deployDescriptionRD = t ? String(t.descriptionRd ?? '') : '';
    state.deployReasonHiFPT = t ? String(t.reasonHiFPT ?? 0) : '0';
    state.deployNotCompleteWifi = t ? String(t.notCompleteWifi ?? 0) : '0';
    state.deployReasonUnuseCapLan = t ? String(t.reasonUnuseCapLan ?? 0) : '0';
  }

  async function loadDeployExtrasForModal({ forceReload = false } = {}) {
    const summary = state.deploySummary;
    if (!summary || !summary.objId) return;
    if (!forceReload && state.deployPhones.length > 0 && state.deployEContracts.length > 0) {
      return;
    }

    state.deployPhonesLoading = true;
    state.deployPhonesError = '';
    state.deployEContractsLoading = true;
    state.deployEContractsError = '';
    renderConfirm();

    const grant = state.deployGrant || '';
    try {
      const [phoneRes, recRes] = await Promise.all([
        fetchDeploymentPhones({
          contract: summary.contract,
          objId: summary.objId,
          grant,
        }),
        fetchDeploymentEContracts({
          objId: summary.objId,
          grant,
        }),
      ]);
      if (!state.confirmAction || state.confirmAction.id !== 'deploy_ticket') {
        return;
      }

      state.deployPhonesLoading = false;
      if (phoneRes.status === 'ok') {
        state.deployPhones = Array.isArray(phoneRes.rows) ? phoneRes.rows : [];
      } else {
        state.deployPhonesError = phoneRes.message || 'Không tải được danh sách SĐT User.';
      }

      state.deployEContractsLoading = false;
      if (recRes.status === 'ok') {
        state.deployEContracts = Array.isArray(recRes.rows) ? recRes.rows : [];
      } else {
        state.deployEContractsError = recRes.message || 'Không tải được Biên bản điện tử.';
      }
    } catch (err) {
      if (!state.confirmAction || state.confirmAction.id !== 'deploy_ticket') {
        return;
      }
      state.deployPhonesLoading = false;
      state.deployEContractsLoading = false;
      const errMsg = err && err.message ? err.message : 'Lỗi tải SĐT & Biên bản điện tử.';
      state.deployPhonesError = errMsg;
      state.deployEContractsError = errMsg;
    }
    renderConfirm();
  }

  async function refreshDeployEquipmentsInModal() {
    const summary = state.deploySummary;
    const ticket = summary && summary.ticket ? summary.ticket : null;
    if (!summary || !summary.objId || !ticket || !ticket.supId) return;
    const eqRes = await fetchDeploymentEquipments({
      objId: summary.objId,
      supId: ticket.supId,
      grant: state.deployGrant || '',
    });
    if (!state.confirmAction || state.confirmAction.id !== 'deploy_ticket') {
      return;
    }
    if (eqRes.status === 'ok' && eqRes.equipments) {
      state.deployEquipments = eqRes.equipments;
    }
  }

  async function refreshDeployPaymentInModal() {
    const summary = state.deploySummary;
    const ticket = summary && summary.ticket ? summary.ticket : null;
    if (!summary || !summary.objId || !ticket || !ticket.supId) return;
    const payRes = await fetchDeploymentPayment({
      objId: summary.objId,
      supId: ticket.supId,
      grant: state.deployGrant || '',
    });
    if (!state.confirmAction || state.confirmAction.id !== 'deploy_ticket') {
      return;
    }
    if (payRes.status === 'ok') {
      state.deployPayment = payRes.paymentInfo || null;
    }
  }

  async function refreshDeployMetricsInModal() {
    const summary = state.deploySummary;
    if (!summary || !summary.contract) return;
    state.deployNotice = 'Đang làm mới thông số kết nối NET…';
    state.deployNoticeTone = 'info';
    renderConfirm();
    const res = await fetchDeploymentModemMetrics({
      contract: summary.contract,
      grant: state.deployGrant || '',
    });
    if (!state.confirmAction || state.confirmAction.id !== 'deploy_ticket') {
      return;
    }
    if (res.status === 'ok' && res.data) {
      state.deployModemMetrics = res.data;
      state.deployNotice = 'Đã cập nhật thông số kết nối NET mới nhất.';
      state.deployNoticeTone = 'ok';
    } else {
      state.deployNotice = res.message || 'Không làm mới được thông số kết nối NET.';
      state.deployNoticeTone = 'error';
    }
    renderConfirm();
  }

  async function switchDeployTicketSupId(nextSupId) {
    const summary = state.deploySummary;
    if (!summary || !Array.isArray(summary.tickets)) return;
    const target = summary.tickets.find((t) => String(t.supId) === String(nextSupId));
    if (!target) return;
    state.deploySummary = { ...summary, ticket: target };
    state.deployNotice = '';
    state.deployArmedAction = '';
    state.deployEditingPhoneToken = '';
    state.deployEditingPhoneValue = '';
    applyDeployTicketDraftFromSummary(state.deploySummary);
    renderConfirm();
    await Promise.all([refreshDeployEquipmentsInModal(), refreshDeployPaymentInModal()]);
    if (!state.confirmAction || state.confirmAction.id !== 'deploy_ticket') return;
    renderConfirm();
  }

  async function loadDeployTicketModal(rawContractId, selectedSupId = 0) {
    const prevTab = state.deployTab || 'overview';
    resetDeployModalState();
    state.deployTab = prevTab;
    state.deployLoading = true;
    renderConfirm();

    const cleanId = normalizeContractId(rawContractId || '');
    try {
      const res = await fetchDeploymentTicket(cleanId, {
        pageLocation: pageWindow ? pageWindow.location : null,
        selectedSupId,
      });
      if (!state.confirmAction || state.confirmAction.id !== 'deploy_ticket') {
        return;
      }
      state.deployLoading = false;
      if (res.status !== 'ok') {
        state.deployError = res.message || 'Không tải được phiếu triển khai FOX-ERP.';
        state.deployLoginUrl = res.loginUrl || DEPLOYMENT_ENDPOINTS.foxTicketPage;
        state.deployLoginLabel = res.loginLabel || 'Đăng nhập IAM';
        renderConfirm();
        return;
      }

      state.deployTicketUrl = res.ticketUrl || '';
      state.deployHash = res.hash || '';
      state.deployGrant = res.grant || '';
      state.deploySummary = res.summary || null;
      state.deployDataFilter = Array.isArray(res.dataFilter) ? res.dataFilter : [];
      state.deployEquipments = res.equipments || { importItems: [], revokeItems: [], macCount: 0 };
      state.deployPayment = res.paymentInfo || null;
      state.deployModemMetrics = res.modemMetrics || null;
      applyDeployTicketDraftFromSummary(state.deploySummary);
      if (
        res.summary &&
        res.summary.contract &&
        normalizeContractId(state.contractInput) !== res.summary.contract
      ) {
        state.contractInput = res.summary.contract;
        state.recentContracts = addRecentContract(res.summary.contract);
      }
      addLog(
        'Inside',
        'Mở phiếu triển khai',
        (res.summary && res.summary.ticket && res.summary.ticket.depCode) ||
          (res.summary && res.summary.contract) ||
          cleanId,
        res.mode === 'demo' ? 'demo' : 'ok'
      );
      renderConfirm();

      if (state.deployTab === 'extras') {
        loadDeployExtrasForModal({ forceReload: true });
      }
    } catch (err) {
      if (!state.confirmAction || state.confirmAction.id !== 'deploy_ticket') {
        return;
      }
      state.deployLoading = false;
      state.deployError = err && err.message ? err.message : 'Lỗi tải Phiếu triển khai.';
      state.deployLoginUrl = DEPLOYMENT_ENDPOINTS.foxTicketPage;
      state.deployLoginLabel = 'Mở FOX-ERP';
      renderConfirm();
    }
  }

  async function runDeployMutation({
    busyKey,
    pendingText,
    fallbackErr,
    logAction,
    fn,
    onOk,
  }) {
    const summary = state.deploySummary;
    const ticket = summary && summary.ticket ? summary.ticket : null;
    if (!summary || !ticket || state.deployBusyAction) return;
    state.deployArmedAction = '';
    state.deployBusyAction = busyKey;
    state.deployNotice = pendingText;
    state.deployNoticeTone = 'info';
    renderConfirm();

    try {
      const res = await fn(summary, ticket);
      if (!state.confirmAction || state.confirmAction.id !== 'deploy_ticket') return;
      state.deployBusyAction = '';
      if (res.status === 'ok') {
        state.deployNotice = res.message || 'Thao tác thành công.';
        state.deployNoticeTone = 'ok';
        addLog('Inside', logAction, ticket.depCode || summary.contract, res.mode === 'demo' ? 'demo' : 'ok');
        if (onOk) {
          await onOk(res);
          if (!state.confirmAction || state.confirmAction.id !== 'deploy_ticket') return;
        }
      } else {
        state.deployNotice = res.message || fallbackErr;
        state.deployNoticeTone = 'error';
        if (res.loginUrl) {
          state.deployLoginUrl = res.loginUrl;
        }
        addLog('Inside', logAction, ticket.depCode || summary.contract, 'error');
      }
    } catch (err) {
      if (!state.confirmAction || state.confirmAction.id !== 'deploy_ticket') return;
      state.deployBusyAction = '';
      state.deployNotice = err && err.message ? err.message : fallbackErr;
      state.deployNoticeTone = 'error';
    }
    renderConfirm();
  }

  function handleDeployClearMac() {
    return runDeployMutation({
      busyKey: 'clear_mac',
      pendingText: 'Đang gửi lệnh Clear Mac thiết bị trên phiếu…',
      fallbackErr: 'Clear Mac chưa thành công.',
      logAction: 'Clear Mac phiếu TK',
      fn: (summary, ticket) =>
        clearDeploymentTicketMac({
          objId: summary.objId,
          supId: ticket.supId,
          grant: state.deployGrant || '',
        }),
      onOk: () => refreshDeployEquipmentsInModal(),
    });
  }

  function handleDeploySyncOnline() {
    return runDeployMutation({
      busyKey: 'sync_online',
      pendingText: 'Đang gửi đồng bộ thông tin Online…',
      fallbackErr: 'Đồng bộ Online chưa thành công.',
      logAction: 'Cập nhật Online phiếu TK',
      fn: (summary, ticket) =>
        syncDeploymentOnline({
          objId: summary.objId,
          supId: ticket.supId,
          contract: summary.contract,
          grant: state.deployGrant || '',
        }),
    });
  }

  function handleDeploySaveConstruction() {
    return runDeployMutation({
      busyKey: 'save_construction',
      pendingText: 'Đang lưu thông tin thi công…',
      fallbackErr: 'Lưu thông tin thi công chưa thành công.',
      logAction: 'Lưu thi công phiếu TK',
      fn: (summary, ticket) =>
        updateDeploymentConstruction({
          objId: summary.objId,
          supId: ticket.supId,
          contract: summary.contract,
          outDoorReUsed: state.deployOutDoorReUsed,
          descriptionRD: state.deployDescriptionRD,
          reasonDelay: state.deployReasonDelay,
          grant: state.deployGrant || '',
        }),
    });
  }

  function handleDeployComplete() {
    return runDeployMutation({
      busyKey: 'complete',
      pendingText: 'Đang gửi xác nhận hoàn tất phiếu triển khai…',
      fallbackErr: 'Chưa hoàn tất được phiếu.',
      logAction: 'Hoàn tất phiếu TK',
      fn: (summary, ticket) =>
        completeDeploymentTicket({
          objId: summary.objId,
          supId: ticket.supId,
          outDoorReUsed: state.deployOutDoorReUsed,
          descriptionRD: state.deployDescriptionRD,
          reasonDelay: state.deployReasonDelay,
          reasonHiFPT: state.deployReasonHiFPT,
          notCompleteWifi: state.deployNotCompleteWifi,
          reasonUnuseCapLan: state.deployReasonUnuseCapLan,
          grant: state.deployGrant || '',
        }),
      onOk: () => {
        if (state.deploySummary && state.deploySummary.ticket) {
          state.deploySummary = {
            ...state.deploySummary,
            ticket: {
              ...state.deploySummary.ticket,
              status: 1,
              statusDesc: 'Hoàn tất',
            },
          };
        }
      },
    });
  }

  async function handleDeployRevealPhone(item) {
    const summary = state.deploySummary;
    const ticket = summary && summary.ticket ? summary.ticket : null;
    if (!summary || !ticket || !item || !item.PhoneToken || state.deployRevealingToken) return;
    state.deployRevealingToken = item.PhoneToken;
    renderConfirm();

    try {
      const res = await revealDeploymentPhone({
        token: item.PhoneToken,
        objId: summary.objId,
        supId: ticket.supId,
        grant: state.deployGrant || '',
      });
      if (!state.confirmAction || state.confirmAction.id !== 'deploy_ticket') return;
      state.deployRevealingToken = '';
      if (res.status === 'ok' && res.phone) {
        state.deployRevealedPhones = {
          ...state.deployRevealedPhones,
          [item.PhoneToken]: res.phone,
        };
        state.deployNotice = `Đã giải mã ${item.DescriptionVn || 'SĐT'}: ${res.phone}`;
        state.deployNoticeTone = 'ok';
      } else {
        state.deployNotice = res.message || 'Không hiện được số điện thoại đầy đủ.';
        state.deployNoticeTone = 'error';
      }
    } catch (err) {
      if (!state.confirmAction || state.confirmAction.id !== 'deploy_ticket') return;
      state.deployRevealingToken = '';
      state.deployNotice = err && err.message ? err.message : 'Lỗi giải mã SĐT.';
      state.deployNoticeTone = 'error';
    }
    renderConfirm();
  }

  function handleDeploySignEContract(rec) {
    if (!rec) return;
    return runDeployMutation({
      busyKey: 'sign_econtract',
      pendingText: `Đang gửi ký biên bản ${rec.Code || ''}…`,
      fallbackErr: 'Chưa ký được biên bản điện tử.',
      logAction: 'Ký BBĐT phiếu TK',
      fn: (summary, ticket) =>
        signDeploymentEContract({
          objId: summary.objId,
          supId: ticket.supId,
          guid: rec.Guid,
          name: rec.Name,
          code: rec.Code,
          grant: state.deployGrant || '',
        }),
      onOk: () => loadDeployExtrasForModal({ forceReload: true }),
    });
  }

  async function handleDeployUpdateCameraPhone(item) {
    if (!item || !item.PhoneToken) return;
    const check = validateCameraPhoneNumber(state.deployEditingPhoneValue);
    if (!check.valid) {
      state.deployArmedAction = '';
      state.deployNotice = check.error;
      state.deployNoticeTone = 'error';
      renderConfirm();
      return;
    }
    return runDeployMutation({
      busyKey: 'edit_cmr_phone',
      pendingText: `Đang cập nhật SĐT CMR sang ${check.value}…`,
      fallbackErr: 'Không cập nhật được SĐT CMR.',
      logAction: 'Đổi SĐT CMR phiếu TK',
      fn: (summary, ticket) =>
        updateDeploymentCameraPhone({
          objId: summary.objId,
          supId: ticket.supId,
          contract: summary.contract,
          oldPhoneNumberToken: item.PhoneToken,
          phoneNumber: check.value,
          grant: state.deployGrant || '',
        }),
      onOk: async () => {
        if (state.deployRevealedPhones && item.PhoneToken) {
          delete state.deployRevealedPhones[item.PhoneToken];
        }
        state.deployEditingPhoneToken = '';
        state.deployEditingPhoneValue = '';
        await loadDeployExtrasForModal({ forceReload: true });
      },
    });
  }

  async function loadModemInfoForModal(contractId) {
    state.modemLoading = true;
    state.modemError = '';
    state.modemLoginUrl = '';
    state.modemInfo = null;
    renderConfirm();

    try {
      const res = await fetchInsideModemInfo(contractId);
      if (!state.confirmAction || state.confirmAction.id !== 'reset_mac') {
        return;
      }
      state.modemLoading = false;
      if (res.status === 'ok') {
        state.modemInfo = res;
        state.confirmNewMac = res.macAddress || '';
      } else {
        state.modemError = res.message || 'Không tải được MAC Modem đang chạy.';
        state.modemLoginUrl = res.loginUrl || '';
      }
    } catch (err) {
      if (!state.confirmAction || state.confirmAction.id !== 'reset_mac') {
        return;
      }
      state.modemLoading = false;
      state.modemError = err && err.message ? err.message : 'Lỗi tải MAC Modem hiện tại.';
    }
    renderConfirm();
  }

  async function loadBoxMacsForModal(contractId) {
    state.boxLoading = true;
    state.boxLogLoading = true;
    state.boxError = '';
    state.boxLogError = '';
    state.boxLoginUrl = '';
    state.boxItems = [];
    state.boxSelectedMac = '';
    state.boxLogs = [];
    renderConfirm();

    try {
      const [macsRes, logsRes] = await Promise.all([
        fetchInsideBoxMacs(contractId),
        fetchInsideBoxMacLogs(contractId),
      ]);
      if (!state.confirmAction || state.confirmAction.id !== 'reset_mac_box') {
        return;
      }
      state.boxLoading = false;
      state.boxLogLoading = false;

      if (macsRes.status === 'ok') {
        state.boxItems = Array.isArray(macsRes.items) ? macsRes.items : [];
        if (state.boxItems.length === 1) {
          state.boxSelectedMac = state.boxItems[0].MAC;
        }
      } else {
        state.boxError = macsRes.message || 'Không tải được danh sách MAC Box.';
        state.boxLoginUrl = macsRes.loginUrl || '';
      }

      if (logsRes.status === 'ok') {
        state.boxLogs = Array.isArray(logsRes.logs) ? logsRes.logs : [];
      } else {
        state.boxLogError = logsRes.message || 'Không tải được lịch sử Reset MAC.';
        if (!state.boxLoginUrl && logsRes.loginUrl) {
          state.boxLoginUrl = logsRes.loginUrl;
        }
      }
    } catch (err) {
      if (!state.confirmAction || state.confirmAction.id !== 'reset_mac_box') {
        return;
      }
      state.boxLoading = false;
      state.boxLogLoading = false;
      state.boxError = err && err.message ? err.message : 'Lỗi tải dữ liệu MAC Box.';
    }
    renderConfirm();
  }

  async function reloadBoxLogsForModal(contractId) {
    state.boxLogLoading = true;
    state.boxLogError = '';
    renderConfirm();

    try {
      const logsRes = await fetchInsideBoxMacLogs(contractId);
      if (!state.confirmAction || state.confirmAction.id !== 'reset_mac_box') {
        return;
      }
      state.boxLogLoading = false;
      if (logsRes.status === 'ok') {
        state.boxLogs = Array.isArray(logsRes.logs) ? logsRes.logs : [];
      } else {
        state.boxLogError = logsRes.message || 'Không tải được lịch sử Reset MAC.';
      }
    } catch (err) {
      if (!state.confirmAction || state.confirmAction.id !== 'reset_mac_box') {
        return;
      }
      state.boxLogLoading = false;
      state.boxLogError = err && err.message ? err.message : 'Lỗi tải lịch sử Reset MAC.';
    }
    renderConfirm();
  }

  async function loadContractOltContextForModal(contractId) {
    if (!contractId) return;

    function applyCachedHintIfPresent(objId) {
      if (!isUserscriptEnv()) {
        state.oltDetectedInfo = {
          objId: String(objId || '900000001'),
          oltPop: 'DEMO-OLT-01GC16',
          slot: '0',
          port: '5',
          onu: '79',
          ipOlt: '10.0.0.10',
        };
        applyDetectedOltToModal();
        if (!state.oltConnManualOpen) {
          state.oltConnOpen = false;
        }
        return;
      }
      const hint = getInsideOltHint(objId);
      if (hint) {
        state.oltDetectedInfo = hint;
        applyDetectedOltToModal();
        if (!state.oltConnManualOpen) {
          state.oltConnOpen = false;
        }
      }
    }

    const cached = getCachedInsideContract(contractId);
    if (cached && cached.objID) {
      state.oltContractObjId = String(cached.objID);
      state.oltContractError = '';
      applyCachedHintIfPresent(state.oltContractObjId);
      renderConfirm();
      return;
    }

    state.oltContractLoading = true;
    state.oltContractObjId = '';
    state.oltContractError = '';
    renderConfirm();

    try {
      const res = await fetchInsideModemInfo(contractId);
      if (!state.confirmAction || state.confirmAction.id !== 'clear_osp') {
        return;
      }
      state.oltContractLoading = false;
      if (res.status === 'ok' && res.objID) {
        state.oltContractObjId = String(res.objID);
        applyCachedHintIfPresent(state.oltContractObjId);
      } else {
        state.oltContractError =
          res.message || `Không lấy được ObjID cho ${contractId} để mở Thông số kết nối.`;
      }
    } catch (err) {
      if (!state.confirmAction || state.confirmAction.id !== 'clear_osp') {
        return;
      }
      state.oltContractLoading = false;
      state.oltContractError =
        err && err.message ? err.message : 'Lỗi tải thông tin hợp đồng để mở Thông số kết nối.';
    }
    renderConfirm();
  }

  async function loadOltDataForModal(forceRefresh = false) {
    state.oltLoading = true;
    state.oltError = '';
    state.oltLoginUrl = '';
    renderConfirm();

    try {
      const res = await fetchInsideOltInit({ forceRefresh });
      if (!state.confirmAction || state.confirmAction.id !== 'clear_osp') {
        return;
      }
      state.oltLoading = false;
      if (res.status === 'ok') {
        state.oltLocations = Array.isArray(res.locations) ? res.locations : [];
        state.oltLocationId = res.defaultLocationId || '';
        state.oltList = Array.isArray(res.olts) ? res.olts : [];
        state.oltPorts = Array.isArray(res.ports) ? res.ports : [];
        if (state.oltSelectedId && !state.oltList.some((o) => o.id === state.oltSelectedId)) {
          state.oltSelectedId = '';
          state.oltSelectedPorts = [];
        }
        applyDetectedOltToModal();
      } else {
        state.oltError = res.message || 'Không tải được dữ liệu POP OLT.';
        state.oltLoginUrl = res.loginUrl || '';
      }
    } catch (err) {
      if (!state.confirmAction || state.confirmAction.id !== 'clear_osp') {
        return;
      }
      state.oltLoading = false;
      state.oltError = err && err.message ? err.message : 'Lỗi tải dữ liệu MonitorOLT.';
    }
    renderConfirm();
  }

  async function loadOltListForSelectedLocation(locationId) {
    state.oltUserTouched = true;
    state.oltAutoMatched = false;
    state.oltLocationId = locationId;
    state.oltSelectedId = '';
    state.oltSelectedPorts = [];
    state.oltShowAllPorts = false;
    state.oltLoading = true;
    state.oltError = '';
    state.oltLoginUrl = '';
    renderConfirm();

    try {
      const res = await fetchInsideOltListByLocation(locationId, { forceRefresh: true });
      if (!state.confirmAction || state.confirmAction.id !== 'clear_osp') {
        return;
      }
      state.oltLoading = false;
      if (res.status === 'ok') {
        state.oltList = Array.isArray(res.olts) ? res.olts : [];
      } else {
        state.oltError = res.message || 'Không tải được danh sách POP OLT cho vùng đã chọn.';
        state.oltLoginUrl = res.loginUrl || '';
      }
    } catch (err) {
      if (!state.confirmAction || state.confirmAction.id !== 'clear_osp') {
        return;
      }
      state.oltLoading = false;
      state.oltLoading = false;
      state.oltError = err && err.message ? err.message : 'Lỗi tải danh sách POP OLT.';
    }
    renderConfirm();
  }

  async function loadPortSlotsForModal(deviceId) {
    state.portConboxId = deviceId;
    state.portSlots = [];
    state.portSelectedPortId = '';
    state.portSelectedPortLabel = '';
    state.portHistoryOpen = false;
    state.portHistoryRows = [];
    state.portHistoryError = '';
    if (!deviceId || deviceId === '0') {
      state.portSlotsLoading = false;
      renderConfirm();
      return;
    }
    state.portSlotsLoading = true;
    renderConfirm();

    try {
      const res = await fetchPortSlotList(deviceId);
      if (!state.confirmAction || state.confirmAction.id !== 'assign_port') {
        return;
      }
      state.portSlotsLoading = false;
      if (res.status === 'ok') {
        state.portSlots = Array.isArray(res.slots) ? res.slots : [];
      } else {
        state.portModalError = res.message || 'Không tải được danh sách Port trong Hộp đấu nối.';
        state.portModalLoginUrl = res.loginUrl || '';
      }
    } catch (err) {
      if (!state.confirmAction || state.confirmAction.id !== 'assign_port') {
        return;
      }
      state.portSlotsLoading = false;
      state.portModalError = err && err.message ? err.message : 'Lỗi tải danh sách Port.';
    }
    renderConfirm();
  }

  async function loadPortConboxesForModal(popId) {
    state.portPopId = popId;
    state.portConboxes = [];
    state.portConboxId = '';
    state.portConboxSearch = '';
    state.portSlots = [];
    state.portSelectedPortId = '';
    state.portSelectedPortLabel = '';
    state.portHistoryOpen = false;
    state.portHistoryRows = [];

    const popObj = state.portPops.find((p) => p.value === popId);
    const popName = popObj ? popObj.label : '';
    if (!popId || popId === '0' || !popName) {
      state.portCascadeLoading = false;
      renderConfirm();
      return;
    }
    state.portCascadeLoading = true;
    renderConfirm();

    try {
      const res = await fetchPortConboxes(popName);
      if (!state.confirmAction || state.confirmAction.id !== 'assign_port') {
        return;
      }
      state.portCascadeLoading = false;
      if (res.status === 'ok') {
        state.portConboxes = Array.isArray(res.conboxes) ? res.conboxes : [];
        if (state.portConboxes.length === 1) {
          loadPortSlotsForModal(state.portConboxes[0].value);
          return;
        }
      } else {
        state.portModalError = res.message || 'Không tải được danh sách Hộp đấu nối.';
        state.portModalLoginUrl = res.loginUrl || '';
      }
    } catch (err) {
      if (!state.confirmAction || state.confirmAction.id !== 'assign_port') {
        return;
      }
      state.portCascadeLoading = false;
      state.portModalError = err && err.message ? err.message : 'Lỗi tải danh sách Hộp đấu nối.';
    }
    renderConfirm();
  }

  async function loadPortPopsForModal(locationId, branchId) {
    state.portBranchId = branchId;
    state.portPops = [];
    state.portPopId = '';
    state.portPopSearch = '';
    state.portConboxes = [];
    state.portConboxId = '';
    state.portConboxSearch = '';
    state.portSlots = [];
    state.portSelectedPortId = '';
    state.portSelectedPortLabel = '';
    state.portHistoryOpen = false;
    state.portHistoryRows = [];
    state.portCascadeLoading = true;
    renderConfirm();

    try {
      const res = await fetchPortPops(locationId, branchId);
      if (!state.confirmAction || state.confirmAction.id !== 'assign_port') {
        return;
      }
      state.portCascadeLoading = false;
      if (res.status === 'ok') {
        state.portPops = Array.isArray(res.pops) ? res.pops : [];
        if (state.portPops.length === 1) {
          loadPortConboxesForModal(state.portPops[0].value);
          return;
        }
      } else {
        state.portModalError = res.message || 'Không tải được danh sách POP.';
        state.portModalLoginUrl = res.loginUrl || '';
      }
    } catch (err) {
      if (!state.confirmAction || state.confirmAction.id !== 'assign_port') {
        return;
      }
      state.portCascadeLoading = false;
      state.portModalError = err && err.message ? err.message : 'Lỗi tải danh sách POP.';
    }
    renderConfirm();
  }

  async function loadPortBranchesForModal(locationId) {
    state.portLocationId = locationId;
    state.portBranches = [];
    state.portBranchId = '';
    state.portPops = [];
    state.portPopId = '';
    state.portPopSearch = '';
    state.portConboxes = [];
    state.portConboxId = '';
    state.portConboxSearch = '';
    state.portSlots = [];
    state.portSelectedPortId = '';
    state.portSelectedPortLabel = '';
    state.portCascadeLoading = true;
    renderConfirm();

    try {
      const res = await fetchPortBranches(locationId);
      if (!state.confirmAction || state.confirmAction.id !== 'assign_port') {
        return;
      }
      if (res.status === 'ok') {
        state.portBranches = Array.isArray(res.branches) ? res.branches : [];
        const nextBranch = (state.portBranches[0] && state.portBranches[0].value) || '0';
        loadPortPopsForModal(locationId, nextBranch);
        return;
      }
      state.portCascadeLoading = false;
      state.portModalError = res.message || 'Không tải được danh sách Chi nhánh.';
      state.portModalLoginUrl = res.loginUrl || '';
    } catch (err) {
      if (!state.confirmAction || state.confirmAction.id !== 'assign_port') {
        return;
      }
      state.portCascadeLoading = false;
      state.portModalError = err && err.message ? err.message : 'Lỗi tải danh sách Chi nhánh.';
    }
    renderConfirm();
  }

  async function loadPortHistoryForModal() {
    const conboxObj = state.portConboxes.find((c) => c.value === state.portConboxId);
    const pointName = conboxObj ? conboxObj.label : '';
    state.portHistoryOpen = true;
    state.portHistoryLoading = true;
    state.portHistoryError = '';
    state.portHistoryRows = [];
    renderConfirm();

    try {
      const res = await fetchPortHistory({
        pointName,
        port: state.portSelectedPortLabel,
        locationID: state.portLocationId,
      });
      if (!state.confirmAction || state.confirmAction.id !== 'assign_port') {
        return;
      }
      state.portHistoryLoading = false;
      if (res.status === 'ok') {
        state.portHistoryRows = Array.isArray(res.rows) ? res.rows : [];
      } else {
        state.portHistoryError = res.message || 'Không tải được Lịch sử Port.';
      }
    } catch (err) {
      if (!state.confirmAction || state.confirmAction.id !== 'assign_port') {
        return;
      }
      state.portHistoryLoading = false;
      state.portHistoryError = err && err.message ? err.message : 'Lỗi tải Lịch sử Port.';
    }
    renderConfirm();
  }

  async function loadPortReleaseModal(contractId) {
    state.portModalLoading = true;
    state.portModalError = '';
    state.portModalLoginUrl = '';
    state.portRecordMode = '';
    state.portDetail = null;
    state.portDetailWarn = '';
    state.portDescription = '';
    renderConfirm();

    try {
      const res = await fetchPortContractContext(contractId, { forceRefresh: true });
      if (!state.confirmAction || state.confirmAction.id !== 'release_port') {
        return;
      }
      state.portModalLoading = false;
      if (res.status === 'ok') {
        state.portRecordMode = res.recordMode || '';
        state.portDetail = res.detail || null;
        state.portDetailWarn = res.loadDataError || '';
        state.portDescription = (res.detail && res.detail.description) || '';
      } else {
        state.portModalError = res.message || 'Không tải được thông tin hợp đồng từ mvcport.fpt.net.';
        state.portModalLoginUrl = res.loginUrl || '';
      }
    } catch (err) {
      if (!state.confirmAction || state.confirmAction.id !== 'release_port') {
        return;
      }
      state.portModalLoading = false;
      state.portModalError = err && err.message ? err.message : 'Lỗi đọc dữ liệu FTTH NEW Port.';
    }
    renderConfirm();
  }

  async function loadPortAssignModal(contractId, typeContractOverride = '') {
    const activeType = typeContractOverride || state.portTypeContract || '3';
    state.portModalLoading = true;
    state.portModalError = '';
    state.portModalLoginUrl = '';
    state.portRecordMode = '';
    state.portDetail = null;
    state.portDetailWarn = '';
    state.portTypeContract = activeType;
    state.portPops = [];
    state.portPopId = '';
    state.portPopSearch = '';
    state.portConboxes = [];
    state.portConboxId = '';
    state.portConboxSearch = '';
    state.portSlots = [];
    state.portSelectedPortId = '';
    state.portSelectedPortLabel = '';
    state.portHistoryOpen = false;
    state.portHistoryRows = [];
    renderConfirm();

    try {
      const res = await fetchPortContractContext(contractId, {
        typeContract: activeType,
        forceRefresh: true,
      });
      if (!state.confirmAction || state.confirmAction.id !== 'assign_port') {
        return;
      }
      state.portModalLoading = false;
      if (res.status === 'ok') {
        state.portRecordMode = res.recordMode || '';
        state.portDetail = res.detail || null;
        state.portDetailWarn = res.loadDataError || '';
        state.portTypeContract = (res.detail && res.detail.typeContract) || activeType;
        state.portCardNumber = (res.detail && res.detail.cardNumber) || '1';
        state.portDescription = (res.detail && res.detail.description) || '';
        state.portLocations = Array.isArray(res.locations) ? res.locations : [];
        state.portLocationId =
          res.defaultLocationId || (state.portLocations[0] && state.portLocations[0].value) || '';
        state.portBranches = Array.isArray(res.branches) ? res.branches : [];
        state.portBranchId =
          res.defaultBranchId || (state.portBranches[0] && state.portBranches[0].value) || '';
        renderConfirm();
        if (state.portRecordMode !== 'not_found' && state.portLocationId) {
          loadPortPopsForModal(state.portLocationId, state.portBranchId || '0');
        }
        return;
      }
      state.portModalError = res.message || 'Không tải được thông tin cấp Port FTTH NEW.';
      state.portModalLoginUrl = res.loginUrl || '';
    } catch (err) {
      if (!state.confirmAction || state.confirmAction.id !== 'assign_port') {
        return;
      }
      state.portModalLoading = false;
      state.portModalError = err && err.message ? err.message : 'Lỗi tải form Cấp / Đổi Port.';
    }
    renderConfirm();
  }

  async function loadRecallModal(rawContractId = state.contractInput, { clearNotice = false } = {}) {
    state.recallLoading = true;
    state.recallError = '';
    if (clearNotice) {
      state.recallNotice = '';
      state.recallNoticeTone = 'info';
    }
    renderConfirm();

    const cleanId = normalizeContractId(rawContractId || '');
    try {
      const res = await loadRecallTicketContext(cleanId, {
        pageDocument,
        pageLocation: pageWindow ? pageWindow.location : null,
      });
      if (!state.confirmAction || state.confirmAction.id !== 'manage_recall') {
        return;
      }
      state.recallLoading = false;
      state.recallStatus = res.status || 'needs_recall_page';
      state.recallMode = res.mode || 'live';
      state.recallSnapshot = res.snapshot || null;
      state.recallContractMismatch = Boolean(res.contractMismatch);
      if (res.status === 'ok' && res.snapshot && res.snapshot.contract && !state.contractInput) {
        state.contractInput = res.snapshot.contract;
        setState(STORAGE_KEYS.LAST_CONTRACT, res.snapshot.contract);
        renderMain();
      }
    } catch (err) {
      if (!state.confirmAction || state.confirmAction.id !== 'manage_recall') {
        return;
      }
      state.recallLoading = false;
      state.recallError = err && err.message ? err.message : 'Lỗi đọc dữ liệu phiếu thu hồi.';
    }
    renderConfirm();
  }

  function collapseForRecallDialog(actionLabel) {
    state.recallReturnPending = true;
    state.recallReturnLabel = actionLabel;
    state.recallArmedCreate = false;
    state.recallNotice = `Đã mở "${actionLabel}" trên trang gốc. Xong việc bấm nút nổi để quay lại & làm mới.`;
    state.recallNoticeTone = 'info';
    state.isOpen = false;
    render();
  }

  async function openRecallPortalWithContract(rawContractId) {
    const clean = normalizeContractId(rawContractId || '');
    if (clean) {
      setPendingRecallContract(clean);
      await copyTextSafe(clean);
      state.recentContracts = addRecentContract(clean);
    }
    openExternalOrPortalUrl(RECALL_ENDPOINTS.base, {
      mode: 'portal',
      title: 'Thu hồi vật tư NextGen',
      pageWindow,
    });
    if (state.confirmAction && state.confirmAction.id === 'manage_recall') {
      state.recallNotice = clean
        ? `Đã mở NextGen và gửi lệnh tự tìm HĐ ${clean} (cũng đã chép sẵn vào bộ nhớ tạm).`
        : 'Đã mở trang Thu hồi vật tư NextGen.';
      state.recallNoticeTone = 'ok';
      renderConfirm();
    }
  }

  function pickMatchingFilterOpt(options, target) {
    if (!target) return '';
    const key = normalizeEquipmentMatchKey(target);
    const list = Array.isArray(options) ? options : [];
    return list.find((opt) => normalizeEquipmentMatchKey(opt) === key) || target;
  }

  function isSameEquipmentFilter(a, b) {
    if (!a || !b) return false;
    return (
      normalizeEquipmentMatchKey(a.region) === normalizeEquipmentMatchKey(b.region) &&
      normalizeEquipmentMatchKey(a.province) === normalizeEquipmentMatchKey(b.province) &&
      normalizeEquipmentMatchKey(a.partner) === normalizeEquipmentMatchKey(b.partner)
    );
  }

  function syncEquipDebtDraftFromPage() {
    if (!pageDocument) return;
    const rInfo = readEquipmentFilterOptions(pageDocument, 'region');
    const pInfo = readEquipmentFilterOptions(pageDocument, 'province');
    const prInfo = readEquipmentFilterOptions(pageDocument, 'partner');
    const activeFilter = getEffectiveEquipmentDebtFilter();
    state.equipDebtSavedFilter = activeFilter;
    state.equipDebtRegionOpts = rInfo.options || [];
    state.equipDebtProvinceOpts = pInfo.options || [];
    state.equipDebtPartnerOpts = prInfo.options || [];
    state.equipDebtDraftRegion = pickMatchingFilterOpt(
      state.equipDebtRegionOpts,
      rInfo.current || activeFilter.region
    );
    state.equipDebtDraftProvince = pickMatchingFilterOpt(
      state.equipDebtProvinceOpts,
      pInfo.current || activeFilter.province
    );
    state.equipDebtDraftPartner = pickMatchingFilterOpt(
      state.equipDebtPartnerOpts,
      prInfo.current || activeFilter.partner
    );
  }

  async function loadEquipmentDebtModal({ allowAutoSetup = true, autoDepth = 0 } = {}) {
    const customSavedFilter = getEquipmentDebtFilter();
    const activeFilter = getEffectiveEquipmentDebtFilter();
    state.equipDebtSavedFilter = activeFilter;
    state.equipDebtLoading = true;
    state.equipDebtProgress = 'Đang đọc bảng Tồn công nợ theo NV…';
    state.equipDebtError = '';
    state.equipDebtNotice = '';
    renderConfirm();

    const setModalProgress = (msg) => {
      if (!state.confirmAction || state.confirmAction.id !== 'equipment_debt') return;
      if (msg && msg !== state.equipDebtProgress) {
        state.equipDebtProgress = msg;
        renderConfirm();
      }
    };

    try {
      const res = await loadEquipmentDebtContext({
        pageDocument,
        pageLocation: pageWindow ? pageWindow.location : null,
        onProgress: (p) => {
          const nextMsg = `Đang gom trang ${p.currentPage}/${p.totalPages} (${p.collectedStaff}${
            p.totalItems ? `/${p.totalItems}` : ''
          } KTV)…`;
          setModalProgress(nextMsg);
        },
      });
      if (!state.confirmAction || state.confirmAction.id !== 'equipment_debt') {
        return;
      }

      state.equipDebtHasTab = Boolean(res.hasDebtTab);
      state.equipDebtTabActive = Boolean(res.isDebtTabActive);
      state.equipDebtHasViewBtn = Boolean(res.hasViewListBtn);
      state.equipDebtHasReportMenu = Boolean(res.hasReportMenuBtn);
      state.equipDebtFilterMissing = Boolean(res.filterMissing);

      // Tu dong dieu huong & nap du lieu theo bo loc co dinh (neu chua bi chan boi depth)
      if (res.status === 'needs_report_loaded' && allowAutoSetup && autoDepth < 3 && pageDocument) {
        if (!res.hasDebtTab && res.hasReportMenuBtn) {
          setModalProgress('Đang tự mở Báo cáo → Báo cáo nợ…');
          const mRes = await triggerEquipmentOpenDebtReportMenu(pageDocument);
          if (!state.confirmAction || state.confirmAction.id !== 'equipment_debt') return;
          if (mRes.ok) {
            await waitForEquipmentDebtTabOpen(pageDocument, { timeoutMs: 4500 });
            if (!state.confirmAction || state.confirmAction.id !== 'equipment_debt') return;
            return loadEquipmentDebtModal({ allowAutoSetup: true, autoDepth: autoDepth + 1 });
          }
        } else if (res.hasDebtTab && !res.isDebtTabActive) {
          setModalProgress('Đang chuyển sang tab Tồn công nợ theo NV…');
          const tRes = triggerEquipmentDebtTab(pageDocument);
          if (tRes.ok) {
            await new Promise((r) => setTimeout(r, 700));
            if (!state.confirmAction || state.confirmAction.id !== 'equipment_debt') return;
            return loadEquipmentDebtModal({ allowAutoSetup: true, autoDepth: autoDepth + 1 });
          }
        } else if (res.hasDebtTab && res.isDebtTabActive) {
          if (res.filterMissing) {
            const applyRes = await applyEquipmentDebtFilterToPage(pageDocument, activeFilter, {
              onProgress: setModalProgress,
            });
            if (!state.confirmAction || state.confirmAction.id !== 'equipment_debt') return;
            if (!applyRes.ok) {
              state.equipDebtLoading = false;
              state.equipDebtProgress = '';
              state.equipDebtStatus = 'needs_report_loaded';
              state.equipDebtNotice = `${applyRes.error} Hãy chọn lại bộ lọc cố định bên dưới.`;
              state.equipDebtNoticeTone = 'warn';
              syncEquipDebtDraftFromPage();
              state.equipDebtFilterEditOpen = true;
              renderConfirm();
              return;
            }
          }

          if (res.hasViewListBtn) {
            setModalProgress('Đang bấm "Xem danh sách" & chờ bảng tải…');
            const vRes = triggerEquipmentDebtViewList(pageDocument);
            if (vRes.ok) {
              await waitForEquipmentReportLoad(pageDocument, { timeoutMs: 20000 });
              if (!state.confirmAction || state.confirmAction.id !== 'equipment_debt') return;
              return loadEquipmentDebtModal({ allowAutoSetup: false, autoDepth: autoDepth + 1 });
            }
          }
        }
      }

      state.equipDebtLoading = false;
      state.equipDebtProgress = '';
      state.equipDebtStatus = res.status || 'needs_equipment_page';
      state.equipDebtMode = res.mode || 'live';
      state.equipDebtError = '';

      if (res.status === 'ok' && res.dataset) {
        if (
          !customSavedFilter &&
          res.currentFilter &&
          res.currentFilter.region &&
          res.currentFilter.province &&
          res.currentFilter.partner &&
          !isSameEquipmentFilter(res.currentFilter, DEFAULT_EQUIPMENT_DEBT_FILTER)
        ) {
          setEquipmentDebtFilter(res.currentFilter);
          state.equipDebtSavedFilter = res.currentFilter;
        } else {
          state.equipDebtSavedFilter = activeFilter;
        }
        state.equipDebtDataset = res.dataset;
        const mats = res.dataset.materials || [];
        const hasCurrentMat = mats.some((m) => m.key === state.equipDebtSelectedKey);
        if (!hasCurrentMat) {
          const firstActive = mats.find((m) => m.holderCount > 0) || mats[0];
          state.equipDebtSelectedKey = firstActive ? firstActive.key : '';
        }
        const rows = res.dataset.rows || [];
        const hasCurrentStaff = rows.some((r) => r.staff === state.equipDebtSelectedStaff);
        if (!hasCurrentStaff) {
          const firstWithStock =
            rows.find((r) => Object.keys(r.stocks || {}).length > 0) || rows[0];
          state.equipDebtSelectedStaff = firstWithStock ? firstWithStock.staff : '';
        }
        addLog(
          'Vật tư',
          'Đọc tồn nợ KTV',
          `${res.dataset.totalStaff} KTV • ${res.dataset.activeMaterials} VT`,
          'ok'
        );
      } else {
        state.equipDebtDataset = null;
        if (res.status === 'needs_report_loaded' && res.hasDebtTab) {
          syncEquipDebtDraftFromPage();
        }
        if (res.status !== 'ok' && res.message) {
          state.equipDebtNotice = res.message;
          state.equipDebtNoticeTone = 'warn';
        }
      }
    } catch (err) {
      if (!state.confirmAction || state.confirmAction.id !== 'equipment_debt') {
        return;
      }
      state.equipDebtLoading = false;
      state.equipDebtProgress = '';
      state.equipDebtError = err && err.message ? err.message : 'Lỗi đọc báo cáo tồn nợ vật tư.';
    }
    renderConfirm();
  }

  async function triggerAction(action) {
    if (state.isRunning) return;

    const requiresContract = action.requiresContract !== false;
    const check = validateContractId(state.contractInput);
    if (requiresContract) {
      if (!check.valid) {
        state.result = {
          status: 'validation_error',
          title: 'Thiếu Mã hợp đồng',
          message: check.error,
        };
        renderMain();
        return;
      }
      state.contractInput = check.value;
    } else {
      state.contractInput = normalizeContractId(state.contractInput || '');
    }

    if (action.requiresConfirm) {
      resetConfirmState();
      state.confirmAction = action;
      renderConfirm();
      if (state.activePortalId === 'inside' && action.id === 'reset_mac') {
        loadModemInfoForModal(state.contractInput);
      } else if (state.activePortalId === 'inside' && action.id === 'reset_mac_box') {
        loadBoxMacsForModal(state.contractInput);
      } else if (state.activePortalId === 'inside' && action.id === 'kill_session') {
        loadKillSessionsForModal(state.contractInput);
      } else if (state.activePortalId === 'inside' && action.id === 'clear_osp') {
        loadOltDataForModal(false);
        if (state.contractInput) {
          loadContractOltContextForModal(state.contractInput);
        }
      } else if (state.activePortalId === 'inside' && action.id === 'bypass') {
        loadInsideByPassModal(state.contractInput);
      } else if (state.activePortalId === 'inside' && action.id === 'deploy_ticket') {
        loadDeployTicketModal(state.contractInput);
      } else if (state.activePortalId === 'port' && action.id === 'release_port') {
        loadPortReleaseModal(state.contractInput);
      } else if (state.activePortalId === 'port' && action.id === 'assign_port') {
        loadPortAssignModal(state.contractInput);
      } else if (state.activePortalId === 'recall' && action.id === 'manage_recall') {
        loadRecallModal(state.contractInput, { clearNotice: true });
      } else if (state.activePortalId === 'recall' && action.id === 'equipment_debt') {
        loadEquipmentDebtModal();
      }
      return;
    }

    await runConfirmedAction(action);
  }

  async function runConfirmedAction(action, actionCtx = {}) {
    if (state.isRunning) return;
    const portal = PORTALS[state.activePortalId];
    const contractId = normalizeContractId(state.contractInput);

    resetConfirmState();
    state.isRunning = true;
    state.runningActionId = action.id;
    if (contractId) {
      state.recentContracts = addRecentContract(contractId);
    }
    render();

    const portSummary = Array.isArray(actionCtx.ports) ? actionCtx.ports.join(',') : '';
    const isClearOsp = portal.id === 'inside' && action.id === 'clear_osp';
    const isInsideBypassLog = portal.id === 'inside' && action.id === 'bypass';
    const isKillSession = portal.id === 'inside' && action.id === 'kill_session';
    const isPortAssignLog = portal.id === 'port' && action.id === 'assign_port';
    const isPortReleaseLog = portal.id === 'port' && action.id === 'release_port';
    const logActionLabel = action.label;
    let logTarget = contractId;
    if (isClearOsp && actionCtx.oltName) {
      const baseOlt = portSummary ? `${actionCtx.oltName} (P:${portSummary})` : actionCtx.oltName;
      logTarget = contractId ? `${contractId} • ${baseOlt}` : baseOlt;
    } else if (isInsideBypassLog) {
      const bpTarget = actionCtx.contract || contractId;
      const bpLabel =
        actionCtx.mode === 'delete'
          ? 'Xóa ByPass'
          : getByPassTypeLabel(actionCtx.typeByPass || '');
      logTarget = [bpTarget, bpLabel].filter(Boolean).join(' • ');
    } else if (isKillSession && actionCtx.ipAddress) {
      logTarget = contractId ? `${contractId} • ${actionCtx.ipAddress}` : actionCtx.ipAddress;
    } else if (isPortAssignLog && actionCtx.deviceName) {
      const baseDev = actionCtx.port ? `${actionCtx.deviceName} (${actionCtx.port})` : actionCtx.deviceName;
      logTarget = contractId ? `${contractId} • ${baseDev}` : baseDev;
    } else if (isPortReleaseLog) {
      logTarget = contractId ? `${contractId} • Thu hồi` : 'Thu hồi';
    }

    try {
      const res = await executePortalAction(portal.id, action.id, contractId, {
        ...actionCtx,
        pageDocument,
        pageLocation: pageWindow ? pageWindow.location : null,
      });
      state.result = res;
      if (Array.isArray(res.embeddedViews)) {
        const nextOpen = {};
        for (const v of res.embeddedViews) {
          nextOpen[v.id] = Boolean(v.defaultOpen);
        }
        state.openViews = nextOpen;
        state.viewReloadKeys = {};
      } else {
        state.openViews = {};
      }

      const logKind =
        res.status === 'ok'
          ? 'ok'
          : res.status === 'needs_scan' || res.status === 'iam_expired'
          ? 'warn'
          : 'error';
      addLog(portal.label, logActionLabel, logTarget, logKind);

      if (res.status === 'iam_expired') {
        state.sessionStatus = {
          state: 'iam_expired',
          label:
            portal.id === 'port' && isLoggedInPortHost()
              ? 'Chưa bật FTTH NEW'
              : 'Cần đăng nhập IAM',
          loginUrl: res.loginUrl || portal.url,
          detail: res.message,
        };
      }
    } catch (err) {
      state.result = {
        status: 'error',
        title: 'Có lỗi khi xử lý',
        message: err && err.message ? err.message : 'Không rõ nguyên nhân.',
      };
      addLog(portal.label, logActionLabel, logTarget, 'error');
    } finally {
      state.isRunning = false;
      state.runningActionId = '';
      render();
    }
  }

  async function handleCopyAndOpenPortal() {
    const portal = PORTALS[state.activePortalId];
    const clean = normalizeContractId(state.contractInput);
    if (clean) {
      await copyTextSafe(clean);
      state.recentContracts = addRecentContract(clean);
    }
    openExternalOrPortalUrl(portal.url, {
      mode: 'portal',
      title: portal.fullName,
      pageWindow,
    });
    state.result = {
      status: 'ok',
      title: clean
        ? `Đã sao chép ${clean} & mở ${portal.fullName}`
        : `Đã mở ${portal.fullName}`,
      message: clean
        ? 'Mã hợp đồng đã nằm sẵn trong bộ nhớ tạm — sang tab mới bạn chỉ cần chạm Dán.'
        : 'Bạn có thể đăng nhập hoặc tra cứu trực tiếp trên tab vừa mở.',
    };
    render();
  }

  function handleTakeDomSnapshot() {
    const contractId = normalizeContractId(state.contractInput);
    state.domSnapshot = scanPageStructure(
      pageDocument,
      pageWindow ? pageWindow.location : undefined,
      contractId
    );
    state.copyNotice = 'Đã chụp xong cấu trúc trang hiện tại (đã lọc thông tin nhạy cảm).';
    renderScanner();
  }

  async function handleCurrentPageDeepScan() {
    if (state.isDeepScanning) return;
    state.isDeepScanning = true;
    state.copyNotice =
      'Đang quét sâu mã JS & danh sách chọn của trang đang mở (chỉ đọc, đã lọc thông tin nhạy cảm)…';
    renderScanner();

    try {
      const contractId = normalizeContractId(state.contractInput);
      const loc = pageWindow && pageWindow.location ? pageWindow.location : undefined;
      state.domSnapshot = scanPageStructure(pageDocument, loc, contractId);

      const pageHref = (loc && loc.href) || '';
      const origin = (loc && loc.origin && loc.origin !== 'null' ? loc.origin : '') || '';
      const pathname = (loc && loc.pathname) || '';
      const htmlText =
        (pageDocument && pageDocument.documentElement && pageDocument.documentElement.outerHTML) ||
        '';

      const controlsMeta = extractFormControlsMeta(htmlText, contractId);
      const ajaxSigs = extractAjaxSignaturesFromHtml(htmlText, pageHref, contractId);
      const apiHints = extractApiHintsFromHtml(htmlText, pageHref, contractId);
      const inlineScripts = extractInlineScriptsSanitized(htmlText, contractId, {
        maxPerScript: 45000,
        maxTotal: 90000,
      });

      const VENDOR_SCRIPT_RE =
        /(?:jquery|kendo|bootstrap|modernizr|toastr|jszip|xlsx|moment|lodash|popper|fontawesome|select2|datatables|chart\.js|echarts|polyfill|fullcalendar|vuetify|iconify|mdi)/i;
      const perfEntries =
        pageWindow &&
        pageWindow.performance &&
        typeof pageWindow.performance.getEntriesByType === 'function'
          ? pageWindow.performance.getEntriesByType('resource')
          : [];
      const domScriptUrls =
        pageDocument && pageDocument.scripts
          ? Array.from(pageDocument.scripts)
              .map((s) => (s && s.src ? String(s.src).trim() : ''))
              .filter(Boolean)
          : [];
      const rawCandidateUrls = [
        ...domScriptUrls,
        ...(Array.isArray(apiHints.scriptUrls) ? apiHints.scriptUrls : []),
        ...extractNextAppChunkUrls(htmlText, pageHref),
        ...extractSpaChunkUrls(htmlText, pageHref, perfEntries),
      ];
      const sortedCandidateUrls = [
        ...rawCandidateUrls.filter((u) => /(?:\/chunks\/app\/|\/page-)/i.test(u)),
        ...rawCandidateUrls.filter((u) => !/(?:\/chunks\/app\/|\/page-)/i.test(u)),
      ];
      const seenScripts = new Set();
      const customScriptUrls = [];
      for (const rawUrl of sortedCandidateUrls) {
        if (!rawUrl || seenScripts.has(rawUrl) || VENDOR_SCRIPT_RE.test(rawUrl)) {
          continue;
        }
        try {
          const parsed = new URL(rawUrl, pageHref || undefined);
          if (origin && parsed.origin !== origin) {
            continue;
          }
          if (!seenScripts.has(parsed.href)) {
            seenScripts.add(parsed.href);
            customScriptUrls.push(parsed.href);
            if (customScriptUrls.length >= 45) break;
          }
        } catch {
          // skip malformed script URL
        }
      }

      const collectedSnippets = [];
      if (isUserscriptEnv() && customScriptUrls.length > 0) {
        const settled = await Promise.allSettled(
          customScriptUrls.map((url) => requestPortal({ url, method: 'GET', timeout: 10000 }))
        );
        for (let i = 0; i < customScriptUrls.length; i += 1) {
          const cUrl = customScriptUrls[i];
          const item = settled[i];
          const res = item && item.status === 'fulfilled' ? item.value : null;
          if (!res || !res.ok || !res.responseText || res.responseText.length > 1.5 * 1024 * 1024) {
            continue;
          }
          let jsOrigin = origin;
          let jsPath = cUrl;
          try {
            const parsed = new URL(cUrl);
            jsOrigin = parsed.origin;
            jsPath = parsed.pathname;
          } catch {
            // keep defaults
          }
          const chunkApiHints = extractApiHintsFromJs(res.responseText, contractId);
          const codeContexts = extractCodeContextsFromJs(
            res.responseText,
            /(?:\$fetch\s*\(|\/api\/|x-resource-grant|setGrant|GET_TICKET_INFO|get-ticket-info|GET_CONFIG_BY_PARENT|get-config-by-parent|GET_EQUIPMENT_ON_DEP|get-equipment-on-dep|CLEAR_EQUIPMENT|clear-equipment|ClearMac|CHANGE_EQUIPMENT|change-equipment|UPDATE_EQUIPMENT_IMPORT|update-equipment-import|UPDATE_EQUIPMENT_REVOKE|update-equipment-revoke|SYNC_ONLINE|sync-online|\/status\/completed|OutDoorReUsed|ReasonDelay|NotComplete|HiFPT|CapLan|reveal-phone|get-contract-phone|get-e-contract-record|sign-econtract|getContract|NetworkConnection|statusNAT|statusIPv6|descriptionNAT|descriptionIPv6|ByPass\s*NAT|Default\s*NAT|killSession|isKill|ngắt\s*phiên|không\s*dấu|khong\s*dau|ActiveProfile|VerifyIPv6|coAID|spamPool|ipV6Only|accesstoken_iam_radius|ChangeNetworkConnection)/i,
            contractId,
            { maxTotal: 55000, maxContexts: 65, radius: 480 }
          );
          if (chunkApiHints.length > 0 || codeContexts.length > 0) {
            const routeBoost = /\/chunks\/app\/(?!layout-|loading-|not-found-|login\/)/i.test(jsPath)
              ? 50
              : 0;
            collectedSnippets.push({
              score: chunkApiHints.length * 3 + codeContexts.length * 2 + routeBoost,
              snippet: {
                origin: jsOrigin,
                pathname: jsPath,
                apiHints: chunkApiHints,
                codeContexts,
              },
            });
          }
        }
      }
      collectedSnippets.sort((a, b) => b.score - a.score);
      const jsSnippets = collectedSnippets.slice(0, 16).map((entry) => entry.snippet);

      state.deepScan = {
        scanKind: 'current_page_v1',
        scannedAt: new Date().toISOString(),
        origin,
        pathname,
        title: (state.domSnapshot && state.domSnapshot.title) || '',
        controlsMeta,
        ajaxCalls: ajaxSigs.ajaxCalls || [],
        apiHints: apiHints.apiHints || [],
        scriptUrls: apiHints.scriptUrls || [],
        inlineScripts,
        jsSnippets,
      };
      state.copyNotice = `Đã quét sâu trang hiện tại: ${inlineScripts.length} đoạn mã JS, ${
        controlsMeta.selects.length
      } danh sách chọn, ${(ajaxSigs.ajaxCalls || []).length} lệnh mạng. Hãy bấm "Tải file JSON" bên dưới.`;
    } catch (err) {
      state.copyNotice = `Có lỗi khi quét sâu trang hiện tại: ${
        err && err.message ? err.message : 'Không rõ nguyên nhân'
      }`;
    } finally {
      state.isDeepScanning = false;
      renderScanner();
    }
  }

  function handleToggleRecording() {
    if (!state.isRecording) {
      recorder.clear();
      const started = recorder.start();
      if (!started) return;
      state.isRecording = true;
      state.recordedEntries = [];
      state.copyNotice =
        'Đang ghi mẫu thao tác mạng. Hãy bấm tra cứu / xử lý trên trang gốc rồi bấm nút đỏ để dừng.';

      if (!standalone) {
        state.isOpen = false;
      }

      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(() => {
        if (!state.isRecording) return;
        const latest = recorder.getEntries();
        if (latest.length !== state.recordedEntries.length) {
          state.recordedEntries = latest;
          render();
        }
      }, 600);
      render();
    } else {
      recorder.stop();
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      state.isRecording = false;
      state.recordedEntries = recorder.getEntries();
      if (!state.domSnapshot) {
        state.domSnapshot = scanPageStructure(
          pageDocument,
          pageWindow ? pageWindow.location : undefined,
          normalizeContractId(state.contractInput)
        );
      }
      state.isOpen = true;
      state.scannerOpen = true;
      state.copyNotice = `Đã dừng ghi! Thu được ${state.recordedEntries.length} thao tác mạng đã làm sạch.`;
      render();
    }
  }

  async function handleDeepScan() {
    if (state.isDeepScanning) return;
    if (!isUserscriptEnv()) {
      state.copyNotice =
        'Tính năng Quét API phụ chỉ chạy khi bạn đang mở trang FPT qua Tampermonkey.';
      renderScanner();
      return;
    }

    state.isDeepScanning = true;
    state.copyNotice =
      'Đang đọc cấu trúc 5 mục phụ + Reset MAC / Kill Session (chỉ đọc, không tác động dữ liệu)…';
    renderScanner();

    try {
      const contractId = normalizeContractId(state.contractInput);
      let cached = contractId ? getCachedInsideContract(contractId) : null;
      if (contractId && !cached) {
        await runInsideAction('lookup', contractId);
        cached = getCachedInsideContract(contractId);
      }

      const objID = cached && cached.objID ? String(cached.objID) : '';
      const accountQuery = (cached && cached.accountName) || contractId || '';

      const targets = [
        {
          key: 'radius_params',
          url: `http://radius-portal.fpt.net/public/partial/connection-parameters?ObjID=${encodeURIComponent(
            objID
          )}`,
        },
        {
          key: 'radius_online',
          url: `http://radius-portal.fpt.net/public/partial/online-session?query=${encodeURIComponent(
            accountQuery
          )}`,
        },
        {
          key: 'radius_errors',
          url: `http://radius-portal.fpt.net/public/partial/last-access-error?query=${encodeURIComponent(
            accountQuery
          )}`,
        },
        {
          key: 'iptv',
          url: `http://mvc.inside.fpt.net/iptvinfo/infobox?objid=${encodeURIComponent(objID)}`,
        },
        {
          key: 'camera',
          url: `http://mvc.inside.fpt.net/iptvinfo/infocamera?objid=${encodeURIComponent(objID)}`,
        },
        {
          key: 'reset_mac',
          url: 'http://mvc.inside.fpt.net/DSLLLine/ResetMAC/',
        },
        {
          key: 'kill_session',
          url: 'http://mvc.inside.fpt.net/KillSession/KillSession/',
        },
      ];

      const settled = await Promise.allSettled(
        targets.map((t) =>
          requestPortal({
            url: t.url,
            method: 'GET',
            headers: { Accept: 'text/html, */*' },
            timeout: 12000,
          })
        )
      );

      const pages = [];
      const radiusScripts = [];
      const otherScripts = [];
      const seenScripts = new Set();

      for (let i = 0; i < targets.length; i += 1) {
        const t = targets[i];
        const item = settled[i];
        const res = item && item.status === 'fulfilled' ? item.value : null;
        let pathname = '';
        try {
          pathname = new URL(t.url).pathname;
        } catch {
          pathname = '';
        }

        if (!res || !res.ok || !res.responseText) {
          pages.push({
            key: t.key,
            pathname,
            status: (res && res.status) || 0,
            error: (res && res.error) || 'REQUEST_FAILED',
          });
          continue;
        }

        const iam = detectIamRedirect({
          status: res.status,
          finalUrl: res.finalUrl,
          responseText: res.responseText,
          requestedUrl: t.url,
        });
        const extracted = extractApiHintsFromHtml(res.responseText, t.url, contractId);
        pages.push({
          key: t.key,
          pathname,
          status: res.status,
          iamExpired: iam.expired,
          ...extracted,
        });

        for (const sUrl of extracted.scriptUrls || []) {
          if (seenScripts.has(sUrl)) continue;
          seenScripts.add(sUrl);
          if (/\/chunks\/(?:4bd1b696|1684|main-app|layout|loading)-/i.test(sUrl)) {
            continue;
          }
          if (/IPTVInfoBox\.js|IPTVinfoCamera\.js|\/app\/.*\/page-.*\.js/i.test(sUrl)) {
            radiusScripts.push(sUrl);
          } else {
            otherScripts.push(sUrl);
          }
        }
      }

      const candidateScripts = [...radiusScripts, ...otherScripts].slice(0, 3);
      const scriptBundleHints = [];
      if (candidateScripts.length > 0) {
        const jsSettled = await Promise.allSettled(
          candidateScripts.map((url) =>
            requestPortal({ url, method: 'GET', timeout: 12000 })
          )
        );
        for (let i = 0; i < candidateScripts.length; i += 1) {
          const sUrl = candidateScripts[i];
          const item = jsSettled[i];
          const res = item && item.status === 'fulfilled' ? item.value : null;
          if (!res || !res.ok || !res.responseText || res.responseText.length > 2 * 1024 * 1024) {
            continue;
          }
          let sOrigin = '';
          let sPath = sUrl;
          try {
            const parsed = new URL(sUrl);
            sOrigin = parsed.origin;
            sPath = parsed.pathname;
          } catch {
            // keep string
          }
          scriptBundleHints.push({
            origin: sOrigin,
            pathname: sPath,
            apiHints: extractApiHintsFromJs(res.responseText, contractId),
          });
        }
      }

      state.deepScan = {
        scannedAt: new Date().toISOString(),
        hasContractContext: Boolean(objID),
        pages,
        scriptBundleHints,
      };

      const okPages = pages.filter((p) => p.status >= 200 && p.status < 400 && !p.iamExpired).length;
      const uniqueHints = new Set();
      for (const p of pages) {
        for (const h of p.apiHints || []) uniqueHints.add(h);
      }
      for (const sb of scriptBundleHints) {
        for (const h of sb.apiHints || []) uniqueHints.add(h);
      }
      state.copyNotice = `Đã quét xong ${okPages}/${targets.length} màn hình phụ (tìm thấy ${uniqueHints.size} gợi ý API). Hãy bấm "Sao chép báo cáo gửi AI" bên dưới!`;
    } catch (err) {
      state.copyNotice = `Có lỗi khi quét nhanh API phụ: ${
        err && err.message ? err.message : 'Không rõ nguyên nhân'
      }`;
    } finally {
      state.isDeepScanning = false;
      renderScanner();
    }
  }

  async function handleOpsSignatureScan() {
    if (state.isDeepScanning) return;
    if (!isUserscriptEnv()) {
      state.copyNotice =
        'Tính năng Quét tham số chỉ chạy khi đang mở trang FPT qua Tampermonkey.';
      renderScanner();
      return;
    }

    state.isDeepScanning = true;
    state.copyNotice =
      'Đang đọc mã Kill Session (IP), Reset MAC & chunk Thông số kết nối (chỉ đọc, không tác động dữ liệu)…';
    renderScanner();

    try {
      const contractId = normalizeContractId(state.contractInput);
      let cached = contractId ? getCachedInsideContract(contractId) : null;
      if (contractId && (!cached || !cached.objID)) {
        const info = await fetchInsideModemInfo(contractId);
        if (info && info.status === 'ok') {
          cached = getCachedInsideContract(contractId);
        }
      }
      const objID = cached && cached.objID ? String(cached.objID) : '';
      const accountQuery = (cached && cached.accountName) || contractId || '';

      const targets = [
        {
          key: 'kill_session',
          url: 'http://mvc.inside.fpt.net/KillSession/KillSession/',
          scriptOpts: { maxPerScript: 24000, maxTotal: 32000 },
        },
        {
          key: 'reset_mac_modem',
          url: 'http://mvc.inside.fpt.net/DSLLLine/ResetMAC/',
          scriptOpts: { maxPerScript: 24000, maxTotal: 32000 },
        },
        {
          key: 'replace_mac_box',
          url: 'http://mvc.inside.fpt.net/Contract/IPTVReplaceMAC/ReplaceMAC',
          scriptOpts: { maxPerScript: 28000, maxTotal: 36000 },
        },
        {
          key: 'radius_params',
          url: `http://radius-portal.fpt.net/public/partial/connection-parameters?ObjID=${encodeURIComponent(
            objID
          )}`,
          isRadius: true,
        },
        {
          key: 'radius_online',
          url: `http://radius-portal.fpt.net/public/partial/online-session?query=${encodeURIComponent(
            accountQuery
          )}`,
          isRadius: true,
        },
      ];

      const settled = await Promise.allSettled(
        targets.map((t) =>
          requestPortal({
            url: t.url,
            method: 'GET',
            headers: { Accept: 'text/html, */*' },
            timeout: 12000,
          })
        )
      );

      const pages = [];
      const nextChunkUrls = [];
      const seenChunks = new Set();

      for (let i = 0; i < targets.length; i += 1) {
        const t = targets[i];
        const item = settled[i];
        const res = item && item.status === 'fulfilled' ? item.value : null;
        let pathname = '';
        try {
          pathname = new URL(t.url).pathname;
        } catch {
          pathname = '';
        }

        if (!res || !res.ok || !res.responseText) {
          pages.push({
            key: t.key,
            pathname,
            status: (res && res.status) || 0,
            error: (res && res.error) || 'REQUEST_FAILED',
          });
          continue;
        }

        const iam = detectIamRedirect({
          status: res.status,
          finalUrl: res.finalUrl,
          responseText: res.responseText,
          requestedUrl: t.url,
        });
        const hints = extractApiHintsFromHtml(res.responseText, t.url, contractId);

        if (t.isRadius) {
          const chunkUrls = extractNextAppChunkUrls(res.responseText, t.url);
          for (const cu of chunkUrls) {
            if (!seenChunks.has(cu)) {
              seenChunks.add(cu);
              nextChunkUrls.push(cu);
            }
          }
          pages.push({
            key: t.key,
            pathname,
            status: res.status,
            iamExpired: iam.expired,
            scriptUrls: hints.scriptUrls,
            nextChunkUrls: chunkUrls,
            apiHints: hints.apiHints,
          });
        } else {
          const sigs = extractAjaxSignaturesFromHtml(res.responseText, t.url, contractId);
          const controlsMeta = extractFormControlsMeta(res.responseText, contractId);
          const inlineScripts = extractInlineScriptsSanitized(
            res.responseText,
            contractId,
            t.scriptOpts
          );
          pages.push({
            key: t.key,
            pathname,
            status: res.status,
            iamExpired: iam.expired,
            ajaxCalls: sigs.ajaxCalls,
            controlsMeta,
            forms: hints.forms,
            fields: hints.fields,
            buttons: hints.buttons,
            scriptUrls: hints.scriptUrls,
            apiHints: hints.apiHints,
            inlineScripts,
          });
        }
      }

      const candidateChunks = nextChunkUrls.slice(0, 4);
      const radiusChunkSnippets = [];
      if (candidateChunks.length > 0) {
        const chunkSettled = await Promise.allSettled(
          candidateChunks.map((url) =>
            requestPortal({ url, method: 'GET', timeout: 12000 })
          )
        );
        for (let i = 0; i < candidateChunks.length; i += 1) {
          const cUrl = candidateChunks[i];
          const item = chunkSettled[i];
          const res = item && item.status === 'fulfilled' ? item.value : null;
          if (
            !res ||
            !res.ok ||
            !res.responseText ||
            res.responseText.length > 1.5 * 1024 * 1024
          ) {
            continue;
          }
          let cOrigin = '';
          let cPath = cUrl;
          try {
            const parsed = new URL(cUrl);
            cOrigin = parsed.origin;
            cPath = parsed.pathname;
          } catch {
            // keep string
          }
          radiusChunkSnippets.push({
            origin: cOrigin,
            pathname: cPath,
            apiHints: extractApiHintsFromJs(res.responseText, contractId),
            codeContexts: extractCodeContextsFromJs(res.responseText, undefined, contractId),
          });
        }
      }

      state.deepScan = {
        scanKind: 'ops_kill_radius_v3',
        scannedAt: new Date().toISOString(),
        hasContractContext: Boolean(objID),
        pages,
        radiusChunkSnippets,
      };

      state.copyNotice =
        'Đã quét xong mã Kill Session (IP) & Thông số kết nối! Hãy bấm "Tải file JSON" lưu vào thư mục Remote inside/scans rồi nhắn mình "đã lưu file" nhé.';
    } catch (err) {
      state.copyNotice = `Có lỗi khi quét tham số: ${
        err && err.message ? err.message : 'Không rõ nguyên nhân'
      }`;
    } finally {
      state.isDeepScanning = false;
      renderScanner();
    }
  }

  async function handlePortDeepScan() {
    if (state.isDeepScanning) return;
    if (!isUserscriptEnv()) {
      state.copyNotice =
        'Tính năng Quét cổng Port chỉ chạy khi đang mở trang FPT qua Tampermonkey.';
      renderScanner();
      return;
    }

    state.isDeepScanning = true;
    state.copyNotice =
      'Đang quét tự động cấu trúc port.fpt.net & mvcport.fpt.net (chỉ đọc, không cần F5 trang Port)…';
    renderScanner();

    try {
      const contractId = normalizeContractId(state.contractInput);
      const isPortHost = (origin) => /^https?:\/\/(?:mvc)?port\.fpt\.net$/i.test(String(origin || '').trim());
      const PORT_JS_KEYWORD_RE =
        /(?:port|ftth|cap|thuhoi|release|assign|swap|contract|hopdong|olt|pon|splitter|mvcport|ajax|fetch|post|get|search|detail|status|history|save|update|delete|url\s*:)/i;
      const PORT_LINK_PRIORITY_RE =
        /(?:ftth|port|cap|cấp|thu\s*h[oồ]i|release|assign|swap|doi|đổi|xem|tra|tim|search|contract|hop\s*dong|hd|olt|pon|splitter|mvcport|status|detail|index|list|menu|left|main)/i;
      const STATIC_ASSET_RE =
        /\.(?:css|png|jpe?g|gif|svg|ico|woff2?|ttf|eot|pdf|xlsx?|docx?|zip|rar|mp4|webm)$/i;

      const PORT_SKIP_SCRIPT_RE =
        /\/(?:js\/(?:xlsx|console|JScript)\.js|Scripts\/Services\/(?:Ring\/ring|Tacit\/tacit)\.js)$/i;

      function readMvcPortTokenFromCookie(doc, win) {
        try {
          const host =
            win && win.location && win.location.hostname
              ? String(win.location.hostname).toLowerCase()
              : '';
          if (host !== 'fpt.net' && !host.endsWith('.fpt.net')) {
            return '';
          }
          const rawCookies = doc && typeof doc.cookie === 'string' ? doc.cookie : '';
          return parseMvcPortTokenFromCookieString(rawCookies);
        } catch {
          return '';
        }
      }

      function withPortToken(rawUrl, token) {
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

      const mvcToken = readMvcPortTokenFromCookie(pageDocument, pageWindow);

      function parseOriginPath(rawUrl) {
        try {
          const u = new URL(rawUrl);
          return {
            origin: u.origin && u.origin !== 'null' ? u.origin : '',
            pathname: u.pathname || '/',
          };
        } catch {
          return { origin: '', pathname: '' };
        }
      }

      const fetchedPageKeys = new Set();

      function buildAnalyzedPageSummary(key, reqParts, finalParts, status, iamExpired, htmlText) {
        const safeBaseUrl =
          finalParts.origin && finalParts.pathname
            ? `${finalParts.origin}${finalParts.pathname}`
            : 'http://mvcport.fpt.net/';
        const hints = extractApiHintsFromHtml(htmlText, safeBaseUrl, contractId);
        const navMeta = extractFramesAndLinksFromHtml(htmlText, safeBaseUrl, contractId);
        const sigs = extractAjaxSignaturesFromHtml(htmlText, safeBaseUrl, contractId);
        const controlsMeta = extractFormControlsMeta(htmlText, contractId);
        const inlineScripts = extractInlineScriptsSanitized(htmlText, contractId, {
          maxPerScript: 28000,
          maxTotal: 44000,
        }).slice(0, 12);
        const nextChunkUrls = extractNextAppChunkUrls(htmlText, safeBaseUrl);

        return {
          summary: {
            key,
            requestedOrigin: reqParts.origin,
            requestedPath: reqParts.pathname,
            finalOrigin: finalParts.origin,
            finalPath: finalParts.pathname,
            title: navMeta.title,
            status,
            iamExpired,
            frames: navMeta.frames,
            links: navMeta.links,
            ajaxCalls: sigs.ajaxCalls,
            controlsMeta,
            forms: hints.forms,
            fields: hints.fields,
            buttons: hints.buttons,
            scriptUrls: hints.scriptUrls,
            nextChunkUrls,
            apiHints: hints.apiHints,
            inlineScripts,
          },
          scriptUrls: hints.scriptUrls,
          nextChunkUrls,
          frames: navMeta.frames,
          links: navMeta.links,
        };
      }

      async function fetchAndAnalyzePortPage(key, rawUrl) {
        const reqParts = parseOriginPath(rawUrl);
        if (reqParts.origin && reqParts.pathname) {
          fetchedPageKeys.add(`${reqParts.origin.toLowerCase()}${reqParts.pathname.toLowerCase()}`);
        }

        const res = await requestPortal({
          url: rawUrl,
          method: 'GET',
          headers: { Accept: 'text/html, */*' },
          timeout: 15000,
        });

        const finalParts = parseOriginPath((res && res.finalUrl) || rawUrl);
        if (finalParts.origin && finalParts.pathname) {
          fetchedPageKeys.add(
            `${finalParts.origin.toLowerCase()}${finalParts.pathname.toLowerCase()}`
          );
        }

        const iam = detectIamRedirect({
          status: (res && res.status) || 0,
          finalUrl: (res && res.finalUrl) || rawUrl,
          responseText: (res && res.responseText) || '',
          requestedUrl: rawUrl,
        });

        if (!res || !res.ok || !res.responseText) {
          return {
            summary: {
              key,
              requestedOrigin: reqParts.origin,
              requestedPath: reqParts.pathname,
              finalOrigin: finalParts.origin,
              finalPath: finalParts.pathname,
              status: (res && res.status) || 0,
              iamExpired: iam.expired,
              error:
                (res && res.error) || (res && res.status ? `HTTP_${res.status}` : 'REQUEST_FAILED'),
            },
            scriptUrls: [],
            nextChunkUrls: [],
            frames: [],
            links: [],
          };
        }

        return buildAnalyzedPageSummary(
          key,
          reqParts,
          finalParts,
          res.status,
          iam.expired,
          res.responseText
        );
      }

      const pages = [];
      const discoveredFrames = [];
      const discoveredLinks = [];

      if (
        pageDocument &&
        pageDocument.documentElement &&
        pageWindow &&
        pageWindow.location &&
        isPortHost(pageWindow.location.origin)
      ) {
        const liveParts = parseOriginPath(pageWindow.location.href || '');
        if (liveParts.origin && liveParts.pathname) {
          fetchedPageKeys.add(`${liveParts.origin.toLowerCase()}${liveParts.pathname.toLowerCase()}`);
          const liveHtml = pageDocument.documentElement.outerHTML || '';
          const liveItem = buildAnalyzedPageSummary(
            'current_live_page',
            liveParts,
            liveParts,
            200,
            false,
            liveHtml
          );
          pages.push(liveItem.summary);
          discoveredFrames.push(...liveItem.frames);
          discoveredLinks.push(...liveItem.links);
        }
      }

      const phase1Targets = [
        {
          key: 'ftth_contract_index',
          url: withPortToken('http://mvcport.fpt.net/ftth_newport/contract/index', mvcToken),
        },
        {
          key: 'ftth_contract_insert',
          url: withPortToken('http://mvcport.fpt.net/FTTH_NewPort/Contract/Insert', mvcToken),
        },
      ].filter((t) => {
        const p = parseOriginPath(t.url);
        return !fetchedPageKeys.has(`${p.origin.toLowerCase()}${p.pathname.toLowerCase()}`);
      });

      const phase1Results = await Promise.all(
        phase1Targets.map((t) => fetchAndAnalyzePortPage(t.key, t.url))
      );

      for (const item of phase1Results) {
        pages.push(item.summary);
        discoveredFrames.push(...item.frames);
        discoveredLinks.push(...item.links);
      }

      const frameTargets = [];
      for (const f of discoveredFrames) {
        if (!isPortHost(f.origin) || !f.pathname) continue;
        const key = `${f.origin.toLowerCase()}${f.pathname.toLowerCase()}`;
        if (fetchedPageKeys.has(key) || frameTargets.some((t) => t.canonKey === key)) {
          continue;
        }
        frameTargets.push({
          canonKey: key,
          url: withPortToken(`${f.origin}${f.pathname}`, mvcToken),
        });
        if (frameTargets.length >= 6) break;
      }

      if (frameTargets.length > 0) {
        const frameResults = await Promise.all(
          frameTargets.map((ft, idx) => fetchAndAnalyzePortPage(`frame_${idx}`, ft.url))
        );
        for (const item of frameResults) {
          pages.push(item.summary);
          discoveredLinks.push(...item.links);
        }
      }

      const priorityLinks = [];
      const normalLinks = [];
      const seenCandidateLinks = new Set();
      for (const link of discoveredLinks) {
        if (!link || !isPortHost(link.origin) || !link.pathname) continue;
        if (STATIC_ASSET_RE.test(link.pathname)) continue;
        const canonKey = `${link.origin.toLowerCase()}${link.pathname.toLowerCase()}`;
        if (fetchedPageKeys.has(canonKey) || seenCandidateLinks.has(canonKey)) continue;
        seenCandidateLinks.add(canonKey);
        const url = withPortToken(`${link.origin}${link.pathname}`, mvcToken);
        const entry = { url, canonKey };
        if (PORT_LINK_PRIORITY_RE.test(`${link.text || ''} ${link.pathname}`)) {
          priorityLinks.push(entry);
        } else {
          normalLinks.push(entry);
        }
      }

      const pageTargets = [...priorityLinks, ...normalLinks].slice(0, 8);
      for (let i = 0; i < pageTargets.length; i += 4) {
        const chunk = pageTargets.slice(i, i + 4);
        const chunkResults = await Promise.all(
          chunk.map((pt, offset) => fetchAndAnalyzePortPage(`page_${i + offset}`, pt.url))
        );
        for (const item of chunkResults) {
          pages.push(item.summary);
        }
      }

      const scriptCandidates = [];
      const seenScripts = new Set();
      for (const page of pages) {
        const urls = [...(page.scriptUrls || []), ...(page.nextChunkUrls || [])];
        for (const sUrl of urls) {
          const sp = parseOriginPath(sUrl);
          if (!isPortHost(sp.origin) || !sp.pathname) continue;
          if (PORT_SKIP_SCRIPT_RE.test(sp.pathname)) continue;
          const sKey = `${sp.origin.toLowerCase()}${sp.pathname.toLowerCase()}`;
          if (seenScripts.has(sKey)) continue;
          seenScripts.add(sKey);
          scriptCandidates.push(`${sp.origin}${sp.pathname}`);
          if (scriptCandidates.length >= 10) break;
        }
        if (scriptCandidates.length >= 10) break;
      }

      const jsSnippets = [];
      if (scriptCandidates.length > 0) {
        const scriptResults = await Promise.all(
          scriptCandidates.map((sUrl) =>
            requestPortal({
              url: sUrl,
              method: 'GET',
              headers: { Accept: 'application/javascript, text/javascript, */*' },
              timeout: 12000,
            })
          )
        );
        for (let i = 0; i < scriptCandidates.length; i += 1) {
          const sUrl = scriptCandidates[i];
          const res = scriptResults[i];
          if (!res || !res.ok || !res.responseText) continue;
          const sp = parseOriginPath(sUrl);
          jsSnippets.push({
            origin: sp.origin,
            pathname: sp.pathname,
            apiHints: extractApiHintsFromJs(res.responseText, contractId),
            codeContexts: extractCodeContextsFromJs(
              res.responseText,
              PORT_JS_KEYWORD_RE,
              contractId
            ),
          });
        }
      }

      state.deepScan = {
        scanKind: 'port_ftth_new_v2',
        scannedAt: new Date().toISOString(),
        hasContractContext: Boolean(contractId),
        pages,
        jsSnippets,
      };

      const allBlockedOrIam =
        pages.length > 0 && pages.every((p) => p.iamExpired || !p.status || p.status >= 400);
      if (allBlockedOrIam) {
        state.copyNotice =
          'Chưa đọc được dữ liệu cổng Port (chưa đăng nhập hoặc mất kết nối VPN). Hãy đăng nhập port.fpt.net ở 1 tab riêng (đừng F5), rồi quay lại đây bấm quét lại nhé.';
      } else {
        state.copyNotice = `Đã quét xong cấu trúc cổng Port (${pages.length} trang, ${jsSnippets.length} file JS)! Hãy bấm "Tải file JSON" lưu vào thư mục Remote inside/scans rồi nhắn mình nhé.`;
      }
    } catch (err) {
      state.copyNotice = `Có lỗi khi quét cổng Port: ${
        err && err.message ? err.message : 'Không rõ nguyên nhân'
      }`;
    } finally {
      state.isDeepScanning = false;
      renderScanner();
    }
  }

  async function handleCopyScanReport() {
    const report = buildScanReport({
      domSnapshot: state.domSnapshot,
      networkEntries: state.recordedEntries,
      deepScan: state.deepScan,
      portalId: state.activePortalId,
    });
    const ok = await copyTextSafe(report);
    state.copyNotice = ok
      ? 'Đã sao chép báo cáo sạch vào bộ nhớ tạm! Bạn chỉ cần dán vào khung chat.'
      : 'Không sao chép tự động được — bạn bấm nút "Tải file JSON" bên cạnh nhé.';
    renderScanner();
  }

  function handleDownloadScanReport() {
    const report = buildScanReport({
      domSnapshot: state.domSnapshot,
      networkEntries: state.recordedEntries,
      deepScan: state.deepScan,
      portalId: state.activePortalId,
    });
    downloadJsonFile(`remote-inside-scan-${state.activePortalId}.json`, report);
    state.copyNotice = `Đã tải file remote-inside-scan-${state.activePortalId}.json.`;
    renderScanner();
  }

  function openConsole() {
    if (state.recallReturnPending) {
      state.recallReturnPending = false;
      state.recallReturnLabel = '';
      state.isOpen = true;
      render();
      refreshSessionStatus();
      if (state.confirmAction && state.confirmAction.id === 'manage_recall') {
        loadRecallModal(state.contractInput);
      }
      return;
    }
    if (
      !standalone &&
      isUserscriptEnv() &&
      pageWindow &&
      pageDocument &&
      isRecallTicketLocation(pageWindow.location) &&
      !state.contractInput
    ) {
      const liveSnap = parseRecallTicketFromDocument(pageDocument, pageWindow.location);
      if (liveSnap && liveSnap.contract) {
        state.contractInput = liveSnap.contract;
        setState(STORAGE_KEYS.LAST_CONTRACT, liveSnap.contract);
      }
    }
    state.isOpen = true;
    render();
    refreshSessionStatus();
  }

  function closeConsole() {
    state.isOpen = false;
    resetConfirmState();
    state.scannerOpen = false;
    state.appMenuOpen = false;
    render();
  }

  function renderTopBar() {
    const isAndroid = isAndroidAppEnv();
    const pillState = state.iamSyncing ? 'checking' : state.sessionStatus.state;
    const pillLabel = state.iamSyncing
      ? state.iamSyncText || 'Đang đồng bộ IAM…'
      : state.sessionStatus.label;
    const pill = el(
      'button',
      {
        type: 'button',
        className: 'ri-status-pill',
        'data-state': pillState,
        title: state.sessionStatus.detail || 'Bấm để kiểm tra lại phiên IAM',
        onClick: () => {
          if (state.iamSyncing) {
            return;
          }
          if (isAndroid && state.sessionStatus.state === 'iam_expired') {
            openExternalOrPortalUrl(
              state.sessionStatus.loginUrl || getUnifiedIamLoginUrl(),
              { mode: 'login', title: 'Đăng nhập IAM (1 lần cho tất cả)', pageWindow }
            );
            return;
          }
          refreshSessionStatus();
        },
      },
      [
        el('span', { className: 'ri-status-dot' }),
        el('span', { text: pillLabel }),
      ]
    );

    const wideBtn = el('button', {
      type: 'button',
      className: 'ri-icon-btn ri-wide-btn',
      text: state.isWide ? 'Thu hẹp' : 'Mở rộng',
      onClick: () => {
        state.isWide = !state.isWide;
        const shellEl = mainLayer.querySelector('.ri-shell');
        if (shellEl) {
          shellEl.classList.toggle('is-wide', state.isWide);
        }
        wideBtn.textContent = state.isWide ? 'Thu hẹp' : 'Mở rộng';
      },
    });

    const scanBtn = isAndroid
      ? el('button', {
          type: 'button',
          className: 'ri-icon-btn',
          text: 'Tiện ích',
          onClick: () => {
            state.scannerOpen = false;
            state.appMenuOpen = true;
            renderScanner();
          },
        })
      : el('button', {
          type: 'button',
          className: 'ri-icon-btn',
          text: 'Quét cấu trúc',
          onClick: () => {
            state.appMenuOpen = false;
            state.scannerOpen = true;
            renderScanner();
          },
        });

    const rightControls = [pill, wideBtn, scanBtn];
    if (!standalone) {
      rightControls.push(
        el('button', {
          type: 'button',
          className: 'ri-icon-btn',
          text: 'Thu gọn',
          onClick: closeConsole,
        })
      );
    }

    return el('header', { className: 'ri-topbar' }, [
      el('div', { className: 'ri-brand' }, [
        el('span', { className: 'ri-brand-mark' }),
        el('h1', { className: 'ri-brand-title', text: 'Remote Inside' }),
      ]),
      el('div', { className: 'ri-topbar-actions' }, rightControls),
    ]);
  }

  function renderContractDock() {
    const input = el('input', {
      type: 'text',
      className: 'ri-contract-input',
      id: 'ri-contract-field',
      placeholder: 'Ví dụ: SGN123456',
      autocomplete: 'off',
      spellcheck: 'false',
      value: state.contractInput,
    });
    input.value = state.contractInput;
    input.addEventListener('input', (e) => {
      state.contractInput = e.target.value;
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const portal = PORTALS[state.activePortalId];
        if (portal && portal.actions.length > 0) {
          triggerAction(portal.actions[0]);
        }
      }
    });

    const pasteBtn = el('button', {
      type: 'button',
      className: 'ri-input-tool',
      text: 'Dán',
      onClick: handlePasteContract,
    });

    const clearBtn = el('button', {
      type: 'button',
      className: 'ri-input-tool',
      text: 'Xóa',
      onClick: () => {
        setContractValue('');
        const target = wrapper.querySelector('#ri-contract-field');
        if (target) target.focus();
      },
    });

    const blocks = [
      el('label', {
        className: 'ri-contract-label',
        for: 'ri-contract-field',
        text: 'Mã hợp đồng (dùng chung cho cả 5 công cụ)',
      }),
      el('div', { className: 'ri-contract-row' }, [input, pasteBtn, clearBtn]),
    ];

    if (state.recentContracts.length > 0) {
      const normalizedCurrent = normalizeContractId(state.contractInput);
      const chips = state.recentContracts.map((code) =>
        el('button', {
          type: 'button',
          className: `ri-chip${normalizedCurrent === code ? ' is-active' : ''}`,
          text: code,
          onClick: () => setContractValue(code),
        })
      );

      blocks.push(
        el('div', { className: 'ri-recent-wrap' }, [
          el('div', { className: 'ri-recent-head' }, [
            el('span', { text: 'Mã vừa xử lý gần đây' }),
            el('button', {
              type: 'button',
              className: 'ri-text-btn',
              text: 'Xóa lịch sử',
              onClick: () => {
                state.recentContracts = clearRecentContracts();
                render();
              },
            }),
          ]),
          el('div', { className: 'ri-recent-chips' }, chips),
        ])
      );
    }

    return el('section', { className: 'ri-card' }, blocks);
  }

  function renderTabs() {
    const tabNodes = [];
    let insertedPlannedSep = false;
    let sawReadyTab = false;

    for (const id of PORTAL_ORDER) {
      const p = PORTALS[id];
      if (!p) continue;
      const isPlanned = p.status === 'planned';
      if (!isPlanned) {
        sawReadyTab = true;
      } else if (sawReadyTab && !insertedPlannedSep) {
        insertedPlannedSep = true;
        tabNodes.push(el('span', { className: 'ri-tab-sep', 'aria-hidden': 'true' }));
      }
      const active = state.activePortalId === id;
      const tabClasses = ['ri-tab', active ? 'is-active' : '', isPlanned ? 'is-planned' : '']
        .filter(Boolean)
        .join(' ');
      tabNodes.push(
        el(
          'button',
          {
            type: 'button',
            role: 'tab',
            'aria-selected': active ? 'true' : 'false',
            className: tabClasses,
            onClick: () => {
              state.activePortalId = id;
              state.result = null;
              setState(STORAGE_KEYS.ACTIVE_PORTAL, id);
              renderMain();
              refreshSessionStatus();
            },
          },
          [
            el('span', { text: p.label }),
            el('span', {
              className: 'ri-tab-badge',
              'data-tier': p.status,
              text: p.statusLabel,
            }),
          ]
        )
      );
    }

    return el('nav', { className: 'ri-tabs', role: 'tablist', 'aria-label': 'Chọn công cụ nội bộ' }, tabNodes);
  }

  function renderActionDeck() {
    const portal = PORTALS[state.activePortalId];
    const [primaryAction, ...secondaryActions] = portal.actions;
    const isPlannedPortal = portal.status === 'planned';

    const primaryContent =
      state.isRunning && state.runningActionId === primaryAction.id
        ? [el('span', { className: 'ri-spinner' }), el('span', { text: 'Đang xử lý…' })]
        : [el('span', { text: primaryAction.label })];

    const primaryBtn = el(
      'button',
      {
        type: 'button',
        className: 'ri-primary-btn',
        disabled: state.isRunning,
        onClick: () => triggerAction(primaryAction),
      },
      primaryContent
    );

    const opsButtons = secondaryActions.map((act) => {
      const runningThis = state.isRunning && state.runningActionId === act.id;
      const btnKindClass =
        act.kind === 'danger' ? 'is-danger' : act.kind === 'primary' ? 'is-primary' : '';
      return el(
        'button',
        {
          type: 'button',
          className: `ri-action-btn${btnKindClass ? ` ${btnKindClass}` : ''}`,
          disabled: state.isRunning,
          onClick: () => triggerAction(act),
        },
        runningThis
          ? [el('span', { className: 'ri-spinner' }), el('span', { text: 'Đang chạy…' })]
          : [el('span', { text: act.label })]
      );
    });

    const opsLabelText = isPlannedPortal
      ? 'Tính năng dự kiến (đang chờ quét ghép)'
      : secondaryActions.some((a) => a.kind === 'danger')
      ? 'Lệnh xử lý nhanh (có xác nhận trước khi chạy)'
      : 'Chức năng mở rộng';

    return el('section', { className: 'ri-card' }, [
      el('div', { className: 'ri-portal-head' }, [
        el('div', {}, [
          el('h2', { className: 'ri-portal-name', text: portal.label }),
          el('p', { className: 'ri-portal-desc', text: portal.description }),
        ]),
        el('span', { className: 'ri-portal-host', text: portal.fullName }),
      ]),
      isPlannedPortal
        ? el('div', {
            className: 'ri-planned-note',
            text: 'Cổng này đang chờ quét ghép API (hiện chạy mô phỏng thử). Các cổng đã chạy thật nằm ở đầu thanh tab: Inside, Port, Vật tư.',
          })
        : null,
      primaryBtn,
      el('div', { className: 'ri-ops-pad' }, [
        el('div', { className: 'ri-ops-label', text: opsLabelText }),
        el('div', { className: 'ri-action-grid' }, opsButtons),
      ]),
      el('div', { className: 'ri-utility-row' }, [
        el('button', {
          type: 'button',
          className: 'ri-secondary-btn',
          text: `Sao chép Mã HĐ & Mở ${portal.label} gốc`,
          onClick: handleCopyAndOpenPortal,
        }),
      ]),
    ]);
  }

  function renderResultPanel() {
    if (!state.result) return null;
    const res = state.result;
    const tone =
      res.status === 'ok'
        ? 'ok'
        : res.status === 'needs_scan' || res.status === 'iam_expired' || res.status === 'warn'
        ? 'warn'
        : 'error';

    const children = [
      el('h3', {
        className: 'ri-result-title',
        text: res.title || (tone === 'ok' ? 'Kết quả xử lý' : 'Thông báo'),
      }),
      el('p', { className: 'ri-result-msg', text: res.message || '' }),
    ];

    if (res.hint) {
      children.push(el('p', { className: 'ri-result-hint', text: res.hint }));
    }

    if (Array.isArray(res.summaryFields) && res.summaryFields.length > 0) {
      const items = res.summaryFields.map((item) =>
        el('li', { className: 'ri-kv-item' }, [
          el('span', { className: 'ri-kv-key', text: item.label }),
          el('span', { className: 'ri-kv-val', text: item.value }),
        ])
      );
      children.push(el('ul', { className: 'ri-kv-list' }, items));
    }

    if (Array.isArray(res.extraSections) && res.extraSections.length > 0) {
      for (const sec of res.extraSections) {
        if (!sec || !Array.isArray(sec.fields) || sec.fields.length === 0) continue;
        children.push(
          el('h4', { className: 'ri-sub-section-title', text: sec.title || '' }),
          el(
            'ul',
            { className: 'ri-kv-list' },
            sec.fields.map((item) =>
              el('li', { className: 'ri-kv-item' }, [
                el('span', { className: 'ri-kv-key', text: item.label }),
                el('span', { className: 'ri-kv-val', text: item.value }),
              ])
            )
          )
        );
      }
    }

    const extraBtns = [];
    if (res.status === 'ok' && Array.isArray(res.summaryFields) && res.summaryFields.length > 0) {
      const copySummaryBtn = el('button', {
        type: 'button',
        className: 'ri-secondary-btn',
        text: 'Sao chép tóm tắt',
        onClick: async () => {
          const lines = [res.title || 'Kết quả tra cứu'];
          for (const f of res.summaryFields) {
            lines.push(`${f.label}: ${f.value}`);
          }
          if (Array.isArray(res.extraSections)) {
            for (const sec of res.extraSections) {
              if (!sec || !Array.isArray(sec.fields) || sec.fields.length === 0) continue;
              lines.push('', `[${sec.title}]`);
              for (const f of sec.fields) {
                lines.push(`${f.label}: ${f.value}`);
              }
            }
          }
          const ok = await copyTextSafe(lines.join('\n'));
          if (ok) {
            copySummaryBtn.textContent = 'Đã sao chép!';
            setTimeout(() => {
              copySummaryBtn.textContent = 'Sao chép tóm tắt';
            }, 1800);
          }
        },
      });
      extraBtns.push(copySummaryBtn);
    }
    if ((res.status === 'iam_expired' || res.showLoginBtn) && res.loginUrl) {
      if (state.activePortalId === 'port' && isLoggedInPortHost()) {
        extraBtns.push(
          el('button', {
            type: 'button',
            className: 'ri-primary-btn',
            text: 'Kích hoạt FTTH NEW ngay',
            onClick: () => {
              const ok = triggerPortFtthMenuAction(pageWindow);
              if (!ok && state.result) {
                state.result = {
                  ...state.result,
                  message:
                    'Chưa gọi được menu tự động. Bạn bấm ở menu bên trái: FTTH NEW → Hợp đồng → Tìm kiếm 1 lần rồi bấm Xem Port hiện tại lại nhé.',
                };
                renderMain();
              }
            },
          }),
          el('button', {
            type: 'button',
            className: 'ri-secondary-btn',
            text: 'Mở lại port.fpt.net',
            onClick: () => {
              openExternalOrPortalUrl(res.loginUrl, {
                mode: 'login',
                title: 'Đăng nhập Port',
                pageWindow,
              });
            },
          })
        );
      } else {
        extraBtns.push(
          el('button', {
            type: 'button',
            className: 'ri-primary-btn',
            text: 'Đăng nhập IAM ngay',
            onClick: () => {
              openExternalOrPortalUrl(res.loginUrl, {
                mode: 'login',
                title: 'Đăng nhập IAM',
                pageWindow,
              });
            },
          })
        );
      }
    }
    if (res.status === 'needs_scan') {
      extraBtns.push(
        el('button', {
          type: 'button',
          className: 'ri-secondary-btn',
          text: 'Mở Quét cấu trúc',
          onClick: () => {
            state.scannerOpen = true;
            renderScanner();
          },
        }),
        el('button', {
          type: 'button',
          className: 'ri-secondary-btn',
          text: 'Mở trang gốc',
          onClick: handleCopyAndOpenPortal,
        })
      );
    }
    if (res.sourceUrl) {
      extraBtns.push(
        el('button', {
          type: 'button',
          className: 'ri-secondary-btn',
          text: res.sourceLabel || 'Mở trang MonitorOLT gốc',
          onClick: () => {
            openExternalOrPortalUrl(res.sourceUrl, {
              mode: 'portal',
              title: res.sourceLabel || 'MonitorOLT',
              pageWindow,
            });
          },
        })
      );
    }

    if (extraBtns.length > 0) {
      children.push(el('div', { className: 'ri-result-actions' }, extraBtns));
    }

    if (Array.isArray(res.embeddedViews) && res.embeddedViews.length > 0) {
      const cardSyncers = [];
      const embedCards = res.embeddedViews.map((v) => {
        const bodyHost = el('div', { className: 'ri-embed-body-host' });
        let reloadBtn = null;
        if (v.url) {
          reloadBtn = el('button', {
            type: 'button',
            className: 'ri-embed-open-link',
            text: 'Tải lại',
          });
        }

        const toggleBtn = el('button', {
          type: 'button',
          className: 'ri-embed-toggle',
          text: 'Mở xem',
        });

        const headButtons = [];
        if (reloadBtn) headButtons.push(reloadBtn);
        if (v.url) {
          headButtons.push(
            el('button', {
              type: 'button',
              className: 'ri-embed-open-link',
              text: 'Mở riêng',
              onClick: () => {
                openExternalOrPortalUrl(v.url, {
                  mode: 'portal',
                  title: v.title || 'Xem chi tiết',
                  pageWindow,
                });
              },
            })
          );
        }
        headButtons.push(toggleBtn);

        let mountedFrameSrc = '';

        function syncCard({ forceReload = false } = {}) {
          const isOpen = Boolean(state.openViews[v.id]);
          toggleBtn.className = `ri-embed-toggle${isOpen ? ' is-open' : ''}`;
          toggleBtn.textContent = isOpen ? 'Thu gọn' : 'Mở xem';
          if (reloadBtn) {
            reloadBtn.style.display = isOpen ? '' : 'none';
          }

          if (!isOpen) {
            if (bodyHost.childNodes.length > 0) {
              bodyHost.textContent = '';
            }
            mountedFrameSrc = '';
            return;
          }

          if (!v.url) {
            if (bodyHost.childNodes.length === 0) {
              bodyHost.appendChild(
                el('div', { className: 'ri-embed-body' }, [
                  el('div', {
                    className: 'ri-embed-demo',
                    text: v.demoNote || 'Chưa có đường dẫn ở chế độ xem thử.',
                  }),
                ])
              );
            }
            return;
          }

          const reloadCount = state.viewReloadKeys[v.id] || 0;
          const frameSrc =
            reloadCount > 0
              ? `${v.url}${v.url.includes('?') ? '&' : '?'}_ri=${reloadCount}`
              : v.url;

          if (!forceReload && mountedFrameSrc === frameSrc && bodyHost.childNodes.length > 0) {
            return;
          }

          mountedFrameSrc = frameSrc;
          const iframeEl = el('iframe', {
            className: 'ri-embed-frame',
            src: frameSrc,
            loading: 'lazy',
            title: v.title,
          });
          iframeEl.style.height = `${v.height || 320}px`;
          bodyHost.textContent = '';
          bodyHost.appendChild(el('div', { className: 'ri-embed-body' }, [iframeEl]));
        }

        if (reloadBtn) {
          reloadBtn.addEventListener('click', () => {
            state.viewReloadKeys[v.id] = (state.viewReloadKeys[v.id] || 0) + 1;
            syncCard({ forceReload: true });
          });
        }

        toggleBtn.addEventListener('click', () => {
          state.openViews[v.id] = !Boolean(state.openViews[v.id]);
          syncCard();
        });

        syncCard();
        cardSyncers.push(() => syncCard());

        return el('div', { className: 'ri-embed-card' }, [
          el('div', { className: 'ri-embed-head' }, [
            el('div', { className: 'ri-embed-title-wrap' }, [
              el('span', { className: 'ri-embed-title', text: v.title }),
              v.badge ? el('span', { className: 'ri-embed-badge', text: v.badge }) : null,
            ]),
            el('div', { className: 'ri-embed-actions' }, headButtons),
          ]),
          bodyHost,
        ]);
      });

      children.push(
        el('div', { className: 'ri-embed-group' }, [
          el('div', { className: 'ri-embed-toolbar' }, [
            el('span', {
              className: 'ri-embed-toolbar-title',
              text: `Chi tiết từ hệ thống (${res.embeddedViews.length} mục)`,
            }),
            el('div', { className: 'ri-embed-toolbar-btns' }, [
              el('button', {
                type: 'button',
                className: 'ri-text-btn',
                text: 'Mở tất cả',
                onClick: () => {
                  for (const v of res.embeddedViews) state.openViews[v.id] = true;
                  for (const fn of cardSyncers) fn();
                },
              }),
              el('button', {
                type: 'button',
                className: 'ri-text-btn',
                text: 'Thu gọn tất cả',
                onClick: () => {
                  for (const v of res.embeddedViews) state.openViews[v.id] = false;
                  for (const fn of cardSyncers) fn();
                },
              }),
            ]),
          ]),
          ...embedCards,
        ])
      );
    }

    return el('section', { className: 'ri-result-card', 'data-tone': tone }, children);
  }

  function renderActivityLog() {
    const head = el('div', { className: 'ri-log-head' }, [
      el('h3', { className: 'ri-section-title', text: 'Nhật ký thao tác' }),
      state.logs.length > 0
        ? el('button', {
            type: 'button',
            className: 'ri-text-btn',
            text: 'Xóa nhật ký',
            onClick: () => {
              state.logs = [];
              render();
            },
          })
        : null,
    ]);

    if (state.logs.length === 0) {
      return el('section', { className: 'ri-card' }, [
        head,
        el('p', {
          className: 'ri-log-empty',
          text: 'Chưa có thao tác nào trong phiên này.',
        }),
      ]);
    }

    const items = state.logs.map((entry) => {
      const badgeLabel =
        entry.statusKind === 'ok'
          ? 'Xong'
          : entry.statusKind === 'warn'
          ? 'Chờ quét'
          : 'Lỗi';

      return el('li', { className: 'ri-log-item' }, [
        el('div', { className: 'ri-log-main' }, [
          el('span', { className: 'ri-log-action', text: `${entry.portalLabel}: ${entry.actionLabel}` }),
          el('span', { className: 'ri-log-contract', text: entry.contractId }),
        ]),
        el('div', { className: 'ri-log-meta' }, [
          el('span', {
            className: 'ri-badge',
            'data-status': entry.statusKind,
            text: badgeLabel,
          }),
          el('span', { className: 'ri-log-time', text: entry.time }),
        ]),
      ]);
    });

    return el('section', { className: 'ri-card' }, [
      head,
      el('ul', { className: 'ri-log-list' }, items),
    ]);
  }

  function buildClearOltConnCard(contractId) {
    if (!contractId) {
      return { connCardEl: null, connStateKey: 'no-contract' };
    }
    const connStateKey = JSON.stringify([
      contractId,
      Boolean(state.oltConnOpen),
      Boolean(state.oltContractLoading),
      state.oltContractError || '',
      state.oltContractObjId || '',
    ]);
    const connUrl = state.oltContractObjId
      ? `http://radius-portal.fpt.net/public/partial/connection-parameters?ObjID=${encodeURIComponent(
          state.oltContractObjId
        )}`
      : '';
    const connHeadButtons = [];
    if (isUserscriptEnv() && connUrl) {
      connHeadButtons.push(
        el('button', {
          type: 'button',
          className: 'ri-embed-open-link',
          text: 'Mở riêng',
          onClick: () => {
            openExternalOrPortalUrl(connUrl, {
              mode: 'portal',
              title: 'Thông số kết nối',
              pageWindow,
            });
          },
        })
      );
    }
    if (state.oltContractError) {
      connHeadButtons.push(
        el('button', {
          type: 'button',
          className: 'ri-embed-open-link',
          text: 'Thử lại',
          onClick: () => loadContractOltContextForModal(contractId),
        })
      );
    }
    connHeadButtons.push(
      el('button', {
        type: 'button',
        className: `ri-embed-toggle${state.oltConnOpen ? ' is-open' : ''}`,
        text: state.oltConnOpen ? 'Thu gọn' : 'Mở xem',
        onClick: () => {
          const nextOpen = !state.oltConnOpen;
          state.oltConnOpen = nextOpen;
          state.oltConnManualOpen = nextOpen;
          renderConfirm();
        },
      })
    );

    const connCardParts = [
      el('div', { className: 'ri-embed-head' }, [
        el('div', { className: 'ri-embed-title-wrap' }, [
          el('span', { className: 'ri-embed-title', text: 'Thông số kết nối (xem OLT / Port)' }),
          el('span', { className: 'ri-embed-badge', text: contractId }),
        ]),
        el('div', { className: 'ri-embed-actions' }, connHeadButtons),
      ]),
    ];

    if (state.oltConnOpen) {
      if (state.oltContractLoading) {
        connCardParts.push(
          el('div', { className: 'ri-embed-body' }, [
            el('div', {
              className: 'ri-embed-demo',
              text: `Đang lấy ObjID của ${contractId} để mở Thông số kết nối…`,
            }),
          ])
        );
      } else if (state.oltContractError) {
        connCardParts.push(
          el('div', { className: 'ri-embed-body' }, [
            el('div', { className: 'ri-embed-demo', text: state.oltContractError }),
          ])
        );
      } else if (!isUserscriptEnv()) {
        connCardParts.push(
          el('div', { className: 'ri-embed-body' }, [
            el('div', {
              className: 'ri-embed-demo',
              text: 'Chế độ mô phỏng — Thông số kết nối mẫu: OLT DEMO-OLT-01GC16 [S:0 / P:5 / O:79]. Khi chạy thật qua Tampermonkey, khung này sẽ hiện OLT / Port trực tiếp từ Radius.',
            }),
          ])
        );
      } else if (connUrl) {
        const connIframe = el('iframe', {
          className: 'ri-embed-frame',
          src: connUrl,
          loading: 'lazy',
          title: `Thông số kết nối ${contractId}`,
        });
        connIframe.style.height = '300px';
        connCardParts.push(el('div', { className: 'ri-embed-body' }, [connIframe]));
      }
    }

    return {
      connCardEl: el('div', { className: 'ri-embed-card ri-conn-box' }, connCardParts),
      connStateKey,
    };
  }

  function buildClearOltFormParts(act, contractId) {
    const parts = [];
    const cancelBtn = el('button', {
      type: 'button',
      className: 'ri-secondary-btn',
      text: 'Hủy',
      onClick: () => {
        resetConfirmState();
        renderConfirm();
      },
    });
    const confirmBtn = el('button', {
      type: 'button',
      className: 'ri-danger-btn',
      text: 'Xác nhận Clear Serial',
    });

    if (state.oltDetectedInfo && state.oltDetectedInfo.oltPop) {
      const d = state.oltDetectedInfo;
      const posLabel =
        d.slot || d.port || d.onu
          ? ` [S:${d.slot || '-'} / P:${d.port || '-'} / O:${d.onu || '-'}]`
          : '';
      const subParts = [];
      if (d.ipOlt) subParts.push(`IP OLT: ${d.ipOlt}`);
      subParts.push(
        state.oltAutoMatched
          ? 'Đã tự động chọn sẵn POP OLT & Port bên dưới'
          : 'Chưa khớp tên OLT tự động — hãy lọc chọn POP OLT tương ứng bên dưới'
      );
      parts.push(
        el('div', { className: 'ri-olt-detected' }, [
          el('div', {
            className: 'ri-olt-detected-title',
            text: `Thông số kết nối: ${d.oltPop}${posLabel}`,
          }),
          el('div', {
            className: 'ri-olt-detected-sub',
            text: subParts.join(' • '),
          }),
        ])
      );
    }

    if (state.oltLoading) {
      parts.push(
        el('div', { className: 'ri-sheet-status is-loading' }, [
          el('span', { className: 'ri-spinner' }),
          el('span', { text: 'Đang tải vùng miền & danh sách POP OLT từ MonitorOLT…' }),
        ])
      );
      confirmBtn.disabled = true;
    } else if (state.oltError) {
      const errActions = [
        el('button', {
          type: 'button',
          className: 'ri-secondary-btn',
          text: 'Thử tải lại',
          onClick: () => loadOltDataForModal(true),
        }),
      ];
      if (state.oltLoginUrl && /iam|hết hạn/i.test(state.oltError)) {
        errActions.push(
          el('button', {
            type: 'button',
            className: 'ri-secondary-btn',
            text: 'Đăng nhập IAM',
            onClick: () => {
              openExternalOrPortalUrl(state.oltLoginUrl, {
                mode: 'login',
                title: 'Đăng nhập IAM',
                pageWindow,
              });
            },
          })
        );
      }
      parts.push(
        el('div', { className: 'ri-sheet-status', 'data-tone': 'error' }, [
          el('div', { text: state.oltError }),
          el('div', { className: 'ri-result-actions' }, errActions),
        ])
      );
      confirmBtn.disabled = true;
    } else {
      const locHead = el('div', { className: 'ri-inline-head' }, [
        el('span', { className: 'ri-confirm-label', text: 'Vùng miền' }),
        el('button', {
          type: 'button',
          className: 'ri-text-btn',
          text: 'Tải lại DS OLT',
          onClick: () => loadOltDataForModal(true),
        }),
      ]);

      if (state.oltLocations.length > 1) {
        const locSelect = el(
          'select',
          { className: 'ri-select', id: 'ri-olt-location' },
          state.oltLocations.map((loc) => {
            const opt = el('option', { value: loc.id, text: loc.name });
            if (loc.id === state.oltLocationId) opt.selected = true;
            return opt;
          })
        );
        locSelect.value = state.oltLocationId;
        locSelect.addEventListener('change', (e) => {
          loadOltListForSelectedLocation(e.target.value);
        });
        parts.push(el('div', { className: 'ri-confirm-input-wrap' }, [locHead, locSelect]));
      } else if (state.oltLocations.length === 1) {
        parts.push(
          el('div', { className: 'ri-confirm-input-wrap' }, [
            locHead,
            el('div', {
              className: 'ri-confirm-meta',
              text: `Vùng hiện tại: ${state.oltLocations[0].name}`,
            }),
          ])
        );
      }

      const oltCountSpan = el('span', { className: 'ri-text-btn' });
      const searchInput = el('input', {
        type: 'text',
        className: 'ri-confirm-input',
        id: 'ri-olt-search',
        placeholder: 'Lọc nhanh tên OLT (ví dụ: OLT-01, GC16…)',
        autocomplete: 'off',
        spellcheck: 'false',
        value: state.oltSearch,
      });
      searchInput.value = state.oltSearch;

      const oltSelect = el('select', { className: 'ri-select', id: 'ri-olt-select' });

      function syncOltConfirmState() {
        const activeOltId = oltSelect.value || state.oltSelectedId;
        confirmBtn.disabled =
          !activeOltId || activeOltId === '0' || state.oltSelectedPorts.length === 0;
      }

      function populateOltSelect(queryText) {
        const q = String(queryText || '').trim().toLowerCase();
        const filtered = q
          ? state.oltList.filter((o) => o.name.toLowerCase().includes(q))
          : state.oltList;

        oltCountSpan.textContent = q
          ? `${filtered.length}/${state.oltList.length} OLT`
          : `${state.oltList.length} OLT`;

        oltSelect.textContent = '';
        oltSelect.appendChild(
          el('option', {
            value: '',
            text:
              filtered.length > 0
                ? `-- Chọn POP OLT (${filtered.length}) --`
                : '-- Không có POP OLT khớp từ khóa --',
          })
        );

        let hasSelectedInFiltered = false;
        for (const item of filtered) {
          const opt = el('option', { value: item.id, text: item.name });
          if (item.id === state.oltSelectedId) {
            opt.selected = true;
            hasSelectedInFiltered = true;
          }
          oltSelect.appendChild(opt);
        }

        if (hasSelectedInFiltered) {
          oltSelect.value = state.oltSelectedId;
        } else {
          oltSelect.value = '';
        }
        syncOltConfirmState();
      }

      populateOltSelect(state.oltSearch);

      searchInput.addEventListener('input', (e) => {
        state.oltUserTouched = true;
        state.oltSearch = e.target.value;
        populateOltSelect(state.oltSearch);
      });

      oltSelect.addEventListener('change', (e) => {
        state.oltUserTouched = true;
        state.oltAutoMatched = false;
        state.oltSelectedId = e.target.value;
        state.oltSelectedPorts = [];
        const picked = state.oltList.find((o) => o.id === state.oltSelectedId);
        state.oltShowAllPorts = picked ? isExtendedPortOlt(picked.name) : false;
        renderConfirm();
      });

      parts.push(
        el('div', { className: 'ri-confirm-input-wrap' }, [
          el('div', { className: 'ri-inline-head' }, [
            el('label', {
              className: 'ri-confirm-label',
              for: 'ri-olt-search',
              text: 'POP OLT',
            }),
            oltCountSpan,
          ]),
          searchInput,
        ]),
        el('div', { className: 'ri-confirm-input-wrap' }, [oltSelect])
      );

      const selectedOltObj = state.oltList.find((o) => o.id === state.oltSelectedId);
      const isExtOlt = selectedOltObj ? isExtendedPortOlt(selectedOltObj.name) : false;
      const portsSource =
        state.oltPorts.length > 0
          ? state.oltPorts
          : Array.from({ length: 16 }, (_, idx) => ({
              value: String(idx + 1),
              label: `Port ${idx + 1}`,
              isType2: idx + 1 > 8,
            }));
      const hasType2 = portsSource.some((p) => p.isType2);
      const showAll = isExtOlt || state.oltShowAllPorts;
      const visiblePorts = showAll ? portsSource : portsSource.filter((p) => !p.isType2);

      const portTools = [];
      if (!isExtOlt && hasType2) {
        portTools.push(
          el('button', {
            type: 'button',
            className: 'ri-text-btn',
            text: state.oltShowAllPorts ? 'Ẩn port 9–16' : 'Hiện đủ 16 port',
            onClick: () => {
              state.oltShowAllPorts = !state.oltShowAllPorts;
              renderConfirm();
            },
          })
        );
      }
      if (state.oltSelectedPorts.length > 0) {
        portTools.push(
          el('button', {
            type: 'button',
            className: 'ri-text-btn',
            text: 'Bỏ chọn',
            onClick: () => {
              state.oltUserTouched = true;
              state.oltSelectedPorts = [];
              renderConfirm();
            },
          })
        );
      }

      const selectedPortSet = new Set(state.oltSelectedPorts);
      const portOrder = new Map(portsSource.map((p, idx) => [p.value, idx]));

      const portGrid = el(
        'div',
        { className: 'ri-port-grid' },
        visiblePorts.map((p) => {
          const active = selectedPortSet.has(p.value);
          const displayLabel = /^\d+$/.test(p.label) ? `Port ${p.label}` : p.label;
          return el('button', {
            type: 'button',
            className: `ri-port-chip${active ? ' is-selected' : ''}`,
            'aria-pressed': active ? 'true' : 'false',
            text: displayLabel,
            onClick: () => {
              state.oltUserTouched = true;
              if (selectedPortSet.has(p.value)) {
                state.oltSelectedPorts = state.oltSelectedPorts.filter((x) => x !== p.value);
              } else {
                const next = [...state.oltSelectedPorts, p.value];
                next.sort((a, b) => (portOrder.get(a) ?? 999) - (portOrder.get(b) ?? 999));
                state.oltSelectedPorts = next;
              }
              renderConfirm();
            },
          });
        })
      );

      parts.push(
        el('div', { className: 'ri-confirm-input-wrap' }, [
          el('div', { className: 'ri-inline-head' }, [
            el('span', {
              className: 'ri-confirm-label',
              text: `Chọn Port (${state.oltSelectedPorts.length} đã chọn)`,
            }),
            el('div', { className: 'ri-embed-toolbar-btns' }, portTools),
          ]),
          portGrid,
        ])
      );

      syncOltConfirmState();

      confirmBtn.addEventListener('click', () => {
        const activeOltId = oltSelect.value || state.oltSelectedId;
        const activeOlt = state.oltList.find((o) => o.id === activeOltId) || {};
        runConfirmedAction(act, {
          locationId: state.oltLocationId,
          oltId: activeOltId,
          oltName: activeOlt.name || '',
          ports: state.oltSelectedPorts.slice(),
        });
      });
    }

    parts.push(el('div', { className: 'ri-sheet-buttons' }, [cancelBtn, confirmBtn]));
    return parts;
  }

  function renderConfirmSheet() {
    if (!state.confirmAction) return null;
    const act = state.confirmAction;
    const portal = PORTALS[state.activePortalId];
    const contractId = normalizeContractId(state.contractInput);
    const cached =
      portal.id === 'inside' && contractId ? getCachedInsideContract(contractId) : null;

    const isInsideModem = portal.id === 'inside' && act.id === 'reset_mac';
    const isInsideBox = portal.id === 'inside' && act.id === 'reset_mac_box';
    const isInsideKill = portal.id === 'inside' && act.id === 'kill_session';
    const isInsideOlt = portal.id === 'inside' && act.id === 'clear_osp';
    const isInsideBypass = portal.id === 'inside' && act.id === 'bypass';
    const isInsideDeploy = portal.id === 'inside' && act.id === 'deploy_ticket';
    const isPortRelease = portal.id === 'port' && act.id === 'release_port';
    const isPortAssign = portal.id === 'port' && act.id === 'assign_port';
    const isRecallManage = portal.id === 'recall' && act.id === 'manage_recall';
    const isEquipmentDebt = portal.id === 'recall' && act.id === 'equipment_debt';

    const sheetParts = [
      el('div', { className: 'ri-log-head' }, [
        el('h2', {
          id: 'ri-sheet-title',
          className: 'ri-sheet-title',
          text: isInsideKill
            ? 'Kill Session — Phiên đang chạy'
            : isInsideDeploy
            ? 'Phiếu triển khai FOX-ERP'
            : isInsideBypass
            ? 'CheckList ByPass'
            : isRecallManage
            ? 'Phiếu thu hồi vật tư'
            : isEquipmentDebt
            ? 'Tồn nợ vật tư theo KTV'
            : `Xác nhận ${act.label}?`,
        }),
        el('button', {
          type: 'button',
          className: 'ri-icon-btn',
          text: 'Đóng',
          onClick: () => {
            resetConfirmState();
            render();
          },
        }),
      ]),
      isEquipmentDebt && state.equipDebtStatus === 'ok'
        ? null
        : el('p', {
            className: 'ri-sheet-sub',
            text: isInsideKill
              ? 'Kiểm tra đúng IP đang chạy bên dưới rồi chạm nút Kill để ngắt phiên (2 bước xác nhận ngay trên dòng).'
              : isInsideDeploy
              ? 'Thao tác trực tiếp: thông số NET, Clear MAC vật tư, hoàn tất phiếu, SĐT User và Biên bản điện tử.'
              : isRecallManage
              ? 'Xem danh sách vật tư, thêm thiết bị / TB phụ, bấm sửa trực tiếp, tạo phiếu mới (+) và gửi ghi chú.'
              : isEquipmentDebt
              ? 'Đọc trực tiếp bảng Tồn công nợ theo NV và lọc bỏ KTV tồn = 0.'
              : act.confirmNote || `Thao tác sẽ được gửi lên ${portal.fullName}.`,
          }),
    ].filter(Boolean);

    if (contractId && !isEquipmentDebt) {
      sheetParts.push(
        el('div', { className: 'ri-confirm-contract' }, [
          el('span', {
            text: isInsideOlt ? 'Hợp đồng tham chiếu (không bắt buộc)' : `Hợp đồng trên ${portal.label}`,
          }),
          el('span', { className: 'ri-confirm-code', text: contractId }),
        ])
      );
    } else if (isInsideOlt) {
      sheetParts.push(
        el('div', {
          className: 'ri-confirm-meta',
          text: 'Chưa nhập Mã hợp đồng — chọn trực tiếp POP OLT & Port bên dưới (nếu nhập Mã HĐ sẽ hiện thêm Thông số kết nối tại đây).',
        })
      );
    }

    if (cached && cached.objID && !isInsideOlt && !isInsideModem && !isInsideKill) {
      sheetParts.push(el('div', { className: 'ri-confirm-meta', text: `ObjID: ${cached.objID}` }));
    }

    const cancelBtn = el('button', {
      type: 'button',
      className: 'ri-secondary-btn',
      text:
        (isInsideBox && state.boxTab === 'history') ||
        isInsideKill ||
        isInsideDeploy ||
        isRecallManage ||
        isEquipmentDebt
          ? 'Đóng'
          : 'Hủy',
      onClick: () => {
        resetConfirmState();
        render();
      },
    });

    const confirmBtn = el('button', {
      type: 'button',
      className: 'ri-danger-btn',
      text: 'Xác nhận thực hiện',
    });

    let showConfirmBtn = true;

    function buildByPassStatusAndReasonFields({
      typeId,
      reasonId,
      typeLabel,
      currentType,
      currentContent,
      onTypeChange,
      onReasonChange,
    }) {
      const typeSelect = el('select', { className: 'ri-select', id: typeId });
      for (const opt of BYPASS_TYPE_OPTIONS) {
        const o = el('option', { value: opt.value, text: opt.label });
        if (opt.value === currentType) o.selected = true;
        typeSelect.appendChild(o);
      }
      typeSelect.value = currentType;

      const reasonSelect = el('select', { className: 'ri-select', id: reasonId });
      const reasonWrap = el('div', { className: 'ri-confirm-input-wrap' }, [
        el('label', { className: 'ri-confirm-label', for: reasonId, text: 'Lý do ByPass' }),
        reasonSelect,
      ]);

      function populateReasons(selType, selReason) {
        const reasons = BYPASS_REASON_BY_TYPE[selType] || [];
        reasonSelect.textContent = '';
        if (reasons.length === 0) {
          reasonWrap.style.display = 'none';
          return '';
        }
        reasonWrap.style.display = '';
        reasonSelect.appendChild(el('option', { value: '', text: '-- Chọn lý do ByPass --' }));
        let matched = '';
        for (const r of reasons) {
          const o = el('option', { value: r.value, text: r.label });
          if (r.value === selReason) {
            o.selected = true;
            matched = r.value;
          }
          reasonSelect.appendChild(o);
        }
        if (!matched && selReason) {
          const extra = el('option', { value: selReason, text: selReason });
          extra.selected = true;
          reasonSelect.appendChild(extra);
          matched = selReason;
        }
        reasonSelect.value = matched;
        return matched;
      }

      const resolvedReason = populateReasons(currentType, currentContent);
      if (resolvedReason !== currentContent) {
        onReasonChange(resolvedReason, true);
      }

      typeSelect.addEventListener('change', (e) => {
        const nextType = e.target.value;
        const nextReason = populateReasons(nextType, '');
        onTypeChange(nextType, nextReason);
      });
      reasonSelect.addEventListener('change', (e) => {
        onReasonChange(e.target.value, false);
      });

      return {
        typeWrap: el('div', { className: 'ri-confirm-input-wrap' }, [
          el('label', { className: 'ri-confirm-label', for: typeId, text: typeLabel }),
          typeSelect,
        ]),
        reasonWrap,
      };
    }

    if (isInsideModem) {
      if (state.modemLoading) {
        sheetParts.push(
          el('div', { className: 'ri-sheet-status is-loading' }, [
            el('span', { className: 'ri-spinner' }),
            el('span', { text: `Đang đọc MAC Modem đang chạy của ${contractId}…` }),
          ])
        );
        confirmBtn.disabled = true;
      } else if (state.modemError) {
        const errActions = [
          el('button', {
            type: 'button',
            className: 'ri-secondary-btn',
            text: 'Thử tải lại',
            onClick: () => loadModemInfoForModal(contractId),
          }),
        ];
        if (state.modemLoginUrl && /iam|hết hạn/i.test(state.modemError)) {
          errActions.push(
            el('button', {
              type: 'button',
              className: 'ri-secondary-btn',
              text: 'Đăng nhập IAM',
              onClick: () => {
                openExternalOrPortalUrl(state.modemLoginUrl, {
                  mode: 'login',
                  title: 'Đăng nhập IAM',
                  pageWindow,
                });
              },
            })
          );
        }
        sheetParts.push(
          el('div', { className: 'ri-sheet-status', 'data-tone': 'error' }, [
            el('div', { text: state.modemError }),
            el('div', { className: 'ri-result-actions' }, errActions),
          ])
        );
        confirmBtn.disabled = true;
      } else {
        const info = state.modemInfo || {};
        const currentRunning = info.macAddress ? String(info.macAddress).trim() : '';
        const metaPieces = [];
        if (info.objID) metaPieces.push(`ObjID: ${info.objID}`);
        if (info.accountName) metaPieces.push(`Tên truy nhập: ${info.accountName}`);

        sheetParts.push(
          el('div', { className: 'ri-modem-info' }, [
            el('div', { className: 'ri-inline-head' }, [
              el('span', { className: 'ri-confirm-label', text: 'MAC Modem đang chạy trên Inside' }),
              el('button', {
                type: 'button',
                className: 'ri-text-btn',
                text: 'Tải lại',
                onClick: () => loadModemInfoForModal(contractId),
              }),
            ]),
            el('div', {
              className: 'ri-modem-mac',
              text: currentRunning || '(Đang trống — chưa giữ MAC)',
            }),
            metaPieces.length > 0
              ? el('div', { className: 'ri-box-sub', text: metaPieces.join(' • ') })
              : null,
          ])
        );

        const macInput = el('input', {
          type: 'text',
          className: 'ri-confirm-input',
          id: 'ri-confirm-new-mac',
          placeholder: 'Xóa hết để Reset trắng MAC, hoặc nhập MAC mới',
          autocomplete: 'off',
          spellcheck: 'false',
          value: state.confirmNewMac,
        });
        macInput.value = state.confirmNewMac;

        const clearMacBtn = el('button', {
          type: 'button',
          className: 'ri-input-tool',
          text: 'Xóa trắng',
        });

        const hintEl = el('div', { className: 'ri-field-hint' });

        function syncModemUi() {
          const curNorm = currentRunning.replace(/[\s:-]+/g, '').toUpperCase();
          const entered = String(state.confirmNewMac || '').trim();
          const enteredNorm = entered.replace(/[\s:-]+/g, '').toUpperCase();

          if (!entered) {
            hintEl.textContent = currentRunning
              ? 'Đã xóa hết ký tự — bấm "Xác nhận Reset trắng MAC" để modem nhận lại MAC mới.'
              : 'Ô nhập đang trống — bấm "Xác nhận Reset trắng MAC" để gửi lệnh reset.';
            hintEl.dataset.state = 'ok';
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Xác nhận Reset trắng MAC';
          } else if (currentRunning && enteredNorm === curNorm) {
            hintEl.textContent =
              'MAC trong ô đang trùng với MAC đang chạy. Hãy bấm "Xóa trắng" hoặc xóa hết ký tự để Reset.';
            hintEl.dataset.state = 'warn';
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Hãy xóa trắng để Reset MAC';
          } else {
            hintEl.textContent = `Sẽ đổi MAC Modem sang: ${entered}`;
            hintEl.dataset.state = 'ok';
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Xác nhận đổi MAC Modem';
          }
        }

        macInput.addEventListener('input', (e) => {
          state.confirmNewMac = e.target.value;
          syncModemUi();
        });

        clearMacBtn.addEventListener('click', () => {
          state.confirmNewMac = '';
          macInput.value = '';
          macInput.focus();
          syncModemUi();
        });

        sheetParts.push(
          el('div', { className: 'ri-confirm-input-wrap' }, [
            el('label', {
              className: 'ri-confirm-label',
              for: 'ri-confirm-new-mac',
              text: 'MAC Modem gửi lên (xóa hết ký tự để Reset trắng)',
            }),
            el('div', { className: 'ri-contract-row' }, [macInput, clearMacBtn]),
            hintEl,
          ])
        );

        syncModemUi();

        confirmBtn.addEventListener('click', () =>
          runConfirmedAction(act, {
            newMac: state.confirmNewMac,
            previousMac: currentRunning,
          })
        );
      }
    } else if (isInsideBox) {
      const logCountLabel = state.boxLogLoading ? '…' : String(state.boxLogs.length);
      sheetParts.push(
        el('div', { className: 'ri-confirm-input-wrap' }, [
          el('div', { className: 'ri-mode-row' }, [
            el('button', {
              type: 'button',
              className: `ri-mode-btn${state.boxTab === 'replace' ? ' is-active' : ''}`,
              text: 'Đổi MAC Box',
              onClick: () => {
                state.boxTab = 'replace';
                renderConfirm();
              },
            }),
            el('button', {
              type: 'button',
              className: `ri-mode-btn${state.boxTab === 'history' ? ' is-active' : ''}`,
              text: `Lịch sử Reset MAC (${logCountLabel})`,
              onClick: () => {
                state.boxTab = 'history';
                renderConfirm();
              },
            }),
          ]),
        ])
      );

      if (state.boxTab === 'history') {
        showConfirmBtn = false;
        sheetParts.push(
          el('div', { className: 'ri-confirm-input-wrap' }, [
            el('div', { className: 'ri-inline-head' }, [
              el('span', { className: 'ri-confirm-label', text: 'Lịch sử hoán đổi / Reset MAC Box' }),
              el('button', {
                type: 'button',
                className: 'ri-text-btn',
                text: 'Tải lại lịch sử',
                onClick: () => reloadBoxLogsForModal(contractId),
              }),
            ]),
          ])
        );

        if (state.boxLogLoading) {
          sheetParts.push(
            el('div', { className: 'ri-sheet-status is-loading' }, [
              el('span', { className: 'ri-spinner' }),
              el('span', { text: `Đang tải lịch sử Reset MAC Box của ${contractId}…` }),
            ])
          );
        } else if (state.boxLogError) {
          sheetParts.push(
            el('div', { className: 'ri-sheet-status', 'data-tone': 'error' }, [
              el('div', { text: state.boxLogError }),
              el('div', { className: 'ri-result-actions' }, [
                el('button', {
                  type: 'button',
                  className: 'ri-secondary-btn',
                  text: 'Thử tải lại',
                  onClick: () => reloadBoxLogsForModal(contractId),
                }),
              ]),
            ])
          );
        } else if (state.boxLogs.length === 0) {
          sheetParts.push(
            el('div', { className: 'ri-sheet-status' }, [
              el('div', { text: `Chưa có lịch sử Reset MAC Box nào cho hợp đồng ${contractId}.` }),
            ])
          );
        } else {
          sheetParts.push(
            el(
              'div',
              { className: 'ri-history-list' },
              state.boxLogs.map((log) => {
                const macLine =
                  log.oldMac && log.newMac
                    ? `${log.oldMac} → ${log.newMac}`
                    : log.oldMac || log.newMac || 'Thao tác MAC Box';
                const metaParts = [];
                if (log.time) metaParts.push(log.time);
                if (log.actor) metaParts.push(`Thực hiện: ${log.actor}`);
                const cardParts = [
                  el('div', { className: 'ri-history-macs', text: macLine }),
                ];
                if (log.oldBoxType || log.newBoxType) {
                  cardParts.push(
                    el('div', {
                      className: 'ri-history-meta',
                      text: `Loại Box: ${log.oldBoxType || '—'} → ${log.newBoxType || '—'}`,
                    })
                  );
                }
                if (metaParts.length > 0) {
                  cardParts.push(
                    el('div', { className: 'ri-history-meta', text: metaParts.join(' • ') })
                  );
                }
                if (log.note) {
                  cardParts.push(el('div', { className: 'ri-history-meta', text: log.note }));
                }
                if (Array.isArray(log.extraFields) && log.extraFields.length > 0) {
                  cardParts.push(
                    el('div', {
                      className: 'ri-history-meta',
                      text: log.extraFields.map((f) => `${f.label}: ${f.value}`).join(' • '),
                    })
                  );
                }
                return el('div', { className: 'ri-history-card' }, cardParts);
              })
            )
          );
        }
      } else {
        confirmBtn.textContent = 'Xác nhận đổi MAC Box';

        if (state.boxLoading) {
          sheetParts.push(
            el('div', { className: 'ri-sheet-status is-loading' }, [
              el('span', { className: 'ri-spinner' }),
              el('span', { text: `Đang tải danh sách MAC Box của hợp đồng ${contractId}…` }),
            ])
          );
          confirmBtn.disabled = true;
        } else if (state.boxError) {
          const errActions = [
            el('button', {
              type: 'button',
              className: 'ri-secondary-btn',
              text: 'Thử tải lại',
              onClick: () => loadBoxMacsForModal(contractId),
            }),
          ];
          if (state.boxLoginUrl && /iam|hết hạn/i.test(state.boxError)) {
            errActions.push(
              el('button', {
                type: 'button',
                className: 'ri-secondary-btn',
                text: 'Đăng nhập IAM',
                onClick: () => {
                  openExternalOrPortalUrl(state.boxLoginUrl, {
                    mode: 'login',
                    title: 'Đăng nhập IAM',
                    pageWindow,
                  });
                },
              })
            );
          }
          sheetParts.push(
            el('div', { className: 'ri-sheet-status', 'data-tone': 'error' }, [
              el('div', { text: state.boxError }),
              el('div', { className: 'ri-result-actions' }, errActions),
            ])
          );
          confirmBtn.disabled = true;
        } else if (state.boxItems.length === 0) {
          sheetParts.push(
            el('div', { className: 'ri-sheet-status', 'data-tone': 'warn' }, [
              el('div', {
                text: `Hợp đồng ${contractId} hiện chưa có MAC Box nào trên Replace MAC.`,
              }),
              el('div', { className: 'ri-result-actions' }, [
                el('button', {
                  type: 'button',
                  className: 'ri-secondary-btn',
                  text: 'Tải lại danh sách',
                  onClick: () => loadBoxMacsForModal(contractId),
                }),
              ]),
            ])
          );
          confirmBtn.disabled = true;
        } else {
          const listLabel =
            state.boxItems.length > 1
              ? `Hợp đồng có ${state.boxItems.length} Box — hãy chạm chọn MAC Box cần thay thế:`
              : 'MAC Box hiện tại trên hợp đồng:';

          const boxListEl = el(
            'div',
            { className: 'ri-box-list' },
            state.boxItems.map((item) => {
              const isSelected = state.boxSelectedMac === item.MAC;
              const subParts = [];
              if (item.IdContract) subParts.push(`IdContract: ${item.IdContract}`);
              if (item.Contract) subParts.push(`HĐ: ${item.Contract}`);
              return el(
                'button',
                {
                  type: 'button',
                  className: `ri-box-item${isSelected ? ' is-selected' : ''}`,
                  'aria-pressed': isSelected ? 'true' : 'false',
                  onClick: () => {
                    state.boxSelectedMac = item.MAC;
                    renderConfirm();
                  },
                },
                [
                  el('div', { className: 'ri-box-item-main' }, [
                    el('div', { className: 'ri-box-mac', text: item.MAC }),
                    subParts.length > 0
                      ? el('div', { className: 'ri-box-sub', text: subParts.join(' • ') })
                      : null,
                  ]),
                  el('span', {
                    className: 'ri-tab-badge',
                    text: isSelected ? 'Đang chọn' : 'Chọn',
                  }),
                ]
              );
            })
          );

          sheetParts.push(
            el('div', { className: 'ri-confirm-input-wrap' }, [
              el('div', { className: 'ri-inline-head' }, [
                el('span', { className: 'ri-confirm-label', text: listLabel }),
                el('button', {
                  type: 'button',
                  className: 'ri-text-btn',
                  text: 'Tải lại',
                  onClick: () => loadBoxMacsForModal(contractId),
                }),
              ]),
              boxListEl,
            ])
          );

          const macInput = el('input', {
            type: 'text',
            className: 'ri-confirm-input',
            id: 'ri-box-new-mac',
            placeholder: 'Ví dụ: AABBCCDDEEFF hoặc FBOX001122334455',
            autocomplete: 'off',
            spellcheck: 'false',
            value: state.boxNewMac,
          });
          macInput.value = state.boxNewMac;

          const hintEl = el('div', { className: 'ri-field-hint' });

          function syncBoxUi() {
            const trimmed = String(state.boxNewMac || '').trim();
            const macCheck = trimmed ? validateBoxNewMac(trimmed) : null;
            if (!trimmed) {
              hintEl.textContent =
                'Nhập 12 ký tự (không gồm FBOX) hoặc 16 ký tự (bắt đầu bằng FBOX).';
              hintEl.dataset.state = 'neutral';
            } else if (macCheck.valid) {
              hintEl.textContent = `Hợp lệ: ${macCheck.value} (${macCheck.value.length} ký tự)`;
              hintEl.dataset.state = 'ok';
            } else {
              hintEl.textContent = macCheck.error;
              hintEl.dataset.state = 'error';
            }
            confirmBtn.disabled =
              !state.boxSelectedMac || !macCheck || !macCheck.valid;
          }

          macInput.addEventListener('input', (e) => {
            state.boxNewMac = e.target.value;
            syncBoxUi();
          });

          sheetParts.push(
            el('div', { className: 'ri-confirm-input-wrap' }, [
              el('label', {
                className: 'ri-confirm-label',
                for: 'ri-box-new-mac',
                text: 'MAC Box mới (bắt buộc 12 hoặc 16 ký tự)',
              }),
              macInput,
              hintEl,
            ])
          );

          syncBoxUi();

          confirmBtn.addEventListener('click', () => {
            const selectedItem =
              state.boxItems.find((x) => x.MAC === state.boxSelectedMac) || {};
            runConfirmedAction(act, {
              oldMac: state.boxSelectedMac,
              idContract:
                selectedItem.IdContract || (cached && cached.objID ? String(cached.objID) : ''),
              newMac: state.boxNewMac,
            });
          });
        }
      }
    } else if (isInsideKill) {
      showConfirmBtn = false;

      sheetParts.push(
        el('div', { className: 'ri-confirm-input-wrap' }, [
          el('div', { className: 'ri-inline-head' }, [
            el('span', { className: 'ri-confirm-label', text: 'Danh sách phiên đang online' }),
            el('button', {
              type: 'button',
              className: 'ri-text-btn',
              text: 'Tải lại phiên',
              onClick: () => loadKillSessionsForModal(contractId),
            }),
          ]),
        ])
      );

      if (state.killLoading) {
        sheetParts.push(
          el('div', { className: 'ri-sheet-status is-loading' }, [
            el('span', { className: 'ri-spinner' }),
            el('span', { text: `Đang tìm phiên đang chạy của hợp đồng ${contractId}…` }),
          ])
        );
      } else if (state.killError) {
        const errActions = [
          el('button', {
            type: 'button',
            className: 'ri-secondary-btn',
            text: 'Thử tải lại',
            onClick: () => loadKillSessionsForModal(contractId),
          }),
        ];
        if (state.killLoginUrl && /iam|hết hạn/i.test(state.killError)) {
          errActions.push(
            el('button', {
              type: 'button',
              className: 'ri-secondary-btn',
              text: 'Đăng nhập IAM',
              onClick: () => {
                openExternalOrPortalUrl(state.killLoginUrl, {
                  mode: 'login',
                  title: 'Đăng nhập IAM',
                  pageWindow,
                });
              },
            })
          );
        }
        sheetParts.push(
          el('div', { className: 'ri-sheet-status', 'data-tone': 'error' }, [
            el('div', { text: state.killError }),
            el('div', { className: 'ri-result-actions' }, errActions),
          ])
        );
      } else if (state.killSessions.length === 0) {
        sheetParts.push(
          el('div', { className: 'ri-sheet-status' }, [
            el('div', {
              text: `Hợp đồng ${contractId} hiện không có phiên nào đang giữ trên Kill Session.`,
            }),
            el('div', { className: 'ri-result-actions' }, [
              el('button', {
                type: 'button',
                className: 'ri-secondary-btn',
                text: 'Kiểm tra lại',
                onClick: () => loadKillSessionsForModal(contractId),
              }),
            ]),
          ])
        );
      } else {
        sheetParts.push(
          el(
            'div',
            { className: 'ri-session-list' },
            state.killSessions.map((sess, idx) => {
              const rowKey = sess.objID || sess.ipAddress || String(idx);
              const isArmed = state.killArmedObjId === rowKey;
              const infoLines = [];
              if (sess.nasName) infoLines.push(`BRAS / NAS: ${sess.nasName}`);
              const accParts = [];
              if (sess.name) accParts.push(`Tên truy nhập: ${sess.name}`);
              if (sess.objID) accParts.push(`ObjID: ${sess.objID}`);
              if (accParts.length > 0) infoLines.push(accParts.join(' • '));
              const timeParts = [];
              if (sess.callerId) timeParts.push(`MAC: ${sess.callerId}`);
              if (sess.date) timeParts.push(`Bắt đầu: ${sess.date}`);
              if (timeParts.length > 0) infoLines.push(timeParts.join(' • '));

              const actionRow = isArmed
                ? el('div', { className: 'ri-session-actions' }, [
                    el('button', {
                      type: 'button',
                      className: 'ri-secondary-btn',
                      text: 'Hủy',
                      onClick: () => {
                        state.killArmedObjId = '';
                        renderConfirm();
                      },
                    }),
                    el('button', {
                      type: 'button',
                      className: 'ri-danger-btn',
                      text: `Xác nhận Kill ${sess.ipAddress || 'phiên này'}`,
                      onClick: () =>
                        runConfirmedAction(act, {
                          objID: sess.objID,
                          ipAddress: sess.ipAddress,
                          nasName: sess.nasName,
                          sessionName: sess.name,
                        }),
                    }),
                  ])
                : el('div', { className: 'ri-session-actions' }, [
                    el('button', {
                      type: 'button',
                      className: 'ri-danger-btn ri-session-kill-btn',
                      text: 'Kill phiên này',
                      onClick: () => {
                        state.killArmedObjId = rowKey;
                        renderConfirm();
                      },
                    }),
                  ]);

              return el('div', { className: 'ri-session-card' }, [
                el('div', {
                  className: 'ri-session-ip',
                  text: sess.ipAddress ? `IP đang chạy: ${sess.ipAddress}` : 'Phiên đang giữ (chưa rõ IP)',
                }),
                ...infoLines.map((line) => el('div', { className: 'ri-session-meta', text: line })),
                actionRow,
              ]);
            })
          )
        );
      }
    } else if (isInsideBypass) {
      const manageCountLabel = state.bypassLoading ? '…' : String(state.bypassRows.length);
      sheetParts.push(
        el('div', { className: 'ri-confirm-input-wrap' }, [
          el('div', { className: 'ri-mode-row' }, [
            el('button', {
              type: 'button',
              className: `ri-mode-btn${state.bypassTab === 'create' ? ' is-active' : ''}`,
              text: 'Thêm mới ByPass',
              onClick: () => {
                state.bypassTab = 'create';
                renderConfirm();
              },
            }),
            el('button', {
              type: 'button',
              className: `ri-mode-btn${state.bypassTab === 'manage' ? ' is-active' : ''}`,
              text: `Tra cứu / Sửa (${manageCountLabel})`,
              onClick: () => {
                state.bypassTab = 'manage';
                renderConfirm();
              },
            }),
          ]),
        ])
      );

      if (state.bypassMeta && state.bypassMeta.currentUser) {
        sheetParts.push(
          el('div', {
            className: 'ri-confirm-meta',
            text: `Tài khoản thao tác (AccLeaderByPass): ${state.bypassMeta.currentUser}`,
          })
        );
      }

      if (state.bypassLoading) {
        sheetParts.push(
          el('div', { className: 'ri-sheet-status is-loading' }, [
            el('span', { className: 'ri-spinner' }),
            el('span', { text: 'Đang tải thông tin CheckList ByPass từ mvc.inside.fpt.net…' }),
          ])
        );
        confirmBtn.disabled = true;
      } else if (state.bypassError) {
        const errActions = [
          el('button', {
            type: 'button',
            className: 'ri-secondary-btn',
            text: 'Thử tải lại',
            onClick: () => loadInsideByPassModal(contractId),
          }),
        ];
        if (state.bypassLoginUrl && /iam|hết hạn/i.test(state.bypassError)) {
          errActions.push(
            el('button', {
              type: 'button',
              className: 'ri-secondary-btn',
              text: 'Đăng nhập IAM',
              onClick: () => {
                openExternalOrPortalUrl(state.bypassLoginUrl, {
                  mode: 'login',
                  title: 'Đăng nhập IAM',
                  pageWindow,
                });
              },
            })
          );
        }
        sheetParts.push(
          el('div', { className: 'ri-sheet-status', 'data-tone': 'error' }, [
            el('div', { text: state.bypassError }),
            el('div', { className: 'ri-result-actions' }, errActions),
          ])
        );
        confirmBtn.disabled = true;
      } else if (state.bypassTab === 'create') {
        confirmBtn.textContent = 'Lưu ByPass mới';

        if (state.bypassMeta && state.bypassMeta.isInsert === false) {
          sheetParts.push(
            el('div', { className: 'ri-sheet-status', 'data-tone': 'warn' }, [
              el('div', {
                text: 'Tài khoản hiện tại có thể không có quyền thêm mới ByPass (isInsert = False).',
              }),
            ])
          );
        }

        if (state.bypassRows.length > 0) {
          sheetParts.push(
            el('div', { className: 'ri-sheet-status', 'data-tone': 'warn' }, [
              el('div', {
                text: `Tìm thấy ${state.bypassRows.length} bản ghi ByPass trong tháng này cho "${state.bypassSearchQuery}". Bạn có thể xem hoặc cập nhật tại tab Tra cứu / Sửa.`,
              }),
              el('div', { className: 'ri-result-actions' }, [
                el('button', {
                  type: 'button',
                  className: 'ri-secondary-btn',
                  text: `Mở Tra cứu / Sửa (${state.bypassRows.length})`,
                  onClick: () => {
                    state.bypassTab = 'manage';
                    renderConfirm();
                  },
                }),
              ]),
            ])
          );
        }

        const choiceSelect = el('select', { className: 'ri-select', id: 'ri-bypass-choice' });
        for (const opt of BYPASS_CHOICE_OPTIONS) {
          const o = el('option', { value: opt.value, text: opt.label });
          if (opt.value === state.bypassChoice) o.selected = true;
          choiceSelect.appendChild(o);
        }
        choiceSelect.value = state.bypassChoice;

        const targetInput = el('input', {
          type: 'text',
          className: 'ri-confirm-input',
          id: 'ri-bypass-contract',
          placeholder:
            state.bypassChoice === 'Tập điểm'
              ? 'Ví dụ: POP01.0001/FO'
              : 'Ví dụ: SGN123456',
          autocomplete: 'off',
          spellcheck: 'false',
          value: state.bypassContract,
        });
        targetInput.value = state.bypassContract;

        const accInput = el('input', {
          type: 'email',
          className: 'ri-confirm-input',
          id: 'ri-bypass-acc',
          placeholder: 'Ví dụ: ten.nvkt@fpt.com (bắt buộc có @)',
          autocomplete: 'off',
          spellcheck: 'false',
          value: state.bypassAcc,
        });
        accInput.value = state.bypassAcc;

        const accHint = el('div', { className: 'ri-field-hint' });
        const formHint = el('div', { className: 'ri-field-hint' });

        function syncBypassCreateUi() {
          const rawAcc = String(state.bypassAcc || '').trim();
          if (!rawAcc) {
            accHint.textContent = 'Check NVKT: Bắt buộc nhập email NV kỹ thuật (có ký tự @).';
            accHint.dataset.state = 'neutral';
          } else if (rawAcc.includes('@')) {
            accHint.textContent = `Check NVKT hợp lệ: ${rawAcc}`;
            accHint.dataset.state = 'ok';
          } else {
            accHint.textContent = 'Check NVKT: Định dạng mail chưa đúng (thiếu ký tự @).';
            accHint.dataset.state = 'error';
          }

          const v = validateByPassPayload({
            mode: 'create',
            choice: state.bypassChoice,
            contract: state.bypassContract,
            accByPass: state.bypassAcc,
            typeByPass: state.bypassType,
            contentByPass: state.bypassContent,
          });
          if (v.valid) {
            formHint.textContent = `Sẵn sàng lưu (${v.choice}: ${v.contract})`;
            formHint.dataset.state = 'ok';
            confirmBtn.disabled = false;
          } else {
            formHint.textContent = v.error;
            formHint.dataset.state = 'warn';
            confirmBtn.disabled = true;
          }
        }

        choiceSelect.addEventListener('change', (e) => {
          state.bypassChoice = e.target.value;
          targetInput.placeholder =
            state.bypassChoice === 'Tập điểm'
              ? 'Ví dụ: POP01.0001/FO'
              : 'Ví dụ: SGN123456';
          syncBypassCreateUi();
        });
        targetInput.addEventListener('input', (e) => {
          state.bypassContract = e.target.value;
          syncBypassCreateUi();
        });
        accInput.addEventListener('input', (e) => {
          state.bypassAcc = e.target.value;
          syncBypassCreateUi();
        });

        const { typeWrap, reasonWrap } = buildByPassStatusAndReasonFields({
          typeId: 'ri-bypass-type',
          reasonId: 'ri-bypass-reason',
          typeLabel: 'Tình trạng ByPass',
          currentType: state.bypassType,
          currentContent: state.bypassContent,
          onTypeChange: (nextType, nextReason) => {
            state.bypassType = nextType;
            state.bypassContent = nextReason;
            syncBypassCreateUi();
          },
          onReasonChange: (nextReason, quiet) => {
            state.bypassContent = nextReason;
            if (!quiet) syncBypassCreateUi();
          },
        });

        sheetParts.push(
          el('div', { className: 'ri-confirm-input-wrap' }, [
            el('label', { className: 'ri-confirm-label', for: 'ri-bypass-choice', text: 'Loại' }),
            choiceSelect,
          ]),
          el('div', { className: 'ri-confirm-input-wrap' }, [
            el('label', {
              className: 'ri-confirm-label',
              for: 'ri-bypass-contract',
              text: 'Số hợp đồng / Tập điểm',
            }),
            targetInput,
          ]),
          el('div', { className: 'ri-confirm-input-wrap' }, [
            el('label', {
              className: 'ri-confirm-label',
              for: 'ri-bypass-acc',
              text: 'Email nhân viên kỹ thuật',
            }),
            accInput,
            accHint,
          ]),
          typeWrap,
          reasonWrap,
          formHint
        );

        syncBypassCreateUi();

        confirmBtn.addEventListener('click', () => {
          runConfirmedAction(act, {
            mode: 'create',
            choice: state.bypassChoice,
            contract: state.bypassContract,
            accByPass: state.bypassAcc,
            typeByPass: state.bypassType,
            contentByPass: state.bypassContent,
            accLeaderByPass: (state.bypassMeta && state.bypassMeta.currentUser) || '',
          });
        });
      } else {
        const searchInput = el('input', {
          type: 'text',
          className: 'ri-confirm-input',
          id: 'ri-bypass-search',
          placeholder: 'Nhập Số HĐ hoặc Tập điểm để tìm…',
          autocomplete: 'off',
          spellcheck: 'false',
          value: state.bypassSearchQuery,
        });
        searchInput.value = state.bypassSearchQuery;
        searchInput.addEventListener('input', (e) => {
          state.bypassSearchQuery = e.target.value;
        });

        sheetParts.push(
          el('div', { className: 'ri-confirm-input-wrap' }, [
            el('label', {
              className: 'ri-confirm-label',
              for: 'ri-bypass-search',
              text: 'Tìm kiếm CheckList ByPass (trong tháng hiện tại)',
            }),
            el('div', { className: 'ri-contract-row' }, [
              searchInput,
              el('button', {
                type: 'button',
                className: 'ri-primary-btn',
                text: 'Tìm',
                onClick: () => runByPassSearchInModal(state.bypassSearchQuery),
              }),
            ]),
          ])
        );

        if (state.bypassRows.length === 0) {
          showConfirmBtn = false;
          sheetParts.push(
            el('div', { className: 'ri-sheet-status', 'data-tone': 'warn' }, [
              el('div', {
                text: state.bypassSearchQuery
                  ? `Không tìm thấy bản ghi ByPass nào cho "${state.bypassSearchQuery}" trong tháng này.`
                  : 'Nhập Số hợp đồng hoặc Tập điểm rồi bấm "Tìm".',
              }),
            ])
          );
        } else {
          confirmBtn.textContent = 'Lưu cập nhật ByPass';
          const listEl = el(
            'div',
            { className: 'ri-box-list' },
            state.bypassRows.map((row, idx) => {
              const rowKey = getBypassRowKey(row, idx);
              const isSelected = state.bypassSelectedKey === rowKey;
              const subLines = [
                `Loại: ${row.flagByPassLabel || row.flagByPass || '—'}`,
                row.content ? `Lý do: ${row.content}` : '',
                `NVKT: ${row.accByPass || '—'}`,
                [
                  row.district ? `Quận: ${row.district}` : '',
                  row.accCreateByPass ? `Tạo: ${row.accCreateByPass}` : '',
                  row.date ? `Ngày tạo: ${row.date}` : '',
                  row.updateDate ? `Cập nhật: ${row.updateDate}` : '',
                ]
                  .filter(Boolean)
                  .join(' • '),
              ].filter(Boolean);

              return el(
                'button',
                {
                  type: 'button',
                  className: `ri-box-item${isSelected ? ' is-selected' : ''}`,
                  'aria-pressed': isSelected ? 'true' : 'false',
                  onClick: () => {
                    selectBypassRow(row, idx);
                    renderConfirm();
                  },
                },
                [
                  el('div', { className: 'ri-box-item-main' }, [
                    el('div', { className: 'ri-box-mac', text: row.contract || '—' }),
                    ...subLines.map((line) => el('div', { className: 'ri-box-sub', text: line })),
                  ]),
                  el('span', {
                    className: 'ri-tab-badge',
                    text: isSelected ? 'Đang sửa' : 'Chọn',
                  }),
                ]
              );
            })
          );

          sheetParts.push(
            el('div', { className: 'ri-confirm-input-wrap' }, [
              el('div', { className: 'ri-inline-head' }, [
                el('span', {
                  className: 'ri-confirm-label',
                  text: `Tìm được ${state.bypassRows.length} bản ghi ByPass`,
                }),
                el('button', {
                  type: 'button',
                  className: 'ri-text-btn',
                  text: 'Tải lại',
                  onClick: () => runByPassSearchInModal(state.bypassSearchQuery),
                }),
              ]),
              listEl,
            ])
          );

          const selectedRow =
            state.bypassRows.find((r, i) => getBypassRowKey(r, i) === state.bypassSelectedKey) ||
            state.bypassRows[0];

          const editAccInput = el('input', {
            type: 'email',
            className: 'ri-confirm-input',
            id: 'ri-bypass-edit-acc',
            placeholder: 'Email nhân viên kỹ thuật (có @)',
            autocomplete: 'off',
            spellcheck: 'false',
            value: state.bypassEditAcc,
          });
          editAccInput.value = state.bypassEditAcc;

          const editHint = el('div', { className: 'ri-field-hint' });

          function syncBypassUpdateUi() {
            const v = validateByPassPayload({
              mode: 'update',
              contract: selectedRow.contract,
              accByPass: state.bypassEditAcc,
              typeByPass: state.bypassEditType,
              contentByPass: state.bypassEditContent,
              oldAccByPass: selectedRow.accByPass,
              oldTypeByPass: selectedRow.flagByPass,
              oldContentByPass: selectedRow.content,
            });
            if (v.valid) {
              editHint.textContent = `Sẵn sàng cập nhật ${selectedRow.contract}`;
              editHint.dataset.state = 'ok';
              confirmBtn.disabled = false;
            } else {
              editHint.textContent = v.error;
              editHint.dataset.state = 'warn';
              confirmBtn.disabled = true;
            }
          }

          editAccInput.addEventListener('input', (e) => {
            state.bypassEditAcc = e.target.value;
            syncBypassUpdateUi();
          });

          const { typeWrap, reasonWrap } = buildByPassStatusAndReasonFields({
            typeId: 'ri-bypass-edit-type',
            reasonId: 'ri-bypass-edit-reason',
            typeLabel: 'Loại ByPass mới',
            currentType: state.bypassEditType || selectedRow.flagByPass || 'Bo Gong',
            currentContent: state.bypassEditContent,
            onTypeChange: (nextType, nextReason) => {
              state.bypassEditType = nextType;
              state.bypassEditContent = nextReason;
              syncBypassUpdateUi();
            },
            onReasonChange: (nextReason, quiet) => {
              state.bypassEditContent = nextReason;
              if (!quiet) syncBypassUpdateUi();
            },
          });

          sheetParts.push(
            el('div', { className: 'ri-confirm-input-wrap' }, [
              el('label', {
                className: 'ri-confirm-label',
                for: 'ri-bypass-edit-acc',
                text: `Chỉnh sửa dòng: ${selectedRow.contract}`,
              }),
              editAccInput,
            ]),
            typeWrap,
            reasonWrap,
            editHint
          );

          if (state.bypassMeta && state.bypassMeta.canDelete) {
            const delKey = getBypassRowKey(
              selectedRow,
              state.bypassRows.indexOf(selectedRow)
            );
            const isDelArmed = state.bypassArmedDelete === delKey;
            sheetParts.push(
              el('div', { className: 'ri-confirm-input-wrap' }, [
                isDelArmed
                  ? el('div', { className: 'ri-result-actions' }, [
                      el('button', {
                        type: 'button',
                        className: 'ri-secondary-btn',
                        text: 'Hủy xóa',
                        onClick: () => {
                          state.bypassArmedDelete = '';
                          renderConfirm();
                        },
                      }),
                      el('button', {
                        type: 'button',
                        className: 'ri-danger-btn',
                        text: `Xác nhận xóa ${selectedRow.contract}`,
                        onClick: () =>
                          runConfirmedAction(act, {
                            mode: 'delete',
                            contract: selectedRow.contract,
                          }),
                      }),
                    ])
                  : el('button', {
                      type: 'button',
                      className: 'ri-secondary-btn',
                      text: `Xóa dòng ${selectedRow.contract}`,
                      onClick: () => {
                        state.bypassArmedDelete = delKey;
                        renderConfirm();
                      },
                    }),
              ])
            );
          }

          syncBypassUpdateUi();

          confirmBtn.addEventListener('click', () => {
            runConfirmedAction(act, {
              mode: 'update',
              contract: selectedRow.contract,
              accByPass: state.bypassEditAcc,
              typeByPass: state.bypassEditType,
              contentByPass: state.bypassEditContent,
              oldAccByPass: selectedRow.accByPass,
              oldTypeByPass: selectedRow.flagByPass,
              oldContentByPass: selectedRow.content,
            });
          });
        }
      }
    } else if (isInsideDeploy) {
      showConfirmBtn = false;
      cancelBtn.textContent = 'Đóng';

      if (state.deployLoading) {
        sheetParts.push(
          el('div', { className: 'ri-sheet-status is-loading' }, [
            el('span', { className: 'ri-spinner' }),
            el('span', {
              text: contractId
                ? `Đang tải phiếu triển khai FOX-ERP cho ${contractId}…`
                : 'Đang tải phiếu triển khai từ FOX-ERP…',
            }),
          ])
        );
      } else if (state.deployError) {
        const errActions = [
          el('button', {
            type: 'button',
            className: 'ri-secondary-btn',
            text: 'Thử tải lại',
            onClick: () => loadDeployTicketModal(contractId),
          }),
        ];
        if (state.deployLoginUrl) {
          errActions.push(
            el('button', {
              type: 'button',
              className: 'ri-primary-btn',
              text: state.deployLoginLabel || 'Đăng nhập IAM',
              onClick: () => {
                openExternalOrPortalUrl(state.deployLoginUrl, {
                  mode: 'login',
                  title: state.deployLoginLabel || 'Đăng nhập FOX-ERP / Partner',
                  pageWindow,
                });
              },
            })
          );
        }
        sheetParts.push(
          el('div', { className: 'ri-sheet-status', 'data-tone': 'error' }, [
            el('div', { text: state.deployError }),
            el('div', { className: 'ri-result-actions' }, errActions),
          ])
        );
      } else if (!state.deploySummary || !state.deploySummary.ticket) {
        sheetParts.push(
          el('div', { className: 'ri-sheet-status' }, [
            el('div', { text: 'Không tìm thấy phiếu triển khai khả dụng.' }),
          ])
        );
      } else {
        const summary = state.deploySummary;
        const ticket = summary.ticket;
        const eq = state.deployEquipments || { importItems: [], revokeItems: [], macCount: 0 };
        const metrics = state.deployModemMetrics || null;
        const isBusy = Boolean(state.deployBusyAction);

        if (summary.tickets && summary.tickets.length > 1) {
          const ticketSel = el(
            'select',
            { className: 'ri-select', id: 'ri-deploy-ticket-select' },
            summary.tickets.map((t) =>
              el('option', {
                value: String(t.supId),
                text: `${t.depCode} — ${t.statusDesc || 'Phiếu'}`,
              })
            )
          );
          ticketSel.value = String(ticket.supId);
          ticketSel.addEventListener('change', (e) => switchDeployTicketSupId(e.target.value));
          sheetParts.push(
            el('div', { className: 'ri-confirm-input-wrap' }, [
              el('label', {
                className: 'ri-confirm-label',
                for: 'ri-deploy-ticket-select',
                text: `Chọn phiếu (${summary.tickets.length} phiếu)`,
              }),
              ticketSel,
            ])
          );
        }

        const topUtilityBtns = [
          el('button', {
            type: 'button',
            className: 'ri-text-btn',
            text: 'Tải lại phiếu',
            onClick: () => loadDeployTicketModal(contractId || summary.contract, ticket.supId),
          }),
        ];
        if (state.deployTicketUrl) {
          topUtilityBtns.unshift(
            el('button', {
              type: 'button',
              className: 'ri-text-btn',
              text: 'Mở phiếu gốc',
              onClick: () => {
                openExternalOrPortalUrl(state.deployTicketUrl, {
                  mode: 'portal',
                  title: ticket.depCode || 'Phiếu triển khai FOX-ERP',
                  pageWindow,
                });
              },
            })
          );
        }

        sheetParts.push(
          el('div', { className: 'ri-confirm-input-wrap' }, [
            el('div', { className: 'ri-inline-head' }, [
              el('span', {
                className: 'ri-confirm-label',
                text: `${ticket.depCode} • ${ticket.statusDesc}`,
              }),
              el('div', { className: 'ri-result-actions' }, topUtilityBtns),
            ]),
            el('div', { className: 'ri-mode-row' }, [
              el('button', {
                type: 'button',
                className: `ri-mode-btn${state.deployTab === 'overview' ? ' is-active' : ''}`,
                text: 'Tổng quan',
                onClick: () => {
                  state.deployTab = 'overview';
                  state.deployArmedAction = '';
                  renderConfirm();
                },
              }),
              el('button', {
                type: 'button',
                className: `ri-mode-btn${state.deployTab === 'equipment' ? ' is-active' : ''}`,
                text: `Vật tư & MAC (${eq.importItems.length})`,
                onClick: () => {
                  state.deployTab = 'equipment';
                  state.deployArmedAction = '';
                  renderConfirm();
                },
              }),
              el('button', {
                type: 'button',
                className: `ri-mode-btn${state.deployTab === 'complete' ? ' is-active' : ''}`,
                text: 'Hoàn tất',
                onClick: () => {
                  state.deployTab = 'complete';
                  state.deployArmedAction = '';
                  renderConfirm();
                },
              }),
              el('button', {
                type: 'button',
                className: `ri-mode-btn${state.deployTab === 'extras' ? ' is-active' : ''}`,
                text: 'SĐT & BBĐT',
                onClick: () => {
                  state.deployTab = 'extras';
                  state.deployArmedAction = '';
                  renderConfirm();
                  loadDeployExtrasForModal();
                },
              }),
            ]),
          ])
        );

        if (state.deployNotice) {
          sheetParts.push(
            el('div', {
              className: 'ri-sheet-status',
              'data-tone': state.deployNoticeTone || 'info',
            }, [el('div', { text: state.deployNotice })])
          );
        }

        function buildDeployKvList(rows) {
          const filtered = rows.filter(([, val]) => val !== '' && val !== undefined && val !== null);
          return el(
            'div',
            { className: 'ri-kv-list' },
            filtered.map(([k, val]) =>
              el('div', { className: 'ri-kv-item' }, [
                el('span', { className: 'ri-kv-key', text: k }),
                el('span', { className: 'ri-kv-val', text: String(val) }),
              ])
            )
          );
        }

        function buildArmedConfirmRow({
          armKey,
          idleLabel,
          idleClass = 'ri-danger-btn',
          confirmLabel,
          busyKey,
          onConfirm,
        }) {
          const isArmed = state.deployArmedAction === armKey;
          if (isArmed) {
            return el('div', { className: 'ri-result-actions' }, [
              el('button', {
                type: 'button',
                className: 'ri-secondary-btn',
                disabled: isBusy,
                text: 'Hủy',
                onClick: () => {
                  state.deployArmedAction = '';
                  renderConfirm();
                },
              }),
              el('button', {
                type: 'button',
                className: idleClass,
                disabled: isBusy,
                text: state.deployBusyAction === busyKey ? 'Đang gửi…' : confirmLabel,
                onClick: onConfirm,
              }),
            ]);
          }
          return el('button', {
            type: 'button',
            className: idleClass,
            disabled: isBusy,
            text: state.deployBusyAction === busyKey ? 'Đang xử lý…' : idleLabel,
            onClick: () => {
              state.deployArmedAction = armKey;
              renderConfirm();
            },
          });
        }

        if (state.deployTab === 'overview') {
          const mainEmpText = ticket.mainEmp
            ? [ticket.mainEmp.account, ticket.mainEmp.phone].filter(Boolean).join(' • ')
            : '';
          const csNoteRaw = String(ticket.descriptionCs || '').replace(/\s+/g, ' ').trim();
          const csNoteText = csNoteRaw.length > 220 ? `${csNoteRaw.slice(0, 217)}…` : csNoteRaw;
          const byPassLabel =
            metrics && metrics.StatusByPass === true
              ? 'Có (ByPass)'
              : metrics && metrics.StatusByPass === false
              ? 'Không'
              : (metrics && metrics.StatusByPass) || '—';

          sheetParts.push(
            buildDeployKvList([
              ['Mã phiếu', ticket.depCode],
              ['Tình trạng', ticket.statusDesc],
              ['Loại triển khai', ticket.depTypeDesc],
              ['Khách hàng', summary.fullName],
              ['Địa chỉ', ticket.location || summary.address],
              ['Gói / Dịch vụ', [summary.nameObj, summary.localTypeName].filter(Boolean).join(' • ')],
              ['Tập điểm / Port', ticket.odcCableType || ticket.groupPoints],
              ['Block', [ticket.blockDepName, ticket.plotsName].filter(Boolean).join(' • ')],
              ['KTV chính', mainEmpText || 'Chưa phân công'],
              ['Lịch hẹn', ticket.appointmentDate],
              ['Ngày hoàn tất', ticket.finishDate],
              ['Cáp khảo sát', `Indoor: ${ticket.indoor || '0'}m • Outdoor: ${ticket.outdoor || '0'}m`],
              ['Ghi chú CS', csNoteText],
            ])
          );

          const payment = state.deployPayment;
          if (payment) {
            const paymentRows = [
              ['Tình trạng thanh toán', payment.paymentStatusDesc],
              ['Đã thanh toán', formatVndAmount(payment.sumMoneyPaid)],
              ['Chưa thanh toán', formatVndAmount(payment.sumMoneyUnPaid)],
            ];
            for (const fee of payment.serviceFees || []) {
              paymentRows.push([fee.name || 'Khoản thu', formatVndAmount(fee.money)]);
            }
            for (const tf of payment.ticketFees || []) {
              if (tf.feePayment > 0 || tf.feePaymentPaid > 0) {
                const amt = tf.feePayment > 0 ? tf.feePayment : tf.feePaymentPaid;
                paymentRows.push([tf.description || 'Phí phát sinh', formatVndAmount(amt)]);
              }
            }
            sheetParts.push(
              el('div', { className: 'ri-confirm-input-wrap' }, [
                el('span', { className: 'ri-confirm-label', text: 'Khoản thu' }),
                buildDeployKvList(paymentRows),
              ])
            );
          }

          sheetParts.push(
            el('div', { className: 'ri-confirm-input-wrap' }, [
              el('div', { className: 'ri-inline-head' }, [
                el('span', { className: 'ri-confirm-label', text: 'Thông số kết nối NET' }),
                el('button', {
                  type: 'button',
                  className: 'ri-text-btn',
                  text: 'Làm mới',
                  onClick: refreshDeployMetricsInModal,
                }),
              ]),
              metrics
                ? buildDeployKvList([
                    ['IP hiện tại', metrics.Ip || '—'],
                    ['MAC đang online', metrics.MacAddress || '—'],
                    ['ONU RX / TX', `${metrics.OnuRxPower ?? '—'} / ${metrics.OnuTxPower ?? '—'}`],
                    ['RX Tập điểm', metrics.RxGroupPoints ?? '—'],
                    ['LastMile', metrics.LastMile != null ? `${metrics.LastMile} m` : '—'],
                    ['ByPass', byPassLabel],
                    ['Online đầu tiên', metrics.FirstOnlineMacDate || '—'],
                  ])
                : el('div', {
                    className: 'ri-sheet-status',
                    text: 'Chưa có thông số kết nối NET trực tuyến.',
                  }),
              el('div', { className: 'ri-result-actions' }, [
                buildArmedConfirmRow({
                  armKey: 'sync_online',
                  idleLabel: 'Cập nhật thông tin Online',
                  idleClass: 'ri-primary-btn',
                  confirmLabel: 'Xác nhận cập nhật Online',
                  busyKey: 'sync_online',
                  onConfirm: handleDeploySyncOnline,
                }),
              ]),
            ])
          );
        } else if (state.deployTab === 'equipment') {
          sheetParts.push(
            el('div', { className: 'ri-confirm-input-wrap' }, [
              el('div', { className: 'ri-inline-head' }, [
                el('span', {
                  className: 'ri-confirm-label',
                  text: `Vật tư triển khai (${eq.importItems.length}) • Gắn MAC (${eq.macCount})${
                    eq.revokeItems.length > 0 ? ` • Thu hồi (${eq.revokeItems.length})` : ''
                  }`,
                }),
                el('button', {
                  type: 'button',
                  className: 'ri-text-btn',
                  text: 'Tải lại',
                  onClick: async () => {
                    await refreshDeployEquipmentsInModal();
                    if (state.confirmAction && state.confirmAction.id === 'deploy_ticket') {
                      renderConfirm();
                    }
                  },
                }),
              ]),
              el('div', { className: 'ri-result-actions' }, [
                buildArmedConfirmRow({
                  armKey: 'clear_mac',
                  idleLabel: 'Clear Mac thiết bị',
                  idleClass: 'ri-danger-btn',
                  confirmLabel: 'Xác nhận Clear Mac ngay',
                  busyKey: 'clear_mac',
                  onConfirm: handleDeployClearMac,
                }),
              ]),
            ])
          );

          const allItems = [...eq.importItems, ...eq.revokeItems];
          if (allItems.length === 0) {
            sheetParts.push(
              el('div', { className: 'ri-sheet-status' }, [
                el('div', { text: 'Phiếu chưa có danh sách vật tư triển khai.' }),
              ])
            );
          } else {
            sheetParts.push(
              el(
                'div',
                { className: 'ri-history-list' },
                allItems.map((item) =>
                  el('div', { className: 'ri-history-card' }, [
                    el('div', {
                      className: 'ri-history-macs',
                      text: `${item.name || item.description || 'Thiết bị'}${
                        item.isRevoke ? ' (Thu hồi)' : ''
                      }`,
                    }),
                    el('div', {
                      className: 'ri-history-meta',
                      text: [
                        `SL: ${item.quantity}`,
                        item.serviceName || '',
                        item.functionName || '',
                      ]
                        .filter(Boolean)
                        .join(' • '),
                    }),
                    item.isMac
                      ? el('div', {
                          className: 'ri-modem-mac',
                          text: item.mac ? `MAC: ${item.mac}` : 'MAC: (Trống / Đã Clear)',
                        })
                      : null,
                  ])
                )
              )
            );
          }
        } else if (state.deployTab === 'complete') {
          function buildCatalogSelect(selectId, labelText, parentKey, fallbackText, currentVal, onChange) {
            const opts = parseDataFilterOptions(state.deployDataFilter, parentKey);
            const list = opts.slice();
            if (!list.some((o) => o.id === String(currentVal ?? '0'))) {
              list.unshift({
                id: String(currentVal ?? '0'),
                text: String(currentVal ?? '0') === '0' ? fallbackText : `Mã ${currentVal}`,
              });
            }
            const selectEl = el(
              'select',
              { className: 'ri-select', id: selectId },
              list.map((o) => el('option', { value: o.id, text: o.text }))
            );
            selectEl.value = String(currentVal ?? '0');
            selectEl.addEventListener('change', (e) => onChange(e.target.value));
            return el('div', { className: 'ri-confirm-input-wrap' }, [
              el('label', { className: 'ri-confirm-label', for: selectId, text: labelText }),
              selectEl,
            ]);
          }

          const outdoorInput = el('input', {
            type: 'number',
            className: 'ri-confirm-input',
            id: 'ri-deploy-outdoor-reused',
            min: '0',
            max: '9999',
            placeholder: '0',
            value: state.deployOutDoorReUsed,
          });
          outdoorInput.value = state.deployOutDoorReUsed;
          outdoorInput.addEventListener('input', (e) => {
            state.deployOutDoorReUsed = e.target.value;
          });

          const descArea = el('textarea', {
            className: 'ri-textarea',
            id: 'ri-deploy-desc-rd',
            maxlength: '500',
            placeholder: 'Ghi chú nguyên nhân trễ hạn / triển khai (tối đa 500 ký tự)…',
          });
          descArea.value = state.deployDescriptionRD || '';
          descArea.addEventListener('input', (e) => {
            state.deployDescriptionRD = e.target.value;
          });

          sheetParts.push(
            el('div', { className: 'ri-confirm-input-wrap' }, [
              el('label', {
                className: 'ri-confirm-label',
                for: 'ri-deploy-outdoor-reused',
                text: 'Cáp tận dụng Outdoor (m)',
              }),
              outdoorInput,
            ]),
            buildCatalogSelect(
              'ri-deploy-reason-delay',
              'Nguyên nhân trễ hạn',
              DEPLOYMENT_CATALOG_KEYS.REASON_DELAY,
              'Không xác định',
              state.deployReasonDelay,
              (val) => {
                state.deployReasonDelay = val;
              }
            ),
            el('div', { className: 'ri-confirm-input-wrap' }, [
              el('label', {
                className: 'ri-confirm-label',
                for: 'ri-deploy-desc-rd',
                text: 'Ghi chú nguyên nhân trễ hạn',
              }),
              descArea,
            ]),
            buildCatalogSelect(
              'ri-deploy-reason-hifpt',
              'Nguyên nhân chưa cài đặt HiFPT',
              DEPLOYMENT_CATALOG_KEYS.REASON_HIFPT,
              'Không chọn',
              state.deployReasonHiFPT,
              (val) => {
                state.deployReasonHiFPT = val;
              }
            ),
            buildCatalogSelect(
              'ri-deploy-reason-wifi',
              'Nguyên nhân không hoàn tất từ wifi',
              DEPLOYMENT_CATALOG_KEYS.NOT_COMPLETE_WIFI,
              'Không chọn',
              state.deployNotCompleteWifi,
              (val) => {
                state.deployNotCompleteWifi = val;
              }
            ),
            buildCatalogSelect(
              'ri-deploy-reason-lan',
              'Nguyên nhân không sử dụng Cáp Lan cho Box',
              DEPLOYMENT_CATALOG_KEYS.REASON_UNUSE_CAP_LAN,
              'Không chọn',
              state.deployReasonUnuseCapLan,
              (val) => {
                state.deployReasonUnuseCapLan = val;
              }
            ),
            el('div', { className: 'ri-result-actions' }, [
              el('button', {
                type: 'button',
                className: 'ri-secondary-btn',
                disabled: isBusy,
                text:
                  state.deployBusyAction === 'save_construction'
                    ? 'Đang lưu…'
                    : 'Lưu thông tin thi công',
                onClick: handleDeploySaveConstruction,
              }),
              buildArmedConfirmRow({
                armKey: 'complete',
                idleLabel: 'Xác nhận hoàn tất phiếu',
                idleClass: 'ri-primary-btn',
                confirmLabel: 'Xác nhận hoàn tất ngay',
                busyKey: 'complete',
                onConfirm: handleDeployComplete,
              }),
            ])
          );
        } else if (state.deployTab === 'extras') {
          sheetParts.push(
            el('div', { className: 'ri-confirm-input-wrap' }, [
              el('div', { className: 'ri-inline-head' }, [
                el('span', { className: 'ri-confirm-label', text: 'Số điện thoại User' }),
                el('button', {
                  type: 'button',
                  className: 'ri-text-btn',
                  text: 'Tải lại',
                  onClick: () => loadDeployExtrasForModal({ forceReload: true }),
                }),
              ]),
            ])
          );

          if (state.deployPhonesLoading) {
            sheetParts.push(
              el('div', { className: 'ri-sheet-status is-loading' }, [
                el('span', { className: 'ri-spinner' }),
                el('span', { text: 'Đang tải danh sách SĐT User…' }),
              ])
            );
          } else if (state.deployPhonesError) {
            sheetParts.push(
              el('div', { className: 'ri-sheet-status', 'data-tone': 'error' }, [
                el('div', { text: state.deployPhonesError }),
              ])
            );
          } else if (state.deployPhones.length === 0) {
            sheetParts.push(
              el('div', { className: 'ri-sheet-status' }, [
                el('div', { text: 'Không có số điện thoại User trên hợp đồng.' }),
              ])
            );
          } else {
            const allEContractsSigned =
              state.deployEContracts.length > 0 &&
              state.deployEContracts.every(
                (rec) =>
                  /signed/i.test(String(rec && rec.State ? rec.State : '')) &&
                  !/pending/i.test(String(rec && rec.State ? rec.State : ''))
              );

            sheetParts.push(
              el(
                'div',
                { className: 'ri-session-list' },
                state.deployPhones.map((item) => {
                  const revealed = item.PhoneToken ? state.deployRevealedPhones[item.PhoneToken] : '';
                  const isRevealing = item.PhoneToken && state.deployRevealingToken === item.PhoneToken;
                  const canEditCmr = canEditDeploymentCameraPhone(item, summary);
                  const isEditingCmr = canEditCmr && state.deployEditingPhoneToken === item.PhoneToken;

                  const phoneActions = [];
                  if (revealed) {
                    phoneActions.push(
                      el('button', {
                        type: 'button',
                        className: 'ri-secondary-btn',
                        text: 'Sao chép SĐT',
                        onClick: async () => {
                          await copyTextSafe(revealed);
                          state.deployNotice = `Đã sao chép ${revealed} vào bộ nhớ tạm.`;
                          state.deployNoticeTone = 'ok';
                          renderConfirm();
                        },
                      })
                    );
                  } else if (item.PhoneToken) {
                    phoneActions.push(
                      el('button', {
                        type: 'button',
                        className: 'ri-primary-btn',
                        disabled: Boolean(state.deployRevealingToken),
                        text: isRevealing ? 'Đang hiện…' : 'Hiện SĐT đầy đủ',
                        onClick: () => handleDeployRevealPhone(item),
                      })
                    );
                  }

                  if (canEditCmr && !isEditingCmr) {
                    phoneActions.push(
                      el('button', {
                        type: 'button',
                        className: 'ri-secondary-btn',
                        disabled: isBusy,
                        text: 'Sửa SĐT CMR',
                        onClick: () => {
                          state.deployEditingPhoneToken = item.PhoneToken;
                          state.deployEditingPhoneValue = revealed || '';
                          state.deployArmedAction = '';
                          state.deployNotice = '';
                          renderConfirm();
                        },
                      })
                    );
                  }

                  let editCmrWrap = null;
                  if (isEditingCmr) {
                    const cmrInput = el('input', {
                      type: 'tel',
                      inputmode: 'numeric',
                      className: 'ri-confirm-input',
                      id: 'ri-deploy-cmr-phone',
                      placeholder: 'Nhập SĐT CMR mới (chỉ gồm chữ số)…',
                      autocomplete: 'off',
                      value: state.deployEditingPhoneValue || '',
                    });
                    cmrInput.value = state.deployEditingPhoneValue || '';
                    cmrInput.addEventListener('input', (e) => {
                      state.deployEditingPhoneValue = e.target.value;
                    });

                    editCmrWrap = el('div', { className: 'ri-confirm-input-wrap' }, [
                      el('label', {
                        className: 'ri-confirm-label',
                        for: 'ri-deploy-cmr-phone',
                        text: 'Số điện thoại CMR mới',
                      }),
                      cmrInput,
                      allEContractsSigned
                        ? el('div', {
                            className: 'ri-field-hint',
                            'data-state': 'warn',
                            text: 'Tất cả BBĐT đã ký — FOX-ERP vẫn mở sửa SĐT CMR khi HĐ bình thường; nếu máy chủ khóa sẽ báo chi tiết.',
                          })
                        : null,
                      el('div', { className: 'ri-result-actions' }, [
                        el('button', {
                          type: 'button',
                          className: 'ri-secondary-btn',
                          disabled: isBusy,
                          text: 'Hủy',
                          onClick: () => {
                            state.deployEditingPhoneToken = '';
                            state.deployEditingPhoneValue = '';
                            state.deployArmedAction = '';
                            renderConfirm();
                          },
                        }),
                        buildArmedConfirmRow({
                          armKey: `edit_cmr_phone:${item.PhoneToken}`,
                          idleLabel: 'Lưu SĐT CMR',
                          idleClass: 'ri-primary-btn',
                          confirmLabel: 'Xác nhận đổi SĐT CMR',
                          busyKey: 'edit_cmr_phone',
                          onConfirm: () => handleDeployUpdateCameraPhone(item),
                        }),
                      ]),
                    ]);
                  }

                  return el('div', { className: 'ri-session-card' }, [
                    el('div', {
                      className: 'ri-session-ip',
                      text: `${item.DescriptionVn || 'Số điện thoại'}: ${revealed || item.Phone || '—'}`,
                    }),
                    el('div', { className: 'ri-session-actions' }, phoneActions),
                    editCmrWrap,
                  ]);
                })
              )
            );
          }

          sheetParts.push(
            el('div', { className: 'ri-confirm-input-wrap' }, [
              el('span', { className: 'ri-confirm-label', text: 'Biên bản điện tử' }),
            ])
          );

          if (state.deployEContractsLoading) {
            sheetParts.push(
              el('div', { className: 'ri-sheet-status is-loading' }, [
                el('span', { className: 'ri-spinner' }),
                el('span', { text: 'Đang tải danh sách Biên bản điện tử…' }),
              ])
            );
          } else if (state.deployEContractsError) {
            sheetParts.push(
              el('div', { className: 'ri-sheet-status', 'data-tone': 'error' }, [
                el('div', { text: state.deployEContractsError }),
              ])
            );
          } else if (state.deployEContracts.length === 0) {
            sheetParts.push(
              el('div', { className: 'ri-sheet-status' }, [
                el('div', { text: 'Chưa có Biên bản điện tử trên hợp đồng.' }),
              ])
            );
          } else {
            sheetParts.push(
              el(
                'div',
                { className: 'ri-history-list' },
                state.deployEContracts.map((rec) => {
                  const isPending = /pending/i.test(String(rec.State || ''));
                  return el('div', { className: 'ri-history-card' }, [
                    el('div', {
                      className: 'ri-history-macs',
                      text: `${rec.Code || 'Biên bản'} • ${rec.State || '—'}`,
                    }),
                    el('div', {
                      className: 'ri-history-meta',
                      text: [rec.Name || '', rec.CreateDate || ''].filter(Boolean).join(' • '),
                    }),
                    isPending && rec.Guid
                      ? el('div', { className: 'ri-session-actions' }, [
                          buildArmedConfirmRow({
                            armKey: `sign:${rec.Guid}`,
                            idleLabel: 'Ký BBĐT',
                            idleClass: 'ri-primary-btn',
                            confirmLabel: 'Xác nhận ký BBĐT',
                            busyKey: 'sign_econtract',
                            onConfirm: () => handleDeploySignEContract(rec),
                          }),
                        ])
                      : null,
                  ]);
                })
              )
            );
          }
        }
      }
    } else if (isRecallManage) {
      showConfirmBtn = false;
      cancelBtn.textContent = 'Đóng';

      if (state.recallLoading) {
        sheetParts.push(
          el('div', { className: 'ri-sheet-status is-loading', 'aria-live': 'polite' }, [
            el('span', { className: 'ri-spinner' }),
            el('span', { text: 'Đang đọc danh sách vật tư thu hồi…' }),
          ])
        );
      } else if (state.recallError) {
        sheetParts.push(
          el('div', { className: 'ri-sheet-status', 'data-tone': 'error', 'aria-live': 'polite' }, [
            el('div', { text: state.recallError }),
            el('div', { className: 'ri-result-actions' }, [
              el('button', {
                type: 'button',
                className: 'ri-secondary-btn',
                text: 'Thử lại',
                onClick: () => loadRecallModal(contractId),
              }),
            ]),
          ])
        );
      } else if (state.recallStatus === 'on_search_page') {
        if (state.recallNotice) {
          sheetParts.push(
            el('div', {
              className: 'ri-sheet-status',
              'data-tone': state.recallNoticeTone || 'info',
            }, [el('div', { text: state.recallNotice })])
          );
        }
        sheetParts.push(
          el('div', { className: 'ri-sheet-status', 'data-tone': 'warn' }, [
            el('div', {
              text: contractId
                ? `Bạn đang ở trang chủ Thu hồi vật tư. Bấm nút bên dưới để tự động điền và tìm phiếu cho HĐ ${contractId}.`
                : 'Bạn đang ở trang chủ Thu hồi vật tư. Hãy nhập Mã hợp đồng ở màn hình chính rồi bấm tìm ngay trên trang.',
            }),
            el('div', { className: 'ri-result-actions' }, [
              el('button', {
                type: 'button',
                className: 'ri-primary-btn',
                disabled: !contractId,
                text: contractId ? `Tìm ${contractId} ngay trên trang` : 'Chưa nhập Mã hợp đồng',
                onClick: () => {
                  const sRes = triggerRecallSearchOnPage(pageDocument, contractId);
                  if (!sRes.ok) {
                    state.recallNotice = sRes.error;
                    state.recallNoticeTone = 'error';
                    renderConfirm();
                    return;
                  }
                  addLog('Vật tư', 'Tìm phiếu thu hồi', contractId, 'ok');
                  state.recallNotice = `Đã gửi lệnh tìm HĐ ${contractId}. Nếu trình duyệt mở tab chi tiết mới, mở Remote Inside tại tab đó.`;
                  state.recallNoticeTone = 'ok';
                  renderConfirm();
                },
              }),
              el('button', {
                type: 'button',
                className: 'ri-secondary-btn',
                text: 'Làm mới',
                onClick: () => loadRecallModal(contractId),
              }),
            ]),
          ])
        );
      } else if (state.recallStatus !== 'ok' || !state.recallSnapshot) {
        if (state.recallNotice) {
          sheetParts.push(
            el('div', {
              className: 'ri-sheet-status',
              'data-tone': state.recallNoticeTone || 'info',
            }, [el('div', { text: state.recallNotice })])
          );
        }
        sheetParts.push(
          el('div', { className: 'ri-sheet-status', 'data-tone': 'warn' }, [
            el('div', {
              text: contractId
                ? `Trang hiện tại chưa phải chi tiết phiếu thu hồi NextGen. Bấm nút bên dưới để mở NextGen và tự tìm HĐ ${contractId}.`
                : 'Trang hiện tại chưa phải chi tiết phiếu thu hồi NextGen. Bấm nút bên dưới để mở trang Thu hồi vật tư.',
            }),
            el('div', { className: 'ri-result-actions' }, [
              el('button', {
                type: 'button',
                className: 'ri-primary-btn',
                text: contractId ? `Mở trang Thu hồi & tự tìm ${contractId}` : 'Mở trang Thu hồi NextGen',
                onClick: () => openRecallPortalWithContract(contractId),
              }),
              el('button', {
                type: 'button',
                className: 'ri-secondary-btn',
                text: 'Làm mới',
                onClick: () => loadRecallModal(contractId),
              }),
            ]),
          ])
        );
      } else {
        const snap = state.recallSnapshot;
        const isDemo = state.recallMode === 'demo';
        const tickets = Array.isArray(snap.tickets) ? snap.tickets : [];
        const items = Array.isArray(snap.items) ? snap.items : [];
        const stats = snap.stats || {
          totalItems: items.length,
          importedCount: 0,
          editableCount: 0,
        };

        if (state.recallContractMismatch && snap.contract && contractId) {
          sheetParts.push(
            el('div', { className: 'ri-sheet-status', 'data-tone': 'warn' }, [
              el('div', {
                text: `Trang đang mở là HĐ ${snap.contract}, khác với HĐ bạn đang nhập (${contractId}).`,
              }),
              el('div', { className: 'ri-result-actions' }, [
                el('button', {
                  type: 'button',
                  className: 'ri-secondary-btn',
                  text: `Dùng HĐ ${snap.contract}`,
                  onClick: () => {
                    state.contractInput = snap.contract;
                    setState(STORAGE_KEYS.LAST_CONTRACT, snap.contract);
                    state.recallContractMismatch = false;
                    renderMain();
                    renderConfirm();
                  },
                }),
                el('button', {
                  type: 'button',
                  className: 'ri-primary-btn',
                  text: `Tìm ${contractId} trên NextGen`,
                  onClick: () => openRecallPortalWithContract(contractId),
                }),
              ]),
            ])
          );
        }

        if (state.recallNotice) {
          sheetParts.push(
            el('div', {
              className: 'ri-sheet-status',
              'data-tone': state.recallNoticeTone || 'info',
            }, [el('div', { text: state.recallNotice })])
          );
        }

        const createControls = state.recallArmedCreate
          ? el('div', { className: 'ri-result-actions' }, [
              el('button', {
                type: 'button',
                className: 'ri-secondary-btn',
                text: 'Hủy',
                onClick: () => {
                  state.recallArmedCreate = false;
                  renderConfirm();
                },
              }),
              el('button', {
                type: 'button',
                className: 'ri-danger-btn',
                text: 'Xác nhận tạo phiếu (+)',
                onClick: () => {
                  state.recallArmedCreate = false;
                  if (isDemo) {
                    const nextNum = String(tickets.length + 1);
                    const updatedTickets = tickets.map((t) => ({ ...t, isSelected: false }));
                    const newTicket = {
                      index: updatedTickets.length,
                      ticketId: String(900001 + updatedTickets.length),
                      ticketNumber: nextNum,
                      unit: 'TIN/PNC',
                      createdAt: '23/11/2026 11:00:00',
                      createdBy: 'ktv.mau01',
                      updatedAt: '23/11/2026 11:00:00',
                      updatedBy: 'ktv.mau01',
                      constructionSpec: 'HCM-ODC-01/HO/01-01-G',
                      isSelected: true,
                    };
                    snap.tickets = [...updatedTickets, newTicket];
                    snap.activeTicket = newTicket;
                    snap.activeTicketTitle = `Phiếu số ${nextNum}`;
                    state.recallNotice = `Đã mô phỏng tạo Phiếu số ${nextNum} (bấm nút + trực tiếp, không nhảy pop-up).`;
                    state.recallNoticeTone = 'ok';
                    addLog('Vật tư', 'Tạo phiếu mới (+) [Mẫu]', snap.contract || contractId, 'ok');
                    renderConfirm();
                    return;
                  }
                  const cRes = triggerRecallCreateTicket(pageDocument);
                  if (!cRes.ok) {
                    state.recallNotice = cRes.error;
                    state.recallNoticeTone = 'error';
                    renderConfirm();
                    return;
                  }
                  addLog('Vật tư', 'Tạo phiếu thu hồi mới (+)', snap.contract || contractId, 'ok');
                  state.recallNotice = 'Đã bấm dấu (+) tạo phiếu thu hồi mới trên trang gốc.';
                  state.recallNoticeTone = 'ok';
                  renderConfirm();
                  setTimeout(() => {
                    if (state.confirmAction && state.confirmAction.id === 'manage_recall') {
                      loadRecallModal(state.contractInput);
                    }
                  }, 900);
                },
              }),
            ])
          : el('button', {
              type: 'button',
              className: 'ri-secondary-btn',
              disabled: !isDemo && !snap.canCreateTicket,
              text: '+ Tạo phiếu mới',
              onClick: () => {
                state.recallArmedCreate = true;
                renderConfirm();
              },
            });

        sheetParts.push(
          el('div', { className: 'ri-confirm-input-wrap' }, [
            el('div', { className: 'ri-recall-toolbar' }, [
              el('button', {
                type: 'button',
                className: 'ri-primary-btn',
                disabled: !isDemo && !snap.canAddEquipment,
                text: '+ Thêm thiết bị',
                onClick: () => {
                  if (isDemo) {
                    state.recallNotice = 'Đã mô phỏng mở hộp thoại Thêm thiết bị thu hồi.';
                    state.recallNoticeTone = 'ok';
                    renderConfirm();
                    return;
                  }
                  const aRes = triggerRecallAddEquipment(pageDocument);
                  if (!aRes.ok) {
                    state.recallNotice = aRes.error;
                    state.recallNoticeTone = 'error';
                    renderConfirm();
                    return;
                  }
                  addLog('Vật tư', 'Thêm thiết bị', snap.contract || contractId, 'ok');
                  collapseForRecallDialog('Thêm thiết bị thu hồi');
                },
              }),
              createControls,
              el('button', {
                type: 'button',
                className: 'ri-secondary-btn',
                text: 'Làm mới',
                onClick: () => loadRecallModal(contractId),
              }),
            ]),
          ])
        );

        if (tickets.length > 0) {
          sheetParts.push(
            el('div', { className: 'ri-confirm-input-wrap' }, [
              el('div', { className: 'ri-inline-head' }, [
                el('span', {
                  className: 'ri-confirm-label',
                  text: `Danh sách phiếu thu hồi (${tickets.length})`,
                }),
                snap.activeTicketTitle
                  ? el('span', { className: 'ri-text-btn', text: snap.activeTicketTitle })
                  : null,
              ]),
              el(
                'div',
                { className: 'ri-box-list' },
                tickets.map((t) => {
                  const subParts = [
                    t.constructionSpec ? `TSTC: ${t.constructionSpec}` : '',
                    t.createdAt ? `Tạo: ${t.createdAt}${t.createdBy ? ` (${t.createdBy})` : ''}` : '',
                    t.updatedAt ? `Cập nhật: ${t.updatedAt}${t.updatedBy ? ` (${t.updatedBy})` : ''}` : '',
                  ].filter(Boolean);
                  return el(
                    'button',
                    {
                      type: 'button',
                      className: `ri-box-item${t.isSelected ? ' is-selected' : ''}`,
                      onClick: () => {
                        if (t.isSelected) return;
                        if (isDemo) {
                          snap.tickets = tickets.map((item) => ({
                            ...item,
                            isSelected: item.index === t.index,
                          }));
                          snap.activeTicket = { ...t, isSelected: true };
                          snap.activeTicketTitle = `Phiếu số ${t.ticketNumber}`;
                          state.recallNotice = `Đã chuyển sang Phiếu số ${t.ticketNumber}.`;
                          state.recallNoticeTone = 'ok';
                          renderConfirm();
                          return;
                        }
                        const swRes = triggerRecallSelectTicket(pageDocument, t.index);
                        if (!swRes.ok) {
                          state.recallNotice = swRes.error;
                          state.recallNoticeTone = 'error';
                          renderConfirm();
                          return;
                        }
                        state.recallNotice = `Đang chuyển sang Phiếu số ${t.ticketNumber}…`;
                        state.recallNoticeTone = 'info';
                        renderConfirm();
                        setTimeout(() => {
                          if (state.confirmAction && state.confirmAction.id === 'manage_recall') {
                            loadRecallModal(state.contractInput);
                          }
                        }, 700);
                      },
                    },
                    [
                      el('div', { className: 'ri-box-item-main' }, [
                        el('div', {
                          className: 'ri-box-mac',
                          text: `Phiếu số ${t.ticketNumber}${t.unit ? ` • ${t.unit}` : ''}`,
                        }),
                        subParts.length > 0
                          ? el('div', { className: 'ri-box-sub', text: subParts.join(' • ') })
                          : null,
                      ]),
                      el('span', {
                        className: 'ri-tab-badge',
                        text: t.isSelected ? 'Đang xem' : 'Chọn',
                      }),
                    ]
                  );
                })
              ),
            ])
          );
        }

        sheetParts.push(
          el('div', { className: 'ri-confirm-input-wrap' }, [
            el('div', { className: 'ri-inline-head' }, [
              el('span', {
                className: 'ri-confirm-label',
                text: `Thiết bị thu hồi (${stats.totalItems})`,
              }),
              el('span', {
                className: 'ri-field-hint',
                text: `${stats.importedCount} đã nhập kho • ${stats.editableCount} sửa được`,
              }),
            ]),
            items.length === 0
              ? el('div', { className: 'ri-sheet-status' }, [
                  el('div', {
                    text: 'Chưa có thiết bị thu hồi nào trên phiếu này. Bấm "+ Thêm thiết bị" phía trên để thêm mới.',
                  }),
                ])
              : el(
                  'div',
                  { className: 'ri-session-list ri-recall-list' },
                  items.map((item) => {
                    const statusTone = /đã nhập kho/i.test(item.recallStatus)
                      ? 'ok'
                      : /không thành công/i.test(item.recallStatus)
                      ? 'danger'
                      : item.recallStatus
                      ? 'warn'
                      : 'neutral';

                    const metaLines = [
                      [item.deviceType, `SL: ${item.quantity || '1'}`, item.mac ? `MAC: ${item.mac}` : '']
                        .filter(Boolean)
                        .join(' • '),
                      item.accessoryStatus ? `Phụ kiện: ${item.accessoryStatus}` : '',
                      item.reason || item.deviceCondition
                        ? [item.reason, item.deviceCondition].filter(Boolean).join(' • ')
                        : '',
                      item.collector || item.collectDate
                        ? `Thu hồi: ${[item.collector, item.collectDate].filter(Boolean).join(' • ')}`
                        : '',
                    ].filter(Boolean);

                    const itemButtons = [];
                    if (item.canEdit) {
                      itemButtons.push(
                        el('button', {
                          type: 'button',
                          className: 'ri-primary-btn',
                          text: 'Sửa vật tư',
                          onClick: () => {
                            if (isDemo) {
                              state.recallNotice = `Đã mô phỏng bấm tên thiết bị "${item.name}" (#equipmentname) để mở form sửa.`;
                              state.recallNoticeTone = 'ok';
                              renderConfirm();
                              return;
                            }
                            const eRes = triggerRecallEditEquipment(pageDocument, item.rowIndex);
                            if (!eRes.ok) {
                              state.recallNotice = eRes.error;
                              state.recallNoticeTone = 'error';
                              renderConfirm();
                              return;
                            }
                            addLog('Vật tư', 'Sửa vật tư', item.name, 'ok');
                            collapseForRecallDialog(`Sửa: ${item.name}`);
                          },
                        })
                      );
                    }
                    if (item.canAddAccessory) {
                      itemButtons.push(
                        el('button', {
                          type: 'button',
                          className: 'ri-secondary-btn',
                          text: '+ TB phụ',
                          onClick: () => {
                            if (isDemo) {
                              state.recallNotice = `Đã mô phỏng bấm "+ Thêm thiết bị phụ" cho "${item.name}".`;
                              state.recallNoticeTone = 'ok';
                              renderConfirm();
                              return;
                            }
                            const subRes = triggerRecallAddAccessory(pageDocument, item.rowIndex);
                            if (!subRes.ok) {
                              state.recallNotice = subRes.error;
                              state.recallNoticeTone = 'error';
                              renderConfirm();
                              return;
                            }
                            addLog('Vật tư', 'Thêm TB phụ', item.name, 'ok');
                            collapseForRecallDialog(`Thêm TB phụ: ${item.name}`);
                          },
                        })
                      );
                    }
                    if (item.mac) {
                      itemButtons.push(
                        el('button', {
                          type: 'button',
                          className: 'ri-secondary-btn',
                          text: 'Chép MAC',
                          onClick: async () => {
                            await copyTextSafe(item.mac);
                            state.recallNotice = `Đã chép MAC ${item.mac}.`;
                            state.recallNoticeTone = 'ok';
                            renderConfirm();
                          },
                        })
                      );
                    }

                    return el(
                      'div',
                      {
                        className: `ri-session-card ri-recall-card${item.isAccessory ? ' is-accessory' : ''}`,
                      },
                      [
                        el('div', { className: 'ri-inline-head' }, [
                          el('div', {
                            className: 'ri-session-ip',
                            text: item.isAccessory ? `↳ ${item.name}` : item.name,
                          }),
                          el('div', { className: 'ri-embed-actions' }, [
                            item.isAccessory
                              ? el('span', { className: 'ri-embed-badge', text: 'TB phụ' })
                              : null,
                            el('span', {
                              className: 'ri-recall-badge',
                              'data-tone': statusTone,
                              text: item.recallStatus || 'Chưa rõ trạng thái',
                            }),
                          ]),
                        ]),
                        ...metaLines.map((line) => el('div', { className: 'ri-session-meta', text: line })),
                        itemButtons.length > 0
                          ? el('div', { className: 'ri-session-actions' }, itemButtons)
                          : el('div', {
                              className: 'ri-field-hint',
                              text: 'Đã khóa chỉnh sửa (đã nhập kho).',
                            }),
                      ]
                    );
                  })
                ),
          ])
        );

        const noteInputEl = el('input', {
          type: 'text',
          className: 'ri-confirm-input',
          id: 'ri-recall-note-input',
          placeholder: 'Thêm ghi chú mới…',
          autocomplete: 'off',
          value: state.recallNoteInput,
        });
        noteInputEl.value = state.recallNoteInput;
        noteInputEl.addEventListener('input', (e) => {
          state.recallNoteInput = e.target.value;
        });

        sheetParts.push(
          el('div', { className: 'ri-confirm-input-wrap' }, [
            el('label', {
              className: 'ri-confirm-label',
              for: 'ri-recall-note-input',
              text: 'Ghi chú phiếu thu hồi',
            }),
            el('div', { className: 'ri-recall-note-row' }, [
              noteInputEl,
              el('button', {
                type: 'button',
                className: 'ri-primary-btn',
                disabled: !isDemo && !snap.canAddNote,
                text: 'Gửi ghi chú',
                onClick: () => {
                  const text = String(state.recallNoteInput || '').trim();
                  if (!text) {
                    state.recallNotice = 'Vui lòng nhập nội dung ghi chú trước khi gửi.';
                    state.recallNoticeTone = 'error';
                    renderConfirm();
                    return;
                  }
                  if (isDemo) {
                    state.recallNoteInput = '';
                    state.recallNotice = `Đã mô phỏng gửi ghi chú: "${text}".`;
                    state.recallNoticeTone = 'ok';
                    addLog('Vật tư', 'Gửi ghi chú [Mẫu]', snap.contract || contractId, 'ok');
                    renderConfirm();
                    return;
                  }
                  const nRes = triggerRecallSubmitNote(pageDocument, text);
                  if (!nRes.ok) {
                    state.recallNotice = nRes.error;
                    state.recallNoticeTone = 'error';
                    renderConfirm();
                    return;
                  }
                  addLog('Vật tư', 'Gửi ghi chú', snap.contract || contractId, 'ok');
                  state.recallNoteInput = '';
                  state.recallNotice = 'Đã gửi ghi chú lên phiếu thu hồi.';
                  state.recallNoticeTone = 'ok';
                  renderConfirm();
                  setTimeout(() => {
                    if (state.confirmAction && state.confirmAction.id === 'manage_recall') {
                      loadRecallModal(state.contractInput);
                    }
                  }, 700);
                },
              }),
            ]),
          ])
        );
      }
    } else if (isEquipmentDebt) {
      showConfirmBtn = false;
      cancelBtn.textContent = 'Đóng';

      function buildEquipFilterPickerBlock({ showCloseBtn = false } = {}) {
        const busy = state.equipDebtFilterBusy;
        const regSel = el(
          'select',
          {
            className: 'ri-select',
            id: 'ri-debt-fixed-region',
            disabled: busy,
            'aria-label': 'Chọn Vùng cố định',
          },
          [
            el('option', {
              value: '',
              text:
                state.equipDebtRegionOpts.length > 0
                  ? '-- Chọn Vùng --'
                  : 'Chưa thấy danh sách Vùng (Mở trang Báo cáo nợ trước)',
            }),
            ...state.equipDebtRegionOpts.map((opt) => {
              const o = el('option', { value: opt, text: opt });
              if (opt === state.equipDebtDraftRegion) o.selected = true;
              return o;
            }),
          ]
        );
        regSel.value = state.equipDebtDraftRegion || '';
        regSel.addEventListener('change', async (e) => {
          const val = e.target.value;
          state.equipDebtDraftRegion = val;
          state.equipDebtDraftProvince = '';
          state.equipDebtDraftPartner = '';
          state.equipDebtProvinceOpts = [];
          state.equipDebtPartnerOpts = [];
          if (!val || !pageDocument) {
            renderConfirm();
            return;
          }
          state.equipDebtFilterBusy = true;
          renderConfirm();
          await selectEquipmentFilterOption(pageDocument, 'region', val, {
            waitNextKind: 'province',
          });
          if (!state.confirmAction || state.confirmAction.id !== 'equipment_debt') return;
          state.equipDebtProvinceOpts = readEquipmentFilterOptions(pageDocument, 'province').options;
          state.equipDebtFilterBusy = false;
          renderConfirm();
        });

        const provSel = el(
          'select',
          {
            className: 'ri-select',
            id: 'ri-debt-fixed-province',
            disabled: busy || state.equipDebtProvinceOpts.length === 0,
            'aria-label': 'Chọn Tỉnh thành cố định',
          },
          [
            el('option', {
              value: '',
              text:
                state.equipDebtProvinceOpts.length > 0
                  ? '-- Chọn Tỉnh thành --'
                  : '-- Chọn Vùng trước --',
            }),
            ...state.equipDebtProvinceOpts.map((opt) => {
              const o = el('option', { value: opt, text: opt });
              if (opt === state.equipDebtDraftProvince) o.selected = true;
              return o;
            }),
          ]
        );
        provSel.value = state.equipDebtDraftProvince || '';
        provSel.addEventListener('change', async (e) => {
          const val = e.target.value;
          state.equipDebtDraftProvince = val;
          state.equipDebtDraftPartner = '';
          state.equipDebtPartnerOpts = [];
          if (!val || !pageDocument) {
            renderConfirm();
            return;
          }
          state.equipDebtFilterBusy = true;
          renderConfirm();
          await selectEquipmentFilterOption(pageDocument, 'province', val, {
            waitNextKind: 'partner',
          });
          if (!state.confirmAction || state.confirmAction.id !== 'equipment_debt') return;
          state.equipDebtPartnerOpts = readEquipmentFilterOptions(pageDocument, 'partner').options;
          state.equipDebtFilterBusy = false;
          renderConfirm();
        });

        const partnerSel = el(
          'select',
          {
            className: 'ri-select',
            id: 'ri-debt-fixed-partner',
            disabled: busy || state.equipDebtPartnerOpts.length === 0,
            'aria-label': 'Chọn Đối tác cố định',
          },
          [
            el('option', {
              value: '',
              text:
                state.equipDebtPartnerOpts.length > 0
                  ? '-- Chọn Đối tác --'
                  : '-- Chọn Tỉnh thành trước --',
            }),
            ...state.equipDebtPartnerOpts.map((opt) => {
              const o = el('option', { value: opt, text: opt });
              if (opt === state.equipDebtDraftPartner) o.selected = true;
              return o;
            }),
          ]
        );
        partnerSel.value = state.equipDebtDraftPartner || '';
        partnerSel.addEventListener('change', async (e) => {
          const val = e.target.value;
          state.equipDebtDraftPartner = val;
          if (!val || !pageDocument) {
            renderConfirm();
            return;
          }
          state.equipDebtFilterBusy = true;
          renderConfirm();
          await selectEquipmentFilterOption(pageDocument, 'partner', val);
          if (!state.confirmAction || state.confirmAction.id !== 'equipment_debt') return;
          state.equipDebtFilterBusy = false;
          renderConfirm();
        });

        const canSave =
          !busy &&
          Boolean(state.equipDebtDraftRegion && state.equipDebtDraftProvince && state.equipDebtDraftPartner);

        const pickerActions = [
          el('button', {
            type: 'button',
            className: 'ri-primary-btn',
            disabled: !canSave,
            text: busy ? 'Đang tải lựa chọn…' : 'Lưu cố định & Xem tồn nợ',
            onClick: async () => {
              const nextFilter = {
                region: state.equipDebtDraftRegion,
                province: state.equipDebtDraftProvince,
                partner: state.equipDebtDraftPartner,
              };
              setEquipmentDebtFilter(nextFilter);
              state.equipDebtSavedFilter = nextFilter;
              state.equipDebtFilterEditOpen = false;
              state.equipDebtLoading = true;
              state.equipDebtProgress = 'Đang áp dụng bộ lọc cố định & tải dữ liệu…';
              renderConfirm();
              if (pageDocument) {
                const aRes = await applyEquipmentDebtFilterToPage(pageDocument, nextFilter, {
                  onProgress: (m) => {
                    if (state.confirmAction && state.confirmAction.id === 'equipment_debt') {
                      state.equipDebtProgress = m;
                      renderConfirm();
                    }
                  },
                });
                if (!state.confirmAction || state.confirmAction.id !== 'equipment_debt') return;
                if (aRes.ok) {
                  triggerEquipmentDebtViewList(pageDocument);
                  await waitForEquipmentReportLoad(pageDocument, { timeoutMs: 18000 });
                }
              }
              if (!state.confirmAction || state.confirmAction.id !== 'equipment_debt') return;
              loadEquipmentDebtModal({ allowAutoSetup: false });
            },
          }),
        ];

        if (getEquipmentDebtFilter()) {
          pickerActions.push(
            el('button', {
              type: 'button',
              className: 'ri-secondary-btn',
              disabled: busy,
              text: 'Về mặc định',
              onClick: () => {
                setEquipmentDebtFilter(null);
                const defFilter = getEffectiveEquipmentDebtFilter();
                state.equipDebtSavedFilter = defFilter;
                state.equipDebtDraftRegion = pickMatchingFilterOpt(
                  state.equipDebtRegionOpts,
                  defFilter.region
                );
                state.equipDebtDraftProvince = pickMatchingFilterOpt(
                  state.equipDebtProvinceOpts,
                  defFilter.province
                );
                state.equipDebtDraftPartner = pickMatchingFilterOpt(
                  state.equipDebtPartnerOpts,
                  defFilter.partner
                );
                state.equipDebtNotice = 'Đã khôi phục bộ lọc mặc định (10.Vũng Tàu • Phuong Nam VTU).';
                state.equipDebtNoticeTone = 'info';
                renderConfirm();
              },
            })
          );
        }

        if (showCloseBtn) {
          pickerActions.push(
            el('button', {
              type: 'button',
              className: 'ri-secondary-btn',
              disabled: busy,
              text: 'Ẩn bộ lọc',
              onClick: () => {
                state.equipDebtFilterEditOpen = false;
                renderConfirm();
              },
            })
          );
        }

        return el('div', { className: 'ri-sheet-status', 'data-tone': 'info' }, [
          el('div', {
            className: 'ri-debt-summary-title',
            text: 'Bộ lọc cố định (mặc định: 10.Vũng Tàu • Phuong Nam VTU)',
          }),
          el('div', { className: 'ri-debt-picker' }, [regSel, provSel, partnerSel]),
          el('div', { className: 'ri-result-actions' }, pickerActions),
        ]);
      }

      if (state.equipDebtLoading) {
        sheetParts.push(
          el('div', { className: 'ri-sheet-status is-loading', 'aria-live': 'polite' }, [
            el('span', { className: 'ri-spinner' }),
            el('span', { text: state.equipDebtProgress || 'Đang đọc bảng Tồn công nợ theo NV…' }),
          ])
        );
      } else if (state.equipDebtError) {
        sheetParts.push(
          el('div', { className: 'ri-sheet-status', 'data-tone': 'error', 'aria-live': 'polite' }, [
            el('div', { text: state.equipDebtError }),
            el('div', { className: 'ri-result-actions' }, [
              el('button', {
                type: 'button',
                className: 'ri-secondary-btn',
                text: 'Thử lại',
                onClick: () => loadEquipmentDebtModal(),
              }),
            ]),
          ])
        );
      } else if (state.equipDebtStatus === 'needs_equipment_page') {
        sheetParts.push(
          el('div', { className: 'ri-sheet-status', 'data-tone': 'warn', 'aria-live': 'polite' }, [
            el('div', {
              text:
                state.equipDebtNotice ||
                'Báo cáo tồn nợ vật tư chạy trên trang Quản lý vật tư NextGen (nextgen.fpt.net/resource/equipment/).',
            }),
            el('div', { className: 'ri-result-actions' }, [
              el('button', {
                type: 'button',
                className: 'ri-primary-btn',
                text: 'Mở Quản lý vật tư',
                onClick: () => {
                  openExternalOrPortalUrl(EQUIPMENT_ENDPOINTS.base, {
                    mode: 'portal',
                    title: 'Quản lý vật tư NextGen',
                    pageWindow,
                  });
                },
              }),
              el('button', {
                type: 'button',
                className: 'ri-secondary-btn',
                text: 'Thử lại',
                onClick: () => loadEquipmentDebtModal(),
              }),
            ]),
          ])
        );
      } else if (state.equipDebtStatus === 'needs_report_loaded') {
        if (state.equipDebtHasTab && (state.equipDebtFilterMissing || state.equipDebtFilterEditOpen)) {
          if (state.equipDebtNotice) {
            sheetParts.push(
              el('div', {
                className: 'ri-sheet-status',
                'data-tone': state.equipDebtNoticeTone || 'warn',
                'aria-live': 'polite',
              }, [el('div', { text: state.equipDebtNotice })])
            );
          }
          sheetParts.push(buildEquipFilterPickerBlock({ showCloseBtn: false }));
          sheetParts.push(
            el('div', { className: 'ri-result-actions' }, [
              el('button', {
                type: 'button',
                className: 'ri-secondary-btn',
                text: 'Đọc lại dữ liệu',
                onClick: () => loadEquipmentDebtModal({ allowAutoSetup: true }),
              }),
              el('button', {
                type: 'button',
                className: 'ri-secondary-btn',
                text: 'Thu gọn để thao tác',
                onClick: () => {
                  state.isOpen = false;
                  render();
                },
              }),
            ])
          );
        } else {
          const promptBtns = [];
          if (!state.equipDebtHasTab && state.equipDebtHasReportMenu) {
            promptBtns.push(
              el('button', {
                type: 'button',
                className: 'ri-primary-btn',
                text: 'Mở Báo cáo → Báo cáo nợ',
                onClick: async () => {
                  state.equipDebtLoading = true;
                  state.equipDebtProgress = 'Đang mở trang Báo cáo nợ…';
                  renderConfirm();
                  const mRes = await triggerEquipmentOpenDebtReportMenu(pageDocument);
                  if (!state.confirmAction || state.confirmAction.id !== 'equipment_debt') return;
                  if (!mRes.ok) {
                    state.equipDebtLoading = false;
                    state.equipDebtProgress = '';
                    state.equipDebtNotice = mRes.error;
                    state.equipDebtNoticeTone = 'error';
                    renderConfirm();
                    return;
                  }
                  await waitForEquipmentDebtTabOpen(pageDocument, { timeoutMs: 4500 });
                  if (!state.confirmAction || state.confirmAction.id !== 'equipment_debt') return;
                  loadEquipmentDebtModal({ allowAutoSetup: true });
                },
              })
            );
          } else if (state.equipDebtHasTab && !state.equipDebtTabActive) {
            promptBtns.push(
              el('button', {
                type: 'button',
                className: 'ri-primary-btn',
                text: 'Chuyển tab Tồn công nợ theo NV',
                onClick: () => {
                  const tRes = triggerEquipmentDebtTab(pageDocument);
                  if (!tRes.ok) {
                    state.equipDebtNotice = tRes.error;
                    state.equipDebtNoticeTone = 'error';
                    renderConfirm();
                    return;
                  }
                  state.equipDebtLoading = true;
                  state.equipDebtProgress = 'Đang chuyển sang tab Tồn công nợ theo NV…';
                  renderConfirm();
                  setTimeout(() => {
                    if (state.confirmAction && state.confirmAction.id === 'equipment_debt') {
                      loadEquipmentDebtModal({ allowAutoSetup: true });
                    }
                  }, 800);
                },
              })
            );
          } else if (state.equipDebtHasViewBtn) {
            promptBtns.push(
              el('button', {
                type: 'button',
                className: 'ri-primary-btn',
                text: 'Bấm "Xem danh sách" & gom dữ liệu',
                onClick: async () => {
                  const vRes = triggerEquipmentDebtViewList(pageDocument);
                  if (!vRes.ok) {
                    state.equipDebtNotice = vRes.error;
                    state.equipDebtNoticeTone = 'error';
                    renderConfirm();
                    return;
                  }
                  state.equipDebtLoading = true;
                  state.equipDebtProgress = 'Đang chờ NextGen tải bảng tồn nợ KTV…';
                  renderConfirm();
                  const ok = await waitForEquipmentReportLoad(pageDocument, { timeoutMs: 18000 });
                  if (!state.confirmAction || state.confirmAction.id !== 'equipment_debt') return;
                  if (!ok) {
                    state.equipDebtLoading = false;
                    state.equipDebtProgress = '';
                    state.equipDebtNotice =
                      'Chưa thấy bảng dữ liệu xuất hiện. Kiểm tra lại bộ lọc Vùng/Tỉnh thành/Đối tác rồi bấm Đọc lại.';
                    state.equipDebtNoticeTone = 'warn';
                    renderConfirm();
                    return;
                  }
                  loadEquipmentDebtModal({ allowAutoSetup: false });
                },
              })
            );
          }

          promptBtns.push(
            el('button', {
              type: 'button',
              className: 'ri-secondary-btn',
              text: 'Đọc lại dữ liệu',
              onClick: () => loadEquipmentDebtModal({ allowAutoSetup: true }),
            }),
            el('button', {
              type: 'button',
              className: 'ri-secondary-btn',
              text: 'Thu gọn để thao tác',
              onClick: () => {
                state.isOpen = false;
                render();
              },
            })
          );

          sheetParts.push(
            el('div', { className: 'ri-sheet-status', 'data-tone': state.equipDebtNoticeTone || 'warn', 'aria-live': 'polite' }, [
              el('div', {
                text:
                  state.equipDebtNotice ||
                  'Trên trang Quản lý vật tư, bạn bấm Báo cáo → Báo cáo nợ → Xem danh sách rồi bấm Đọc lại dữ liệu.',
              }),
              el('div', { className: 'ri-result-actions' }, promptBtns),
            ])
          );
        }
      } else if (state.equipDebtStatus === 'ok' && state.equipDebtDataset) {
        const ds = state.equipDebtDataset;
        const meta = ds.meta || {};
        const statsLabel = [
          `${ds.totalStaff} KTV`,
          `${ds.activeMaterials} VT có tồn`,
          meta.pagesScanned > 1 ? `${meta.pagesScanned} trang` : '',
        ]
          .filter(Boolean)
          .join(' • ');

        const topRightBtns = [];
        if (state.equipDebtMode === 'live') {
          topRightBtns.push(
            el('button', {
              type: 'button',
              className: 'ri-text-btn',
              text: 'Bộ lọc',
              title: state.equipDebtSavedFilter
                ? `Đang cố định: ${state.equipDebtSavedFilter.region} • ${state.equipDebtSavedFilter.partner}`
                : 'Chọn hoặc đổi bộ lọc cố định',
              onClick: () => {
                if (!state.equipDebtFilterEditOpen) {
                  syncEquipDebtDraftFromPage();
                }
                state.equipDebtFilterEditOpen = !state.equipDebtFilterEditOpen;
                renderConfirm();
              },
            })
          );
        }
        topRightBtns.push(
          el('button', {
            type: 'button',
            className: 'ri-text-btn',
            text: 'Tải lại',
            onClick: () => loadEquipmentDebtModal({ allowAutoSetup: true }),
          })
        );

        sheetParts.push(
          el('div', { className: 'ri-debt-topbar' }, [
            el('div', { className: 'ri-mode-row ri-debt-tabs', role: 'tablist' }, [
              el('button', {
                type: 'button',
                role: 'tab',
                'aria-selected': state.equipDebtViewMode === 'by_material' ? 'true' : 'false',
                className: `ri-mode-btn${state.equipDebtViewMode === 'by_material' ? ' is-active' : ''}`,
                text: 'Theo vật tư',
                onClick: () => {
                  state.equipDebtViewMode = 'by_material';
                  renderConfirm();
                },
              }),
              el('button', {
                type: 'button',
                role: 'tab',
                'aria-selected': state.equipDebtViewMode === 'by_staff' ? 'true' : 'false',
                className: `ri-mode-btn${state.equipDebtViewMode === 'by_staff' ? ' is-active' : ''}`,
                text: 'Theo KTV',
                onClick: () => {
                  state.equipDebtViewMode = 'by_staff';
                  renderConfirm();
                },
              }),
            ]),
            el('div', { className: 'ri-debt-meta-row' }, [
              el('span', { className: 'ri-field-hint', text: statsLabel }),
              el('div', { className: 'ri-embed-actions' }, topRightBtns),
            ]),
          ])
        );

        if (state.equipDebtFilterEditOpen && state.equipDebtMode === 'live') {
          sheetParts.push(buildEquipFilterPickerBlock({ showCloseBtn: true }));
        }

        if (state.equipDebtNotice) {
          sheetParts.push(
            el('div', {
              className: 'ri-sheet-status',
              'data-tone': state.equipDebtNoticeTone || 'info',
              'aria-live': 'polite',
            }, [el('div', { text: state.equipDebtNotice })])
          );
        }

        if (state.equipDebtViewMode === 'by_staff') {
          const allRows = Array.isArray(ds.rows) ? ds.rows : [];
          const activeRows = allRows.filter((r) => Object.keys(r.stocks || {}).length > 0);
          const staffSource = activeRows.length > 0 ? activeRows : allRows;

          const staffSel = el(
            'select',
            { className: 'ri-select', id: 'ri-debt-staff-select', 'aria-label': 'Chọn KTV cần xem tồn vật tư' },
            staffSource.map((r) => {
              const itemCount = Object.keys(r.stocks || {}).length;
              const o = el('option', {
                value: r.staff,
                text: `${r.staff} (${itemCount} VT)`,
              });
              if (r.staff === state.equipDebtSelectedStaff) o.selected = true;
              return o;
            })
          );
          staffSel.value = state.equipDebtSelectedStaff;

          const staffResultsSlot = el('div', { 'data-ri-slot': 'debt-staff-results', 'aria-live': 'polite' });

          function renderDebtStaffSlot() {
            staffResultsSlot.textContent = '';
            const staffRes = queryEquipmentDebtByStaff(ds, state.equipDebtSelectedStaff);
            if (!staffRes.staff) {
              staffResultsSlot.appendChild(
                el('div', { className: 'ri-sheet-status' }, [
                  el('div', { text: 'Không có KTV nào đang giữ vật tư tồn.' }),
                ])
              );
              return;
            }
            staffResultsSlot.appendChild(
              el('div', { className: 'ri-debt-summary-bar' }, [
                el('div', { className: 'ri-debt-summary-info' }, [
                  el('div', { className: 'ri-debt-summary-title', text: staffRes.staff }),
                  el('div', {
                    className: 'ri-debt-summary-metric',
                    text: `${staffRes.itemCount} loại VT • Tổng SL: ${staffRes.totalQty}`,
                  }),
                ]),
              ])
            );
            if (staffRes.items.length === 0) {
              staffResultsSlot.appendChild(
                el('div', { className: 'ri-sheet-status' }, [
                  el('div', { text: 'KTV này hiện không còn tồn vật tư nào (> 0).' }),
                ])
              );
              return;
            }
            staffResultsSlot.appendChild(
              el(
                'div',
                { className: 'ri-debt-list' },
                staffRes.items.map((it, idx) =>
                  el(
                    'button',
                    {
                      type: 'button',
                      className: 'ri-debt-row',
                      title: 'Chạm để xem các KTV khác cùng giữ vật tư này',
                      'aria-label': `${it.name} (${it.group}), số lượng ${it.qty}`,
                      onClick: () => {
                        state.equipDebtViewMode = 'by_material';
                        state.equipDebtGroup = '';
                        state.equipDebtSearch = '';
                        state.equipDebtSelectedKey = it.key;
                        renderConfirm();
                      },
                    },
                    [
                      el('span', { className: 'ri-debt-rank', text: String(idx + 1) }),
                      el('div', { className: 'ri-debt-row-main' }, [
                        el('div', { className: 'ri-debt-name', text: it.name }),
                        el('div', { className: 'ri-debt-sub', text: it.group }),
                      ]),
                      el('span', { className: 'ri-debt-qty', text: String(it.qty) }),
                    ]
                  )
                )
              )
            );
          }

          staffSel.addEventListener('change', (e) => {
            state.equipDebtSelectedStaff = e.target.value;
            renderDebtStaffSlot();
          });

          sheetParts.push(
            el('div', { className: 'ri-confirm-input-wrap' }, [staffSel]),
            staffResultsSlot
          );
          renderDebtStaffSlot();
        } else {
          const groups = Array.isArray(ds.groups) ? ds.groups : [];
          const materials = Array.isArray(ds.materials) ? ds.materials : [];

          const groupSel = el('select', { className: 'ri-select', id: 'ri-debt-group', 'aria-label': 'Lọc theo nhóm vật tư' }, [
            el('option', { value: '', text: `Tất cả nhóm (${ds.totalMaterials} VT)` }),
            ...groups.map((g) => {
              const o = el('option', {
                value: g.name,
                text: `${g.name} (${g.activeMaterialCount}/${g.materialCount})`,
              });
              if (g.name === state.equipDebtGroup) o.selected = true;
              return o;
            }),
          ]);
          groupSel.value = state.equipDebtGroup;

          const nonZeroToggleBtn = el('button', {
            type: 'button',
            className: `ri-mode-btn ri-debt-chip${state.equipDebtOnlyNonZero ? ' is-active' : ''}`,
            'aria-pressed': state.equipDebtOnlyNonZero ? 'true' : 'false',
            text: state.equipDebtOnlyNonZero ? 'Chỉ có tồn' : 'Cả tồn = 0',
          });

          const matSearchInput = el('input', {
            type: 'text',
            className: 'ri-confirm-input',
            id: 'ri-debt-mat-search',
            'aria-label': 'Tìm nhanh vật tư',
            placeholder: 'Tìm vật tư (VD: AX3000, Box, Cap)…',
            autocomplete: 'off',
            spellcheck: 'false',
            value: state.equipDebtSearch,
          });
          matSearchInput.value = state.equipDebtSearch;

          const matCountSpan = el('span', { className: 'ri-debt-match-count' });
          const matSel = el('select', { className: 'ri-select', id: 'ri-debt-material', 'aria-label': 'Chọn vật tư cần xem KTV đang giữ' });
          const resultsSlot = el('div', { 'data-ri-slot': 'debt-results', 'aria-live': 'polite' });

          function populateDebtMaterials() {
            const q = String(state.equipDebtSearch || '').trim().toLowerCase();
            const filtered = materials.filter((m) => {
              if (state.equipDebtGroup && m.group !== state.equipDebtGroup) return false;
              if (state.equipDebtOnlyNonZero && !(m.holderCount > 0)) return false;
              if (
                q &&
                !m.name.toLowerCase().includes(q) &&
                !String(m.group || '').toLowerCase().includes(q)
              ) {
                return false;
              }
              return true;
            });

            matCountSpan.textContent = `${filtered.length} VT`;
            matSel.textContent = '';
            if (filtered.length === 0) {
              matSel.appendChild(el('option', { value: '', text: '-- Không có vật tư khớp lọc --' }));
              state.equipDebtSelectedKey = '';
              return;
            }

            let matched = filtered.some((m) => m.key === state.equipDebtSelectedKey);
            if (!matched) {
              state.equipDebtSelectedKey = filtered[0].key;
              matched = true;
            }
            for (const m of filtered) {
              const suffix =
                m.holderCount > 0 ? ` (${m.holderCount} KTV • ${m.totalQty})` : ' (0)';
              const o = el('option', { value: m.key, text: `${m.name}${suffix}` });
              if (m.key === state.equipDebtSelectedKey) o.selected = true;
              matSel.appendChild(o);
            }
            matSel.value = state.equipDebtSelectedKey;
          }

          function renderDebtResultsSlot() {
            resultsSlot.textContent = '';
            if (!state.equipDebtSelectedKey) {
              resultsSlot.appendChild(
                el('div', { className: 'ri-sheet-status' }, [
                  el('div', { text: 'Không có vật tư phù hợp bộ lọc hiện tại.' }),
                ])
              );
              return;
            }

            const qRes = queryEquipmentDebtHolders(ds, state.equipDebtSelectedKey, {
              sortBy: state.equipDebtSort,
            });
            const mat = qRes.material;
            if (!mat) return;

            const sortBtn = el('button', {
              type: 'button',
              className: 'ri-debt-pill-btn',
              'aria-pressed': state.equipDebtSort === 'name_asc' ? 'true' : 'false',
              text: state.equipDebtSort === 'qty_desc' ? '↓ Nhiều nhất' : 'A–Z',
              title: 'Đổi thứ tự sắp xếp',
              onClick: () => {
                state.equipDebtSort =
                  state.equipDebtSort === 'qty_desc' ? 'name_asc' : 'qty_desc';
                renderDebtResultsSlot();
              },
            });

            const copyBtn = el('button', {
              type: 'button',
              className: 'ri-debt-pill-btn is-accent',
              disabled: qRes.holders.length === 0,
              text: 'Chép',
              title: `Chép danh sách ${qRes.holderCount} KTV`,
              onClick: async () => {
                const text = formatEquipmentDebtClipboardText(qRes);
                if (!text) return;
                await copyTextSafe(text);
                state.equipDebtNotice = `Đã chép "${mat.name}" (${qRes.holderCount} KTV).`;
                state.equipDebtNoticeTone = 'ok';
                renderConfirm();
              },
            });

            resultsSlot.appendChild(
              el('div', { className: 'ri-debt-summary-bar' }, [
                el('div', { className: 'ri-debt-summary-info' }, [
                  el('div', { className: 'ri-debt-summary-title', text: mat.name }),
                  el('div', {
                    className: 'ri-debt-summary-metric',
                    text: `${mat.group || 'Khác'} • Tổng: ${qRes.totalQty} • ${qRes.holderCount} KTV`,
                  }),
                ]),
                el('div', { className: 'ri-debt-summary-actions' }, [sortBtn, copyBtn]),
              ])
            );

            if (qRes.holders.length === 0) {
              resultsSlot.appendChild(
                el('div', { className: 'ri-sheet-status' }, [
                  el('div', { text: 'Không có KTV nào đang tồn vật tư này.' }),
                ])
              );
              return;
            }

            resultsSlot.appendChild(
              el(
                'div',
                { className: 'ri-debt-list' },
                qRes.holders.map((h, idx) =>
                  el(
                    'button',
                    {
                      type: 'button',
                      className: 'ri-debt-row',
                      title: 'Chạm để xem toàn bộ vật tư KTV này đang giữ',
                      'aria-label': `KTV ${h.staff}, đang giữ ${h.qty} — chạm để xem chi tiết`,
                      onClick: () => {
                        state.equipDebtSelectedStaff = h.staff;
                        state.equipDebtViewMode = 'by_staff';
                        renderConfirm();
                      },
                    },
                    [
                      el('span', { className: 'ri-debt-rank', text: String(idx + 1) }),
                      el('span', { className: 'ri-debt-name', text: h.staff }),
                      el('span', { className: 'ri-debt-qty', text: String(h.qty) }),
                    ]
                  )
                )
              )
            );
          }

          groupSel.addEventListener('change', (e) => {
            state.equipDebtGroup = e.target.value;
            populateDebtMaterials();
            renderDebtResultsSlot();
          });

          nonZeroToggleBtn.addEventListener('click', () => {
            state.equipDebtOnlyNonZero = !state.equipDebtOnlyNonZero;
            nonZeroToggleBtn.className = `ri-mode-btn ri-debt-chip${state.equipDebtOnlyNonZero ? ' is-active' : ''}`;
            nonZeroToggleBtn.setAttribute('aria-pressed', state.equipDebtOnlyNonZero ? 'true' : 'false');
            nonZeroToggleBtn.textContent = state.equipDebtOnlyNonZero
              ? 'Chỉ có tồn'
              : 'Cả tồn = 0';
            populateDebtMaterials();
            renderDebtResultsSlot();
          });

          matSearchInput.addEventListener('input', (e) => {
            state.equipDebtSearch = e.target.value;
            populateDebtMaterials();
            renderDebtResultsSlot();
          });

          matSel.addEventListener('change', (e) => {
            state.equipDebtSelectedKey = e.target.value;
            renderDebtResultsSlot();
          });

          populateDebtMaterials();
          renderDebtResultsSlot();

          sheetParts.push(
            el('div', { className: 'ri-debt-picker' }, [
              el('div', { className: 'ri-debt-filter-row' }, [groupSel, nonZeroToggleBtn]),
              el('div', { className: 'ri-debt-search-row' }, [matSearchInput, matCountSpan]),
              matSel,
            ]),
            resultsSlot
          );
        }
      }
    } else if (isPortRelease) {
      confirmBtn.textContent = 'Xác nhận Thu hồi Port';

      if (state.portModalLoading) {
        sheetParts.push(
          el('div', { className: 'ri-sheet-status is-loading' }, [
            el('span', { className: 'ri-spinner' }),
            el('span', { text: `Đang tải thông tin Port FTTH NEW của ${contractId}…` }),
          ])
        );
        confirmBtn.disabled = true;
      } else if (state.portModalError) {
        const errActions = [
          el('button', {
            type: 'button',
            className: 'ri-secondary-btn',
            text: 'Thử tải lại',
            onClick: () => loadPortReleaseModal(contractId),
          }),
        ];
        if (state.portModalLoginUrl && /hết hạn|iam|đăng nhập|chưa được kích hoạt/i.test(state.portModalError)) {
          errActions.push(createPortModalAuthButton(state.portModalLoginUrl));
        }
        sheetParts.push(
          el('div', { className: 'ri-sheet-status', 'data-tone': 'error' }, [
            el('div', { text: state.portModalError }),
            el('div', { className: 'ri-result-actions' }, errActions),
          ])
        );
        confirmBtn.disabled = true;
      } else if (state.portRecordMode !== 'existing' || !state.portDetail || !state.portDetail.id) {
        sheetParts.push(
          el('div', { className: 'ri-sheet-status', 'data-tone': 'warn' }, [
            el('div', {
              text: `Hợp đồng ${contractId} hiện chưa có bản ghi Port trên FTTH NEW (không thể thu hồi).`,
            }),
            el('div', { className: 'ri-result-actions' }, [
              el('button', {
                type: 'button',
                className: 'ri-secondary-btn',
                text: 'Kiểm tra lại',
                onClick: () => loadPortReleaseModal(contractId),
              }),
            ]),
          ])
        );
        confirmBtn.disabled = true;
      } else {
        const d = state.portDetail;
        const infoRows = [];
        if (d.customer) infoRows.push(`Khách hàng: ${d.customer}`);
        if (d.address) infoRows.push(`Địa chỉ: ${d.address}`);
        if (d.tstc) infoRows.push(`Tập điểm / Port: ${d.tstc}`);
        if (d.pc) infoRows.push(`Thông số kết nối: ${d.pc}`);
        if (d.createBy || d.createDate) {
          infoRows.push(`Cấp Port: ${[d.createBy, d.createDate].filter(Boolean).join(' • ')}`);
        }
        if (d.updateBy || d.updateDate) {
          infoRows.push(`Cập nhật cuối: ${[d.updateBy, d.updateDate].filter(Boolean).join(' • ')}`);
        }

        sheetParts.push(
          el('div', { className: 'ri-modem-info' }, [
            el('div', { className: 'ri-inline-head' }, [
              el('span', { className: 'ri-confirm-label', text: 'Thông tin FTTH NEW hiện tại' }),
              el('button', {
                type: 'button',
                className: 'ri-text-btn',
                text: 'Tải lại',
                onClick: () => loadPortReleaseModal(contractId),
              }),
            ]),
            el('div', {
              className: 'ri-modem-mac',
              text: d.statusLabel || `Trạng thái: ${d.status || '—'}`,
            }),
            ...infoRows.map((line) => el('div', { className: 'ri-box-sub', text: line })),
          ])
        );

        if (d.status === '6') {
          sheetParts.push(
            el('div', { className: 'ri-sheet-status', 'data-tone': 'warn' }, [
              el('div', {
                text: 'Hợp đồng này hiện đã ở trạng thái "Đã thu hồi port". Bạn vẫn có thể bấm xác nhận nếu cần cập nhật lại ghi chú.',
              }),
            ])
          );
        }

        const descEl = el('textarea', {
          className: 'ri-textarea',
          id: 'ri-port-release-desc',
          placeholder: 'Nhập ghi chú thu hồi (nếu có)…',
        });
        descEl.value = state.portDescription || '';
        descEl.addEventListener('input', (e) => {
          state.portDescription = e.target.value;
        });

        sheetParts.push(
          el('div', { className: 'ri-confirm-input-wrap' }, [
            el('label', {
              className: 'ri-confirm-label',
              for: 'ri-port-release-desc',
              text: 'Ghi chú (tùy chọn)',
            }),
            descEl,
          ])
        );

        confirmBtn.disabled = false;
        confirmBtn.addEventListener('click', () =>
          runConfirmedAction(act, {
            detail: state.portDetail,
            statusPort: d.releaseStatusPortValue || '2',
            cardNumber: d.cardNumber || '',
            description: state.portDescription,
          })
        );
      }
    } else if (isPortAssign) {
      confirmBtn.textContent =
        state.portRecordMode === 'existing' ? 'Xác nhận Đổi Port' : 'Xác nhận Cấp Port';

      if (state.portModalLoading) {
        sheetParts.push(
          el('div', { className: 'ri-sheet-status is-loading' }, [
            el('span', { className: 'ri-spinner' }),
            el('span', { text: `Đang tải thông tin hợp đồng & vùng miền cho ${contractId}…` }),
          ])
        );
        confirmBtn.disabled = true;
      } else if (state.portModalError) {
        const errActions = [
          el('button', {
            type: 'button',
            className: 'ri-secondary-btn',
            text: 'Thử tải lại',
            onClick: () => loadPortAssignModal(contractId),
          }),
        ];
        if (state.portModalLoginUrl && /hết hạn|iam|đăng nhập|chưa được kích hoạt/i.test(state.portModalError)) {
          errActions.push(createPortModalAuthButton(state.portModalLoginUrl));
        }
        sheetParts.push(
          el('div', { className: 'ri-sheet-status', 'data-tone': 'error' }, [
            el('div', { text: state.portModalError }),
            el('div', { className: 'ri-result-actions' }, errActions),
          ])
        );
        confirmBtn.disabled = true;
      } else {
        const d = state.portDetail || {};
        const typeOpts =
          Array.isArray(d.typeContractOptions) && d.typeContractOptions.length > 0
            ? d.typeContractOptions
            : [
                { value: '3', label: 'FTTH_New' },
                { value: '5', label: 'FTTH_NEW LeaseLine' },
              ];
        const typeSelect = el(
          'select',
          { className: 'ri-select', id: 'ri-port-type' },
          typeOpts.map((opt) => {
            const o = el('option', { value: opt.value, text: opt.label });
            if (opt.value === state.portTypeContract) o.selected = true;
            return o;
          })
        );
        typeSelect.value = state.portTypeContract;
        typeSelect.addEventListener('change', (e) => {
          const nextType = e.target.value;
          if (state.portRecordMode === 'existing') {
            state.portTypeContract = nextType;
          } else {
            loadPortAssignModal(contractId, nextType);
          }
        });

        sheetParts.push(
          el('div', { className: 'ri-confirm-input-wrap' }, [
            el('div', { className: 'ri-inline-head' }, [
              el('label', { className: 'ri-confirm-label', for: 'ri-port-type', text: 'Loại hợp đồng' }),
              el('button', {
                type: 'button',
                className: 'ri-text-btn',
                text: 'Tải lại HĐ',
                onClick: () => loadPortAssignModal(contractId),
              }),
            ]),
            typeSelect,
          ])
        );

        if (state.portRecordMode === 'not_found') {
          sheetParts.push(
            el('div', { className: 'ri-sheet-status', 'data-tone': 'warn' }, [
              el('div', {
                text:
                  state.portDetailWarn ||
                  `Không tìm thấy ${contractId} ở Loại HĐ hiện tại. Hãy thử đổi sang FTTH_NEW LeaseLine hoặc kiểm tra lại Mã HĐ.`,
              }),
            ])
          );
          confirmBtn.disabled = true;
        } else {
          const summaryTitle =
            state.portRecordMode === 'existing'
              ? `Đổi / Cấp lại Port (ID ${d.id}) • ${d.customer || contractId}`
              : `Cấp Port mới • ${d.customer || contractId}`;
          const summarySub = [d.address, d.tstc ? `Hiện tại: ${d.tstc}` : '', d.statusLabel]
            .filter(Boolean)
            .join(' • ');
          sheetParts.push(
            el('div', { className: 'ri-olt-detected' }, [
              el('div', { className: 'ri-olt-detected-title', text: summaryTitle }),
              summarySub ? el('div', { className: 'ri-olt-detected-sub', text: summarySub }) : null,
            ])
          );

          if (state.portLocations.length > 0) {
            const locSelect = el(
              'select',
              { className: 'ri-select', id: 'ri-port-location' },
              state.portLocations.map((loc) => {
                const o = el('option', { value: loc.value, text: loc.label });
                if (loc.value === state.portLocationId) o.selected = true;
                return o;
              })
            );
            locSelect.value = state.portLocationId;
            locSelect.addEventListener('change', (e) => loadPortBranchesForModal(e.target.value));
            sheetParts.push(
              el('div', { className: 'ri-confirm-input-wrap' }, [
                el('label', { className: 'ri-confirm-label', for: 'ri-port-location', text: 'Vùng miền' }),
                locSelect,
              ])
            );
          }

          if (state.portBranches.length > 0) {
            const branchSelect = el(
              'select',
              { className: 'ri-select', id: 'ri-port-branch' },
              state.portBranches.map((br) => {
                const o = el('option', { value: br.value, text: br.label });
                if (br.value === state.portBranchId) o.selected = true;
                return o;
              })
            );
            branchSelect.value = state.portBranchId;
            branchSelect.addEventListener('change', (e) =>
              loadPortPopsForModal(state.portLocationId, e.target.value)
            );
            sheetParts.push(
              el('div', { className: 'ri-confirm-input-wrap' }, [
                el('label', { className: 'ri-confirm-label', for: 'ri-port-branch', text: 'Chi nhánh' }),
                branchSelect,
              ])
            );
          }

          const popCountSpan = el('span', { className: 'ri-text-btn' });
          const popSearchInput = el('input', {
            type: 'text',
            className: 'ri-confirm-input',
            id: 'ri-port-pop-search',
            placeholder: 'Lọc nhanh POP (ví dụ: POP01…)',
            autocomplete: 'off',
            spellcheck: 'false',
            value: state.portPopSearch,
          });
          popSearchInput.value = state.portPopSearch;
          const popSelect = el('select', { className: 'ri-select', id: 'ri-port-pop' });

          function populatePopSelect(qText) {
            const q = String(qText || '').trim().toLowerCase();
            const filtered = q
              ? state.portPops.filter((p) => p.label.toLowerCase().includes(q))
              : state.portPops;
            popCountSpan.textContent = q
              ? `${filtered.length}/${state.portPops.length} POP`
              : `${state.portPops.length} POP`;
            popSelect.textContent = '';
            popSelect.appendChild(
              el('option', {
                value: '',
                text:
                  filtered.length > 0
                    ? `-- Chọn POP (${filtered.length}) --`
                    : state.portCascadeLoading
                    ? 'Đang tải POP…'
                    : '-- Không có POP khớp --',
              })
            );
            let hasSel = false;
            for (const item of filtered) {
              const o = el('option', { value: item.value, text: item.label });
              if (item.value === state.portPopId) {
                o.selected = true;
                hasSel = true;
              }
              popSelect.appendChild(o);
            }
            popSelect.value = hasSel ? state.portPopId : '';
          }
          populatePopSelect(state.portPopSearch);
          popSearchInput.addEventListener('input', (e) => {
            state.portPopSearch = e.target.value;
            populatePopSelect(state.portPopSearch);
          });
          popSelect.addEventListener('change', (e) => loadPortConboxesForModal(e.target.value));

          sheetParts.push(
            el('div', { className: 'ri-confirm-input-wrap' }, [
              el('div', { className: 'ri-inline-head' }, [
                el('label', { className: 'ri-confirm-label', for: 'ri-port-pop-search', text: 'POP' }),
                popCountSpan,
              ]),
              popSearchInput,
            ]),
            el('div', { className: 'ri-confirm-input-wrap' }, [popSelect])
          );

          const conboxCountSpan = el('span', { className: 'ri-text-btn' });
          const conboxSearchInput = el('input', {
            type: 'text',
            className: 'ri-confirm-input',
            id: 'ri-port-conbox-search',
            placeholder: 'Lọc nhanh Hộp đấu nối / Tập điểm…',
            autocomplete: 'off',
            spellcheck: 'false',
            value: state.portConboxSearch,
          });
          conboxSearchInput.value = state.portConboxSearch;
          const conboxSelect = el('select', { className: 'ri-select', id: 'ri-port-conbox' });

          function populateConboxSelect(qText) {
            const q = String(qText || '').trim().toLowerCase();
            const filtered = q
              ? state.portConboxes.filter((c) => c.label.toLowerCase().includes(q))
              : state.portConboxes;
            conboxCountSpan.textContent = q
              ? `${filtered.length}/${state.portConboxes.length} Hộp`
              : `${state.portConboxes.length} Hộp`;
            conboxSelect.textContent = '';
            conboxSelect.appendChild(
              el('option', {
                value: '',
                text: !state.portPopId
                  ? '-- Chọn POP trước --'
                  : state.portCascadeLoading
                  ? 'Đang tải Hộp đấu nối…'
                  : filtered.length > 0
                  ? `-- Chọn Hộp đấu nối (${filtered.length}) --`
                  : '-- Không có Hộp đấu nối khớp --',
              })
            );
            let hasSel = false;
            for (const item of filtered) {
              const o = el('option', { value: item.value, text: item.label });
              if (item.value === state.portConboxId) {
                o.selected = true;
                hasSel = true;
              }
              conboxSelect.appendChild(o);
            }
            conboxSelect.value = hasSel ? state.portConboxId : '';
          }
          populateConboxSelect(state.portConboxSearch);
          conboxSearchInput.addEventListener('input', (e) => {
            state.portConboxSearch = e.target.value;
            populateConboxSelect(state.portConboxSearch);
          });
          conboxSelect.addEventListener('change', (e) => loadPortSlotsForModal(e.target.value));

          sheetParts.push(
            el('div', { className: 'ri-confirm-input-wrap' }, [
              el('div', { className: 'ri-inline-head' }, [
                el('label', {
                  className: 'ri-confirm-label',
                  for: 'ri-port-conbox-search',
                  text: 'Hộp đấu nối (Tập điểm)',
                }),
                conboxCountSpan,
              ]),
              conboxSearchInput,
            ]),
            el('div', { className: 'ri-confirm-input-wrap' }, [conboxSelect])
          );

          const slotTools = [];
          if (state.portConboxId) {
            slotTools.push(
              el('button', {
                type: 'button',
                className: 'ri-text-btn',
                text: state.portHistoryOpen ? 'Ẩn lịch sử Port' : 'Xem lịch sử Port',
                onClick: () => {
                  if (state.portHistoryOpen) {
                    state.portHistoryOpen = false;
                    renderConfirm();
                  } else {
                    loadPortHistoryForModal();
                  }
                },
              })
            );
          }

          if (state.portSlotsLoading) {
            sheetParts.push(
              el('div', { className: 'ri-sheet-status is-loading' }, [
                el('span', { className: 'ri-spinner' }),
                el('span', { text: 'Đang tải các Port trong Hộp đấu nối…' }),
              ])
            );
          } else if (state.portConboxId) {
            if (state.portSlots.length === 0) {
              sheetParts.push(
                el('div', { className: 'ri-sheet-status', 'data-tone': 'warn' }, [
                  el('div', { text: 'Hộp đấu nối này chưa có Port khả dụng.' }),
                ])
              );
            } else {
              const slotGrid = el(
                'div',
                { className: 'ri-port-grid' },
                state.portSlots.map((slot) => {
                  const selected = state.portSelectedPortId === slot.portID;
                  const btn = el('button', {
                    type: 'button',
                    className: `ri-port-chip${selected ? ' is-selected' : ''}${
                      slot.disabled ? ' is-busy' : ''
                    }`,
                    disabled: Boolean(slot.disabled),
                    'aria-pressed': selected ? 'true' : 'false',
                    text: slot.disabled ? `${slot.port} (Bận)` : slot.port,
                    onClick: () => {
                      if (slot.disabled) return;
                      state.portSelectedPortId = slot.portID;
                      state.portSelectedPortLabel = slot.port;
                      renderConfirm();
                    },
                  });
                  return btn;
                })
              );

              sheetParts.push(
                el('div', { className: 'ri-confirm-input-wrap' }, [
                  el('div', { className: 'ri-inline-head' }, [
                    el('span', {
                      className: 'ri-confirm-label',
                      text: state.portSelectedPortLabel
                        ? `Port đã chọn: ${state.portSelectedPortLabel}`
                        : 'Chọn 1 Port còn trống',
                    }),
                    el('div', { className: 'ri-embed-toolbar-btns' }, slotTools),
                  ]),
                  slotGrid,
                ])
              );
            }
          }

          if (state.portHistoryOpen) {
            if (state.portHistoryLoading) {
              sheetParts.push(
                el('div', { className: 'ri-sheet-status is-loading' }, [
                  el('span', { className: 'ri-spinner' }),
                  el('span', { text: 'Đang tải Lịch sử Port tập điểm…' }),
                ])
              );
            } else if (state.portHistoryError) {
              sheetParts.push(
                el('div', { className: 'ri-sheet-status', 'data-tone': 'error' }, [
                  el('div', { text: state.portHistoryError }),
                ])
              );
            } else if (state.portHistoryRows.length === 0) {
              sheetParts.push(
                el('div', { className: 'ri-sheet-status' }, [
                  el('div', { text: 'Chưa có lịch sử thao tác Port cho hộp/port này.' }),
                ])
              );
            } else {
              sheetParts.push(
                el(
                  'div',
                  { className: 'ri-history-list' },
                  state.portHistoryRows.map((row) =>
                    el('div', { className: 'ri-history-card' }, [
                      el('div', {
                        className: 'ri-history-macs',
                        text: [row.port, row.action].filter(Boolean).join(' • ') || 'Lịch sử Port',
                      }),
                      row.contractName || row.createBy || row.actionDate
                        ? el('div', {
                            className: 'ri-history-meta',
                            text: [row.contractName, row.createBy, row.actionDate]
                              .filter(Boolean)
                              .join(' • '),
                          })
                        : null,
                      row.data ? el('div', { className: 'ri-history-meta', text: row.data }) : null,
                    ])
                  )
                )
              );
            }
          }

          const cardInput = el('input', {
            type: 'text',
            className: 'ri-confirm-input',
            id: 'ri-port-card',
            placeholder: 'Số thẻ (mặc định 1)',
            autocomplete: 'off',
            value: state.portCardNumber,
          });
          cardInput.value = state.portCardNumber;
          cardInput.addEventListener('input', (e) => {
            state.portCardNumber = e.target.value;
          });

          const descEl = el('textarea', {
            className: 'ri-textarea',
            id: 'ri-port-desc',
            placeholder: 'Ghi chú (nếu có)…',
          });
          descEl.value = state.portDescription || '';
          descEl.addEventListener('input', (e) => {
            state.portDescription = e.target.value;
          });

          sheetParts.push(
            el('div', { className: 'ri-confirm-input-wrap' }, [
              el('label', { className: 'ri-confirm-label', for: 'ri-port-card', text: 'Số thẻ' }),
              cardInput,
            ]),
            el('div', { className: 'ri-confirm-input-wrap' }, [
              el('label', { className: 'ri-confirm-label', for: 'ri-port-desc', text: 'Ghi chú' }),
              descEl,
            ])
          );

          confirmBtn.disabled =
            !state.portSelectedPortId ||
            !state.portConboxId ||
            !state.portLocationId ||
            !state.portBranchId;

          confirmBtn.addEventListener('click', () => {
            const conboxObj = state.portConboxes.find((c) => c.value === state.portConboxId) || {};
            runConfirmedAction(act, {
              recordMode: state.portRecordMode,
              detail: state.portDetail,
              typeContract: state.portTypeContract,
              cardNumber: state.portCardNumber,
              description: state.portDescription,
              location: state.portLocationId,
              branch: state.portBranchId,
              deviceName: conboxObj.label || '',
              portID: state.portSelectedPortId,
              port: state.portSelectedPortLabel,
              statusPort: d.reassignStatusPortValue || '3',
            });
          });
        }
      }
    } else {
      confirmBtn.addEventListener('click', () =>
        runConfirmedAction(act, { newMac: state.confirmNewMac })
      );
    }

    const sheetButtons = [cancelBtn];
    if (showConfirmBtn) {
      sheetButtons.push(confirmBtn);
    }
    sheetParts.push(el('div', { className: 'ri-sheet-buttons' }, sheetButtons));

    return el('div', {
      className: 'ri-sheet-backdrop',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'ri-sheet-title',
    }, [
      el('div', { className: 'ri-sheet' }, sheetParts),
    ]);
  }

  function renderScannerSheet() {
    if (!state.scannerOpen) return null;

    const formCount = state.domSnapshot ? state.domSnapshot.forms.length : 0;
    const controlCount = state.domSnapshot ? state.domSnapshot.actionControls.length : 0;
    const reqCount = state.recordedEntries.length;
    const hasData = Boolean(state.domSnapshot) || reqCount > 0 || Boolean(state.deepScan);

    const scannerActionBtns = [
      el('button', {
        type: 'button',
        className: 'ri-secondary-btn',
        text: '1. Chụp nhanh giao diện trang hiện tại',
        onClick: handleTakeDomSnapshot,
      }),
      el('button', {
        type: 'button',
        className: 'ri-primary-btn',
        disabled: state.isDeepScanning,
        text: state.isDeepScanning
          ? 'Đang quét sâu trang hiện tại…'
          : '1b. Quét sâu trang đang mở (mã JS + mục chọn)',
        onClick: handleCurrentPageDeepScan,
      }),
      el('button', {
        type: 'button',
        className: state.isRecording ? 'ri-danger-btn' : 'ri-primary-btn',
        text: state.isRecording
          ? `Dừng ghi thao tác (${reqCount})`
          : '2. Bật ghi thao tác mạng',
        onClick: handleToggleRecording,
      }),
    ];
    if (state.activePortalId === 'inside') {
      scannerActionBtns.push(
        el('button', {
          type: 'button',
          className: 'ri-secondary-btn',
          disabled: state.isDeepScanning,
          text: state.isDeepScanning
            ? 'Đang quét 7 trang phụ…'
            : '3. Quét nhanh API 5 mục phụ + Reset MAC / Kill Session',
          onClick: handleDeepScan,
        }),
        el('button', {
          type: 'button',
          className: 'ri-primary-btn',
          disabled: state.isDeepScanning,
          text: state.isDeepScanning
            ? 'Đang đọc mã Kill Session & Radius…'
            : '4. Quét mã Kill Session (IP) & Thông số kết nối (OLT tự động)',
          onClick: handleOpsSignatureScan,
        })
      );
    } else if (state.activePortalId === 'port') {
      scannerActionBtns.push(
        el('button', {
          type: 'button',
          className: 'ri-primary-btn',
          disabled: state.isDeepScanning,
          text: state.isDeepScanning
            ? 'Đang quét chi tiết mã FTTH NEW…'
            : '3. Quét chi tiết mã FTTH NEW (Tìm kiếm / Cấp port / Thu hồi port)',
          onClick: handlePortDeepScan,
        })
      );
    }

    const scannerSubText =
      state.activePortalId === 'port'
        ? 'Bấm nút 3 bên dưới ngay trên tab port.fpt.net đang mở (hoặc tab Inside khi đã đăng nhập Port) — không cần F5 — để lấy đủ mã lệnh Tìm kiếm, Cấp port, Thu hồi port và Lịch sử port.'
        : 'Dùng công cụ này khi bạn đang mở trang gốc (ví dụ inside.fpt.net) để lấy đúng các nút và lệnh bên dưới về ghép chạy thật.';

    return el('div', { className: 'ri-sheet-backdrop', role: 'dialog', 'aria-modal': 'true' }, [
      el('div', { className: 'ri-sheet' }, [
        el('div', { className: 'ri-log-head' }, [
          el('h2', { className: 'ri-sheet-title', text: 'Quét cấu trúc trang' }),
          el('button', {
            type: 'button',
            className: 'ri-icon-btn',
            text: 'Đóng',
            onClick: () => {
              state.scannerOpen = false;
              renderScanner();
            },
          }),
        ]),
        el('p', {
          className: 'ri-sheet-sub',
          text: scannerSubText,
        }),
        el('div', { className: 'ri-privacy-note' }, [
          el('div', {
            text: 'Bảo vệ thông tin: Công cụ tự động bỏ qua mật khẩu, cookie, mã OTP và thông tin cá nhân khách hàng ([REDACTED]) trước khi tạo báo cáo.',
          }),
        ]),
        el('div', { className: 'ri-result-actions' }, scannerActionBtns),
        el('div', { className: 'ri-scan-stats' }, [
          el('div', {}, [el('strong', { text: String(formCount) }), el('span', { text: 'Form quét được' })]),
          el('div', {}, [el('strong', { text: String(controlCount) }), el('span', { text: 'Nút bấm' })]),
          el('div', {}, [el('strong', { text: String(reqCount) }), el('span', { text: 'Thao tác mạng' })]),
        ]),
        state.copyNotice
          ? el('p', { className: 'ri-result-hint', text: state.copyNotice })
          : null,
        hasData
          ? el('div', { className: 'ri-sheet-buttons' }, [
              el('button', {
                type: 'button',
                className: 'ri-primary-btn',
                text: 'Sao chép báo cáo gửi AI',
                onClick: handleCopyScanReport,
              }),
              el('button', {
                type: 'button',
                className: 'ri-secondary-btn',
                text: 'Tải file JSON',
                onClick: handleDownloadScanReport,
              }),
            ])
          : null,
      ]),
    ]);
  }

  function renderAndroidAppMenuSheet() {
    const versionStr =
      typeof __REMOTE_INSIDE_VERSION__ !== 'undefined' ? __REMOTE_INSIDE_VERSION__ : '0.10.0';
    const closeMenu = () => {
      state.appMenuOpen = false;
      renderScanner();
    };
    const openLogin = (url, title) => {
      state.appMenuOpen = false;
      renderScanner();
      openExternalOrPortalUrl(url, { mode: 'login', title, pageWindow });
    };

    return el('div', { className: 'ri-sheet-backdrop', role: 'dialog', 'aria-modal': 'true' }, [
      el('div', { className: 'ri-sheet' }, [
        el('div', { className: 'ri-log-head' }, [
          el('h2', { className: 'ri-sheet-title', text: 'Tiện ích Remote Inside App' }),
          el('button', {
            type: 'button',
            className: 'ri-icon-btn',
            text: 'Đóng',
            onClick: closeMenu,
          }),
        ]),
        el('p', {
          className: 'ri-sheet-sub',
          text: `Phiên bản v${versionStr} — Chỉ cần đăng nhập IAM (Azure AD) 1 lần trên điện thoại.`,
        }),
        el('div', { className: 'ri-privacy-note' }, [
          el('div', {
            text: 'Ứng dụng không lưu mật khẩu hay token. Chỉ cần đăng nhập IAM (Azure AD) 1 lần — ứng dụng tự đồng bộ phiên cho Inside, FOX-ERP/Partner, Port, Vật tư và Radius.',
          }),
        ]),
        el('div', { className: 'ri-result-actions' }, [
          el('button', {
            type: 'button',
            className: 'ri-primary-btn',
            text: 'Đăng nhập IAM (1 lần cho tất cả)',
            onClick: () =>
              openLogin(getUnifiedIamLoginUrl(), 'Đăng nhập IAM (Azure AD)'),
          }),
          el('button', {
            type: 'button',
            className: 'ri-secondary-btn',
            disabled: state.iamSyncing,
            text: state.iamSyncing ? 'Đang đồng bộ…' : 'Đồng bộ lại phiên tất cả cổng IAM',
            onClick: () => {
              state.appMenuOpen = false;
              renderScanner();
              runUnifiedIamSync({ force: true, announceResult: true });
            },
          }),
          el('button', {
            type: 'button',
            className: 'ri-primary-btn',
            text: 'Đăng nhập Vật tư (NextGen)',
            onClick: () => openLogin(EQUIPMENT_ENDPOINTS.base, 'Đăng nhập Vật tư (NextGen)'),
          }),
          el('button', {
            type: 'button',
            className: 'ri-secondary-btn',
            text: 'Kiểm tra / Tải bản mới (.apk)',
            onClick: () => {
              if (
                typeof window !== 'undefined' &&
                window.RemoteInsideNative &&
                typeof window.RemoteInsideNative.openExternalBrowser === 'function'
              ) {
                window.RemoteInsideNative.openExternalBrowser(
                  'https://github.com/lenamtest4-dot/remote-inside/releases'
                );
              }
            },
          }),
          el('button', {
            type: 'button',
            className: 'ri-danger-btn',
            text: 'Đăng xuất (Xóa cookie phiên)',
            onClick: () => {
              clearWarmSessionCache();
              if (
                typeof window !== 'undefined' &&
                window.RemoteInsideNative &&
                typeof window.RemoteInsideNative.clearSessionCookies === 'function'
              ) {
                window.RemoteInsideNative.clearSessionCookies();
              }
              state.appMenuOpen = false;
              state.result = {
                status: 'ok',
                title: 'Đã xóa cookie phiên đăng nhập',
                message:
                  'Cookie phiên IAM/Port trên ứng dụng đã được làm sạch. Khi cần thao tác lại, hãy mở đăng nhập IAM mới.',
              };
              renderScanner();
              renderMain();
              refreshSessionStatus();
            },
          }),
        ]),
        el('details', { className: 'ri-confirm-input-wrap' }, [
          el('summary', {
            className: 'ri-summary-toggle',
            text: 'Mở trang cổng riêng lẻ (khi cần)',
          }),
          el('div', { className: 'ri-result-actions' }, [
            el('button', {
              type: 'button',
              className: 'ri-secondary-btn',
              text: 'Inside',
              onClick: () => openLogin(PORTALS.inside.url, 'Đăng nhập Inside'),
            }),
            el('button', {
              type: 'button',
              className: 'ri-secondary-btn',
              text: 'Port',
              onClick: () => openLogin(PORTALS.port.url, 'Đăng nhập Port'),
            }),
            el('button', {
              type: 'button',
              className: 'ri-secondary-btn',
              text: 'Vật tư',
              onClick: () => openLogin(PORTALS.recall.url, 'Mở cổng Vật tư'),
            }),
            el('button', {
              type: 'button',
              className: 'ri-secondary-btn',
              text: 'FOX-ERP / Partner',
              onClick: () =>
                openLogin(DEPLOYMENT_ENDPOINTS.partnerMonitor, 'Đăng nhập FOX-ERP / Partner'),
            }),
            el('button', {
              type: 'button',
              className: 'ri-secondary-btn',
              text: 'Camera (Sắp ghép)',
              onClick: () => openLogin(PORTALS.camera.url, 'Đăng nhập Camera'),
            }),
            el('button', {
              type: 'button',
              className: 'ri-secondary-btn',
              text: 'Radius (Sắp ghép)',
              onClick: () => openLogin(PORTALS.radius.url, 'Mở cổng Radius'),
            }),
          ]),
        ]),
        el('div', { className: 'ri-sheet-buttons' }, [
          el('button', {
            type: 'button',
            className: 'ri-secondary-btn',
            text: 'Đóng',
            onClick: closeMenu,
          }),
        ]),
      ]),
    ]);
  }

  function renderMain() {
    mainLayer.textContent = '';

    if (!state.isOpen && !standalone) {
      const fabLabel = state.isRecording
        ? `Đang ghi mẫu (${state.recordedEntries.length}) — Bấm để dừng`
        : state.recallReturnPending
        ? 'Xong — Quay lại Phiếu thu hồi'
        : fabLabelDefault;

      const fabClasses = [
        'ri-fab',
        state.isRecording ? 'is-recording' : '',
        state.recallReturnPending ? 'is-return' : '',
        fabPosition === 'bottom-left' ? 'is-left' : '',
      ]
        .filter(Boolean)
        .join(' ');

      const fab = el(
        'button',
        {
          type: 'button',
          className: fabClasses,
          onClick: () => {
            if (state.isRecording) {
              handleToggleRecording();
            } else {
              openConsole();
            }
          },
        },
        [el('span', { className: 'ri-fab-dot' }), el('span', { text: fabLabel })]
      );
      mainLayer.appendChild(fab);
      return;
    }

    const main = el('main', { className: 'ri-main' }, [
      renderContractDock(),
      renderTabs(),
      renderActionDeck(),
      renderResultPanel(),
      renderActivityLog(),
    ]);

    const shell = el(
      'div',
      { className: `ri-shell${state.isWide ? ' is-wide' : ''}` },
      [renderTopBar(), main]
    );

    const frame = el(
      'div',
      { className: standalone ? 'ri-standalone-wrap' : 'ri-overlay' },
      [shell]
    );

    if (!standalone) {
      frame.addEventListener('click', (e) => {
        if (e.target === frame) {
          closeConsole();
        }
      });
    }

    mainLayer.appendChild(frame);
  }

  function renderConfirm() {
    if (!state.confirmAction || (!state.isOpen && !standalone)) {
      if (confirmLayer.childNodes.length > 0) {
        confirmLayer.textContent = '';
      }
      return;
    }

    const act = state.confirmAction;
    const portal = PORTALS[state.activePortalId];
    const contractId = normalizeContractId(state.contractInput);
    const isInsideOlt = portal.id === 'inside' && act.id === 'clear_osp';

    if (isInsideOlt) {
      const modalKey = `inside:clear_osp:${contractId}`;
      const { connCardEl, connStateKey } = buildClearOltConnCard(contractId);
      const formParts = buildClearOltFormParts(act, contractId);

      const existingSheet = confirmLayer.querySelector('.ri-sheet');
      if (existingSheet && existingSheet.dataset.riModalKey === modalKey) {
        const connSlot = existingSheet.querySelector('[data-ri-slot="olt-conn"]');
        const formSlot = existingSheet.querySelector('[data-ri-slot="olt-form"]');
        if (connSlot && formSlot) {
          if (connSlot.dataset.connStateKey !== connStateKey) {
            connSlot.dataset.connStateKey = connStateKey;
            connSlot.textContent = '';
            if (connCardEl) connSlot.appendChild(connCardEl);
          }
          formSlot.textContent = '';
          for (const node of formParts) {
            if (node) formSlot.appendChild(node);
          }
          return;
        }
      }

      const headerParts = [
        el('h2', {
          className: 'ri-sheet-title',
          text: `Xác nhận ${act.label}?`,
        }),
        el('p', {
          className: 'ri-sheet-sub',
          text: act.confirmNote || `Thao tác sẽ được gửi lên ${portal.fullName}.`,
        }),
        contractId
          ? el('div', { className: 'ri-confirm-contract' }, [
              el('span', { text: 'Hợp đồng tham chiếu (không bắt buộc)' }),
              el('span', { className: 'ri-confirm-code', text: contractId }),
            ])
          : el('div', {
              className: 'ri-confirm-meta',
              text: 'Chưa nhập Mã hợp đồng — chọn trực tiếp POP OLT & Port bên dưới (nếu nhập Mã HĐ sẽ hiện thêm Thông số kết nối tại đây).',
            }),
      ];

      const connSlot = el('div', {
        'data-ri-slot': 'olt-conn',
        'data-conn-state-key': connStateKey,
      });
      if (connCardEl) connSlot.appendChild(connCardEl);

      const formSlot = el('div', { 'data-ri-slot': 'olt-form' }, formParts);

      const sheetEl = el(
        'div',
        { className: 'ri-sheet', 'data-ri-modal-key': modalKey },
        [...headerParts, connSlot, formSlot]
      );

      confirmLayer.textContent = '';
      confirmLayer.appendChild(
        el('div', { className: 'ri-sheet-backdrop', role: 'dialog', 'aria-modal': 'true' }, [
          sheetEl,
        ])
      );
      return;
    }

    const prevSheet = confirmLayer.querySelector('.ri-sheet');
    const prevScroll = prevSheet ? prevSheet.scrollTop : 0;
    const confirmSheet = renderConfirmSheet();
    confirmLayer.textContent = '';
    if (confirmSheet) {
      confirmLayer.appendChild(confirmSheet);
      const nextSheet = confirmLayer.querySelector('.ri-sheet');
      if (nextSheet && prevScroll > 0) {
        nextSheet.scrollTop = prevScroll;
      }
    }
  }

  function renderScanner() {
    if (
      (!state.scannerOpen && !state.appMenuOpen) ||
      (!state.isOpen && !standalone)
    ) {
      if (scannerLayer.childNodes.length > 0) {
        scannerLayer.textContent = '';
      }
      return;
    }
    const scannerSheet =
      state.appMenuOpen && isAndroidAppEnv()
        ? renderAndroidAppMenuSheet()
        : renderScannerSheet();
    scannerLayer.textContent = '';
    if (scannerSheet) {
      scannerLayer.appendChild(scannerSheet);
    }
  }

  function render() {
    renderMain();
    renderConfirm();
    renderScanner();
  }

  render();
  if (pageDocument && typeof pageDocument.addEventListener === 'function') {
    pageDocument.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Escape') return;
      if (state.confirmAction) {
        resetConfirmState();
        render();
      } else if (state.appMenuOpen) {
        state.appMenuOpen = false;
        renderScanner();
      } else if (state.scannerOpen) {
        state.scannerOpen = false;
        renderScanner();
      }
    });
  }
  if (standalone) {
    refreshSessionStatus();
  } else if (isUserscriptEnv() && pageWindow && pageDocument) {
    const loc = pageWindow.location;
    if (isRecallPortalLocation(loc) && !isRecallTicketLocation(loc)) {
      const pendingRecallContract = consumePendingRecallContract();
      if (pendingRecallContract) {
        state.contractInput = pendingRecallContract;
        setState(STORAGE_KEYS.LAST_CONTRACT, pendingRecallContract);
        let recallSearchAttempts = 0;
        const recallSearchTimer = setInterval(() => {
          recallSearchAttempts += 1;
          const ctrls = findRecallSearchControls(pageDocument);
          if (ctrls.input) {
            clearInterval(recallSearchTimer);
            const sRes = triggerRecallSearchOnPage(pageDocument, pendingRecallContract);
            if (sRes.ok) {
              addLog('Vật tư', 'Tự tìm phiếu thu hồi', pendingRecallContract, 'ok');
            }
          } else if (recallSearchAttempts >= 20) {
            clearInterval(recallSearchTimer);
          }
        }, 400);
      }
    }
  }

  if (typeof window !== 'undefined' && isAndroidAppEnv()) {
    window.__riOnPortalBrowserClosed = (completedHost = '', loginCompleted = false) => {
      clearWarmSessionCache();
      const cleanHost = String(completedHost || '').trim().toLowerCase();
      if (loginCompleted && canWarmPortalSession() && cleanHost !== 'fli-mngt.fcam.vn') {
        runUnifiedIamSync({ skipHost: cleanHost, announceResult: true });
        return;
      }
      refreshSessionStatus();
    };
    window.__riHandleBack = () => {
      if (state.confirmAction) {
        resetConfirmState();
        renderConfirm();
        return true;
      }
      if (state.appMenuOpen) {
        state.appMenuOpen = false;
        renderScanner();
        return true;
      }
      if (state.scannerOpen) {
        state.scannerOpen = false;
        renderScanner();
        return true;
      }
      return false;
    };
  }

  return {
    open: openConsole,
    close: closeConsole,
    refreshSessionStatus,
  };
}
