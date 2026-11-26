import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const DOCS_DIR = path.join(ROOT_DIR, 'docs');
const ANDROID_ASSETS_DIR = path.join(
  ROOT_DIR,
  'android',
  'app',
  'src',
  'main',
  'assets'
);
const IOS_RESOURCES_DIR = path.join(
  ROOT_DIR,
  'ios',
  'RemoteInside',
  'Resources'
);
const IOS_ICON_PATH = path.join(
  ROOT_DIR,
  'ios',
  'RemoteInside',
  'Assets.xcassets',
  'AppIcon.appiconset',
  'AppIcon-1024.png'
);
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
const APP_VERSION = String(PKG.version || '0.10.0').trim();

const MODULE_ORDER = [
  'config/portals.js',
  'core/storage.js',
  'core/transport.js',
  'core/inspector.js',
  'adapters/inside.js',
  'adapters/deployment.js',
  'adapters/maintenance.js',
  'adapters/port.js',
  'adapters/recall.js',
  'adapters/equipment.js',
  'adapters/radius.js',
  'adapters/portals.js',
  'ui/app.js',
  'main.js',
];

const RELEASE_BASE_URL = (
  process.env.REMOTE_INSIDE_RELEASE_BASE_URL ||
  'https://raw.githubusercontent.com/lenamtest4-dot/remote-inside/main/dist'
).replace(/\/+$/, '');

const USERSCRIPT_HEADER = `// ==UserScript==
// @name         Remote Inside — Bảng điều khiển hiện trường FPT
// @namespace    remote-inside.local
// @version      ${APP_VERSION}
// @description  Giao diện 1 màn hình tối ưu di động cho 5 công cụ nội bộ FPT (Inside, Port, Camera, Vật tư, Radius)
// @homepageURL  https://github.com/lenamtest4-dot/remote-inside
// @updateURL    ${RELEASE_BASE_URL}/remote-inside.meta.js
// @downloadURL  ${RELEASE_BASE_URL}/remote-inside.user.js
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
// @match        http://nextgen.fpt.net/*
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
// @grant        GM.xmlHttpRequest
// @grant        GM_getValue
// @grant        GM.getValue
// @grant        GM_setValue
// @grant        GM.setValue
// @grant        GM_setClipboard
// @grant        GM.setClipboard
// @grant        GM_registerMenuCommand
// @grant        GM.registerMenuCommand
// @grant        unsafeWindow
// @run-at       document-idle
// ==/UserScript==
`;

function stripModuleSyntax(source) {
  let out = source.replace(/^\s*import\s+[\s\S]*?\bfrom\s+['"][^'"]+['"];?\s*$/gm, '');
  out = out.replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, '');
  out = out.replace(
    /^\s*export\s+(?=(?:async\s+)?function\b|const\b|let\b|var\b|class\b)/gm,
    ''
  );
  out = out.replace(/^\s*export\s*\{[^}]*\};?\s*$/gm, '');
  return out.trim();
}

function buildIifeBundle(cssText) {
  const parts = MODULE_ORDER.map((relPath) => {
    const absPath = path.join(SRC_DIR, relPath);
    const raw = fs.readFileSync(absPath, 'utf8');
    const clean = stripModuleSyntax(raw);
    return `// --- ${relPath} ---\n${clean}`;
  });

  return `(function () {\n  'use strict';\n  const __REMOTE_INSIDE_VERSION__ = ${JSON.stringify(
    APP_VERSION
  )};\n  const __REMOTE_INSIDE_CSS__ = ${JSON.stringify(
    cssText
  )};\n\n${parts.join('\n\n')}\n})();\n`;
}

function buildStandaloneHtml(bundleJs, { title, themeColor = '' } = {}) {
  const safeJs = bundleJs.replace(/<\/script/gi, '<\\/script');
  const themeMeta = themeColor
    ? `\n  <meta name="theme-color" content="${themeColor}" />`
    : '';
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />${themeMeta}
  <title>${title}</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      background: #F2F4F7;
      min-height: 100dvh;
    }
  </style>
</head>
<body>
  <div id="remote-inside-standalone"></div>
  <script>
