// ==UserScript==
// @name         Remote Inside — Bảng điều khiển hiện trường FPT
// @namespace    remote-inside.local
// @version      0.12.0
// @description  Giao diện 1 màn hình tối ưu di động cho 5 công cụ nội bộ FPT (Inside, Port, Camera, Vật tư, Radius)
// @homepageURL  https://github.com/lenamtest4-dot/remote-inside
// @updateURL    https://raw.githubusercontent.com/lenamtest4-dot/remote-inside/main/dist/remote-inside.meta.js
// @downloadURL  https://raw.githubusercontent.com/lenamtest4-dot/remote-inside/main/dist/remote-inside.user.js
// @match        https://inside.fpt.net/*
// @match        http://inside.fpt.net/*
// @match        http://mvc.inside.fpt.net/*
// @match        https://mvc.inside.fpt.net/*
// @match        https://fox-erp.fpt.net/*
// @match        http://fox-erp.fpt.net/*
// @match        https://partner.fpt.net/*
// @match        http://partner.fpt.net/*
// @match        https://port.fpt.net/*
// @match        http://port.fpt.net/*
// @match        https://mvcport.fpt.net/*
// @match        http://mvcport.fpt.net/*
// @match        https://fli-mngt.fcam.vn/*
// @match        http://fli-mngt.fcam.vn/*
// @match        https://nextgen.fpt.net/*
// @match        http://radius-portal.fpt.net/*
// @match        https://radius-portal.fpt.net/*
// @connect      inside.fpt.net
// @connect      mvc.inside.fpt.net
// @connect      fox-erp.fpt.net
// @connect      partner.fpt.net
// @connect      port.fpt.net
// @connect      mvcport.fpt.net
// @connect      fli-mngt.fcam.vn
// @connect      nextgen.fpt.net
// @connect      radius-portal.fpt.net
// @connect      radius-apigateway.fpt.net
// @connect      iam.fpt.net
// @connect      login.microsoftonline.com
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';
  const __REMOTE_INSIDE_VERSION__ = "0.12.0";
  const __REMOTE_INSIDE_CSS__ = ":host,\n.ri-root {\n  --bg-canvas: #F2F4F7;\n  --bg-surface: #FFFFFF;\n  --bg-subtle: #E9EEF4;\n  --ink-primary: #141B24;\n  --ink-muted: #526072;\n  --accent-signal: #E85D04;\n  --accent-signal-hover: #C94E02;\n  --accent-signal-soft: #FFF3EB;\n  --border-crisp: #D5DCE4;\n  --state-ok: #0F8A5F;\n  --state-ok-soft: #E9F7F1;\n  --state-warn: #B45309;\n  --state-warn-soft: #FEF6E7;\n  --state-danger: #C81E1E;\n  --state-danger-soft: #FDECEC;\n  --state-danger-border: #F5B8B8;\n\n  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Roboto', 'Segoe UI', sans-serif;\n  font-size: 15px;\n  line-height: 1.45;\n  color: var(--ink-primary);\n  box-sizing: border-box;\n  -webkit-font-smoothing: antialiased;\n}\n\n.ri-root *,\n.ri-root *::before,\n.ri-root *::after {\n  box-sizing: border-box;\n}\n\n.ri-root button,\n.ri-root input,\n.ri-root select {\n  font-family: inherit;\n  font-size: inherit;\n}\n\n.ri-root button:focus-visible,\n.ri-root input:focus-visible,\n.ri-root select:focus-visible,\n.ri-root a:focus-visible {\n  outline: 2px solid var(--accent-signal);\n  outline-offset: 2px;\n}\n\n/* Nen boc khi mo dang hop thoai tren trang FPT (Userscript mode) */\n.ri-overlay {\n  position: fixed;\n  inset: 0;\n  z-index: 2147483640;\n  background: rgba(20, 27, 36, 0.45);\n  display: flex;\n  justify-content: center;\n  align-items: flex-start;\n  overflow-y: auto;\n  padding: 0;\n}\n\n/* Khung doc lap khi chay tren preview.html */\n.ri-standalone-wrap {\n  min-height: 100dvh;\n  background: var(--bg-canvas);\n  display: flex;\n  justify-content: center;\n  align-items: flex-start;\n  padding: 0;\n}\n\n.ri-shell {\n  width: 100%;\n  max-width: 480px;\n  min-height: 100dvh;\n  background: var(--bg-canvas);\n  display: flex;\n  flex-direction: column;\n  padding-bottom: max(20px, env(safe-area-inset-bottom));\n}\n\n@media (min-width: 560px) {\n  .ri-overlay,\n  .ri-standalone-wrap {\n    padding: 20px 16px;\n  }\n\n  .ri-shell {\n    min-height: auto;\n    border: 1px solid var(--border-crisp);\n    border-radius: 14px;\n    overflow: hidden;\n    box-shadow: 0 8px 28px rgba(20, 27, 36, 0.12);\n  }\n}\n\n.ri-wide-btn {\n  display: none;\n}\n\n@media (min-width: 640px) {\n  .ri-wide-btn {\n    display: inline-flex;\n    align-items: center;\n    justify-content: center;\n  }\n\n  .ri-shell.is-wide {\n    max-width: 960px;\n  }\n}\n\n/* Thanh top-bar 52px dinh co dinh */\n.ri-topbar {\n  position: sticky;\n  top: 0;\n  z-index: 20;\n  min-height: 52px;\n  background: var(--bg-surface);\n  border-bottom: 1px solid var(--border-crisp);\n  padding: 8px 12px;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n}\n\n.ri-brand {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  min-width: 0;\n}\n\n.ri-brand-mark {\n  width: 10px;\n  height: 10px;\n  border-radius: 2px;\n  background: var(--accent-signal);\n  flex-shrink: 0;\n}\n\n.ri-brand-title {\n  margin: 0;\n  font-size: 16px;\n  font-weight: 700;\n  color: var(--ink-primary);\n  white-space: nowrap;\n}\n\n.ri-topbar-actions {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  flex-wrap: wrap;\n  justify-content: flex-end;\n}\n\n.ri-status-pill {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  min-height: 32px;\n  padding: 4px 10px;\n  border-radius: 999px;\n  border: 1px solid var(--border-crisp);\n  background: var(--bg-subtle);\n  color: var(--ink-primary);\n  font-size: 12px;\n  font-weight: 600;\n  cursor: pointer;\n  white-space: nowrap;\n}\n\n.ri-status-dot {\n  width: 7px;\n  height: 7px;\n  border-radius: 999px;\n  background: var(--ink-muted);\n}\n\n.ri-status-pill[data-state=\"ok\"] {\n  background: var(--state-ok-soft);\n  border-color: #B4E2D0;\n  color: var(--state-ok);\n}\n\n.ri-status-pill[data-state=\"ok\"] .ri-status-dot {\n  background: var(--state-ok);\n}\n\n.ri-status-pill[data-state=\"iam_expired\"] {\n  background: var(--state-warn-soft);\n  border-color: #F3D19E;\n  color: var(--state-warn);\n}\n\n.ri-status-pill[data-state=\"iam_expired\"] .ri-status-dot {\n  background: var(--state-warn);\n}\n\n.ri-status-pill[data-state=\"offline\"] {\n  background: var(--state-danger-soft);\n  border-color: var(--state-danger-border);\n  color: var(--state-danger);\n}\n\n.ri-status-pill[data-state=\"offline\"] .ri-status-dot {\n  background: var(--state-danger);\n}\n\n.ri-icon-btn {\n  min-height: 34px;\n  padding: 6px 10px;\n  border-radius: 8px;\n  border: 1px solid var(--border-crisp);\n  background: var(--bg-surface);\n  color: var(--ink-primary);\n  font-size: 13px;\n  font-weight: 600;\n  cursor: pointer;\n  white-space: nowrap;\n}\n\n.ri-icon-btn:hover {\n  background: var(--bg-subtle);\n}\n\n.ri-icon-btn:active {\n  transform: translateY(1px);\n}\n\n.ri-main {\n  padding: 12px;\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n}\n\n.ri-card {\n  background: var(--bg-surface);\n  border: 1px solid var(--border-crisp);\n  border-radius: 12px;\n  padding: 12px;\n}\n\n/* Khu nhap Ma Hop Dong dung chung */\n.ri-contract-label {\n  display: block;\n  font-size: 13px;\n  font-weight: 600;\n  color: var(--ink-muted);\n  margin-bottom: 6px;\n}\n\n.ri-contract-row {\n  display: flex;\n  gap: 8px;\n  align-items: stretch;\n}\n\n.ri-contract-input {\n  flex: 1;\n  min-width: 0;\n  min-height: 48px;\n  padding: 10px 12px;\n  border: 1.5px solid var(--border-crisp);\n  border-radius: 10px;\n  background: var(--bg-canvas);\n  color: var(--ink-primary);\n  font-size: 17px;\n  font-weight: 700;\n  font-variant-numeric: tabular-nums;\n  letter-spacing: 0.02em;\n}\n\n.ri-contract-input::placeholder {\n  font-weight: 400;\n  color: #7D8B9C;\n}\n\n.ri-contract-input:focus {\n  outline: none;\n  border-color: var(--accent-signal);\n  background: var(--bg-surface);\n}\n\n.ri-input-tool {\n  min-height: 48px;\n  min-width: 56px;\n  padding: 0 12px;\n  border-radius: 10px;\n  border: 1px solid var(--border-crisp);\n  background: var(--bg-surface);\n  color: var(--ink-primary);\n  font-size: 13px;\n  font-weight: 600;\n  cursor: pointer;\n}\n\n.ri-input-tool:hover {\n  background: var(--bg-subtle);\n}\n\n.ri-recent-wrap {\n  margin-top: 10px;\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n\n.ri-recent-head {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  font-size: 12px;\n  color: var(--ink-muted);\n}\n\n.ri-text-btn {\n  background: transparent;\n  border: none;\n  padding: 4px 6px;\n  color: var(--ink-muted);\n  font-size: 12px;\n  font-weight: 600;\n  cursor: pointer;\n  border-radius: 6px;\n}\n\n.ri-text-btn:hover {\n  background: var(--bg-subtle);\n  color: var(--ink-primary);\n}\n\n.ri-recent-chips {\n  display: flex;\n  gap: 6px;\n  overflow-x: auto;\n  padding-bottom: 2px;\n  scrollbar-width: thin;\n}\n\n.ri-chip {\n  min-height: 36px;\n  padding: 6px 11px;\n  border-radius: 8px;\n  border: 1px solid var(--border-crisp);\n  background: var(--bg-canvas);\n  color: var(--ink-primary);\n  font-size: 13px;\n  font-weight: 600;\n  font-variant-numeric: tabular-nums;\n  white-space: nowrap;\n  cursor: pointer;\n}\n\n.ri-chip.is-active {\n  border-color: var(--accent-signal);\n  background: var(--accent-signal-soft);\n  color: var(--accent-signal-hover);\n}\n\n/* Thanh 5 tab cong cu */\n.ri-tabs {\n  display: flex;\n  gap: 6px;\n  overflow-x: auto;\n  padding: 2px 0;\n  scrollbar-width: none;\n}\n\n.ri-tabs::-webkit-scrollbar {\n  display: none;\n}\n\n.ri-tab {\n  min-height: 44px;\n  padding: 8px 12px;\n  border-radius: 10px;\n  border: 1px solid var(--border-crisp);\n  background: var(--bg-surface);\n  color: var(--ink-muted);\n  font-size: 14px;\n  font-weight: 600;\n  cursor: pointer;\n  white-space: nowrap;\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  flex-shrink: 0;\n}\n\n.ri-tab.is-active {\n  border-color: var(--accent-signal);\n  background: var(--bg-surface);\n  color: var(--ink-primary);\n  box-shadow: inset 0 -2.5px 0 var(--accent-signal);\n}\n\n.ri-tab-badge {\n  font-size: 11px;\n  font-weight: 600;\n  padding: 2px 6px;\n  border-radius: 6px;\n  background: var(--bg-subtle);\n  color: var(--ink-muted);\n}\n\n.ri-tab.is-active .ri-tab-badge[data-tier=\"priority\"] {\n  background: var(--accent-signal-soft);\n  color: var(--accent-signal-hover);\n}\n\n.ri-tab.is-active .ri-tab-badge[data-tier=\"in_progress\"] {\n  background: #FEF3C7;\n  color: var(--state-warn);\n}\n\n/* Bang nut lenh thao tac */\n.ri-portal-head {\n  display: flex;\n  justify-content: space-between;\n  align-items: flex-start;\n  gap: 8px;\n  margin-bottom: 12px;\n}\n\n.ri-portal-name {\n  margin: 0;\n  font-size: 16px;\n  font-weight: 700;\n  color: var(--ink-primary);\n}\n\n.ri-portal-desc {\n  margin: 2px 0 0;\n  font-size: 13px;\n  color: var(--ink-muted);\n}\n\n.ri-portal-host {\n  font-size: 12px;\n  font-weight: 600;\n  color: var(--ink-muted);\n  background: var(--bg-canvas);\n  border: 1px solid var(--border-crisp);\n  border-radius: 6px;\n  padding: 3px 8px;\n  white-space: nowrap;\n}\n\n.ri-primary-btn {\n  width: 100%;\n  min-height: 50px;\n  padding: 12px 16px;\n  border: none;\n  border-radius: 10px;\n  background: var(--accent-signal);\n  color: #FFFFFF;\n  font-size: 15px;\n  font-weight: 700;\n  cursor: pointer;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: 8px;\n}\n\n.ri-primary-btn:hover:not(:disabled) {\n  background: var(--accent-signal-hover);\n}\n\n.ri-primary-btn:active:not(:disabled) {\n  transform: translateY(1px);\n}\n\n.ri-primary-btn:disabled,\n.ri-action-btn:disabled {\n  opacity: 0.6;\n  cursor: not-allowed;\n}\n\n.ri-ops-pad {\n  margin-top: 12px;\n  padding: 10px;\n  border-radius: 10px;\n  background: var(--bg-canvas);\n  border: 1px solid var(--border-crisp);\n}\n\n.ri-ops-label {\n  font-size: 12px;\n  font-weight: 600;\n  color: var(--ink-muted);\n  margin-bottom: 8px;\n}\n\n.ri-action-grid {\n  display: grid;\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n  gap: 8px;\n}\n\n.ri-action-btn {\n  min-height: 48px;\n  padding: 10px 12px;\n  border-radius: 10px;\n  border: 1px solid var(--border-crisp);\n  background: var(--bg-surface);\n  color: var(--ink-primary);\n  font-size: 14px;\n  font-weight: 600;\n  cursor: pointer;\n  text-align: center;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: 6px;\n}\n\n.ri-action-btn.is-danger {\n  border-color: var(--state-danger-border);\n  color: var(--state-danger);\n}\n\n.ri-action-btn.is-danger:hover:not(:disabled) {\n  background: var(--state-danger-soft);\n  border-color: var(--state-danger);\n}\n\n.ri-action-btn:active:not(:disabled) {\n  transform: translateY(1px);\n}\n\n.ri-utility-row {\n  margin-top: 10px;\n  padding-top: 10px;\n  border-top: 1px solid var(--border-crisp);\n  display: flex;\n  gap: 8px;\n}\n\n.ri-secondary-btn {\n  flex: 1;\n  min-height: 44px;\n  padding: 8px 12px;\n  border-radius: 9px;\n  border: 1px solid var(--border-crisp);\n  background: var(--bg-surface);\n  color: var(--ink-primary);\n  font-size: 13px;\n  font-weight: 600;\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  gap: 6px;\n}\n\n.ri-secondary-btn:hover {\n  background: var(--bg-subtle);\n}\n\n/* Khung ket qua tra ve */\n.ri-result-card {\n  border-radius: 12px;\n  border: 1px solid var(--border-crisp);\n  background: var(--bg-surface);\n  padding: 12px;\n}\n\n.ri-result-card[data-tone=\"ok\"] {\n  border-color: #B4E2D0;\n}\n\n.ri-result-card[data-tone=\"warn\"] {\n  border-color: #F3D19E;\n  background: var(--state-warn-soft);\n}\n\n.ri-result-card[data-tone=\"error\"] {\n  border-color: var(--state-danger-border);\n  background: var(--state-danger-soft);\n}\n\n.ri-result-title {\n  margin: 0;\n  font-size: 15px;\n  font-weight: 700;\n  color: var(--ink-primary);\n}\n\n.ri-result-msg {\n  margin: 4px 0 0;\n  font-size: 14px;\n  color: var(--ink-primary);\n}\n\n.ri-result-hint {\n  margin: 6px 0 0;\n  font-size: 13px;\n  color: var(--ink-muted);\n}\n\n.ri-result-actions {\n  margin-top: 10px;\n  display: flex;\n  flex-wrap: wrap;\n  gap: 8px;\n}\n\n.ri-kv-list {\n  margin: 10px 0 0;\n  padding: 0;\n  list-style: none;\n  border-top: 1px solid var(--border-crisp);\n}\n\n.ri-kv-item {\n  display: flex;\n  justify-content: space-between;\n  align-items: baseline;\n  gap: 12px;\n  padding: 8px 0;\n  border-bottom: 1px solid #EEF2F6;\n  font-size: 13px;\n}\n\n.ri-kv-item:last-child {\n  border-bottom: none;\n  padding-bottom: 0;\n}\n\n.ri-kv-key {\n  color: var(--ink-muted);\n  flex-shrink: 0;\n}\n\n.ri-kv-val {\n  color: var(--ink-primary);\n  font-weight: 600;\n  text-align: right;\n  font-variant-numeric: tabular-nums;\n  word-break: break-word;\n}\n\n.ri-sub-section-title {\n  margin: 12px 0 4px;\n  padding-top: 10px;\n  border-top: 1px solid var(--border-crisp);\n  font-size: 13px;\n  font-weight: 700;\n  color: var(--ink-muted);\n}\n\n/* Cac khoi nhung chi tiet 5 muc tu he thong */\n.ri-embed-group {\n  margin-top: 14px;\n  padding-top: 12px;\n  border-top: 1px solid var(--border-crisp);\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n}\n\n.ri-embed-toolbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  flex-wrap: wrap;\n}\n\n.ri-embed-toolbar-title {\n  font-size: 13px;\n  font-weight: 700;\n  color: var(--ink-primary);\n}\n\n.ri-embed-toolbar-btns {\n  display: flex;\n  gap: 4px;\n}\n\n.ri-embed-card {\n  border: 1px solid var(--border-crisp);\n  border-radius: 10px;\n  background: var(--bg-canvas);\n  overflow: hidden;\n}\n\n.ri-embed-head {\n  min-height: 44px;\n  padding: 6px 10px;\n  background: var(--bg-surface);\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  flex-wrap: wrap;\n}\n\n.ri-embed-title-wrap {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  min-width: 0;\n}\n\n.ri-embed-title {\n  font-size: 14px;\n  font-weight: 700;\n  color: var(--ink-primary);\n}\n\n.ri-embed-badge {\n  font-size: 11px;\n  font-weight: 600;\n  padding: 2px 6px;\n  border-radius: 6px;\n  background: var(--bg-subtle);\n  color: var(--ink-muted);\n  white-space: nowrap;\n}\n\n.ri-embed-actions {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n  flex-wrap: wrap;\n}\n\n.ri-embed-open-link,\n.ri-embed-toggle {\n  min-height: 32px;\n  padding: 4px 9px;\n  border-radius: 7px;\n  border: 1px solid var(--border-crisp);\n  background: var(--bg-surface);\n  color: var(--ink-primary);\n  font-size: 12px;\n  font-weight: 600;\n  cursor: pointer;\n  white-space: nowrap;\n}\n\n.ri-embed-open-link:hover,\n.ri-embed-toggle:hover {\n  background: var(--bg-subtle);\n}\n\n.ri-embed-toggle.is-open {\n  border-color: var(--accent-signal);\n  color: var(--accent-signal-hover);\n  background: var(--accent-signal-soft);\n}\n\n.ri-embed-body {\n  border-top: 1px solid var(--border-crisp);\n  background: #FFFFFF;\n}\n\n.ri-embed-frame {\n  width: 100%;\n  border: 0;\n  display: block;\n  background: #FFFFFF;\n}\n\n.ri-embed-demo {\n  padding: 12px;\n  font-size: 13px;\n  color: var(--ink-muted);\n  background: var(--bg-canvas);\n}\n\n/* Nhat ky thao tac */\n.ri-log-head {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  margin-bottom: 6px;\n}\n\n.ri-section-title {\n  margin: 0;\n  font-size: 14px;\n  font-weight: 700;\n  color: var(--ink-primary);\n}\n\n.ri-log-empty {\n  margin: 6px 0 0;\n  font-size: 13px;\n  color: var(--ink-muted);\n}\n\n.ri-log-list {\n  list-style: none;\n  margin: 0;\n  padding: 0;\n}\n\n.ri-log-item {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  gap: 10px;\n  padding: 8px 0;\n  border-bottom: 1px solid #EEF2F6;\n  font-size: 13px;\n}\n\n.ri-log-item:last-child {\n  border-bottom: none;\n  padding-bottom: 0;\n}\n\n.ri-log-main {\n  min-width: 0;\n}\n\n.ri-log-action {\n  font-weight: 600;\n  color: var(--ink-primary);\n}\n\n.ri-log-contract {\n  font-variant-numeric: tabular-nums;\n  color: var(--ink-muted);\n  margin-left: 6px;\n}\n\n.ri-log-meta {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  flex-shrink: 0;\n}\n\n.ri-badge {\n  font-size: 11px;\n  font-weight: 700;\n  padding: 2px 7px;\n  border-radius: 6px;\n  background: var(--bg-subtle);\n  color: var(--ink-muted);\n}\n\n.ri-badge[data-status=\"ok\"] {\n  background: var(--state-ok-soft);\n  color: var(--state-ok);\n}\n\n.ri-badge[data-status=\"warn\"] {\n  background: var(--state-warn-soft);\n  color: var(--state-warn);\n}\n\n.ri-badge[data-status=\"error\"] {\n  background: var(--state-danger-soft);\n  color: var(--state-danger);\n}\n\n.ri-log-time {\n  font-size: 12px;\n  color: var(--ink-muted);\n  font-variant-numeric: tabular-nums;\n}\n\n/* Hop thoai xac nhan & Ngan quet cau truc */\n.ri-sheet-backdrop {\n  position: fixed;\n  inset: 0;\n  z-index: 2147483645;\n  background: rgba(20, 27, 36, 0.52);\n  display: flex;\n  align-items: flex-end;\n  justify-content: center;\n  padding: 0;\n}\n\n.ri-sheet {\n  width: 100%;\n  max-width: 480px;\n  max-height: 88dvh;\n  overflow-y: auto;\n  background: var(--bg-surface);\n  border-top-left-radius: 16px;\n  border-top-right-radius: 16px;\n  border: 1px solid var(--border-crisp);\n  padding: 16px 14px max(18px, env(safe-area-inset-bottom));\n}\n\n@media (min-width: 560px) {\n  .ri-sheet-backdrop {\n    align-items: center;\n    padding: 16px;\n  }\n\n  .ri-sheet {\n    border-radius: 14px;\n    padding: 18px;\n  }\n}\n\n.ri-sheet-title {\n  margin: 0;\n  font-size: 17px;\n  font-weight: 700;\n  color: var(--ink-primary);\n}\n\n.ri-sheet-sub {\n  margin: 6px 0 0;\n  font-size: 14px;\n  color: var(--ink-muted);\n}\n\n.ri-confirm-contract {\n  margin: 12px 0;\n  padding: 10px 12px;\n  border-radius: 10px;\n  background: var(--bg-canvas);\n  border: 1px solid var(--border-crisp);\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n}\n\n.ri-confirm-code {\n  font-size: 18px;\n  font-weight: 800;\n  font-variant-numeric: tabular-nums;\n  color: var(--ink-primary);\n}\n\n.ri-confirm-meta {\n  margin-top: -6px;\n  margin-bottom: 10px;\n  font-size: 12px;\n  color: var(--ink-muted);\n  font-variant-numeric: tabular-nums;\n}\n\n.ri-confirm-input-wrap {\n  margin: 10px 0 4px;\n}\n\n.ri-confirm-label {\n  display: block;\n  font-size: 13px;\n  font-weight: 600;\n  color: var(--ink-muted);\n  margin-bottom: 6px;\n}\n\n.ri-confirm-input {\n  width: 100%;\n  min-height: 44px;\n  padding: 9px 11px;\n  border: 1.5px solid var(--border-crisp);\n  border-radius: 9px;\n  background: var(--bg-canvas);\n  color: var(--ink-primary);\n  font-size: 14px;\n  font-weight: 600;\n  font-variant-numeric: tabular-nums;\n}\n\n.ri-confirm-input:focus {\n  outline: none;\n  border-color: var(--accent-signal);\n  background: var(--bg-surface);\n}\n\n.ri-inline-head {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  margin-bottom: 6px;\n}\n\n.ri-inline-head .ri-confirm-label {\n  margin-bottom: 0;\n}\n\n.ri-select {\n  width: 100%;\n  min-height: 44px;\n  padding: 9px 11px;\n  border: 1.5px solid var(--border-crisp);\n  border-radius: 9px;\n  background: var(--bg-canvas);\n  color: var(--ink-primary);\n  font-size: 14px;\n  font-weight: 600;\n  cursor: pointer;\n}\n\n.ri-select:focus {\n  outline: none;\n  border-color: var(--accent-signal);\n  background: var(--bg-surface);\n}\n\n.ri-field-hint {\n  margin-top: 6px;\n  font-size: 12px;\n  font-weight: 600;\n  color: var(--ink-muted);\n  font-variant-numeric: tabular-nums;\n}\n\n.ri-field-hint[data-state=\"ok\"] {\n  color: var(--state-ok);\n}\n\n.ri-field-hint[data-state=\"warn\"] {\n  color: var(--state-warn);\n}\n\n.ri-field-hint[data-state=\"error\"] {\n  color: var(--state-danger);\n}\n\n.ri-modem-info {\n  margin: 10px 0 6px;\n  padding: 11px 12px;\n  border-radius: 10px;\n  border: 1.5px solid var(--border-crisp);\n  background: var(--bg-canvas);\n}\n\n.ri-modem-mac {\n  margin-top: 4px;\n  font-size: 16px;\n  font-weight: 800;\n  color: var(--ink-primary);\n  font-variant-numeric: tabular-nums;\n  letter-spacing: 0.02em;\n  word-break: break-all;\n}\n\n.ri-history-list {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  max-height: 280px;\n  overflow-y: auto;\n}\n\n.ri-history-card {\n  padding: 10px 12px;\n  border-radius: 10px;\n  border: 1px solid var(--border-crisp);\n  background: var(--bg-canvas);\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n}\n\n.ri-history-macs {\n  font-size: 14px;\n  font-weight: 700;\n  color: var(--ink-primary);\n  font-variant-numeric: tabular-nums;\n  word-break: break-all;\n}\n\n.ri-history-meta {\n  font-size: 12px;\n  color: var(--ink-muted);\n  word-break: break-word;\n}\n\n.ri-conn-box {\n  margin: 10px 0 4px;\n}\n\n.ri-olt-detected {\n  margin: 8px 0 4px;\n  padding: 10px 12px;\n  border-radius: 10px;\n  border: 1.5px solid #B4E2D0;\n  background: var(--state-ok-soft);\n  color: #0B6A49;\n}\n\n.ri-olt-detected-title {\n  font-size: 13px;\n  font-weight: 800;\n  font-variant-numeric: tabular-nums;\n  word-break: break-word;\n}\n\n.ri-olt-detected-sub {\n  margin-top: 2px;\n  font-size: 12px;\n  font-weight: 600;\n}\n\n.ri-session-list {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  max-height: 300px;\n  overflow-y: auto;\n  margin-bottom: 4px;\n}\n\n.ri-session-card {\n  padding: 11px 12px;\n  border-radius: 10px;\n  border: 1.5px solid var(--border-crisp);\n  background: var(--bg-canvas);\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n}\n\n.ri-session-ip {\n  font-size: 15px;\n  font-weight: 800;\n  color: var(--ink-primary);\n  font-variant-numeric: tabular-nums;\n  word-break: break-all;\n}\n\n.ri-session-meta {\n  font-size: 12px;\n  color: var(--ink-muted);\n  font-variant-numeric: tabular-nums;\n  word-break: break-word;\n}\n\n.ri-session-actions {\n  margin-top: 6px;\n  display: flex;\n  gap: 8px;\n}\n\n.ri-session-kill-btn {\n  min-height: 44px;\n}\n\n.ri-sheet-status {\n  margin: 10px 0;\n  padding: 12px;\n  border-radius: 10px;\n  border: 1px solid var(--border-crisp);\n  background: var(--bg-canvas);\n  color: var(--ink-primary);\n  font-size: 13px;\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n}\n\n.ri-sheet-status.is-loading {\n  flex-direction: row;\n  align-items: center;\n  gap: 10px;\n}\n\n.ri-sheet-status[data-tone=\"error\"] {\n  border-color: var(--state-danger-border);\n  background: var(--state-danger-soft);\n  color: var(--state-danger);\n}\n\n.ri-sheet-status[data-tone=\"warn\"] {\n  border-color: #F3D19E;\n  background: var(--state-warn-soft);\n  color: var(--state-warn);\n}\n\n.ri-box-list {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n}\n\n.ri-box-item {\n  width: 100%;\n  min-height: 52px;\n  padding: 10px 12px;\n  border-radius: 10px;\n  border: 1.5px solid var(--border-crisp);\n  background: var(--bg-canvas);\n  color: var(--ink-primary);\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 10px;\n  text-align: left;\n  cursor: pointer;\n}\n\n.ri-box-item:hover {\n  background: var(--bg-subtle);\n}\n\n.ri-box-item.is-selected {\n  border-color: var(--accent-signal);\n  background: var(--accent-signal-soft);\n}\n\n.ri-box-item-main {\n  min-width: 0;\n}\n\n.ri-box-mac {\n  font-size: 15px;\n  font-weight: 700;\n  font-variant-numeric: tabular-nums;\n  word-break: break-all;\n}\n\n.ri-box-sub {\n  margin-top: 2px;\n  font-size: 12px;\n  color: var(--ink-muted);\n  font-variant-numeric: tabular-nums;\n}\n\n.ri-box-item.is-selected .ri-tab-badge {\n  background: var(--accent-signal);\n  color: #FFFFFF;\n}\n\n.ri-mode-row {\n  display: grid;\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n  gap: 8px;\n}\n\n.ri-mode-btn {\n  min-height: 44px;\n  padding: 8px 12px;\n  border-radius: 9px;\n  border: 1.5px solid var(--border-crisp);\n  background: var(--bg-canvas);\n  color: var(--ink-primary);\n  font-size: 14px;\n  font-weight: 600;\n  cursor: pointer;\n}\n\n.ri-mode-btn:hover {\n  background: var(--bg-subtle);\n}\n\n.ri-mode-btn.is-active {\n  border-color: var(--accent-signal);\n  background: var(--accent-signal-soft);\n  color: var(--accent-signal-hover);\n  font-weight: 700;\n}\n\n.ri-port-grid {\n  display: grid;\n  grid-template-columns: repeat(4, minmax(0, 1fr));\n  gap: 8px;\n}\n\n.ri-port-chip {\n  min-height: 44px;\n  padding: 6px 4px;\n  border-radius: 9px;\n  border: 1.5px solid var(--border-crisp);\n  background: var(--bg-canvas);\n  color: var(--ink-primary);\n  font-size: 13px;\n  font-weight: 600;\n  font-variant-numeric: tabular-nums;\n  cursor: pointer;\n  text-align: center;\n}\n\n.ri-port-chip:hover {\n  background: var(--bg-subtle);\n}\n\n.ri-port-chip.is-selected {\n  border-color: var(--accent-signal);\n  background: var(--accent-signal);\n  color: #FFFFFF;\n  font-weight: 700;\n}\n\n.ri-port-chip.is-busy,\n.ri-port-chip:disabled {\n  background: #F4F5F7;\n  color: #9AA5B4;\n  border-color: #E2E7EE;\n  text-decoration: line-through;\n  cursor: not-allowed;\n  opacity: 0.72;\n}\n\n.ri-textarea {\n  width: 100%;\n  min-height: 70px;\n  padding: 10px 12px;\n  border: 1.5px solid var(--border-crisp);\n  border-radius: 10px;\n  font-family: inherit;\n  font-size: 14px;\n  color: var(--ink-primary);\n  background: var(--bg-surface);\n  resize: vertical;\n}\n\n.ri-textarea:focus {\n  outline: none;\n  border-color: var(--accent-signal);\n}\n\n.ri-sheet-buttons {\n  margin-top: 14px;\n  display: flex;\n  gap: 8px;\n  position: sticky;\n  bottom: -18px;\n  background: var(--bg-surface);\n  padding-top: 10px;\n  padding-bottom: 4px;\n  border-top: 1px solid var(--border-crisp);\n  z-index: 2;\n}\n\n.ri-danger-btn {\n  flex: 1;\n  min-height: 48px;\n  padding: 10px 14px;\n  border: none;\n  border-radius: 10px;\n  background: var(--state-danger);\n  color: #FFFFFF;\n  font-size: 15px;\n  font-weight: 700;\n  cursor: pointer;\n}\n\n.ri-danger-btn:hover:not(:disabled) {\n  background: #A81818;\n}\n\n.ri-danger-btn:disabled {\n  opacity: 0.48;\n  cursor: not-allowed;\n}\n\n.ri-summary-toggle {\n  cursor: pointer;\n  font-size: 13px;\n  font-weight: 700;\n  color: var(--ink-secondary);\n  padding: 6px 2px;\n  user-select: none;\n}\n\n.ri-privacy-note {\n  margin: 10px 0;\n  padding: 10px;\n  border-radius: 9px;\n  background: var(--state-ok-soft);\n  border: 1px solid #B4E2D0;\n  color: #0B6A49;\n  font-size: 13px;\n}\n\n.ri-scan-stats {\n  margin-top: 10px;\n  padding: 10px;\n  border-radius: 9px;\n  background: var(--bg-canvas);\n  border: 1px solid var(--border-crisp);\n  font-size: 13px;\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  gap: 8px;\n  text-align: center;\n}\n\n.ri-scan-stat strong {\n  display: block;\n  font-size: 18px;\n  font-variant-numeric: tabular-nums;\n  color: var(--ink-primary);\n}\n\n/* Nut noi goc phai duoi trong Userscript mode */\n.ri-fab {\n  position: fixed;\n  right: 16px;\n  bottom: 16px;\n  z-index: 2147483642;\n  min-height: 46px;\n  padding: 10px 15px;\n  border-radius: 999px;\n  border: 1.5px solid #FFFFFF;\n  background: var(--accent-signal);\n  color: #FFFFFF;\n  font-size: 14px;\n  font-weight: 700;\n  box-shadow: 0 4px 14px rgba(20, 27, 36, 0.25);\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  gap: 8px;\n}\n\n.ri-fab.is-recording {\n  background: var(--state-danger);\n}\n\n.ri-fab.is-left {\n  right: auto;\n  left: 16px;\n  background: #334155;\n}\n\n.ri-fab-dot {\n  width: 8px;\n  height: 8px;\n  border-radius: 999px;\n  background: #FFFFFF;\n}\n\n/* Spinner don gian */\n.ri-spinner {\n  width: 16px;\n  height: 16px;\n  border: 2px solid currentColor;\n  border-right-color: transparent;\n  border-radius: 999px;\n  display: inline-block;\n  animation: ri-spin 0.7s linear infinite;\n}\n\n@keyframes ri-spin {\n  to {\n    transform: rotate(360deg);\n  }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .ri-spinner {\n    animation: none;\n    border-style: dotted;\n  }\n  .ri-icon-btn:active,\n  .ri-primary-btn:active,\n  .ri-action-btn:active {\n    transform: none;\n  }\n}\n";

