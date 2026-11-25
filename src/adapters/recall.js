/**
 * Adapter thao tac Phieu thu hoi vat tu tren NextGen (https://nextgen.fpt.net/resource/recall/*).
 * Ung dung chay Blazor Server (Radzen.Blazor + MudBlazor qua SignalR), nen lop nay doc DOM truc tiep
 * va kich hoat dung control goc (Bam span#equipmentname de sua, nut + tao phieu, nut Them thiet bi...).
 *
 * Luu y Single-IIFE bundle: moi ten ham/hang top-level phai doc nhat trong toan bo src/.
 */

import { CONTRACT_REGEX, normalizeContractId, validateContractId } from '../config/portals.js';
import {
  FOX_ERP_HOME_URL,
  bootstrapNextGenViaFoxErpAndroid,
  canControlAndroidPortal,
  evalAndroidPortalJs,
  isNextGenSessionExpiredDocument,
  isUserscriptEnv,
  loadAndroidPortalBackground,
  sleep,
  warmPortalSession,
} from '../core/transport.js';

export const RECALL_ENDPOINTS = {
  base: 'https://nextgen.fpt.net/resource/recall/',
  rootPath: '/resource/recall',
  ticketPath: '/resource/recall/recall-ticket',
};

const RECALL_GENERIC_TITLES_RE = /^(?:NHAPKHO|THUHOIVATTU|NEXTGEN|RESOURCE|RECALL)$/i;

export function cleanRecallText(raw) {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isRecallPortalLocation(loc) {
  if (!loc) return false;
  const host = String(loc.hostname || '').toLowerCase();
  const path = String(loc.pathname || '').toLowerCase();
  return host === 'nextgen.fpt.net' && path.startsWith(RECALL_ENDPOINTS.rootPath);
}

export function isRecallTicketLocation(loc) {
  if (!loc) return false;
  const host = String(loc.hostname || '').toLowerCase();
  const path = String(loc.pathname || '').toLowerCase();
  return host === 'nextgen.fpt.net' && path.startsWith(RECALL_ENDPOINTS.ticketPath);
}

export function extractRecallFieldAfterLabel(text, labelRegexSource) {
  const clean = cleanRecallText(text);
  if (!clean) return '';
  const stopPattern =
    '(?:Ngày tạo phiếu|Người tạo phiếu|Ngày cập nhật|Người cập nhật|Thông số thi công|$)';
  const re = new RegExp(`${labelRegexSource}\\s*:?\\s*(.*?)\\s*(?=${stopPattern})`, 'i');
  const match = clean.match(re);
  return match && match[1] ? cleanRecallText(match[1]) : '';
}

function getRecallElementText(el) {
  if (!el) return '';
  return cleanRecallText(el.innerText !== undefined ? el.innerText : el.textContent);
}

function getRecallGridRows(doc) {
  if (!doc || typeof doc.querySelector !== 'function') return [];
  const grid = doc.querySelector('.rz-data-grid') || doc.querySelector('table');
  if (!grid || typeof grid.querySelectorAll !== 'function') return [];
  return Array.from(grid.querySelectorAll('tbody tr'));
}

export function parseRecallTicketCardElement(cardEl, index = 0) {
  if (!cardEl) return null;
  const text = getRecallElementText(cardEl);
  const innerTicket =
    typeof cardEl.querySelector === 'function' ? cardEl.querySelector('.Card-Ticket') : null;
  const ticketId = cleanRecallText((innerTicket && innerTicket.id) || cardEl.id || '');
  const clsAll = `${cardEl.className || ''} ${(innerTicket && innerTicket.className) || ''}`;
  const isSelected = /Card-Ticket-Selected/i.test(clsAll);

  const numEl =
    typeof cardEl.querySelector === 'function'
      ? cardEl.querySelector('.rounded-full span, .text-xl')
      : null;
  const numFromEl = getRecallElementText(numEl);
  const numMatch = numFromEl || (text.match(/^(\d+)\b/) ? text.match(/^(\d+)\b/)[1] : '');
  const ticketNumber = numMatch || String(index + 1);

  const unitEl =
    typeof cardEl.querySelector === 'function' ? cardEl.querySelector('.text-base') : null;
  let unit = getRecallElementText(unitEl);
  if (!unit) {
    const unitMatch = text.match(/^\d+\s+([^\s]+(?:\s+[^\s]+)?)\s+Ngày tạo phiếu/i);
    unit = unitMatch && unitMatch[1] ? cleanRecallText(unitMatch[1]) : '';
  }

  const createdAt = extractRecallFieldAfterLabel(text, 'Ngày tạo phiếu');
  const createdBy = extractRecallFieldAfterLabel(text, 'Người tạo phiếu');
  const updatedAt = extractRecallFieldAfterLabel(text, 'Ngày cập nhật');
  const updatedBy = extractRecallFieldAfterLabel(text, 'Người cập nhật');
  const constructionSpec = extractRecallFieldAfterLabel(text, 'Thông số thi công');

  return {
    index,
    ticketId,
    ticketNumber,
    unit,
    createdAt,
    createdBy,
    updatedAt,
    updatedBy,
    constructionSpec,
    isSelected,
  };
}

export function parseRecallEquipmentRow(trEl, rowIndex = 0) {
  if (!trEl || typeof trEl.querySelectorAll !== 'function') return null;
  const tds = Array.from(trEl.querySelectorAll('td'));
  if (tds.length < 4) return null;

  const cells = tds.map((td) => getRecallElementText(td));
  const mainName = cells[0] || '';
  const subRaw = cells[1] || '';
  const isAddSubPrompt = /^(?:add\s*)?thêm thiết bị phụ$/i.test(subRaw);
  const isAccessory = !mainName && Boolean(subRaw) && !isAddSubPrompt;
  const name = isAccessory ? subRaw : mainName;
  if (!name) return null;

  const editableSpan =
    typeof trEl.querySelector === 'function'
      ? trEl.querySelector('span#equipmentname, [id="equipmentname"]')
      : null;
  const canEdit = Boolean(editableSpan);
  const canAddAccessory = Array.from(trEl.querySelectorAll('button')).some((btn) =>
    /thêm thiết bị phụ/i.test(getRecallElementText(btn))
  );

  const ruleCondition = cleanRecallText((cells[11] || '').replace(/\s*Xem flow Tái-xuất$/i, ''));

  return {
    rowIndex,
    name,
    mainName,
    subName: isAccessory ? subRaw : '',
    isAccessory,
    deviceType: cells[2] || '',
    mac: cells[3] || '',
    quantity: cells[4] || '1',
    recallStatus: cells[5] || '',
    accessoryStatus: cells[6] || '',
    collector: cells[7] || '',
    collectDate: cells[8] || '',
    reason: cells[9] || '',
    deviceCondition: cells[10] || '',
    ruleCondition,
    kpi: cells[12] || '',
    source: cells[13] || '',
    canEdit,
    canAddAccessory,
  };
}

export function findRecallSearchControls(doc) {
  if (!doc || typeof doc.querySelector !== 'function') {
    return { input: null, button: null };
  }
  const input =
    doc.querySelector('input[placeholder*="Nhập số hợp đồng" i]') ||
    doc.querySelector('input.rz-textbox[placeholder*="hợp đồng" i]') ||
    doc.querySelector('input[placeholder*="hợp đồng" i]') ||
    null;

  let button = null;
  if (input && input.parentElement) {
    let cursor = input.parentElement;
    for (let depth = 0; depth < 4 && cursor && !button; depth += 1) {
      if (typeof cursor.querySelectorAll === 'function') {
        button =
          Array.from(cursor.querySelectorAll('button')).find((b) =>
            /^search$/i.test(getRecallElementText(b))
          ) || null;
      }
      cursor = cursor.parentElement || null;
    }
  }
  if (!button && typeof doc.querySelectorAll === 'function') {
    button =
      Array.from(doc.querySelectorAll('button')).find(
        (b) => /^search$/i.test(getRecallElementText(b)) && /rz-button/i.test(String(b.className || ''))
      ) || null;
  }

  return { input, button };
}

export function findRecallMobileMenuToggle(doc) {
  if (!doc || typeof doc.querySelectorAll !== 'function') return null;
  const candidates = Array.from(
    doc.querySelectorAll('.mud-appbar button.mud-icon-button, header button.mud-icon-button')
  );
  return (
    candidates.find((b) => {
      if (!b || b.disabled) return false;
      const txt = getRecallElementText(b).toLowerCase();
      if (/help|send|arrow|close/i.test(txt)) return false;
      return true;
    }) || null
  );
}

export function findRecallCreateTicketButton(doc) {
  if (!doc || typeof doc.querySelector !== 'function') return null;
  const split = doc.querySelector('.rz-splitbutton');
  if (!split || typeof split.querySelector !== 'function') return null;
  const direct = split.querySelector('button[aria-label="Button"]');
  if (direct) return direct;
  if (typeof split.querySelectorAll !== 'function') return null;
  return (
    Array.from(split.querySelectorAll('button')).find(
      (b) =>
        String(b.getAttribute && b.getAttribute('aria-label')).toLowerCase() !== 'open' &&
        /add_circle_outline/i.test(getRecallElementText(b))
    ) || null
  );
}

export function findRecallAddEquipmentButton(doc) {
  if (!doc || typeof doc.querySelectorAll !== 'function') return null;
  return (
    Array.from(doc.querySelectorAll('button')).find((b) =>
      /^thêm thiết bị$/i.test(getRecallElementText(b))
    ) || null
  );
}

export function findRecallNoteControls(doc) {
  if (!doc || typeof doc.querySelectorAll !== 'function') {
    return { input: null, sendBtn: null };
  }
  let input = null;
  const fields = Array.from(doc.querySelectorAll('.rz-form-field'));
  for (const field of fields) {
    const labelEl =
      typeof field.querySelector === 'function'
        ? field.querySelector('label, .rz-form-field-label')
        : null;
    const labelText = getRecallElementText(labelEl);
    if (/ghi chú/i.test(labelText)) {
      input =
        typeof field.querySelector === 'function' ? field.querySelector('input, textarea') : null;
      if (input) break;
    }
  }

  const sendBtn =
    Array.from(doc.querySelectorAll('button')).find((b) =>
      /^send$/i.test(getRecallElementText(b))
    ) || null;

  return { input, sendBtn };
}

export function parseRecallTicketFromDocument(doc, loc = null) {
  if (!doc) {
    return {
      onRecallTicketPage: false,
      contract: '',
      activeTicketTitle: '',
      tickets: [],
      activeTicket: null,
      items: [],
      stats: { totalItems: 0, importedCount: 0, editableCount: 0, pendingCount: 0 },
      hasEmptyNotice: false,
      canCreateTicket: false,
      canAddEquipment: false,
      canAddNote: false,
      openDialogTitle: '',
    };
  }

  const bodyText = getRecallElementText(doc.body);
  const hasEmptyNotice = /chưa có phiếu thu hồi/i.test(bodyText);
  let contract = '';
  const bannerMatch = bodyText.match(
    /DANH SÁCH PHIẾU THU HỒI\s*[-–:]\s*([A-Z0-9._-]{3,32})/i
  );
  if (bannerMatch && bannerMatch[1]) {
    contract = normalizeContractId(bannerMatch[1]);
  }
  if (!contract && doc.title) {
    const titleCandidate = normalizeContractId(doc.title);
    if (
      titleCandidate &&
      !RECALL_GENERIC_TITLES_RE.test(titleCandidate) &&
      validateContractId(titleCandidate).valid
    ) {
      contract = titleCandidate;
    }
  }

  const headings =
    typeof doc.querySelectorAll === 'function' ? Array.from(doc.querySelectorAll('h1,h2,h3,h4')) : [];
  const ticketHeading = headings.find((h) => /^phiếu số\s+\d+/i.test(getRecallElementText(h)));
  const activeTicketTitle = getRecallElementText(ticketHeading);

  const ticketCards =
    typeof doc.querySelectorAll === 'function' ? Array.from(doc.querySelectorAll('.ticketinf')) : [];
  const tickets = ticketCards
    .map((cardEl, idx) => parseRecallTicketCardElement(cardEl, idx))
    .filter(Boolean);

  let activeTicket = tickets.find((t) => t.isSelected) || null;
  if (!activeTicket && activeTicketTitle) {
    const numMatch = activeTicketTitle.match(/\d+/);
    if (numMatch) {
      activeTicket = tickets.find((t) => t.ticketNumber === numMatch[0]) || null;
    }
  }
  if (!activeTicket && tickets.length > 0) {
    activeTicket = tickets[0];
  }

  const gridRows = getRecallGridRows(doc);
  const items = gridRows.map((trEl, idx) => parseRecallEquipmentRow(trEl, idx)).filter(Boolean);

  const importedCount = items.filter((item) => /đã nhập kho/i.test(item.recallStatus)).length;
  const editableCount = items.filter((item) => item.canEdit).length;
  const pendingCount = items.length - importedCount;

  const openDialog =
    typeof doc.querySelector === 'function' ? doc.querySelector('.rz-dialog.rz-open') : null;
  const dialogTitleEl =
    openDialog && typeof openDialog.querySelector === 'function'
      ? openDialog.querySelector('.rz-dialog-title, .rz-dialog-titlebar')
      : null;
  const openDialogTitle = getRecallElementText(dialogTitleEl);

  return {
    onRecallTicketPage:
      isRecallTicketLocation(loc) ||
      hasEmptyNotice ||
      Boolean(bannerMatch) ||
      tickets.length > 0 ||
      items.length > 0 ||
      Boolean(activeTicketTitle),
    contract,
    activeTicketTitle,
    tickets,
    activeTicket,
    items,
    stats: {
      totalItems: items.length,
      importedCount,
      editableCount,
      pendingCount,
    },
    hasEmptyNotice,
    canCreateTicket: Boolean(findRecallCreateTicketButton(doc)),
    canAddEquipment: Boolean(findRecallAddEquipmentButton(doc)),
    canAddNote: Boolean(findRecallNoteControls(doc).input),
    openDialogTitle,
  };
}

function setRecallNativeInputValue(inputEl, value) {
  if (!inputEl) return;
  const strVal = String(value ?? '');
  try {
    const proto = typeof HTMLInputElement !== 'undefined' ? HTMLInputElement.prototype : null;
    const desc = proto ? Object.getOwnPropertyDescriptor(proto, 'value') : null;
    if (desc && typeof desc.set === 'function') {
      desc.set.call(inputEl, strVal);
    } else {
      inputEl.value = strVal;
    }
  } catch {
    inputEl.value = strVal;
  }

  if (typeof inputEl.dispatchEvent === 'function') {
    for (const evtName of ['input', 'change']) {
      try {
        if (typeof Event === 'function') {
          inputEl.dispatchEvent(new Event(evtName, { bubbles: true }));
        } else {
          inputEl.dispatchEvent({ type: evtName, bubbles: true });
        }
      } catch {
        // Ignore custom mock dispatch failures
      }
    }
  }
}

export function triggerRecallSearchOnPage(doc, rawContractId) {
  const check = validateContractId(rawContractId);
  if (!check.valid) {
    return { ok: false, error: check.error };
  }
  const { input, button } = findRecallSearchControls(doc);
  if (!input) {
    return {
      ok: false,
      error: 'Không tìm thấy ô "Nhập số hợp đồng" trên trang Thu hồi NextGen.',
    };
  }
  setRecallNativeInputValue(input, check.value);
  if (button && typeof button.click === 'function') {
    button.click();
  } else if (typeof input.dispatchEvent === 'function') {
    try {
      if (typeof KeyboardEvent === 'function') {
        input.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true })
        );
      } else {
        input.dispatchEvent({ type: 'keydown', key: 'Enter', bubbles: true });
      }
    } catch {
      // Ignore keyboard dispatch errors on minimal mocks
    }
  }
  return { ok: true, contractId: check.value };
}

