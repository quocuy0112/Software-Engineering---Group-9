import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    const scripts =
      process.env.NODE_ENV === "development"
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
        : "script-src 'self' 'unsafe-inline'";
    const csp = `default-src 'self'; ${scripts}; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'`;
    const globalHeaders = [
      { key: "Content-Security-Policy", value: csp },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
      ...(process.env.NODE_ENV === "production"
        ? [
            {
              key: "Strict-Transport-Security",
              value: "max-age=31536000; includeSubDomains",
            },
          ]
        : []),
    ];
    const noStore = [
      { key: "Cache-Control", value: "no-store, max-age=0" },
      { key: "Pragma", value: "no-cache" },
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
    ];
    return [
      { source: "/:path*", headers: globalHeaders },
      ...[
        "/verify-email",
        "/settings/:path*",
        "/two-factor/:path*",
        "/reset-password/:path*",
        "/account-recovery/:path*",
      ].map((source) => ({ source, headers: noStore })),
    ];
  },
};
export default nextConfig;