// --- config/portals.js ---
/**
 * Cau hinh 5 cong noi bo FPT va cac thao tac chuan hoa Ma Hop Dong.
 */
const PORTAL_ORDER = ['inside', 'port', 'camera', 'recall', 'radius'];
const IAM_SSO_TARGETS = [
  { id: 'inside', portalId: 'inside', label: 'Inside', url: 'http://inside.fpt.net/default.asp' },
  { id: 'partner', portalId: 'inside', label: 'Partner', url: 'https://partner.fpt.net/monitor' },
  { id: 'fox_erp', portalId: 'inside', label: 'FOX-ERP', url: 'https://fox-erp.fpt.net/app/tkbt/tk/ticket' },
  { id: 'port', portalId: 'port', label: 'Port (FTTH NEW)', url: 'http://port.fpt.net/' },
  { id: 'recall', portalId: 'recall', label: 'Vật tư', url: 'https://nextgen.fpt.net/resource/recall' },
  { id: 'radius', portalId: 'radius', label: 'Radius', url: 'http://radius-portal.fpt.net/networkConnection' },
];
const PORTALS = {
  inside: {
    id: 'inside',
    label: 'Inside',
    fullName: 'inside.fpt.net',
    url: 'http://inside.fpt.net/default.asp',
    hosts: ['inside.fpt.net', 'mvc.inside.fpt.net', 'fox-erp.fpt.net', 'partner.fpt.net'],
    iamSso: true,
    status: 'priority',
    statusLabel: 'Đủ 7 lệnh',
    description: 'Tra thông tin HĐ, Reset MAC Modem/Box, Kill Session, Clear OSP, ByPass, Phiếu triển khai.',
    actions: [
      {
        id: 'lookup',
        label: 'Tra thông tin HĐ',
        description: 'Xem nhanh trạng thái thuê bao, MAC, phiên kết nối và OSP.',
        kind: 'primary',
        requiresConfirm: false,
      },
      {
        id: 'reset_mac',
        label: 'Reset MAC Modem',
        description: 'Xem MAC Modem đang chạy của hợp đồng, xóa trắng hoặc đổi MAC mới.',
        kind: 'danger',
        requiresConfirm: true,
        confirmNote: 'Kiểm tra MAC Modem đang chạy trước khi xóa trắng hoặc cập nhật MAC mới.',
      },
      {
        id: 'reset_mac_box',
        label: 'Reset MAC Box',
        description: 'Xem danh sách MAC Box, thay thế MAC mới (12/16 ký tự) và xem lịch sử Reset MAC.',
        kind: 'danger',
        requiresConfirm: true,
        confirmNote: 'Chọn đúng MAC Box cần thay thế trên hợp đồng và nhập MAC Box mới.',
      },
      {
        id: 'kill_session',
        label: 'Kill Session',
        description: 'Ngắt phiên PPPoE/kết nối hiện tại để thiết bị quay lại phiên mới.',
        kind: 'danger',
        requiresConfirm: true,
        confirmNote: 'Khách hàng có thể mất mạng vài giây trong lúc thiết bị kết nối lại.',
      },
      {
        id: 'clear_osp',
        label: 'Clear OSP',
        description: 'Xem Thông số kết nối (OLT/Port của HĐ) và chạy Clear Serial trên MonitorOLT.',
        kind: 'danger',
        requiresConfirm: true,
        requiresContract: false,
        confirmNote: 'Chọn đúng POP OLT và Port cần Clear Serial trước khi xác nhận.',
      },
      {
        id: 'bypass',
        label: 'ByPass',
        description: 'Tra cứu, thêm mới hoặc cập nhật tình trạng Gông / Bỏ gông trên CheckList ByPass.',
        kind: 'danger',
        requiresConfirm: true,
        requiresContract: false,
        confirmNote:
          'Kiểm tra đúng Số HĐ / Tập điểm, Email NV kỹ thuật, Tình trạng và Lý do ByPass trước khi lưu.',
      },
      {
        id: 'deploy_ticket',
        label: 'Phiếu triển khai',
        description:
          'Mở phiếu triển khai FOX-ERP: Clear MAC vật tư, Hoàn tất phiếu, SĐT User, Biên bản ĐT, Cập nhật Online.',
        kind: 'primary',
        requiresConfirm: true,
        requiresContract: false,
        confirmNote:
          'Tra cứu và thao tác trực tiếp trên phiếu triển khai FOX-ERP của hợp đồng.',
      },
    ],
  },
  port: {
    id: 'port',
    label: 'Port',
    fullName: 'port.fpt.net',
    url: 'http://port.fpt.net/',
    sessionCheckUrl: 'http://mvcport.fpt.net/ftth_newport/contract/index',
    hosts: ['port.fpt.net', 'mvcport.fpt.net'],
    iamSso: true,
    status: 'priority',
    statusLabel: 'Đủ 3 lệnh',
    description: 'FTTH NEW: Xem Port hiện tại, Lịch sử Port, Cấp/Đổi mới và Thu hồi Port.',
    actions: [
      {
        id: 'lookup_port',
        label: 'Xem Port hiện tại',
        description: 'Tra thông tin hợp đồng, Tập điểm / Port, TSTC và trạng thái trên FTTH NEW.',
        kind: 'primary',
        requiresConfirm: false,
      },
      {
        id: 'assign_port',
        label: 'Cấp / Đổi Port',
        description: 'Cấp mới hoặc đổi Tập điểm / Port còn trống và xem Lịch sử Port.',
        kind: 'danger',
        requiresConfirm: true,
        confirmNote: 'Chọn đúng Vùng, POP, Hộp đấu nối và Port còn trống trước khi xác nhận.',
      },
      {
        id: 'release_port',
        label: 'Thu hồi Port',
        description: 'Chuyển trạng thái hợp đồng FTTH NEW sang Đã thu hồi port.',
        kind: 'danger',
        requiresConfirm: true,
        confirmNote: 'Thu hồi Port sẽ chuyển tình trạng sang Đã thu hồi port trên mvcport.fpt.net.',
      },
    ],
  },
  camera: {
    id: 'camera',
    label: 'Camera',
    fullName: 'fli-mngt.fcam.vn',
    url: 'https://fli-mngt.fcam.vn/',
    hosts: ['fli-mngt.fcam.vn'],
    iamSso: false,
    status: 'planned',
    statusLabel: 'Sắp ghép',
    description: 'Kiểm tra trạng thái và hỗ trợ xử lý lỗi Camera.',
    actions: [
      {
        id: 'check_camera',
        label: 'Kiểm tra lỗi Camera',
        description: 'Xem tình trạng kết nối và cảnh báo lỗi Camera của hợp đồng.',
        kind: 'primary',
        requiresConfirm: false,
      },
      {
        id: 'reboot_camera',
        label: 'Khởi động lại Camera',
        description: 'Gửi lệnh khởi động lại thiết bị Camera từ xa.',
        kind: 'danger',
        requiresConfirm: true,
        confirmNote: 'Thiết bị Camera sẽ tạm ngắt hình trong lúc khởi động lại.',
      },
    ],
  },
  recall: {
    id: 'recall',
    label: 'Vật tư',
    fullName: 'nextgen.fpt.net/resource/recall',
    url: 'https://nextgen.fpt.net/resource/recall',
    hosts: ['nextgen.fpt.net'],
    iamSso: true,
    status: 'planned',
    statusLabel: 'Sắp ghép',
    description: 'Tra cứu và cập nhật các vật tư thu hồi theo hợp đồng.',
    actions: [
      {
        id: 'lookup_recall',
        label: 'Xem vật tư thu hồi',
        description: 'Tra cứu danh sách thiết bị/vật tư cần thu hồi của hợp đồng.',
        kind: 'primary',
        requiresConfirm: false,
      },
      {
        id: 'update_recall',
        label: 'Cập nhật thu hồi',
        description: 'Ghi nhận trạng thái thu hồi vật tư lên NextGen.',
        kind: 'danger',
        requiresConfirm: true,
        confirmNote: 'Xác nhận cập nhật trạng thái vật tư thu hồi cho hợp đồng này.',
      },
    ],
  },
  radius: {
    id: 'radius',
    label: 'Radius',
    fullName: 'radius-portal.fpt.net',
    url: 'http://radius-portal.fpt.net/networkConnection',
    hosts: ['radius-portal.fpt.net'],
    iamSso: true,
    status: 'planned',
    statusLabel: 'Sắp ghép',
    description: 'Kiểm tra kết nối và bỏ IPNAT, IPv6 cho hợp đồng.',
    actions: [
      {
        id: 'check_radius',
        label: 'Kiểm tra kết nối',
        description: 'Xem cấu hình IPNAT, IPv6 hiện tại trên Radius Portal.',
        kind: 'primary',
        requiresConfirm: false,
      },
      {
        id: 'remove_ipnat',
        label: 'Bỏ IPNAT',
        description: 'Gỡ cấu hình IPNAT đang áp trên thuê bao.',
        kind: 'danger',
        requiresConfirm: true,
        confirmNote: 'Thao tác này sẽ bỏ IPNAT cho hợp đồng trên Radius Portal.',
      },
      {
        id: 'remove_ipv6',
        label: 'Bỏ IPv6',
        description: 'Tắt cấp phát IPv6 cho kết nối của hợp đồng.',
        kind: 'danger',
        requiresConfirm: true,
        confirmNote: 'Thao tác này sẽ bỏ IPv6 cho hợp đồng trên Radius Portal.',
      },
    ],
  },
};
const CONTRACT_REGEX = /^[A-Z0-9._-]{3,32}$/;

