import Foundation
import WebKit

private final class NoRedirectDelegate: NSObject, URLSessionTaskDelegate {
    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest,
        completionHandler: @escaping (URLRequest?) -> Void
    ) {
        completionHandler(nil)
    }
}

final class PortalHttpClient {
    private static let maxRedirects = 10
    private static let maxResponseBytes = 8 * 1024 * 1024
    private static let redirectStatusCodes: Set<Int> = [301, 302, 303, 307, 308]
    private static let charsetRegex = try! NSRegularExpression(
        pattern: "charset\\s*=\\s*[\"']?([A-Za-z0-9._-]+)",
        options: [.caseInsensitive]
    )

    private let redirectDelegate = NoRedirectDelegate()
    private let session: URLSession

    init() {
        let config = URLSessionConfiguration.ephemeral
        config.httpCookieStorage = nil
        config.httpShouldSetCookies = false
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.urlCache = nil
        session = URLSession(configuration: config, delegate: redirectDelegate, delegateQueue: nil)
    }

    deinit {
        session.invalidateAndCancel()
    }

    func executeHttpRequest(
        payload: [String: Any],
        userAgent: String
    ) async -> [String: Any] {
        let initialUrl = (payload["url"] as? String) ?? ""
        var currentUrl = initialUrl
        let rawMethod = ((payload["method"] as? String) ?? "GET")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .uppercased()
        var currentMethod = rawMethod.isEmpty ? "GET" : rawMethod
        var currentBody: String? = (payload["data"] as? String)
        let rawTimeout = (payload["timeout"] as? NSNumber)?.intValue ?? 15000
        let timeoutMs = min(60000, max(1000, rawTimeout))
        let headerDict = (payload["headers"] as? [String: Any]) ?? [:]
        let useRadiusBearer = (payload["useRadiusBearer"] as? Bool) ?? false

        guard let initialUri = URL(string: initialUrl),
              let initialScheme = initialUri.scheme?.lowercased(),
              initialScheme == "http" || initialScheme == "https",
              PortalPolicy.isAllowedPortalHost(initialUri.host)
        else {
            return [
                "ok": false,
                "status": 0,
                "finalUrl": initialUrl,
                "responseText": "",
                "responseHeaders": "",
                "error": "INVALID_OR_DISALLOWED_URL"
            ]
        }

        var workingCookies = await fetchAllCookies()

        do {
            var hop = 0
            while hop <= Self.maxRedirects {
                guard let hopUrl = URL(string: currentUrl),
                      let hopScheme = hopUrl.scheme?.lowercased(),
                      hopScheme == "http" || hopScheme == "https"
                else {
                    throw NSError(domain: "PortalHttpClient", code: -1)
                }

                var req = URLRequest(
                    url: hopUrl,
                    cachePolicy: .reloadIgnoringLocalCacheData,
                    timeoutInterval: TimeInterval(timeoutMs) / 1000.0
                )
                req.httpMethod = currentMethod
                req.httpShouldHandleCookies = false

                var hasUserAgent = false
                for (key, rawVal) in headerDict {
                    let lower = key.lowercased()
                    if lower == "cookie" || lower == "content-length" || lower == "host" {
                        continue
                    }
                    if lower == "user-agent" {
                        hasUserAgent = true
                    }
                    let valStr = String(describing: rawVal)
                    req.setValue(valStr, forHTTPHeaderField: key)
                }

                if !hasUserAgent && !userAgent.isEmpty {
                    req.setValue(userAgent, forHTTPHeaderField: "User-Agent")
                }

                let cookieHeader = PortalPolicy.cookieHeader(for: hopUrl, from: workingCookies)
                if !cookieHeader.isEmpty {
                    req.setValue(cookieHeader, forHTTPHeaderField: "Cookie")
                }

                if useRadiusBearer,
                   let hostLower = hopUrl.host?.lowercased(),
                   hostLower == "radius-apigateway.fpt.net"
                {
                    let radiusToken = PortalPolicy.extractRadiusAccessToken(from: workingCookies)
                    if radiusToken.isEmpty {
                        return [
                            "ok": false,
                            "status": 401,
                            "finalUrl": currentUrl,
                            "responseText": "",
                            "responseHeaders": "",
                            "error": "RADIUS_TOKEN_MISSING"
                        ]
                    }
                    req.setValue("Bearer \(radiusToken)", forHTTPHeaderField: "Authorization")
                }

                let sendsBody = currentMethod == "POST" ||
                    currentMethod == "PUT" ||
                    currentMethod == "PATCH"
                if sendsBody, let bodyText = currentBody {
                    req.httpBody = bodyText.data(using: .utf8) ?? Data()
                } else if sendsBody {
                    req.httpBody = Data()
                }

                let (data, httpRes) = try await performSingleRequest(req)
                let statusCode = httpRes.statusCode

                var stringHeaders: [String: String] = [:]
                var rawHeadersBuilder = ""
                for (k, v) in httpRes.allHeaderFields {
                    let kStr = String(describing: k)
                    let vStr = String(describing: v)
                    stringHeaders[kStr] = vStr
                    rawHeadersBuilder += "\(kStr): \(vStr)\r\n"
                }

                let newCookies = HTTPCookie.cookies(withResponseHeaderFields: stringHeaders, for: hopUrl)
                if !newCookies.isEmpty {
                    mergeCookies(newCookies, into: &workingCookies)
                    await persistCookies(newCookies)
                }

                if Self.redirectStatusCodes.contains(statusCode),
                   let location = httpRes.value(forHTTPHeaderField: "Location")?
                       .trimmingCharacters(in: .whitespacesAndNewlines),
                   !location.isEmpty,
                   hop < Self.maxRedirects,
                   let resolved = URL(string: location, relativeTo: hopUrl)?.absoluteURL
                {
                    currentUrl = resolved.absoluteString
                    if (statusCode == 301 || statusCode == 302 || statusCode == 303),
                       currentMethod != "GET",
                       currentMethod != "HEAD"
                    {
                        currentMethod = "GET"
                        currentBody = nil
                    }
                    hop += 1
                    continue
                }

                let cappedData = data.count > Self.maxResponseBytes
                    ? data.prefix(Self.maxResponseBytes)
                    : Data(data)
                let contentType = httpRes.value(forHTTPHeaderField: "Content-Type")
                let bodyText = decodeBody(Data(cappedData), contentType: contentType)

                return [
                    "ok": (200...399).contains(statusCode),
                    "status": statusCode,
                    "finalUrl": httpRes.url?.absoluteString ?? currentUrl,
                    "responseText": bodyText,
                    "responseHeaders": rawHeadersBuilder
                ]
            }

            return [
                "ok": false,
                "status": 0,
                "finalUrl": currentUrl,
                "responseText": "",
                "responseHeaders": "",
                "error": "TOO_MANY_REDIRECTS"
            ]
        } catch let urlErr as URLError where urlErr.code == .timedOut {
            return [
                "ok": false,
                "status": 0,
                "finalUrl": currentUrl,
                "responseText": "",
                "responseHeaders": "",
                "error": "TIMEOUT"
            ]
        } catch {
            return [
                "ok": false,
                "status": 0,
                "finalUrl": currentUrl,
                "responseText": "",
                "responseHeaders": "",
                "error": "NETWORK_ERROR"
            ]
        }
    }

