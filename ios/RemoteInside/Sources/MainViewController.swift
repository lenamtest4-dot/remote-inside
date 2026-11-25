import UIKit
import WebKit

private final class ConsoleSchemeHandler: NSObject, WKURLSchemeHandler {
    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url,
              let fileUrl = Bundle.main.url(forResource: "remote-inside", withExtension: "html"),
              let data = try? Data(contentsOf: fileUrl)
        else {
            if let reqUrl = urlSchemeTask.request.url {
                let notFound = HTTPURLResponse(
                    url: reqUrl,
                    statusCode: 404,
                    httpVersion: "HTTP/1.1",
                    headerFields: ["Content-Type": "text/plain; charset=utf-8"]
                )
                if let notFound = notFound {
                    urlSchemeTask.didReceive(notFound)
                }
            }
            urlSchemeTask.didReceive(Data("Missing remote-inside.html".utf8))
            urlSchemeTask.didFinish()
            return
        }

        let headers = [
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store"
        ]
        if let response = HTTPURLResponse(
            url: url,
            statusCode: 200,
            httpVersion: "HTTP/1.1",
            headerFields: headers
        ) {
            urlSchemeTask.didReceive(response)
        }
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        // Synchronous local bundle read finishes immediately.
    }
}

private final class WeakScriptMessageHandler: NSObject, WKScriptMessageHandler {
    private weak var target: WKScriptMessageHandler?

    init(target: WKScriptMessageHandler) {
        self.target = target
        super.init()
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        target?.userContentController(userContentController, didReceive: message)
    }
}

