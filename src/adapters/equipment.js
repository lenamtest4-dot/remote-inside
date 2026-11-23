/**
 * Adapter doc Bao cao Ton cong no vat tu theo NV tren NextGen
 * (https://nextgen.fpt.net/resource/equipment/ -> Bao cao / Bao cao no -> Ton cong no theo NV).
 *
 * Bang Radzen co ~91 cot vat tu theo nhom va phan trang theo danh sach KTV (~10-100 dong/trang).
 * Adapter nay tu tang page-size len muc toi da (100/trang), duyet du tat ca cac trang,
 * va loc theo tung vat tu de chi hien thi cac KTV dang ton > 0.
 *
 * Luu y Single-IIFE bundle: moi ten ham/hang top-level phai doc nhat trong toan bo src/.
 */

import { isUserscriptEnv, sleep } from '../core/transport.js';

export const EQUIPMENT_ENDPOINTS = {
  base: 'https://nextgen.fpt.net/resource/equipment/',
  rootPath: '/resource/equipment',
};

export function cleanEquipmentText(raw) {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeEquipmentMatchKey(raw) {
  const text = cleanEquipmentText(raw);
  try {
    return text.normalize('NFC').toLowerCase();
  } catch {
    return text.toLowerCase();
  }
}

function getEquipmentElText(el) {
  if (!el) return '';
  return cleanEquipmentText(el.innerText !== undefined ? el.innerText : el.textContent);
}

export function isEquipmentPortalLocation(loc) {
  if (!loc) return false;
  const host = String(loc.hostname || '').toLowerCase();
  const path = String(loc.pathname || '').toLowerCase();
  return host === 'nextgen.fpt.net' && path.startsWith(EQUIPMENT_ENDPOINTS.rootPath);
}

export function parseEquipmentDebtNumber(raw) {
  const s = cleanEquipmentText(raw).replace(/\s+/g, '');
  if (!s) return 0;
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
  if (/^-?\d+,\d+$/.test(s)) {
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }
  const stripped = s.replace(/[^0-9.-]/g, '');
  if (!stripped || stripped === '-' || stripped === '.') return 0;
  const fallback = Number(stripped);
  return Number.isFinite(fallback) ? fallback : 0;
}

export function findEquipmentDebtGrid(doc) {
  if (!doc || typeof doc.querySelectorAll !== 'function') return null;
  const grids = Array.from(doc.querySelectorAll('.rz-data-grid'));
  for (const grid of grids) {
    if (typeof grid.querySelectorAll !== 'function') continue;
    const cells = Array.from(grid.querySelectorAll('thead th, thead td'));
    if (cells.some((cell) => /^nhân viên$/i.test(getEquipmentElText(cell)))) {
      return grid;
    }
  }
  return null;
}

function findEquipmentTableInGrid(grid) {
  if (!grid || typeof grid.querySelector !== 'function') return null;
  return grid.querySelector('table.rz-grid-table') || grid.querySelector('table') || null;
}

export function getEquipmentRealBodyRows(tableEl) {
  if (!tableEl || typeof tableEl.querySelectorAll !== 'function') return [];
  const allRows = Array.from(tableEl.querySelectorAll('tbody tr'));
  return allRows.filter((tr) => {
    if (!tr) return false;
    const cls = String(tr.className || '');
    if (/rz-datatable-emptymessage-row/i.test(cls)) return false;
    if (typeof tr.querySelectorAll === 'function') {
      const cells = Array.from(tr.querySelectorAll('td, th'));
      if (cells.length < 2) return false;
      const firstText = getEquipmentElText(cells[0]);
      if (!firstText || /^no records to display\.?$|^không có dữ liệu\.?$/i.test(firstText)) {
        return false;
      }
    }
    return true;
  });
}

function findEquipmentReportMenuBtn(doc) {
  if (!doc || typeof doc.querySelectorAll !== 'function') return null;
  return (
    Array.from(doc.querySelectorAll('button')).find((b) =>
      /^báo cáo$/i.test(getEquipmentElText(b))
    ) || null
  );
}

function findEquipmentFilterField(doc, fieldKind) {
  if (!doc || typeof doc.querySelectorAll !== 'function') return null;
  const labelRe =
    fieldKind === 'region'
      ? /^vùng$/i
      : fieldKind === 'province'
      ? /^tỉnh thành$/i
      : fieldKind === 'partner'
      ? /^đối tác$/i
      : null;
  if (!labelRe) return null;
  const fields = Array.from(doc.querySelectorAll('.rz-form-field'));
  for (const field of fields) {
    if (!field || typeof field.querySelector !== 'function') continue;
    const labelEl = field.querySelector('label, .rz-form-field-label');
    if (labelRe.test(getEquipmentElText(labelEl))) {
      return field;
    }
  }
  return null;
}

function findEquipmentFilterDropdownAndPanel(doc, fieldKind) {
  const field = findEquipmentFilterField(doc, fieldKind);
  if (!field || typeof field.querySelector !== 'function') {
    return { field: null, dd: null, panel: null };
  }
  const dd = field.querySelector('.rz-dropdown, .rz-multiselect');
  const ddId = dd && dd.id ? dd.id : '';
  let panel = null;
  if (ddId && typeof doc.getElementById === 'function') {
    panel = doc.getElementById(`popup-${ddId}`) || doc.getElementById(`popup${ddId}`);
  }
  return { field, dd, panel };
}

export function readEquipmentFilterState(doc) {
  const result = {
    region: '',
    province: '',
    partner: '',
    hasRegion: false,
    hasProvince: false,
    hasPartner: false,
    missingRequired: false,
  };
  if (!doc || typeof doc.querySelectorAll !== 'function') return result;
  const fields = Array.from(doc.querySelectorAll('.rz-form-field'));
  let sawAnyField = false;

  for (const field of fields) {
    if (!field || typeof field.querySelector !== 'function') continue;
    const labelEl = field.querySelector('label, .rz-form-field-label');
    const labelText = getEquipmentElText(labelEl);
    if (!/^(?:vùng|tỉnh thành|đối tác)$/i.test(labelText)) continue;
    sawAnyField = true;

    const dd = field.querySelector('.rz-dropdown, .rz-multiselect');
    const ddCls = String((dd && dd.className) || '');
    const ddText = dd ? getEquipmentElText(dd) : '';
    const hasVal = Boolean(ddText && !/rz-state-empty/i.test(ddCls));
    if (/^vùng$/i.test(labelText)) {
      result.hasRegion = hasVal;
      result.region = hasVal ? ddText : '';
    }
    if (/^tỉnh thành$/i.test(labelText)) {
      result.hasProvince = hasVal;
      result.province = hasVal ? ddText : '';
    }
    if (/^đối tác$/i.test(labelText)) {
      result.hasPartner = hasVal;
      result.partner = hasVal ? ddText : '';
    }
  }

  if (sawAnyField) {
    result.missingRequired = !(result.hasRegion && result.hasProvince && result.hasPartner);
  }
  return result;
}

export function readEquipmentFilterOptions(doc, fieldKind) {
  const { dd, panel } = findEquipmentFilterDropdownAndPanel(doc, fieldKind);
  if (!dd) {
    return { current: '', options: [] };
  }
  const ddCls = String(dd.className || '');
  const rawCurrent = getEquipmentElText(dd);
  const current = rawCurrent && !/rz-state-empty/i.test(ddCls) ? rawCurrent : '';

  const seen = new Set();
  const options = [];
  if (panel && typeof panel.querySelectorAll === 'function') {
    const items = Array.from(panel.querySelectorAll('.rz-dropdown-item, .rz-multiselect-item'));
    for (const item of items) {
      const txt = getEquipmentElText(item);
      if (!txt) continue;
      const norm = normalizeEquipmentMatchKey(txt);
      if (seen.has(norm)) continue;
      seen.add(norm);
      options.push(txt);
    }
  }
  return { current, options };
}

export async function selectEquipmentFilterOption(
  doc,
  fieldKind,
  targetText,
  { waitNextKind = '', waitTimeoutMs = 4500 } = {}
) {
  const targetNorm = normalizeEquipmentMatchKey(targetText);
  if (!targetNorm) {
    return { ok: false, error: 'Giá trị bộ lọc cần chọn đang trống.' };
  }

  const { dd, panel: initialPanel } = findEquipmentFilterDropdownAndPanel(doc, fieldKind);
  if (!dd) {
    return { ok: false, error: `Không tìm thấy ô chọn "${fieldKind}" trên trang Báo cáo nợ.` };
  }

  const ddCls = String(dd.className || '');
  const curText = !/rz-state-empty/i.test(ddCls) ? getEquipmentElText(dd) : '';
  if (curText && normalizeEquipmentMatchKey(curText) === targetNorm) {
    if (waitNextKind) {
      const existingNext = readEquipmentFilterOptions(doc, waitNextKind);
      if (existingNext.options.length > 0) {
        return { ok: true, skipped: true, picked: curText };
      }
    } else {
      return { ok: true, skipped: true, picked: curText };
    }
  }

  const clearBtn =
    typeof dd.querySelector === 'function' ? dd.querySelector('.rz-dropdown-clear-icon') : null;
  if (curText && clearBtn && typeof clearBtn.click === 'function') {
    clearBtn.click();
    await sleep(200);
  }

  if (typeof dd.click === 'function') {
    dd.click();
    await sleep(180);
  }

  const panel = findEquipmentFilterDropdownAndPanel(doc, fieldKind).panel || initialPanel;
  if (!panel || typeof panel.querySelectorAll !== 'function') {
    return { ok: false, error: `Không mở được danh sách chọn cho "${fieldKind}".` };
  }

  const items = Array.from(panel.querySelectorAll('.rz-dropdown-item, .rz-multiselect-item'));
  let match = items.find((el) => normalizeEquipmentMatchKey(getEquipmentElText(el)) === targetNorm);
  if (!match) {
    match = items.find((el) => normalizeEquipmentMatchKey(getEquipmentElText(el)).includes(targetNorm));
  }
  if (!match || typeof match.click !== 'function') {
    return { ok: false, error: `Không tìm thấy mục "${targetText}" trong danh sách "${fieldKind}".` };
  }

  const picked = getEquipmentElText(match);
  match.click();
  await sleep(150);

  // Neu Radzen multi-select popup van mo sau khi chon, dong gon lai
  try {
    if (
      typeof getComputedStyle === 'function' &&
      panel.offsetParent !== null &&
      getComputedStyle(panel).display !== 'none' &&
      typeof dd.click === 'function'
    ) {
      dd.click();
      await sleep(100);
    }
  } catch {
    // Bo qua trong moi truong mock Node
  }

  if (waitNextKind) {
    const deadline = Date.now() + waitTimeoutMs;
    while (Date.now() < deadline) {
      await sleep(150);
      const nextOpts = readEquipmentFilterOptions(doc, waitNextKind);
      if (nextOpts.options.length > 0) {
        await sleep(150);
        break;
      }
    }
  }

  return { ok: true, picked };
}

export async function applyEquipmentDebtFilterToPage(doc, filter, { onProgress = null } = {}) {
  const region = cleanEquipmentText(filter && filter.region);
  const province = cleanEquipmentText(filter && filter.province);
  const partner = cleanEquipmentText(filter && filter.partner);
  if (!region || !province || !partner) {
    return { ok: false, error: 'Bộ lọc cố định cần đủ Vùng, Tỉnh thành và Đối tác.' };
  }

  if (typeof onProgress === 'function') onProgress('Đang chọn Vùng cố định…');
  const rRes = await selectEquipmentFilterOption(doc, 'region', region, {
    waitNextKind: 'province',
  });
  if (!rRes.ok) return rRes;

  if (typeof onProgress === 'function') onProgress('Đang chọn Tỉnh thành cố định…');
  const pRes = await selectEquipmentFilterOption(doc, 'province', province, {
    waitNextKind: 'partner',
  });
  if (!pRes.ok) return pRes;

  if (typeof onProgress === 'function') onProgress('Đang chọn Đối tác cố định…');
  const prRes = await selectEquipmentFilterOption(doc, 'partner', partner);
  if (!prRes.ok) return prRes;

  return {
    ok: true,
    applied: {
      region: rRes.picked,
      province: pRes.picked,
      partner: prRes.picked,
    },
  };
}

export function parseEquipmentDebtPagerInfo(scopeEl) {
  const fallback = { currentPage: 1, totalPages: 1, totalItems: 0, rawText: '' };
  if (!scopeEl || typeof scopeEl.querySelector !== 'function') return fallback;
  const summaryEl = scopeEl.querySelector('.rz-pager-summary');
  const rawText = getEquipmentElText(summaryEl);
  if (!rawText) return fallback;

  const enMatch = rawText.match(/Page\s+(\d+)\s+of\s+(\d+)\s*(?:\((\d+)\s+items?\))?/i);
  if (enMatch) {
    return {
      currentPage: Math.max(1, Number(enMatch[1]) || 1),
      totalPages: Math.max(1, Number(enMatch[2]) || 1),
      totalItems: Number(enMatch[3]) || 0,
      rawText,
    };
  }

  const viMatch = rawText.match(/Trang\s+(\d+)\s*(?:\/|trên|của)\s*(\d+)/i);
  if (viMatch) {
    const countMatch = rawText.match(/\((\d+)/);
    return {
      currentPage: Math.max(1, Number(viMatch[1]) || 1),
      totalPages: Math.max(1, Number(viMatch[2]) || 1),
      totalItems: countMatch ? Number(countMatch[1]) || 0 : 0,
      rawText,
    };
  }

  return fallback;
}

export function findEquipmentDebtPageControls(doc) {
  if (!doc || typeof doc.querySelectorAll !== 'function') {
    return {
      hasDebtTab: false,
      isDebtTabActive: false,
      tabEl: null,
      viewListBtn: null,
      grid: null,
    };
  }
  const tabs = Array.from(doc.querySelectorAll('.rz-tabview-nav li, [role="tab"]'));
  const tabEl =
    tabs.find((el) => /^tồn công nợ theo nv$/i.test(getEquipmentElText(el))) || null;
  const isDebtTabActive = Boolean(
    tabEl &&
      (/rz-tabview-selected/i.test(String(tabEl.className || '')) ||
        (typeof tabEl.getAttribute === 'function' && tabEl.getAttribute('aria-selected') === 'true'))
  );

  const viewListBtn =
    Array.from(doc.querySelectorAll('button')).find((b) =>
      /xem danh sách/i.test(getEquipmentElText(b))
    ) || null;

  const grid = findEquipmentDebtGrid(doc);
  return {
    hasDebtTab: Boolean(tabEl),
    isDebtTabActive,
    tabEl,
    viewListBtn,
    grid,
  };
}

export function parseEquipmentDebtColumns(tableEl) {
  if (!tableEl || typeof tableEl.querySelectorAll !== 'function') {
    return { staffColIndex: 0, materials: [] };
  }
  const theadRows = Array.from(tableEl.querySelectorAll('thead tr'));
  if (theadRows.length === 0) {
    return { staffColIndex: 0, materials: [] };
  }

  let staffColIndex = 0;
  const materials = [];

  if (theadRows.length >= 2) {
    const topCells = Array.from(theadRows[0].querySelectorAll('th, td'));
    const groupBySubIdx = [];
    let leadingFixedCount = 0;

    for (let idx = 0; idx < topCells.length; idx += 1) {
      const cell = topCells[idx];
      const text = getEquipmentElText(cell);
      const rSpan = Math.max(1, Number(cell.rowSpan || (cell.getAttribute && cell.getAttribute('rowspan')) || 1));
      const cSpan = Math.max(1, Number(cell.colSpan || (cell.getAttribute && cell.getAttribute('colspan')) || 1));

      if (/^nhân viên$/i.test(text) || rSpan >= 2) {
        if (/^nhân viên$/i.test(text)) {
          staffColIndex = leadingFixedCount;
        }
        leadingFixedCount += cSpan;
        continue;
      }

      for (let k = 0; k < cSpan; k += 1) {
        groupBySubIdx.push(text || 'Khác');
      }
    }

    const subCells = Array.from(theadRows[1].querySelectorAll('th, td'));
    for (let i = 0; i < subCells.length; i += 1) {
      const colIndex = i + leadingFixedCount;
      const matName = getEquipmentElText(subCells[i]) || `Vật tư #${colIndex}`;
      materials.push({
        key: `col_${colIndex}`,
        colIndex,
        group: groupBySubIdx[i] || 'Khác',
        name: matName,
      });
    }

    return { staffColIndex, materials };
  }

  const singleCells = Array.from(theadRows[0].querySelectorAll('th, td'));
  for (let i = 0; i < singleCells.length; i += 1) {
    const text = getEquipmentElText(singleCells[i]);
    if (i === 0 || /^nhân viên$/i.test(text)) {
      if (/^nhân viên$/i.test(text)) staffColIndex = i;
      continue;
    }
    materials.push({
      key: `col_${i}`,
      colIndex: i,
      group: 'Vật tư',
      name: text || `Vật tư #${i}`,
    });
  }

  return { staffColIndex, materials };
}

export function parseEquipmentDebtPageRows(tableEl, columnsInfo) {
  if (!tableEl || typeof tableEl.querySelectorAll !== 'function') return [];
  const staffIdx = columnsInfo && Number.isFinite(columnsInfo.staffColIndex)
    ? columnsInfo.staffColIndex
    : 0;
  const materials = (columnsInfo && Array.isArray(columnsInfo.materials) && columnsInfo.materials) || [];
  const trList = getEquipmentRealBodyRows(tableEl);
  const parsed = [];

  for (const tr of trList) {
    if (!tr || typeof tr.querySelectorAll !== 'function') continue;
    const cells = Array.from(tr.querySelectorAll('td, th'));
    if (cells.length < 2) continue;
    const staff = getEquipmentElText(cells[staffIdx]);
    if (!staff) continue;

    const stocks = {};
    for (const mat of materials) {
      const cell = cells[mat.colIndex];
      if (!cell) continue;
      const qty = parseEquipmentDebtNumber(getEquipmentElText(cell));
      if (qty > 0) {
        stocks[mat.key] = qty;
      }
    }
    parsed.push({ staff, stocks });
  }

  return parsed;
}

export function buildEquipmentDebtDataset(materials = [], rowsInput = [], meta = {}) {
  const rowMap = new Map();
  for (const r of rowsInput) {
    if (!r || !r.staff) continue;
    rowMap.set(r.staff, {
      staff: r.staff,
      stocks: r.stocks && typeof r.stocks === 'object' ? { ...r.stocks } : {},
    });
  }
  const rows = Array.from(rowMap.values());

  const matTotals = new Map();
  const matCounts = new Map();
  for (const row of rows) {
    for (const [key, val] of Object.entries(row.stocks)) {
      const qty = Number(val || 0);
      if (qty > 0) {
        matTotals.set(key, (matTotals.get(key) || 0) + qty);
        matCounts.set(key, (matCounts.get(key) || 0) + 1);
      }
    }
  }

  const enrichedMaterials = materials.map((mat) => ({
    ...mat,
    totalQty: matTotals.get(mat.key) || 0,
    holderCount: matCounts.get(mat.key) || 0,
  }));

  const groupMap = new Map();
  for (const mat of enrichedMaterials) {
    const gName = mat.group || 'Khác';
    if (!groupMap.has(gName)) {
      groupMap.set(gName, { name: gName, materialCount: 0, activeMaterialCount: 0 });
    }
    const gObj = groupMap.get(gName);
    gObj.materialCount += 1;
    if (mat.holderCount > 0) {
      gObj.activeMaterialCount += 1;
    }
  }

  return {
    materials: enrichedMaterials,
    groups: Array.from(groupMap.values()),
    rows,
    totalStaff: rows.length,
    totalMaterials: enrichedMaterials.length,
    activeMaterials: enrichedMaterials.filter((m) => m.holderCount > 0).length,
    meta,
  };
}

export function queryEquipmentDebtHolders(
  dataset,
  materialKey,
  { sortBy = 'qty_desc', staffSearch = '' } = {}
) {
  if (!dataset || !materialKey) {
    return { material: null, holders: [], totalQty: 0, holderCount: 0 };
  }
  const material = (dataset.materials || []).find((m) => m.key === materialKey) || null;
  const q = cleanEquipmentText(staffSearch).toLowerCase();
  const holders = [];
  let totalQty = 0;

  for (const row of dataset.rows || []) {
    const qty = Number((row.stocks && row.stocks[materialKey]) || 0);
    if (!(qty > 0)) continue;
    totalQty += qty;
    if (q && !row.staff.toLowerCase().includes(q)) continue;
    holders.push({ staff: row.staff, qty });
  }

  if (sortBy === 'name_asc') {
    holders.sort((a, b) => a.staff.localeCompare(b.staff));
  } else {
    holders.sort((a, b) => b.qty - a.qty || a.staff.localeCompare(b.staff));
  }

  return {
    material,
    holders,
    totalQty,
    holderCount: holders.length,
  };
}

export function queryEquipmentDebtByStaff(dataset, staffName) {
  const target = cleanEquipmentText(staffName);
  if (!dataset || !target) {
    return { staff: target, items: [], totalQty: 0, itemCount: 0 };
  }
  const row = (dataset.rows || []).find((r) => r.staff === target);
  if (!row) {
    return { staff: target, items: [], totalQty: 0, itemCount: 0 };
  }

  const items = [];
  let totalQty = 0;
  for (const mat of dataset.materials || []) {
    const qty = Number((row.stocks && row.stocks[mat.key]) || 0);
    if (!(qty > 0)) continue;
    totalQty += qty;
    items.push({
      key: mat.key,
      group: mat.group || 'Khác',
      name: mat.name,
      qty,
    });
  }
  items.sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name));

  return {
    staff: row.staff,
    items,
    totalQty,
    itemCount: items.length,
  };
}