    private func performSingleRequest(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        try await withCheckedThrowingContinuation { continuation in
            let task = session.dataTask(with: request) { data, response, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }
                guard let httpResponse = response as? HTTPURLResponse else {
                    continuation.resume(throwing: URLError(.badServerResponse))
                    return
                }
                continuation.resume(returning: (data ?? Data(), httpResponse))
            }
            task.resume()
        }
    }

    @MainActor
    private func fetchAllCookies() async -> [HTTPCookie] {
        let cookieStore = WKWebsiteDataStore.default().httpCookieStore
        return await withCheckedContinuation { continuation in
            cookieStore.getAllCookies { cookies in
                continuation.resume(returning: cookies)
            }
        }
    }

    @MainActor
    private func persistCookies(_ cookies: [HTTPCookie]) async {
        let cookieStore = WKWebsiteDataStore.default().httpCookieStore
        for cookie in cookies {
            await withCheckedContinuation { continuation in
                cookieStore.setCookie(cookie) {
                    continuation.resume()
                }
            }
        }
    }

    private func mergeCookies(_ newCookies: [HTTPCookie], into existing: inout [HTTPCookie]) {
        for incoming in newCookies {
            existing.removeAll { cur in
                cur.name == incoming.name &&
                    cur.domain.lowercased() == incoming.domain.lowercased() &&
                    cur.path == incoming.path
            }
            existing.append(incoming)
        }
    }

    private func decodeBody(_ data: Data, contentType: String?) -> String {
        guard !data.isEmpty else { return "" }
        if let contentType = contentType, !contentType.isEmpty {
            let range = NSRange(contentType.startIndex..<contentType.endIndex, in: contentType)
            if let match = Self.charsetRegex.firstMatch(in: contentType, options: [], range: range),
               match.numberOfRanges > 1,
               let csRange = Range(match.range(at: 1), in: contentType)
            {
                let ianaName = String(contentType[csRange]) as CFString
                let cfEnc = CFStringConvertIANACharSetNameToEncoding(ianaName)
                if cfEnc != kCFStringEncodingInvalidId {
                    let nsEnc = CFStringConvertEncodingToNSStringEncoding(cfEnc)
                    let strEnc = String.Encoding(rawValue: nsEnc)
                    if let decoded = String(data: data, encoding: strEnc) {
                        return decoded
                    }
                }
            }
        }
        return String(data: data, encoding: .utf8)
            ?? String(data: data, encoding: .isoLatin1)
            ?? ""
    }
}
