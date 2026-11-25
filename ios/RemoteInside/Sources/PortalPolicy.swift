import Foundation

enum PortalPolicy {
    private static let authHostPrefixRegex = try! NSRegularExpression(
        pattern: "^(iam|sso|login|auth|signin|oauth|cas|sts)[.-]",
        options: [.caseInsensitive]
    )
    private static let loginPathRegex = try! NSRegularExpression(
        pattern: "/(loginpage\\.aspx|account/login|auth/login|login(?:/|$))",
        options: [.caseInsensitive]
    )
    private static let loginTitleRegex = try! NSRegularExpression(
        pattern: "\\b(iam|sign\\s*in|đăng\\s*nhập|login)\\b",
        options: [.caseInsensitive, .useUnicodeWordBoundaries]
    )
    private static let explicitAuthHosts: Set<String> = [
        "iam.fpt.net",
        "login.microsoftonline.com",
        "login.microsoft.com",
        "login.live.com"
    ]

    static func isAllowedPortalHost(_ rawHost: String?) -> Bool {
        let host = (rawHost ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        guard !host.isEmpty else { return false }
        return host == "fpt.net" ||
            host.hasSuffix(".fpt.net") ||
            host == "fcam.vn" ||
            host.hasSuffix(".fcam.vn")
    }

    static func isAuthHost(_ rawHost: String?) -> Bool {
        let host = (rawHost ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        guard !host.isEmpty else { return false }
        if explicitAuthHosts.contains(host) ||
            host.hasSuffix(".iam.fpt.net") ||
            host.hasSuffix(".microsoftonline.com")
        {
            return true
        }
        let range = NSRange(host.startIndex..<host.endIndex, in: host)
        return authHostPrefixRegex.firstMatch(in: host, options: [], range: range) != nil
    }

    static func isLoginPath(_ rawPath: String?) -> Bool {
        let path = rawPath ?? ""
        guard !path.isEmpty else { return false }
        let range = NSRange(path.startIndex..<path.endIndex, in: path)
        return loginPathRegex.firstMatch(in: path, options: [], range: range) != nil
    }

    static func isAuthUrl(_ rawUrl: String?) -> Bool {
        guard let rawUrl = rawUrl?.trimmingCharacters(in: .whitespacesAndNewlines),
              !rawUrl.isEmpty,
              let url = URL(string: rawUrl)
        else {
            return false
        }
        return isAuthHost(url.host) || isLoginPath(url.path)
    }

    static func isTargetPortalUrl(_ rawUrl: String?, targetHost: String) -> Bool {
        let expected = targetHost.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard let rawUrl = rawUrl?.trimmingCharacters(in: .whitespacesAndNewlines),
              !rawUrl.isEmpty,
              !expected.isEmpty,
              let url = URL(string: rawUrl),
              let host = url.host?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
              !host.isEmpty
        else {
            return false
        }
        let hostMatches = host == expected || host.hasSuffix("." + expected)
        return hostMatches && !isAuthHost(host) && !isLoginPath(url.path)
    }

    static func matchesLoginTitle(_ title: String) -> Bool {
        guard !title.isEmpty else { return false }
        let range = NSRange(title.startIndex..<title.endIndex, in: title)
        return loginTitleRegex.firstMatch(in: title, options: [], range: range) != nil
    }

    static func extractRadiusAccessToken(from cookies: [HTTPCookie]) -> String {
        let now = Date()
        for cookie in cookies where cookie.name == "accesstoken_iam_radius" {
            if let expires = cookie.expiresDate, expires <= now {
                continue
            }
            let dom = cookie.domain.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            let domOk = dom == "radius-portal.fpt.net" ||
                dom == ".radius-portal.fpt.net" ||
                dom == ".fpt.net" ||
                dom == "fpt.net"
            guard domOk else { continue }
            let raw = cookie.value
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .trimmingCharacters(in: CharacterSet(charactersIn: "\""))
            guard !raw.isEmpty else { continue }
            return (raw.removingPercentEncoding ?? raw)
                .trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return ""
    }

    static func cookieHeader(for url: URL, from cookies: [HTTPCookie]) -> String {
        let host = (url.host ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !host.isEmpty else { return "" }
        let path = url.path.isEmpty ? "/" : url.path
        let isHttps = url.scheme?.lowercased() == "https"
        let now = Date()

        let matched = cookies.filter { cookie in
            if let expires = cookie.expiresDate, expires <= now {
                return false
            }
            if cookie.isSecure && !isHttps {
                return false
            }
            let dom = cookie.domain.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            guard !dom.isEmpty else { return false }
            let domainMatches: Bool
            if dom.hasPrefix(".") {
                let bare = String(dom.dropFirst())
                domainMatches = (host == bare || host.hasSuffix(dom))
            } else {
                domainMatches = (host == dom)
            }
            guard domainMatches else { return false }

            let cPath = cookie.path.isEmpty ? "/" : cookie.path
            if cPath != "/" {
                let normalizedPrefix = cPath.hasSuffix("/") ? cPath : cPath + "/"
                guard path == cPath || path.hasPrefix(normalizedPrefix) else {
                    return false
                }
            }
            return true
        }.sorted { lhs, rhs in
            lhs.path.count > rhs.path.count
        }

        return matched
            .map { "\($0.name)=\($0.value)" }
            .joined(separator: "; ")
    }

    static func jsQuote(_ value: String) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: [value], options: []),
              let raw = String(data: data, encoding: .utf8),
              raw.count >= 2
        else {
            return "\"\""
        }
        var inner = String(raw.dropFirst().dropLast())
        inner = inner
            .replacingOccurrences(of: "\u{2028}", with: "\\u2028")
            .replacingOccurrences(of: "\u{2029}", with: "\\u2029")
        return inner
    }
}
