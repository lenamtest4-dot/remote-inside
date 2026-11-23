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
  getRecentContracts,
  getState,
  setState,
} from '../src/core/storage.js';
import { detectIamRedirect } from '../src/core/transport.js';
import {
  buildScanReport,
  createNetworkRecorder,
  extractAjaxSignaturesFromHtml,
  extractApiHintsFromHtml,
  extractApiHintsFromJs,
  extractFormControlsMeta,
  extractInlineScriptsSanitized,
  extractMatchingFunctionsFromJs,
  extractOpsMenuFromLeftAsp,
  redactHeaders,
  redactPayload,
  redactResponseStructure,
  scanPageStructure,
} from '../src/core/inspector.js';
import {
  INSIDE_ENDPOINTS,
  extractHtmlTablePairs,
  parseInsideLookupPayload,
  parseInsideMutationResponse,
} from '../src/adapters/inside.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

function runTests() {
  console.log('1. Checking built artifacts in dist/...');
  const userscriptPath = path.join(DIST_DIR, 'remote-inside.user.js');
  const previewPath = path.join(DIST_DIR, 'preview.html');

  assert.ok(fs.existsSync(userscriptPath), 'dist/remote-inside.user.js must exist');
  assert.ok(fs.existsSync(previewPath), 'dist/preview.html must exist');

  const userscriptContent = fs.readFileSync(userscriptPath, 'utf8');
  const previewContent = fs.readFileSync(previewPath, 'utf8');

  // Verify required Userscript metadata headers
  const expectedDomains = [
    'inside.fpt.net',
    'mvc.inside.fpt.net',
    'port.fpt.net',
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
    userscriptContent.includes('@version      0.4.1'),
    'Userscript must bump @version to 0.4.1'
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
  assert.equal(INSIDE_ENDPOINTS.reset_mac_box, null);
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
  assert.ok(INSIDE_ENDPOINTS.kill_session && INSIDE_ENDPOINTS.kill_session.includes('/KillSession/KillSession/DeleteSession'));
  assert.equal(INSIDE_ENDPOINTS.reset_mac_box, null);
  assert.equal(INSIDE_ENDPOINTS.clear_osp, null);

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
    contractId: 'VTAAR2393',
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
      <input type="text" id="txtContract" name="txtContract" value="VTAAR2393" />
      <button id="btnReset" onclick="resetNow('VTAAR2393')">Reset MAC</button>
    </form>
    <script>
      const ds = { transport: { read: { url: "/iptvinfo/GetListBox?token=secret123&objid=99" } } };
      $.post("/DSLLLine/ResetMAC/Execute", { contract: "VTAAR2393" });
    </script>
  `;
  const htmlHints = extractApiHintsFromHtml(sampleHtml, 'http://mvc.inside.fpt.net/iptvinfo/infobox', 'VTAAR2393');
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
  assert.equal(JSON.stringify(htmlHints).includes('VTAAR2393'), false, 'Must redact contract ID & skip .value');

  const jsHints = extractApiHintsFromJs(
    'fetch("/api/v1/connection-parameters?ObjID=123&token=secret123"); axios.get("/api/v1/online-session");',
    'VTAAR2393'
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
    'VTAAR2393'
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
    contractId: 'VTAAR2393',
    objID: 1162622263,
    httpStatus: 200,
    responseText: JSON.stringify({ status: true, msg: 'Kill session thành công' }),
  });
  assert.equal(mutOkJson.status, 'ok');
  assert.equal(mutOkJson.title, 'Đã Kill Session cho VTAAR2393');
  assert.equal(mutOkJson.message, 'Kill session thành công');

  const mutFailJson = parseInsideMutationResponse({
    actionLabel: 'Reset MAC Modem',
    contractId: 'VTAAR2393',
    objID: 1162622263,
    httpStatus: 200,
    responseText: JSON.stringify({ status: false, msg: 'Không tìm thấy phiên hợp lệ' }),
  });
  assert.equal(mutFailJson.status, 'error');
  assert.equal(mutFailJson.message, 'Không tìm thấy phiên hợp lệ');

  const mutFailText = parseInsideMutationResponse({
    actionLabel: 'Reset MAC Modem',
    contractId: 'VTAAR2393',
    objID: 1162622263,
    httpStatus: 200,
    responseText: 'Lỗi hệ thống: Không có quyền thực hiện',
  });
  assert.equal(mutFailText.status, 'error');

  const mutOkPlain = parseInsideMutationResponse({
    actionLabel: 'Reset MAC Modem',
    contractId: 'VTAAR2393',
    objID: 1162622263,
    httpStatus: 200,
    responseText: '"Cập nhật MAC thành công"',
    extraFields: [{ label: 'Chế độ Reset MAC', value: 'Xóa trắng MAC (NewMAC trống)' }],
  });
  assert.equal(mutOkPlain.status, 'ok');
  assert.equal(mutOkPlain.message, 'Cập nhật MAC thành công');

  const mutHttpErr = parseInsideMutationResponse({
    actionLabel: 'Kill Session',
    contractId: 'VTAAR2393',
    objID: 1162622263,
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
      <option value="VTU-OLT-01" selected>VTU-OLT-01 (Vung Tau)</option>
      <option value="VTU-OLT-02">VTU-OLT-02</option>
    </select>
    <input type="checkbox" id="chkPort1" name="chkPort" class="pon-cb" value="0/1/1" onclick="togglePort(this)" />
    <script>
      function SaveSwapping() {
        const cfg = {
          contract: 'VTAAR2393',
          headers: { Authorization: 'Bearer top-secret-jwt' },
          password: 'pw123',
          contact: '0901234567',
          mail: 'tech@example.com',
          kendoTransport: { update: { url: '/Contract/IPTVReplaceMAC/SwappingMAC?token=secret123' } }
        };
        $.post('/Contract/IPTVReplaceMAC/SwappingMAC', cfg);
      }
      function ClearSerial() {
        var url = '/Functions/NetAdmin/PowerDSL/MonitorOLT/AjaxClearSerial.asp?contract=VTAAR2393';
        return url;
      }
    </script>
  `;

  const inlineScripts = extractInlineScriptsSanitized(sampleBoxOltHtml, 'VTAAR2393');
  assert.equal(inlineScripts.length, 1);
  const inlineCode = inlineScripts[0].code;
  assert.ok(inlineCode.includes('SaveSwapping'), 'Must preserve SaveSwapping function');
  assert.ok(inlineCode.includes('transport') || inlineCode.includes('SwappingMAC'), 'Must preserve Kendo transport update URL');
  assert.ok(inlineCode.includes('ClearSerial'), 'Must preserve ClearSerial function');
  assert.ok(inlineCode.includes('<CONTRACT_ID>'), 'Must replace contract ID with <CONTRACT_ID>');
  assert.equal(inlineCode.includes('VTAAR2393'), false, 'Must redact literal contract ID');
  assert.equal(inlineCode.includes('top-secret-jwt'), false, 'Must redact Bearer token');
  assert.equal(inlineCode.includes('secret123'), false, 'Must redact query token value');
  assert.equal(inlineCode.includes('pw123'), false, 'Must redact password literal');
  assert.equal(inlineCode.includes('0901234567'), false, 'Must redact mobile phone number');
  assert.equal(inlineCode.includes('tech@example.com'), false, 'Must redact email address');

  const controlsMeta = extractFormControlsMeta(sampleBoxOltHtml, 'VTAAR2393');
  assert.equal(controlsMeta.selects.length, 1);
  assert.equal(controlsMeta.selects[0].id, 'fOLT');
  assert.equal(controlsMeta.selects[0].onchange, 'loadPort()');
  assert.equal(controlsMeta.selects[0].optionCount, 3);
  assert.equal(controlsMeta.selects[0].selectedValue, 'VTU-OLT-01');
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
      $.post('/AjaxClear.asp?token=secret999', { olt: olt, portID: portID, contract: 'VTAAR2393' });
    }
    var loadPort = function(olt) {
      return '/ViewPortPON.Asp?fOLT=' + olt;
    };
    function unrelatedHelper() { return 42; }
  `;
  const matchedFns = extractMatchingFunctionsFromJs(externalJsSample, undefined, 'VTAAR2393');
  const fnNames = matchedFns.map((f) => f.name);
  assert.ok(fnNames.includes('ClearSerial'), 'Must extract ClearSerial function');
  assert.ok(fnNames.includes('loadPort'), 'Must extract var loadPort = function');
  assert.equal(fnNames.includes('formatDate'), false, 'Must ignore unrelated formatDate');
  assert.equal(fnNames.includes('unrelatedHelper'), false, 'Must ignore unrelatedHelper');
  const serializedFns = JSON.stringify(matchedFns);
  assert.equal(serializedFns.includes('secret999'), false, 'Must redact token in external JS');
  assert.equal(serializedFns.includes('VTAAR2393'), false, 'Must redact contract ID in external JS');

  const hintsWithIsc = extractApiHintsFromHtml(
    sampleBoxOltHtml,
    'http://inside.fpt.net/Functions/NetAdmin/PowerDSL/MonitorOLT/ViewPortPON.Asp',
    'VTAAR2393'
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

  console.log('\nALL VERIFICATION CHECKS PASSED!');
}

runTests();