export function formatEquipmentDebtClipboardText(queryResult) {
  if (!queryResult || !queryResult.material) return '';
  const { material, holders = [], totalQty = 0, holderCount = holders.length } = queryResult;
  const header = `Tồn vật tư: ${material.name}${material.group ? ` (${material.group})` : ''}`;
  const summary = `Tổng tồn: ${totalQty} • ${holderCount} KTV đang giữ`;
  if (holders.length === 0) {
    return `${header}\n${summary}\n(Không có KTV đang tồn)`;
  }
  const lines = holders.map((h, i) => `${i + 1}. ${h.staff}: ${h.qty}`);
  return `${header}\n${summary}\n${lines.join('\n')}`;
}

function isEquipmentPagerDisabled(el) {
  if (!el) return true;
  if (el.disabled) return true;
  const cls = String(el.className || '');
  if (/rz-state-disabled|disabled/i.test(cls)) return true;
  if (typeof el.getAttribute === 'function') {
    const disAttr = el.getAttribute('disabled');
    if (disAttr !== null && disAttr !== undefined && disAttr !== 'false') {
      return true;
    }
    if (el.getAttribute('aria-disabled') === 'true') {
      return true;
    }
  }
  return false;
}

function readEquipmentGridSnapshotState(grid) {
  const pager = parseEquipmentDebtPagerInfo(grid);
  const table = findEquipmentTableInGrid(grid);
  const rows = getEquipmentRealBodyRows(table);
  const firstCell =
    rows[0] && typeof rows[0].querySelector === 'function'
      ? rows[0].querySelector('td, th')
      : null;
  const lastRow = rows.length > 0 ? rows[rows.length - 1] : null;
  const lastCell =
    lastRow && typeof lastRow.querySelector === 'function'
      ? lastRow.querySelector('td, th')
      : null;
  return {
    currentPage: pager.currentPage,
    totalPages: pager.totalPages,
    totalItems: pager.totalItems,
    rowCount: rows.length,
    firstStaff: getEquipmentElText(firstCell),
    lastStaff: getEquipmentElText(lastCell),
  };
}