export function triggerRecallCreateTicket(doc) {
  const btn = findRecallCreateTicketButton(doc);
  if (!btn || typeof btn.click !== 'function') {
    return {
      ok: false,
      error: 'Không tìm thấy nút dấu (+) Tạo phiếu mới trên trang Thu hồi.',
    };
  }
  if (btn.disabled) {
    return {
      ok: false,
      error: 'Nút Tạo phiếu mới (+) hiện đang bị khóa trên trang gốc.',
    };
  }
  btn.click();
  return { ok: true };
}

export function triggerRecallSelectTicket(doc, ticketIndex = 0) {
  if (!doc || typeof doc.querySelectorAll !== 'function') {
    return { ok: false, error: 'Không truy cập được danh sách phiếu trên trang.' };
  }
  const cards = Array.from(doc.querySelectorAll('.ticketinf'));
  const card = cards[ticketIndex];
  if (!card) {
    return { ok: false, error: `Không tìm thấy Phiếu thứ ${Number(ticketIndex) + 1} trên trang.` };
  }
  const inner = typeof card.querySelector === 'function' ? card.querySelector('.Card-Ticket') : null;
  const target = inner && typeof inner.click === 'function' ? inner : card;
  if (typeof target.click !== 'function') {
    return { ok: false, error: 'Thẻ phiếu trên trang không hỗ trợ bấm chuyển.' };
  }
  target.click();
  return { ok: true, ticketIndex };
}

