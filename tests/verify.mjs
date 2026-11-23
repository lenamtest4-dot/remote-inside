import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import {
  PORTALS,
  PORTAL_ORDER,
  normalizeContractId,
  validateContractId,
} from '../src/config/portals.js';
import {
  STORAGE_KEYS,
  addRecentContract,
  clearRecentContracts,
  consumePendingRecallContract,
  getRecentContracts,
  getState,
  setPendingRecallContract,
  setState,
} from '../src/core/storage.js';
import {
  detectIamRedirect,
  getRuntimeEnv,
  isAndroidAppEnv,
  isUserscriptEnv,
  openExternalOrPortalUrl,
  requestPortal,
} from '../src/core/transport.js';
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
  extractMatchingFunctionsFromJs,
  extractNextAppChunkUrls,
  extractOpsMenuFromLeftAsp,
  extractSpaChunkUrls,
  redactHeaders,
  redactPayload,
  redactResponseStructure,
  scanPageStructure,
  summarizeSensitiveHeaders,
} from '../src/core/inspector.js';
import {
  BYPASS_CHOICE_OPTIONS,
  BYPASS_REASON_BY_TYPE,
  BYPASS_TYPE_OPTIONS,
  INSIDE_ENDPOINTS,
  extractHtmlTablePairs,
  extractJsAlertMessages,
  fetchInsideBoxMacLogs,
  fetchInsideByPassMeta,
  fetchInsideModemInfo,
  fetchInsideOnlineSessions,
  findMatchingOltOption,
  formatInsideTimestamp,
  getInsideOltHint,
  isExtendedPortOlt,
  isSameOltDetectedInfo,
  normalizeBoxMac,
  parseBoxMacLogItems,
  parseByPassDeleteResponse,
  parseByPassInsertResponse,
  parseByPassListRows,
  parseByPassPageMeta,
  parseByPassUpdateResponse,
  parseClearSerialResponse,
  parseInsideLookupPayload,
  parseInsideMutationResponse,
  parseKillSessionRows,
  parseLocationsFromMonitorHtml,
  parseOltListResponse,
  parseOltPortsFromHtml,
  parseRadiusOltFromText,
  parseReplaceMacBoxResponse,
  runInsideAction,
  searchInsideByPass,
  setInsideOltHint,
  validateBoxNewMac,
  validateByPassPayload,
} from '../src/adapters/inside.js';
import {
  DEPLOYMENT_CAMERA_PHONE_TYPE,
  DEPLOYMENT_CATALOG_KEYS,
  DEPLOYMENT_ENDPOINTS,
  DEPLOYMENT_EQUIPMENT_TYPE,
  buildCompletedPayload,
  canEditDeploymentCameraPhone,
  clearDeploymentTicketMac,
  completeDeploymentTicket,
  extractDeploymentTicketLink,
  extractHashFromLocation,
  fetchDeploymentEContracts,
  fetchDeploymentPayment,
  fetchDeploymentTicket,
  findDataFilterText,
  normalizeEquipmentList,
  normalizeTicketSummary,
  parseDataFilterOptions,
  revealDeploymentPhone,
  syncDeploymentOnline,
  updateDeploymentCameraPhone,
  updateDeploymentConstruction,
  validateCameraPhoneNumber,
  validateConstructionUpdate,
} from '../src/adapters/deployment.js';
import {
  PORT_ENDPOINTS,
  bootstrapMvcPortSession,
  buildPortUrl,
  decodeHtmlEntities,
  detectPortSessionExpired,
  extractMvcPortTokenFromText,
  fetchPortContractContext,
  fetchPortHistory,
  fetchPortSlotList,
  parseConboxParamsFromLibJs,
  parseDropdownOptions,
  parseMvcPortTokenFromCookieString,
  parsePortContractDetailHtml,
  parsePortHistoryRows,
  parsePortMutationResponse,
  parsePortOptionsFromHtml,
  runPortAction,
  triggerPortFtthMenuAction,
} from '../src/adapters/port.js';
import {
  RECALL_ENDPOINTS,
  buildDemoRecallSnapshot,
  isRecallPortalLocation,
  isRecallTicketLocation,
  loadRecallTicketContext,
  parseRecallEquipmentRow,
  parseRecallTicketCardElement,
  parseRecallTicketFromDocument,
  runRecallAction,
  triggerRecallAddAccessory,
  triggerRecallAddEquipment,
  triggerRecallCreateTicket,
  triggerRecallEditEquipment,
  triggerRecallSearchOnPage,
  triggerRecallSelectTicket,
  triggerRecallSubmitNote,
} from '../src/adapters/recall.js';
import { executePortalAction } from '../src/adapters/portals.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