async function waitForEquipmentPageContentChange(
  grid,
  prevState,
  { mode = 'page', timeoutMs = 5500 } = {}
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(150);
    const next = readEquipmentGridSnapshotState(grid);
    if (next.rowCount === 0) continue;
    const contentChanged =
      next.firstStaff !== prevState.firstStaff ||
      next.lastStaff !== prevState.lastStaff ||
      next.rowCount !== prevState.rowCount;
    const changed =
      mode === 'pagesize'
        ? next.rowCount !== prevState.rowCount || next.totalPages !== prevState.totalPages
        : contentChanged;
    if (changed) {
      await sleep(180);
      return true;
    }
  }
  return false;
}

export async function collectEquipmentDebtFromDocument(
  doc,
  { onProgress = null, maxPages = 30, waitMs = 5500 } = {}
) {
  const ctrls = findEquipmentDebtPageControls(doc);
  const grid = ctrls.grid;
  if (!grid) {
    return {
      status: 'needs_report_loaded',
      hasDebtTab: ctrls.hasDebtTab,
      isDebtTabActive: ctrls.isDebtTabActive,
      hasViewListBtn: Boolean(ctrls.viewListBtn),
      hasReportMenuBtn: Boolean(findEquipmentReportMenuBtn(doc)),
      filterMissing: readEquipmentFilterState(doc).missingRequired,
      message:
        'Chưa thấy bảng "Tồn công nợ theo NV" trên trang. Hãy vào Báo cáo → Báo cáo nợ → Xem danh sách.',
    };
  }

  let table = findEquipmentTableInGrid(grid);
  let pagerInfo = parseEquipmentDebtPagerInfo(grid);

  // Step A: Tang page size len muc lon nhat (thuong la 100/trang) de giam so trang can quet
  if (pagerInfo.totalPages > 1 && typeof grid.querySelector === 'function') {
    const pagerEl = grid.querySelector('.rz-pager');
    const dd = pagerEl && typeof pagerEl.querySelector === 'function'
      ? pagerEl.querySelector('.rz-dropdown')
      : null;
    if (dd) {
      const currentSize = parseEquipmentDebtNumber(getEquipmentElText(dd));
      const ddId = dd.id || '';
      let panel = null;
      if (ddId && typeof doc.getElementById === 'function') {
        panel = doc.getElementById(`popup-${ddId}`) || doc.getElementById(`popup${ddId}`);
      }
      if (!panel && typeof doc.querySelectorAll === 'function') {
        panel =
          Array.from(doc.querySelectorAll('.rz-dropdown-panel')).find((p) => {
            const items = Array.from(p.querySelectorAll('.rz-dropdown-item')).map((x) =>
              getEquipmentElText(x)
            );
            return items.includes('100') || items.includes('50') || items.includes('25');
          }) || null;
      }

      if (panel && typeof panel.querySelectorAll === 'function') {
        const numericItems = Array.from(panel.querySelectorAll('.rz-dropdown-item'))
          .map((item) => ({
            el: item,
            size: parseEquipmentDebtNumber(getEquipmentElText(item)),
          }))
          .filter((x) => x.size > 0);
        numericItems.sort((a, b) => b.size - a.size);
        const best = numericItems[0];
        if (best && best.size > currentSize && typeof best.el.click === 'function') {
          const prevSnap = readEquipmentGridSnapshotState(grid);
          if (typeof dd.click === 'function') {
            dd.click();
            await sleep(80);
          }
          best.el.click();
          await waitForEquipmentPageContentChange(grid, prevSnap, {
            mode: 'pagesize',
            timeoutMs: Math.min(waitMs, 3500),
          });
          pagerInfo = parseEquipmentDebtPagerInfo(grid);
        }
      }
    }
  }

  // Step B: Neu dang khong o trang 1, quay ve trang 1 truoc khi quet
  if (pagerInfo.currentPage > 1 && typeof grid.querySelector === 'function') {
    const pagerEl = grid.querySelector('.rz-pager');
    const firstBtn =
      pagerEl && typeof pagerEl.querySelector === 'function'
        ? pagerEl.querySelector('.rz-pager-first')
        : null;
    if (firstBtn && !isEquipmentPagerDisabled(firstBtn) && typeof firstBtn.click === 'function') {
      const prevSnap = readEquipmentGridSnapshotState(grid);
      firstBtn.click();
      await waitForEquipmentPageContentChange(grid, prevSnap, {
        mode: 'page',
        timeoutMs: waitMs,
      });
      pagerInfo = parseEquipmentDebtPagerInfo(grid);
    }
  }

  // Step C: Duyet qua toan bo cac trang va gop danh sach KTV
  let columnsInfo = null;
  const staffMap = new Map();
  let pagesScanned = 0;

  for (let step = 0; step < maxPages; step += 1) {
    table = findEquipmentTableInGrid(grid);
    pagerInfo = parseEquipmentDebtPagerInfo(grid);
    if (!table) break;

    if (!columnsInfo) {
      columnsInfo = parseEquipmentDebtColumns(table);
    }
    const pageRows = parseEquipmentDebtPageRows(table, columnsInfo);
    for (const row of pageRows) {
      staffMap.set(row.staff, row);
    }
    pagesScanned += 1;

    if (typeof onProgress === 'function') {
      onProgress({
        currentPage: pagerInfo.currentPage,
        totalPages: pagerInfo.totalPages,
        collectedStaff: staffMap.size,
        totalItems: pagerInfo.totalItems,
      });
    }

    if (pagerInfo.currentPage >= pagerInfo.totalPages) {
      break;
    }

    const pagerEl = typeof grid.querySelector === 'function' ? grid.querySelector('.rz-pager') : null;
    const nextBtn =
      pagerEl && typeof pagerEl.querySelector === 'function'
        ? pagerEl.querySelector('.rz-pager-next')
        : null;
    if (!nextBtn || isEquipmentPagerDisabled(nextBtn) || typeof nextBtn.click !== 'function') {
      break;
    }

    const prevSnap = readEquipmentGridSnapshotState(grid);
    nextBtn.click();
    const changed = await waitForEquipmentPageContentChange(grid, prevSnap, {
      mode: 'page',
      timeoutMs: waitMs,
    });
    if (!changed) {
      break;
    }
  }

  const finalMaterials = (columnsInfo && columnsInfo.materials) || [];
  const dataset = buildEquipmentDebtDataset(finalMaterials, Array.from(staffMap.values()), {
    pagesScanned,
    totalPages: pagerInfo.totalPages,
    expectedItems: pagerInfo.totalItems,
  });

  return {
    status: 'ok',
    mode: 'live',
    dataset,
  };
}