export function triggerRecallAddEquipment(doc) {
  const btn = findRecallAddEquipmentButton(doc);
  if (!btn || typeof btn.click !== 'function') {
    return {
      ok: false,
      error: 'Không tìm thấy nút "Thêm thiết bị" trên trang Thu hồi.',
    };
  }
  if (btn.disabled) {
    return {
      ok: false,
      error: 'Nút "Thêm thiết bị" hiện đang bị khóa trên phiếu này.',
    };
  }
  btn.click();
  return { ok: true };
}

export function triggerRecallAddAccessory(doc, rowIndex) {
  const rows = getRecallGridRows(doc);
  const tr = rows[rowIndex];
  if (!tr || typeof tr.querySelectorAll !== 'function') {
    return {
      ok: false,
      error: `Không tìm thấy dòng thiết bị chính #${Number(rowIndex) + 1} trên bảng.`,
    };
  }
  const addBtn = Array.from(tr.querySelectorAll('button')).find((b) =>
    /thêm thiết bị phụ/i.test(getRecallElementText(b))
  );
  if (!addBtn || typeof addBtn.click !== 'function') {
    return {
      ok: false,
      error: 'Dòng thiết bị này không có nút "Thêm thiết bị phụ".',
    };
  }
  if (addBtn.disabled) {
    return {
      ok: false,
      error: 'Nút "Thêm thiết bị phụ" đang bị khóa.',
    };
  }
  addBtn.click();
  return { ok: true, rowIndex };
}

export function triggerRecallEditEquipment(doc, rowIndex) {
  const rows = getRecallGridRows(doc);
  const tr = rows[rowIndex];
  if (!tr || typeof tr.querySelector !== 'function') {
    return {
      ok: false,
      error: `Không tìm thấy dòng vật tư #${Number(rowIndex) + 1} trên bảng.`,
    };
  }
  const editableSpan = tr.querySelector('span#equipmentname, [id="equipmentname"]');
  if (!editableSpan) {
    return {
      ok: false,
      error: 'Vật tư này đã nhập kho hoặc không có liên kết sửa (#equipmentname).',
    };
  }
  if (typeof editableSpan.click !== 'function') {
    return {
      ok: false,
      error: 'Không kích hoạt được thao tác bấm vào tên thiết bị.',
    };
  }
  const itemName = getRecallElementText(editableSpan);
  editableSpan.click();
  return { ok: true, rowIndex, itemName };
}

export function triggerRecallSubmitNote(doc, rawNote) {
  const note = cleanRecallText(rawNote);
  if (!note) {
    return {
      ok: false,
      error: 'Vui lòng nhập nội dung ghi chú trước khi gửi.',
    };
  }
  const { input, sendBtn } = findRecallNoteControls(doc);
  if (!input || !sendBtn) {
    return {
      ok: false,
      error: 'Không tìm thấy ô ghi chú hoặc nút Gửi trên trang phiếu thu hồi.',
    };
  }
  setRecallNativeInputValue(input, note);
  if (typeof sendBtn.click === 'function') {
    sendBtn.click();
  }
  return { ok: true, note };
}

export const DEMO_RECALL_STAFF_LIST = [
  'KTV.MAU01',
  'KTV.MAU02',
  'KTV.MAU03',
  'KTV.MAU04',
  'KTV.MAU05',
  'KTV.MAU06',
];

export function findRecallOpenDialog(doc) {
  if (!doc || typeof doc.querySelector !== 'function') return null;
  return doc.querySelector('.rz-dialog.rz-open') || doc.querySelector('.rz-dialog') || null;
}

export function readRecallDialogStaffOptions(panel) {
  if (!panel || typeof panel.querySelectorAll !== 'function') return [];
  const items = Array.from(
    panel.querySelectorAll('.rz-dropdown-item, .rz-autocomplete-list-item, li[role="option"]')
  );
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const txt = getRecallElementText(item);
    if (!txt) continue;
    const key = txt.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(txt);
    if (out.length >= 40) break;
  }
  return out;
}

export function findRecallDialogFieldInfo(doc, dialogEl, labelRe) {
  if (!dialogEl || typeof dialogEl.querySelectorAll !== 'function' || !labelRe) {
    return null;
  }
  const fields = Array.from(dialogEl.querySelectorAll('.rz-form-field, .mud-input-control'));
  for (const field of fields) {
    if (!field || typeof field.querySelector !== 'function') continue;
    const labelEl = field.querySelector('label, .rz-form-field-label, .mud-input-label');
    const labelText = getRecallElementText(labelEl);
    if (!labelRe.test(labelText)) continue;

    const dd = field.querySelector('.rz-dropdown, .rz-multiselect, .rz-autocomplete, .mud-select');
    const ddId = dd && dd.id ? dd.id : '';
    let panel = null;
    if (ddId && doc && typeof doc.getElementById === 'function') {
      panel = doc.getElementById(`popup-${ddId}`) || doc.getElementById(`popup${ddId}`);
    }
    if (!panel && dd && typeof dd.querySelector === 'function') {
      panel = dd.querySelector('.rz-dropdown-panel');
    }

    const searchInput =
      (panel && typeof panel.querySelector === 'function'
        ? panel.querySelector('.rz-dropdown-filter, input[aria-label="Search"]')
        : null) ||
      (ddId && doc && typeof doc.getElementById === 'function'
        ? doc.getElementById(`search-${ddId}`)
        : null);

    let valueText = '';
    let disabled = false;
    if (dd) {
      const ddCls = String(dd.className || '');
      const labelNode =
        typeof dd.querySelector === 'function'
          ? dd.querySelector('.rz-dropdown-label, .rz-multiselect-label')
          : null;
      const isPlaceholder = Boolean(
        /rz-state-empty/i.test(ddCls) ||
          (labelNode && /rz-placeholder/i.test(String(labelNode.className || '')))
      );
      valueText = isPlaceholder ? '' : getRecallElementText(labelNode || dd);
      disabled = /rz-state-disabled|disabled/i.test(ddCls) || Boolean(dd.disabled);
    } else {
      const inp = field.querySelector('input, textarea');
      valueText = inp ? cleanRecallText(inp.value) : '';
      disabled = Boolean(inp && inp.disabled);
    }

    const panelOpen = Boolean(panel && (!panel.style || panel.style.display !== 'none'));
    return {
      field,
      labelText,
      dd,
      panel,
      searchInput,
      valueText,
      disabled,
      panelOpen,
    };
  }
  return null;
}

export function readRecallStaffDialogState(doc) {
  const snackEl =
    doc && typeof doc.querySelector === 'function'
      ? doc.querySelector('.mud-snackbar, .rz-notification-message, .rz-growl-message')
      : null;
  const snackbarText = getRecallElementText(snackEl);
  const dialogEl = findRecallOpenDialog(doc);
  if (!dialogEl) {
    return {
      isOpen: false,
      title: '',
      province: '',
      partner: '',
      branch: '',
      currentStaff: '',
      recallStatus: '',
      reason: '',
      hasStaffField: false,
      staffDisabled: false,
      staffPanelOpen: false,
      staffOptions: [],
      hasUpdateBtn: false,
      updateBtnDisabled: false,
      validationErrors: [],
      snackbarText,
    };
  }

  const titleEl =
    typeof dialogEl.querySelector === 'function'
      ? dialogEl.querySelector('.rz-dialog-title, .rz-dialog-titlebar')
      : null;
  const provinceInfo = findRecallDialogFieldInfo(doc, dialogEl, /tỉnh\s*thành/i);
  const partnerInfo = findRecallDialogFieldInfo(doc, dialogEl, /đối\s*tác/i);
  const branchInfo = findRecallDialogFieldInfo(doc, dialogEl, /chi\s*nhánh/i);
  const staffInfo = findRecallDialogFieldInfo(doc, dialogEl, /^nhân\s*viên\*?$/i);
  const statusInfo = findRecallDialogFieldInfo(doc, dialogEl, /tình\s*trạng\s*thu\s*hồi/i);
  const reasonInfo = findRecallDialogFieldInfo(doc, dialogEl, /nguyên\s*nhân/i);

  const btns =
    typeof dialogEl.querySelectorAll === 'function'
      ? Array.from(dialogEl.querySelectorAll('button'))
      : [];
  const updateBtn = btns.find((b) => /^cập\s*nhật$/i.test(getRecallElementText(b))) || null;

  const valEls =
    typeof dialogEl.querySelectorAll === 'function'
      ? Array.from(
          dialogEl.querySelectorAll(
            '.rz-message, .validation-message, .mud-input-error, .rz-messages-error'
          )
        )
      : [];
  const validationErrors = [];
  for (const ve of valEls) {
    const txt = getRecallElementText(ve);
    if (txt && !validationErrors.includes(txt)) {
      validationErrors.push(txt);
    }
  }

  const staffOptions =
    staffInfo && staffInfo.panel && staffInfo.panelOpen
      ? readRecallDialogStaffOptions(staffInfo.panel)
      : [];

  return {
    isOpen: true,
    title: getRecallElementText(titleEl),
    province: provinceInfo ? provinceInfo.valueText : '',
    partner: partnerInfo ? partnerInfo.valueText : '',
    branch: branchInfo ? branchInfo.valueText : '',
    currentStaff: staffInfo ? staffInfo.valueText : '',
    recallStatus: statusInfo ? statusInfo.valueText : '',
    reason: reasonInfo ? reasonInfo.valueText : '',
    hasStaffField: Boolean(staffInfo && staffInfo.dd),
    staffDisabled: Boolean(staffInfo && staffInfo.disabled),
    staffPanelOpen: Boolean(staffInfo && staffInfo.panelOpen),
    staffOptions,
    hasUpdateBtn: Boolean(updateBtn),
    updateBtnDisabled: Boolean(updateBtn && updateBtn.disabled),
    validationErrors,
    snackbarText,
  };
}

