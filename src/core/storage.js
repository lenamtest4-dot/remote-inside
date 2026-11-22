/**
 * Luu trang thai cuc bo tren may (chi luu Ma HD gan day va tab dang chon).
 * Tuyet doi khong luu mat khau, cookie hay token dang nhap.
 */

import { normalizeContractId } from '../config/portals.js';

export const STORAGE_KEYS = {
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

export function getState(key, fallback = null, storageAdapter = null) {
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

export function setState(key, value, storageAdapter = null) {
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

export function getRecentContracts(storageAdapter = null) {
  const list = getState(STORAGE_KEYS.RECENT_CONTRACTS, [], storageAdapter);
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .map((item) => normalizeContractId(String(item || '')))
    .filter(Boolean)
    .slice(0, MAX_RECENT_CONTRACTS);
}

export function addRecentContract(rawId, storageAdapter = null) {
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

export function clearRecentContracts(storageAdapter = null) {
  setState(STORAGE_KEYS.RECENT_CONTRACTS, [], storageAdapter);
  return [];
}