export async function triggerEquipmentOpenDebtReportMenu(doc) {
  const reportBtn = findEquipmentReportMenuBtn(doc);
  if (!reportBtn || typeof reportBtn.click !== 'function') {
    return { ok: false, error: 'Không tìm thấy menu "Báo cáo" trên trang Quản lý vật tư.' };
  }
  reportBtn.click();
  await sleep(280);
  if (!doc || typeof doc.querySelectorAll !== 'function') {
    return { ok: false, error: 'Không mở được danh sách menu Báo cáo.' };
  }
  const items = Array.from(
    doc.querySelectorAll('.mud-popover-open .mud-list-item, .mud-list-item, .mud-menu-item')
  );
  const debtItem = items.find((el) => /^báo cáo nợ$/i.test(getEquipmentElText(el))) || null;
  if (!debtItem || typeof debtItem.click !== 'function') {
    return { ok: false, error: 'Không tìm thấy mục "Báo cáo nợ" trong menu Báo cáo.' };
  }
  debtItem.click();
  return { ok: true };
}

export async function waitForEquipmentDebtTabOpen(doc, { timeoutMs = 4500 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(200);
    if (findEquipmentDebtPageControls(doc).hasDebtTab) {
      return true;
    }
  }
  return false;
}

export async function waitForEquipmentReportLoad(doc, { timeoutMs = 15000, onTick = null } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(300);
    const grid = findEquipmentDebtGrid(doc);
    const table = findEquipmentTableInGrid(grid);
    const realRows = getEquipmentRealBodyRows(table);
    const cols = table ? parseEquipmentDebtColumns(table) : { materials: [] };
    if (typeof onTick === 'function') {
      onTick({ rows: realRows.length, cols: cols.materials.length });
    }
    if (realRows.length > 0 && cols.materials.length > 0) {
      await sleep(200);
      return true;
    }
  }
  return false;
}