export function triggerRecallOpenStaffDropdown(doc) {
  const dialogEl = findRecallOpenDialog(doc);
  if (!dialogEl) {
    return { ok: false, error: 'Hộp thoại sửa vật tư trên NextGen đang đóng.' };
  }
  const staffInfo = findRecallDialogFieldInfo(doc, dialogEl, /^nhân\s*viên\*?$/i);
  if (!staffInfo || !staffInfo.dd) {
    return { ok: false, error: 'Không tìm thấy ô chọn "Nhân viên*" trong hộp thoại NextGen.' };
  }
  if (staffInfo.disabled) {
    return { ok: false, error: 'Ô chọn "Nhân viên*" đang bị khóa trên NextGen.' };
  }
  const currentItems = staffInfo.panel ? readRecallDialogStaffOptions(staffInfo.panel) : [];
  if (staffInfo.panelOpen && currentItems.length > 0) {
    return { ok: true, alreadyOpen: true };
  }
  const trigger =
    typeof staffInfo.dd.querySelector === 'function'
      ? staffInfo.dd.querySelector('.rz-dropdown-trigger')
      : null;
  const clickTarget =
    trigger && typeof trigger.click === 'function' ? trigger : staffInfo.dd;
  if (!clickTarget || typeof clickTarget.click !== 'function') {
    return { ok: false, error: 'Không bấm mở được danh sách Nhân viên.' };
  }
  clickTarget.click();
  return { ok: true, alreadyOpen: false };
}

export function triggerRecallFilterStaffDropdown(doc, rawQuery = '') {
  const query = cleanRecallText(rawQuery);
  const dialogEl = findRecallOpenDialog(doc);
  if (!dialogEl) {
    return { ok: false, error: 'Hộp thoại sửa vật tư trên NextGen đang đóng.' };
  }
  const staffInfo = findRecallDialogFieldInfo(doc, dialogEl, /^nhân\s*viên\*?$/i);
  if (!staffInfo || !staffInfo.dd) {
    return { ok: false, error: 'Không tìm thấy ô chọn "Nhân viên*".' };
  }
  if (!staffInfo.panelOpen) {
    triggerRecallOpenStaffDropdown(doc);
  }
  const refreshedInfo = findRecallDialogFieldInfo(doc, dialogEl, /^nhân\s*viên\*?$/i);
  const searchInput = (refreshedInfo && refreshedInfo.searchInput) || staffInfo.searchInput;
  if (!searchInput) {
    return {
      ok: false,
      error: 'Không tìm thấy ô gõ tìm tên KTV bên trong danh sách Nhân viên.',
    };
  }
  setRecallNativeInputValue(searchInput, query);
  if (typeof searchInput.dispatchEvent === 'function') {
    try {
      if (typeof KeyboardEvent === 'function') {
        searchInput.dispatchEvent(
          new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true })
        );
      } else {
        searchInput.dispatchEvent({ type: 'keyup', key: 'Enter', bubbles: true });
      }
    } catch {
      // Ignore keyboard event failures on minimal mocks
    }
  }
  return { ok: true, query };
}

export function triggerRecallPickStaffOption(doc, targetStaff = '') {
  const cleanTarget = cleanRecallText(targetStaff);
  if (!cleanTarget) {
    return { ok: false, error: 'Vui lòng chọn tên KTV cần cập nhật.' };
  }
  const dialogEl = findRecallOpenDialog(doc);
  if (!dialogEl) {
    return { ok: false, error: 'Hộp thoại sửa vật tư trên NextGen đang đóng.' };
  }
  const staffInfo = findRecallDialogFieldInfo(doc, dialogEl, /^nhân\s*viên\*?$/i);
  if (!staffInfo || !staffInfo.panel || typeof staffInfo.panel.querySelectorAll !== 'function') {
    return { ok: false, error: 'Chưa mở được danh sách tùy chọn Nhân viên.' };
  }
  const items = Array.from(
    staffInfo.panel.querySelectorAll(
      '.rz-dropdown-item, .rz-autocomplete-list-item, li[role="option"]'
    )
  );
  const targetLower = cleanTarget.toLowerCase();
  const match =
    items.find((el) => getRecallElementText(el).toLowerCase() === targetLower) ||
    items.find((el) => getRecallElementText(el).toLowerCase().startsWith(targetLower)) ||
    items.find((el) => getRecallElementText(el).toLowerCase().includes(targetLower)) ||
    null;
  if (!match || typeof match.click !== 'function') {
    return { ok: false, error: `Không thấy tên KTV "${cleanTarget}" trong danh sách đang mở.` };
  }
  const picked = getRecallElementText(match);
  match.click();
  return { ok: true, picked };
}

export function triggerRecallSubmitEditDialog(doc) {
  const dialogEl = findRecallOpenDialog(doc);
  if (!dialogEl || typeof dialogEl.querySelectorAll !== 'function') {
    return { ok: false, error: 'Hộp thoại sửa vật tư trên NextGen đang đóng.' };
  }
  const updateBtn = Array.from(dialogEl.querySelectorAll('button')).find((b) =>
    /^cập\s*nhật$/i.test(getRecallElementText(b))
  );
  if (!updateBtn || typeof updateBtn.click !== 'function') {
    return { ok: false, error: 'Không tìm thấy nút "Cập nhật" trong hộp thoại NextGen.' };
  }
  if (updateBtn.disabled) {
    return { ok: false, error: 'Nút "Cập nhật" trên NextGen hiện đang bị khóa.' };
  }
  updateBtn.click();
  return { ok: true };
}

export function triggerRecallCloseEditDialog(doc) {
  const dialogEl = findRecallOpenDialog(doc);
  if (!dialogEl || typeof dialogEl.querySelectorAll !== 'function') {
    return { ok: true, alreadyClosed: true };
  }
  const closeBtn =
    Array.from(dialogEl.querySelectorAll('button')).find((b) =>
      /^đóng$/i.test(getRecallElementText(b))
    ) ||
    (typeof dialogEl.querySelector === 'function'
      ? dialogEl.querySelector('.rz-dialog-titlebar-close')
      : null);
  if (!closeBtn || typeof closeBtn.click !== 'function') {
    return { ok: false, error: 'Không tìm thấy nút Đóng hộp thoại NextGen.' };
  }
  closeBtn.click();
  return { ok: true, alreadyClosed: false };
}

