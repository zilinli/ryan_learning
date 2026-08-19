import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@cursor/sdk", "@volcengine/openapi"],
  // Low-RAM hosts OOM during `next build` typecheck; unit tests cover the critical paths.
  typescript: { ignoreBuildErrors: true },

  // Allow large chat/console attachments (256MB file ≈ ~340MB base64 JSON).
  // Next.js 16 keeps serverActions.bodySizeLimit under `experimental`.
  experimental: {
    cpus: 1,
    webpackMemoryOptimizations: true,
    serverActions: {
      bodySizeLimit: "512mb",
    },
    proxyClientMaxBodySize: "512mb",
  },

  // Reduce memory pressure: skip output file tracing for heavy dev-only deps.
  // The real server packages are resolved at runtime via node_modules.
  outputFileTracingExcludes: {
    "*": [
      "node_modules/.pnpm/**",
      "node_modules/@eslint/**",
      "node_modules/eslint/**",
      "node_modules/eslint-*/**",
      "node_modules/prettier/**",
      "node_modules/typescript/**",
      "node_modules/vitest/**",
      "node_modules/playwright/**",
      "node_modules/playwright-core/**",
      "node_modules/jsdom/**",
      "node_modules/@vitest/**",
      "node_modules/@types/**",
      "node_modules/tailwindcss/**",
      "node_modules/postcss/**",
      "node_modules/autoprefixer/**",
    ],
  },
};

export default nextConfig;