export function triggerEquipmentDebtTab(doc) {
  const ctrls = findEquipmentDebtPageControls(doc);
  if (!ctrls.tabEl) {
    return { ok: false, error: 'Không tìm thấy tab "Tồn công nợ theo NV" trên trang.' };
  }
  const target =
    typeof ctrls.tabEl.querySelector === 'function'
      ? ctrls.tabEl.querySelector('a') || ctrls.tabEl
      : ctrls.tabEl;
  if (!target || typeof target.click !== 'function') {
    return { ok: false, error: 'Không bấm được tab "Tồn công nợ theo NV".' };
  }
  target.click();
  return { ok: true };
}

export function triggerEquipmentDebtViewList(doc) {
  const ctrls = findEquipmentDebtPageControls(doc);
  if (!ctrls.viewListBtn || typeof ctrls.viewListBtn.click !== 'function') {
    return { ok: false, error: 'Không tìm thấy nút "Xem danh sách" trên trang Báo cáo nợ.' };
  }
  ctrls.viewListBtn.click();
  return { ok: true };
}

export function buildDemoEquipmentDebtDataset() {
  const materials = [
    { key: 'col_1', colIndex: 1, group: 'Cap', name: 'Day thue bao quang dem chat FTTH 1core (Mẫu)' },
    { key: 'col_2', colIndex: 2, group: 'Cap', name: 'Cap ben chat (Mẫu)' },
    { key: 'col_3', colIndex: 3, group: 'Modem', name: 'Access Point AX3000CV2 (Mẫu)' },
    { key: 'col_4', colIndex: 4, group: 'Modem', name: 'Internet Hub AX3000GZV3 (Mẫu)' },
    { key: 'col_5', colIndex: 5, group: 'Vat tu FPT Play box', name: 'FPT Play Box 650 (Mẫu)' },
    { key: 'col_6', colIndex: 6, group: 'FPT Camera', name: 'FCAM-IQ 4S (Mẫu)' },
  ];
  const rows = [
    { staff: 'KTV.MAU01', stocks: { col_1: 1200, col_3: 2, col_5: 1 } },
    { staff: 'KTV.MAU02', stocks: { col_1: 650, col_4: 3, col_6: 2 } },
    { staff: 'KTV.MAU03', stocks: { col_1: 480, col_3: 1 } },
    { staff: 'KTV.MAU04', stocks: { col_4: 1, col_5: 2, col_6: 1 } },
    { staff: 'KTV.MAU05', stocks: { col_6: 4 } },
  ];
  return buildEquipmentDebtDataset(materials, rows, {
    pagesScanned: 1,
    totalPages: 1,
    expectedItems: rows.length,
  });
}