export function buildDemoRecallSnapshot(rawContractId = 'SGN123456') {
  const contract = normalizeContractId(rawContractId) || 'SGN123456';
  const activeTicket = {
    index: 0,
    ticketId: '900001',
    ticketNumber: '1',
    unit: 'TIN/PNC',
    createdAt: '09/11/2026 09:00:00',
    createdBy: 'ktv.mau01',
    updatedAt: '23/11/2026 10:30:00',
    updatedBy: 'ktv.mau02',
    constructionSpec: 'HCM-ODC-01/HO/01-01-G',
    isSelected: true,
  };
  const items = [
    {
      rowIndex: 0,
      name: 'Access Point AX3000 (Mẫu)',
      mainName: 'Access Point AX3000 (Mẫu)',
      subName: '',
      isAccessory: false,
      deviceType: 'Modem',
      mac: '001122334455',
      quantity: '1',
      recallStatus: 'Đã nhập kho',
      accessoryStatus: 'Không đầy đủ',
      collector: 'ktv.mau02',
      collectDate: '23/11/2026 10:30:00',
      reason: 'Thanh lý hợp đồng tại nhà',
      deviceCondition: 'Hàng tái sử dụng',
      ruleCondition: 'Hàng tái sử dụng',
      kpi: 'Có',
      source: 'SR',
      canEdit: false,
      canAddAccessory: true,
    },
    {
      rowIndex: 1,
      name: 'FPT Play Box 650 (Mẫu)',
      mainName: 'FPT Play Box 650 (Mẫu)',
      subName: '',
      isAccessory: false,
      deviceType: 'Box OTT',
      mac: '',
      quantity: '1',
      recallStatus: 'Thu hồi không thành công',
      accessoryStatus: '',
      collector: '',
      collectDate: '',
      reason: 'Thanh lý hợp đồng tại nhà',
      deviceCondition: 'Hàng nhập lại',
      ruleCondition: 'Hàng tái sử dụng',
      kpi: 'Có',
      source: 'SR',
      canEdit: true,
      canAddAccessory: true,
    },
    {
      rowIndex: 2,
      name: 'HDMI',
      mainName: '',
      subName: 'HDMI',
      isAccessory: true,
      deviceType: 'Vật tư thu hồi khác',
      mac: '',
      quantity: '1',
      recallStatus: 'Thu hồi không thành công',
      accessoryStatus: '',
      collector: '',
      collectDate: '',
      reason: 'Thanh lý hợp đồng tại nhà',
      deviceCondition: 'Hàng nhập lại',
      ruleCondition: 'Hàng tái sử dụng',
      kpi: 'Có',
      source: 'SR',
      canEdit: true,
      canAddAccessory: false,
    },
    {
      rowIndex: 3,
      name: 'Nguồn Box 650',
      mainName: '',
      subName: 'Nguồn Box 650',
      isAccessory: true,
      deviceType: 'Vật tư thu hồi khác',
      mac: '',
      quantity: '1',
      recallStatus: 'Thu hồi không thành công',
      accessoryStatus: '',
      collector: '',
      collectDate: '',
      reason: 'Thanh lý hợp đồng tại nhà',
      deviceCondition: 'Hàng nhập lại',
      ruleCondition: 'Hàng tái sử dụng',
      kpi: 'Có',
      source: 'SR',
      canEdit: true,
      canAddAccessory: false,
    },
  ];

  return {
    onRecallTicketPage: true,
    contract,
    activeTicketTitle: 'Phiếu số 1',
    tickets: [activeTicket],
    activeTicket,
    items,
    stats: {
      totalItems: items.length,
      importedCount: 1,
      editableCount: 3,
      pendingCount: 3,
    },
    hasEmptyNotice: false,
    canCreateTicket: true,
    canAddEquipment: true,
    canAddNote: true,
    openDialogTitle: '',
  };
}

function buildRecallPortalBootstrapJs() {
  const fnSource = [
    normalizeContractId,
    validateContractId,
    cleanRecallText,
    isRecallPortalLocation,
    isRecallTicketLocation,
    isNextGenSessionExpiredDocument,
    extractRecallFieldAfterLabel,
    getRecallElementText,
    getRecallGridRows,
    parseRecallTicketCardElement,
    parseRecallEquipmentRow,
    findRecallSearchControls,
    findRecallMobileMenuToggle,
    findRecallCreateTicketButton,
    findRecallAddEquipmentButton,
    findRecallNoteControls,
    parseRecallTicketFromDocument,
    setRecallNativeInputValue,
    triggerRecallSearchOnPage,
    triggerRecallCreateTicket,
    triggerRecallSelectTicket,
    triggerRecallAddEquipment,
    triggerRecallAddAccessory,
    triggerRecallEditEquipment,
    triggerRecallSubmitNote,
    findRecallOpenDialog,
    readRecallDialogStaffOptions,
    findRecallDialogFieldInfo,
    readRecallStaffDialogState,
    triggerRecallOpenStaffDropdown,
    triggerRecallFilterStaffDropdown,
    triggerRecallPickStaffOption,
    triggerRecallSubmitEditDialog,
    triggerRecallCloseEditDialog,
  ]
    .map((fn) => fn.toString())
    .join('\n');

  return `
    if (!window.__riRecallDom || window.__riRecallDomVersion !== 'v2') {
      window.__riRecallDomVersion = 'v2';
      window.__riRecallDom = (function() {
        var CONTRACT_REGEX = ${CONTRACT_REGEX.toString()};
        var RECALL_ENDPOINTS = ${JSON.stringify(RECALL_ENDPOINTS)};
        var RECALL_GENERIC_TITLES_RE = ${RECALL_GENERIC_TITLES_RE.toString()};
        ${fnSource}
        return {
          inspectState: function() {
            var ctrls = findRecallSearchControls(document);
            var inp = ctrls.input;
            var isInputVisible = Boolean(inp && (inp.offsetParent === undefined || inp.offsetParent !== null));
            var menuBtn = findRecallMobileMenuToggle(document);
            var snackEl = typeof document.querySelector === 'function'
              ? document.querySelector('.mud-snackbar, .rz-notification-message, .rz-growl-message')
              : null;
            var onTicket = isRecallTicketLocation(location);
            var snap = onTicket ? parseRecallTicketFromDocument(document, location) : null;
            return {
              href: String(location.href || ''),
              onPortal: isRecallPortalLocation(location),
              onTicket: onTicket,
              sessionExpired: isNextGenSessionExpiredDocument(document),
              hasVisibleSearchInput: isInputVisible,
              hasAnySearchInput: Boolean(inp),
              hasMenuToggle: Boolean(menuBtn),
              snackbarText: getRecallElementText(snackEl),
              snapshot: snap
            };
          },
          openMobileMenu: function() {
            var btn = findRecallMobileMenuToggle(document);
            if (!btn || typeof btn.click !== 'function') return { ok: false };
            btn.click();
            return { ok: true };
          },
          searchContract: function(contractId) {
            return triggerRecallSearchOnPage(document, contractId);
          },
          readSnapshot: function() {
            return parseRecallTicketFromDocument(document, location);
          },
          runAction: function(actionType, payload) {
            var p = payload || {};
            if (actionType === 'create_ticket') return triggerRecallCreateTicket(document);
            if (actionType === 'select_ticket') return triggerRecallSelectTicket(document, p.ticketIndex || 0);
            if (actionType === 'add_equipment') return triggerRecallAddEquipment(document);
            if (actionType === 'edit_equipment') return triggerRecallEditEquipment(document, p.rowIndex || 0);
            if (actionType === 'add_accessory') return triggerRecallAddAccessory(document, p.rowIndex || 0);
            if (actionType === 'submit_note') return triggerRecallSubmitNote(document, p.note || '');
            return { ok: false, error: 'Thao tác phiếu thu hồi không xác định.' };
          },
          runStaffOp: function(op, payload) {
            var p = payload || {};
            if (op === 'read_dialog') return readRecallStaffDialogState(document);
            if (op === 'open_staff_dropdown') return triggerRecallOpenStaffDropdown(document);
            if (op === 'filter_staff_dropdown') return triggerRecallFilterStaffDropdown(document, p.query || '');
            if (op === 'pick_staff_option') return triggerRecallPickStaffOption(document, p.targetStaff || '');
            if (op === 'submit_dialog') return triggerRecallSubmitEditDialog(document);
            if (op === 'close_dialog') return triggerRecallCloseEditDialog(document);
            return { ok: false, error: 'Thao tác KTV phiếu thu hồi không xác định.' };
          }
        };
      })();
    }
  `;
}

async function evalRecallDom(expr) {
  const boot = buildRecallPortalBootstrapJs();
  return evalAndroidPortalJs(`${boot}\nreturn (${expr});`);
}

function shouldUseLocalRecallDoc(ctx = {}) {
  const doc = ctx.pageDocument || null;
  const loc = ctx.pageLocation || (doc && doc.location) || null;
  return !canControlAndroidPortal() || Boolean(doc && loc && isRecallTicketLocation(loc));
}

async function callRecallStaffOp(op, payload = {}, ctx = {}) {
  if (shouldUseLocalRecallDoc(ctx)) {
    const doc = ctx.pageDocument || null;
    if (op === 'read_dialog') return readRecallStaffDialogState(doc);
    if (op === 'open_staff_dropdown') return triggerRecallOpenStaffDropdown(doc);
    if (op === 'filter_staff_dropdown') {
      return triggerRecallFilterStaffDropdown(doc, payload.query || '');
    }
    if (op === 'pick_staff_option') {
      return triggerRecallPickStaffOption(doc, payload.targetStaff || '');
    }
    if (op === 'submit_dialog') return triggerRecallSubmitEditDialog(doc);
    if (op === 'close_dialog') return triggerRecallCloseEditDialog(doc);
    return { ok: false, error: 'Thao tác KTV phiếu thu hồi không xác định.' };
  }

  const res = await evalRecallDom(
    `window.__riRecallDom.runStaffOp(${JSON.stringify(op)}, ${JSON.stringify(payload || {})})`
  );
  if (!res.ok || !res.value) {
    return {
      ok: false,
      error: res.error || 'Không kết nối được hộp thoại Sửa vật tư NextGen.',
    };
  }
  return res.value;
}

