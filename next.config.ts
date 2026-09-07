import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Development only. Without this, opening the dev server over the machine's
  // LAN address (phone on the same Wi-Fi) makes Next block /_next/* as
  // cross-origin — the JavaScript never loads, and an un-hydrated form falls
  // back to a native submit. That is how BUG-4 was discovered. The `method`
  // attribute on the auth forms is the actual fix; this only removes one way of
  // triggering it and makes testing from a phone possible at all.
  allowedDevOrigins: ['192.168.0.165'],
  // **Kein `images`-Block mehr, seit dem 2026-09-06.**
  //
  // Bis dahin lieferte die Bild-Optimierung des Frameworks das Quizbild aus, und
  // `remotePatterns` schaltete dafür den Sprite-Host frei. Das erfüllte AC-20 (der
  // Browser fragt nur die eigene Domain), brach aber AC-32: Die Quell-Adresse steht
  // sichtbar in `/_next/image?url=…/official-artwork/25.png` — mit der Nummer darin.
  // Ein Skript in der Konsole liest sie, schlägt den deutschen Namen nach und klickt
  // richtig; der Server zählte eine echte Serie.
  //
  // Das Bild kommt jetzt aus `src/app/api/question/[token]/image/route.ts`, unter
  // einem Token statt einer Nummer. Die Freigabe hier zu belassen wäre nicht
  // folgenlos: Sie hielte den alten, nummernsichtbaren Weg offen und damit einen
  // zweiten, unbewachten Zugang an AC-32 vorbei — dieselbe Klasse wie BUG-22, wo
  // eine Freigabe ihren Grund überlebt hat.
  //
  // Der Zwischenspeicher wandert mit: Er liegt jetzt auf der `fetch`-Ebene in
  // `src/lib/pokeapi/client.ts` und hängt weiter an der CDN-Adresse, also an der
  // Pokémon-Nummer (AC-31, AC-37) — nicht am wechselnden Token.
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
