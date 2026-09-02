import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Development only. Without this, opening the dev server over the machine's
  // LAN address (phone on the same Wi-Fi) makes Next block /_next/* as
  // cross-origin — the JavaScript never loads, and an un-hydrated form falls
  // back to a native submit. That is how BUG-4 was discovered. The `method`
  // attribute on the auth forms is the actual fix; this only removes one way of
  // triggering it and makes testing from a phone possible at all.
  allowedDevOrigins: ['192.168.0.165', '*.local'],
};

export default nextConfig;
