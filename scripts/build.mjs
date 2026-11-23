import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const ANDROID_ASSETS_DIR = path.join(
  ROOT_DIR,
  'android',
  'app',
  'src',
  'main',
  'assets'
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
  'adapters/port.js',
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

function main() {
  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.mkdirSync(ANDROID_ASSETS_DIR, { recursive: true });
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
  fs.writeFileSync(androidDistPath, androidHtmlOut, 'utf8');
  fs.writeFileSync(androidAssetPath, androidHtmlOut, 'utf8');

  const userSize = Buffer.byteLength(userscriptOut, 'utf8');
  const metaSize = Buffer.byteLength(USERSCRIPT_HEADER, 'utf8');
  const htmlSize = Buffer.byteLength(previewHtmlOut, 'utf8');
  const androidSize = Buffer.byteLength(androidHtmlOut, 'utf8');
  console.log(`Built dist/remote-inside.user.js (${userSize} bytes)`);
  console.log(`Built dist/remote-inside.meta.js (${metaSize} bytes)`);
  console.log(`Built dist/preview.html (${htmlSize} bytes)`);
  console.log(`Built dist/android-app.html & synced android asset (${androidSize} bytes)`);
}

main();
