import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const scripts = process.env.NODE_ENV === "production" ? "'self' 'unsafe-inline' https://cdn.plaid.com" : "'self' 'unsafe-inline' 'unsafe-eval' https://cdn.plaid.com";
    const csp = [`default-src 'self'`, `script-src ${scripts}`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' data: https:`, `connect-src 'self' ${api} https://*.plaid.com`, `frame-src https://cdn.plaid.com https://*.plaid.com`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`].join("; ");
    return [{ source: "/(.*)", headers: [
      { key: "Content-Security-Policy", value: csp },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ] }];
  },
};

export default nextConfig;