async function runTests() {
  console.log('1. Checking built artifacts in dist/...');
  const pkgJson = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8')
  );
  const expectedVersion = String(pkgJson.version || '').trim();
  assert.ok(expectedVersion.length > 0, 'package.json must contain a valid version');

  const userscriptPath = path.join(DIST_DIR, 'remote-inside.user.js');
  const metaPath = path.join(DIST_DIR, 'remote-inside.meta.js');
  const previewPath = path.join(DIST_DIR, 'preview.html');

  assert.ok(fs.existsSync(userscriptPath), 'dist/remote-inside.user.js must exist');
  assert.ok(fs.existsSync(metaPath), 'dist/remote-inside.meta.js must exist');
  assert.ok(fs.existsSync(previewPath), 'dist/preview.html must exist');

  const userscriptContent = fs.readFileSync(userscriptPath, 'utf8');
  const metaContent = fs.readFileSync(metaPath, 'utf8');
  const previewContent = fs.readFileSync(previewPath, 'utf8');

  // Verify required Userscript metadata headers
  const expectedDomains = [
    'inside.fpt.net',
    'mvc.inside.fpt.net',
    'port.fpt.net',
    'mvcport.fpt.net',
    'fli-mngt.fcam.vn',
    'nextgen.fpt.net',
    'radius-portal.fpt.net',
  ];
  for (const domain of expectedDomains) {
    assert.ok(
      userscriptContent.includes(`@match        https://${domain}/*`) ||
        userscriptContent.includes(`@match        http://${domain}/*`),
      `Userscript must include @match for ${domain}`
    );
    assert.ok(
      userscriptContent.includes(`@connect      ${domain}`),
      `Userscript must include @connect for ${domain}`
    );
  }
  assert.ok(
    userscriptContent.includes('@connect      radius-apigateway.fpt.net'),
    'Userscript must include @connect for radius-apigateway.fpt.net'
  );

  const expectedGrants = [
    'GM_xmlhttpRequest',
    'GM_getValue',
    'GM_setValue',
    'GM_setClipboard',
    'GM_registerMenuCommand',
    'unsafeWindow',
  ];
  for (const grant of expectedGrants) {
    assert.ok(
      userscriptContent.includes(`@grant        ${grant}`),
      `Userscript must include @grant ${grant}`
    );
  }

  assert.ok(
    userscriptContent.includes(`@version      ${expectedVersion}`),
    `Userscript must match package.json @version ${expectedVersion}`
  );
  assert.ok(
    userscriptContent.includes('@homepageURL  https://github.com/lenamtest4-dot/remote-inside'),
    'Userscript must include @homepageURL'
  );
  assert.ok(
    userscriptContent.includes('@updateURL    ') && userscriptContent.includes('remote-inside.meta.js'),
    'Userscript must include @updateURL pointing to remote-inside.meta.js'
  );
  assert.ok(
    userscriptContent.includes('@downloadURL  ') && userscriptContent.includes('remote-inside.user.js'),
    'Userscript must include @downloadURL pointing to remote-inside.user.js'
  );
  assert.ok(
    metaContent.includes(`@version      ${expectedVersion}`) &&
      metaContent.includes('@updateURL    ') &&
      metaContent.includes('@downloadURL  ') &&
      metaContent.includes('@homepageURL  '),
    'dist/remote-inside.meta.js must contain complete auto-update header'
  );
  assert.ok(
    userscriptContent.startsWith(metaContent),
    'Userscript header must match dist/remote-inside.meta.js'
  );
  const forbiddenDemoDataRe =
    /phuongnam|namlp|thaopt|hoàng minh|hải đăng|vtaa[a-z0-9]+|ngoanht|vietnq|brup0|11\.72\.|432227|155123602/i;
  assert.equal(
    forbiddenDemoDataRe.test(userscriptContent) || forbiddenDemoDataRe.test(metaContent),
    false,
    'Built dist artifacts must not contain real personal/contract/IP demo fixtures'
  );

  // Parse JS syntax inside VM without executing
  new vm.Script(userscriptContent, { filename: 'remote-inside.user.js' });

  const scriptMatch = previewContent.match(/<script>([\s\S]*?)<\/script>/i);
  assert.ok(scriptMatch && scriptMatch[1], 'dist/preview.html must contain embedded <script>');
  const embeddedJs = scriptMatch[1].replace(/<\\\/script/gi, '</script');
  new vm.Script(embeddedJs, { filename: 'preview-embedded.js' });
  console.log('   OK: Bundle syntax & Userscript headers valid.');

  console.log('2. Testing portals & contract ID normalization/validation...');
  assert.deepEqual(PORTAL_ORDER, ['inside', 'port', 'camera', 'recall', 'radius']);
  assert.equal(PORTALS.inside.status, 'priority');
  assert.ok(
    PORTALS.inside.url.startsWith('http://inside.fpt.net'),
    'PORTALS.inside.url must start with http://inside.fpt.net'
  );
  assert.ok(
    PORTALS.inside.hosts.includes('mvc.inside.fpt.net'),
    'PORTALS.inside.hosts must include mvc.inside.fpt.net'
  );
  const insideActions = Object.fromEntries(PORTALS.inside.actions.map((a) => [a.id, a.label]));
  assert.equal(insideActions.reset_mac, 'Reset MAC Modem');
  assert.equal(insideActions.reset_mac_box, 'Reset MAC Box');
  assert.ok(
    INSIDE_ENDPOINTS.reset_mac_box &&
      INSIDE_ENDPOINTS.reset_mac_box.list.includes('/Contract/IPTVReplaceMAC/ReplaceMAC/GetMacContract') &&
      INSIDE_ENDPOINTS.reset_mac_box.update.includes('/Contract/IPTVReplaceMAC/ReplaceMAC/UpdateMAC'),
    'INSIDE_ENDPOINTS.reset_mac_box must wire live list and update endpoints'
  );
  assert.ok(
    INSIDE_ENDPOINTS.clear_osp &&
      INSIDE_ENDPOINTS.clear_osp.oltList.includes('/MonitorOLT/GetOLTList.asp') &&
      INSIDE_ENDPOINTS.clear_osp.clearSerial.includes('/MonitorOLT/ClearSerial.asp') &&
      !INSIDE_ENDPOINTS.clear_osp.configDevice,
    'INSIDE_ENDPOINTS.clear_osp must wire Clear Serial without Config Device'
  );
  assert.equal(normalizeContractId('  sgn 123456\n '), 'SGN123456');
  assert.equal(normalizeContractId('hn-9988_1'), 'HN-9988_1');
  assert.equal(validateContractId('').valid, false);
  assert.equal(validateContractId('ab').valid, false);
  assert.equal(validateContractId('sgn123456').value, 'SGN123456');
  assert.equal(validateContractId('sgn123456').valid, true);
  console.log('   OK: Contract normalization & validation passed.');

  console.log('3. Testing storage recent contracts (dedupe, max 12, clear, secret block)...');
  const storeMap = new Map();
  const mockAdapter = {
    get: (k) => (storeMap.has(k) ? storeMap.get(k) : null),
    set: (k, v) => storeMap.set(k, v),
  };

  assert.equal(setState('user_password', '123456', mockAdapter), false);
  assert.equal(getState('auth_token', null, mockAdapter), null);

  for (let i = 1; i <= 15; i += 1) {
    addRecentContract(`sgn00${i}`, mockAdapter);
  }
  let recent = getRecentContracts(mockAdapter);
  assert.equal(recent.length, 12, 'Recent contracts must be capped at 12');
  assert.equal(recent[0], 'SGN0015', 'Most recent contract should be first');

  // Re-adding older item moves it to front without duplicate
  recent = addRecentContract(' sgn0010 ', mockAdapter);
  assert.equal(recent.length, 12);
  assert.equal(recent[0], 'SGN0010');
  assert.equal(recent.filter((x) => x === 'SGN0010').length, 1);

  assert.deepEqual(clearRecentContracts(mockAdapter), []);
  assert.equal(getRecentContracts(mockAdapter).length, 0);
  assert.equal(getState(STORAGE_KEYS.RECENT_CONTRACTS, [], mockAdapter).length, 0);
  console.log('   OK: Storage wrapper tests passed.');

  console.log('4. Testing IAM session redirect detection...');
  assert.equal(
    detectIamRedirect({ status: 401, requestedUrl: 'https://inside.fpt.net/' }).expired,
    true
  );
  assert.equal(
    detectIamRedirect({ status: 403, requestedUrl: 'https://inside.fpt.net/' }).expired,
    true
  );
  assert.equal(
    detectIamRedirect({
      status: 200,
      requestedUrl: 'https://inside.fpt.net/home',
      finalUrl: 'https://iam.fpt.net/auth/login',
    }).expired,
    true
  );
  assert.equal(
    detectIamRedirect({
      status: 200,
      requestedUrl: 'https://inside.fpt.net/home',
      finalUrl: 'https://inside.fpt.net/home',
      responseText: '<form><input type="password" name="pwd"/></form>',
    }).expired,
    true
  );
  assert.equal(
    detectIamRedirect({
      status: 200,
      requestedUrl: 'https://inside.fpt.net/home',
      finalUrl: 'https://inside.fpt.net/home',
      responseText: '<html><title>Inside Portal</title><body>OK</body></html>',
    }).expired,
    false
  );
  console.log('   OK: IAM detection tests passed.');

  console.log('5. Testing inspector sensitive data redaction...');
  const cleanedHeaders = redactHeaders({
    Cookie: 'SESSIONID=abc123secret',
    Authorization: 'Bearer eyJhbGciOi',
    'X-CSRF-Token': 'csrf-xyz',
    'Content-Type': 'application/json',
    Accept: 'application/json',
  });
  assert.equal('Cookie' in cleanedHeaders, false);
  assert.equal('Authorization' in cleanedHeaders, false);
  assert.equal('X-CSRF-Token' in cleanedHeaders, false);
  assert.equal(cleanedHeaders['Content-Type'], 'application/json');
  assert.equal(cleanedHeaders.Accept, 'application/json');

  const samplePayload = {
    action: 'reset_mac',
    contractCode: 'SGN123456',
    password: 'my-secret-password',
    token: 'tok-999',
    otp: '482910',
    phone: '0901234567',
    cmnd: '079099123456',
    ho_ten: 'Nguyen Van A',
    nested: {
      note: 'Check SGN123456 on OLT',
      customer_email: 'user@example.com',
    },
  };
  const redacted = redactPayload(samplePayload, 'SGN123456');
  assert.equal(redacted.action, 'reset_mac');
  assert.equal(redacted.contractCode, '<CONTRACT_ID>');
  assert.equal(redacted.password, '[REDACTED]');
  assert.equal(redacted.token, '[REDACTED]');
  assert.equal(redacted.otp, '[REDACTED]');
  assert.equal(redacted.phone, '[REDACTED]');
  assert.equal(redacted.cmnd, '[REDACTED]');
  assert.equal(redacted.ho_ten, '[REDACTED]');
  assert.equal(redacted.nested.note, 'Check <CONTRACT_ID> on OLT');
  assert.equal(redacted.nested.customer_email, '[REDACTED]');

  const shape = redactResponseStructure(
    JSON.stringify({
      ok: true,
      contractNo: 'SGN123456',
      phone: '0901234567',
      address: '123 Duong ABC, Quan 1',
      macAddress: 'AA:BB:CC:DD:EE:FF',
    }),
    'application/json',
    'SGN123456'
  );
  assert.equal(shape.ok, 'boolean');
  assert.equal(shape.contractNo, '<CONTRACT_ID>');
  assert.equal(shape.phone, '[REDACTED]');
  assert.equal(shape.address, '[REDACTED]');
  assert.equal(shape.macAddress, 'string(17)');

  const reportJson = buildScanReport({
    domSnapshot: { forms: [], actionControls: [] },
    networkEntries: [],
    portalId: 'inside',
  });
  const parsedReport = JSON.parse(reportJson);
  assert.equal(parsedReport.portalId, 'inside');
  assert.equal(parsedReport.reportVersion, 'remote-inside-scan-v1');

  // Verify Classic ASP javascript: href preservation + contract redaction + frame metadata
  const mockControlJs = {
    tagName: 'A',
    textContent: 'Reset MAC',
    id: 'btnReset',
    className: 'asp-link',
    attributes: [],
    getAttribute: (name) =>
      name === 'href' ? "javascript:resetMac('SGN123456')" : '',
  };
  const mockControlImg = {
    tagName: 'INPUT',
    textContent: '',
    id: 'btnSearch',
    className: '',
    attributes: [],
    getAttribute: (name) => (name === 'type' ? 'image' : name === 'title' ? 'Tìm' : ''),
  };
  const mockWin = {
    self: {},
    top: null,
  };
  mockWin.top = {
    frames: [
      {
        name: 'mainFrame',
        location: {
          pathname: '/contract.asp',
          href: 'http://inside.fpt.net/contract.asp?hd=SGN123456',
        },
        document: { title: 'Hop dong SGN123456' },
      },
    ],
  };
  const mockCrossOriginIframe = {
    tagName: 'IFRAME',
    id: 'mainContent',
    getAttribute: (name) => {
      if (name === 'name') return 'rightPane';
      if (name === 'src') {
        return 'https://inside-v5.fpt.net/contract/status?hd=SGN123456&token=secret123';
      }
      return '';
    },
  };
  const mockDoc = {
    title: 'Inside SGN123456',
    defaultView: mockWin,
    querySelectorAll: (sel) => {
      if (sel.includes('input[type="image"]')) return [mockControlJs, mockControlImg];
      if (sel === 'iframe, frame') return [mockCrossOriginIframe];
      return [];
    },
    querySelector: () => null,
  };
  const snap = scanPageStructure(
    mockDoc,
    { origin: 'http://inside.fpt.net', pathname: '/contract.asp', href: 'http://inside.fpt.net/contract.asp?id=SGN123456' },
    'SGN123456'
  );
  assert.equal(snap.isInFrame, true);
  assert.equal(snap.frameMap.length, 1);
  assert.equal(snap.frameMap[0].name, 'mainFrame');
  assert.equal(snap.frameMap[0].title, 'Hop dong <CONTRACT_ID>');
  assert.equal(snap.frameElements.length, 1);
  assert.equal(snap.frameElements[0].srcOrigin, 'https://inside-v5.fpt.net');
  assert.equal(snap.frameElements[0].srcPath, '/contract/status');
  assert.deepEqual(snap.frameElements[0].srcQueryParamNames, ['hd', 'token']);
  const serializedSnap = JSON.stringify(snap);
  assert.equal(serializedSnap.includes('secret123'), false, 'Snapshot must never leak token param values');
  assert.equal(serializedSnap.includes('SGN123456'), false, 'Snapshot must redact contract ID');
  const jsItem = snap.actionControls.find((c) => c.id === 'btnReset');
  assert.ok(jsItem, 'Must capture javascript: anchor control');
  assert.equal(jsItem.hrefPath, "javascript:resetMac('<CONTRACT_ID>')");
  assert.ok(
    snap.actionControls.some((c) => c.id === 'btnSearch'),
    'Must capture input[type="image"] control'
  );

  // Verify XHR network recorder captures setRequestHeader Content-Type while stripping secrets & restores on stop()
  class MockXHR {
    constructor() {
      this._listeners = {};
      this.status = 200;
      this.responseType = '';
      this.responseText = JSON.stringify({ ok: true, macAddress: 'AA:BB:CC:DD:EE:FF' });
    }
    addEventListener(evt, fn) {
      this._listeners[evt] = this._listeners[evt] || [];
      this._listeners[evt].push(fn);
    }
    getResponseHeader(name) {
      return name.toLowerCase() === 'content-type' ? 'application/json' : '';
    }
    open() {}
    setRequestHeader() {}
    send() {
      for (const fn of this._listeners.loadend || []) fn();
    }
  }
  const origOpenRef = MockXHR.prototype.open;
  const origSetHeaderRef = MockXHR.prototype.setRequestHeader;
  const origSendRef = MockXHR.prototype.send;
  const recorderWin = {
    location: { origin: 'http://mvc.inside.fpt.net' },
    XMLHttpRequest: MockXHR,
  };
  const rec = createNetworkRecorder(recorderWin, () => 'SGN123456');
  assert.equal(rec.start(), true);
  const xhr = new recorderWin.XMLHttpRequest();
  xhr.open('POST', '/contract/GetStatus?hd=SGN123456');
  xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
  xhr.setRequestHeader('Authorization', 'Bearer top-secret-jwt');
  xhr.setRequestHeader('Cookie', 'ASP.NET_SessionId=xyz');
  xhr.send('contract=SGN123456&password=123');

  const captured = rec.getEntries();
  assert.equal(captured.length, 1);
  assert.equal(captured[0].transport, 'xhr');
  assert.equal(captured[0].requestContentType, 'application/x-www-form-urlencoded');
  assert.equal('Authorization' in captured[0].requestHeaders, false);
  assert.equal('Cookie' in captured[0].requestHeaders, false);
  assert.equal(captured[0].requestSchema.contract, '<CONTRACT_ID>');
  assert.equal(captured[0].requestSchema.password, '[REDACTED]');

  assert.equal(rec.stop(), true);
  assert.equal(MockXHR.prototype.open, origOpenRef, 'Must restore original XHR.open');
  assert.equal(
    MockXHR.prototype.setRequestHeader,
    origSetHeaderRef,
    'Must restore original XHR.setRequestHeader'
  );
  assert.equal(MockXHR.prototype.send, origSendRef, 'Must restore original XHR.send');
  console.log('   OK: Inspector redaction, Classic ASP scan, XHR recorder & report tests passed.');

  console.log('6. Testing Inside live lookup parsers & HTML partial extraction...');
  assert.ok(INSIDE_ENDPOINTS.lookup && INSIDE_ENDPOINTS.lookup.detail.includes('/Contract/StatusNew/ViewReportDetail'));
  assert.ok(INSIDE_ENDPOINTS.reset_mac && INSIDE_ENDPOINTS.reset_mac.includes('/DSLLLine/ResetMAC/ChangeMAC'));
  assert.ok(
    INSIDE_ENDPOINTS.kill_session &&
      INSIDE_ENDPOINTS.kill_session.search &&
      INSIDE_ENDPOINTS.kill_session.search.includes('/KillSession/KillSession/SearchListForKillSession') &&
      INSIDE_ENDPOINTS.kill_session.delete &&
      INSIDE_ENDPOINTS.kill_session.delete.includes('/KillSession/KillSession/DeleteSession')
  );
  assert.ok(INSIDE_ENDPOINTS.reset_mac_box.list.includes('/Contract/IPTVReplaceMAC/ReplaceMAC/GetMacContract'));
  assert.ok(INSIDE_ENDPOINTS.reset_mac_box.update.includes('/Contract/IPTVReplaceMAC/ReplaceMAC/UpdateMAC'));
  assert.ok(INSIDE_ENDPOINTS.clear_osp.oltList.includes('/MonitorOLT/GetOLTList.asp'));
  assert.ok(INSIDE_ENDPOINTS.clear_osp.clearSerial.includes('/MonitorOLT/ClearSerial.asp'));
  assert.equal(INSIDE_ENDPOINTS.clear_osp.configDevice, undefined);

  const partialHtml =
    '<table><tr><th>IP WAN</th><td>118.70.1.2</td></tr><tr><th>IPNAT</th><td>Có</td></tr></table><script>alert(1)</script>';
  const pairs = extractHtmlTablePairs(partialHtml);
  assert.equal(pairs.length, 2);
  assert.deepEqual(pairs[0], { label: 'IP WAN', value: '118.70.1.2' });
  assert.deepEqual(pairs[1], { label: 'IPNAT', value: 'Có' });
  assert.equal(JSON.stringify(pairs).includes('alert(1)'), false);

  const parsedLookup = parseInsideLookupPayload({
    contractId: 'VTH011485',
    detailJson: {
      data: [
        {
          ID: 9876543,
          Name: 'vth_demo_user',
          FullName: 'Nguyen Van Test',
          StatusName: 'Bình thường',
          DesPromotion: 'KM 12T + 1',
          Address: '123 Duong So 1, P. Tan Phong, Q.7',
          MACAddress: 'AA:BB:CC:DD:EE:01',
        },
      ],
      msg: 'Success',
    },
    objectTypeJson: {
      data: {
        ObjId: 9876543,
        Contract: 'VTH011485',
        LoaiHinhC1: 'Cá nhân',
        LoaiHinhC2: 'Gia đình',
        DoiTuongKh: 'Hộ gia đình',
        GoiDv: 'Giga 300',
      },
      msg: 'Success',
    },
    deviceJson: { data: 'Modem Online', msg: 'Success' },
    radiusBool: true,
    infoJson: {
      data: {
        dtMain: [{ Warning: 'Không có cảnh báo', Phone: '0900000001' }],
        dtHiFPT: [{ Contract: 'VTH011485', Phone: '0900000001' }],
      },
    },
    connPartialHtml: partialHtml,
    sessionPartialHtml: '<table><tr><th>Phiên PPPoE</th><td>Online 2h</td></tr></table>',
  });

  assert.equal(parsedLookup.status, 'ok');
  assert.equal(parsedLookup.mode, 'live');
  assert.equal(parsedLookup.objID, 9876543);
  assert.equal(parsedLookup.accountName, 'vth_demo_user');
  const fieldMap = Object.fromEntries(parsedLookup.summaryFields.map((f) => [f.label, f.value]));
  assert.equal(fieldMap['Mã hợp đồng'], 'VTH011485');
  assert.equal(fieldMap['Gói cước'], 'Giga 300');
  assert.equal(fieldMap['Thiết bị / Modem'], 'Modem Online');
  assert.equal(fieldMap['Trạng thái Radius'], 'Có trên Radius');
  assert.equal(fieldMap['Địa chỉ lắp đặt'], '123 Duong So 1, P. Tan Phong, Q.7');
  assert.equal(parsedLookup.extraSections.length, 2);
  assert.equal(parsedLookup.extraSections[0].title, 'Thông số kết nối (Radius)');
  assert.equal(parsedLookup.extraSections[1].title, 'Phiên đang online (Radius)');
  assert.equal(parsedLookup.embeddedViews.length, 5);
  assert.deepEqual(
    parsedLookup.embeddedViews.map((v) => v.id),
    ['radius_params', 'radius_online', 'radius_errors', 'iptv', 'camera']
  );
  assert.deepEqual(
    parsedLookup.embeddedViews.map((v) => v.defaultOpen),
    [true, true, false, false, false]
  );
  assert.ok(parsedLookup.embeddedViews[0].url.includes('ObjID=9876543'));
  assert.ok(parsedLookup.embeddedViews[1].url.includes('query=vth_demo_user'));
  assert.ok(parsedLookup.embeddedViews[2].url.includes('query=vth_demo_user'));
  assert.ok(parsedLookup.embeddedViews[3].url.includes('objid=9876543'));
  assert.ok(parsedLookup.embeddedViews[4].url.includes('objid=9876543'));

  const numericAndFalseRadius = parseInsideLookupPayload({
    contractId: 'SGN123456',
    detailJson: { data: [{ ID: 123, Status: 1 }] },
    radiusBool: false,
  });
  const numMap = Object.fromEntries(numericAndFalseRadius.summaryFields.map((f) => [f.label, f.value]));
  assert.equal(numMap['Tình trạng HĐ'], 'Bình thường (1)');
  assert.equal('Trạng thái Radius' in numMap, false, 'Must omit misleading Offline label when radiusBool is false');
  console.log('   OK: Inside live lookup parsers passed.');

  console.log('7. Testing HTML & JS deep API hint extractors...');
  const sampleHtml = `
    <script src="/assets/jquery.min.js"></script>
    <script src="/static/js/app-radius.js?v=2"></script>
    <form method="POST" action="/DSLLLine/ResetMAC/Submit?token=secret123">
      <input type="text" id="txtContract" name="txtContract" value="SGN123456" />
      <button id="btnReset" onclick="resetNow('SGN123456')">Reset MAC</button>
    </form>
    <script>
      const ds = { transport: { read: { url: "/iptvinfo/GetListBox?token=secret123&objid=99" } } };
      $.post("/DSLLLine/ResetMAC/Execute", { contract: "SGN123456" });
    </script>
  `;
  const htmlHints = extractApiHintsFromHtml(sampleHtml, 'http://mvc.inside.fpt.net/iptvinfo/infobox', 'SGN123456');
  assert.deepEqual(htmlHints.scriptUrls, ['http://mvc.inside.fpt.net/static/js/app-radius.js']);
  assert.ok(
    htmlHints.apiHints.includes('/iptvinfo/GetListBox?token&objid'),
    'Must capture Kendo read URL with query param names only'
  );
  assert.ok(
    htmlHints.apiHints.includes('/DSLLLine/ResetMAC/Execute'),
    'Must capture $.post URL'
  );
  assert.equal(htmlHints.forms.length, 1);
  assert.equal(htmlHints.forms[0].actionPath, '/DSLLLine/ResetMAC/Submit');
  assert.equal(htmlHints.fields.length, 1);
  assert.equal(htmlHints.fields[0].name, 'txtContract');
  assert.equal(JSON.stringify(htmlHints).includes('secret123'), false, 'Must strip secret query values');
  assert.equal(JSON.stringify(htmlHints).includes('SGN123456'), false, 'Must redact contract ID & skip .value');

  const jsHints = extractApiHintsFromJs(
    'fetch("/api/v1/connection-parameters?ObjID=123&token=secret123"); axios.get("/api/v1/online-session");',
    'SGN123456'
  );
  assert.ok(jsHints.includes('/api/v1/connection-parameters?ObjID&token'));
  assert.ok(jsHints.includes('/api/v1/online-session'));
  assert.equal(JSON.stringify(jsHints).includes('secret123'), false);
  console.log('   OK: HTML & JS API hint extractors passed.');

  console.log('8. Testing AJAX signature & Left.Asp ops menu extractors...');
  const ajaxSampleHtml = `
    <select id="fSearchType" name="fSearchType">
      <option value="1">Số HĐ</option>
      <option value="2">Tên truy nhập</option>
    </select>
    <script>
      function ChangeSubmit() {
        $.ajax({
          type: 'POST',
          url: '/DSLLLine/ResetMAC/ChangeMAC?ObjID=' + objId,
          contentType: 'application/json; charset=utf-8',
          data: JSON.stringify({ ObjID: id, NewMAC: mac, secret: 'abc' })
        });
      }
      function DeleteSession() {
        $.post('/KillSession/KillSession/DeleteSession', { ObjID: x });
      }
    </script>
  `;
  const sigOut = extractAjaxSignaturesFromHtml(
    ajaxSampleHtml,
    'http://mvc.inside.fpt.net/DSLLLine/ResetMAC/',
    'SGN123456'
  );
  assert.equal(sigOut.ajaxCalls.length, 2);
  assert.equal(sigOut.ajaxCalls[0].fnHint, 'ChangeSubmit');
  assert.equal(sigOut.ajaxCalls[0].method, 'POST');
  assert.equal(sigOut.ajaxCalls[0].urlPath, '/DSLLLine/ResetMAC/ChangeMAC');
  assert.ok(sigOut.ajaxCalls[0].dataKeys.includes('ObjID'));
  assert.ok(sigOut.ajaxCalls[0].dataKeys.includes('NewMAC'));
  assert.equal(JSON.stringify(sigOut).includes("'abc'"), false, 'Must not leak data object literal values');
  assert.equal(sigOut.ajaxCalls[1].fnHint, 'DeleteSession');
  assert.equal(sigOut.ajaxCalls[1].method, 'POST');
  assert.equal(sigOut.ajaxCalls[1].urlPath, '/KillSession/KillSession/DeleteSession');
  assert.ok(sigOut.ajaxCalls[1].dataKeys.includes('ObjID'));
  assert.equal(sigOut.selects.length, 1);
  assert.equal(sigOut.selects[0].id, 'fSearchType');
  assert.deepEqual(sigOut.selects[0].options, [
    { value: '1', text: 'Số HĐ' },
    { value: '2', text: 'Tên truy nhập' },
  ]);

  const leftSample = `
    <a href="#" onclick="GoPage('http://mvc.inside.fpt.net/ClearOSP/Index?vUrl=secretVal', this); return false;">Clear OSP</a>
    <a href="#" onclick="GoPage('http://mvc.inside.fpt.net/Accounting/Bill', this); return false;">Hóa đơn</a>
  `;
  const leftOps = extractOpsMenuFromLeftAsp(leftSample, 'http://inside.fpt.net/Left.Asp');
  assert.equal(leftOps.length, 1);
  assert.equal(leftOps[0].text, 'Clear OSP');
  assert.equal(leftOps[0].targetOrigin, 'http://mvc.inside.fpt.net');
  assert.equal(leftOps[0].targetPath, '/ClearOSP/Index');
  assert.deepEqual(leftOps[0].targetQueryParamNames, ['vUrl']);
  assert.equal(JSON.stringify(leftOps).includes('secretVal'), false, 'Must never leak menu query values');
  console.log('   OK: AJAX signature & Left.Asp ops menu extractors passed.');

  console.log('9. Testing Inside live mutation response parser...');
  const mutOkJson = parseInsideMutationResponse({
    actionLabel: 'Kill Session',
    contractId: 'SGN123456',
    objID: 900000001,
    httpStatus: 200,
    responseText: JSON.stringify({ status: true, msg: 'Kill session thành công' }),
  });
  assert.equal(mutOkJson.status, 'ok');
  assert.equal(mutOkJson.title, 'Đã Kill Session cho SGN123456');
  assert.equal(mutOkJson.message, 'Kill session thành công');

  const mutFailJson = parseInsideMutationResponse({
    actionLabel: 'Reset MAC Modem',
    contractId: 'SGN123456',
    objID: 900000001,
    httpStatus: 200,
    responseText: JSON.stringify({ status: false, msg: 'Không tìm thấy phiên hợp lệ' }),
  });
  assert.equal(mutFailJson.status, 'error');
  assert.equal(mutFailJson.message, 'Không tìm thấy phiên hợp lệ');

  const mutFailText = parseInsideMutationResponse({
    actionLabel: 'Reset MAC Modem',
    contractId: 'SGN123456',
    objID: 900000001,
    httpStatus: 200,
    responseText: 'Lỗi hệ thống: Không có quyền thực hiện',
  });
  assert.equal(mutFailText.status, 'error');

  const mutOkPlain = parseInsideMutationResponse({
    actionLabel: 'Reset MAC Modem',
    contractId: 'SGN123456',
    objID: 900000001,
    httpStatus: 200,
    responseText: '"Cập nhật MAC thành công"',
    extraFields: [{ label: 'Chế độ Reset MAC', value: 'Xóa trắng MAC (NewMAC trống)' }],
  });
  assert.equal(mutOkPlain.status, 'ok');
  assert.equal(mutOkPlain.message, 'Cập nhật MAC thành công');

  const mutHttpErr = parseInsideMutationResponse({
    actionLabel: 'Kill Session',
    contractId: 'SGN123456',
    objID: 900000001,
    httpStatus: 500,
    responseText: 'Internal Server Error',
  });
  assert.equal(mutHttpErr.status, 'error');
  assert.ok(mutHttpErr.title.includes('500'));
  console.log('   OK: Inside live mutation response parser passed.');

  console.log('10. Testing sanitized inline scripts, form controls meta, and JS function extractors...');
  const sampleBoxOltHtml = `
    <script src="/Scripts/jquery.min.js"></script>
    <script src="/Scripts/jquery.isc.js"></script>
    <script src="/Functions/NetAdmin/PowerDSL/MonitorOLT/Library.js"></script>
    <input type="hidden" id="__VIEWSTATE" name="__VIEWSTATE" value="super-secret-viewstate" />
    <input type="hidden" id="fDeviceType" name="fDeviceType" value="GPON" />
    <select id="fOLT" name="fOLT" onchange="loadPort()">
      <option value="0">Tat ca</option>
      <option value="DEMO-OLT-01" selected>DEMO-OLT-01 (TP. HCM)</option>
      <option value="DEMO-OLT-02">DEMO-OLT-02</option>
    </select>
    <input type="checkbox" id="chkPort1" name="chkPort" class="pon-cb" value="0/1/1" onclick="togglePort(this)" />
    <script>
      function SaveSwapping() {
        const cfg = {
          contract: 'SGN123456',
          headers: { Authorization: 'Bearer top-secret-jwt' },
          password: 'pw123',
          contact: '0901234567',
          mail: 'tech@example.com',
          kendoTransport: { update: { url: '/Contract/IPTVReplaceMAC/SwappingMAC?token=secret123' } }
        };
        $.post('/Contract/IPTVReplaceMAC/SwappingMAC', cfg);
      }
      function ClearSerial() {
        var url = '/Functions/NetAdmin/PowerDSL/MonitorOLT/AjaxClearSerial.asp?contract=SGN123456';
        return url;
      }
    </script>
  `;

  const inlineScripts = extractInlineScriptsSanitized(sampleBoxOltHtml, 'SGN123456');
  assert.equal(inlineScripts.length, 1);
  const inlineCode = inlineScripts[0].code;
  assert.ok(inlineCode.includes('SaveSwapping'), 'Must preserve SaveSwapping function');
  assert.ok(inlineCode.includes('transport') || inlineCode.includes('SwappingMAC'), 'Must preserve Kendo transport update URL');
  assert.ok(inlineCode.includes('ClearSerial'), 'Must preserve ClearSerial function');
  assert.ok(inlineCode.includes('<CONTRACT_ID>'), 'Must replace contract ID with <CONTRACT_ID>');
  assert.equal(inlineCode.includes('SGN123456'), false, 'Must redact literal contract ID');
  assert.equal(inlineCode.includes('top-secret-jwt'), false, 'Must redact Bearer token');
  assert.equal(inlineCode.includes('secret123'), false, 'Must redact query token value');
  assert.equal(inlineCode.includes('pw123'), false, 'Must redact password literal');
  assert.equal(inlineCode.includes('0901234567'), false, 'Must redact mobile phone number');
  assert.equal(inlineCode.includes('tech@example.com'), false, 'Must redact email address');

  const controlsMeta = extractFormControlsMeta(sampleBoxOltHtml, 'SGN123456');
  assert.equal(controlsMeta.selects.length, 1);
  assert.equal(controlsMeta.selects[0].id, 'fOLT');
  assert.equal(controlsMeta.selects[0].onchange, 'loadPort()');
  assert.equal(controlsMeta.selects[0].optionCount, 3);
  assert.equal(controlsMeta.selects[0].selectedValue, 'DEMO-OLT-01');
  assert.equal(controlsMeta.selects[0].sampleOptions.length, 3);
  assert.equal(controlsMeta.selects[0].sampleOptions[1].selected, true);

  assert.equal(controlsMeta.checkboxes.length, 1);
  assert.equal(controlsMeta.checkboxes[0].value, '0/1/1');
  assert.equal(controlsMeta.checkboxes[0].onclick, 'togglePort(this)');

  const vsHidden = controlsMeta.hiddenInputs.find((h) => h.name === '__VIEWSTATE');
  const devHidden = controlsMeta.hiddenInputs.find((h) => h.name === 'fDeviceType');
  assert.equal(vsHidden.value, '[REDACTED]', 'Must redact __VIEWSTATE hidden input');
  assert.equal(devHidden.value, 'GPON', 'Must preserve safe fDeviceType hidden input');

  const externalJsSample = `
    function formatDate(d) { return String(d); }
    function ClearSerial(olt, portID) {
      $.post('/AjaxClear.asp?token=secret999', { olt: olt, portID: portID, contract: 'SGN123456' });
    }
    var loadPort = function(olt) {
      return '/ViewPortPON.Asp?fOLT=' + olt;
    };
    function unrelatedHelper() { return 42; }
  `;
  const matchedFns = extractMatchingFunctionsFromJs(externalJsSample, undefined, 'SGN123456');
  const fnNames = matchedFns.map((f) => f.name);
  assert.ok(fnNames.includes('ClearSerial'), 'Must extract ClearSerial function');
  assert.ok(fnNames.includes('loadPort'), 'Must extract var loadPort = function');
  assert.equal(fnNames.includes('formatDate'), false, 'Must ignore unrelated formatDate');
  assert.equal(fnNames.includes('unrelatedHelper'), false, 'Must ignore unrelatedHelper');
  const serializedFns = JSON.stringify(matchedFns);
  assert.equal(serializedFns.includes('secret999'), false, 'Must redact token in external JS');
  assert.equal(serializedFns.includes('SGN123456'), false, 'Must redact contract ID in external JS');

  const hintsWithIsc = extractApiHintsFromHtml(
    sampleBoxOltHtml,
    'http://inside.fpt.net/Functions/NetAdmin/PowerDSL/MonitorOLT/ViewPortPON.Asp',
    'SGN123456'
  );
  assert.equal(
    hintsWithIsc.scriptUrls.some((u) => u.includes('jquery.min.js')),
    false,
    'Must still skip jquery.min.js'
  );
  assert.ok(
    hintsWithIsc.scriptUrls.some((u) => u.includes('jquery.isc.js')),
    'Must keep FPT internal jquery.isc.js'
  );
  assert.ok(
    hintsWithIsc.scriptUrls.some((u) => u.includes('Library.js')),
    'Must keep MonitorOLT Library.js'
  );
  console.log('   OK: Sanitized inline scripts, form controls meta, and JS function extractors passed.');

  console.log('11. Testing Reset MAC Box & Clear OSP / MonitorOLT parsers and demo execution...');
  assert.equal(normalizeBoxMac(' aa:bb-cc 11:22:33 '), 'AABBCC112233');
  assert.equal(validateBoxNewMac('').valid, false);
  assert.equal(validateBoxNewMac('AABBCCDDEEFF').valid, true);
  assert.equal(validateBoxNewMac('FBOX12345678').valid, false, '12 chars starting with FBOX must fail');
  assert.equal(validateBoxNewMac('FBOX001122334455').valid, true);
  assert.equal(validateBoxNewMac('ABCD001122334455').valid, false, '16 chars without FBOX must fail');
  assert.equal(validateBoxNewMac('12345').valid, false);

  const boxOkRes = parseReplaceMacBoxResponse({
    contractId: 'SGN123456',
    oldMac: 'FBOXOLD123456789',
    newMac: 'AABBCCDDEEFF',
    idContract: '900000001',
    httpStatus: 200,
    responseText: JSON.stringify({ status: 9, msg: 'Thay thế MAC thành công!' }),
  });
  assert.equal(boxOkRes.status, 'ok');
  assert.equal(boxOkRes.message, 'Thay thế MAC thành công!');

  const boxFailZero = parseReplaceMacBoxResponse({
    contractId: 'SGN123456',
    oldMac: 'FBOXOLD123456789',
    newMac: 'AABBCCDDEEFF',
    httpStatus: 200,
    responseText: JSON.stringify({ status: 0, msg: 'Số hợp đồng chưa đúng...' }),
  });
  assert.equal(boxFailZero.status, 'error');

  const boxFailFive = parseReplaceMacBoxResponse({
    contractId: 'SGN123456',
    oldMac: 'FBOXOLD123456789',
    newMac: 'AABBCCDDEEFF',
    httpStatus: 200,
    responseText: JSON.stringify({
      status: 5,
      msg: 'Lỗi MAC cũ không thuộc HĐ hoặc HĐ đang bị khóa cước - ISC.',
    }),
  });
  assert.equal(boxFailFive.status, 'error');

  const parsedOlts = parseOltListResponse('0@Tat ca$101@DEMO-OLT-01GC16$102@DEMO-OLT-03GC14$103@DEMO-OLT-04GP08\n');
  assert.deepEqual(parsedOlts, [
    { id: '101', name: 'DEMO-OLT-01GC16' },
    { id: '102', name: 'DEMO-OLT-03GC14' },
    { id: '103', name: 'DEMO-OLT-04GP08' },
  ]);
  assert.equal(isExtendedPortOlt('DEMO-OLT-01GC16'), true);
  assert.equal(isExtendedPortOlt('DEMO-OLT-03GC14'), true);
  assert.equal(isExtendedPortOlt('DEMO-OLT-04GP08'), false);

  const monitorHtmlSample = `
    <select id="fLocationID" name="fLocationID" onchange="ChangeLocationID()">
      <option value="0">Tat ca</option>
      <option value="64">SGN - Khu vuc mau
      <option value="4">HCM - Ho Chi Minh</option>
    </select>
    <script>SetCurrentOption(document.forms[0].fLocationID, '64');</script>
  `;
  const parsedLocs = parseLocationsFromMonitorHtml(monitorHtmlSample);
  assert.equal(parsedLocs.defaultLocationId, '64');
  assert.equal(parsedLocs.locations.length, 2);
  assert.equal(parsedLocs.locations[0].selected, true);
  assert.equal(parsedLocs.locations[1].name, 'HCM - Ho Chi Minh');

  const viewportHtmlSample = `
    <ul>
      <li><input type="checkbox" class="checkbox" value="1" /><span>Port 1</span></li>
      <li class="type2"><input type="checkbox" class="checkbox" value="9" /><span>Port 9</span></li>
    </ul>
  `;
  const parsedPorts = parseOltPortsFromHtml(viewportHtmlSample);
  assert.deepEqual(parsedPorts, [
    { value: '1', label: 'Port 1', isType2: false },
    { value: '9', label: 'Port 9', isType2: true },
  ]);

  const fallbackPorts = parseOltPortsFromHtml('<div>no checkboxes</div>');
  assert.equal(fallbackPorts.length, 16);
  assert.equal(fallbackPorts[0].isType2, false);
  assert.equal(fallbackPorts[8].isType2, true);

  const alertHtml = `<script>alert('Clear serial port 1,2 thanh cong!');</script><table><tr><th>OLT</th><td>DEMO-OLT-01GC16</td></tr></table>`;
  assert.deepEqual(extractJsAlertMessages(alertHtml), ['Clear serial port 1,2 thanh cong!']);

  const clearOk = parseClearSerialResponse({
    mode: 'clear_serial',
    contractId: '',
    oltId: '101',
    oltName: 'DEMO-OLT-01GC16',
    portsCsv: '1,2',
    httpStatus: 200,
    responseText: alertHtml,
    sourceUrl: 'http://inside.fpt.net/Functions/NetAdmin/PowerDSL/MonitorOLT/ViewPortPON.Asp?fLocationID=64&fOLT=101',
  });
  assert.equal(clearOk.status, 'ok');
  assert.equal(clearOk.message, 'Clear serial port 1,2 thanh cong!');
  assert.equal(clearOk.extraSections.length, 1);

  const clearErr = parseClearSerialResponse({
    mode: 'clear_serial',
    oltId: '101',
    oltName: 'DEMO-OLT-01GC16',
    portsCsv: '1',
    httpStatus: 200,
    responseText: `<script>alert('Ban chua chon Port hoac loi ket noi OLT');</script>`,
  });
  assert.equal(clearErr.status, 'error');

  const demoClearNoContract = await runInsideAction('clear_osp', '', {
    forceDemo: true,
    oltId: '101',
    oltName: 'DEMO-OLT-01GC16',
    ports: ['1', '2'],
  });
  assert.equal(demoClearNoContract.status, 'ok', 'Clear OSP must work without Contract ID');
  assert.equal(demoClearNoContract.mode, 'demo');
  assert.ok(demoClearNoContract.title.includes('Clear Serial'));
  assert.ok(demoClearNoContract.title.includes('DEMO-OLT-01GC16'));
  console.log('   OK: Reset MAC Box & Clear OSP parsers and demo execution passed.');

  console.log('12. Testing Reset MAC Modem prefill, Box history logs, and Next.js chunk scan helpers...');
  assert.match(formatInsideTimestamp('/Date(1732345678000+0700)/'), /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/);
  assert.equal(formatInsideTimestamp('23/11/2026 09:00'), '23/11/2026 09:00');

  const logItemsBare = parseBoxMacLogItems([
    {
      OldMAC: 'FBOXOLD123456789',
      NewMAC: 'AABBCCDDEEFF',
      CreateDate: '/Date(1732345678000)/',
      CreateBy: 'ktv.test',
      Note: 'Đổi Box hỏng',
      Contract: 'SGN123456',
      FullName: 'Nguyen Van A',
      Phone: '0901234567',
      BranchCode: 'SGN',
    },
  ]);
  assert.equal(logItemsBare.length, 1);
  assert.equal(logItemsBare[0].oldMac, 'FBOXOLD123456789');
  assert.equal(logItemsBare[0].newMac, 'AABBCCDDEEFF');
  assert.match(logItemsBare[0].time, /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/);
  assert.equal(logItemsBare[0].actor, 'ktv.test');
  assert.equal(logItemsBare[0].note, 'Đổi Box hỏng');
  assert.equal(logItemsBare[0].extraFields.some((f) => f.label === 'BranchCode'), true);
  assert.equal(JSON.stringify(logItemsBare).includes('Nguyen Van A'), false, 'Must skip FullName PII');
  assert.equal(JSON.stringify(logItemsBare).includes('0901234567'), false, 'Must skip Phone PII');

  const logItemsWrapped = parseBoxMacLogItems({
    data: [{ old_mac: 'AA11', macNew: 'BB22', CreatedDate: '20/11/2026', User: 'admin' }],
  });
  assert.equal(logItemsWrapped.length, 1);
  assert.equal(logItemsWrapped[0].oldMac, 'AA11');
  assert.equal(logItemsWrapped[0].newMac, 'BB22');

  const demoModemInfo = await fetchInsideModemInfo('SGN123456', { forceDemo: true });
  assert.equal(demoModemInfo.status, 'ok');
  assert.equal(demoModemInfo.macAddress, 'A4:2B:8C:10:9E:4F');
  assert.ok(demoModemInfo.objID);

  const demoBoxLogs = await fetchInsideBoxMacLogs('SGN123456', { forceDemo: true });
  assert.equal(demoBoxLogs.status, 'ok');
  assert.ok(demoBoxLogs.logs.length >= 2);

  const nextHtmlSample = `
    <script>self.__next_f.push([1,"I[123,[\\"static\\/chunks\\/app\\/public\\/partial\\/connection-parameters\\/page-71e93fd835ecb778.js\\"]]"])</script>
    <script src="/_next/static/chunks/app/public/partial/online-session/page-abc12345.js"></script>
  `;
  const chunkUrls = extractNextAppChunkUrls(
    nextHtmlSample,
    'http://radius-portal.fpt.net/public/partial/connection-parameters?ObjID=123'
  );
  assert.deepEqual(chunkUrls, [
    'http://radius-portal.fpt.net/_next/static/chunks/app/public/partial/connection-parameters/page-71e93fd835ecb778.js',
    'http://radius-portal.fpt.net/_next/static/chunks/app/public/partial/online-session/page-abc12345.js',
  ]);

  const radiusChunkJs = `
    const s = () => fetch("https://radius-api.fpt.net/api/v1/connection-parameters?ObjID=" + e + "&token=topSecretVal", { headers: { Authorization: "Bearer secretJwt" } });
    function parseOlt() { return { oltName: "DEMO-OLT-01GC16", slot: 0, port: 5, contract: "SGN123456" }; }
  `;
  const jsContexts = extractCodeContextsFromJs(radiusChunkJs, undefined, 'SGN123456');
  assert.ok(jsContexts.length >= 1);
  const ctxJoined = jsContexts.join('\n');
  assert.ok(ctxJoined.includes('connection-parameters'));
  assert.equal(ctxJoined.includes('topSecretVal'), false, 'Must redact query token');
  assert.equal(ctxJoined.includes('secretJwt'), false, 'Must redact Bearer token');
  assert.equal(ctxJoined.includes('SGN123456'), false, 'Must redact contract ID');
  console.log('   OK: Modem prefill, Box history logs, and Next.js chunk helpers passed.');

  console.log('13. Testing Kill Session live rows, exact Box history schema, and Radius OLT auto-detect...');
  assert.deepEqual(parseKillSessionRows(null), []);
  const killRowsBare = parseKillSessionRows([
    {
      Date: '/Date(1795407390000)/',
      Name: 'demo-sgn123456',
      NASName: 'DEMO-BRAS-01',
      IPAddress: '10.0.0.100',
      CallerID: 'A4:2B:8C:10:9E:4F',
      ObjID: 900000001,
    },
  ]);
  assert.equal(killRowsBare.length, 1);
  assert.equal(killRowsBare[0].objID, '900000001');
  assert.equal(killRowsBare[0].ipAddress, '10.0.0.100');
  assert.equal(killRowsBare[0].nasName, 'DEMO-BRAS-01');
  assert.equal(killRowsBare[0].name, 'demo-sgn123456');
  assert.equal(killRowsBare[0].callerId, 'A4:2B:8C:10:9E:4F');
  assert.ok(killRowsBare[0].date.includes('/'));

  const killRowsWrapped = parseKillSessionRows({
    data: [{ ObjID: '9988', IPAddress: '10.1.2.3', NASName: 'BRAS-01' }],
  });
  assert.equal(killRowsWrapped.length, 1);
  assert.equal(killRowsWrapped[0].objID, '9988');

  const demoSessions = await fetchInsideOnlineSessions('SGN123456', { forceDemo: true });
  assert.equal(demoSessions.status, 'ok');
  assert.ok(demoSessions.sessions.length >= 1);
  assert.ok(demoSessions.sessions[0].ipAddress);

  const numOk = parseInsideMutationResponse({
    actionLabel: 'Kill session',
    contractId: 'SGN123456',
    httpStatus: 200,
    responseText: '1',
  });
  assert.equal(numOk.status, 'ok');
  const numErr = parseInsideMutationResponse({
    actionLabel: 'Kill session',
    contractId: 'SGN123456',
    httpStatus: 200,
    responseText: '0',
  });
  assert.equal(numErr.status, 'error');

  const exactBoxLogs = parseBoxMacLogItems([
    {
      ID: 101,
      ObjID: 900001001,
      Contract: 'SGN123456',
      OldMAC: 'C894D2B746C4',
      NewMAC: 'D46195A06E41',
      ModifyDate: '/Date(1732345678000)/',
      ModifyBy: 'ktv.mau01',
      OldBoxType: 12,
      NewBoxType: 14,
      OldBoxType_Name: 'FPT Play Box S550',
      NewBoxType_Name: 'FPT Play Box 650',
    },
  ]);
  assert.equal(exactBoxLogs.length, 1);
  assert.equal(exactBoxLogs[0].oldMac, 'C894D2B746C4');
  assert.equal(exactBoxLogs[0].newMac, 'D46195A06E41');
  assert.equal(exactBoxLogs[0].actor, 'ktv.mau01');
  assert.equal(exactBoxLogs[0].oldBoxType, 'FPT Play Box S550');
  assert.equal(exactBoxLogs[0].newBoxType, 'FPT Play Box 650');
  assert.equal(exactBoxLogs[0].extraFields.length, 0, 'BoxType fields must not duplicate into extraFields');

  const parsedSpaced = parseRadiusOltFromText(
    'OLT / SLOT / PORT / ONU DEMO-OLT-01GC16 [S:0 / P:5 / O:79] IP OLT 10.0.0.10'
  );
  assert.deepEqual(parsedSpaced, {
    oltPop: 'DEMO-OLT-01GC16',
    slot: '0',
    port: '5',
    onu: '79',
    ipOlt: '10.0.0.10',
  });

  const parsedGlued = parseRadiusOltFromText(
    'OLT / SLOT / PORT / ONUDEMOOLT01GC16 [S:0 / P: - / O:79]'
  );
  assert.deepEqual(parsedGlued, {
    oltPop: 'DEMOOLT01GC16',
    slot: '0',
    port: '',
    onu: '79',
    ipOlt: '',
  });
  assert.equal(parseRadiusOltFromText('Khong co thong tin OLT'), null);

  const sampleOltList = [
    { id: '101', name: 'DEMO-OLT-01GC16' },
    { id: '102', name: 'DEMO-OLT-03GC14 - Khu B' },
  ];
  assert.deepEqual(findMatchingOltOption(sampleOltList, 'DEMO-OLT-01GC16'), {
    id: '101',
    name: 'DEMO-OLT-01GC16',
  });
  assert.deepEqual(findMatchingOltOption(sampleOltList, 'DEMO-OLT-03GC14'), {
    id: '102',
    name: 'DEMO-OLT-03GC14 - Khu B',
  });
  assert.equal(findMatchingOltOption(sampleOltList, 'UNKNOWNOLT99'), null);

  setInsideOltHint('900001001', parsedSpaced);
  const cachedOltHint = getInsideOltHint('900001001');
  assert.equal(cachedOltHint.oltPop, 'DEMO-OLT-01GC16');
  assert.equal(cachedOltHint.port, '5');
  assert.equal(getInsideOltHint('999999999'), null);

  assert.equal(
    isSameOltDetectedInfo(
      { objId: '900001001', oltPop: 'DEMO-OLT-02GC16', slot: '0', port: '8', onu: '94', ipOlt: '10.0.0.74' },
      { objId: '900001001', oltPop: 'demo-olt-02gc16 ', slot: '0', port: '8', onu: '94', ipOlt: ' 10.0.0.74' }
    ),
    true
  );
  assert.equal(
    isSameOltDetectedInfo(
      { objId: '900001001', oltPop: 'DEMO-OLT-02GC16', slot: '0', port: '8', onu: '94', ipOlt: '10.0.0.74' },
      { objId: '900001001', oltPop: 'DEMO-OLT-02GC16', slot: '0', port: '9', onu: '94', ipOlt: '10.0.0.74' }
    ),
    false
  );
  assert.equal(
    isSameOltDetectedInfo(
      { objId: '900001001', oltPop: 'DEMO-OLT-02GC16', slot: '0', port: '8', onu: '94', ipOlt: '' },
      { objId: '900001001', oltPop: 'DEMO-OLT-02GC16', slot: '0', port: '8', onu: '94', ipOlt: '10.0.0.74' }
    ),
    false
  );
  assert.equal(
    isSameOltDetectedInfo(
      { objId: '900001001', oltPop: 'DEMO-OLT-02GC16', slot: '0', port: '8', onu: '94', ipOlt: '10.0.0.74' },
      { objId: '900001001', oltPop: 'DEMO-OLT-01GC16', slot: '0', port: '8', onu: '94', ipOlt: '10.0.0.74' }
    ),
    false
  );
  assert.equal(
    isSameOltDetectedInfo(null, { objId: '900001001', oltPop: 'DEMO-OLT-02GC16' }),
    false
  );

  assert.ok(userscriptContent.includes('isSameOltDetectedInfo'), 'Bundle must include isSameOltDetectedInfo');
  assert.ok(userscriptContent.includes('renderConfirm'), 'Bundle must include isolated renderConfirm');
  assert.ok(userscriptContent.includes('data-ri-slot'), 'Bundle must include persistent Clear OSP slots');
  assert.ok(userscriptContent.includes('oltConnManualOpen'), 'Bundle must include oltConnManualOpen');
  console.log('   OK: Kill Session rows, Box history schema, and Radius OLT auto-detect passed.');

  console.log('14. Testing port.fpt.net / mvcport.fpt.net FTTH NEW adapter & parsers...');
  assert.equal(PORTALS.port.status, 'priority');
  assert.equal(PORTALS.port.url, 'http://port.fpt.net/');
  assert.ok(
    PORTALS.port.sessionCheckUrl &&
      PORTALS.port.sessionCheckUrl.includes('/ftth_newport/contract/index'),
    'PORTALS.port.sessionCheckUrl must check mvcport contract index'
  );
  assert.ok(
    Array.isArray(PORTALS.port.hosts) &&
      PORTALS.port.hosts.includes('port.fpt.net') &&
      PORTALS.port.hosts.includes('mvcport.fpt.net'),
    'PORTALS.port.hosts must include port.fpt.net and mvcport.fpt.net'
  );
  assert.ok(
    PORT_ENDPOINTS.search.includes('/FTTH_NewPort/Contract/Index_Search') &&
      PORT_ENDPOINTS.insertContract.includes('/FTTH_NewPort/Contract/InsertContract') &&
      PORT_ENDPOINTS.updateContract.includes('/FTTH_NewPort/Contract/Insert_UpdateContact') &&
      PORT_ENDPOINTS.loadData.includes('/FTTH_NewPort/Contract/LoadData') &&
      PORT_ENDPOINTS.loadPort.includes('/Contract/Load_PortContract') &&
      PORT_ENDPOINTS.loadPortHistory.includes('/FTTH_NewPort/Contract/LoadPortHistoryList'),
    'PORT_ENDPOINTS must declare all live FTTH NEW endpoints'
  );
  assert.equal(
    decodeHtmlEntities('&#272;&#227; thu h&#7891;i port &amp; kiểm tra'),
    'Đã thu hồi port & kiểm tra'
  );
  assert.deepEqual(parseDropdownOptions([{ Value: '35', Text: 'SGN - TP. H&#7891; Ch&#237; Minh' }]), [
    { value: '35', label: 'SGN - TP. Hồ Chí Minh' },
  ]);

  const sampleLibJs = `
    function Load_ConnectingBox_ByName_DeployCapacity(NamePOp, type, status, htmlcontroller) {
      $.ajax({
        url: "/Location/Load_ConnectingBox_ByName_DeployCapacity",
        type: "POST",
        data: { popName: NamePOp, type: Number(type), isCheck: Number(status) }
      });
    }
  `;
  const conboxSpecs = parseConboxParamsFromLibJs(sampleLibJs);
  assert.deepEqual(conboxSpecs, [
    { key: 'popName', argIndex: 0 },
    { key: 'type', argIndex: 1 },
    { key: 'isCheck', argIndex: 2 },
  ]);

  const sampleInsertHtml = `
    <input type="hidden" id="h_id" value="900002002" />
    <input type="hidden" id="h_typeContract" value="3" />
    <input type="hidden" id="h_status" value="6" />
    <input type="hidden" id="h_valueStatusPort" value="2" />
    <select id="cbo_typeContract">
      <option value="3" selected>FTTH_New</option>
      <option value="5">FTTH_NEW LeaseLine</option>
    </select>
    <select id="cbo_Status">
      <option value="1">B&#236;nh th&#432;&#7901;ng</option>
      <option value="6" selected>&#272;&#227; thu h&#7891;i port</option>
    </select>
    <select id="cbo_statusPort">
      <option value="1">Bình thường</option>
      <option value="2" selected>Thu hồi port</option>
      <option value="3">Cấp lại port</option>
    </select>
    <input id="txtContact" value="SGN654321" />
    <input id="txtCustomer" value="Nguy&#7877;n V&#259;n M&#7851;u" />
    <input id="txtHomePhone" value="0900000001" />
    <input id="txtTelephone" value="0280000002" />
    <input id="txtCardNumber" value="1" />
    <input id="txtLocalType" value="188" />
    <input id="txtUpdateCreate" value="11/23/2026 11:38:42 AM" />
    <textarea id="txtDescription">Ghi ch&#250; m&#7851;u</textarea>
    <div id="dvTSTC"><lable><b>DEMO-POP-01 • Port 04</b></lable></div>
    <div id="dvPC"><lable>OLT PON 0/8</lable></div>
  `;
  const parsedDetail = parsePortContractDetailHtml(sampleInsertHtml);
  assert.equal(parsedDetail.id, '900002002');
  assert.equal(parsedDetail.customer, 'Nguyễn Văn Mẫu');
  assert.equal(parsedDetail.handphone, '0900000001', 'handphone must map from #txtHomePhone');
  assert.equal(parsedDetail.telephone, '0280000002', 'telephone must map from #txtTelephone');
  assert.equal(parsedDetail.status, '6');
  assert.equal(parsedDetail.statusLabel, 'Đã thu hồi port');
  assert.equal(parsedDetail.releaseStatusPortValue, '2');
  assert.equal(parsedDetail.reassignStatusPortValue, '3');
  assert.equal(parsedDetail.updateDate, '11/23/2026 11:38:42 AM');
  assert.equal(parsedDetail.description, 'Ghi chú mẫu');
  assert.equal(parsedDetail.tstc, 'DEMO-POP-01 • Port 04');
  assert.equal(parsedDetail.pc, 'OLT PON 0/8');

  const rawPortHtml =
    '<label><input type="radio" id="radPort" value="91" disabled /> Port 01</label>' +
    '<label><input type="radio" id="radPort" value="92" /> Port 02</label>';
  const slotsRaw = parsePortOptionsFromHtml(rawPortHtml);
  const slotsJsonStr = parsePortOptionsFromHtml(JSON.stringify(rawPortHtml));
  assert.equal(slotsRaw.length, 2);
  assert.deepEqual(slotsRaw[0], { portID: '91', port: 'Port 01', disabled: true, checked: false });
  assert.deepEqual(slotsRaw[1], { portID: '92', port: 'Port 02', disabled: false, checked: false });
  assert.deepEqual(slotsJsonStr, slotsRaw);

  const histRows = parsePortHistoryRows([
    { STT: 1, ActionDate: '11/23/2026', CreateBy: 'ktv.mau01', Port: 'Port 02', IP: '10.0.0.1', Action: 'Thu hồi', ContractName: 'SGN654321', Data: 'OK' },
  ]);
  assert.equal(histRows.length, 1);
  assert.equal(histRows[0].createBy, 'ktv.mau01');
  assert.equal(histRows[0].port, 'Port 02');

  const mutOk = parsePortMutationResponse(
    JSON.stringify(['1', 'Cập nhật thành công', 'DEMO-POP-01 • P02', 'OLT 0/8']),
    'Đổi Port',
    'SGN654321'
  );
  assert.equal(mutOk.status, 'ok');
  assert.equal(mutOk.tstc, 'DEMO-POP-01 • P02');
  const mutErr = parsePortMutationResponse(
    JSON.stringify(['2', 'Port đang được sử dụng']),
    'Cấp Port',
    'SGN654321'
  );
  assert.equal(mutErr.status, 'error');

  const demoPortCtx = await fetchPortContractContext('SGN654321', { forceDemo: true });
  assert.equal(demoPortCtx.status, 'ok');
  assert.ok(demoPortCtx.locations.length >= 1);
  const demoSlots = await fetchPortSlotList('55101', { forceDemo: true });
  assert.ok(demoSlots.slots.some((s) => !s.disabled) && demoSlots.slots.some((s) => s.disabled));
  const demoHistory = await fetchPortHistory({ pointName: 'DEMO-POP-01-SPL-01', forceDemo: true });
  assert.ok(demoHistory.rows.length >= 1);
  const portLookup = await runPortAction('lookup_port', ' sgn123456 ');
  assert.equal(portLookup.status, 'ok');
  assert.equal(portLookup.mode, 'demo');
  assert.ok(
    portLookup.summaryFields.some(
      (f) => f.label === 'Mã hợp đồng' && f.value === 'SGN123456'
    ),
    'Port lookup demo result must include normalized Mã hợp đồng'
  );
  assert.equal((await runPortAction('lookup_port', '')).status, 'validation_error');
  assert.equal((await runPortAction('unknown', 'SGN123456')).status, 'error');
  assert.equal((await runPortAction('assign_port', 'SGN123456')).status, 'ok');
  assert.equal((await runPortAction('release_port', 'SGN123456')).status, 'ok');
  const routedLookup = await executePortalAction('port', 'lookup_port', 'sgn123456');
  assert.ok(
    routedLookup.title.includes('Thông tin Port'),
    'executePortalAction must route port portal to port adapter'
  );
  assert.ok(userscriptContent.includes('runPortAction'), 'Userscript bundle must include runPortAction');
  assert.ok(userscriptContent.includes('mvcport.fpt.net'), 'Userscript bundle must include mvcport.fpt.net');
  assert.ok(userscriptContent.includes('matchedPortalId'), 'Userscript bundle must include host auto-detection');
  assert.ok(userscriptContent.includes('handlePortDeepScan'), 'Userscript bundle must include handlePortDeepScan');
  assert.ok(userscriptContent.includes('port_ftth_new_v2'), 'Userscript bundle must include port_ftth_new_v2');
  assert.ok(userscriptContent.includes('/ftth_newport/contract/index'), 'Userscript bundle must target /ftth_newport/contract/index');
  assert.ok(userscriptContent.includes('/FTTH_NewPort/Contract/Insert'), 'Userscript bundle must target /FTTH_NewPort/Contract/Insert');
  assert.ok(userscriptContent.includes('readMvcPortTokenFromCookie'), 'Userscript bundle must include readMvcPortTokenFromCookie');

  const portHtmlSample = `
    <html>
      <head><title>Quan ly Port SGN123456</title></head>
      <frameset>
        <frame id="leftFrame" name="left" src="Left.asp?token=secret123">
      </frameset>
      <body>
        <iframe id="ftthNew" name="main" src="http://mvcport.fpt.net/FTTH/Index?hd=SGN123456"></iframe>
        <a href="/Port/View?id=1" onclick="GoPage('/Port/Assign?token=abc')">Cấp Port SGN123456</a>
        <a href="mailto:a@b.c">mail</a>
      </body>
    </html>
  `;
  const portParsed = extractFramesAndLinksFromHtml(portHtmlSample, 'http://port.fpt.net/', 'SGN123456');
  assert.equal(portParsed.title, 'Quan ly Port <CONTRACT_ID>');
  assert.equal(portParsed.frames.length, 2);
  assert.equal(portParsed.frames[0].origin, 'http://port.fpt.net');
  assert.equal(portParsed.frames[0].pathname, '/Left.asp');
  assert.deepEqual(portParsed.frames[0].queryParamNames, ['token']);
  assert.equal(portParsed.frames[1].origin, 'http://mvcport.fpt.net');
  assert.equal(portParsed.frames[1].pathname, '/FTTH/Index');
  assert.deepEqual(portParsed.frames[1].queryParamNames, ['hd']);
  assert.equal(portParsed.links.length, 1);
  assert.equal(portParsed.links[0].pathname, '/Port/Assign');
  assert.equal(portParsed.links[0].text, 'Cấp Port <CONTRACT_ID>');
  assert.deepEqual(portParsed.links[0].queryParamNames, ['token']);
  const portSerialized = JSON.stringify(portParsed);
  assert.equal(portSerialized.includes('secret123'), false, 'Must strip frame query value');
  assert.equal(portSerialized.includes('SGN123456'), false, 'Must redact contract token');
  assert.equal(portSerialized.includes('abc'), false, 'Must strip link query value');

  const validMvcHtmlWithInlineError =
    '<html><body><input id="h_id" value="900002002" />' +
    '<script>Message("Hết thời gian làm việc. Vui lòng Refesh (hoặc F5) lại trang để tiếp tục", "Thông báo");</' +
    'script></body></html>';
  assert.equal(
    detectPortSessionExpired(
      {
        status: 200,
        finalUrl: 'http://mvcport.fpt.net/FTTH_NewPort/Contract/Insert/900002002',
        responseText: validMvcHtmlWithInlineError,
      },
      'http://mvcport.fpt.net/FTTH_NewPort/Contract/Insert/900002002'
    ).expired,
    false,
    'Valid mvcport HTML containing dormant inline JS timeout message must not flag expired'
  );
  assert.equal(
    detectPortSessionExpired(
      {
        status: 200,
        finalUrl: 'http://mvcport.fpt.net/FTTH_NewPort/Contract/Index_Search',
        responseText: '"Hết thời gian làm việc. Vui lòng Refesh"',
      },
      'http://mvcport.fpt.net/FTTH_NewPort/Contract/Index_Search'
    ).expired,
    true,
    'Short non-HTML timeout text response must flag expired'
  );
  assert.equal(
    detectPortSessionExpired(
      {
        status: 200,
        finalUrl: 'http://port.fpt.net/LoginPage.aspx',
        responseText: '<html></html>',
      },
      'http://mvcport.fpt.net/ftth_newport/contract/index'
    ).expired,
    true,
    'Redirect to LoginPage.aspx must flag expired'
  );
  assert.equal(
    detectPortSessionExpired(
      {
        status: 401,
        finalUrl: 'http://mvcport.fpt.net/Location/LocationID',
        responseText: '',
      },
      'http://mvcport.fpt.net/Location/LocationID'
    ).expired,
    true,
    'HTTP 401 on mvcport must flag expired'
  );
  assert.equal(
    detectPortSessionExpired(
      {
        status: 403,
        finalUrl: 'http://mvcport.fpt.net/Location/LocationID',
        responseText: '',
      },
      'http://mvcport.fpt.net/Location/LocationID'
    ).expired,
    true,
    'HTTP 403 on mvcport must flag expired'
  );
  assert.equal(
    detectIamRedirect({
      status: 200,
      finalUrl: 'http://port.fpt.net/LoginPage.aspx',
      requestedUrl: 'http://mvcport.fpt.net/ftth_newport/contract/index',
      responseText: '<html></html>',
    }).expired,
    true,
    'detectIamRedirect must flag redirect to /LoginPage.aspx'
  );
  assert.equal(
    parseMvcPortTokenFromCookieString('MVCPORT_COOKIE_V2_PROD=1; MVCPORT_TOKEN=oldTok; MVCPORT_TOKEN_PROD=new%2BTok'),
    'new+Tok'
  );
  assert.equal(
    parseMvcPortTokenFromCookieString('MVCPORT_COOKIE_V2=1; MVCPORT_TOKEN=legacyTok'),
    'legacyTok'
  );
  assert.equal(
    extractMvcPortTokenFromText('<a href="http://mvcport.fpt.net/ftth_newport/contract/index?Token=abc%2B123&x=1">Tìm kiếm</a>'),
    'abc+123'
  );
  assert.equal(
    extractMvcPortTokenFromText('<a href="http://other.fpt.net/?Token=shouldIgnore">x</a>'),
    ''
  );
  assert.equal(typeof buildPortUrl, 'function');
  assert.ok(userscriptContent.includes('looksHtmlPage'), 'Userscript bundle must include looksHtmlPage');
  assert.ok(
    userscriptContent.includes('parseMvcPortTokenFromCookieString'),
    'Userscript bundle must include parseMvcPortTokenFromCookieString'
  );
  assert.equal(
    PORT_ENDPOINTS.portIndexPage,
    'http://port.fpt.net/Index.aspx',
    'PORT_ENDPOINTS.portIndexPage must point to port.fpt.net/Index.aspx'
  );
  assert.equal(
    extractMvcPortTokenFromText(
      '<frame name="leftFrame" src="LeftMenu.aspx?mvct=tok%2B123%3D&amp;mvcu=http://mvcport.fpt.net" />'
    ),
    'tok+123='
  );
  assert.equal(
    extractMvcPortTokenFromText(
      '<a href="http://mvcport.fpt.net/ftth_newport/contract/index?a=1&amp;Token=abc%2Bxyz">Tìm kiếm</a>'
    ),
    'abc+xyz'
  );
  assert.equal(
    extractMvcPortTokenFromText('LeftMenu.aspx?mvcu=1&mvct=raw+plus=='),
    'raw+plus==',
    'Literal + in mvct token must be preserved without turning into space'
  );

  let calledMenuActionId = null;
  const mockPortTopWin = {
    top: {
      frames: [
        {
          name: 'leftFrame',
          location: { pathname: '/LeftMenu.aspx' },
          Action(id) {
            calledMenuActionId = id;
          },
        },
      ],
    },
  };
  assert.equal(
    triggerPortFtthMenuAction(mockPortTopWin),
    true,
    'triggerPortFtthMenuAction must find leftFrame and invoke Action(1322)'
  );
  assert.equal(calledMenuActionId, 1322);
  assert.equal(
    triggerPortFtthMenuAction({ top: { frames: [{ name: 'mainFrame', location: { pathname: '/Default1.aspx' } }] } }),
    false,
    'triggerPortFtthMenuAction must return false when leftFrame is missing'
  );
  assert.equal(
    (await bootstrapMvcPortSession()).ok,
    false,
    'bootstrapMvcPortSession must return { ok: false } in preview/Node env without throwing'
  );
  assert.ok(
    userscriptContent.includes('bootstrapMvcPortSession'),
    'Userscript bundle must include bootstrapMvcPortSession'
  );
  assert.ok(
    userscriptContent.includes('triggerPortFtthMenuAction'),
    'Userscript bundle must include triggerPortFtthMenuAction'
  );
  assert.ok(
    userscriptContent.toLowerCase().includes('leftmenu.aspx'),
    'Userscript bundle must reference LeftMenu.aspx'
  );

  const loggedInPortIndexHtml =
    '<html><head><title>Đăng nhập Hệ Thống Port</title></head>' +
    '<frameset cols="200,*">' +
    '<frame name="leftFrame" src="LeftMenu.aspx?mvct=tok%2B123&amp;mvcu=1" />' +
    '<frame name="mainFrame" src="Default1.aspx" />' +
    '</frameset></html>';
  assert.equal(
    detectIamRedirect({
      status: 200,
      finalUrl: 'http://port.fpt.net/Index.aspx',
      requestedUrl: 'http://port.fpt.net/Index.aspx',
      responseText: loggedInPortIndexHtml,
    }).expired,
    false,
    'Logged-in port.fpt.net/Index.aspx frameset with title "Đăng nhập Hệ Thống Port" must not trigger IAM expired'
  );
  assert.equal(
    detectPortSessionExpired(
      {
        status: 200,
        finalUrl: 'http://port.fpt.net/Index.aspx',
        responseText: loggedInPortIndexHtml,
      },
      'http://port.fpt.net/Index.aspx'
    ).expired,
    false,
    'detectPortSessionExpired must not flag logged-in port.fpt.net/Index.aspx frameset as expired'
  );
  assert.equal(
    detectIamRedirect({
      status: 200,
      finalUrl: 'http://port.fpt.net/Other.aspx',
      requestedUrl: 'http://port.fpt.net/Other.aspx',
      responseText: '<html><head><title>Đăng nhập Hệ Thống Port</title></head><body>Login</body></html>',
    }).expired,
    true,
    'Non-frameset HTML with login title must still trigger IAM expired'
  );
  assert.equal(
    extractMvcPortTokenFromText('src="/AnyMenu.aspx?foo=1&amp;mvct=tok%2B99"'),
    'tok+99'
  );
  assert.equal(
    extractMvcPortTokenFromText('<a href="http://other.fpt.net/?Token=shouldIgnore">x</a>'),
    ''
  );
  assert.ok(
    userscriptContent.includes('isPortLoggedInFrameset'),
    'Userscript bundle must include isPortLoggedInFrameset'
  );
  assert.ok(
    userscriptContent.includes('handleCurrentPageDeepScan'),
    'Userscript bundle must include handleCurrentPageDeepScan'
  );
  assert.ok(
    userscriptContent.includes('current_page_v1'),
    'Userscript bundle must include current_page_v1 scan kind'
  );
  console.log('   OK: port.fpt.net adapter tests passed.');

  console.log('15. Testing Inside CheckList ByPass parsers, validators, and demo execution...');
  const bypassActionCfg = PORTALS.inside.actions.find((a) => a.id === 'bypass');
  assert.ok(bypassActionCfg, 'PORTALS.inside.actions must contain bypass action');
  assert.equal(bypassActionCfg.label, 'ByPass');
  assert.equal(bypassActionCfg.requiresContract, false);
  assert.ok(
    INSIDE_ENDPOINTS.bypass &&
      INSIDE_ENDPOINTS.bypass.insert.includes('/CheckListByPass/CLByPass/InsListByPass') &&
      INSIDE_ENDPOINTS.bypass.update.includes('/CheckListByPass/CLByPass/UpdateRowTableCL'),
    'INSIDE_ENDPOINTS.bypass must wire live CheckList ByPass endpoints'
  );
  assert.equal(BYPASS_CHOICE_OPTIONS.length, 2);
  assert.equal(BYPASS_TYPE_OPTIONS.length, 3);
  assert.equal(BYPASS_REASON_BY_TYPE.Gong.length, 0);
  assert.equal(BYPASS_REASON_BY_TYPE['Bo Gong'].length, 4);
  assert.equal(BYPASS_REASON_BY_TYPE['Bo Gong Tam va Phai Xu Ly Gong Lai'].length, 4);

  const bypassMetaNormal = parseByPassPageMeta(`
    <script>
      var UseCN = 'ktv.mau01';
      var isInsert = 'True';
      e["AccLeaderByPass"] = 'ktv.mau01';
      if (UseCN == 'admin.mau01' || UseCN == 'admin.mau02') { CN.push('destroy') }
      function LoadType() { $("#drpType").kendoDropDownList({ dataSource: [{ value: '', text: 'Tat ca' }] }); }
      function LoadTypeView() { $("#drpTypeView").kendoDropDownList({ dataSource: [{ value: 1, text: 'Hop dong' }] }); }
    </` + `script>
  `);
  assert.equal(bypassMetaNormal.currentUser, 'ktv.mau01');
  assert.equal(bypassMetaNormal.isInsert, true);
  assert.equal(bypassMetaNormal.canDelete, false);
  assert.deepEqual(bypassMetaNormal.deleteAllowedUsers, ['admin.mau01', 'admin.mau02']);
  assert.equal(bypassMetaNormal.defaultFlagByPass, '');
  assert.equal(bypassMetaNormal.contractTypeView, '1');

  const bypassMetaAdmin = parseByPassPageMeta(
    `var UseCN = 'admin.mau01'; var isInsert = 'False'; if (UseCN == 'admin.mau01' || UseCN == 'admin.mau02') { CN.push('destroy') }`
  );
  assert.equal(bypassMetaAdmin.currentUser, 'admin.mau01');
  assert.equal(bypassMetaAdmin.isInsert, false);
  assert.equal(bypassMetaAdmin.canDelete, true);

  assert.equal(
    validateByPassPayload({
      mode: 'create',
      choice: 'Hợp đồng',
      contract: 'SGN654321',
      accByPass: 'bad_email',
      typeByPass: 'Gong',
    }).valid,
    false,
    'Missing @ in AccByPass must fail validation'
  );
  assert.equal(
    validateByPassPayload({
      mode: 'create',
      choice: 'Hợp đồng',
      contract: 'SGN654321',
      accByPass: 'nvkt@fpt.com',
      typeByPass: 'Bo Gong',
      contentByPass: '',
    }).valid,
    false,
    'Missing ContentByPass for Bo Gong must fail validation'
  );
  assert.equal(
    validateByPassPayload({
      mode: 'create',
      choice: 'Hợp đồng',
      contract: 'SGN654321',
      accByPass: 'nvkt@fpt.com',
      typeByPass: 'Bo Gong Tam va Phai Xu Ly Gong Lai',
      contentByPass: '',
    }).valid,
    false,
    'Missing ContentByPass for Bo Gong Tam must fail validation'
  );
  const validGong = validateByPassPayload({
    mode: 'create',
    choice: 'Tập điểm',
    contract: 'DEMO-POP-01.0001/FO',
    accByPass: 'nvkt@fpt.com',
    typeByPass: 'Gong',
    contentByPass: 'should be cleared',
  });
  assert.equal(validGong.valid, true);
  assert.equal(validGong.contentByPass, '', 'Gong mode must clear ContentByPass');

  assert.equal(
    validateByPassPayload({
      mode: 'update',
      contract: 'SGN654321',
      accByPass: 'nvkt@fpt.com',
      typeByPass: 'Bo Gong',
      contentByPass: 'Ha tang doi tac',
      oldAccByPass: 'nvkt@fpt.com',
      oldTypeByPass: 'Bo Gong',
      oldContentByPass: 'Ha tang doi tac',
    }).valid,
    false,
    'Unchanged ByPass update payload must fail validation'
  );

  const parsedByPassRows = parseByPassListRows(
    JSON.stringify([
      {
        STT: 1,
        BillTo_District: 'Quan 1',
        Contract: 'SGN654321',
        AccCreateByPass: 'ktv.mau01',
        AccLeaderByPass: 'ktv.mau01',
        AccByPass: 'nvkt@fpt.com',
        FlagByPass: 'Bo Gong',
        Date: '23/11/2026',
        UpdateDate: '23/11/2026 16:30',
        Content: 'Ha tang doi tac',
      },
    ])
  );
  assert.equal(parsedByPassRows.length, 1);
  assert.equal(parsedByPassRows[0].contract, 'SGN654321');
  assert.equal(parsedByPassRows[0].flagByPass, 'Bo Gong');

  assert.equal(parseByPassInsertResponse('"Thanh cong 1 dong"', 'SGN654321').status, 'ok');
  assert.equal(
    parseByPassInsertResponse('"Bạn không có quyền thực hiện thao tác này!"', 'SGN654321').status,
    'error'
  );
  assert.equal(parseByPassUpdateResponse('-1', 'SGN654321').status, 'error');
  assert.ok(parseByPassUpdateResponse('-1', 'SGN654321').message.includes('RX'));
  assert.equal(parseByPassUpdateResponse('-2', 'DEMO-POP-01.0001/FO').status, 'error');
  assert.ok(parseByPassUpdateResponse('-2', 'DEMO-POP-01.0001/FO').message.includes('tập điểm'));
  assert.equal(parseByPassUpdateResponse('No permision!', 'SGN654321').status, 'error');
  assert.equal(parseByPassUpdateResponse('[]', 'SGN654321').status, 'error');
  const bpUpdOk = parseByPassUpdateResponse('[{"UpdateDate":"23/11/2026 16:30"}]', 'SGN654321');
  assert.equal(bpUpdOk.status, 'ok');
  assert.equal(bpUpdOk.updateDate, '23/11/2026 16:30');
  assert.equal(parseByPassDeleteResponse('1', 'SGN654321').status, 'ok');
  assert.equal(parseByPassDeleteResponse('0', 'SGN654321').status, 'error');

  const demoBpMeta = await fetchInsideByPassMeta({ forceDemo: true });
  assert.equal(demoBpMeta.status, 'ok');
  const demoBpSearch = await searchInsideByPass('SGN654321', { forceDemo: true });
  assert.equal(demoBpSearch.status, 'ok');
  assert.equal(demoBpSearch.rows[0].contract, 'SGN654321');

  const demoBpCreate = await runInsideAction('bypass', 'SGN654321', {
    mode: 'create',
    choice: 'Hợp đồng',
    contract: 'SGN654321',
    accByPass: 'nvkt@fpt.com',
    typeByPass: 'Bo Gong',
    contentByPass: 'Ha tang doi tac',
    forceDemo: true,
  });
  assert.equal(demoBpCreate.status, 'ok');
  assert.equal(demoBpCreate.mode, 'demo');

  const demoBpPointNoTopContract = await runInsideAction('bypass', '', {
    mode: 'create',
    choice: 'Tập điểm',
    contract: 'DEMO-POP-01.0001/FO',
    accByPass: 'nvkt@fpt.com',
    typeByPass: 'Gong',
    forceDemo: true,
  });
  assert.equal(demoBpPointNoTopContract.status, 'ok');
  assert.ok(
    demoBpPointNoTopContract.summaryFields.some((f) => f.value === 'DEMO-POP-01.0001/FO'),
    'ByPass in Tap diem mode must work without top contract input'
  );

  assert.ok(userscriptContent.includes('InsListByPass'), 'Userscript must include InsListByPass');
  assert.ok(userscriptContent.includes('UpdateRowTableCL'), 'Userscript must include UpdateRowTableCL');
  assert.ok(userscriptContent.includes('LoadListContract'), 'Userscript must include LoadListContract');
  assert.ok(
    userscriptContent.includes('loadInsideByPassModal'),
    'Userscript must include loadInsideByPassModal'
  );
  console.log('   OK: Inside CheckList ByPass adapter tests passed.');

  console.log('16. Testing Android App Native Bridge & Packaging...');
  assert.equal(isAndroidAppEnv(), false);
  assert.equal(getRuntimeEnv(), 'preview');

  const hadOwnWindow = Object.prototype.hasOwnProperty.call(globalThis, 'window');
  const prevWindow = globalThis.window;
  const capturedHttpCalls = [];
  const capturedOpenCalls = [];
  const nativeStore = new Map();

  try {
    globalThis.window = {
      RemoteInsideNative: {
        httpRequest(payloadJson) {
          const parsed = JSON.parse(payloadJson);
          capturedHttpCalls.push(parsed);
          nativeStore.set(
            parsed.reqId,
            JSON.stringify({
              ok: true,
              status: 200,
              finalUrl: `${parsed.url}?ok=1`,
              responseText: 'NATIVE_OK',
              responseHeaders: 'Content-Type: text/plain\r\n',
            })
          );
          queueMicrotask(() => {
            if (typeof globalThis.window.__riNativeResolve === 'function') {
              globalThis.window.__riNativeResolve(parsed.reqId);
            }
          });
        },
        consumeResponse(reqId) {
          const val = nativeStore.get(reqId) || '';
          nativeStore.delete(reqId);
          return val;
        },
        openPortal(url, mode, title) {
          capturedOpenCalls.push({ url, mode, title });
        },
      },
    };

    assert.equal(isAndroidAppEnv(), true);
    assert.equal(getRuntimeEnv(), 'android');
    assert.equal(isUserscriptEnv(), true);

    const nativeRes = await requestPortal({
      url: 'http://inside.fpt.net/CustomerService/Search',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: 'Contract=SGN123456',
      timeout: 5000,
    });
    assert.equal(capturedHttpCalls.length, 1);
    assert.equal(capturedHttpCalls[0].method, 'POST');
    assert.equal(
      capturedHttpCalls[0].headers['Content-Type'],
      'application/x-www-form-urlencoded'
    );
    assert.equal(capturedHttpCalls[0].data, 'Contract=SGN123456');
    assert.equal(nativeRes.ok, true);
    assert.equal(nativeRes.mode, 'android');
    assert.equal(nativeRes.status, 200);
    assert.equal(
      nativeRes.finalUrl,
      'http://inside.fpt.net/CustomerService/Search?ok=1'
    );
    assert.equal(nativeRes.responseText, 'NATIVE_OK');
    assert.equal(
      globalThis.window.__riNativePending.size,
      0,
      'Native bridge must clean up __riNativePending after resolve'
    );

    const openedNative = openExternalOrPortalUrl('http://port.fpt.net', {
      mode: 'login',
      title: 'Đăng nhập Port',
    });
    assert.equal(openedNative, true);
    assert.deepEqual(capturedOpenCalls, [
      { url: 'http://port.fpt.net', mode: 'login', title: 'Đăng nhập Port' },
    ]);
  } finally {
    if (hadOwnWindow) {
      globalThis.window = prevWindow;
    } else {
      delete globalThis.window;
    }
  }

  assert.equal(isAndroidAppEnv(), false);
  const fallbackOpenCalls = [];
  const openedFallback = openExternalOrPortalUrl('http://inside.fpt.net', {
    mode: 'portal',
    title: 'Inside',
    pageWindow: {
      open(u, t, f) {
        fallbackOpenCalls.push({ u, t, f });
      },
    },
  });
  assert.equal(openedFallback, true);
  assert.deepEqual(fallbackOpenCalls, [
    { u: 'http://inside.fpt.net', t: '_blank', f: 'noopener' },
  ]);

  const androidDistPath = path.join(DIST_DIR, 'android-app.html');
  const androidAssetPath = path.join(
    ROOT_DIR,
    'android',
    'app',
    'src',
    'main',
    'assets',
    'remote-inside.html'
  );
  assert.ok(fs.existsSync(androidDistPath), 'dist/android-app.html must exist');
  assert.ok(
    fs.existsSync(androidAssetPath),
    'android/app/src/main/assets/remote-inside.html must exist'
  );
  const androidDistContent = fs.readFileSync(androidDistPath, 'utf8');
  const androidAssetContent = fs.readFileSync(androidAssetPath, 'utf8');
  assert.equal(
    androidDistContent,
    androidAssetContent,
    'dist/android-app.html and Android WebView asset HTML must be byte-identical'
  );
  assert.equal(
    forbiddenDemoDataRe.test(androidAssetContent),
    false,
    'Android bundle asset must not contain personal/contract/IP demo fixtures'
  );
  const androidScriptMatch = androidAssetContent.match(/<script>([\s\S]*?)<\/script>/i);
  assert.ok(
    androidScriptMatch && androidScriptMatch[1],
    'Android HTML asset must contain embedded <script>'
  );
  const androidEmbeddedJs = androidScriptMatch[1].replace(/<\\\/script/gi, '</script');
  new vm.Script(androidEmbeddedJs, { filename: 'android-embedded.js' });
  assert.ok(
    androidEmbeddedJs.includes('RemoteInsideNative'),
    'Android embedded JS must contain RemoteInsideNative bridge'
  );
  assert.ok(
    androidEmbeddedJs.includes('__REMOTE_INSIDE_VERSION__'),
    'Android embedded JS must contain __REMOTE_INSIDE_VERSION__'
  );

  const requiredAndroidFiles = [
    'android/settings.gradle.kts',
    'android/build.gradle.kts',
    'android/gradle.properties',
    'android/app/build.gradle.kts',
    'android/app/proguard-rules.pro',
    'android/app/src/main/AndroidManifest.xml',
    'android/app/src/main/res/xml/network_security_config.xml',
    'android/app/src/main/res/values/colors.xml',
    'android/app/src/main/res/values/styles.xml',
    'android/app/src/main/res/drawable/bg_btn_primary.xml',
    'android/app/src/main/res/drawable/bg_btn_subtle.xml',
    'android/app/src/main/res/drawable/ic_launcher_background.xml',
    'android/app/src/main/res/drawable/ic_launcher_foreground.xml',
    'android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml',
    'android/app/src/main/res/layout/activity_main.xml',
    'android/app/src/main/java/com/remoteinside/app/MainActivity.kt',
    '.github/workflows/android-apk.yml',
  ];
  for (const rel of requiredAndroidFiles) {
    assert.ok(
      fs.existsSync(path.join(ROOT_DIR, rel)),
      `Required Android/CI file must exist: ${rel}`
    );
  }
  console.log('   OK: Android App Native Bridge & Packaging checks passed.');

  console.log('17. Testing FOX-ERP / Partner SPA Scanner & Recorder...');
  assert.ok(
    PORTALS.inside.hosts.includes('fox-erp.fpt.net') &&
      PORTALS.inside.hosts.includes('partner.fpt.net'),
    'PORTALS.inside.hosts must include fox-erp.fpt.net and partner.fpt.net'
  );
  for (const spaDomain of ['fox-erp.fpt.net', 'partner.fpt.net']) {
    assert.ok(
      userscriptContent.includes(`@match        https://${spaDomain}/*`) &&
        userscriptContent.includes(`@match        http://${spaDomain}/*`),
      `Userscript must include @match for ${spaDomain}`
    );
    assert.ok(
      userscriptContent.includes(`@connect      ${spaDomain}`),
      `Userscript must include @connect for ${spaDomain}`
    );
  }

  const headerSummary = summarizeSensitiveHeaders({
    Authorization: 'Bearer super-secret-jwt-123',
    'X-Api-Key': 'abc',
    'Content-Type': 'application/json',
  });
  assert.deepEqual(headerSummary, {
    sensitiveHeaderNames: ['authorization', 'x-api-key'],
    authScheme: 'Bearer',
  });
  const headerSummaryText = JSON.stringify(headerSummary);
  assert.equal(
    headerSummaryText.includes('super-secret') || headerSummaryText.includes('abc'),
    false,
    'summarizeSensitiveHeaders must never expose header values'
  );

  function MockXhr() {
    this._listeners = {};
    this.responseType = 'json';
    this.status = 200;
    this.response = { ok: true, items: [{ ticketCode: 'TK1', phone: '0901234567' }] };
  }
  MockXhr.prototype.open = function open() {};
  MockXhr.prototype.setRequestHeader = function setRequestHeader() {};
  MockXhr.prototype.getResponseHeader = function getResponseHeader() {
    return 'application/json';
  };
  MockXhr.prototype.addEventListener = function addEventListener(evt, fn) {
    this._listeners[evt] = this._listeners[evt] || [];
    this._listeners[evt].push(fn);
  };
  MockXhr.prototype.send = function send() {
    for (const fn of this._listeners.loadend || []) {
      fn.call(this);
    }
  };

  const mockSpaWindow = {
    location: { origin: 'https://fox-erp.fpt.net' },
    XMLHttpRequest: MockXhr,
  };
  const spaRec = createNetworkRecorder(mockSpaWindow, () => 'SGN123456');
  assert.equal(spaRec.start(), true);
  const spaXhr = new mockSpaWindow.XMLHttpRequest();
  spaXhr.open('POST', 'https://api-erp.fpt.vn/tkbt/tk/ticket/detail');
  spaXhr.setRequestHeader('Authorization', 'Bearer ultra-secret-token-value');
  spaXhr.setRequestHeader('Content-Type', 'application/json');
  spaXhr.send(JSON.stringify({ contract: 'SGN123456', phone: '0909998888' }));
  spaRec.stop();

  const xhrEntries = spaRec.getEntries();
  assert.equal(xhrEntries.length, 1);
  assert.equal(xhrEntries[0].transport, 'xhr');
  assert.equal(xhrEntries[0].pathname, '/tkbt/tk/ticket/detail');
  assert.deepEqual(xhrEntries[0].authHints, {
    sensitiveHeaderNames: ['authorization'],
    authScheme: 'Bearer',
  });
  assert.equal(xhrEntries[0].responseSchema.ok, 'boolean');
  assert.equal(xhrEntries[0].responseSchema.items[1].phone, '[REDACTED]');
  const recJson = JSON.stringify(xhrEntries);
  assert.equal(
    recJson.includes('ultra-secret-token-value') || recJson.includes('0901234567'),
    false,
    'Recorder JSON must never expose tokens or sensitive field values'
  );

  const mockStorageWin = {
    localStorage: {
      length: 2,
      key: (i) => ['fox_user_prefs', 'access_token'][i],
      getItem: () => 'TOP_SECRET_VALUE',
    },
    sessionStorage: {
      length: 1,
      key: (i) => ['erp_tab_state'][i],
      getItem: () => 'TOP_SECRET_SESSION',
    },
  };
  const spaSnap = scanPageStructure(
    {
      title: 'Chi tiet phieu SGN123456',
      defaultView: mockStorageWin,
      querySelector: () => null,
      querySelectorAll: () => [],
    },
    {
      origin: 'https://fox-erp.fpt.net',
      pathname: '/app/tkbt/tk/ticket',
      href: 'https://fox-erp.fpt.net/app/tkbt/tk/ticket?q=opaque',
    },
    'SGN123456'
  );
  assert.deepEqual(spaSnap.storageKeyNames, {
    local: ['fox_user_prefs', 'access_token'],
    session: ['erp_tab_state'],
  });
  assert.equal(
    JSON.stringify(spaSnap).includes('TOP_SECRET'),
    false,
    'scanPageStructure must only collect storage key names, never values'
  );

  const redactedResourceHeaders = redactHeaders({
    'x-resource-grant': 'Fe26.2**secret-grant-value',
    accept: 'application/json',
  });
  assert.deepEqual(redactedResourceHeaders, { accept: 'application/json' });
  const resourceAuthHints = summarizeSensitiveHeaders({
    'x-resource-grant': 'Fe26.2**secret-grant-value',
    accept: 'application/json',
  });
  assert.deepEqual(resourceAuthHints, {
    sensitiveHeaderNames: ['x-resource-grant'],
    authScheme: '',
  });
  assert.equal(
    JSON.stringify({ redactedResourceHeaders, resourceAuthHints }).includes('secret-grant-value'),
    false,
    'x-resource-grant value must never appear in redacted headers or authHints'
  );

  const sampleMinifiedJs =
    'async function a(e){return fetch("/app/tkbt/tk/api/equipment/clear-mac",{method:"POST",headers:{"x-resource-grant":e},body:JSON.stringify({Contract:"SGN123456"})})}';
  const contextsFromOpts = extractCodeContextsFromJs(
    sampleMinifiedJs,
    /\/api\/|x-resource-grant/i,
    'SGN123456',
    { maxTotal: 4000, maxContexts: 10, radius: 180 }
  );
  assert.ok(
    contextsFromOpts.length >= 1,
    'extractCodeContextsFromJs must support options object and return contexts'
  );
  assert.ok(
    contextsFromOpts[0].includes('/api/equipment/clear-mac') &&
      contextsFromOpts[0].includes('x-resource-grant') &&
      !contextsFromOpts[0].includes('SGN123456'),
    'extractCodeContextsFromJs must preserve endpoint context and redact contractId'
  );

  const spaHtmlChunks = extractSpaChunkUrls(
    `
      <link rel="modulepreload" as="script" href="/app/tkbt/tk/_nuxt/ticket.js">
      <link href="/app/tkbt/tk/_nuxt/vuetify-core.js" rel="preload">
      <link rel="stylesheet" href="/app/tkbt/tk/_nuxt/main.css">
      <script src="/app/tkbt/tk/_nuxt/entry.js?v=123"></script>
      <script src="https://cdn.example.com/other-origin.js"></script>
    `,
    'https://fox-erp.fpt.net/app/tkbt/tk/ticket?q=1',
    [
      { name: 'https://fox-erp.fpt.net/app/tkbt/tk/_nuxt/ticket.js' },
      { name: 'https://fox-erp.fpt.net/app/tkbt/tk/_nuxt/complete-modal.mjs' },
      { name: 'https://other.fpt.net/app/cross-origin.js' },
    ]
  );
  assert.deepEqual(spaHtmlChunks, [
    'https://fox-erp.fpt.net/app/tkbt/tk/_nuxt/ticket.js',
    'https://fox-erp.fpt.net/app/tkbt/tk/_nuxt/entry.js?v=123',
    'https://fox-erp.fpt.net/app/tkbt/tk/_nuxt/complete-modal.mjs',
  ]);
  console.log('   OK: FOX-ERP / Partner SPA Scanner & Recorder checks passed.');

  console.log('18. Testing FOX-ERP Phiếu triển khai (Deployment Ticket) adapter & live bridge...');
  const deployActionCfg = PORTALS.inside.actions.find((a) => a.id === 'deploy_ticket');
  assert.ok(deployActionCfg, 'PORTALS.inside.actions must contain deploy_ticket');
  assert.equal(deployActionCfg.label, 'Phiếu triển khai');
  assert.equal(deployActionCfg.requiresContract, false);
  assert.equal(PORTALS.inside.statusLabel, 'Đủ 7 lệnh');

  const validLink = extractDeploymentTicketLink([
    { type: 'bt', url: 'https://fox-erp.fpt.net/app/tkbt/bt/ticket?q=btHash', isBackLog: false },
    { type: 'tk', url: 'https://fox-erp.fpt.net/app/tkbt/tk/ticket?q=abc+123%2Fxy', isBackLog: true },
  ]);
  assert.equal(validLink.found, true);
  assert.equal(validLink.hash, 'abc+123/xy');
  assert.equal(validLink.isBackLog, true);

  const maintOnlyLink = extractDeploymentTicketLink([
    { type: 'bt', url: 'https://fox-erp.fpt.net/app/tkbt/bt/ticket?q=onlybt', isBackLog: false },
  ]);
  assert.equal(maintOnlyLink.found, false);
  assert.equal(maintOnlyLink.reason, 'maintenance_only');
  assert.equal(extractDeploymentTicketLink([]).found, false);

  assert.equal(
    extractHashFromLocation({
      hostname: 'fox-erp.fpt.net',
      pathname: '/app/tkbt/tk/ticket',
      search: '?q=hash%2Bwith%2Fplus',
    }),
    'hash+with/plus'
  );
  assert.equal(
    extractHashFromLocation({
      hostname: 'inside.fpt.net',
      pathname: '/default.asp',
      search: '?q=ignored',
    }),
    ''
  );

  const sampleFilter = [
    {
      ParentName: DEPLOYMENT_CATALOG_KEYS.REASON_HIFPT,
      Datas: [
        { Code: 2, Tittle: 'Ly do 2', Position: 2 },
        { Code: 0, Tittle: 'Khong chon', Position: 1 },
      ],
    },
  ];
  assert.deepEqual(parseDataFilterOptions(sampleFilter, DEPLOYMENT_CATALOG_KEYS.REASON_HIFPT), [
    { id: '0', text: 'Khong chon', position: 1 },
    { id: '2', text: 'Ly do 2', position: 2 },
  ]);
  assert.equal(findDataFilterText(sampleFilter, DEPLOYMENT_CATALOG_KEYS.REASON_HIFPT, 2), 'Ly do 2');

  assert.equal(DEPLOYMENT_EQUIPMENT_TYPE.DEPLOY, 1);
  assert.equal(DEPLOYMENT_EQUIPMENT_TYPE.REVOKE, 2);
  assert.equal(DEPLOYMENT_EQUIPMENT_TYPE.EXTRA, 3);
  assert.equal(DEPLOYMENT_CAMERA_PHONE_TYPE, 96);

  const eqNorm = normalizeEquipmentList([
    { EfId: 1, IdCode: 500, Name: 'Day cap', Quantity: 50, TypeId: 3, IsMac: 0 },
    { EfId: 2, IdCode: 100, Name: 'Modem Demo', Quantity: 1, TypeId: 1, IsMac: 1, Mac: '001122334455' },
    { EfId: 3, IdCode: 900, Name: 'Box Thu hoi', Quantity: 1, TypeId: 2, IsMac: 1, Mac: 'AABBCCDDEEFF' },
  ]);
  assert.equal(eqNorm.importItems.length, 2, 'TypeId 1 and 3 must both stay in deployed importItems');
  assert.equal(eqNorm.importItems[0].name, 'Modem Demo', 'MAC equipments must sort first');
  assert.equal(eqNorm.importItems[1].name, 'Day cap', 'Extra deployed materials (TypeId=3) must not become revoke');
  assert.equal(eqNorm.revokeItems.length, 1);
  assert.equal(eqNorm.revokeItems[0].name, 'Box Thu hoi');
  assert.equal(eqNorm.macCount, 1);

  const realShapeSummary = normalizeTicketSummary({
    ObjId: 1000001,
    Contract: 'SGN123456',
    FullName: 'NGUYEN VAN MAU',
    StatusContract: 1,
    DataFilter: sampleFilter,
    SupportInfInfo: [
      {
        SupId: 900001,
        DepCode: 'TK.SGN123456.900001',
        Status: 1,
        StatusDesc: 'Đã xử lý hoàn tất',
        Flag: 1,
        Location: '123 Duong Mau, Quan 1',
        GroupPoints: 'HCM-ODC-01/HO',
        ODCCableType: 'HCM-ODC-01/HO-1/1-G',
        BlockDepName: 'Quan 1-001',
        PlotsName: 'L01',
        FinishDate: '23/11/2026 18:43:58',
        DescriptionCs: 'Ghi chu CS mau',
        CustypeDesc: 'Trien khai moi',
        AppointmentInfo: {
          Appointment: 2,
          TimeZoneBlue: '15:30 - 17:30',
          AppointmentDateBlue: '24/11/2026 17:30:00',
        },
      },
    ],
  });
  assert.equal(realShapeSummary.statusContract, 1);
  assert.equal(realShapeSummary.address, '123 Duong Mau, Quan 1');
  assert.equal(realShapeSummary.ticket.location, '123 Duong Mau, Quan 1');
  assert.equal(realShapeSummary.ticket.groupPoints, 'HCM-ODC-01/HO');
  assert.equal(realShapeSummary.ticket.odcCableType, 'HCM-ODC-01/HO-1/1-G');
  assert.equal(realShapeSummary.ticket.plotsName, 'L01');
  assert.equal(realShapeSummary.ticket.finishDate, '23/11/2026 18:43:58');
  assert.equal(realShapeSummary.ticket.descriptionCs, 'Ghi chu CS mau');
  assert.equal(realShapeSummary.ticket.depTypeDesc, 'Trien khai moi');
  assert.equal(realShapeSummary.ticket.appointmentDate, '15:30 - 17:30 • 24/11/2026 17:30:00 (2 lần)');

  assert.equal(validateCameraPhoneNumber('').valid, false);
  assert.equal(validateCameraPhoneNumber('090abc').valid, false);
  assert.deepEqual(validateCameraPhoneNumber(' 0901234567 '), {
    valid: true,
    value: '0901234567',
    error: '',
  });
  assert.equal(
    canEditDeploymentCameraPhone({ Type: 96, PhoneToken: 'tok_cmr' }, realShapeSummary),
    true
  );
  assert.equal(
    canEditDeploymentCameraPhone({ Type: 5, PhoneToken: 'tok_main' }, realShapeSummary),
    false
  );
  assert.equal(
    canEditDeploymentCameraPhone(
      { Type: 96, PhoneToken: 'tok_cmr' },
      { ...realShapeSummary, statusContract: 2 }
    ),
    false
  );

  assert.equal(validateConstructionUpdate({ outDoorReUsed: -1, descriptionRD: 'ok' }).valid, false);
  assert.equal(
    validateConstructionUpdate({ outDoorReUsed: 10, descriptionRD: 'a'.repeat(501) }).valid,
    false
  );
  assert.deepEqual(validateConstructionUpdate({ outDoorReUsed: ' 12 ', descriptionRD: '  ghi   chu ' }), {
    valid: true,
    error: '',
    outDoorReUsed: 12,
    descriptionRD: 'ghi chu',
  });

  assert.deepEqual(
    buildCompletedPayload({
      objId: 1000001,
      supId: 900001,
      outDoorReUsed: 5,
      descriptionRD: 'Da xu ly',
      reasonDelay: 1,
      reasonHiFPT: 2,
      notCompleteWifi: 0,
      reasonUnuseCapLan: 3,
    }),
    {
      ObjId: 1000001,
      SupId: 900001,
      OutDoorReUsed: 5,
      DescriptionRD: 'Da xu ly',
      ReasonDelay: 1,
      ReasonHiFPT: 2,
      ReasonUnuseCapLan: 3,
    }
  );

  // Full demo workflow
  const demoTicket = await fetchDeploymentTicket('SGN123456', { forceDemo: true });
  assert.equal(demoTicket.status, 'ok');
  assert.equal(demoTicket.mode, 'demo');
  assert.equal(demoTicket.summary.contract, 'SGN123456');
  assert.equal(demoTicket.equipments.importItems.length, 5);
  assert.equal(demoTicket.equipments.revokeItems.length, 0);
  assert.equal(demoTicket.equipments.macCount, 3);
  assert.equal(demoTicket.paymentInfo.sumMoneyPaid, 300000);
  assert.equal((await fetchDeploymentPayment({ forceDemo: true })).paymentInfo.sumMoneyPaid, 300000);
  assert.equal((await clearDeploymentTicketMac({ forceDemo: true })).status, 'ok');
  assert.equal((await revealDeploymentPhone({ forceDemo: true })).phone, '0901000001');
  assert.equal(
    (await updateDeploymentCameraPhone({ phoneNumber: '0901234567', forceDemo: true })).status,
    'ok'
  );
  assert.equal((await fetchDeploymentEContracts({ forceDemo: true })).rows.length, 2);
  assert.equal((await syncDeploymentOnline({ forceDemo: true })).status, 'ok');
  assert.equal((await updateDeploymentConstruction({ outDoorReUsed: 5, forceDemo: true })).status, 'ok');
  assert.equal((await completeDeploymentTicket({ outDoorReUsed: 0, forceDemo: true })).status, 'ok');

  // Live mocked bridge verifying Grant -> x-resource-grant propagation
  const hadWin18 = Object.prototype.hasOwnProperty.call(globalThis, 'window');
  const prevWin18 = globalThis.window;
  const grantStore = new Map();
  const capturedFoxRequests = [];
  try {
    globalThis.window = {
      RemoteInsideNative: {
        httpRequest(payloadJson) {
          const parsed = JSON.parse(payloadJson);
          capturedFoxRequests.push(parsed);
          let bodyObj = { Succeeded: false };
          if (parsed.url === DEPLOYMENT_ENDPOINTS.partnerGetContract) {
            bodyObj = {
              Succeeded: true,
              Data: [
                {
                  type: 'tk',
                  url: 'https://fox-erp.fpt.net/app/tkbt/tk/ticket?q=LIVE_HASH_TOKEN',
                  isBackLog: false,
                },
              ],
            };
          } else if (parsed.url === DEPLOYMENT_ENDPOINTS.getTicketInfo) {
            bodyObj = {
              Succeeded: true,
              Data: {
                ObjId: 1000001,
                Contract: 'SGN123456',
                FullName: 'NGUYEN VAN MAU',
                Grant: 'Fe26.2**demo-grant-token',
                DataFilter: sampleFilter,
                SupportInfInfo: [
                  { SupId: 900001, DepCode: 'TK.SGN123456.900001', Status: 0, Flag: 1, ConstrucInfo: { OutDoorReUsed: 0 } },
                ],
              },
            };
          } else if (parsed.url === DEPLOYMENT_ENDPOINTS.getEquipmentOnDep) {
            bodyObj = {
              Succeeded: true,
              Data: [{ EfId: 1, IdCode: 33096, Name: 'Modem Demo', Quantity: 1, TypeId: 1, IsMac: 1, Mac: '001122334455' }],
            };
          } else if (parsed.url === DEPLOYMENT_ENDPOINTS.getModemMetrics) {
            bodyObj = { Succeeded: true, Data: { Ip: '192.0.2.10', MacAddress: '00:11:22:33:44:55', StatusByPass: false } };
          } else if (parsed.url === DEPLOYMENT_ENDPOINTS.getPaymentInfo) {
            bodyObj = {
              Succeeded: true,
              Data: { SumMoneyPaid: 300000, SumMoneyUnPaid: 0, PaymentStatus: true, PaymentStatusDesc: 'Đã thanh toán' },
            };
          } else if (parsed.url === DEPLOYMENT_ENDPOINTS.clearEquipment) {
            bodyObj = { Succeeded: true, Data: 1, Message: 'Clear OK' };
          } else if (parsed.url === DEPLOYMENT_ENDPOINTS.revealPhone) {
            bodyObj = { Succeeded: true, Data: '0901000009' };
          } else if (parsed.url === DEPLOYMENT_ENDPOINTS.updateCameraPhone) {
            bodyObj = { Succeeded: true, Message: 'Phone updated OK' };
          } else if (parsed.url === DEPLOYMENT_ENDPOINTS.syncOnline) {
            bodyObj = { Succeeded: true, Message: 'Sync OK' };
          } else if (parsed.url === DEPLOYMENT_ENDPOINTS.statusCompleted) {
            bodyObj = { Succeeded: true, Data: 1, Message: 'Completed OK' };
          }
          grantStore.set(
            parsed.reqId,
            JSON.stringify({
              ok: true,
              status: 200,
              finalUrl: parsed.url,
              responseText: JSON.stringify(bodyObj),
              responseHeaders: 'Content-Type: application/json\r\n',
            })
          );
          queueMicrotask(() => {
            if (typeof globalThis.window.__riNativeResolve === 'function') {
              globalThis.window.__riNativeResolve(parsed.reqId);
            }
          });
        },
        consumeResponse(reqId) {
          const val = grantStore.get(reqId) || '';
          grantStore.delete(reqId);
          return val;
        },
      },
    };

    const liveTicket = await fetchDeploymentTicket('SGN123456');
    assert.equal(liveTicket.status, 'ok');
    assert.equal(liveTicket.mode, 'live');
    assert.equal(liveTicket.grant, 'Fe26.2**demo-grant-token');
    assert.equal(liveTicket.paymentInfo.sumMoneyPaid, 300000);

    await clearDeploymentTicketMac({ objId: 1000001, supId: 900001, grant: liveTicket.grant });
    const revRes = await revealDeploymentPhone({ token: 'tok1', objId: 1000001, supId: 900001, grant: liveTicket.grant });
    assert.equal(revRes.phone, '0901000009');
    const updPhoneRes = await updateDeploymentCameraPhone({
      objId: 1000001,
      supId: 900001,
      contract: 'SGN123456',
      oldPhoneNumberToken: 'tok_cmr',
      phoneNumber: '0901234567',
      grant: liveTicket.grant,
    });
    assert.equal(updPhoneRes.status, 'ok');
    const payRes = await fetchDeploymentPayment({ objId: 1000001, supId: 900001, grant: liveTicket.grant });
    assert.equal(payRes.paymentInfo.paymentStatusDesc, 'Đã thanh toán');
    await syncDeploymentOnline({ objId: 1000001, supId: 900001, contract: 'SGN123456', grant: liveTicket.grant });
    await completeDeploymentTicket({ objId: 1000001, supId: 900001, outDoorReUsed: 2, reasonHiFPT: 2, grant: liveTicket.grant });

    for (const ep of [
      DEPLOYMENT_ENDPOINTS.getEquipmentOnDep,
      DEPLOYMENT_ENDPOINTS.getPaymentInfo,
      DEPLOYMENT_ENDPOINTS.clearEquipment,
      DEPLOYMENT_ENDPOINTS.revealPhone,
      DEPLOYMENT_ENDPOINTS.updateCameraPhone,
      DEPLOYMENT_ENDPOINTS.syncOnline,
      DEPLOYMENT_ENDPOINTS.statusCompleted,
    ]) {
      const req = capturedFoxRequests.find((r) => r.url === ep);
      assert.ok(req, `Expected request to ${ep}`);
      assert.equal(req.headers['x-resource-grant'], 'Fe26.2**demo-grant-token', `Expected x-resource-grant on ${ep}`);
    }
    const camPhoneReq = capturedFoxRequests.find((r) => r.url === DEPLOYMENT_ENDPOINTS.updateCameraPhone);
    assert.deepEqual(JSON.parse(camPhoneReq.data), {
      ObjId: 1000001,
      SupId: 900001,
      Contract: 'SGN123456',
      OldPhoneNumberToken: 'tok_cmr',
      PhoneNumber: '0901234567',
    });
  } finally {
    if (hadWin18) {
      globalThis.window = prevWin18;
    } else {
      delete globalThis.window;
    }
  }

  for (const token of [
    'deploy_ticket',
    '/api/ticket/get-ticket-info',
    '/api/equipment/clear-equipment',
    '/api/contract/sync-online',
    '/api/status/completed',
    '/api/contract/reveal-phone',
    '/api/contract/update-number-phone-camera',
    '/api/payment/get-payment-info',
    '/api/record/get-e-contract-record',
  ]) {
    assert.ok(userscriptContent.includes(token), `Userscript must include ${token}`);
    assert.ok(androidAssetContent.includes(token), `Android bundle must include ${token}`);
  }
  assert.equal(
    forbiddenDemoDataRe.test(userscriptContent) || forbiddenDemoDataRe.test(androidAssetContent),
    false,
    'Built deployment ticket bundles must pass forbiddenDemoDataRe with 0 matches'
  );
  console.log('   OK: FOX-ERP Phiếu triển khai tests passed.');

  console.log('19. Testing Vật tư thu hồi (NextGen Blazor DOM bridge) adapter & bundles...');
  assert.equal(PORTALS.recall.status, 'priority');
  assert.ok(PORTALS.recall.actions.some((a) => a.id === 'manage_recall'));
  assert.equal(
    isRecallPortalLocation({ hostname: 'nextgen.fpt.net', pathname: '/resource/recall/' }),
    true
  );
  assert.equal(
    isRecallTicketLocation({ hostname: 'nextgen.fpt.net', pathname: '/resource/recall/recall-ticket' }),
    true
  );
  assert.equal(
    isRecallTicketLocation({ hostname: 'nextgen.fpt.net', pathname: '/resource/recall/' }),
    false
  );

  // Pending recall contract storage handoff (set, consume once, expired rejected)
  const recallStore = new Map();
  const recallStorageAdapter = {
    get: (k) => (recallStore.has(k) ? recallStore.get(k) : null),
    set: (k, v) => recallStore.set(k, v),
  };
  assert.equal(setPendingRecallContract('  sgn 123456 ', recallStorageAdapter), true);
  assert.equal(consumePendingRecallContract(180000, recallStorageAdapter), 'SGN123456');
  assert.equal(consumePendingRecallContract(180000, recallStorageAdapter), '');
  recallStorageAdapter.set(STORAGE_KEYS.RECALL_PENDING_CONTRACT, {
    contractId: 'SGN123456',
    ts: Date.now() - 300000,
  });
  assert.equal(consumePendingRecallContract(180000, recallStorageAdapter), '');

  // Build lightweight mock Blazor DOM matching nextgen.fpt.net/resource/recall/recall-ticket
  const clicks = [];
  const makeMockBtn = (label, { ariaLabel = '', cls = 'rz-button', disabled = false, id = '' } = {}) => ({
    id,
    innerText: label,
    className: cls,
    disabled,
    getAttribute: (k) => (k === 'aria-label' ? ariaLabel : ''),
    click: () => clicks.push(id || label),
  });

  const makeMockRow = ({
    cells,
    editableName = '',
    hasAddSubBtn = false,
    rowIdx = 0,
  }) => {
    const tdNodes = cells.map((text) => ({ innerText: text }));
    const editableSpan = editableName
      ? {
          id: 'equipmentname',
          innerText: editableName,
          click: () => clicks.push(`edit:${rowIdx}:${editableName}`),
        }
      : null;
    const addSubBtn = hasAddSubBtn
      ? makeMockBtn('add Thêm thiết bị phụ', { id: `addSub:${rowIdx}` })
      : null;
    return {
      querySelectorAll: (sel) => {
        if (sel === 'td') return tdNodes;
        if (sel === 'button') return addSubBtn ? [addSubBtn] : [];
        return [];
      },
      querySelector: (sel) => {
        if (sel.includes('equipmentname')) return editableSpan;
        return null;
      },
    };
  };

  const ticket0Inner = {
    id: '900001',
    className: 'Card-Ticket Card-Ticket-Selected',
    click: () => clicks.push('ticket:0'),
  };
  const ticket1Inner = {
    id: '900002',
    className: 'Card-Ticket',
    click: () => clicks.push('ticket:1'),
  };
  const ticketCards = [
    {
      innerText:
        '1 TIN/PNC Ngày tạo phiếu: 09/11/2026 09:00:00 Người tạo phiếu: ktv.mau01 Ngày cập nhật:23/11/2026 10:30:00 Người cập nhật:ktv.mau02 Thông số thi công:HCM-ODC-01/HO/01-01-G',
      className: 'ticketinf Card-Ticket-Selected',
      querySelector: (sel) => {
        if (sel === '.Card-Ticket') return ticket0Inner;
        if (sel.includes('.rounded-full')) return { innerText: '1' };
        if (sel === '.text-base') return { innerText: 'TIN/PNC' };
        return null;
      },
    },
    {
      innerText:
        '2 TIN/PNC Ngày tạo phiếu: 23/11/2026 11:00:00 Người tạo phiếu: ktv.mau01 Ngày cập nhật:23/11/2026 11:05:00 Người cập nhật:ktv.mau01 Thông số thi công:HCM-ODC-01/HO/01-01-G',
      className: 'ticketinf',
      querySelector: (sel) => {
        if (sel === '.Card-Ticket') return ticket1Inner;
        if (sel.includes('.rounded-full')) return { innerText: '2' };
        if (sel === '.text-base') return { innerText: 'TIN/PNC' };
        return null;
      },
    },
  ];

  const mockRows = [
    makeMockRow({
      rowIdx: 0,
      editableName: '',
      hasAddSubBtn: true,
      cells: [
        'Access Point AX3000 (Mẫu)',
        'add Thêm thiết bị phụ',
        'Modem',
        '001122334455',
        '1',
        'Đã nhập kho',
        'Không đầy đủ',
        'ktv.mau02',
        '23/11/2026 10:30:00',
        'Thanh lý hợp đồng tại nhà',
        'Hàng tái sử dụng',
        'Hàng tái sử dụng Xem flow Tái-xuất',
        'Có',
        'SR',
      ],
    }),
    makeMockRow({
      rowIdx: 1,
      editableName: 'FPT Play Box 650 (Mẫu)',
      hasAddSubBtn: true,
      cells: [
        'FPT Play Box 650 (Mẫu)',
        'add Thêm thiết bị phụ',
        'Box OTT',
        '',
        '1',
        'Thu hồi không thành công',
        '',
        '',
        '',
        'Thanh lý hợp đồng tại nhà',
        'Hàng nhập lại',
        'Hàng tái sử dụng',
        'Có',
        'SR',
      ],
    }),
    makeMockRow({
      rowIdx: 2,
      editableName: 'HDMI',
      hasAddSubBtn: false,
      cells: [
        '',
        'HDMI',
        'Vật tư thu hồi khác',
        '',
        '1',
        'Thu hồi không thành công',
        '',
        '',
        '',
        'Thanh lý hợp đồng tại nhà',
        'Hàng nhập lại',
        'Hàng tái sử dụng',
        'Có',
        'SR',
      ],
    }),
    makeMockRow({
      rowIdx: 3,
      editableName: 'Nguồn Box 650',
      hasAddSubBtn: false,
      cells: [
        '',
        'Nguồn Box 650',
        'Vật tư thu hồi khác',
        '',
        '1',
        'Thu hồi không thành công',
        '',
        '',
        '',
        'Thanh lý hợp đồng tại nhà',
        'Hàng nhập lại',
        'Hàng tái sử dụng',
        'Có',
        'SR',
      ],
    }),
  ];

  const createTicketPlusBtn = makeMockBtn('add_circle_outline', {
    ariaLabel: 'Button',
    id: 'createPlus',
  });
  const createTicketMenuBtn = makeMockBtn('arrow_drop_down', {
    ariaLabel: 'Open',
    id: 'createMenu',
  });
  const addEquipBtn = makeMockBtn('Thêm thiết bị', {
    cls: 'mud-button-root',
    id: 'addEquip',
  });
  const sendNoteBtn = makeMockBtn('send', { id: 'sendNote' });
  const searchBtn = makeMockBtn('search', { cls: 'rz-button', id: 'searchSubmit' });

  const dispatchedEvents = [];
  const noteInput = {
    value: '',
    dispatchEvent: (e) => dispatchedEvents.push(`note:${e.type}`),
  };
  const searchInput = {
    value: '',
    parentElement: {
      querySelectorAll: (sel) => (sel === 'button' ? [searchBtn] : []),
    },
    dispatchEvent: (e) => dispatchedEvents.push(`search:${e.type}`),
  };

  const mockRecallDoc = {
    title: 'SGN123456',
    body: { innerText: 'DANH SÁCH PHIẾU THU HỒI - SGN123456' },
    querySelector: (sel) => {
      if (sel === '.rz-data-grid') {
        return {
          querySelectorAll: (sub) => (sub === 'tbody tr' ? mockRows : []),
        };
      }
      if (sel === '.rz-splitbutton') {
        return {
          querySelector: (sub) => (sub.includes('Button') ? createTicketPlusBtn : null),
          querySelectorAll: (sub) =>
            sub === 'button' ? [createTicketPlusBtn, createTicketMenuBtn] : [],
        };
      }
      if (sel.includes('Nhập số hợp đồng')) return searchInput;
      if (sel === '.rz-dialog.rz-open') return null;
      return null;
    },
    querySelectorAll: (sel) => {
      if (sel.includes('h1')) return [{ innerText: 'Phiếu số 1' }];
      if (sel === '.ticketinf') return ticketCards;
      if (sel === '.rz-form-field') {
        return [
          {
            querySelector: (sub) => {
              if (sub.includes('label')) return { innerText: 'Thêm ghi chú mới..' };
              if (sub.includes('input')) return noteInput;
              return null;
            },
          },
        ];
      }
      if (sel === 'button') {
        return [createTicketPlusBtn, createTicketMenuBtn, addEquipBtn, sendNoteBtn, searchBtn];
      }
      return [];
    },
  };

  const parsedSnap = parseRecallTicketFromDocument(mockRecallDoc, {
    hostname: 'nextgen.fpt.net',
    pathname: '/resource/recall/recall-ticket',
  });
  assert.equal(parsedSnap.onRecallTicketPage, true);
  assert.equal(parsedSnap.contract, 'SGN123456');
  assert.equal(parsedSnap.activeTicketTitle, 'Phiếu số 1');
  assert.equal(parsedSnap.tickets.length, 2);
  assert.equal(parsedSnap.activeTicket.ticketNumber, '1');
  assert.equal(parsedSnap.activeTicket.constructionSpec, 'HCM-ODC-01/HO/01-01-G');
  assert.equal(parsedSnap.items.length, 4);
  assert.equal(parsedSnap.items[0].canEdit, false);
  assert.equal(parsedSnap.items[0].canAddAccessory, true);
  assert.equal(parsedSnap.items[0].ruleCondition, 'Hàng tái sử dụng');
  assert.equal(parsedSnap.items[1].canEdit, true);
  assert.equal(parsedSnap.items[1].isAccessory, false);
  assert.equal(parsedSnap.items[2].isAccessory, true);
  assert.equal(parsedSnap.items[2].canEdit, true);
  assert.equal(parsedSnap.items[2].canAddAccessory, false);
  assert.deepEqual(parsedSnap.stats, {
    totalItems: 4,
    importedCount: 1,
    editableCount: 3,
    pendingCount: 3,
  });

  // Trigger DOM bridge actions and verify exact elements clicked
  assert.equal(triggerRecallEditEquipment(mockRecallDoc, 0).ok, false, 'Must reject non-editable imported row');
  const editRes = triggerRecallEditEquipment(mockRecallDoc, 1);
  assert.equal(editRes.ok, true);
  assert.equal(editRes.itemName, 'FPT Play Box 650 (Mẫu)');
  assert.equal(triggerRecallEditEquipment(mockRecallDoc, 2).ok, true);
  assert.equal(triggerRecallAddEquipment(mockRecallDoc).ok, true);
  assert.equal(triggerRecallAddAccessory(mockRecallDoc, 0).ok, true);
  assert.equal(triggerRecallCreateTicket(mockRecallDoc).ok, true);
  assert.equal(triggerRecallSelectTicket(mockRecallDoc, 1).ok, true);
  assert.equal(triggerRecallSubmitNote(mockRecallDoc, '').ok, false);
  assert.equal(triggerRecallSubmitNote(mockRecallDoc, '  Khach hen chieu  ').ok, true);
  assert.equal(noteInput.value, 'Khach hen chieu');
  assert.equal(triggerRecallSearchOnPage(mockRecallDoc, ' sgn123456 ').ok, true);
  assert.equal(searchInput.value, 'SGN123456');

  assert.deepEqual(clicks, [
    'edit:1:FPT Play Box 650 (Mẫu)',
    'edit:2:HDMI',
    'addEquip',
    'addSub:0',
    'createPlus',
    'ticket:1',
    'sendNote',
    'searchSubmit',
  ]);
  assert.ok(dispatchedEvents.includes('note:input') && dispatchedEvents.includes('note:change'));
  assert.ok(dispatchedEvents.includes('search:input') && dispatchedEvents.includes('search:change'));

  // Demo mode checks
  const demoRecallSnap = buildDemoRecallSnapshot('sgn123456');
  assert.equal(demoRecallSnap.contract, 'SGN123456');
  assert.equal(demoRecallSnap.items.length, 4);
  const demoCtx = await loadRecallTicketContext('SGN123456', { forceDemo: true });
  assert.equal(demoCtx.status, 'ok');
  assert.equal(demoCtx.mode, 'demo');
  const demoSummaryRes = await executePortalAction('recall', 'lookup_recall', 'SGN123456', {
    forceDemo: true,
  });
  assert.equal(demoSummaryRes.status, 'ok');
  assert.equal(demoSummaryRes.mode, 'demo');
  const badRecallRes = await runRecallAction('lookup_recall', 'ab', { forceDemo: true });
  assert.equal(badRecallRes.status, 'validation_error');

  // Verify recall adapter & UI tokens in built bundles + 0 forbiddenDemoDataRe matches
  for (const token of [
    'RECALL_PENDING_CONTRACT',
    'manage_recall',
    'triggerRecallEditEquipment',
    'triggerRecallCreateTicket',
    'triggerRecallAddEquipment',
    'triggerRecallSubmitNote',
    'equipmentname',
    RECALL_ENDPOINTS.base,
  ]) {
    assert.ok(userscriptContent.includes(token), `Userscript must include ${token}`);
    assert.ok(androidAssetContent.includes(token), `Android bundle must include ${token}`);
  }
  assert.equal(
    forbiddenDemoDataRe.test(userscriptContent) || forbiddenDemoDataRe.test(androidAssetContent),
    false,
    'Built recall bundles must pass forbiddenDemoDataRe with 0 matches'
  );
  console.log('   OK: Vật tư thu hồi (NextGen Blazor DOM bridge) tests passed.');

  console.log('\nALL VERIFICATION CHECKS PASSED!');
}

await runTests();