export async function loadEquipmentDebtContext(ctx = {}) {
  if (!isUserscriptEnv() || ctx.forceDemo) {
    return {
      status: 'ok',
      mode: 'demo',
      dataset: buildDemoEquipmentDebtDataset(),
    };
  }

  const loc = ctx.pageLocation || null;
  const doc = ctx.pageDocument || null;

  if (!isEquipmentPortalLocation(loc) || !doc) {
    return {
      status: 'needs_equipment_page',
      mode: 'live',
      url: EQUIPMENT_ENDPOINTS.base,
      message:
        'Tồn nợ vật tư chạy trên trang Quản lý vật tư (nextgen.fpt.net/resource/equipment/). Bấm nút bên dưới để mở trang, vào Báo cáo → Báo cáo nợ → Xem danh sách.',
    };
  }

  const ctrls = findEquipmentDebtPageControls(doc);
  const table = ctrls.grid ? findEquipmentTableInGrid(ctrls.grid) : null;
  const realRows = getEquipmentRealBodyRows(table);
  const columns = table ? parseEquipmentDebtColumns(table) : { materials: [] };
  const filterState = readEquipmentFilterState(doc);
  const currentFilter = {
    region: filterState.region,
    province: filterState.province,
    partner: filterState.partner,
  };

  if (
    !ctrls.hasDebtTab ||
    !ctrls.isDebtTabActive ||
    !ctrls.grid ||
    !table ||
    realRows.length === 0 ||
    columns.materials.length === 0
  ) {
    const hasReportMenuBtn = Boolean(findEquipmentReportMenuBtn(doc));
    const regionOptions = readEquipmentFilterOptions(doc, 'region').options;
    let message =
      'Bạn đang ở màn hình khác trên Quản lý vật tư (chưa mở Báo cáo → Báo cáo nợ). Bấm nút bên dưới để mở đúng trang Báo cáo nợ.';
    if (ctrls.hasDebtTab && !ctrls.isDebtTabActive) {
      message = 'Đang ở Báo cáo nợ nhưng chưa chọn tab "Tồn công nợ theo NV". Bấm chuyển tab bên dưới.';
    } else if (ctrls.hasDebtTab && filterState.missingRequired) {
      message =
        'Chọn Vùng / Tỉnh thành / Đối tác 1 lần bên dưới — Remote Inside sẽ lưu cố định và tự chọn ở những lần sau.';
    } else if (ctrls.hasDebtTab && ctrls.viewListBtn) {
      message =
        'Bảng "Tồn công nợ theo NV" chưa có dữ liệu. Bấm nút bên dưới để chạy "Xem danh sách" và gom KTV.';
    }

    return {
      status: 'needs_report_loaded',
      mode: 'live',
      hasDebtTab: ctrls.hasDebtTab,
      isDebtTabActive: ctrls.isDebtTabActive,
      hasViewListBtn: Boolean(ctrls.viewListBtn),
      hasReportMenuBtn,
      filterMissing: filterState.missingRequired,
      currentFilter,
      regionOptions,
      message,
    };
  }

  const collected = await collectEquipmentDebtFromDocument(doc, {
    onProgress: ctx.onProgress,
    maxPages: ctx.maxPages || 30,
    waitMs: ctx.waitMs || 5500,
  });
  return {
    ...collected,
    currentFilter,
  };
}
