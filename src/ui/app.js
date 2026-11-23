/**
 * Giao dien dieu khien Remote Inside (1 man hinh toi uu Android & MacBook).
 * Toan bo chuoi tu nguoi dung deu duoc gan bang textContent de dam bao an toan.
 */

import {
  PORTALS,
  PORTAL_ORDER,
  normalizeContractId,
  validateContractId,
} from '../config/portals.js';
import {
  STORAGE_KEYS,
  addRecentContract,
  clearRecentContracts,
  getRecentContracts,
  getState,
  setState,
} from '../core/storage.js';
import {
  checkPortalSession,
  detectIamRedirect,
  isUserscriptEnv,
  requestPortal,
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
  scanPageStructure,
} from '../core/inspector.js';
import {
  fetchInsideBoxMacLogs,
  fetchInsideBoxMacs,
  fetchInsideModemInfo,
  fetchInsideOltInit,
  fetchInsideOltListByLocation,
  fetchInsideOnlineSessions,
  findMatchingOltOption,
  getCachedInsideContract,
  getInsideOltHint,
  isExtendedPortOlt,
  isSameOltDetectedInfo,
  runInsideAction,
  setInsideOltHint,
  validateBoxNewMac,
} from '../adapters/inside.js';
import { executePortalAction } from '../adapters/portals.js';

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
    scannerOpen: false,
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

  function syncSessionPillOrRenderMain() {
    const pillEl = mainLayer.querySelector('.ri-status-pill');
    if (pillEl) {
      pillEl.setAttribute('data-state', state.sessionStatus.state);
      pillEl.title = state.sessionStatus.detail || 'Bấm để kiểm tra lại phiên IAM';
      const labelSpan = pillEl.querySelector('span:last-child');
      if (labelSpan) {
        labelSpan.textContent = state.sessionStatus.label;
      }
      return;
    }
    renderMain();
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
    const checked = await checkPortalSession(portal);
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
          objId: String(objId || '1162622263'),
          oltPop: 'BRUP00101GC16',
          slot: '0',
          port: '5',
          onu: '79',
          ipOlt: '11.72.121.17',
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
      state.oltError = err && err.message ? err.message : 'Lỗi tải danh sách POP OLT.';
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
    const isKillSession = portal.id === 'inside' && action.id === 'kill_session';
    const logActionLabel = action.label;
    let logTarget = contractId;
    if (isClearOsp && actionCtx.oltName) {
      const baseOlt = portSummary ? `${actionCtx.oltName} (P:${portSummary})` : actionCtx.oltName;
      logTarget = contractId ? `${contractId} • ${baseOlt}` : baseOlt;
    } else if (isKillSession && actionCtx.ipAddress) {
      logTarget = contractId ? `${contractId} • ${actionCtx.ipAddress}` : actionCtx.ipAddress;
    }

    try {
      const res = await executePortalAction(portal.id, action.id, contractId, actionCtx);
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
          label: 'Cần đăng nhập IAM',
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
    if (pageWindow && pageWindow.open) {
      pageWindow.open(portal.url, '_blank', 'noopener');
    }
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

      async function fetchAndAnalyzePortPage(key, rawUrl) {
        const reqParts = parseOriginPath(rawUrl);
        if (reqParts.origin && reqParts.pathname) {
          fetchedPageKeys.add(`${reqParts.origin.toLowerCase()}${reqParts.pathname}`);
        }

        const res = await requestPortal({
          url: rawUrl,
          method: 'GET',
          headers: { Accept: 'text/html, */*' },
          timeout: 15000,
        });

        const finalParts = parseOriginPath((res && res.finalUrl) || rawUrl);
        if (finalParts.origin && finalParts.pathname) {
          fetchedPageKeys.add(`${finalParts.origin.toLowerCase()}${finalParts.pathname}`);
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

        const safeBaseUrl =
          finalParts.origin && finalParts.pathname
            ? `${finalParts.origin}${finalParts.pathname}`
            : rawUrl;
        const hints = extractApiHintsFromHtml(res.responseText, safeBaseUrl, contractId);
        const navMeta = extractFramesAndLinksFromHtml(res.responseText, safeBaseUrl, contractId);
        const sigs = extractAjaxSignaturesFromHtml(res.responseText, safeBaseUrl, contractId);
        const controlsMeta = extractFormControlsMeta(res.responseText, contractId);
        const inlineScripts = extractInlineScriptsSanitized(res.responseText, contractId, {
          maxPerScript: 8000,
          maxTotal: 20000,
        }).slice(0, 5);
        const nextChunkUrls = extractNextAppChunkUrls(res.responseText, safeBaseUrl);

        return {
          summary: {
            key,
            requestedOrigin: reqParts.origin,
            requestedPath: reqParts.pathname,
            finalOrigin: finalParts.origin,
            finalPath: finalParts.pathname,
            title: navMeta.title,
            status: res.status,
            iamExpired: iam.expired,
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

      const pages = [];
      const phase1Results = await Promise.all([
        fetchAndAnalyzePortPage('entry_port', 'http://port.fpt.net/'),
        fetchAndAnalyzePortPage('entry_mvcport', 'http://mvcport.fpt.net/'),
      ]);

      const discoveredFrames = [];
      const discoveredLinks = [];
      for (const item of phase1Results) {
        pages.push(item.summary);
        discoveredFrames.push(...item.frames);
        discoveredLinks.push(...item.links);
      }

      const frameTargets = [];
      for (const f of discoveredFrames) {
        if (!isPortHost(f.origin) || !f.pathname) continue;
        const key = `${f.origin.toLowerCase()}${f.pathname}`;
        if (fetchedPageKeys.has(key) || frameTargets.some((t) => t.canonKey === key)) {
          continue;
        }
        frameTargets.push({
          canonKey: key,
          url: `${f.origin}${f.pathname}`,
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
        const canonKey = `${link.origin.toLowerCase()}${link.pathname}`;
        if (fetchedPageKeys.has(canonKey) || seenCandidateLinks.has(canonKey)) continue;
        seenCandidateLinks.add(canonKey);
        const url = `${link.origin}${link.pathname}`;
        const entry = { url, canonKey };
        if (PORT_LINK_PRIORITY_RE.test(`${link.text || ''} ${link.pathname}`)) {
          priorityLinks.push(entry);
        } else {
          normalLinks.push(entry);
        }
      }

      const pageTargets = [...priorityLinks, ...normalLinks].slice(0, 12);
      for (let i = 0; i < pageTargets.length; i += 6) {
        const chunk = pageTargets.slice(i, i + 6);
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
          const sKey = `${sp.origin.toLowerCase()}${sp.pathname}`;
          if (seenScripts.has(sKey)) continue;
          seenScripts.add(sKey);
          scriptCandidates.push(`${sp.origin}${sp.pathname}`);
          if (scriptCandidates.length >= 12) break;
        }
        if (scriptCandidates.length >= 12) break;
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
        scanKind: 'port_deep_v1',
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
    state.isOpen = true;
    render();
    refreshSessionStatus();
  }

  function closeConsole() {
    state.isOpen = false;
    resetConfirmState();
    state.scannerOpen = false;
    render();
  }

  function renderTopBar() {
    const pill = el(
      'button',
      {
        type: 'button',
        className: 'ri-status-pill',
        'data-state': state.sessionStatus.state,
        title: state.sessionStatus.detail || 'Bấm để kiểm tra lại phiên IAM',
        onClick: () => refreshSessionStatus(),
      },
      [
        el('span', { className: 'ri-status-dot' }),
        el('span', { text: state.sessionStatus.label }),
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

    const scanBtn = el('button', {
      type: 'button',
      className: 'ri-icon-btn',
      text: 'Quét cấu trúc',
      onClick: () => {
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
    const tabEls = PORTAL_ORDER.map((id) => {
      const p = PORTALS[id];
      const active = state.activePortalId === id;
      return el(
        'button',
        {
          type: 'button',
          role: 'tab',
          'aria-selected': active ? 'true' : 'false',
          className: `ri-tab${active ? ' is-active' : ''}`,
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
      );
    });

    return el('nav', { className: 'ri-tabs', role: 'tablist', 'aria-label': 'Chọn công cụ nội bộ' }, tabEls);
  }

  function renderActionDeck() {
    const portal = PORTALS[state.activePortalId];
    const [primaryAction, ...secondaryActions] = portal.actions;

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
      return el(
        'button',
        {
          type: 'button',
          className: `ri-action-btn${act.kind === 'danger' ? ' is-danger' : ''}`,
          disabled: state.isRunning,
          onClick: () => triggerAction(act),
        },
        runningThis
          ? [el('span', { className: 'ri-spinner' }), el('span', { text: 'Đang chạy…' })]
          : [el('span', { text: act.label })]
      );
    });

    return el('section', { className: 'ri-card' }, [
      el('div', { className: 'ri-portal-head' }, [
        el('div', {}, [
          el('h2', { className: 'ri-portal-name', text: portal.label }),
          el('p', { className: 'ri-portal-desc', text: portal.description }),
        ]),
        el('span', { className: 'ri-portal-host', text: portal.fullName }),
      ]),
      primaryBtn,
      el('div', { className: 'ri-ops-pad' }, [
        el('div', { className: 'ri-ops-label', text: 'Lệnh xử lý nhanh (có xác nhận trước khi chạy)' }),
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
    if (res.status === 'iam_expired' && res.loginUrl) {
      extraBtns.push(
        el('button', {
          type: 'button',
          className: 'ri-primary-btn',
          text: 'Đăng nhập IAM ngay',
          onClick: () => {
            if (pageWindow && pageWindow.open) {
              pageWindow.open(res.loginUrl, '_blank', 'noopener');
            }
          },
        })
      );
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
          text: 'Mở trang MonitorOLT gốc',
          onClick: () => {
            if (pageWindow && pageWindow.open) {
              pageWindow.open(res.sourceUrl, '_blank', 'noopener');
            }
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
                if (pageWindow && pageWindow.open) {
                  pageWindow.open(v.url, '_blank', 'noopener');
                }
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
            if (pageWindow && pageWindow.open) {
              pageWindow.open(connUrl, '_blank', 'noopener');
            }
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
              text: 'Chế độ mô phỏng — Thông số kết nối mẫu: OLT BRUP00101GC16 [S:0 / P:5 / O:79]. Khi chạy thật qua Tampermonkey, khung này sẽ hiện OLT / Port trực tiếp từ Radius.',
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
              if (pageWindow && pageWindow.open) {
                pageWindow.open(state.oltLoginUrl, '_blank', 'noopener');
              }
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
        placeholder: 'Lọc nhanh tên OLT (ví dụ: BRUP001, GC16…)',
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

    const sheetParts = [
      el('h2', {
        className: 'ri-sheet-title',
        text: isInsideKill ? 'Kill Session — Phiên đang chạy' : `Xác nhận ${act.label}?`,
      }),
      el('p', {
        className: 'ri-sheet-sub',
        text: isInsideKill
          ? 'Kiểm tra đúng IP đang chạy bên dưới rồi chạm nút Kill để ngắt phiên (2 bước xác nhận ngay trên dòng).'
          : act.confirmNote || `Thao tác sẽ được gửi lên ${portal.fullName}.`,
      }),
    ];

    if (contractId) {
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
      text: (isInsideBox && state.boxTab === 'history') || isInsideKill ? 'Đóng' : 'Hủy',
      onClick: () => {
        resetConfirmState();
        renderConfirm();
      },
    });

    const confirmBtn = el('button', {
      type: 'button',
      className: 'ri-danger-btn',
      text: 'Xác nhận thực hiện',
    });

    let showConfirmBtn = true;

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
                if (pageWindow && pageWindow.open) {
                  pageWindow.open(state.modemLoginUrl, '_blank', 'noopener');
                }
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
                  if (pageWindow && pageWindow.open) {
                    pageWindow.open(state.boxLoginUrl, '_blank', 'noopener');
                  }
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
                if (pageWindow && pageWindow.open) {
                  pageWindow.open(state.killLoginUrl, '_blank', 'noopener');
                }
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

    return el('div', { className: 'ri-sheet-backdrop', role: 'dialog', 'aria-modal': 'true' }, [
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
            ? 'Đang quét cấu trúc cổng Port…'
            : '3. Quét tự động cấu trúc cổng Port (chạy ngay từ Inside, không cần F5)',
          onClick: handlePortDeepScan,
        })
      );
    }

    const scannerSubText =
      state.activePortalId === 'port'
        ? 'Nếu trang port.fpt.net bị lỗi khi F5, bạn chỉ cần đăng nhập port.fpt.net ở 1 tab riêng (không bấm F5), rồi mở Remote Inside ngay trên tab Inside -> chọn tab Port -> bấm nút 3 bên dưới để quét tự động.'
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

  function renderMain() {
    mainLayer.textContent = '';

    if (!state.isOpen && !standalone) {
      const fabLabel = state.isRecording
        ? `Đang ghi mẫu (${state.recordedEntries.length}) — Bấm để dừng`
        : fabLabelDefault;

      const fabClasses = [
        'ri-fab',
        state.isRecording ? 'is-recording' : '',
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
    if (!state.scannerOpen || (!state.isOpen && !standalone)) {
      if (scannerLayer.childNodes.length > 0) {
        scannerLayer.textContent = '';
      }
      return;
    }
    const scannerSheet = renderScannerSheet();
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
  if (standalone) {
    refreshSessionStatus();
  }

  return {
    open: openConsole,
    close: closeConsole,
    refreshSessionStatus,
  };
}