${safeJs}
  </script>
</body>
</html>
`;
}

function buildPreviewHtml(bundleJs) {
  return buildStandaloneHtml(bundleJs, {
    title: 'Remote Inside — Xem thử giao diện hiện trường',
  });
}

function buildAndroidHtml(bundleJs) {
  return buildStandaloneHtml(bundleJs, {
    title: 'Remote Inside',
    themeColor: '#FFFFFF',
  });
}

function escapeXmlText(raw) {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildIosWebClipMobileConfig(iconBase64) {
  const cleanIcon = String(iconBase64 || '').replace(/\s+/g, '');
  const formattedIcon = cleanIcon.replace(/(.{76})/g, '$1\n\t\t\t\t');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>PayloadContent</key>
\t<array>
\t\t<dict>
\t\t\t<key>FullScreen</key>
\t\t\t<false/>
\t\t\t<key>Icon</key>
\t\t\t<data>
\t\t\t\t${formattedIcon}
\t\t\t</data>
\t\t\t<key>IgnoreManifestScope</key>
\t\t\t<true/>
\t\t\t<key>IsRemovable</key>
\t\t\t<true/>
\t\t\t<key>Label</key>
\t\t\t<string>Remote Inside</string>
\t\t\t<key>PayloadDescription</key>
\t\t\t<string>Tạo biểu tượng Remote Inside màu cam ngoài màn hình chính iPhone</string>
\t\t\t<key>PayloadDisplayName</key>
\t\t\t<string>Remote Inside</string>
\t\t\t<key>PayloadIdentifier</key>
\t\t\t<string>com.remoteinside.ios.webclip.inside</string>
\t\t\t<key>PayloadOrganization</key>
\t\t\t<string>Remote Inside</string>
\t\t\t<key>PayloadType</key>
\t\t\t<string>com.apple.webClip.managed</string>
\t\t\t<key>PayloadUUID</key>
\t\t\t<string>B2E5F3C1-8D42-4F69-AC53-209F4B7DA123</string>
\t\t\t<key>PayloadVersion</key>
\t\t\t<integer>1</integer>
\t\t\t<key>Precomposed</key>
\t\t\t<true/>
\t\t\t<key>URL</key>
\t\t\t<string>http://inside.fpt.net/default.asp#remote-inside</string>
\t\t</dict>
\t</array>
\t<key>PayloadDescription</key>
\t<string>Tạo biểu tượng app Remote Inside trên màn hình chính iPhone (mở qua Safari để giữ đầy đủ Userscripts &amp; phiên IAM FPT). Chỉ gồm link và icon, không chứa MDM hay chứng chỉ quản trị.</string>
\t<key>PayloadDisplayName</key>
\t<string>Remote Inside — Icon Màn hình chính</string>
\t<key>PayloadIdentifier</key>
\t<string>com.remoteinside.ios.webclip.profile</string>
\t<key>PayloadOrganization</key>
\t<string>Remote Inside</string>
\t<key>PayloadRemovalDisallowed</key>
\t<false/>
\t<key>PayloadType</key>
\t<string>Configuration</string>
\t<key>PayloadUUID</key>
\t<string>A1D4E2B0-7C31-4E58-9B42-1F8E3A6C9012</string>
\t<key>PayloadVersion</key>
\t<integer>1</integer>
</dict>
</plist>
`;
}

