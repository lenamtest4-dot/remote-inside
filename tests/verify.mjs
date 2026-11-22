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
  redactHeaders,
  redactPayload,
  redactResponseStructure,
} from '../src/core/inspector.js';

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
  console.log('   OK: Inspector redaction & report tests passed.');

  console.log('\nALL VERIFICATION CHECKS PASSED!');
}

runTests();
