import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "chat.aizeten.me",
      },
    ],
  },
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
// Remote bindings are stable in wrangler >= 4.36.0.
// Enable per-binding by setting `"remote": true` in wrangler.jsonc.
initOpenNextCloudflareForDev();