function buildIosSetupPageHtml({ version, iconBase64, mobileConfigXml }) {
  const safeVersion = escapeXmlText(version);
  const userJsRawUrl = `${RELEASE_BASE_URL}/remote-inside.user.js`;
  const userJsReleaseUrl = `https://github.com/lenamtest4-dot/remote-inside/releases/download/v${encodeURIComponent(version)}/remote-inside.user.js`;
  const mobileConfigJson = JSON.stringify(mobileConfigXml).replace(/<\/script/gi, '<\\/script');
  const userJsUrlJson = JSON.stringify(userJsRawUrl).replace(/<\/script/gi, '<\\/script');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#E85D04" />
  <title>Cài nhanh Remote Inside cho iPhone (v${safeVersion})</title>
  <style>
    :root {
      --bg: #F2F4F7;
      --card: #FFFFFF;
      --subtle: #E9EEF4;
      --ink: #141B24;
      --muted: #526072;
      --accent: #E85D04;
      --accent-hover: #C94E02;
      --accent-soft: #FFF3EB;
      --ok: #0F8A5F;
      --ok-soft: #E9F7F1;
      --warn: #92400E;
      --warn-soft: #FEF3C7;
      --border: #D5DCE4;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px 14px max(32px, env(safe-area-inset-bottom));
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--ink);
      line-height: 1.48;
      -webkit-text-size-adjust: 100%;
    }
    .wrap {
      max-width: 520px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .hero {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .hero-icon {
      width: 60px;
      height: 60px;
      border-radius: 14px;
      flex-shrink: 0;
      box-shadow: 0 4px 12px rgba(232, 93, 4, 0.25);
    }
    .hero h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 800;
      line-height: 1.25;
    }
    .hero-sub {
      margin: 4px 0 0;
      font-size: 13px;
      color: var(--ok);
      font-weight: 600;
    }
    .banner-warn {
      display: none;
      background: var(--warn-soft);
      border: 1px solid #F59E0B;
      color: var(--warn);
      border-radius: 14px;
      padding: 14px;
      font-size: 13.5px;
    }
    .banner-warn.is-visible { display: block; }
    .banner-warn strong { display: block; margin-bottom: 4px; font-size: 14px; }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 14px;
    }
    .card.is-done {
      border-color: #9ED9C3;
      background: #FAFFFD;
    }
    .step-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }
    .step-num {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-weight: 800;
      font-size: 15px;
    }
    .badge-num {
      width: 26px;
      height: 26px;
      border-radius: 999px;
      background: var(--accent);
      color: #FFF;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 800;
      flex-shrink: 0;
    }
    .card.is-done .badge-num {
      background: var(--ok);
    }
    .step-status {
      font-size: 12px;
      font-weight: 700;
      color: var(--muted);
      padding: 3px 8px;
      border-radius: 999px;
      background: var(--subtle);
    }
    .card.is-done .step-status {
      background: var(--ok-soft);
      color: var(--ok);
    }
    .step-desc {
      margin: 0 0 10px;
      font-size: 13.5px;
      color: var(--muted);
    }
    .step-desc b, .step-desc strong { color: var(--ink); }
    .btn-col {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .btn-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .btn-primary, .btn-secondary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      min-height: 48px;
      padding: 10px 14px;
      border-radius: 11px;
      font-size: 14.5px;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
      border: none;
      width: 100%;
    }
    .btn-primary {
      background: var(--accent);
      color: #FFF;
    }
    .btn-primary:active { background: var(--accent-hover); }
    .btn-secondary {
      background: var(--subtle);
      color: var(--ink);
      border: 1px solid var(--border);
      min-height: 42px;
      font-size: 13px;
      flex: 1;
      min-width: 140px;
    }
    .btn-ok {
      background: var(--ok);
      color: #FFF;
    }
    .mini-note {
      margin: 8px 0 0;
      font-size: 12px;
      color: var(--muted);
    }
    .checklist {
      margin: 6px 0 10px;
      padding-left: 18px;
      font-size: 13.5px;
      color: var(--ink);
    }
    .checklist li { margin-bottom: 6px; }
    .toast {
      position: fixed;
      left: 50%;
      bottom: max(20px, env(safe-area-inset-bottom));
      transform: translateX(-50%);
      background: #141B24;
      color: #FFF;
      padding: 10px 16px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
      z-index: 99;
      max-width: 90vw;
      text-align: center;
    }
    .toast.is-shown { opacity: 1; }
  </style>