/**
 * Chuan hoa Ma Hop Dong: cat khoang trang thua, bo ky tu dieu khien, viet hoa.
 */
function normalizeContractId(raw) {
  if (typeof raw !== 'string') {
    return '';
  }
  return raw
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, '')
    .trim()
    .toUpperCase();
}

/**
 * Kiem tra hop le Ma Hop Dong truoc khi gui lenh.
 */
function validateContractId(raw) {
  const value = normalizeContractId(raw);
  if (!value) {
    return {
      valid: false,
      value: '',
      error: 'Vui lòng nhập Mã hợp đồng trước khi thực hiện thao tác.',
    };
  }
  if (!CONTRACT_REGEX.test(value)) {
    return {
      valid: false,
      value,
      error: 'Mã hợp đồng chỉ gồm chữ, số, dấu gạch (- / _ / .) và dài từ 3 đến 32 ký tự.',
    };
  }
  return { valid: true, value, error: '' };
}

// --- core/storage.js ---
/**
 * Luu trang thai cuc bo tren may (chi luu Ma HD gan day va tab dang chon).
 * Tuyet doi khong luu mat khau, cookie hay token dang nhap.
 */
const STORAGE_KEYS = {
  RECENT_CONTRACTS: 'ri_recent_contracts',
  ACTIVE_PORTAL: 'ri_active_portal',
  LAST_CONTRACT: 'ri_last_contract',
};

