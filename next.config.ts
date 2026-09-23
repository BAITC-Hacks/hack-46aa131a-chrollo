import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The repository lives under a home directory that can contain other lockfiles.
  turbopack: { root: process.cwd() },
};
export default nextConfig;