final class MainViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    private static let consoleScheme = "riapp"
    private static let consoleUrlString = "riapp://console/remote-inside.html"
    private static let messageHandlerName = "remoteInside"
    private static let sslErrorCodes: Set<Int> = [
        NSURLErrorSecureConnectionFailed,
        NSURLErrorServerCertificateHasBadDate,
        NSURLErrorServerCertificateUntrusted,
        NSURLErrorServerCertificateHasUnknownRoot,
        NSURLErrorServerCertificateNotYetValid,
        NSURLErrorClientCertificateRejected,
        NSURLErrorClientCertificateRequired
    ]

    private struct SsoWarmupTask {
        let reqId: String
        let url: String
        let targetHost: String
        let timeoutMs: Int
    }

    private let dataStore = WKWebsiteDataStore.default()
    private let httpClient = PortalHttpClient()

    private var consoleWebView: WKWebView!
    private var ssoWebView: WKWebView!
    private var portalOverlay: UIView!
    private var portalWebView: WKWebView!
    private var portalProgress: UIProgressView!
    private var tvPortalTitle: UILabel!
    private var tvPortalUrl: UILabel!
    private var btnPortalBack: UIButton!
    private var btnPortalReload: UIButton!
    private var btnPortalDone: UIButton!
    private var toastLabel: UILabel!

    private var progressObservation: NSKeyValueObservation?
    private var toastHideWorkItem: DispatchWorkItem?

    private var webViewUserAgent: String = ""
    private var portalOverlayVisible: Bool = false

    private var ssoQueue: [SsoWarmupTask] = []
    private var activeSsoTask: SsoWarmupTask?
    private var activeSsoSawAuth: Bool = false
    private var activeSsoLastUrl: String = ""
    private var ssoSettleWorkItem: DispatchWorkItem?
    private var ssoTimeoutWorkItem: DispatchWorkItem?

    private var portalLoginActive: Bool = false
    private var portalLoginTargetHost: String = ""
    private var portalLoginSawAuthHost: Bool = false
    private var portalAutoCloseWorkItem: DispatchWorkItem?

    private var activePortalBgTask: SsoWarmupTask?
    private var activePortalBgSawAuth: Bool = false
    private var activePortalBgLastUrl: String = ""
    private var portalBgSettleWorkItem: DispatchWorkItem?
    private var portalBgTimeoutWorkItem: DispatchWorkItem?

    private var isClearingSession: Bool = false
    private var pendingOpenPortalAfterClear: (url: String, mode: String, title: String)?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0xF2 / 255.0, green: 0xF4 / 255.0, blue: 0xF7 / 255.0, alpha: 1.0)
        setupViews()
        loadConsole()
    }

    private func appVersionString() -> String {
        (Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String) ?? "0.17.0"
    }

    private func buildNativeShimScript() -> String {
        let quotedVersion = PortalPolicy.jsQuote(appVersionString())
        let handler = Self.messageHandlerName
        return """
        (function() {
          if (window.RemoteInsideNative) return;
          function postAction(payload) {
            try {
              window.webkit.messageHandlers.\(handler).postMessage(payload);
            } catch (e) {
              // ignore bridge post error
            }
          }
          window.RemoteInsideNative = {
            platform: 'ios',
            getPlatform: function() { return 'ios'; },
            getAppVersion: function() { return \(quotedVersion); },
            consumeResponse: function() { return ''; },
            httpRequest: function(payloadJson) {
              postAction({ action: 'httpRequest', payloadJson: String(payloadJson || '') });
            },
            openPortal: function(url, mode, title) {
              postAction({
                action: 'openPortal',
                url: String(url || ''),
                mode: String(mode || 'portal'),
                title: String(title || '')
              });
            },
            showPortalOverlay: function(title) {
              postAction({ action: 'showPortalOverlay', title: String(title || '') });
            },
            loadPortalBackground: function(payloadJson) {
              postAction({ action: 'loadPortalBackground', payloadJson: String(payloadJson || '') });
            },
            evalPortalJs: function(payloadJson) {
              postAction({ action: 'evalPortalJs', payloadJson: String(payloadJson || '') });
            },
            warmPortalSession: function(payloadJson) {
              postAction({ action: 'warmPortalSession', payloadJson: String(payloadJson || '') });
            },
            openExternalBrowser: function(url) {
              postAction({ action: 'openExternalBrowser', url: String(url || '') });
            },
            copyText: function(text) {
              postAction({ action: 'copyText', text: String(text || '') });
              return true;
            },
            readClipboardAsync: function(payloadJson) {
              postAction({ action: 'readClipboardAsync', payloadJson: String(payloadJson || '') });
            },
            clearSessionCookies: function() {
              postAction({ action: 'clearSessionCookies' });
              return true;
            }
          };
        })();
        """
    }

    private func setupViews() {
        let consoleConfig = WKWebViewConfiguration()
        consoleConfig.websiteDataStore = dataStore
        consoleConfig.setURLSchemeHandler(ConsoleSchemeHandler(), forURLScheme: Self.consoleScheme)
        consoleConfig.defaultWebpagePreferences.allowsContentJavaScript = true
        consoleConfig.defaultWebpagePreferences.preferredContentMode = .mobile
        let userContent = consoleConfig.userContentController
        userContent.addUserScript(
            WKUserScript(
                source: buildNativeShimScript(),
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
        )
        userContent.add(WeakScriptMessageHandler(target: self), name: Self.messageHandlerName)

        consoleWebView = WKWebView(frame: .zero, configuration: consoleConfig)
        consoleWebView.translatesAutoresizingMaskIntoConstraints = false
        consoleWebView.navigationDelegate = self
        consoleWebView.uiDelegate = self
        consoleWebView.isOpaque = true
        consoleWebView.backgroundColor = UIColor(red: 0xF2 / 255.0, green: 0xF4 / 255.0, blue: 0xF7 / 255.0, alpha: 1.0)
        consoleWebView.scrollView.contentInsetAdjustmentBehavior = .automatic

        let ssoConfig = WKWebViewConfiguration()
        ssoConfig.websiteDataStore = dataStore
        ssoConfig.defaultWebpagePreferences.allowsContentJavaScript = true
        ssoConfig.defaultWebpagePreferences.preferredContentMode = .mobile
        ssoWebView = WKWebView(frame: .zero, configuration: ssoConfig)
        ssoWebView.translatesAutoresizingMaskIntoConstraints = false
        ssoWebView.navigationDelegate = self
        ssoWebView.uiDelegate = self
        ssoWebView.alpha = 0.01
        ssoWebView.isUserInteractionEnabled = false

        let portalConfig = WKWebViewConfiguration()
        portalConfig.websiteDataStore = dataStore
        portalConfig.defaultWebpagePreferences.allowsContentJavaScript = true
        portalConfig.defaultWebpagePreferences.preferredContentMode = .mobile
        portalConfig.allowsInlineMediaPlayback = true
        portalWebView = WKWebView(frame: .zero, configuration: portalConfig)
        portalWebView.translatesAutoresizingMaskIntoConstraints = false
        portalWebView.navigationDelegate = self
        portalWebView.uiDelegate = self
        portalWebView.allowsBackForwardNavigationGestures = true
        portalWebView.isOpaque = true
        portalWebView.backgroundColor = .white
        portalWebView.underPageBackgroundColor = .white

        portalOverlay = UIView()
        portalOverlay.translatesAutoresizingMaskIntoConstraints = false
        portalOverlay.backgroundColor = .white
        portalOverlay.isUserInteractionEnabled = false

        let toolbar = UIView()
        toolbar.translatesAutoresizingMaskIntoConstraints = false
        toolbar.backgroundColor = .white

        btnPortalBack = makeToolbarButton(
            title: "← Đóng",
            bgColor: UIColor(red: 0xE9 / 255.0, green: 0xEE / 255.0, blue: 0xF4 / 255.0, alpha: 1.0),
            textColor: UIColor(red: 0x14 / 255.0, green: 0x1B / 255.0, blue: 0x24 / 255.0, alpha: 1.0),
            borderColor: UIColor(red: 0xD5 / 255.0, green: 0xDC / 255.0, blue: 0xE4 / 255.0, alpha: 1.0),
            horizontalPadding: 10
        )
        btnPortalBack.addTarget(self, action: #selector(onPortalBackTapped), for: .touchUpInside)

        tvPortalTitle = UILabel()
        tvPortalTitle.translatesAutoresizingMaskIntoConstraints = false
        tvPortalTitle.font = .systemFont(ofSize: 14, weight: .bold)
        tvPortalTitle.textColor = UIColor(red: 0x14 / 255.0, green: 0x1B / 255.0, blue: 0x24 / 255.0, alpha: 1.0)
        tvPortalTitle.lineBreakMode = .byTruncatingTail
        tvPortalTitle.text = "Cổng nội bộ FPT"

        tvPortalUrl = UILabel()
        tvPortalUrl.translatesAutoresizingMaskIntoConstraints = false
        tvPortalUrl.font = .systemFont(ofSize: 11, weight: .regular)
        tvPortalUrl.textColor = UIColor(red: 0x52 / 255.0, green: 0x60 / 255.0, blue: 0x72 / 255.0, alpha: 1.0)
        tvPortalUrl.lineBreakMode = .byTruncatingTail
        tvPortalUrl.text = ""

        let titleStack = UIStackView(arrangedSubviews: [tvPortalTitle, tvPortalUrl])
        titleStack.translatesAutoresizingMaskIntoConstraints = false
        titleStack.axis = .vertical
        titleStack.spacing = 1

        btnPortalReload = makeToolbarButton(
            title: "↻",
            bgColor: UIColor(red: 0xE9 / 255.0, green: 0xEE / 255.0, blue: 0xF4 / 255.0, alpha: 1.0),
            textColor: UIColor(red: 0x14 / 255.0, green: 0x1B / 255.0, blue: 0x24 / 255.0, alpha: 1.0),
            borderColor: UIColor(red: 0xD5 / 255.0, green: 0xDC / 255.0, blue: 0xE4 / 255.0, alpha: 1.0),
            horizontalPadding: 0
        )
        btnPortalReload.titleLabel?.font = .systemFont(ofSize: 16, weight: .bold)
        btnPortalReload.addTarget(self, action: #selector(onPortalReloadTapped), for: .touchUpInside)

        btnPortalDone = makeToolbarButton(
            title: "Xong",
            bgColor: UIColor(red: 0xE8 / 255.0, green: 0x5D / 255.0, blue: 0x04 / 255.0, alpha: 1.0),
            textColor: .white,
            borderColor: nil,
            horizontalPadding: 12
        )
        btnPortalDone.addTarget(self, action: #selector(onPortalDoneTapped), for: .touchUpInside)

        toolbar.addSubview(btnPortalBack)
        toolbar.addSubview(titleStack)
        toolbar.addSubview(btnPortalReload)
        toolbar.addSubview(btnPortalDone)

        let divider = UIView()
        divider.translatesAutoresizingMaskIntoConstraints = false
        divider.backgroundColor = UIColor(red: 0xD5 / 255.0, green: 0xDC / 255.0, blue: 0xE4 / 255.0, alpha: 1.0)

        portalProgress = UIProgressView(progressViewStyle: .bar)
        portalProgress.translatesAutoresizingMaskIntoConstraints = false
        portalProgress.progressTintColor = UIColor(red: 0xE8 / 255.0, green: 0x5D / 255.0, blue: 0x04 / 255.0, alpha: 1.0)
        portalProgress.trackTintColor = .clear
        portalProgress.isHidden = true

        portalOverlay.addSubview(toolbar)
        portalOverlay.addSubview(divider)
        portalOverlay.addSubview(portalProgress)
        portalOverlay.addSubview(portalWebView)

        // Place portalOverlay & ssoWebView behind opaque consoleWebView so iOS WebKit keeps background Blazor/SignalR ticking.
        view.addSubview(ssoWebView)
        view.addSubview(portalOverlay)
        view.addSubview(consoleWebView)

        toastLabel = UILabel()
        toastLabel.translatesAutoresizingMaskIntoConstraints = false
        toastLabel.backgroundColor = UIColor(red: 0x14 / 255.0, green: 0x1B / 255.0, blue: 0x24 / 255.0, alpha: 0.92)
        toastLabel.textColor = .white
        toastLabel.font = .systemFont(ofSize: 13, weight: .semibold)
        toastLabel.textAlignment = .center
        toastLabel.numberOfLines = 2
        toastLabel.layer.cornerRadius = 10
        toastLabel.clipsToBounds = true
        toastLabel.isHidden = true
        toastLabel.alpha = 0
        view.addSubview(toastLabel)

        let safe = view.safeAreaLayoutGuide
        let kb = view.keyboardLayoutGuide

        NSLayoutConstraint.activate([
            ssoWebView.topAnchor.constraint(equalTo: safe.topAnchor),
            ssoWebView.leadingAnchor.constraint(equalTo: safe.leadingAnchor),
            ssoWebView.widthAnchor.constraint(equalToConstant: 1),
            ssoWebView.heightAnchor.constraint(equalToConstant: 1),

            consoleWebView.topAnchor.constraint(equalTo: safe.topAnchor),
            consoleWebView.leadingAnchor.constraint(equalTo: safe.leadingAnchor),
            consoleWebView.trailingAnchor.constraint(equalTo: safe.trailingAnchor),
            consoleWebView.bottomAnchor.constraint(equalTo: kb.topAnchor),

            portalOverlay.topAnchor.constraint(equalTo: safe.topAnchor),
            portalOverlay.leadingAnchor.constraint(equalTo: safe.leadingAnchor),
            portalOverlay.trailingAnchor.constraint(equalTo: safe.trailingAnchor),
            portalOverlay.bottomAnchor.constraint(equalTo: kb.topAnchor),

            toolbar.topAnchor.constraint(equalTo: portalOverlay.topAnchor),
            toolbar.leadingAnchor.constraint(equalTo: portalOverlay.leadingAnchor),
            toolbar.trailingAnchor.constraint(equalTo: portalOverlay.trailingAnchor),
            toolbar.heightAnchor.constraint(greaterThanOrEqualToConstant: 52),

            btnPortalBack.leadingAnchor.constraint(equalTo: toolbar.leadingAnchor, constant: 8),
            btnPortalBack.centerYAnchor.constraint(equalTo: toolbar.centerYAnchor),
            btnPortalBack.heightAnchor.constraint(equalToConstant: 36),

            btnPortalDone.trailingAnchor.constraint(equalTo: toolbar.trailingAnchor, constant: -8),
            btnPortalDone.centerYAnchor.constraint(equalTo: toolbar.centerYAnchor),
            btnPortalDone.heightAnchor.constraint(equalToConstant: 36),

            btnPortalReload.trailingAnchor.constraint(equalTo: btnPortalDone.leadingAnchor, constant: -6),
            btnPortalReload.centerYAnchor.constraint(equalTo: toolbar.centerYAnchor),
            btnPortalReload.widthAnchor.constraint(equalToConstant: 36),
            btnPortalReload.heightAnchor.constraint(equalToConstant: 36),

            titleStack.leadingAnchor.constraint(equalTo: btnPortalBack.trailingAnchor, constant: 10),
            titleStack.trailingAnchor.constraint(equalTo: btnPortalReload.leadingAnchor, constant: -8),
            titleStack.topAnchor.constraint(equalTo: toolbar.topAnchor, constant: 6),
            titleStack.bottomAnchor.constraint(equalTo: toolbar.bottomAnchor, constant: -6),

            divider.topAnchor.constraint(equalTo: toolbar.bottomAnchor),
            divider.leadingAnchor.constraint(equalTo: portalOverlay.leadingAnchor),
            divider.trailingAnchor.constraint(equalTo: portalOverlay.trailingAnchor),
            divider.heightAnchor.constraint(equalToConstant: 1),

            portalProgress.topAnchor.constraint(equalTo: divider.bottomAnchor),
            portalProgress.leadingAnchor.constraint(equalTo: portalOverlay.leadingAnchor),
            portalProgress.trailingAnchor.constraint(equalTo: portalOverlay.trailingAnchor),
            portalProgress.heightAnchor.constraint(equalToConstant: 3),

            portalWebView.topAnchor.constraint(equalTo: portalProgress.bottomAnchor),
            portalWebView.leadingAnchor.constraint(equalTo: portalOverlay.leadingAnchor),
            portalWebView.trailingAnchor.constraint(equalTo: portalOverlay.trailingAnchor),
            portalWebView.bottomAnchor.constraint(equalTo: portalOverlay.bottomAnchor),

            toastLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            toastLabel.leadingAnchor.constraint(greaterThanOrEqualTo: safe.leadingAnchor, constant: 24),
            toastLabel.trailingAnchor.constraint(lessThanOrEqualTo: safe.trailingAnchor, constant: -24),
            toastLabel.bottomAnchor.constraint(equalTo: kb.topAnchor, constant: -20),
            toastLabel.heightAnchor.constraint(greaterThanOrEqualToConstant: 36)
        ])

        btnPortalBack.setContentHuggingPriority(.required, for: .horizontal)
        btnPortalDone.setContentHuggingPriority(.required, for: .horizontal)
        btnPortalReload.setContentHuggingPriority(.required, for: .horizontal)
        btnPortalBack.setContentCompressionResistancePriority(.required, for: .horizontal)
        btnPortalDone.setContentCompressionResistancePriority(.required, for: .horizontal)
        titleStack.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)

        progressObservation = portalWebView.observe(\.estimatedProgress, options: [.new]) { [weak self] webView, _ in
            guard let self = self else { return }
            let p = Float(webView.estimatedProgress)
            DispatchQueue.main.async {
                if p > 0 && p < 1.0 {
                    self.portalProgress.isHidden = false
                    self.portalProgress.setProgress(p, animated: true)
                } else {
                    self.portalProgress.isHidden = true
                    self.portalProgress.setProgress(0, animated: false)
                }
            }
        }
    }

    private func makeToolbarButton(
        title: String,
        bgColor: UIColor,
        textColor: UIColor,
        borderColor: UIColor?,
        horizontalPadding: CGFloat
    ) -> UIButton {
        let btn = UIButton(type: .system)
        btn.translatesAutoresizingMaskIntoConstraints = false
        btn.setTitle(title, for: .normal)
        btn.setTitleColor(textColor, for: .normal)
        btn.titleLabel?.font = .systemFont(ofSize: 13, weight: .bold)
        btn.backgroundColor = bgColor
        btn.layer.cornerRadius = 8
        if let borderColor = borderColor {
            btn.layer.borderWidth = 1
            btn.layer.borderColor = borderColor.cgColor
        }
        if horizontalPadding > 0 {
            btn.contentEdgeInsets = UIEdgeInsets(top: 0, left: horizontalPadding, bottom: 0, right: horizontalPadding)
        }
        return btn
    }

    private func loadConsole() {
        guard let url = URL(string: Self.consoleUrlString) else { return }
        consoleWebView.load(URLRequest(url: url))
    }

    @objc private func onPortalBackTapped() {
        let curUrl = portalWebView.url?.absoluteString ?? ""
        let curHost = URL(string: curUrl)?.host ?? ""
        let loggedIn = portalLoginActive &&
            portalLoginSawAuthHost &&
            PortalPolicy.isAllowedPortalHost(curHost) &&
            !PortalPolicy.isAuthUrl(curUrl)
        closePortalOverlay(completedHost: curHost, loginCompleted: loggedIn)
    }

    @objc private func onPortalDoneTapped() {
        let curUrl = portalWebView.url?.absoluteString ?? ""
        let curHost = URL(string: curUrl)?.host ?? ""
        let loggedIn = (portalLoginActive || portalLoginSawAuthHost) &&
            PortalPolicy.isAllowedPortalHost(curHost) &&
            !PortalPolicy.isAuthUrl(curUrl)
        closePortalOverlay(completedHost: curHost, loginCompleted: loggedIn)
    }

    @objc private func onPortalReloadTapped() {
        portalWebView.reload()
    }

    private func showToast(_ message: String) {
        toastHideWorkItem?.cancel()
        toastLabel.text = "  \(message)  "
        toastLabel.isHidden = false
        view.bringSubviewToFront(toastLabel)
        UIView.animate(withDuration: 0.2) {
            self.toastLabel.alpha = 1.0
        }
        let work = DispatchWorkItem { [weak self] in
            guard let self = self else { return }
            UIView.animate(withDuration: 0.25, animations: {
                self.toastLabel.alpha = 0
            }, completion: { _ in
                self.toastLabel.isHidden = true
            })
        }
        toastHideWorkItem = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.2, execute: work)
    }

    private func openPortalOverlay(url: String, mode: String, title: String) {
        if isClearingSession {
            pendingOpenPortalAfterClear = (url: url, mode: mode, title: title)
            return
        }
        guard let parsed = URL(string: url),
              let scheme = parsed.scheme?.lowercased(),
              scheme == "http" || scheme == "https"
        else {
            return
        }
        let fallbackTitle = (mode == "login")
            ? "Đăng nhập cổng nội bộ FPT"
            : "Trang nội bộ FPT"
        if activePortalBgTask != nil {
            finishPortalBgTask(ok: false, status: "superseded", finalUrl: url)
        }
        portalAutoCloseWorkItem?.cancel()
        portalAutoCloseWorkItem = nil
        portalLoginActive = (mode == "login")
        var initialTargetHost = parsed.host ?? ""
        var sawAuthInitially = false
        if portalLoginActive && PortalPolicy.isAuthHost(initialTargetHost) {
            sawAuthInitially = true
            if let redirectParam = URLComponents(url: parsed, resolvingAgainstBaseURL: false)?
                .queryItems?
                .first(where: { $0.name == "redirect_uri" })?
                .value,
               let redirectHost = URL(string: redirectParam)?.host,
               PortalPolicy.isAllowedPortalHost(redirectHost),
               !PortalPolicy.isAuthHost(redirectHost)
            {
                initialTargetHost = redirectHost
            }
        }
        portalLoginTargetHost = initialTargetHost
        portalLoginSawAuthHost = sawAuthInitially
        tvPortalTitle.text = title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? fallbackTitle : title
        tvPortalUrl.text = url
        portalProgress.isHidden = false
        portalProgress.setProgress(0.15, animated: false)
        portalOverlayVisible = true
        portalOverlay.isUserInteractionEnabled = true
        view.bringSubviewToFront(portalOverlay)
        portalWebView.load(URLRequest(url: parsed))
    }

    private func showPortalOverlayInternal(title: String) {
        portalAutoCloseWorkItem?.cancel()
        portalAutoCloseWorkItem = nil
        portalLoginActive = false
        portalLoginSawAuthHost = false
        let currentTitle = (portalWebView.title ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedArg = title.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedArg.isEmpty {
            tvPortalTitle.text = trimmedArg
        } else if !currentTitle.isEmpty {
            tvPortalTitle.text = currentTitle
        } else {
            tvPortalTitle.text = "Trang nội bộ FPT"
        }
        tvPortalUrl.text = portalWebView.url?.absoluteString ?? ""
        portalProgress.isHidden = true
        portalOverlayVisible = true
        portalOverlay.isUserInteractionEnabled = true
        view.bringSubviewToFront(portalOverlay)
    }

    private func closePortalOverlay(completedHost: String = "", loginCompleted: Bool = false) {
        portalAutoCloseWorkItem?.cancel()
        portalAutoCloseWorkItem = nil
        portalLoginActive = false
        portalLoginTargetHost = ""
        portalLoginSawAuthHost = false
        guard portalOverlayVisible else { return }
        portalOverlayVisible = false
        view.endEditing(true)
        portalOverlay.isUserInteractionEnabled = false
        view.sendSubviewToBack(portalOverlay)
        view.sendSubviewToBack(ssoWebView)

        let js = "window.__riOnPortalBrowserClosed && window.__riOnPortalBrowserClosed(\(PortalPolicy.jsQuote(completedHost)), \(loginCompleted ? "true" : "false"));"
        consoleWebView.evaluateJavaScript(js, completionHandler: nil)
    }

    private func deliverBridgeResponse(reqId: String, result: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: result, options: []),
              let jsonStr = String(data: data, encoding: .utf8)
        else {
            return
        }
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            let js = "window.__riNativeResolve && window.__riNativeResolve(\(PortalPolicy.jsQuote(reqId)), \(PortalPolicy.jsQuote(jsonStr)));"
            self.consoleWebView.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    private func parseJsonDict(_ raw: String) -> [String: Any]? {
        guard let data = raw.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data, options: []),
              let dict = obj as? [String: Any]
        else {
            return nil
        }
        return dict
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == Self.messageHandlerName,
              let body = message.body as? [String: Any],
              let action = body["action"] as? String
        else {
            return
        }

        switch action {
        case "httpRequest":
            let raw = (body["payloadJson"] as? String) ?? ""
            guard let payload = parseJsonDict(raw),
                  let reqId = payload["reqId"] as? String,
                  !reqId.isEmpty
            else {
                return
            }
            let ua = self.webViewUserAgent
            Task { [weak self] in
                guard let self = self else { return }
                let result = await self.httpClient.executeHttpRequest(
                    payload: payload,
                    userAgent: ua
                )
                self.deliverBridgeResponse(reqId: reqId, result: result)
            }

        case "openPortal":
            let url = (body["url"] as? String) ?? ""
            let mode = (body["mode"] as? String) ?? "portal"
            let title = (body["title"] as? String) ?? ""
            openPortalOverlay(url: url, mode: mode, title: title)

        case "showPortalOverlay":
            let title = (body["title"] as? String) ?? ""
            showPortalOverlayInternal(title: title)

        case "loadPortalBackground":
            let raw = (body["payloadJson"] as? String) ?? ""
            guard let payload = parseJsonDict(raw),
                  let reqId = payload["reqId"] as? String,
                  !reqId.isEmpty
            else {
                return
            }
            handleLoadPortalBackground(reqId: reqId, payload: payload)

        case "evalPortalJs":
            let raw = (body["payloadJson"] as? String) ?? ""
            guard let payload = parseJsonDict(raw),
                  let reqId = payload["reqId"] as? String,
                  !reqId.isEmpty
            else {
                return
            }
            let script = (payload["script"] as? String) ?? ""
            handleEvalPortalJs(reqId: reqId, script: script)

        case "warmPortalSession":
            let raw = (body["payloadJson"] as? String) ?? ""
            guard let payload = parseJsonDict(raw),
                  let reqId = payload["reqId"] as? String,
                  !reqId.isEmpty
            else {
                return
            }
            handleWarmPortalSession(reqId: reqId, payload: payload)

        case "openExternalBrowser":
            let urlStr = (body["url"] as? String) ?? ""
            if let parsed = URL(string: urlStr),
               parsed.scheme?.lowercased() == "https"
            {
                UIApplication.shared.open(parsed, options: [:], completionHandler: nil)
            }

        case "copyText":
            let text = (body["text"] as? String) ?? ""
            UIPasteboard.general.string = text

        case "readClipboardAsync":
            let raw = (body["payloadJson"] as? String) ?? ""
            guard let payload = parseJsonDict(raw),
                  let reqId = payload["reqId"] as? String,
                  !reqId.isEmpty
            else {
                return
            }
            let clipText = UIPasteboard.general.string ?? ""
            deliverBridgeResponse(
                reqId: reqId,
                result: [
                    "ok": true,
                    "status": "ok",
                    "value": clipText
                ]
            )

        case "clearSessionCookies":
            handleClearSessionCookies()

        default:
            break
        }
    }

    private func handleLoadPortalBackground(reqId: String, payload: [String: Any]) {
        let urlStr = (payload["url"] as? String) ?? ""
        let reusePrefix = ((payload["reusePrefix"] as? String) ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let rawTimeout = (payload["timeout"] as? NSNumber)?.intValue ?? 18000
        let timeoutMs = min(30000, max(3000, rawTimeout))

        guard let uri = URL(string: urlStr),
              let scheme = uri.scheme?.lowercased(),
              scheme == "http" || scheme == "https",
              let host = uri.host?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
              PortalPolicy.isAllowedPortalHost(host),
              !PortalPolicy.isAuthHost(host)
        else {
            deliverBridgeResponse(reqId: reqId, result: [
                "ok": false,
                "status": "invalid_url",
                "finalUrl": urlStr
            ])
            return
        }

        let curUrl = portalWebView.url?.absoluteString ?? ""
        if !reusePrefix.isEmpty,
           activePortalBgTask == nil,
           curUrl.lowercased().hasPrefix(reusePrefix.lowercased()),
           !PortalPolicy.isAuthUrl(curUrl)
        {
            deliverBridgeResponse(reqId: reqId, result: [
                "ok": true,
                "status": "ok",
                "finalUrl": curUrl,
                "sawAuth": false,
                "reused": true
            ])
            return
        }

        if activePortalBgTask != nil {
            finishPortalBgTask(ok: false, status: "superseded", finalUrl: curUrl)
        }

        if !portalOverlayVisible {
            portalOverlay.isUserInteractionEnabled = false
            view.sendSubviewToBack(portalOverlay)
            view.sendSubviewToBack(ssoWebView)
        }

        let task = SsoWarmupTask(reqId: reqId, url: urlStr, targetHost: host, timeoutMs: timeoutMs)
        activePortalBgTask = task
        activePortalBgSawAuth = false
        activePortalBgLastUrl = urlStr
        portalBgSettleWorkItem?.cancel()
        portalBgSettleWorkItem = nil
        portalBgTimeoutWorkItem?.cancel()

        let timeoutWork = DispatchWorkItem { [weak self] in
            guard let self = self,
                  let current = self.activePortalBgTask,
                  current.reqId == reqId
            else {
                return
            }
            let fallbackStatus = (self.activePortalBgSawAuth || PortalPolicy.isAuthUrl(self.activePortalBgLastUrl))
                ? "needs_login"
                : "timeout"
            self.finishPortalBgTask(
                ok: false,
                status: fallbackStatus,
                finalUrl: self.activePortalBgLastUrl.isEmpty ? current.url : self.activePortalBgLastUrl
            )
        }
        portalBgTimeoutWorkItem = timeoutWork
        DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(timeoutMs), execute: timeoutWork)
        portalWebView.load(URLRequest(url: uri))
    }

    private func handleEvalPortalJs(reqId: String, script: String) {
        let curUrl = portalWebView.url?.absoluteString ?? ""
        let curHost = URL(string: curUrl)?.host ?? ""
        if curUrl.isEmpty || curUrl == "about:blank" || !PortalPolicy.isAllowedPortalHost(curHost) {
            deliverBridgeResponse(reqId: reqId, result: [
                "ok": false,
                "status": "no_portal",
                "finalUrl": curUrl
            ])
            return
        }

        if PortalPolicy.isAuthUrl(curUrl) {
            deliverBridgeResponse(reqId: reqId, result: [
                "ok": false,
                "status": "needs_login",
                "finalUrl": curUrl
            ])
            return
        }

        let wrapped =
            "(function(){try{var __fn=function(){\n" +
            script +
            "\n};var __val=__fn();return JSON.stringify({ok:true,status:\"ok\",finalUrl:String(location.href||\"\"),value:__val===undefined?null:__val});}catch(__err){return JSON.stringify({ok:false,status:\"js_error\",finalUrl:String(location.href||\"\"),error:String(__err&&__err.message?__err.message:__err)});}})();"

        portalWebView.evaluateJavaScript(wrapped) { [weak self] result, _ in
            guard let self = self else { return }
            if let rawStr = result as? String,
               let parsedObj = self.parseJsonDict(rawStr)
            {
                self.deliverBridgeResponse(reqId: reqId, result: parsedObj)
            } else {
                self.deliverBridgeResponse(reqId: reqId, result: [
                    "ok": false,
                    "status": "eval_null",
                    "finalUrl": self.portalWebView.url?.absoluteString ?? ""
                ])
            }
        }
    }

    private func handleWarmPortalSession(reqId: String, payload: [String: Any]) {
        let urlStr = (payload["url"] as? String) ?? ""
        let requestedTargetHost = ((payload["targetHost"] as? String) ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        let rawTimeout = (payload["timeout"] as? NSNumber)?.intValue ?? 12000
        let timeoutMs = min(20000, max(3000, rawTimeout))

        guard let uri = URL(string: urlStr),
              let scheme = uri.scheme?.lowercased(),
              scheme == "http" || scheme == "https",
              let host = uri.host?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        else {
            deliverBridgeResponse(reqId: reqId, result: [
                "ok": false,
                "status": "invalid_url",
                "finalUrl": urlStr
            ])
            return
        }

        let allowAuthEntry = PortalPolicy.isAuthHost(host) &&
            !requestedTargetHost.isEmpty &&
            PortalPolicy.isAllowedPortalHost(requestedTargetHost) &&
            !PortalPolicy.isAuthHost(requestedTargetHost)
        let effectiveTargetHost = allowAuthEntry ? requestedTargetHost : host

        guard (PortalPolicy.isAllowedPortalHost(host) || allowAuthEntry) &&
            (!PortalPolicy.isAuthHost(host) || allowAuthEntry)
        else {
            deliverBridgeResponse(reqId: reqId, result: [
                "ok": false,
                "status": "invalid_url",
                "finalUrl": urlStr
            ])
            return
        }

        ssoQueue.append(SsoWarmupTask(reqId: reqId, url: urlStr, targetHost: effectiveTargetHost, timeoutMs: timeoutMs))
        startNextSsoTask()
    }

    private func startNextSsoTask() {
        guard activeSsoTask == nil, !ssoQueue.isEmpty else { return }
        let next = ssoQueue.removeFirst()
        guard let nextUrl = URL(string: next.url) else {
            deliverBridgeResponse(reqId: next.reqId, result: [
                "ok": false,
                "status": "invalid_url",
                "finalUrl": next.url
            ])
            startNextSsoTask()
            return
        }

        activeSsoTask = next
        activeSsoSawAuth = false
        activeSsoLastUrl = next.url
        ssoSettleWorkItem?.cancel()
        ssoSettleWorkItem = nil
        ssoTimeoutWorkItem?.cancel()

        let timeoutWork = DispatchWorkItem { [weak self] in
            guard let self = self,
                  let current = self.activeSsoTask,
                  current.reqId == next.reqId
            else {
                return
            }
            let fallbackStatus = (self.activeSsoSawAuth || PortalPolicy.isAuthUrl(self.activeSsoLastUrl))
                ? "needs_login"
                : "timeout"
            self.finishActiveSsoTask(
                ok: false,
                status: fallbackStatus,
                finalUrl: self.activeSsoLastUrl.isEmpty ? current.url : self.activeSsoLastUrl
            )
        }
        ssoTimeoutWorkItem = timeoutWork
        DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(next.timeoutMs), execute: timeoutWork)
        ssoWebView.load(URLRequest(url: nextUrl))
    }

    private func finishActiveSsoTask(ok: Bool, status: String, finalUrl: String) {
        guard let task = activeSsoTask else { return }
        activeSsoTask = nil
        ssoSettleWorkItem?.cancel()
        ssoSettleWorkItem = nil
        ssoTimeoutWorkItem?.cancel()
        ssoTimeoutWorkItem = nil
        ssoWebView.stopLoading()
        if ssoQueue.isEmpty, let blank = URL(string: "about:blank") {
            ssoWebView.load(URLRequest(url: blank))
        }
        deliverBridgeResponse(reqId: task.reqId, result: [
            "ok": ok,
            "status": status,
            "finalUrl": finalUrl.isEmpty ? task.url : finalUrl,
            "sawAuth": activeSsoSawAuth
        ])
        startNextSsoTask()
    }

    private func finishPortalBgTask(ok: Bool, status: String, finalUrl: String, reused: Bool = false) {
        guard let task = activePortalBgTask else { return }
        activePortalBgTask = nil
        portalBgSettleWorkItem?.cancel()
        portalBgSettleWorkItem = nil
        portalBgTimeoutWorkItem?.cancel()
        portalBgTimeoutWorkItem = nil
        deliverBridgeResponse(reqId: task.reqId, result: [
            "ok": ok,
            "status": status,
            "finalUrl": finalUrl.isEmpty ? task.url : finalUrl,
            "sawAuth": activePortalBgSawAuth,
            "reused": reused
        ])
    }

    private func cancelAllPendingWorkItems() {
        ssoSettleWorkItem?.cancel()
        ssoSettleWorkItem = nil
        ssoTimeoutWorkItem?.cancel()
        ssoTimeoutWorkItem = nil
        portalBgSettleWorkItem?.cancel()
        portalBgSettleWorkItem = nil
        portalBgTimeoutWorkItem?.cancel()
        portalBgTimeoutWorkItem = nil
        portalAutoCloseWorkItem?.cancel()
        portalAutoCloseWorkItem = nil
        toastHideWorkItem?.cancel()
        toastHideWorkItem = nil
    }

    private func handleClearSessionCookies() {
        isClearingSession = true
        cancelAllPendingWorkItems()
        ssoQueue.removeAll()
        activeSsoTask = nil
        activePortalBgTask = nil

        portalWebView.stopLoading()
        ssoWebView.stopLoading()
        if let blank = URL(string: "about:blank") {
            portalWebView.load(URLRequest(url: blank))
            ssoWebView.load(URLRequest(url: blank))
        }

        if let sharedCookies = HTTPCookieStorage.shared.cookies {
            for cookie in sharedCookies {
                HTTPCookieStorage.shared.deleteCookie(cookie)
            }
        }

        let cookieStore = dataStore.httpCookieStore
        cookieStore.getAllCookies { [weak self] cookies in
            guard let self = self else { return }
            let group = DispatchGroup()
            for cookie in cookies {
                group.enter()
                cookieStore.delete(cookie) {
                    group.leave()
                }
            }
            group.notify(queue: .main) {
                let allTypes = WKWebsiteDataStore.allWebsiteDataTypes()
                self.dataStore.fetchDataRecords(ofTypes: allTypes) { records in
                    let nonConsoleRecords = records.filter { record in
                        record.displayName.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() != "console"
                    }
                    let finishClear = {
                        self.isClearingSession = false
                        if let pending = self.pendingOpenPortalAfterClear {
                            self.pendingOpenPortalAfterClear = nil
                            self.openPortalOverlay(url: pending.url, mode: pending.mode, title: pending.title)
                        }
                    }
                    if nonConsoleRecords.isEmpty {
                        finishClear()
                    } else {
                        self.dataStore.removeData(ofTypes: allTypes, for: nonConsoleRecords) {
                            finishClear()
                        }
                    }
                }
            }
        }
    }

    // MARK: - WKNavigationDelegate

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }
        let scheme = (url.scheme ?? "").lowercased()

        if webView === consoleWebView {
            let isMainFrame = navigationAction.targetFrame?.isMainFrame ?? true
            if !isMainFrame {
                decisionHandler(.allow)
                return
            }
            if scheme == Self.consoleScheme && (url.host ?? "").lowercased() == "console" {
                decisionHandler(.allow)
                return
            }
            if scheme == "http" || scheme == "https" {
                openPortalOverlay(url: url.absoluteString, mode: "portal", title: "")
            }
            decisionHandler(.cancel)
            return
        }

        if scheme == "http" || scheme == "https" || url.absoluteString == "about:blank" {
            decisionHandler(.allow)
        } else {
            decisionHandler(.cancel)
        }
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        let urlStr = webView.url?.absoluteString ?? ""
        if webView === portalWebView {
            tvPortalUrl.text = urlStr
            portalAutoCloseWorkItem?.cancel()
            portalAutoCloseWorkItem = nil
            if PortalPolicy.isAuthUrl(urlStr) {
                portalLoginSawAuthHost = true
            }
            if !urlStr.isEmpty && urlStr != "about:blank" && activePortalBgTask != nil {
                portalBgSettleWorkItem?.cancel()
                portalBgSettleWorkItem = nil
                activePortalBgLastUrl = urlStr
                if PortalPolicy.isAuthUrl(urlStr) {
                    activePortalBgSawAuth = true
                }
            }
        } else if webView === ssoWebView {
            guard !urlStr.isEmpty, urlStr != "about:blank", activeSsoTask != nil else { return }
            ssoSettleWorkItem?.cancel()
            ssoSettleWorkItem = nil
            activeSsoLastUrl = urlStr
            if PortalPolicy.isAuthUrl(urlStr) {
                activeSsoSawAuth = true
            }
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        let urlStr = webView.url?.absoluteString ?? ""

        if webView === consoleWebView {
            consoleWebView.evaluateJavaScript("navigator.userAgent") { [weak self] res, _ in
                if let ua = res as? String, !ua.isEmpty {
                    self?.webViewUserAgent = ua
                }
            }
            return
        }

        if webView === portalWebView {
            handlePortalDidFinish(urlStr: urlStr)
            return
        }

        if webView === ssoWebView {
            handleSsoDidFinish(urlStr: urlStr)
        }
    }

    private func handlePortalDidFinish(urlStr: String) {
        tvPortalUrl.text = urlStr
        let pageTitle = (portalWebView.title ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if !pageTitle.isEmpty {
            tvPortalTitle.text = pageTitle
        }

        if portalLoginActive,
           portalLoginSawAuthHost,
           portalOverlayVisible,
           PortalPolicy.isTargetPortalUrl(urlStr, targetHost: portalLoginTargetHost)
        {
            portalAutoCloseWorkItem?.cancel()
            let targetHost = portalLoginTargetHost
            let work = DispatchWorkItem { [weak self] in
                guard let self = self, self.portalOverlayVisible else { return }
                self.showToast("Đã đăng nhập IAM — đang đồng bộ tất cả cổng…")
                self.closePortalOverlay(completedHost: targetHost, loginCompleted: true)
            }
            portalAutoCloseWorkItem = work
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.9, execute: work)
        }

        guard let bgTask = activePortalBgTask,
              !urlStr.isEmpty,
              urlStr != "about:blank"
        else {
            return
        }

        activePortalBgLastUrl = urlStr
        portalBgSettleWorkItem?.cancel()
        portalBgSettleWorkItem = nil
        let bgReqId = bgTask.reqId

        if PortalPolicy.isAuthUrl(urlStr) {
            activePortalBgSawAuth = true
            let work = DispatchWorkItem { [weak self] in
                guard let self = self,
                      let current = self.activePortalBgTask,
                      current.reqId == bgReqId
                else {
                    return
                }
                self.finishPortalBgTask(
                    ok: false,
                    status: "needs_login",
                    finalUrl: self.activePortalBgLastUrl.isEmpty ? current.url : self.activePortalBgLastUrl
                )
            }
            portalBgSettleWorkItem = work
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.2, execute: work)
        } else if PortalPolicy.isTargetPortalUrl(urlStr, targetHost: bgTask.targetHost) {
            let work = DispatchWorkItem { [weak self] in
                guard let self = self,
                      let current = self.activePortalBgTask,
                      current.reqId == bgReqId
                else {
                    return
                }
                let checkJs = """
                    (function() {
                      var pwd = !!document.querySelector('input[type="password"]');
                      var title = String(document.title || '');
                      var hasFrameset = !!document.querySelector('frameset');
                      return JSON.stringify({
                        href: String(location.href || ''),
                        hasPwd: pwd,
                        title: title,
                        hasFrameset: hasFrameset
                      });
                    })();
                """
                self.portalWebView.evaluateJavaScript(checkJs) { [weak self] res, _ in
                    guard let self = self,
                          let stillCurrent = self.activePortalBgTask,
                          stillCurrent.reqId == bgReqId
                    else {
                        return
                    }
                    let meta = (res as? String).flatMap { self.parseJsonDict($0) }
                    let domHref = (meta?["href"] as? String) ?? ""
                    let fallbackUrl = self.activePortalBgLastUrl.isEmpty ? urlStr : self.activePortalBgLastUrl
                    let effectiveUrl = domHref.isEmpty ? fallbackUrl : domHref
                    let hasPwd = (meta?["hasPwd"] as? Bool) ?? false
                    let title = (meta?["title"] as? String) ?? ""
                    let hasFrameset = (meta?["hasFrameset"] as? Bool) ?? false
                    let hasLoginTitle = !hasFrameset && PortalPolicy.matchesLoginTitle(title)

                    if !hasPwd &&
                        !hasLoginTitle &&
                        PortalPolicy.isTargetPortalUrl(effectiveUrl, targetHost: stillCurrent.targetHost)
                    {
                        self.finishPortalBgTask(ok: true, status: "ok", finalUrl: effectiveUrl)
                    } else {
                        self.finishPortalBgTask(ok: false, status: "needs_login", finalUrl: effectiveUrl)
                    }
                }
            }
            portalBgSettleWorkItem = work
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.7, execute: work)
        }
    }

    private func handleSsoDidFinish(urlStr: String) {
        guard !urlStr.isEmpty, urlStr != "about:blank", let task = activeSsoTask else { return }
        activeSsoLastUrl = urlStr
        ssoSettleWorkItem?.cancel()
        ssoSettleWorkItem = nil
        let taskReqId = task.reqId

        if PortalPolicy.isAuthUrl(urlStr) {
            activeSsoSawAuth = true
            let work = DispatchWorkItem { [weak self] in
                guard let self = self,
                      let current = self.activeSsoTask,
                      current.reqId == taskReqId
                else {
                    return
                }
                self.finishActiveSsoTask(
                    ok: false,
                    status: "needs_login",
                    finalUrl: self.activeSsoLastUrl.isEmpty ? current.url : self.activeSsoLastUrl
                )
            }
            ssoSettleWorkItem = work
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.2, execute: work)
            return
        }

        if PortalPolicy.isTargetPortalUrl(urlStr, targetHost: task.targetHost) {
            let delaySec: TimeInterval = activeSsoSawAuth ? 1.2 : 1.8
            let work = DispatchWorkItem { [weak self] in
                guard let self = self,
                      let current = self.activeSsoTask,
                      current.reqId == taskReqId
                else {
                    return
                }
                let checkJs = """
                    (function() {
                      var pwd = !!document.querySelector('input[type="password"]');
                      var title = String(document.title || '');
                      var hasFrameset = !!document.querySelector('frameset');
                      return JSON.stringify({
                        href: String(location.href || ''),
                        hasPwd: pwd,
                        title: title,
                        hasFrameset: hasFrameset
                      });
                    })();
                """
                self.ssoWebView.evaluateJavaScript(checkJs) { [weak self] res, _ in
                    guard let self = self,
                          let stillCurrent = self.activeSsoTask,
                          stillCurrent.reqId == taskReqId
                    else {
                        return
                    }
                    let meta = (res as? String).flatMap { self.parseJsonDict($0) }
                    let domHref = (meta?["href"] as? String) ?? ""
                    let fallbackUrl = self.activeSsoLastUrl.isEmpty ? urlStr : self.activeSsoLastUrl
                    let effectiveUrl = domHref.isEmpty ? fallbackUrl : domHref
                    let hasPwd = (meta?["hasPwd"] as? Bool) ?? false
                    let title = (meta?["title"] as? String) ?? ""
                    let hasFrameset = (meta?["hasFrameset"] as? Bool) ?? false
                    let hasLoginTitle = !hasFrameset && PortalPolicy.matchesLoginTitle(title)
                    let requiresRadiusToken = stillCurrent.targetHost.lowercased() == "radius-portal.fpt.net"

                    let completeSsoCheck: (Bool) -> Void = { hasRadiusToken in
                        guard let verifyCurrent = self.activeSsoTask, verifyCurrent.reqId == taskReqId else {
                            return
                        }
                        if !hasPwd &&
                            !hasLoginTitle &&
                            hasRadiusToken &&
                            PortalPolicy.isTargetPortalUrl(effectiveUrl, targetHost: verifyCurrent.targetHost)
                        {
                            self.finishActiveSsoTask(ok: true, status: "ok", finalUrl: effectiveUrl)
                        } else {
                            self.finishActiveSsoTask(ok: false, status: "needs_login", finalUrl: effectiveUrl)
                        }
                    }

                    if !requiresRadiusToken {
                        completeSsoCheck(true)
                    } else {
                        self.dataStore.httpCookieStore.getAllCookies { cookies in
                            let token = PortalPolicy.extractRadiusAccessToken(from: cookies)
                            DispatchQueue.main.async {
                                completeSsoCheck(!token.isEmpty)
                            }
                        }
                    }
                }
            }
            ssoSettleWorkItem = work
            DispatchQueue.main.asyncAfter(deadline: .now() + delaySec, execute: work)
        }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        handleWebNavigationFailure(webView: webView, error: error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        handleWebNavigationFailure(webView: webView, error: error)
    }

    private func handleWebNavigationFailure(webView: WKWebView, error: Error) {
        let nsError = error as NSError
        if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled {
            return
        }
        let isSsl = nsError.domain == NSURLErrorDomain && Self.sslErrorCodes.contains(nsError.code)
        let status = isSsl ? "ssl_error" : "network_error"

        if webView === portalWebView {
            if activePortalBgTask != nil {
                finishPortalBgTask(ok: false, status: status, finalUrl: activePortalBgLastUrl)
            }
            if isSsl && portalOverlayVisible {
                showToast("Cảnh báo: Chứng chỉ SSL trang không hợp lệ.")
            }
        } else if webView === ssoWebView {
            if activeSsoTask != nil {
                finishActiveSsoTask(ok: false, status: status, finalUrl: activeSsoLastUrl)
            }
        }
    }

    // MARK: - WKUIDelegate

    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if let targetUrl = navigationAction.request.url,
           let scheme = targetUrl.scheme?.lowercased(),
           scheme == "http" || scheme == "https"
        {
            webView.load(URLRequest(url: targetUrl))
        }
        return nil
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptAlertPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping () -> Void
    ) {
        guard webView !== ssoWebView, (webView !== portalWebView || portalOverlayVisible) else {
            completionHandler()
            return
        }
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Đóng", style: .default) { _ in
            completionHandler()
        })
        present(alert, animated: true, completion: nil)
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptConfirmPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping (Bool) -> Void
    ) {
        guard webView !== ssoWebView, (webView !== portalWebView || portalOverlayVisible) else {
            completionHandler(true)
            return
        }
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Hủy", style: .cancel) { _ in
            completionHandler(false)
        })
        alert.addAction(UIAlertAction(title: "Xác nhận", style: .default) { _ in
            completionHandler(true)
        })
        present(alert, animated: true, completion: nil)
    }
}
