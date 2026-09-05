import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Development only. Without this, opening the dev server over the machine's
  // LAN address (phone on the same Wi-Fi) makes Next block /_next/* as
  // cross-origin — the JavaScript never loads, and an un-hydrated form falls
  // back to a native submit. That is how BUG-4 was discovered. The `method`
  // attribute on the auth forms is the actual fix; this only removes one way of
  // triggering it and makes testing from a phone possible at all.
  allowedDevOrigins: ['192.168.0.165'],
  images: {
    // spec.md AC-20: the browser only ever requests /_next/image on our own
    // domain — Next fetches the sprite server-side and serves it back. That is
    // what keeps a player's IP address out of a non-EU CDN, and it is why this
    // is configuration rather than a hand-written proxy route
    // (design.md -> Technical Decisions).
    // Exactly one pattern, as narrow as the feature needs. A second, far wider
    // one used to sit here (`…/PokeAPI/**`), justified solely by EC-11's repair
    // path. EC-11 was dropped on 2026-09-04 and its code removed — the entry
    // stayed, and it was not decoration: it let /_next/image fetch and cache any
    // image file from any repository of the PokeAPI organisation, unauthenticated
    // (BUG-22, found independently by all three QA lanes). Removing code without
    // removing the configuration that only existed for it is how an allow-list
    // silently outlives its reason.
    remotePatterns: [
      new URL(
        "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/**"
      ),
    ],
    // spec.md AC-31: optimized sprites are kept for 31 days. Pokemon artwork
    // does not change, and the cache key is the image URL plus its size — no
    // user identity takes part in it (spec.md AC-28).
    minimumCacheTTL: 2678400,
  },
  logging: {
    // Makes the fetch cache observable at all: in development every outgoing
    // request is printed with its cache status. This is how /qa verifies AC-31
    // — see tasks.md -> Pruefhinweise. Development only; no effect in production.
    fetches: {
      fullUrl: true,
    },
  },
};

export default nextConfig;
