import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost:3000",
    "192.168.10.53:3000",
    "http://192.168.10.53:3000",
    "https://192.168.10.53:3000"
  ],
  turbopack: {
    resolveAlias: {
      // mind-ar's dist bundle statically `require("fs")` for its Node-side
      // offline compiler, which is never executed in the browser. Alias it to
      // an empty stub for browser builds so Turbopack can bundle it.
      fs: { browser: "./src/lib/fs-empty.js" }
    }
  }
};

export default withSerwist(nextConfig);