async function readRecallTicketSnapshotNow(ctx = {}) {
  if (shouldUseLocalRecallDoc(ctx)) {
    const doc = ctx.pageDocument || null;
    const loc = ctx.pageLocation || (doc && doc.location) || null;
    const snackEl =
      doc && typeof doc.querySelector === 'function'
        ? doc.querySelector('.mud-snackbar, .rz-notification-message, .rz-growl-message')
        : null;
    return {
      snapshot: doc ? parseRecallTicketFromDocument(doc, loc) : null,
      snackbarText: getRecallElementText(snackEl),
    };
  }
  const res = await evalRecallDom('window.__riRecallDom.inspectState()');
  if (res.ok && res.value) {
    return {
      snapshot: res.value.snapshot || null,
      snackbarText: res.value.snackbarText || '',
    };
  }
  return { snapshot: null, snackbarText: '' };
}

/**
 * Mo hop thoai Sua vat tu tren NextGen va tai danh sach KTV trong o Nhan vien*.
 */
export async function openRecallStaffEditor(
  { rowIndex = 0, itemName = '', currentCollector = '' } = {},
  ctx = {}
) {
  if (!isUserscriptEnv() || ctx.forceDemo) {
    return {
      status: 'ok',
      mode: 'demo',
      dialog: {
        isOpen: true,
        title: itemName || 'FPT Play Box 650 (Mẫu)',
        province: 'Khu vực Mẫu 01',
        partner: 'DT Mau Khu Vuc A',
        branch: 'Chi nhánh mẫu',
        currentStaff: currentCollector || 'KTV.MAU01',
        recallStatus: 'Chưa thu hồi',
        reason: '',
        hasStaffField: true,
        staffDisabled: false,
        staffPanelOpen: true,
        staffOptions: [...DEMO_RECALL_STAFF_LIST],
        hasUpdateBtn: true,
        updateBtnDisabled: false,
        validationErrors: [],
        snackbarText: '',
      },
    };
  }

  const doc = ctx.pageDocument || null;
  const initialSt = await callRecallStaffOp('read_dialog', {}, ctx);
  if (initialSt && initialSt.isOpen) {
    await callRecallStaffOp('close_dialog', {}, ctx);
    await sleep(220);
  }

  const openRes = await triggerRecallPortalAction('edit_equipment', { rowIndex }, doc);
  if (!openRes.ok) {
    return { status: 'error', mode: 'live', message: openRes.error };
  }

  let st = null;
  const openDeadline = Date.now() + 5000;
  while (Date.now() < openDeadline) {
    await sleep(200);
    const cur = await callRecallStaffOp('read_dialog', {}, ctx);
    if (cur && cur.isOpen && cur.hasStaffField) {
      st = cur;
      break;
    }
  }

  if (!st || !st.isOpen || !st.hasStaffField) {
    return {
      status: 'error',
      mode: 'live',
      message: 'Không mở được hộp thoại Sửa vật tư hoặc không thấy ô "Nhân viên*" trên NextGen.',
    };
  }

  if (!st.staffDisabled) {
    await callRecallStaffOp('open_staff_dropdown', {}, ctx);
    const ddDeadline = Date.now() + 2200;
    while (Date.now() < ddDeadline) {
      await sleep(180);
      const nextSt = await callRecallStaffOp('read_dialog', {}, ctx);
      if (nextSt && nextSt.isOpen) {
        st = nextSt;
        if (nextSt.staffPanelOpen && Array.isArray(nextSt.staffOptions) && nextSt.staffOptions.length > 0) {
          break;
        }
      }
    }
  }

  return {
    status: 'ok',
    mode: 'live',
    dialog: st,
  };
}

/**
 * Loc danh sach KTV trong dropdown Nhan vien* theo tu khoa tim kiem.
 */
export async function searchRecallStaffOptions(rawQuery = '', ctx = {}) {
  const query = cleanRecallText(rawQuery);
  if (!isUserscriptEnv() || ctx.forceDemo) {
    const qLower = query.toLowerCase();
    const options = qLower
      ? DEMO_RECALL_STAFF_LIST.filter((name) => name.toLowerCase().includes(qLower))
      : [...DEMO_RECALL_STAFF_LIST];
    return {
      status: 'ok',
      mode: 'demo',
      query,
      options,
      currentStaff: '',
    };
  }

  let st = await callRecallStaffOp('read_dialog', {}, ctx);
  if (!st || !st.isOpen) {
    return {
      status: 'dialog_closed',
      mode: 'live',
      message: 'Hộp thoại sửa vật tư trên NextGen đã đóng. Hãy bấm "Đổi KTV" lại.',
    };
  }

  const prevSig = Array.isArray(st.staffOptions) ? st.staffOptions.join('|') : '';
  if (!st.staffPanelOpen) {
    await callRecallStaffOp('open_staff_dropdown', {}, ctx);
    await sleep(200);
  }

  const filterRes = await callRecallStaffOp('filter_staff_dropdown', { query }, ctx);
  if (!filterRes.ok) {
    return {
      status: 'error',
      mode: 'live',
      message: filterRes.error || 'Không lọc được danh sách Nhân viên trên NextGen.',
    };
  }

  await sleep(350);
  const qLower = query.toLowerCase();
  const pollDeadline = Date.now() + 2200;
  while (Date.now() < pollDeadline) {
    const cur = await callRecallStaffOp('read_dialog', {}, ctx);
    if (!cur || !cur.isOpen) {
      return {
        status: 'dialog_closed',
        mode: 'live',
        message: 'Hộp thoại sửa vật tư trên NextGen đã đóng.',
      };
    }
    st = cur;
    const opts = Array.isArray(cur.staffOptions) ? cur.staffOptions : [];
    const curSig = opts.join('|');
    const allMatch =
      !qLower || (opts.length > 0 && opts.every((o) => o.toLowerCase().includes(qLower)));
    if (curSig !== prevSig || allMatch) {
      break;
    }
    await sleep(200);
  }

  return {
    status: 'ok',
    mode: 'live',
    query,
    options: Array.isArray(st.staffOptions) ? st.staffOptions : [],
    currentStaff: st.currentStaff || '',
  };
}

/**
 * Chon KTV muc tieu trong o Nhan vien* va bam nut Cap nhat tren NextGen.
 */
export async function submitRecallStaffUpdate(
  { targetStaff = '', rowIndex = 0 } = {},
  ctx = {}
) {
  const cleanStaff = cleanRecallText(targetStaff);
  if (!cleanStaff) {
    return {
      status: 'validation_error',
      message: 'Vui lòng chọn tên KTV mới trước khi cập nhật.',
    };
  }

  if (!isUserscriptEnv() || ctx.forceDemo) {
    return {
      status: 'ok',
      mode: 'demo',
      rowIndex,
      staff: cleanStaff,
      message: `Đã cập nhật KTV ${cleanStaff} (mẫu mô phỏng).`,
      snapshot: null,
    };
  }

  let st = await callRecallStaffOp('read_dialog', {}, ctx);
  if (!st || !st.isOpen) {
    return {
      status: 'dialog_closed',
      mode: 'live',
      message: 'Hộp thoại sửa vật tư trên NextGen đã đóng. Hãy bấm "Đổi KTV" lại.',
    };
  }

  const targetLower = cleanStaff.toLowerCase();
  const currentOpts = Array.isArray(st.staffOptions) ? st.staffOptions : [];
  const hasVisibleMatch =
    st.staffPanelOpen &&
    currentOpts.some((o) => o.toLowerCase() === targetLower || o.toLowerCase().includes(targetLower));

  if (!hasVisibleMatch) {
    const sr = await searchRecallStaffOptions(cleanStaff, ctx);
    if (sr.status !== 'ok') {
      return sr;
    }
  }

  let pickRes = await callRecallStaffOp('pick_staff_option', { targetStaff: cleanStaff }, ctx);
  if (!pickRes.ok) {
    return {
      status: 'error',
      mode: 'live',
      message: pickRes.error || `Không chọn được KTV "${cleanStaff}".`,
      dialogStillOpen: true,
    };
  }

  const pickVerifyDeadline = Date.now() + 1000;
  let retriedPick = false;
  while (Date.now() < pickVerifyDeadline) {
    await sleep(220);
    const verifySt = await callRecallStaffOp('read_dialog', {}, ctx);
    if (!verifySt || !verifySt.isOpen) break;
    if (
      verifySt.currentStaff &&
      verifySt.currentStaff.toLowerCase().includes(targetLower)
    ) {
      break;
    }
    if (!retriedPick && verifySt.staffPanelOpen) {
      retriedPick = true;
      await callRecallStaffOp('pick_staff_option', { targetStaff: cleanStaff }, ctx);
    }
  }

  const subRes = await callRecallStaffOp('submit_dialog', {}, ctx);
  if (!subRes.ok) {
    return {
      status: 'error',
      mode: 'live',
      message: subRes.error || 'Không bấm được nút "Cập nhật" trên hộp thoại NextGen.',
      dialogStillOpen: true,
    };
  }

  const submitDeadline = Date.now() + 5000;
  while (Date.now() < submitDeadline) {
    await sleep(250);
    const nextSt = await callRecallStaffOp('read_dialog', {}, ctx);
    if (!nextSt || !nextSt.isOpen) {
      await sleep(350);
      const after = await readRecallTicketSnapshotNow(ctx);
      const snapshot = after && 'snapshot' in after ? after.snapshot : after;
      const snack = (after && after.snackbarText) || (nextSt && nextSt.snackbarText) || '';
      return {
        status: 'ok',
        mode: 'live',
        rowIndex,
        staff: cleanStaff,
        message: snack || `Đã cập nhật KTV ${cleanStaff} thành công!`,
        snapshot,
      };
    }
    const errList = Array.isArray(nextSt.validationErrors) ? nextSt.validationErrors : [];
    const snackErr =
      nextSt.snackbarText &&
      /vui lòng|bắt buộc|lỗi|không thể|thất bại|chưa chọn/i.test(nextSt.snackbarText)
        ? nextSt.snackbarText
        : '';
    if (errList.length > 0 || snackErr) {
      return {
        status: 'validation_error',
        mode: 'live',
        message: errList.join(' • ') || snackErr,
        dialogStillOpen: true,
      };
    }
    st = nextSt;
  }

  return {
    status: 'validation_error',
    mode: 'live',
    message:
      (st && st.snackbarText) ||
      'NextGen chưa đóng hộp thoại sau khi bấm Cập nhật (có thể thiếu trường bắt buộc như Nguyên nhân). Bấm "Mở hộp thoại NextGen gốc" để hoàn tất.',
    dialogStillOpen: true,
  };
}

