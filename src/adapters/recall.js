/**
 * Adapter thao tac Phieu thu hoi vat tu tren NextGen (https://nextgen.fpt.net/resource/recall/*).
 * Ung dung chay Blazor Server (Radzen.Blazor + MudBlazor qua SignalR), nen lop nay doc DOM truc tiep
 * va kich hoat dung control goc (Bam span#equipmentname de sua, nut + tao phieu, nut Them thiet bi...).
 *
 * Luu y Single-IIFE bundle: moi ten ham/hang top-level phai doc nhat trong toan bo src/.
 */

import { normalizeContractId, validateContractId } from '../config/portals.js';
import { isUserscriptEnv } from '../core/transport.js';

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
      canCreateTicket: false,
      canAddEquipment: false,
      canAddNote: false,
      openDialogTitle: '',
    };
  }

  const bodyText = getRecallElementText(doc.body);
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
      isRecallTicketLocation(loc) || tickets.length > 0 || items.length > 0 || Boolean(activeTicketTitle),
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
    canCreateTicket: true,
    canAddEquipment: true,
    canAddNote: true,
    openDialogTitle: '',
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

  return {
    status: 'needs_scan',
    mode: res.mode || 'live',
    title: res.status === 'on_search_page' ? 'Đang ở trang tìm kiếm Thu hồi' : 'Cần mở trang Chi tiết thu hồi',
    message: res.message,
    loginUrl: RECALL_ENDPOINTS.base,
  };
}
