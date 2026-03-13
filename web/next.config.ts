import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "https://accounts.atomic.fun",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
        ],
      },
    ];
  },
};

// Only wrap with Sentry in production builds to avoid breaking Turbopack HMR in dev
const isDev = process.env.NODE_ENV !== "production";

export default isDev
  ? withNextIntl(nextConfig)
  : withSentryConfig(withNextIntl(nextConfig), {
      silent: true,
      disableLogger: true,
    });
