import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

// Only wrap with Sentry in production builds to avoid breaking Turbopack HMR in dev
const isDev = process.env.NODE_ENV !== "production";

export default isDev
  ? nextConfig
  : withSentryConfig(nextConfig, {
      silent: true,
      disableLogger: true,
    });