</head>
<body>
  <main class="wrap">
    <header class="hero">
      <img class="hero-icon" alt="Remote Inside" src="data:image/png;base64,${iconBase64}" />
      <div>
        <h1>Cài nhanh Remote Inside cho iPhone (v${safeVersion})</h1>
        <p class="hero-sub">Miễn phí 100% • Dùng vĩnh viễn • Không cần máy tính • Không hết hạn 7 ngày</p>
      </div>
    </header>

    <section id="ri-inapp-warn" class="banner-warn" role="alert">
      <strong>Bạn đang mở link bên trong ứng dụng khác (Zalo / Facebook / Chrome...)</strong>
      Để tự cài tiện ích và tạo Icon màn hình chính, hãy bấm nút <b>Chia sẻ / ⋯</b> và chọn <b>Mở bằng Safari</b>, hoặc sao chép link dưới đây dán vào Safari:
      <div class="btn-row" style="margin-top: 10px;">
        <button id="ri-copy-page-btn" type="button" class="btn-secondary">Sao chép link trang này</button>
      </div>
    </section>

    <section id="step-1" class="card">
      <div class="step-head">
        <div class="step-num"><span class="badge-num">1</span><span>Tải ứng dụng Userscripts (App Store)</span></div>
        <span class="step-status" data-status-for="1">Chưa làm</span>
      </div>
      <p class="step-desc">Ứng dụng mã nguồn mở miễn phí của Apple App Store giúp Safari iPhone chạy được Remote Inside như app gốc.</p>
      <div class="btn-col">
        <a id="ri-btn-appstore" class="btn-primary" href="https://apps.apple.com/app/userscripts/id1463298887" target="_blank" rel="noopener">1. Tải app Userscripts miễn phí (App Store)</a>
        <div class="btn-row">
          <a class="btn-secondary" href="https://apps.apple.com/app/stay-for-safari/id1591620171" target="_blank" rel="noopener">Hoặc dùng Stay for Safari</a>
          <button type="button" class="btn-secondary" data-mark-step="1">Đánh dấu đã cài ✓</button>
        </div>
      </div>
    </section>

    <section id="step-2" class="card">
      <div class="step-head">
        <div class="step-num"><span class="badge-num">2</span><span>Bật 1 lần trong Cài đặt iPhone</span></div>
        <span class="step-status" data-status-for="2">Chưa làm</span>
      </div>
      <ul class="checklist">
        <li><b>iOS 18+ (iPhone 15 / 16...):</b> Mở <b>Cài đặt → Ứng dụng → Safari → Phần mở rộng</b>.<br/><b>iOS 17:</b> Mở <b>Cài đặt → Safari → Phần mở rộng</b>.</li>
        <li>Gạt <b>BẬT Userscripts</b> → chọn <b>Tất cả các trang web → Luôn cho phép</b>.</li>
        <li>Quay ra mục <b>Safari → Quyền riêng tư &amp; Bảo mật</b> → gạt <b>TẮT Ngăn chặn theo dõi chéo trang</b> (để SSO FPT không bị chặn), rồi mở app <b>Userscripts</b> lên 1 lần.</li>
      </ul>
      <div class="btn-col">
        <button id="ri-btn-step2" type="button" class="btn-primary" data-mark-step="2">2. Đã bật xong trong Cài đặt ✓</button>
      </div>
    </section>

    <section id="step-3" class="card">
      <div class="step-head">
        <div class="step-num"><span class="badge-num">3</span><span>Cài tự động Remote Inside (v${safeVersion})</span></div>
        <span class="step-status" data-status-for="3">Chưa làm</span>
      </div>
      <p class="step-desc">Bấm nút dưới đây để mở file script gốc trên Safari. Khi màn hình chữ/code hiện ra, bấm biểu tượng <b>🧩 / AA</b> ở góc trái thanh địa chỉ → chọn <b>Userscripts</b> → bấm <b>Install / Lưu</b> là xong.</p>
      <div class="btn-col">
        <a id="ri-btn-install-script" class="btn-primary" href="${escapeXmlText(userJsRawUrl)}">3. Cài tự động Remote Inside (v${safeVersion})</a>
        <div class="btn-row">
          <a class="btn-secondary" href="${escapeXmlText(userJsReleaseUrl)}">Tải file .user.js về Tệp</a>
          <button id="ri-btn-copy-script" type="button" class="btn-secondary">Sao chép link cài (dán vào Stay)</button>
        </div>
      </div>
      <p class="mini-note">Khi đã cài 1 lần, mọi bản cập nhật mới sau này sẽ tự động nhắc cập nhật qua <code>remote-inside.meta.js</code>.</p>
    </section>

    <section id="step-4" class="card">
      <div class="step-head">
        <div class="step-num"><span class="badge-num">4</span><span>Tạo Icon App ngoài màn hình chính</span></div>
        <span class="step-status" data-status-for="4">Tùy chọn</span>
      </div>
      <p class="step-desc">Tạo icon <b>Remote Inside</b> màu cam y hệt file APK ngoài màn hình chính (nhấn 1 chạm là mở thẳng Safari với đủ Extension &amp; IAM FPT).</p>
      <div class="btn-col">
        <button id="ri-btn-install-profile" type="button" class="btn-primary">4. Tạo Icon App Remote Inside ngoài màn hình chính</button>
        <div class="btn-row">
          <a class="btn-secondary" href="./remote-inside-ios-icon.mobileconfig" download="remote-inside-ios-icon.mobileconfig">Tải file .mobileconfig vào Tệp</a>
          <button type="button" class="btn-secondary" data-mark-step="4">Đánh dấu hoàn tất ✓</button>
        </div>
      </div>
      <p class="mini-note">Bấm nút cam xong chọn <b>Cho phép</b> → mở <b>Cài đặt iPhone → Đã tải về hồ sơ → Cài đặt</b>. <i>(Hoặc mở inside.fpt.net rồi bấm Chia sẻ → Thêm vào MH chính).</i></p>
    </section>

    <section class="card">
      <div class="btn-col">
        <a class="btn-primary btn-ok" href="http://inside.fpt.net/default.asp#remote-inside">Mở Remote Inside ngay (nhớ bật VPN công ty)</a>
      </div>
      <p class="mini-note">An toàn thông tin: Hồ sơ tạo icon chỉ chứa đường dẫn <code>inside.fpt.net</code> và hình biểu tượng — tuyệt đối không chứa MDM, không cài chứng chỉ quản trị và xóa được bất kỳ lúc nào.</p>
    </section>
  </main>

  <div id="ri-toast" class="toast" role="status" aria-live="polite"></div>

  <script>
    (function () {
      var MOBILECONFIG_XML = ${mobileConfigJson};
      var USER_JS_URL = ${userJsUrlJson};
      var STORE_KEY = 'ri_ios_setup_steps_v1';

      function showToast(msg) {
        var el = document.getElementById('ri-toast');
        if (!el) return;
        el.textContent = msg;
        el.classList.add('is-shown');
        clearTimeout(el._timer);
        el._timer = setTimeout(function () {
          el.classList.remove('is-shown');
        }, 2600);
      }

      function loadDoneMap() {
        try {
          return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {};
        } catch (e) {
          return {};
        }
      }

      function saveDoneStep(stepNum) {
        var map = loadDoneMap();
        map[String(stepNum)] = true;
        try {
          localStorage.setItem(STORE_KEY, JSON.stringify(map));
        } catch (e) {}
        renderSteps();
      }

      function renderSteps() {
        var map = loadDoneMap();
        ['1', '2', '3', '4'].forEach(function (n) {
          var card = document.getElementById('step-' + n);
          var badge = document.querySelector('[data-status-for="' + n + '"]');
          var done = Boolean(map[n]);
          if (card) card.classList.toggle('is-done', done);
          if (badge) badge.textContent = done ? 'Đã xong ✓' : (n === '4' ? 'Tùy chọn' : 'Chưa làm');
        });
      }

      function copyText(text, okMsg) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(
            function () { showToast(okMsg); },
            function () { showToast('Hãy giữ tay vào link để sao chép.'); }
          );
          return;
        }
        try {
          var ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          showToast(okMsg);
        } catch (e) {
          showToast('Hãy giữ tay vào link để sao chép.');
        }
      }

      var ua = String((navigator && navigator.userAgent) || '');
      var isIos = /iPhone|iPad|iPod/i.test(ua);
      var isNotSafari = /CriOS|FxiOS|EdgiOS|Zalo|FBAN|FBAV|Messenger|Line\\//i.test(ua) || (isIos && !/Safari/i.test(ua));
      if (isNotSafari) {
        var warnEl = document.getElementById('ri-inapp-warn');
        if (warnEl) warnEl.classList.add('is-visible');
      }

      var copyPageBtn = document.getElementById('ri-copy-page-btn');
      if (copyPageBtn) {
        copyPageBtn.addEventListener('click', function () {
          copyText(window.location.href, 'Đã sao chép link trang cài đặt!');
        });
      }

      var copyScriptBtn = document.getElementById('ri-btn-copy-script');
      if (copyScriptBtn) {
        copyScriptBtn.addEventListener('click', function () {
          copyText(USER_JS_URL, 'Đã sao chép link .user.js (hãy dán vào app Stay)!');
        });
      }

      var appStoreBtn = document.getElementById('ri-btn-appstore');
      if (appStoreBtn) {
        appStoreBtn.addEventListener('click', function () { saveDoneStep('1'); });
      }
      var scriptBtn = document.getElementById('ri-btn-install-script');
      if (scriptBtn) {
        scriptBtn.addEventListener('click', function () { saveDoneStep('3'); });
      }

      document.querySelectorAll('[data-mark-step]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          saveDoneStep(btn.getAttribute('data-mark-step'));
          showToast('Đã lưu tiến độ Bước ' + btn.getAttribute('data-mark-step') + '!');
        });
      });

      var profileBtn = document.getElementById('ri-btn-install-profile');
      if (profileBtn) {
        profileBtn.addEventListener('click', function () {
          saveDoneStep('4');
          try {
            var blob = new Blob([MOBILECONFIG_XML], {
              type: 'application/x-apple-aspen-config'
            });
            var blobUrl = URL.createObjectURL(blob);
            window.location.href = blobUrl;
            showToast('Hãy bấm Cho phép → vào Cài đặt → Đã tải về hồ sơ → Cài đặt!');
          } catch (err) {
            window.location.href = './remote-inside-ios-icon.mobileconfig';
          }
        });
      }

      renderSteps();
    })();
  </script>
