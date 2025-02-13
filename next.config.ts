import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // compiler: {
  //   removeConsole: true,
  // },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