/**
 * Dong hop thoai Sua vat tu dang mo tren NextGen.
 */
export async function closeRecallStaffEditor(ctx = {}) {
  if (!isUserscriptEnv() || ctx.forceDemo) {
    return { ok: true, alreadyClosed: true };
  }
  return callRecallStaffOp('close_dialog', {}, ctx);
}

export async function triggerRecallPortalAction(actionType, payload = {}, doc = null) {
  const useLocalDoc =
    !canControlAndroidPortal() ||
    Boolean(doc && doc.location && isRecallTicketLocation(doc.location));

  if (useLocalDoc) {
    if (actionType === 'create_ticket') return triggerRecallCreateTicket(doc);
    if (actionType === 'select_ticket') {
      return triggerRecallSelectTicket(doc, payload.ticketIndex || 0);
    }
    if (actionType === 'add_equipment') return triggerRecallAddEquipment(doc);
    if (actionType === 'edit_equipment') {
      return triggerRecallEditEquipment(doc, payload.rowIndex || 0);
    }
    if (actionType === 'add_accessory') {
      return triggerRecallAddAccessory(doc, payload.rowIndex || 0);
    }
    if (actionType === 'submit_note') {
      return triggerRecallSubmitNote(doc, payload.note || '');
    }
    return { ok: false, error: 'Thao tác phiếu thu hồi không xác định.' };
  }

  const res = await evalRecallDom(
    `window.__riRecallDom.runAction(${JSON.stringify(actionType)}, ${JSON.stringify(payload || {})})`
  );
  if (!res.ok || !res.value) {
    return {
      ok: false,
      error: res.error || 'Không gửi được thao tác vào trang Phiếu thu hồi NextGen.',
    };
  }
  return res.value;
}

async function loadRecallTicketViaAndroidPortal(
  requestedContract,
  { onProgress = null, forceReload = false } = {}
) {
  const notify = (msg) => {
    if (typeof onProgress === 'function' && msg) {
      onProgress(msg);
    }
  };

  if (!forceReload) {
    const curCheck = await evalRecallDom('window.__riRecallDom.inspectState()');
    if (
      curCheck.ok &&
      curCheck.value &&
      !curCheck.value.sessionExpired &&
      curCheck.value.onTicket &&
      curCheck.value.snapshot
    ) {
      const curSnap = curCheck.value.snapshot;
      if (!requestedContract || !curSnap.contract || curSnap.contract === requestedContract) {
        return {
          status: 'ok',
          mode: 'live',
          snapshot: curSnap,
          requestedContract,
          contractMismatch: false,
        };
      }
    }
  }

  if (!requestedContract) {
    return {
      status: 'needs_contract_android',
      mode: 'live',
      contract: '',
      url: RECALL_ENDPOINTS.base,
      message:
        'Vui lòng nhập Mã hợp đồng ở màn hình chính trước khi mở Phiếu thu hồi vật tư.',
    };
  }

  notify('Đang kết nối cổng Thu hồi vật tư NextGen…');
  let didFoxBootstrap = false;
  let bgRes = await loadAndroidPortalBackground(RECALL_ENDPOINTS.base, {
    timeout: 18000,
  });
  if (!bgRes.ok && bgRes.status === 'needs_login') {
    notify('Đang đồng bộ phiên IAM cho cổng Vật tư…');
    const warmRes = await warmPortalSession(RECALL_ENDPOINTS.base, {
      timeout: 12000,
      force: true,
    });
    if (warmRes.ok) {
      bgRes = await loadAndroidPortalBackground(RECALL_ENDPOINTS.base, {
        timeout: 18000,
      });
    }
  }
  if (!bgRes.ok && bgRes.status === 'needs_login') {
    didFoxBootstrap = true;
    bgRes = await bootstrapNextGenViaFoxErpAndroid('recall', {
      onProgress: notify,
    });
  }

  if (!bgRes.ok) {
    if (bgRes.status === 'needs_login') {
      return {
        status: 'iam_expired',
        mode: 'live',
        contract: requestedContract,
        loginUrl: bgRes.loginUrl || FOX_ERP_HOME_URL,
        message:
          'Phiên đăng nhập IAM trên Fox-ERP / Vật tư NextGen đã hết hạn. Bấm "Đăng nhập IAM" bên dưới rồi thử lại.',
      };
    }
    return {
      status: 'error',
      mode: 'live',
      contract: requestedContract,
      message: 'Không kết nối được cổng Thu hồi vật tư NextGen (kiểm tra VPN / mạng nội bộ).',
    };
  }

  notify(`Đang tìm phiếu thu hồi HĐ ${requestedContract}…`);
  let openedMobileMenu = false;
  let searchSent = false;
  let searchDeadline = Date.now() + 8000;

  while (Date.now() < searchDeadline) {
    const stRes = await evalRecallDom('window.__riRecallDom.inspectState()');
    if (stRes.status === 'needs_login') {
      return {
        status: 'iam_expired',
        mode: 'live',
        contract: requestedContract,
        loginUrl: FOX_ERP_HOME_URL,
        message:
          'Phiên đăng nhập IAM trên NextGen Vật tư đã hết hạn. Bấm "Đăng nhập IAM" bên dưới rồi thử lại.',
      };
    }
    if (stRes.ok && stRes.value && stRes.value.sessionExpired) {
      if (didFoxBootstrap) {
        return {
          status: 'iam_expired',
          mode: 'live',
          contract: requestedContract,
          loginUrl: FOX_ERP_HOME_URL,
          message:
            'Phiên Thu hồi vật tư NextGen báo hết hạn. Bấm "Đăng nhập IAM" trên Fox-ERP rồi thử lại.',
        };
      }
      didFoxBootstrap = true;
      const foxRes = await bootstrapNextGenViaFoxErpAndroid('recall', {
        onProgress: notify,
      });
      if (!foxRes.ok) {
        return {
          status: foxRes.status === 'needs_login' ? 'iam_expired' : 'error',
          mode: 'live',
          contract: requestedContract,
          loginUrl: foxRes.loginUrl || FOX_ERP_HOME_URL,
          message:
            foxRes.error ||
            'Phiên Thu hồi vật tư NextGen đã hết hạn. Bấm "Đăng nhập IAM" trên Fox-ERP rồi thử lại.',
        };
      }
      openedMobileMenu = false;
      searchDeadline = Date.now() + 8000;
      continue;
    }
    if (stRes.ok && stRes.value) {
      const v = stRes.value;
      if (v.onTicket && v.snapshot && (!v.snapshot.contract || v.snapshot.contract === requestedContract)) {
        return {
          status: 'ok',
          mode: 'live',
          snapshot: v.snapshot,
          requestedContract,
          contractMismatch: false,
        };
      }
      if (!v.hasVisibleSearchInput && v.hasMenuToggle && !openedMobileMenu) {
        openedMobileMenu = true;
        await evalRecallDom('window.__riRecallDom.openMobileMenu()');
        await sleep(320);
        continue;
      }
      if (v.hasVisibleSearchInput || (openedMobileMenu && v.hasAnySearchInput)) {
        const sCall = await evalRecallDom(
          `window.__riRecallDom.searchContract(${JSON.stringify(requestedContract)})`
        );
        if (sCall.ok && sCall.value && sCall.value.ok) {
          searchSent = true;
          break;
        }
      }
    }
    await sleep(280);
  }

  if (!searchSent) {
    return {
      status: 'error',
      mode: 'live',
      contract: requestedContract,
      message: 'Chưa thấy ô "Nhập số hợp đồng" trên cổng Thu hồi vật tư. Bấm Thử lại sau vài giây.',
    };
  }

  notify(`Đang mở chi tiết phiếu thu hồi HĐ ${requestedContract}…`);
  const ticketDeadline = Date.now() + 14000;
  while (Date.now() < ticketDeadline) {
    await sleep(350);
    const stRes = await evalRecallDom('window.__riRecallDom.inspectState()');
    if (!stRes.ok || !stRes.value) continue;
    const v = stRes.value;
    if (
      v.onTicket &&
      v.snapshot &&
      (v.snapshot.contract ||
        v.snapshot.hasEmptyNotice ||
        v.snapshot.tickets.length > 0 ||
        v.snapshot.items.length > 0)
    ) {
      await sleep(250);
      const freshSnapRes = await evalRecallDom('window.__riRecallDom.readSnapshot()');
      const finalSnap =
        (freshSnapRes.ok && freshSnapRes.value) || v.snapshot;
      if (!finalSnap.contract) {
        finalSnap.contract = requestedContract;
      }
      return {
        status: 'ok',
        mode: 'live',
        snapshot: finalSnap,
        requestedContract,
        contractMismatch: false,
      };
    }
    if (
      !v.onTicket &&
      v.snackbarText &&
      /không tìm thấy|không tồn tại|không có hợp đồng|không hợp lệ/i.test(v.snackbarText)
    ) {
      return {
        status: 'error',
        mode: 'live',
        contract: requestedContract,
        message: v.snackbarText,
      };
    }
  }

  return {
    status: 'error',
    mode: 'live',
    contract: requestedContract,
    message: `Chưa nhận được phản hồi chi tiết phiếu thu hồi cho HĐ ${requestedContract}. Kiểm tra lại Mã HĐ rồi bấm Thử lại.`,
  };
}

