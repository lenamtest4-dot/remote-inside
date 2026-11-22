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
import { checkPortalSession, isUserscriptEnv } from '../core/transport.js';
import {
  buildScanReport,
  createNetworkRecorder,
  scanPageStructure,
} from '../core/inspector.js';
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
  pageWindow = typeof window !== 'undefined' ? window : null,
  pageDocument = typeof document !== 'undefined' ? document : null,
}) {
  const savedPortal = getState(STORAGE_KEYS.ACTIVE_PORTAL, 'inside');
  const initialPortal = PORTALS[savedPortal] ? savedPortal : 'inside';
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
    confirmAction: null,
    scannerOpen: false,
    domSnapshot: null,
    recordedEntries: [],
    isRecording: false,
    copyNotice: '',
  };

  const recorder = createNetworkRecorder(
    pageWindow,
    () => normalizeContractId(state.contractInput)
  );

  let pollTimer = null;

  const wrapper = el('div', { className: 'ri-root' });
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

  async function refreshSessionStatus() {
    const portal = PORTALS[state.activePortalId];
    if (!isUserscriptEnv()) {
      state.sessionStatus = {
        state: 'demo',
        label: 'Chế độ xem thử',
        loginUrl: portal.url,
        detail: 'Đang chạy mô phỏng cục bộ (chưa gắn Tampermonkey).',
      };
      render();
      return;
    }

    state.sessionStatus = {
      state: 'checking',
      label: 'Đang kiểm tra…',
      loginUrl: portal.url,
      detail: '',
    };
    render();
    const checked = await checkPortalSession(portal);
    if (state.activePortalId === portal.id) {
      state.sessionStatus = checked;
      render();
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

  async function triggerAction(action) {
    if (state.isRunning) return;

    const check = validateContractId(state.contractInput);
    if (!check.valid) {
      state.result = {
        status: 'validation_error',
        title: 'Thiếu Mã hợp đồng',
        message: check.error,
      };
      render();
      return;
    }

    state.contractInput = check.value;

    if (action.requiresConfirm) {
      state.confirmAction = action;
      render();
      return;
    }

    await runConfirmedAction(action);
  }

  async function runConfirmedAction(action) {
    if (state.isRunning) return;
    const portal = PORTALS[state.activePortalId];
    const contractId = normalizeContractId(state.contractInput);

    state.confirmAction = null;
    state.isRunning = true;
    state.runningActionId = action.id;
    state.recentContracts = addRecentContract(contractId);
    render();

    try {
      const res = await executePortalAction(portal.id, action.id, contractId);
      state.result = res;

      const logKind =
        res.status === 'ok'
          ? 'ok'
          : res.status === 'needs_scan' || res.status === 'iam_expired'
          ? 'warn'
          : 'error';
      addLog(portal.label, action.label, contractId, logKind);

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
      addLog(portal.label, action.label, contractId, 'error');
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
    render();
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

  async function handleCopyScanReport() {
    const report = buildScanReport({
      domSnapshot: state.domSnapshot,
      networkEntries: state.recordedEntries,
      portalId: state.activePortalId,
    });
    const ok = await copyTextSafe(report);
    state.copyNotice = ok
      ? 'Đã sao chép báo cáo sạch vào bộ nhớ tạm! Bạn chỉ cần dán vào khung chat.'
      : 'Không sao chép tự động được — bạn bấm nút "Tải file JSON" bên cạnh nhé.';
    render();
  }

  function handleDownloadScanReport() {
    const report = buildScanReport({
      domSnapshot: state.domSnapshot,
      networkEntries: state.recordedEntries,
      portalId: state.activePortalId,
    });
    downloadJsonFile(`remote-inside-scan-${state.activePortalId}.json`, report);
    state.copyNotice = `Đã tải file remote-inside-scan-${state.activePortalId}.json.`;
    render();
  }

  function openConsole() {
    state.isOpen = true;
    render();
    refreshSessionStatus();
  }

  function closeConsole() {
    state.isOpen = false;
    state.confirmAction = null;
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

    const scanBtn = el('button', {
      type: 'button',
      className: 'ri-icon-btn',
      text: 'Quét cấu trúc',
      onClick: () => {
        state.scannerOpen = true;
        render();
      },
    });

    const rightControls = [pill, scanBtn];
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

    const extraBtns = [];
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
            render();
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

    if (extraBtns.length > 0) {
      children.push(el('div', { className: 'ri-result-actions' }, extraBtns));
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

  function renderConfirmSheet() {
    if (!state.confirmAction) return null;
    const act = state.confirmAction;
    const portal = PORTALS[state.activePortalId];
    const contractId = normalizeContractId(state.contractInput);

    return el('div', { className: 'ri-sheet-backdrop', role: 'dialog', 'aria-modal': 'true' }, [
      el('div', { className: 'ri-sheet' }, [
        el('h2', { className: 'ri-sheet-title', text: `Xác nhận ${act.label}?` }),
        el('p', {
          className: 'ri-sheet-sub',
          text: act.confirmNote || `Thao tác sẽ được gửi lên ${portal.fullName}.`,
        }),
        el('div', { className: 'ri-confirm-contract' }, [
          el('span', { text: `Hợp đồng trên ${portal.label}` }),
          el('span', { className: 'ri-confirm-code', text: contractId }),
        ]),
        el('div', { className: 'ri-sheet-buttons' }, [
          el('button', {
            type: 'button',
            className: 'ri-secondary-btn',
            text: 'Hủy',
            onClick: () => {
              state.confirmAction = null;
              render();
            },
          }),
          el('button', {
            type: 'button',
            className: 'ri-danger-btn',
            text: 'Xác nhận thực hiện',
            onClick: () => runConfirmedAction(act),
          }),
        ]),
      ]),
    ]);
  }

  function renderScannerSheet() {
    if (!state.scannerOpen) return null;

    const formCount = state.domSnapshot ? state.domSnapshot.forms.length : 0;
    const controlCount = state.domSnapshot ? state.domSnapshot.actionControls.length : 0;
    const reqCount = state.recordedEntries.length;
    const hasData = Boolean(state.domSnapshot) || reqCount > 0;

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
              render();
            },
          }),
        ]),
        el('p', {
          className: 'ri-sheet-sub',
          text: 'Dùng công cụ này khi bạn đang mở trang gốc (ví dụ inside.fpt.net) để lấy đúng các nút và lệnh bên dưới về ghép chạy thật.',
        }),
        el('div', { className: 'ri-privacy-note' }, [
          el('div', {
            text: 'Bảo vệ thông tin: Công cụ tự động bỏ qua mật khẩu, cookie, mã OTP và thông tin cá nhân khách hàng ([REDACTED]) trước khi tạo báo cáo.',
          }),
        ]),
        el('div', { className: 'ri-result-actions' }, [
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
        ]),
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

  function render() {
    wrapper.textContent = '';

    if (!state.isOpen && !standalone) {
      const fabLabel = state.isRecording
        ? `Đang ghi mẫu (${state.recordedEntries.length}) — Bấm để dừng`
        : 'Remote Inside';

      const fab = el(
        'button',
        {
          type: 'button',
          className: `ri-fab${state.isRecording ? ' is-recording' : ''}`,
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
      wrapper.appendChild(fab);
      return;
    }

    const main = el('main', { className: 'ri-main' }, [
      renderContractDock(),
      renderTabs(),
      renderActionDeck(),
      renderResultPanel(),
      renderActivityLog(),
    ]);

    const shell = el('div', { className: 'ri-shell' }, [renderTopBar(), main]);

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

    wrapper.appendChild(frame);

    const confirmSheet = renderConfirmSheet();
    if (confirmSheet) wrapper.appendChild(confirmSheet);

    const scannerSheet = renderScannerSheet();
    if (scannerSheet) wrapper.appendChild(scannerSheet);
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