const MAX_RECENT_CONTRACTS = 12;
const FORBIDDEN_KEY_RE = /(pass|pwd|secret|token|cookie|auth|otp|pin)/i;
const memoryFallback = new Map();

function hasGmStorage() {
  return typeof GM_getValue === 'function' && typeof GM_setValue === 'function';
}

function hasLocalStorage() {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null;
  } catch {
    return false;
  }
}
function getState(key, fallback = null, storageAdapter = null) {
  if (FORBIDDEN_KEY_RE.test(String(key))) {
    return fallback;
  }

  try {
    if (storageAdapter && typeof storageAdapter.get === 'function') {
      const val = storageAdapter.get(key);
      return val === undefined || val === null ? fallback : val;
    }

    if (hasGmStorage()) {
      const raw = GM_getValue(key, null);
      if (raw === null || raw === undefined) {
        return fallback;
      }
      return typeof raw === 'string' ? safeJsonParse(raw, raw) : raw;
    }

    if (hasLocalStorage()) {
      const raw = localStorage.getItem(key);
      if (raw === null) {
        return fallback;
      }
      return safeJsonParse(raw, raw);
    }

    return memoryFallback.has(key) ? memoryFallback.get(key) : fallback;
  } catch {
    return fallback;
  }
}
function setState(key, value, storageAdapter = null) {
  if (FORBIDDEN_KEY_RE.test(String(key))) {
    return false;
  }

  try {
    if (storageAdapter && typeof storageAdapter.set === 'function') {
      storageAdapter.set(key, value);
      return true;
    }

    const serialized = JSON.stringify(value);
    if (hasGmStorage()) {
      GM_setValue(key, serialized);
      return true;
    }

    if (hasLocalStorage()) {
      localStorage.setItem(key, serialized);
      return true;
    }

    memoryFallback.set(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeJsonParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function getRecentContracts(storageAdapter = null) {
  const list = getState(STORAGE_KEYS.RECENT_CONTRACTS, [], storageAdapter);
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .map((item) => normalizeContractId(String(item || '')))
    .filter(Boolean)
    .slice(0, MAX_RECENT_CONTRACTS);
}
function addRecentContract(rawId, storageAdapter = null) {
  const cleanId = normalizeContractId(rawId);
  if (!cleanId || cleanId.length < 3) {
    return getRecentContracts(storageAdapter);
  }

  const current = getRecentContracts(storageAdapter);
  const next = [cleanId, ...current.filter((item) => item !== cleanId)].slice(
    0,
    MAX_RECENT_CONTRACTS
  );
  setState(STORAGE_KEYS.RECENT_CONTRACTS, next, storageAdapter);
  setState(STORAGE_KEYS.LAST_CONTRACT, cleanId, storageAdapter);
  return next;
}
function clearRecentContracts(storageAdapter = null) {
  setState(STORAGE_KEYS.RECENT_CONTRACTS, [], storageAdapter);
  return [];
}

// --- core/transport.js ---
/**
 * Lop giao tiep mang qua Userscript (GM_xmlhttpRequest) hoac Android Native WebView Bridge
 * giu nguyen phien IAM & VPN chinh chu.
 * Khi mo file preview.html doc lap, tu dong chay che do xem thu (Demo).
 */

const IAM_HOST_RE = /(iam|sso|login|auth|signin|oauth|cas)/i;
const LOGIN_PASSWORD_INPUT_RE = /<input[^>]+type\s*=\s*["']?password["']?/i;
const LOGIN_TITLE_RE = /<title[^>]*>[^<]*(iam|sign\s*in|đăng\s*nhập|login)[^<]*<\/title>/i;
const WARM_CACHE_TTL_MS = 25000;

let androidReqSeq = 0;
const warmCacheByHost = new Map();
const inFlightWarmByHost = new Map();
function isAndroidAppEnv() {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.RemoteInsideNative) &&
    typeof window.RemoteInsideNative.httpRequest === 'function'
  );
}
function getRuntimeEnv() {
  if (isAndroidAppEnv()) {
    return 'android';
  }
  if (typeof GM_xmlhttpRequest === 'function') {
    return 'userscript';
  }
  return 'preview';
}
function isUserscriptEnv() {
  return typeof GM_xmlhttpRequest === 'function' || isAndroidAppEnv();
}
function openExternalOrPortalUrl(
  url,
  {
    mode = 'portal',
    title = '',
    pageWindow = typeof window !== 'undefined' ? window : null,
  } = {}
) {
  if (!url || typeof url !== 'string') {
    return false;
  }
  if (
    isAndroidAppEnv() &&
    typeof window.RemoteInsideNative.openPortal === 'function'
  ) {
    window.RemoteInsideNative.openPortal(
      String(url || ''),
      String(mode || 'portal'),
      String(title || '')
    );
    return true;
  }
  if (pageWindow && typeof pageWindow.open === 'function') {
    pageWindow.open(url, '_blank', 'noopener');
    return true;
  }
  return false;
}

function ensureNativePendingBridge() {
  if (typeof window === 'undefined') {
    return;
  }
  if (!window.__riNativePending || typeof window.__riNativePending.set !== 'function') {
    window.__riNativePending = new Map();
  }

  if (typeof window.__riNativeResolve !== 'function') {
    window.__riNativeResolve = (reqId, inlineRawJson) => {
      const pending = window.__riNativePending;
      const entry = pending && pending.get(reqId);
      if (!entry) {
        return;
      }
      pending.delete(reqId);
      if (entry.timer) {
        clearTimeout(entry.timer);
      }

      let rawJson = typeof inlineRawJson === 'string' ? inlineRawJson : '';
      if (!rawJson) {
        try {
          if (
            window.RemoteInsideNative &&
            typeof window.RemoteInsideNative.consumeResponse === 'function'
          ) {
            rawJson = window.RemoteInsideNative.consumeResponse(reqId) || '';
          }
        } catch {
          rawJson = '';
        }
      }

      let parsed = null;
      try {
        parsed = rawJson ? JSON.parse(rawJson) : null;
      } catch {
        parsed = null;
      }

      if (!parsed || typeof parsed !== 'object') {
        entry.resolve({
          ok: false,
          mode: 'android',
          status: entry.kind === 'warm' ? 'invalid_response' : 0,
          finalUrl: entry.url || '',
          responseText: '',
          responseHeaders: '',
          error: 'INVALID_BRIDGE_RESPONSE',
        });
        return;
      }

      if (entry.kind === 'warm' || typeof parsed.status === 'string') {
        entry.resolve({
          ok: Boolean(parsed.ok),
          mode: 'android',
          status: typeof parsed.status === 'string' ? parsed.status : parsed.ok ? 'ok' : 'error',
          finalUrl: String(parsed.finalUrl || entry.url || ''),
          sawAuth: Boolean(parsed.sawAuth),
          error: parsed.error ? String(parsed.error) : undefined,
        });
        return;
      }

      entry.resolve({
        ok: Boolean(parsed.ok),
        mode: 'android',
        status: Number(parsed.status) || 0,
        finalUrl: String(parsed.finalUrl || entry.url || ''),
        responseText: String(parsed.responseText || ''),
        responseHeaders: String(parsed.responseHeaders || ''),
        error: parsed.error ? String(parsed.error) : undefined,
      });
    };
  }
}

function requestViaAndroidNative({
  url,
  method = 'GET',
  headers = {},
  data = null,
  timeout = 15000,
} = {}) {
  if (typeof window === 'undefined' || !isAndroidAppEnv()) {
    return Promise.resolve({
      ok: false,
      mode: 'android',
      status: 0,
      finalUrl: url || '',
      responseText: '',
      error: 'BRIDGE_UNAVAILABLE',
    });
  }

  ensureNativePendingBridge();

  const reqId = `ri_${++androidReqSeq}_${Date.now()}`;
  const numericTimeout = Math.max(1000, Number(timeout) || 15000);

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (window.__riNativePending && window.__riNativePending.has(reqId)) {
        window.__riNativePending.delete(reqId);
        resolve({
          ok: false,
          mode: 'android',
          status: 0,
          finalUrl: url || '',
          responseText: '',
          responseHeaders: '',
          error: 'TIMEOUT',
        });
      }
    }, numericTimeout + 3000);

    window.__riNativePending.set(reqId, {
      kind: 'http',
      resolve,
      timer,
      url: url || '',
    });

    try {
      window.RemoteInsideNative.httpRequest(
        JSON.stringify({
          reqId,
          url: url || '',
          method: method || 'GET',
          headers: headers || {},
          data: data === null || data === undefined ? null : String(data),
          timeout: numericTimeout,
        })
      );
    } catch (err) {
      if (window.__riNativePending) {
        window.__riNativePending.delete(reqId);
      }
      clearTimeout(timer);
      resolve({
        ok: false,
        mode: 'android',
        status: 0,
        finalUrl: url || '',
        responseText: '',
        responseHeaders: '',
        error: err && err.message ? err.message : 'REQUEST_FAILED',
      });
    }
  });
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function canWarmPortalSession() {
  return (
    isAndroidAppEnv() &&
    typeof window !== 'undefined' &&
    Boolean(window.RemoteInsideNative) &&
    typeof window.RemoteInsideNative.warmPortalSession === 'function'
  );
}
function clearWarmSessionCache() {
  warmCacheByHost.clear();
}
function warmPortalSession(url, { timeout = 12000, force = false } = {}) {
  if (!url || typeof url !== 'string') {
    return Promise.resolve({ ok: false, status: 'invalid_url', finalUrl: '' });
  }
  if (!canWarmPortalSession()) {
    return Promise.resolve({ ok: false, status: 'unsupported', finalUrl: url });
  }

  const host = extractHost(url);
  if (!host) {
    return Promise.resolve({ ok: false, status: 'invalid_url', finalUrl: url });
  }

  if (!force) {
    const cached = warmCacheByHost.get(host);
    if (cached && Date.now() - cached.at < WARM_CACHE_TTL_MS) {
      return Promise.resolve({ ...cached, cached: true });
    }
  }

  const existingInFlight = inFlightWarmByHost.get(host);
  if (existingInFlight) {
    return existingInFlight;
  }

  ensureNativePendingBridge();
  const reqId = `ri_warm_${++androidReqSeq}_${Date.now()}`;
  const numericTimeout = Math.max(3000, Math.min(20000, Number(timeout) || 12000));

  const promise = new Promise((resolve) => {
    const finish = (outcome) => {
      const normalized = {
        ok: Boolean(outcome && outcome.ok),
        status: String((outcome && outcome.status) || 'error'),
        finalUrl: String((outcome && outcome.finalUrl) || url),
        sawAuth: Boolean(outcome && outcome.sawAuth),
        at: Date.now(),
      };
      warmCacheByHost.set(host, normalized);
      inFlightWarmByHost.delete(host);
      resolve(normalized);
    };

    const timer = setTimeout(() => {
      if (window.__riNativePending && window.__riNativePending.has(reqId)) {
        window.__riNativePending.delete(reqId);
      }
      finish({ ok: false, status: 'timeout', finalUrl: url });
    }, numericTimeout + 4000);

    window.__riNativePending.set(reqId, {
      kind: 'warm',
      resolve: finish,
      timer,
      url,
    });

    try {
      window.RemoteInsideNative.warmPortalSession(
        JSON.stringify({
          reqId,
          url,
          timeout: numericTimeout,
        })
      );
    } catch {
      if (window.__riNativePending) {
        window.__riNativePending.delete(reqId);
      }
      clearTimeout(timer);
      finish({ ok: false, status: 'error', finalUrl: url });
    }
  });

  inFlightWarmByHost.set(host, promise);
  return promise;
}
async function syncIamSsoSessions({
  targets = IAM_SSO_TARGETS,
  skipHost = '',
  force = true,
  onProgress = null,
  afterTarget = null,
} = {}) {
  const list = Array.isArray(targets) ? targets : [];
  const normalizedSkip = String(skipHost || '').trim().toLowerCase();
  if (force) {
    clearWarmSessionCache();
  }

  const okTargets = [];
  const needsLoginTargets = [];
  const offlineTargets = [];
  const results = [];

  for (let i = 0; i < list.length; i++) {
    const target = list[i];
    if (!target || !target.url) continue;
    const targetHost = extractHost(target.url);
    const matchesSkip =
      Boolean(normalizedSkip) &&
      (targetHost === normalizedSkip || targetHost.endsWith(`.${normalizedSkip}`));

    let res;
    if (matchesSkip) {
      res = { ok: true, status: 'already_signed_in', finalUrl: target.url, skipped: true };
    } else {
      res = await warmPortalSession(target.url, { timeout: 12000, force });
    }

    if (res.ok && typeof afterTarget === 'function') {
      try {
        await afterTarget(target, res);
      } catch {
        // ignore follow-up hook errors so remaining SSO targets still sync
      }
    }

    if (res.ok) {
      okTargets.push(target);
    } else if (res.status === 'network_error' || res.status === 'timeout' || res.status === 'ssl_error') {
      offlineTargets.push(target);
    } else {
      needsLoginTargets.push(target);
    }

    results.push({ target, res });
    if (typeof onProgress === 'function') {
      try {
        onProgress({ index: i + 1, total: list.length, target, res });
      } catch {
        // ignore UI callback errors
      }
    }
  }

  return { okTargets, needsLoginTargets, offlineTargets, results };
}