</body>
</html>
`;
}

function buildDocsIndexHtml({ version, iconBase64 }) {
  const safeVersion = escapeXmlText(version);
  const apkUrl = `https://github.com/lenamtest4-dot/remote-inside/releases/download/v${encodeURIComponent(version)}/remote-inside-v${encodeURIComponent(version)}.apk`;
  const userJsUrl = `${RELEASE_BASE_URL}/remote-inside.user.js`;
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#E85D04" />
  <title>Remote Inside (v${safeVersion}) — Cài đặt nhanh</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 20px 14px 36px;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
      background: #F2F4F7;
      color: #141B24;
    }
    .wrap {
      max-width: 480px;
      margin: 0 auto;
      background: #FFF;
      border: 1px solid #D5DCE4;
      border-radius: 16px;
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .head { display: flex; align-items: center; gap: 12px; }
    .head img { width: 52px; height: 52px; border-radius: 12px; }
    h1 { margin: 0; font-size: 18px; }
    p { margin: 0; font-size: 13.5px; color: #526072; }
    a.btn {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 48px;
      padding: 10px 14px;
      border-radius: 11px;
      font-weight: 700;
      font-size: 14.5px;
      text-decoration: none;
      text-align: center;
    }
    a.primary { background: #E85D04; color: #FFF; }
    a.secondary { background: #E9EEF4; color: #141B24; border: 1px solid #D5DCE4; }
  </style>
</head>
<body>
  <main class="wrap">
    <div class="head">
      <img alt="Remote Inside" src="data:image/png;base64,${iconBase64}" />
      <div>
        <h1>Remote Inside v${safeVersion}</h1>
        <p>Chọn thiết bị của bạn để cài đặt nhanh</p>
      </div>
    </div>
    <a class="btn primary" href="./ios.html">iPhone / iPad (iOS 15–18+) — Hướng dẫn 1 chạm Safari</a>
    <a class="btn secondary" href="${escapeXmlText(apkUrl)}">Android — Tải trực tiếp file .apk (v${safeVersion})</a>
    <a class="btn secondary" href="${escapeXmlText(userJsUrl)}">MacBook / PC — Cài Userscript (Tampermonkey)</a>
  </main>
</body>
</html>
`;
}

function main() {
  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.mkdirSync(DOCS_DIR, { recursive: true });
  fs.mkdirSync(ANDROID_ASSETS_DIR, { recursive: true });
  fs.mkdirSync(IOS_RESOURCES_DIR, { recursive: true });
  const cssText = fs.readFileSync(path.join(SRC_DIR, 'styles/theme.css'), 'utf8');
  const iife = buildIifeBundle(cssText);

  const userscriptOut = `${USERSCRIPT_HEADER}\n${iife}`;
  const userscriptPath = path.join(DIST_DIR, 'remote-inside.user.js');
  fs.writeFileSync(userscriptPath, userscriptOut, 'utf8');

  const metaPath = path.join(DIST_DIR, 'remote-inside.meta.js');
  fs.writeFileSync(metaPath, USERSCRIPT_HEADER, 'utf8');

  const previewHtmlOut = buildPreviewHtml(iife);
  const previewPath = path.join(DIST_DIR, 'preview.html');
  fs.writeFileSync(previewPath, previewHtmlOut, 'utf8');

  const androidHtmlOut = buildAndroidHtml(iife);
  const androidDistPath = path.join(DIST_DIR, 'android-app.html');
  const androidAssetPath = path.join(ANDROID_ASSETS_DIR, 'remote-inside.html');
  const iosAssetPath = path.join(IOS_RESOURCES_DIR, 'remote-inside.html');
  fs.writeFileSync(androidDistPath, androidHtmlOut, 'utf8');
  fs.writeFileSync(androidAssetPath, androidHtmlOut, 'utf8');
  fs.writeFileSync(iosAssetPath, androidHtmlOut, 'utf8');

  const iconBase64 = fs.readFileSync(IOS_ICON_PATH).toString('base64');
  const mobileConfigXml = buildIosWebClipMobileConfig(iconBase64);
  const distMobileConfigPath = path.join(DIST_DIR, 'remote-inside-ios-icon.mobileconfig');
  const docsMobileConfigPath = path.join(DOCS_DIR, 'remote-inside-ios-icon.mobileconfig');
  fs.writeFileSync(distMobileConfigPath, mobileConfigXml, 'utf8');
  fs.writeFileSync(docsMobileConfigPath, mobileConfigXml, 'utf8');

  const iosSetupHtml = buildIosSetupPageHtml({
    version: APP_VERSION,
    iconBase64,
    mobileConfigXml,
  });
  const distIosSetupPath = path.join(DIST_DIR, 'remote-inside-ios-setup.html');
  const docsIosSetupPath = path.join(DOCS_DIR, 'ios.html');
  fs.writeFileSync(distIosSetupPath, iosSetupHtml, 'utf8');
  fs.writeFileSync(docsIosSetupPath, iosSetupHtml, 'utf8');

  const docsIndexHtml = buildDocsIndexHtml({ version: APP_VERSION, iconBase64 });
  fs.writeFileSync(path.join(DOCS_DIR, 'index.html'), docsIndexHtml, 'utf8');
  fs.writeFileSync(path.join(DOCS_DIR, '.nojekyll'), '', 'utf8');

  const userSize = Buffer.byteLength(userscriptOut, 'utf8');
  const metaSize = Buffer.byteLength(USERSCRIPT_HEADER, 'utf8');
  const htmlSize = Buffer.byteLength(previewHtmlOut, 'utf8');
  const androidSize = Buffer.byteLength(androidHtmlOut, 'utf8');
  console.log(`Built dist/remote-inside.user.js (${userSize} bytes)`);
  console.log(`Built dist/remote-inside.meta.js (${metaSize} bytes)`);
  console.log(`Built dist/preview.html (${htmlSize} bytes)`);
  console.log(`Built dist/android-app.html & synced Android + iOS assets (${androidSize} bytes)`);
  console.log('Built docs/ios.html, docs/index.html & .mobileconfig iOS setup assets');
}

main();
