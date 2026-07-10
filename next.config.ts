import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost:3000",
    "192.168.10.53:3000",
    "http://192.168.10.53:3000",
    "https://192.168.10.53:3000",
  ],
};

export default nextConfig;
