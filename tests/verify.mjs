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
  extractApiHintsFromHtml,
  extractApiHintsFromJs,
  redactHeaders,
  redactPayload,
  redactResponseStructure,
  scanPageStructure,
} from '../src/core/inspector.js';
import {
  INSIDE_ENDPOINTS,
  extractHtmlTablePairs,
  parseInsideLookupPayload,
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
    userscriptContent.includes('@version      0.3.0'),
    'Userscript must bump @version to 0.3.0'
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
  assert.equal(INSIDE_ENDPOINTS.reset_mac, null);
  assert.equal(INSIDE_ENDPOINTS.kill_session, null);
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

  console.log('\nALL VERIFICATION CHECKS PASSED!');
}

runTests();
