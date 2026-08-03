import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@cursor/sdk"],
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