export async function loadRecallTicketContext(rawContractId, ctx = {}) {
  const requestedContract = normalizeContractId(rawContractId || '');
  if (!isUserscriptEnv() || ctx.forceDemo) {
    return {
      status: 'ok',
      mode: 'demo',
      snapshot: buildDemoRecallSnapshot(requestedContract || 'SGN123456'),
      requestedContract,
      contractMismatch: false,
    };
  }

  const loc = ctx.pageLocation || null;
  const doc = ctx.pageDocument || null;

  if ((!isRecallPortalLocation(loc) || !doc) && canControlAndroidPortal()) {
    return loadRecallTicketViaAndroidPortal(requestedContract, {
      onProgress: ctx.onProgress || null,
      forceReload: Boolean(ctx.forceReload),
    });
  }

  if (isRecallPortalLocation(loc) && doc && isNextGenSessionExpiredDocument(doc)) {
    return {
      status: 'nextgen_session_expired',
      mode: 'live',
      contract: requestedContract,
      foxErpUrl: FOX_ERP_HOME_URL,
      message:
        'Phiên Thu hồi vật tư (NextGen) đã hết hạn. Bấm "Cấp lại phiên qua Fox-ERP" bên dưới để mở lại đúng luồng.',
    };
  }

  if (isRecallTicketLocation(loc) && doc) {
    const snapshot = parseRecallTicketFromDocument(doc, loc);
    const contractMismatch = Boolean(
      requestedContract && snapshot.contract && requestedContract !== snapshot.contract
    );
    return {
      status: 'ok',
      mode: 'live',
      snapshot,
      requestedContract,
      contractMismatch,
    };
  }

  if (isRecallPortalLocation(loc)) {
    return {
      status: 'on_search_page',
      mode: 'live',
      contract: requestedContract,
      url: RECALL_ENDPOINTS.base,
      message:
        'Bạn đang ở trang chủ Thu hồi vật tư. Bấm nút bên dưới để tự điền Mã HĐ và mở chi tiết phiếu thu hồi.',
    };
  }

  return {
    status: 'needs_recall_page',
    mode: 'live',
    contract: requestedContract,
    url: RECALL_ENDPOINTS.base,
    message:
      'Thu hồi vật tư chạy trên Blazor Server (nextgen.fpt.net/resource/recall). Bấm nút bên dưới để mở trang Thu hồi và tự động tìm Mã HĐ.',
  };
}

export async function runRecallAction(actionId, rawContractId, ctx = {}) {
  const rawTrimmed = String(rawContractId || '').trim();
  if (rawTrimmed) {
    const check = validateContractId(rawTrimmed);
    if (!check.valid) {
      return {
        status: 'validation_error',
        message: check.error,
      };
    }
  }

  if (actionId !== 'lookup_recall' && actionId !== 'manage_recall') {
    return {
      status: 'error',
      message: 'Thao tác không hợp lệ trên cổng Vật tư thu hồi.',
    };
  }

  const res = await loadRecallTicketContext(rawTrimmed, ctx);
  if (res.status === 'ok') {
    const snap = res.snapshot;
    const ticket = snap.activeTicket || {};
    const contractLabel = snap.contract || normalizeContractId(rawTrimmed) || 'Phiếu đang mở';
    const hasNoTickets = snap.tickets.length === 0 && snap.items.length === 0;

    if (hasNoTickets) {
      return {
        status: 'ok',
        mode: res.mode,
        title: `Vật tư thu hồi — ${contractLabel}`,
        message: `Hợp đồng ${contractLabel} hiện chưa có phiếu thu hồi trên hệ thống NextGen.`,
        summaryFields: [
          { label: 'Mã hợp đồng', value: contractLabel },
          { label: 'Trạng thái phiếu', value: 'Chưa có phiếu thu hồi' },
        ],
        snapshot: snap,
      };
    }

    const summaryFields = [
      { label: 'Mã hợp đồng', value: contractLabel },
      { label: 'Phiếu đang chọn', value: snap.activeTicketTitle || `Phiếu số ${ticket.ticketNumber || '1'}` },
      ticket.unit ? { label: 'Đơn vị', value: ticket.unit } : null,
      ticket.constructionSpec ? { label: 'Thông số thi công', value: ticket.constructionSpec } : null,
      {
        label: 'Tổng vật tư thu hồi',
        value: `${snap.stats.totalItems} mục (${snap.stats.importedCount} đã nhập kho, ${snap.stats.editableCount} sửa được)`,
      },
      ticket.updatedAt || ticket.updatedBy
        ? {
            label: 'Cập nhật gần nhất',
            value: [ticket.updatedAt, ticket.updatedBy].filter(Boolean).join(' • '),
          }
        : null,
    ].filter(Boolean);

    return {
      status: 'ok',
      mode: res.mode,
      title: `Vật tư thu hồi — ${contractLabel}`,
      message: `Phiếu số ${ticket.ticketNumber || '1'}: ${snap.stats.totalItems} vật tư (${snap.stats.importedCount} đã nhập kho, ${snap.stats.editableCount} sửa được).`,
      summaryFields,
      snapshot: snap,
    };
  }

  if (res.status === 'nextgen_session_expired') {
    return {
      status: 'iam_expired',
      mode: res.mode || 'live',
      title: 'Phiên NextGen Vật tư đã hết hạn',
      message:
        res.message ||
        'Phiên Thu hồi vật tư (NextGen) đã hết hạn. Hãy mở lại qua Fox-ERP rồi thử lại.',
      loginUrl: res.foxErpUrl || FOX_ERP_HOME_URL,
    };
  }

  if (res.status === 'iam_expired') {
    return {
      status: 'iam_expired',
      mode: res.mode || 'live',
      title: 'Cần đăng nhập IAM cổng Vật tư',
      message:
        res.message ||
        'Phiên đăng nhập IAM trên NextGen Vật tư đã hết hạn. Hãy bấm Đăng nhập IAM rồi thử lại.',
      loginUrl: res.loginUrl || RECALL_ENDPOINTS.base,
    };
  }

  if (res.status === 'error' || res.status === 'needs_contract_android') {
    return {
      status: res.status === 'needs_contract_android' ? 'validation_error' : 'error',
      mode: res.mode || 'live',
      title: 'Không đọc được Phiếu thu hồi',
      message: res.message || 'Lỗi kết nối cổng Thu hồi vật tư NextGen.',
    };
  }

  return {
    status: 'needs_scan',
    mode: res.mode || 'live',
    title: res.status === 'on_search_page' ? 'Đang ở trang tìm kiếm Thu hồi' : 'Cần mở trang Chi tiết thu hồi',
    message: res.message,
    loginUrl: RECALL_ENDPOINTS.base,
  };
}