function extractHost(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return '';
  }
  try {
    return new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Nhan dien tinh huong trang noi bo tra ve man hinh dang nhap IAM hoac bi tu choi quyen.
 */
function detectIamRedirect({
  status = 0,
  finalUrl = '',
  responseText = '',
  requestedUrl = '',
} = {}) {
  if (status === 401 || status === 403) {
    return {
      expired: true,
      reason: `Máy chủ trả về mã ${status} (cần đăng nhập lại IAM).`,
    };
  }

  const reqHost = extractHost(requestedUrl);
  const resHost = extractHost(finalUrl);

  if (reqHost && resHost && reqHost !== resHost && IAM_HOST_RE.test(resHost)) {
    return {
      expired: true,
      reason: `Trang đã chuyển hướng sang cổng đăng nhập (${resHost}).`,
    };
  }

  if (/\/LoginPage\.aspx(?:\?|$|#)/i.test(finalUrl)) {
    return {
      expired: true,
      reason: 'Trang đã chuyển hướng về màn hình đăng nhập (LoginPage.aspx).',
    };
  }

  if (typeof responseText === 'string' && responseText.length > 0) {
    const isPortLoggedInFrameset =
      /<frameset\b/i.test(responseText) &&
      /LeftMenu\.aspx/i.test(responseText) &&
      !LOGIN_PASSWORD_INPUT_RE.test(responseText);
    if (
      LOGIN_PASSWORD_INPUT_RE.test(responseText) ||
      (!isPortLoggedInFrameset && LOGIN_TITLE_RE.test(responseText))
    ) {
      return {
        expired: true,
        reason: 'Phát hiện màn hình đăng nhập IAM trong phản hồi.',
      };
    }
  }

  return { expired: false, reason: '' };
}

/**
 * Gui yeu cau HTTP bang Android Native Bridge hoac GM_xmlhttpRequest (khong bi chan CORS giua 5 trang FPT).
 */
function requestPortal({
  url,
  method = 'GET',
  headers = {},
  data = null,
  timeout = 15000,
} = {}) {
  if (isAndroidAppEnv()) {
    return requestViaAndroidNative({ url, method, headers, data, timeout });
  }

  if (typeof GM_xmlhttpRequest !== 'function') {
    return Promise.resolve({
      ok: false,
      mode: 'preview',
      status: 0,
      finalUrl: url || '',
      responseText: '',
      error: 'PREVIEW_MODE',
    });
  }

  return new Promise((resolve) => {
    try {
      GM_xmlhttpRequest({
        method,
        url,
        headers,
        data,
        timeout,
        anonymous: false,
        onload(res) {
          resolve({
            ok: res.status >= 200 && res.status < 400,
            mode: 'userscript',
            status: res.status,
            finalUrl: res.finalUrl || url,
            responseText: res.responseText || '',
            responseHeaders: res.responseHeaders || '',
          });
        },
        onerror() {
          resolve({
            ok: false,
            mode: 'userscript',
            status: 0,
            finalUrl: url,
            responseText: '',
            error: 'NETWORK_ERROR',
          });
        },
        ontimeout() {
          resolve({
            ok: false,
            mode: 'userscript',
            status: 0,
            finalUrl: url,
            responseText: '',
            error: 'TIMEOUT',
          });
        },
      });
    } catch (err) {
      resolve({
        ok: false,
        mode: 'userscript',
        status: 0,
        finalUrl: url,
        responseText: '',
        error: err && err.message ? err.message : 'REQUEST_FAILED',
      });
    }
  });
}

/**
 * Kiem tra nhanh tinh trang ket noi VPN & phien dang nhap IAM cua 1 cong cu.
 */
async function checkPortalSession(
  portal,
  { checkUrlOverride = '', allowSsoWarmup = true } = {}
) {
  if (!portal || !portal.url) {
    return {
      state: 'offline',
      label: 'Chưa rõ cổng',
      loginUrl: '',
      detail: 'Không tìm thấy đường dẫn cổng nội bộ.',
    };
  }

  if (!isUserscriptEnv()) {
    return {
      state: 'demo',
      label: 'Chế độ xem thử',
      loginUrl: portal.url,
      detail: 'Đang chạy thử cục bộ trên máy (chưa gắn Tampermonkey).',
    };
  }

  const checkUrl = checkUrlOverride || portal.sessionCheckUrl || portal.url;
  const res = await requestPortal({ url: checkUrl, method: 'GET', timeout: 10000 });

  if (res.error === 'NETWORK_ERROR' || res.error === 'TIMEOUT' || res.status === 0) {
    return {
      state: 'offline',
      label: 'Chưa thông mạng',
      loginUrl: portal.url,
      detail: `Không chạm tới được ${portal.fullName}. Hãy kiểm tra VPN công ty đã bật chưa.`,
    };
  }

  const iamCheck = detectIamRedirect({
    status: res.status,
    finalUrl: res.finalUrl,
    responseText: res.responseText,
    requestedUrl: checkUrl,
  });

  if (iamCheck.expired) {
    if (allowSsoWarmup && portal.iamSso && canWarmPortalSession()) {
      const warm = await warmPortalSession(portal.url, { timeout: 12000 });
      if (warm && warm.ok) {
        const retryRes = await requestPortal({ url: checkUrl, method: 'GET', timeout: 10000 });
        if (retryRes && retryRes.status >= 200 && retryRes.status < 400) {
          const retryIam = detectIamRedirect({
            status: retryRes.status,
            finalUrl: retryRes.finalUrl,
            responseText: retryRes.responseText,
            requestedUrl: checkUrl,
          });
          if (!retryIam.expired) {
            return {
              state: 'ok',
              label: 'IAM ổn',
              loginUrl: portal.url,
              detail: `Đã tự động đồng bộ phiên IAM cho ${portal.fullName}.`,
            };
          }
        }
      }
    }
    return {
      state: 'iam_expired',
      label: 'Cần đăng nhập IAM',
      loginUrl: portal.url,
      detail: iamCheck.reason,
    };
  }

  if (res.status >= 200 && res.status < 400) {
    return {
      state: 'ok',
      label: 'IAM ổn',
      loginUrl: portal.url,
      detail: `Đã kết nối tốt tới ${portal.fullName} qua VPN & IAM.`,
    };
  }

  return {
    state: 'offline',
    label: `Lỗi HTTP ${res.status}`,
    loginUrl: portal.url,
    detail: `Cổng ${portal.fullName} phản hồi mã ${res.status}.`,
  };
}

// --- core/inspector.js ---
/**
 * Cong cu Quet cau truc trang & Ghi mau thao tac mang an toan.
 * Tu dong an mat khau, cookie, token va thong tin ca nhan khach hang ([REDACTED]).
 */
const SENSITIVE_HEADER_RE =
  /^(authorization|cookie|set-cookie|x-csrf-token|x-xsrf-token|x-auth-token|x-resource-grant|api-key|x-api-key|proxy-authorization)$/i;
const SENSITIVE_KEY_RE =
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
function redactHeaders(headers) {
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
function summarizeSensitiveHeaders(headers) {
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
function redactPayload(input, contractId = '', depth = 0) {
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
function redactResponseStructure(bodyText, contentType = '', contractId = '') {
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
function scanPageStructure(doc = document, loc = window.location, contractId = '') {
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
function createNetworkRecorder(targetWindow, getContractId = () => '') {
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
function extractApiHintsFromHtml(htmlText, baseUrl = '', contractId = '') {
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
function extractApiHintsFromJs(jsText, contractId = '') {
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
function extractAjaxSignaturesFromHtml(htmlText, baseUrl = '', contractId = '') {
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
function extractOpsMenuFromLeftAsp(htmlText, baseUrl = 'http://inside.fpt.net/Left.Asp') {
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
function extractFramesAndLinksFromHtml(
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
function extractInlineScriptsSanitized(
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
function extractFormControlsMeta(htmlText, contractId = '') {
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
function extractMatchingFunctionsFromJs(
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

/**
 * Trich xuat danh sach chunk JS/MJS cung origin tu HTML (<link modulepreload>, <script src>) va PerformanceResourceTiming.
 */
function extractSpaChunkUrls(htmlText, baseUrl = '', perfEntries = []) {
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
    if (!rawUrl || typeof rawUrl !== 'string' || urls.length >= 35) {
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
    while ((lm = linkRe.exec(cleanedHtml)) !== null && urls.length < 35) {
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
    while ((sm = scriptTagRe.exec(cleanedHtml)) !== null && urls.length < 35) {
      const src = getAttrValue(sm[1] || '', 'src');
      if (src) {
        addCandidate(src);
      }
    }
  }

  if (Array.isArray(perfEntries)) {
    for (const entry of perfEntries) {
      if (urls.length >= 35) break;
      const rawName = typeof entry === 'string' ? entry : entry && entry.name;
      if (typeof rawName === 'string' && rawName) {
        addCandidate(rawName);
      }
    }
  }

  return urls;
}

/**
 * Trich xuat URL Next.js App Router chunk (app/public/partial/.../page-*.js) tu HTML/RSC payload.
 */
function extractNextAppChunkUrls(
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
  const chunkRe = /(?:\/_next\/)?static\/chunks\/app\/public\/partial\/[a-zA-Z0-9_\/-]+\.js/g;
  const urls = [];
  const seen = new Set();
  let m;

  while ((m = chunkRe.exec(normalized)) !== null && urls.length < 6) {
    const cleanRel = m[0].replace(/^\/?_next\//, '').replace(/^\//, '');
    const fullUrl = `${origin}/_next/${cleanRel}`;
    if (!seen.has(fullUrl)) {
      seen.add(fullUrl);
      urls.push(fullUrl);
    }
  }

  return urls;
}

/**
 * Trich xuat doan code ngu canh quanh tu khoa API / OLT trong bundle JS (da an du lieu nhay cam).
 */
function extractCodeContextsFromJs(
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
function buildScanReport({
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

// --- adapters/inside.js ---
/**
 * Adapter xu ly cho trang uu tien so 1: inside.fpt.net (qua mvc.inside.fpt.net)
 * Da noi API that cho Tra thong tin HD; cac lenh tac dong manh cho quet mau tung man hinh.
 */


/**
 * Ban do endpoint that cua inside.fpt.net & mvc.inside.fpt.net.
 */
const INSIDE_ENDPOINTS = {
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
  bypass: {
    page: 'http://mvc.inside.fpt.net/CheckListByPass/CLByPass/',
    insert: 'http://mvc.inside.fpt.net/CheckListByPass/CLByPass/InsListByPass',
    search: 'http://mvc.inside.fpt.net/CheckListByPass/CLByPass/LoadListContract',
    update: 'http://mvc.inside.fpt.net/CheckListByPass/CLByPass/UpdateRowTableCL',
    remove: 'http://mvc.inside.fpt.net/CheckListByPass/CLByPass/DeleteRowTableCL',
  },
};
const BYPASS_CHOICE_OPTIONS = [
  { value: 'Hợp đồng', label: 'Hợp đồng' },
  { value: 'Tập điểm', label: 'Tập điểm' },
];
const BYPASS_TYPE_OPTIONS = [
  { value: 'Gong', label: 'Gông (Gong)' },
  {
    value: 'Bo Gong Tam va Phai Xu Ly Gong Lai',
    label: 'Bỏ gông tạm & phải xử lý gông lại',
  },
  { value: 'Bo Gong', label: 'Bỏ gông (Bo Gong)' },
];
const BYPASS_REASON_BY_TYPE = {
  Gong: [],
  'Bo Gong Tam va Phai Xu Ly Gong Lai': [
    {
      value: 'Loi do ha tang nang cap chua co DSP',
      label: 'Lỗi do hạ tầng nâng cấp chưa có DSP',
    },
    {
      value: 'Ha tang dau noi sai lech',
      label: 'Hạ tầng đấu nối sai lệch',
    },
    {
      value: 'Loi ha tang suy hao',
      label: 'Lỗi hạ tầng suy hao',
    },
    {
      value: 'Loi suy hao ha tang doi INF xu ly',
      label: 'Lỗi suy hao hạ tầng đợi INF xử lý',
    },
  ],
  'Bo Gong': [
    {
      value: 'Ha tang doi tac',
      label: 'Hạ tầng đối tác',
    },
    {
      value: 'Ha tang ha ngam sap cong be, bo cap khong keo lai duoc thue bao',
      label: 'Hạ tầng hạ ngầm sập cống bể, bó cáp không kéo lại được thuê bao',
    },
    {
      value: 'Ha tang AON',
      label: 'Hạ tầng AON',
    },
    {
      value: 'KH di day am tuong',
      label: 'KH đi dây âm tường',
    },
  ],
};

const INSIDE_BYPASS_META_CACHE = {
  meta: null,
  expiresAt: 0,
};
const INSIDE_CONTRACT_CACHE = new Map();
const INSIDE_OLT_HINT_CACHE = new Map();
const INSIDE_OLT_CACHE = {
  locations: [],
  defaultLocationId: '',
  ports: [],
  oltsByLocation: new Map(),
  fetchedAt: 0,
};
function setInsideOltHint(objId, info = {}) {
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
function getInsideOltHint(objId) {
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
function isSameOltDetectedInfo(a, b) {
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
function getCachedInsideContract(rawContractId) {
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
function extractHtmlTablePairs(htmlText) {
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
function parseInsideLookupPayload({
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
function parseInsideMutationResponse({
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

async function fetchInsideEndpoint(url, acceptHtml = false, _didSsoWarmup = false) {
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
    if (!_didSsoWarmup && canWarmPortalSession()) {
      const warmUrl = /mvc\.inside\.fpt\.net/i.test(url)
        ? 'http://mvc.inside.fpt.net/'
        : PORTALS.inside.url;
      const warm = await warmPortalSession(warmUrl, { timeout: 12000 });
      if (warm && warm.ok) {
        return fetchInsideEndpoint(url, acceptHtml, true);
      }
    }
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
function parseKillSessionRows(json) {
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
async function fetchInsideOnlineSessions(rawContractId, ctx = {}) {
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
          objID: '900000001',
          date: '23/11/2026 04:16:30',
          name: `demo-${contractId.toLowerCase()}`,
          nasName: 'DEMO-BRAS-01',
          ipAddress: '10.0.0.100',
          callerId: 'A4:2B:8C:10:9E:4F',
        },
      ],
    };
  }

  const body = new URLSearchParams({
    searchBy: '1',
    searchValue: contractId,
  });

  const sendSearch = () =>
    requestPortal({
      url: INSIDE_ENDPOINTS.kill_session.search,
      method: 'POST',
      headers: {
        ...AJAX_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      data: body.toString(),
      timeout: 15000,
    });

  let res = await sendSearch();

  if (res.error === 'NETWORK_ERROR' || res.error === 'TIMEOUT' || res.status === 0) {
    return {
      status: 'error',
      message: 'Không kết nối được tới mvc.inside.fpt.net để tìm phiên đang chạy. Hãy kiểm tra VPN.',
      loginUrl: PORTALS.inside.url,
      sessions: [],
    };
  }

  let iam = detectIamRedirect({
    status: res.status,
    finalUrl: res.finalUrl,
    responseText: res.responseText,
    requestedUrl: INSIDE_ENDPOINTS.kill_session.search,
  });
  if (iam.expired && canWarmPortalSession()) {
    const warm = await warmPortalSession('http://mvc.inside.fpt.net/', { timeout: 12000 });
    if (warm && warm.ok) {
      res = await sendSearch();
      if (res.error === 'NETWORK_ERROR' || res.error === 'TIMEOUT' || res.status === 0) {
        return {
          status: 'error',
          message:
            'Không kết nối được tới mvc.inside.fpt.net để tìm phiên đang chạy. Hãy kiểm tra VPN.',
          loginUrl: PORTALS.inside.url,
          sessions: [],
        };
      }
      iam = detectIamRedirect({
        status: res.status,
        finalUrl: res.finalUrl,
        responseText: res.responseText,
        requestedUrl: INSIDE_ENDPOINTS.kill_session.search,
      });
    }
  }
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
async function fetchInsideModemInfo(rawContractId, ctx = {}) {
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
      objID: '900000001',
      accountName: 'demo-account-123',
      macAddress: 'A4:2B:8C:10:9E:4F',
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
      const oltLabel = ctx.oltName || (ctx.oltId ? `OLT ${ctx.oltId}` : 'DEMO-OLT-01GC16');
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
    case 'bypass': {
      const bpMode = ctx.mode || 'create';
      const target = String(ctx.contract || contractId || 'SGN123456').trim();
      if (bpMode === 'delete') {
        return {
          status: 'ok',
          mode: 'demo',
          title: `Đã xóa ByPass (${target}) (Dữ liệu mô phỏng)`,
          message: 'Lệnh mô phỏng thành công: Đã xóa dòng CheckList ByPass.',
          summaryFields: [{ label: 'Số HĐ / Tập điểm', value: target }],
        };
      }
      if (bpMode === 'update') {
        const fields = [
          { label: 'Số HĐ / Tập điểm', value: target },
          { label: 'Tình trạng mới', value: getByPassTypeLabel(ctx.typeByPass || 'Bo Gong') },
        ];
        if (ctx.contentByPass) fields.push({ label: 'Lý do ByPass', value: ctx.contentByPass });
        if (ctx.accByPass) fields.push({ label: 'NV kỹ thuật', value: ctx.accByPass });
        return {
          status: 'ok',
          mode: 'demo',
          title: `Đã cập nhật ByPass (${target}) (Dữ liệu mô phỏng)`,
          message: 'Lệnh mô phỏng thành công: Lưu thay đổi ByPass thành công.',
          summaryFields: fields,
        };
      }
      const fields = [
        { label: 'Loại', value: ctx.choice || 'Hợp đồng' },
        { label: 'Số HĐ / Tập điểm', value: target },
        {
          label: 'Tình trạng ByPass',
          value: getByPassTypeLabel(ctx.typeByPass || 'Bo Gong Tam va Phai Xu Ly Gong Lai'),
        },
      ];
      if (ctx.contentByPass) fields.push({ label: 'Lý do ByPass', value: ctx.contentByPass });
      if (ctx.accByPass) fields.push({ label: 'NV kỹ thuật', value: ctx.accByPass });
      return {
        status: 'ok',
        mode: 'demo',
        title: `Đã lưu ByPass (${target}) (Dữ liệu mô phỏng)`,
        message: 'Lệnh mô phỏng thành công: Đã thêm mới CheckList ByPass.',
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
function normalizeBoxMac(raw) {
  return String(raw || '')
    .replace(/[\s:-]+/g, '')
    .trim()
    .toUpperCase();
}

/**
 * Kiem tra quy tac MAC Box moi giong trang ReplaceMAC cua Inside:
 * 12 ky tu (khong co FBOX o dau) hoac 16 ky tu (bat dau bang FBOX).
 */
function validateBoxNewMac(raw) {
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
async function fetchInsideBoxMacs(rawContractId, ctx = {}) {
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
          IdContract: '900000001',
          MacNew: '',
        },
        {
          MAC: 'A42B8C109E4F',
          Contract: contractId,
          IdContract: '900000001',
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
function formatInsideTimestamp(raw) {
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
function parseBoxMacLogItems(json) {
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
async function fetchInsideBoxMacLogs(rawContractId, ctx = {}) {
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
function parseReplaceMacBoxResponse({
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
function parseOltListResponse(rawText) {
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
function isExtendedPortOlt(oltName) {
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
function parseRadiusOltFromText(rawText) {
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
function findMatchingOltOption(oltList, oltPop) {
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
function parseLocationsFromMonitorHtml(htmlText) {
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
function parseOltPortsFromHtml(htmlText) {
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
function extractJsAlertMessages(htmlText) {
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
function parseClearSerialResponse({
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
async function fetchInsideOltListByLocation(
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
        { id: '101', name: 'DEMO-OLT-01GC16' },
        { id: '102', name: 'DEMO-OLT-02GC14' },
        { id: '103', name: 'DEMO-OLT-03GP08' },
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
async function fetchInsideOltInit({ forceRefresh = false, forceDemo = false } = {}) {
  if (!isUserscriptEnv() || forceDemo) {
    const demoOltsRes = await fetchInsideOltListByLocation('64', { forceDemo: true });
    return {
      status: 'ok',
      mode: 'demo',
      locations: [
        {
          id: '64',
          name: 'SGN - Khu vực mẫu (Mô phỏng)',
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
function getByPassTypeLabel(rawType) {
  const clean = String(rawType || '').trim();
  const matched = BYPASS_TYPE_OPTIONS.find((opt) => opt.value === clean);
  return matched ? matched.label : clean || '—';
}

function parseByPassDeleteAllowedUsers(html) {
  const match = String(html || '').match(
    /if\s*\(([^)]+)\)\s*\{\s*CN\.push\(\s*['"]destroy['"]\s*\)/i
  );
  if (!match || !match[1]) return [];
  const users = [];
  const eqRe = /UseCN\s*===?\s*['"]([^'"]+)['"]/gi;
  let m;
  while ((m = eqRe.exec(match[1])) !== null) {
    if (m[1]) users.push(m[1].trim());
  }
  return users;
}
function parseByPassPageMeta(htmlText) {
  const html = typeof htmlText === 'string' ? htmlText : '';
  const accLeaderMatch = html.match(/e\[["']AccLeaderByPass["']\]\s*=\s*["']([^"']+)["']/i);
  const useCnMatch = html.match(/\bvar\s+UseCN\s*=\s*["']([^"']*)["']/i);
  const useDqMatch = html.match(/\bvar\s+UseDQ\s*=\s*["']([^"']*)["']/i);
  const currentUser = (
    (accLeaderMatch && accLeaderMatch[1]) ||
    (useCnMatch && useCnMatch[1]) ||
    (useDqMatch && useDqMatch[1]) ||
    ''
  ).trim();

  const isInsertMatch = html.match(/\bvar\s+isInsert\s*=\s*["']([^"']*)["']/i);
  const isInsert = isInsertMatch ? !/^false$/i.test(isInsertMatch[1].trim()) : true;
  const deleteAllowedUsers = parseByPassDeleteAllowedUsers(html);
  const canDelete = Boolean(currentUser) && deleteAllowedUsers.includes(currentUser);

  let defaultFlagByPass = '';
  const loadTypeIdx = html.search(/function\s+LoadType\s*\(/i);
  if (loadTypeIdx >= 0) {
    const loadTypeSlice = html.slice(loadTypeIdx, loadTypeIdx + 2000);
    const valMatch = loadTypeSlice.match(/\b(?:value|Value)\s*:\s*["']([^"']*)["']/);
    if (valMatch) {
      defaultFlagByPass = valMatch[1].trim();
    }
  }

  let contractTypeView = '1';
  const loadTypeViewIdx = html.search(/function\s+LoadTypeView\s*\(/i);
  if (loadTypeViewIdx >= 0) {
    const slice = html.slice(loadTypeViewIdx, loadTypeViewIdx + 2500);
    const contractItemMatch = slice.match(
      /\{[^{}]*?(?:H[oợ]p\s*[đd][oồ]ng|Contract)[^{}]*?\}/i
    );
    if (contractItemMatch) {
      const idMatch = contractItemMatch[0].match(/\b(?:value|Value)\s*:\s*["']?([^"',}\s]+)["']?/i);
      if (idMatch && idMatch[1]) {
        contractTypeView = idMatch[1].trim();
      }
    }
  }

  return {
    currentUser,
    isInsert,
    canDelete,
    deleteAllowedUsers,
    defaultFlagByPass,
    contractTypeView,
  };
}
function validateByPassPayload({
  mode = 'create',
  choice = 'Hợp đồng',
  contract = '',
  accByPass = '',
  typeByPass = '',
  contentByPass = '',
  oldAccByPass = '',
  oldTypeByPass = '',
  oldContentByPass = '',
} = {}) {
  const cleanContract = String(contract || '').trim();
  if (cleanContract.length < 3) {
    return {
      valid: false,
      error: 'Vui lòng nhập Số hợp đồng hoặc mã Tập điểm hợp lệ.',
    };
  }
  if (mode === 'delete') {
    return { valid: true, contract: cleanContract };
  }

  const cleanChoice = String(choice || '').trim() || 'Hợp đồng';
  if (mode === 'create' && cleanChoice !== 'Hợp đồng' && cleanChoice !== 'Tập điểm') {
    return {
      valid: false,
      error: 'Loại ByPass chỉ nhận "Hợp đồng" hoặc "Tập điểm".',
    };
  }

  const cleanAcc = String(accByPass || '').trim();
  if (!cleanAcc || !cleanAcc.includes('@')) {
    return {
      valid: false,
      error: 'Email nhân viên kỹ thuật chưa đúng định dạng (phải chứa ký tự @).',
    };
  }

  const cleanType = String(typeByPass || '').trim();
  const validTypes = BYPASS_TYPE_OPTIONS.map((t) => t.value);
  if (!validTypes.includes(cleanType)) {
    return {
      valid: false,
      error: 'Vui lòng chọn Tình trạng ByPass hợp lệ.',
    };
  }

  const cleanContent = cleanType === 'Gong' ? '' : String(contentByPass || '').trim();
  if (cleanType !== 'Gong' && !cleanContent) {
    return {
      valid: false,
      error: 'Vui lòng chọn Lý do ByPass trước khi lưu.',
    };
  }

  if (
    mode === 'update' &&
    cleanAcc === String(oldAccByPass || '').trim() &&
    cleanType === String(oldTypeByPass || '').trim() &&
    cleanContent === String(oldContentByPass || '').trim()
  ) {
    return {
      valid: false,
      error: 'Vui lòng thay đổi ít nhất một thông tin trước khi lưu cập nhật.',
    };
  }

  return {
    valid: true,
    choice: cleanChoice,
    contract: cleanContract,
    accByPass: cleanAcc,
    typeByPass: cleanType,
    contentByPass: cleanContent,
  };
}
function parseByPassListRows(rawText) {
  let data = rawText;
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (!trimmed || trimmed === '[]') return [];
    try {
      data = JSON.parse(trimmed);
      if (typeof data === 'string') {
        data = JSON.parse(data);
      }
    } catch {
      return [];
    }
  }
  if (!Array.isArray(data)) return [];
  return data
    .filter((row) => row && typeof row === 'object')
    .map((row) => {
      const flagByPass = nonEmptyStr(row.FlagByPass || row.TypeByPass);
      return {
        stt: nonEmptyStr(row.STT),
        district: nonEmptyStr(row.BillTo_District),
        contract: nonEmptyStr(row.Contract),
        accCreateByPass: nonEmptyStr(row.AccCreateByPass),
        accLeaderByPass: nonEmptyStr(row.AccLeaderByPass),
        accByPass: nonEmptyStr(row.AccByPass),
        flagByPass,
        flagByPassLabel: getByPassTypeLabel(flagByPass),
        date: nonEmptyStr(row.Date),
        updateDate: nonEmptyStr(row.UpdateDate),
        content: nonEmptyStr(row.Content || row.ContentByPass),
      };
    });
}

function unwrapByPassTextResponse(rawText) {
  let msg = typeof rawText === 'string' ? rawText.trim() : String(rawText ?? '').trim();
  if (msg.startsWith('"') && msg.endsWith('"')) {
    try {
      const parsed = JSON.parse(msg);
      if (typeof parsed === 'string') {
        msg = parsed.trim();
      }
    } catch {
      // keep raw
    }
  }
  return msg;
}
function parseByPassInsertResponse(rawText, contractId = '') {
  const msg = unwrapByPassTextResponse(rawText).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!msg) {
    return {
      status: 'error',
      mode: 'live',
      title: 'Lưu ByPass chưa có phản hồi',
      message: 'Máy chủ mvc.inside.fpt.net trả về phản hồi trống khi lưu CheckList ByPass.',
    };
  }
  if (
    /không có quyền|no\s*permis|không tồn tại|không thành công|lỗi|error|vui lòng nhập|không đúng/i.test(
      msg
    ) &&
    !/thành công/i.test(msg)
  ) {
    return {
      status: 'error',
      mode: 'live',
      title: 'Lưu ByPass chưa thành công',
      message: msg,
    };
  }
  return {
    status: 'ok',
    mode: 'live',
    title: `Đã lưu ByPass (${contractId})`,
    message: `Chi tiết: ${msg}`,
    summaryFields: [
      { label: 'Số HĐ / Tập điểm', value: String(contractId || '—') },
      { label: 'Phản hồi hệ thống', value: msg },
    ],
  };
}
function parseByPassUpdateResponse(rawText, contractId = '') {
  const cleaned = unwrapByPassTextResponse(rawText);
  if (!cleaned || cleaned === '[]') {
    return {
      status: 'error',
      mode: 'live',
      title: 'Cập nhật ByPass thất bại',
      message: 'Lưu không thành công!',
    };
  }
  if (cleaned === '-1') {
    return {
      status: 'error',
      mode: 'live',
      title: 'Chưa đủ điều kiện ByPass',
      message:
        'Công suất thu (RX) hoặc công suất phát (TX) hoặc Lastmile của hợp đồng không đạt chuẩn. Vui lòng xử lý trước khi chuyển trạng thái ByPass!',
    };
  }
  if (cleaned === '-2') {
    return {
      status: 'error',
      mode: 'live',
      title: 'Tập điểm chưa đạt chuẩn công suất',
      message:
        'Công suất thu (RX) của tập điểm không đạt chuẩn. Vui lòng xử lý trước khi chuyển trạng thái ByPass!',
    };
  }
  if (/no\s*permis|không có quyền/i.test(cleaned)) {
    return {
      status: 'error',
      mode: 'live',
      title: 'Không có quyền cập nhật',
      message: 'Bạn không có quyền thực hiện thao tác này!',
    };
  }
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed[0] && parsed[0].UpdateDate !== undefined) {
      const updateDate = nonEmptyStr(parsed[0].UpdateDate);
      return {
        status: 'ok',
        mode: 'live',
        title: `Đã cập nhật ByPass (${contractId})`,
        message: 'Lưu thay đổi thành công!',
        updateDate,
        summaryFields: [
          { label: 'Số HĐ / Tập điểm', value: String(contractId || '—') },
          ...(updateDate ? [{ label: 'Ngày cập nhật', value: updateDate }] : []),
        ],
      };
    }
  } catch {
    // fallback below
  }
  return {
    status: 'error',
    mode: 'live',
    title: 'Cập nhật ByPass chưa thành công',
    message: `Lỗi: ${cleaned}`,
  };
}
function parseByPassDeleteResponse(rawText, contractId = '') {
  const cleaned = unwrapByPassTextResponse(rawText);
  const numericVal = Number(cleaned);
  if (cleaned !== '' && !Number.isNaN(numericVal) && numericVal > 0) {
    return {
      status: 'ok',
      mode: 'live',
      title: `Đã xóa ByPass (${contractId})`,
      message: 'Xóa dòng ByPass thành công!',
      summaryFields: [{ label: 'Số HĐ / Tập điểm', value: String(contractId || '—') }],
    };
  }
  if (cleaned === '0') {
    return {
      status: 'error',
      mode: 'live',
      title: 'Xóa ByPass thất bại',
      message: 'Xóa không thành công!',
    };
  }
  return {
    status: 'error',
    mode: 'live',
    title: 'Xóa ByPass chưa thành công',
    message: `Lỗi: ${cleaned || 'Không rõ phản hồi từ máy chủ.'}`,
  };
}

function formatInsideDateDMY(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function readInsideUserFromDomFallback() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return '';
  }
  const wins = [window];
  try {
    if (window.top) wins.push(window.top);
    const len = window.top && window.top.frames ? Math.min(window.top.frames.length, 12) : 0;
    for (let i = 0; i < len; i += 1) {
      wins.push(window.top.frames[i]);
    }
  } catch {
    // ignore cross-origin frames
  }
  const visited = new Set();
  for (const w of wins) {
    if (!w || visited.has(w)) continue;
    visited.add(w);
    try {
      const bodyText =
        w.document && w.document.body ? w.document.body.textContent || '' : '';
      const m = bodyText.match(/Xin\s*ch[aà]o\s*:\s*([A-Za-z0-9._-]+)/i);
      if (m && m[1]) {
        return m[1].trim();
      }
    } catch {
      // ignore cross-origin frame access
    }
  }
  return '';
}
async function fetchInsideByPassMeta({ forceRefresh = false, forceDemo = false } = {}) {
  if (!isUserscriptEnv() || forceDemo) {
    return {
      status: 'ok',
      mode: 'demo',
      meta: {
        currentUser: 'Demo.User',
        isInsert: true,
        canDelete: false,
        deleteAllowedUsers: [],
        defaultFlagByPass: '',
        contractTypeView: '1',
      },
    };
  }

  if (
    !forceRefresh &&
    INSIDE_BYPASS_META_CACHE.meta &&
    Date.now() < INSIDE_BYPASS_META_CACHE.expiresAt
  ) {
    return { status: 'ok', mode: 'live', meta: INSIDE_BYPASS_META_CACHE.meta };
  }

  const fetchPage = () =>
    requestPortal({
      url: INSIDE_ENDPOINTS.bypass.page,
      method: 'GET',
      timeout: 15000,
    });

  let res = await fetchPage();

  if (res.error === 'NETWORK_ERROR' || res.error === 'TIMEOUT' || res.status === 0) {
    return {
      status: 'error',
      message: 'Không kết nối được tới trang CheckList ByPass (mvc.inside.fpt.net). Hãy kiểm tra VPN.',
      loginUrl: PORTALS.inside.url,
    };
  }

  let iam = detectIamRedirect({
    status: res.status,
    finalUrl: res.finalUrl,
    responseText: res.responseText,
    requestedUrl: INSIDE_ENDPOINTS.bypass.page,
  });
  if (iam.expired && canWarmPortalSession()) {
    const warm = await warmPortalSession('http://mvc.inside.fpt.net/', { timeout: 12000 });
    if (warm && warm.ok) {
      res = await fetchPage();
      if (res.error === 'NETWORK_ERROR' || res.error === 'TIMEOUT' || res.status === 0) {
        return {
          status: 'error',
          message:
            'Không kết nối được tới trang CheckList ByPass (mvc.inside.fpt.net). Hãy kiểm tra VPN.',
          loginUrl: PORTALS.inside.url,
        };
      }
      iam = detectIamRedirect({
        status: res.status,
        finalUrl: res.finalUrl,
        responseText: res.responseText,
        requestedUrl: INSIDE_ENDPOINTS.bypass.page,
      });
    }
  }
  if (iam.expired) {
    INSIDE_BYPASS_META_CACHE.meta = null;
    INSIDE_BYPASS_META_CACHE.expiresAt = 0;
    return {
      status: 'iam_expired',
      message: 'Phiên đăng nhập IAM đã hết hạn. Bấm nút bên dưới để đăng nhập lại.',
      loginUrl: PORTALS.inside.url,
    };
  }

  if (!res.ok) {
    return {
      status: 'error',
      message: `CheckList ByPass trả về mã HTTP ${res.status}.`,
      loginUrl: PORTALS.inside.url,
    };
  }

  const meta = parseByPassPageMeta(res.responseText);
  if (!meta.currentUser) {
    meta.currentUser = readInsideUserFromDomFallback();
    meta.canDelete =
      Boolean(meta.currentUser) &&
      Array.isArray(meta.deleteAllowedUsers) &&
      meta.deleteAllowedUsers.includes(meta.currentUser);
  }
  INSIDE_BYPASS_META_CACHE.meta = meta;
  INSIDE_BYPASS_META_CACHE.expiresAt = Date.now() + 10 * 60 * 1000;
  return { status: 'ok', mode: 'live', meta };
}
async function searchInsideByPass(rawQuery, { forceDemo = false } = {}) {
  const query = String(rawQuery || '').trim();
  if (!query) {
    return { status: 'ok', rows: [] };
  }

  if (!isUserscriptEnv() || forceDemo) {
    await sleep(200);
    return {
      status: 'ok',
      mode: 'demo',
      meta: {
        currentUser: 'Demo.User',
        isInsert: true,
        canDelete: false,
        deleteAllowedUsers: [],
        defaultFlagByPass: '',
        contractTypeView: '1',
      },
      rows: [
        {
          stt: '1',
          district: 'Quận 1 (Mẫu)',
          contract: query,
          accCreateByPass: 'Demo.User',
          accLeaderByPass: 'Demo.User',
          accByPass: 'nvkt.demo@fpt.com',
          flagByPass: 'Bo Gong Tam va Phai Xu Ly Gong Lai',
          flagByPassLabel: getByPassTypeLabel('Bo Gong Tam va Phai Xu Ly Gong Lai'),
          date: formatInsideDateDMY(),
          updateDate: '',
          content: 'Loi ha tang suy hao',
        },
      ],
    };
  }

  const metaRes = await fetchInsideByPassMeta();
  if (metaRes.status !== 'ok') {
    return metaRes;
  }
  const meta = metaRes.meta || {};
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const params = new URLSearchParams({
    location: '',
    // Luu y: API LoadListContract cua FPT dat nguoc toDate (dau thang) va fromDate (hom nay)
    toDate: formatInsideDateDMY(firstOfMonth),
    fromDate: formatInsideDateDMY(now),
    flagByPass: meta.defaultFlagByPass || '',
    typeView: meta.contractTypeView || '1',
    txtSearch: query,
  });
  const searchUrl = `${INSIDE_ENDPOINTS.bypass.search}?${params.toString()}`;
  const res = await requestPortal({
    url: searchUrl,
    method: 'GET',
    headers: {
      Accept: 'text/html, application/json, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
    },
    timeout: 15000,
  });

  if (res.error === 'NETWORK_ERROR' || res.error === 'TIMEOUT' || res.status === 0) {
    return {
      status: 'error',
      message: 'Không kết nối được tới LoadListContract. Hãy kiểm tra VPN.',
      loginUrl: PORTALS.inside.url,
    };
  }

  const iam = detectIamRedirect({
    status: res.status,
    finalUrl: res.finalUrl,
    responseText: res.responseText,
    requestedUrl: searchUrl,
  });
  if (iam.expired) {
    INSIDE_BYPASS_META_CACHE.meta = null;
    INSIDE_BYPASS_META_CACHE.expiresAt = 0;
    return {
      status: 'iam_expired',
      message: 'Phiên đăng nhập IAM đã hết hạn. Bấm nút bên dưới để đăng nhập lại.',
      loginUrl: PORTALS.inside.url,
    };
  }

  if (!res.ok) {
    return {
      status: 'error',
      message: `LoadListContract trả về mã HTTP ${res.status}.`,
      loginUrl: PORTALS.inside.url,
    };
  }

  return {
    status: 'ok',
    mode: 'live',
    meta,
    rows: parseByPassListRows(res.responseText),
  };
}

async function runInsideByPassLive(rawContractId, ctx = {}) {
  const mode = ctx.mode || 'create';
  const v = validateByPassPayload({
    mode,
    choice: ctx.choice || 'Hợp đồng',
    contract: ctx.contract || rawContractId || '',
    accByPass: ctx.accByPass || '',
    typeByPass: ctx.typeByPass || '',
    contentByPass: ctx.contentByPass || '',
    oldAccByPass: ctx.oldAccByPass || '',
    oldTypeByPass: ctx.oldTypeByPass || '',
    oldContentByPass: ctx.oldContentByPass || '',
  });
  if (!v.valid) {
    return {
      status: 'validation_error',
      message: v.error,
    };
  }

  let accLeaderByPass = String(ctx.accLeaderByPass || '').trim();
  if (mode === 'create' && !accLeaderByPass) {
    const metaRes = await fetchInsideByPassMeta();
    if (metaRes.status !== 'ok') {
      return metaRes;
    }
    accLeaderByPass = (metaRes.meta && metaRes.meta.currentUser) || readInsideUserFromDomFallback();
  }

  let res;
  let requestedUrl = INSIDE_ENDPOINTS.bypass.insert;
  if (mode === 'create') {
    const body = JSON.stringify({
      lines: [
        {
          Choice: v.choice,
          Contract: v.contract,
          AccLeaderByPass: accLeaderByPass,
          AccByPass: v.accByPass,
          TypeByPass: v.typeByPass,
          ContentByPass: v.contentByPass,
        },
      ],
    });
    res = await requestPortal({
      url: requestedUrl,
      method: 'POST',
      headers: {
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
      },
      data: body,
      timeout: 15000,
    });
  } else if (mode === 'update') {
    const qs = new URLSearchParams({
      Contract: v.contract,
      FlagByPass: v.typeByPass,
      AccByPass: v.accByPass,
      FlagByPassold: String(ctx.oldTypeByPass || ''),
      Content: v.contentByPass,
      oldContent: String(ctx.oldContentByPass || ''),
    }).toString();
    requestedUrl = `${INSIDE_ENDPOINTS.bypass.update}?${qs}`;
    res = await requestPortal({
      url: requestedUrl,
      method: 'GET',
      headers: {
        Accept: 'text/html, application/json, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
      },
      timeout: 15000,
    });
  } else {
    const qs = new URLSearchParams({ Contract: v.contract }).toString();
    requestedUrl = `${INSIDE_ENDPOINTS.bypass.remove}?${qs}`;
    res = await requestPortal({
      url: requestedUrl,
      method: 'GET',
      headers: {
        Accept: 'text/html, application/json, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
      },
      timeout: 15000,
    });
  }

  if (res.error === 'NETWORK_ERROR' || res.error === 'TIMEOUT' || res.status === 0) {
    return {
      status: 'error',
      message: 'Không kết nối được tới máy chủ ByPass (mvc.inside.fpt.net). Hãy kiểm tra VPN.',
      loginUrl: PORTALS.inside.url,
    };
  }

  const iam = detectIamRedirect({
    status: res.status,
    finalUrl: res.finalUrl,
    responseText: res.responseText,
    requestedUrl,
  });
  if (iam.expired) {
    INSIDE_BYPASS_META_CACHE.meta = null;
    INSIDE_BYPASS_META_CACHE.expiresAt = 0;
    return {
      status: 'iam_expired',
      message: 'Phiên đăng nhập IAM đã hết hạn. Bấm nút bên dưới để đăng nhập lại.',
      loginUrl: PORTALS.inside.url,
    };
  }

  if (!res.ok) {
    return {
      status: 'error',
      message: `Máy chủ CheckList ByPass trả về mã HTTP ${res.status}.`,
      loginUrl: PORTALS.inside.url,
    };
  }

  if (mode === 'create') {
    return parseByPassInsertResponse(res.responseText, v.contract);
  }
  if (mode === 'update') {
    return parseByPassUpdateResponse(res.responseText, v.contract);
  }
  return parseByPassDeleteResponse(res.responseText, v.contract);
}

/**
 * Thuc thi mot lenh tren inside.fpt.net.
 */
async function runInsideAction(actionId, rawContractId, ctx = {}) {
  const portal = PORTALS.inside;

  if (actionId === 'clear_osp') {
    const contractId = normalizeContractId(rawContractId || '');
    if (!isUserscriptEnv() || ctx.forceDemo) {
      await sleep(350);
      return buildInsideMockResult('clear_osp', contractId, ctx);
    }
    return clearOspLive(contractId, ctx);
  }

  if (actionId === 'bypass') {
    const targetContract = String(ctx.contract || rawContractId || '').trim();
    if (!isUserscriptEnv() || ctx.forceDemo) {
      await sleep(350);
      return buildInsideMockResult('bypass', targetContract, ctx);
    }
    return runInsideByPassLive(rawContractId, ctx);
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

// --- adapters/deployment.js ---
/**
 * Adapter thao tac Phieu trien khai FOX-ERP (fox-erp.fpt.net & partner.fpt.net).
 * Chay truc tiep qua VPN & phien IAM hien tai, khong luu mat khau hay x-resource-grant xuong bo nho.
 */
const DEPLOYMENT_ENDPOINTS = {
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
const DEPLOYMENT_EQUIPMENT_TYPE = {
  DEPLOY: 1,
  REVOKE: 2,
  EXTRA: 3,
};
const DEPLOYMENT_CAMERA_PHONE_TYPE = 96;
const DEPLOYMENT_CATALOG_KEYS = {
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
function extractDeploymentTicketLink(partnerData) {
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
function extractHashFromLocation(loc) {
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
function parseDataFilterOptions(dataFilter, parentName) {
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
function findDataFilterText(dataFilter, parentName, code) {
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
function normalizeTicketSummary(contractData, selectedSupId = 0) {
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
function normalizeEquipmentList(rows) {
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
function validateConstructionUpdate({ outDoorReUsed, descriptionRD } = {}) {
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
function buildCompletedPayload({
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
async function postFoxJson(
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
  if (canWarmPortalSession()) {
    await warmPortalSession(warmupUrl, { timeout: 12000 });
  } else {
    await requestPortal({ url: warmupUrl, method: 'GET', timeout: 10000 });
  }
  return postFoxJson(url, bodyObj, opts);
}
async function fetchDeploymentTicket(
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
async function fetchDeploymentEquipments({ objId, supId, grant = '', forceDemo = false } = {}) {
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
async function clearDeploymentTicketMac({ objId, supId, grant = '', forceDemo = false } = {}) {
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
async function fetchDeploymentModemMetrics({ contract, grant = '', forceDemo = false } = {}) {
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
async function fetchDeploymentPhones({ contract, objId, grant = '', forceDemo = false } = {}) {
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
async function revealDeploymentPhone({ token, objId, supId, grant = '', forceDemo = false } = {}) {
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
function normalizePaymentInfo(raw) {
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
async function fetchDeploymentPayment({ objId, supId, grant = '', forceDemo = false } = {}) {
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
function validateCameraPhoneNumber(raw) {
  const value = String(raw ?? '').trim();
  if (!value) {
    return { valid: false, value: '', error: 'Vui lòng nhập số điện thoại CMR mới.' };
  }
  if (!/^\d+$/.test(value)) {
    return { valid: false, value, error: 'Số điện thoại CMR chỉ được gồm chữ số.' };
  }
  return { valid: true, value, error: '' };
}
function canEditDeploymentCameraPhone(phoneItem, summary) {
  if (!phoneItem || !summary) return false;
  return (
    Number(phoneItem.Type) === DEPLOYMENT_CAMERA_PHONE_TYPE &&
    Boolean(phoneItem.PhoneToken) &&
    Number(summary.statusContract) === 1 &&
    Boolean(summary.ticket && summary.ticket.supId)
  );
}
async function updateDeploymentCameraPhone({
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
async function fetchDeploymentEContracts({ objId, grant = '', forceDemo = false } = {}) {
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
async function signDeploymentEContract({
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
async function syncDeploymentOnline({
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
async function updateDeploymentConstruction({
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
async function completeDeploymentTicket({
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

// --- adapters/port.js ---
/**
 * Adapter xu ly nghiep vu FTTH NEW Port cho cong port.fpt.net / mvcport.fpt.net:
 * - Xem Port hien tai (Index_Search + Insert/<ID> / LoadData)
 * - Cap / Doi Port (Cascade Vung -> Chi nhanh -> POP -> Hop dau noi -> Port + Lich su Port)
 * - Thu hoi Port (Insert_UpdateContact voi status=6)
 */
const PORT_ENDPOINTS = {
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
function decodeHtmlEntities(text) {
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
function clearPortContractCache(rawContractId) {
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
function parseMvcPortTokenFromCookieString(rawCookies) {
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
function extractMvcPortTokenFromText(text) {
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
function buildPortUrl(rawUrl) {
  return appendPortTokenToUrl(rawUrl, getMvcPortTokenFromPage());
}
async function bootstrapMvcPortSession() {
  if (!isUserscriptEnv()) {
    return { ok: false, reason: 'preview' };
  }
  if (portBootstrapInFlight) {
    return portBootstrapInFlight;
  }

  portBootstrapInFlight = (async () => {
    async function fetchTokenFromPortIndex(allowWarmup = true) {
      const idxRes = await requestPortal({
        url: PORT_ENDPOINTS.portIndexPage,
        method: 'GET',
        timeout: 8000,
      });
      const idxFinalUrl = String((idxRes && idxRes.finalUrl) || '');
      const idxBody = String((idxRes && idxRes.responseText) || '');
      const redirectedToAuth =
        /\/LoginPage\.aspx(?:\?|$|#)/i.test(idxFinalUrl) ||
        /https?:\/\/[^/]*(?:iam|sso|login|auth|signin|oauth|cas)/i.test(idxFinalUrl) ||
        /<input[^>]+type\s*=\s*["']?password["']?/i.test(idxBody);
      if (!idxRes || !idxRes.ok || redirectedToAuth) {
        if (redirectedToAuth && allowWarmup && canWarmPortalSession()) {
          const warm = await warmPortalSession(PORTALS.port.url, { timeout: 12000 });
          if (warm && warm.ok) {
            return fetchTokenFromPortIndex(false);
          }
        }
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
function triggerPortFtthMenuAction(win = typeof window !== 'undefined' ? window : null) {
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
function detectPortSessionExpired(res, requestedUrl) {
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
function parseDropdownOptions(json) {
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
function parseConboxParamsFromLibJs(jsText) {
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
function parsePortContractDetailHtml(htmlText) {
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
function parsePortOptionsFromHtml(rawResponse) {
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
function parsePortHistoryRows(json) {
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
function parsePortMutationResponse(rawText, actionLabel, contractId) {
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
async function fetchPortLocations({ forceRefresh = false, forceDemo = false } = {}) {
  if (!isUserscriptEnv() || forceDemo) {
    return {
      status: 'ok',
      locations: [{ value: '35', label: 'SGN - Khu vực mẫu (Mẫu)' }],
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
async function fetchPortBranches(locationId, { forceDemo = false } = {}) {
  if (!isUserscriptEnv() || forceDemo) {
    return {
      status: 'ok',
      branches: [{ value: '1', label: 'Chi nhánh mẫu (Mẫu)' }],
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
async function fetchPortPops(locationId, branchId, { forceDemo = false } = {}) {
  if (!isUserscriptEnv() || forceDemo) {
    return {
      status: 'ok',
      pops: [
        { value: '101', label: 'DEMO-POP-01' },
        { value: '102', label: 'DEMO-POP-02' },
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
async function fetchPortConboxes(popName, { forceDemo = false } = {}) {
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
async function fetchPortSlotList(deviceId, { forceDemo = false } = {}) {
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
async function fetchPortHistory({ pointName = '', port = '', locationID = '', forceDemo = false } = {}) {
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
          createBy: 'KTV.Mau01',
          port: port || 'Port 04',
          ip: '10.10.20.5',
          action: 'Thu hồi port',
          contractName: 'SGN123456',
          data: 'Status=6 (Đã thu hồi port)',
        },
        {
          stt: '2',
          actionDate: '11/21/2026 08:49:42',
          createBy: 'KTV.Mau02',
          port: port || 'Port 04',
          ip: '10.10.20.5',
          action: 'Cấp mới port',
          contractName: 'SGN123456',
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
    sourceUrl: `${PORT_ENDPOINTS.insertPage}/900001`,
    detail: {
      id: '900001',
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
      address: '123 Đường Mẫu, Quận 1, TP. Hồ Chí Minh',
      email: '',
      handphone: '',
      telephone: '',
      localType: '188',
      cardNumber: '1',
      description: '',
      createBy: 'KTV.Mau02',
      createDate: '11/21/2026 8:49:42 AM',
      updateBy: 'KTV.Mau01',
      updateDate: '11/23/2026 11:38:42 AM',
      tstc: 'DEMO-OLT-01GC16 • SPL-07 • Port 04 (Mẫu)',
      pc: 'DEMO-POP-01 • PON 0/8 • VLAN 188 (Mẫu)',
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
    locations: [{ value: '35', label: 'SGN - Khu vực mẫu (Mẫu)' }],
    defaultLocationId: '35',
    branches: [{ value: '1', label: 'Chi nhánh mẫu (Mẫu)' }],
    defaultBranchId: '1',
  };
}

/**
 * Tai day du thong tin Port hien tai cua hop dong tren mvcport.fpt.net (Index_Search + Insert/<ID> hoac LoadData).
 */
async function fetchPortContractContext(
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
          { label: 'Thông số Tập điểm / Port', value: 'DEMO-OLT-01GC16 • SPL-07 • Port 04' },
          { label: 'Thông số kết nối', value: 'DEMO-POP-01 • PON 0/8 • VLAN 188' },
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
          { label: 'Tập điểm / Hộp đấu nối', value: ctx.deviceName || 'DEMO-POP-01-SPL-01' },
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
async function runPortAction(actionId, rawContractId, ctx = {}) {
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

// --- adapters/portals.js ---
/**
 * Bo dieu phoi thao tac chung cho ca 5 cong noi bo FPT.
 */




function buildPlannedDemoResult(portal, action, contractId) {
  if (action.id.startsWith('lookup') || action.id.startsWith('check')) {
    return {
      status: 'ok',
      mode: 'demo',
      title: `${action.label} — ${contractId} (Dữ liệu mô phỏng)`,
      message: `Đang xem thử giao diện cho cổng ${portal.fullName}. Sau khi xong Inside sẽ ghép nối chạy thật cổng này.`,
      summaryFields: [
        { label: 'Cổng dịch vụ', value: portal.fullName },
        { label: 'Mã hợp đồng', value: contractId },
        { label: 'Trạng thái tích hợp', value: 'Chờ ghép API ở đợt tiếp theo' },
        { label: 'Ghi chú', value: 'Dữ liệu mô phỏng để kiểm tra thao tác trên điện thoại' },
      ],
    };
  }

  return {
    status: 'ok',
    mode: 'demo',
    title: `Đã chạy thử "${action.label}" cho ${contractId} (Dữ liệu mô phỏng)`,
    message: `Lệnh mô phỏng trên ${portal.fullName} hoàn tất. Khi ghép nối thật, thao tác sẽ chạy trực tiếp qua VPN & IAM.`,
  };
}

/**
 * Thuc thi hanh dong tu giao dien cho bat ky portal nao trong 5 cong.
 */
async function executePortalAction(portalId, actionId, rawContractId, ctx = {}) {
  const portal = PORTALS[portalId];
  if (!portal) {
    return {
      status: 'error',
      message: 'Không tìm thấy cổng công cụ tương ứng.',
    };
  }

  if (portalId === 'inside') {
    return runInsideAction(actionId, rawContractId, ctx);
  }
  if (portalId === 'port') {
    return runPortAction(actionId, rawContractId, ctx);
  }

  const check = validateContractId(rawContractId);
  if (!check.valid) {
    return {
      status: 'validation_error',
      message: check.error,
    };
  }

  const action = portal.actions.find((a) => a.id === actionId);
  if (!action) {
    return {
      status: 'error',
      message: 'Thao tác không hợp lệ trên cổng này.',
    };
  }

  const contractId = check.value;

  if (!isUserscriptEnv() || ctx.forceDemo) {
    await sleep(350);
    return buildPlannedDemoResult(portal, action, contractId);
  }

  const session = await checkPortalSession(portal);
  if (session.state === 'iam_expired') {
    return {
      status: 'iam_expired',
      message: `Phiên đăng nhập IAM cho ${portal.fullName} đã hết hạn. Bấm nút bên dưới để đăng nhập lại.`,
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
    message: `Đã xác nhận kết nối tới ${portal.fullName} (IAM hợp lệ). Cổng này đang chờ ghép nối ở đợt tiếp theo — bạn có thể bấm "Quét cấu trúc" ngay hoặc mở nhanh trang gốc với Mã HĐ đã sao chép.`,
    hint: `Mã HĐ ${contractId} đã được lưu vào danh sách gần đây để bạn dán nhanh.`,
    loginUrl: portal.url,
  };
}

// --- ui/app.js ---
/**
 * Giao dien dieu khien Remote Inside (1 man hinh toi uu Android & MacBook).
 * Toan bo chuoi tu nguoi dung deu duoc gan bang textContent de dam bao an toan.
 */








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
function mountRemoteInside({
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
      const candidateScriptUrls = [
        ...(Array.isArray(apiHints.scriptUrls) ? apiHints.scriptUrls : []),
        ...extractNextAppChunkUrls(htmlText, pageHref),
        ...extractSpaChunkUrls(htmlText, pageHref, perfEntries),
      ];
      const seenScripts = new Set();
      const customScriptUrls = [];
      for (const rawUrl of candidateScriptUrls) {
        if (!rawUrl || seenScripts.has(rawUrl) || VENDOR_SCRIPT_RE.test(rawUrl)) {
          continue;
        }
        try {
          const parsed = new URL(rawUrl, pageHref || undefined);
          if (origin && parsed.origin !== origin) {
            continue;
          }
          seenScripts.add(parsed.href);
          customScriptUrls.push(parsed.href);
          if (customScriptUrls.length >= 35) break;
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
            /(?:\$fetch\s*\(|\/api\/|x-resource-grant|setGrant|GET_TICKET_INFO|get-ticket-info|GET_CONFIG_BY_PARENT|get-config-by-parent|GET_EQUIPMENT_ON_DEP|get-equipment-on-dep|CLEAR_EQUIPMENT|clear-equipment|ClearMac|CHANGE_EQUIPMENT|change-equipment|UPDATE_EQUIPMENT_IMPORT|update-equipment-import|UPDATE_EQUIPMENT_REVOKE|update-equipment-revoke|SYNC_ONLINE|sync-online|\/status\/completed|OutDoorReUsed|ReasonDelay|NotComplete|HiFPT|CapLan|reveal-phone|get-contract-phone|get-e-contract-record|sign-econtract|getContract)/i,
            contractId,
            { maxTotal: 55000, maxContexts: 65, radius: 480 }
          );
          if (chunkApiHints.length > 0 || codeContexts.length > 0) {
            collectedSnippets.push({
              score: chunkApiHints.length * 3 + codeContexts.length * 2,
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

    const sheetParts = [
      el('div', { className: 'ri-log-head' }, [
        el('h2', {
          className: 'ri-sheet-title',
          text: isInsideKill
            ? 'Kill Session — Phiên đang chạy'
            : isInsideDeploy
            ? 'Phiếu triển khai FOX-ERP'
            : isInsideBypass
            ? 'CheckList ByPass'
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
      el('p', {
        className: 'ri-sheet-sub',
        text: isInsideKill
          ? 'Kiểm tra đúng IP đang chạy bên dưới rồi chạm nút Kill để ngắt phiên (2 bước xác nhận ngay trên dòng).'
          : isInsideDeploy
          ? 'Thao tác trực tiếp: thông số NET, Clear MAC vật tư, hoàn tất phiếu, SĐT User và Biên bản điện tử.'
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
      text: (isInsideBox && state.boxTab === 'history') || isInsideKill || isInsideDeploy ? 'Đóng' : 'Hủy',
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
              text: 'FOX-ERP / Partner',
              onClick: () =>
                openLogin(DEPLOYMENT_ENDPOINTS.partnerMonitor, 'Đăng nhập FOX-ERP / Partner'),
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
              text: 'Radius',
              onClick: () => openLogin(PORTALS.radius.url, 'Mở cổng Radius'),
            }),
            el('button', {
              type: 'button',
              className: 'ri-secondary-btn',
              text: 'Camera (đăng nhập riêng)',
              onClick: () => openLogin(PORTALS.camera.url, 'Đăng nhập Camera'),
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
  if (standalone) {
    refreshSessionStatus();
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

// --- main.js ---
/**
 * Diem khoi dong cua Remote Inside (tu dong chon che do Userscript tren trang FPT
 * hoac che do xem thu doc lap khi mo preview.html).
 */


function startRadiusParamsBridge() {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !document.body) {
    return false;
  }
  const loc = window.location;
  const hostLower = ((loc && loc.hostname) || '').toLowerCase();
  const pathLower = ((loc && loc.pathname) || '').toLowerCase();

  let inFrame = false;
  try {
    inFrame = window.top !== window.self;
  } catch {
    inFrame = true;
  }

  if (
    !inFrame ||
    !hostLower.endsWith('radius-portal.fpt.net') ||
    !pathLower.startsWith('/public/partial/connection-parameters')
  ) {
    return false;
  }

  let objId = '';
  try {
    const sp = new URLSearchParams(loc.search || '');
    objId = sp.get('ObjID') || sp.get('objId') || sp.get('objid') || '';
  } catch {
    objId = '';
  }

  let lastKey = '';
  let observer = null;
  function tryPost() {
    try {
      const text = document.body.innerText || document.body.textContent || '';
      const parsed = parseRadiusOltFromText(text);
      if (!parsed || !parsed.oltPop) return;
      const nextKey = `${parsed.oltPop}|${parsed.slot}|${parsed.port}|${parsed.onu}|${parsed.ipOlt}`;
      if (nextKey === lastKey) return;
      lastKey = nextKey;
      if (window.parent && typeof window.parent.postMessage === 'function') {
        window.parent.postMessage(
          {
            type: 'RI_RADIUS_OLT_INFO',
            objId: String(objId || '').trim(),
            ...parsed,
          },
          '*'
        );
      }
      if (parsed.oltPop && parsed.ipOlt && observer) {
        observer.disconnect();
        observer = null;
      }
    } catch {
      // Bo qua loi doc/gui thong so tu iframe
    }
  }

  tryPost();

  if (typeof MutationObserver === 'function' && !(lastKey && !lastKey.endsWith('|'))) {
    observer = new MutationObserver(() => {
      tryPost();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    setTimeout(() => {
      try {
        if (observer) {
          observer.disconnect();
          observer = null;
        }
      } catch {
        // ignore
      }
    }, 10000);
  }

  return true;
}

function bootstrapRemoteInside() {
  if (typeof document === 'undefined' || !document.body) {
    return;
  }

  if (startRadiusParamsBridge()) {
    return;
  }

  const cssText =
    typeof __REMOTE_INSIDE_CSS__ !== 'undefined' ? __REMOTE_INSIDE_CSS__ : '';
  const standaloneRoot = document.getElementById('remote-inside-standalone');

  if (standaloneRoot) {
    mountRemoteInside({
      rootContainer: standaloneRoot,
      cssText,
      standalone: true,
      pageWindow: window,
      pageDocument: document,
    });
    return;
  }

  // Bo qua trang <frameset> goc va cac frame menu/tieu de nho
  if (document.body.tagName === 'FRAMESET') {
    return;
  }
  try {
    if (window.top !== window.self) {
      const pathLower = ((window.location && window.location.pathname) || '').toLowerCase();
      if (
        window.innerWidth < 240 ||
        window.innerHeight < 220 ||
        pathLower.startsWith('/public/partial/') ||
        pathLower.startsWith('/iptvinfo/')
      ) {
        return;
      }
    }
  } catch {
    // Bo qua loi cross-origin neu co
  }

  if (document.getElementById('remote-inside-host')) {
    return;
  }

  const host = document.createElement('div');
  host.id = 'remote-inside-host';
  document.body.appendChild(host);

  const isOuterShell =
    window.location &&
    window.location.hostname === 'inside.fpt.net' &&
    window.location.pathname.toLowerCase() === '/default.asp';

  const shadowRoot = host.attachShadow({ mode: 'open' });
  const app = mountRemoteInside({
    rootContainer: shadowRoot,
    cssText,
    standalone: false,
    fabPosition: isOuterShell ? 'bottom-left' : 'bottom-right',
    fabLabelDefault: isOuterShell ? 'Remote Inside (Khung ngoài)' : 'Remote Inside',
    pageWindow: typeof unsafeWindow !== 'undefined' ? unsafeWindow : window,
    pageDocument: document,
  });

  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('Mở Remote Inside', () => app.open());
  }

  if (window.location && window.location.hash === '#remote-inside') {
    app.open();
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapRemoteInside, { once: true });
  } else {
    bootstrapRemoteInside();
  }
}
})();
