# Design-System

> **Quelle:** Claude-Design-Projekt `85b70f32-ae5c-49d3-9c9d-1c5ba89288c6`, Artboard `Quiz Pokémon v2.dc.html` (Richtung „Fangball · Premium", Runde 3). Importiert am 2026-08-30 via `claude_design` MCP.
>
> Die älteren Artboards `Quiz Wiesenfest`, `Quiz Nachtarena` und `Quiz Pokémon` sind verworfene Alternativen und **keine** Referenz. `support.js` ist die Canvas-Runtime von Claude Design und wird nicht portiert.
>
> Format: Tailwind v4 CSS-first (`src/app/globals.css`), HSL-Tripel in CSS-Variablen, Dark Mode über die `.dark`-Klasse. Werte gehören in `@layer base`.

## Ästhetische Richtung

Warm, hochwertig, Pokémon-nah — aber ohne die dicken schwarzen Outlines, die Fan-Projekte billig aussehen lassen. Tiefe entsteht durch weiche, weit gestreute Schatten und dünne Rahmen, nicht durch Konturen. Die Palette zitiert den Pokéball (Karmin/Weiß) und ergänzt ein tiefes Navy als Gegengewicht sowie Gold als Belohnungsfarbe.

## Farben

### Light (`:root`)

| Token | HSL | Hex | Verwendung |
|-------|-----|-----|------------|
| `--background` | `42 31% 94%` | `#F4F1EA` | Grundfläche (warmes Off-White, nie reines Weiß) |
| `--foreground` | `226 31% 13%` | `#171C2C` | Fließtext und Überschriften |
| `--card` | `0 0% 100%` | `#FFFFFF` | Karten, Panels, Antwort-Buttons |
| `--card-foreground` | `226 31% 13%` | `#171C2C` | Text auf Karten |
| `--primary` | `7 67% 47%` | `#C93B28` | Karmin — Haupt-Aktion, Serien-Zahl |
| `--primary-foreground` | `0 0% 100%` | `#FFFFFF` | Text auf Karmin (5,1:1) |
| `--secondary` | `224 42% 20%` | `#1E2A4A` | Navy — zweite Aktion, dunkle Panels |
| `--secondary-foreground` | `0 0% 100%` | `#FFFFFF` | Text auf Navy |
| `--accent` | `42 87% 55%` | `#F0B429` | Gold — Serien-Ladebalken, Trophäe, Rang 1 |
| `--accent-foreground` | `226 31% 13%` | `#171C2C` | Text auf Gold |
| `--muted` | `42 26% 93%` | `#F1EEE7` | Gedämpfte Fläche (Tasten-Chip A/B/C/D) |
| `--muted-foreground` | `223 13% 42%` | `#5C6478` | Sekundärtext, Labels, Overlines |
| `--destructive` | `7 67% 47%` | `#C93B28` | Falsche Antwort, Fehler |
| `--destructive-foreground` | `0 0% 100%` | `#FFFFFF` | Text auf Destructive |
| `--success` | `144 43% 43%` | `#3E9C63` | Richtige Antwort |
| `--success-foreground` | `0 0% 100%` | `#FFFFFF` | Text auf Success |
| `--border` | `40 10% 86%` | `#DEDCD7` | Rahmen (dünn, nie schwarz) |
| `--input` | `45 33% 98%` | `#FBFAF7` | Eingabefeld-Fläche |
| `--ring` | `7 71% 42%` | `#B7301F` | Fokus-Ring |

**Akzenttext auf hellem Grund** (`Bereit, …?`, `Global`, Rang 1, „Du"-Marker): `#B7301F` — 6,1:1 auf Weiß.

### Dark (`.dark`)

Die Canvas definiert kein Dark-Theme, hat aber bereits dunkle Panels (`#1B2540` → `#111829` mit Gold-Akzenten). Das Dark-Theme ist daraus abgeleitet — es ist keine Erfindung, sondern die vorhandene dunkle Fläche zum vollen Theme ausgebaut.

| Token | HSL | Hex | Anmerkung |
|-------|-----|-----|-----------|
| `--background` | `223 41% 11%` | `#111829` | Tiefes Navy, nie reines Schwarz |
| `--foreground` | `42 31% 94%` | `#F4F1EA` | Warmes Off-White, nie reines Weiß |
| `--card` | `224 41% 18%` | `#1B2540` | Angehobene Fläche |
| `--card-foreground` | `42 31% 94%` | `#F4F1EA` | |
| `--primary` | `9 75% 57%` | `#E4573F` | Karmin aufgehellt — 4,9:1 auf `--background` |
| `--primary-foreground` | `223 41% 11%` | `#111829` | |
| `--secondary` | `224 36% 22%` | `#242F4D` | |
| `--secondary-foreground` | `42 31% 94%` | `#F4F1EA` | |
| `--accent` | `42 87% 55%` | `#F0B429` | Gold trägt in Dark unverändert |
| `--accent-foreground` | `223 41% 11%` | `#111829` | |
| `--muted` | `224 36% 22%` | `#242F4D` | |
| `--muted-foreground` | `223 19% 71%` | `#A8B0C4` | |
| `--destructive` | `9 75% 57%` | `#E4573F` | |
| `--success` | `140 39% 49%` | `#4CAF6D` | |
| `--border` | `223 19% 22%` | `#2E3A44` | |
| `--input` | `224 41% 18%` | `#1B2540` | |
| `--ring` | `42 87% 55%` | `#F0B429` | Gold als Fokus auf Dunkel |

### Antwort-Zustände

Die vier Antwort-Buttons sind der zentrale Moment des Produkts. Ihre Zustände sind exakt festgelegt:

| Zustand | Fläche | Rahmen | Text | Tasten-Chip | Marke |
|---------|--------|--------|------|-------------|-------|
| Unbeantwortet | `#FFFFFF` | `--border` | `--foreground` | `#F1EEE7` / `#5C6478` | — |
| Richtig | `#EAF6ED` | `#3E9C63` | `#1E5B37` | `#3E9C63` / weiß | `✓` |
| Falsch gewählt | `#FCEDEA` | `#C93B28` | `#8E2A1F` | `#C93B28` / weiß | `✕` |
| Nicht gewählt (nach Antwort) | `#FAF8F4` | `--border` (halb) | `#8A91A3` | — | — |

## Typografie

**Outfit** (Google Fonts), Fallback `system-ui, sans-serif`. Gewichte 400 / 500 / 600 / 700 / 800. Einbindung über `next/font/google` — nicht per `<link>`, damit keine Anfrage an Google-Server aus dem Browser geht (DSGVO, siehe PROJ-4).

| Rolle | Größe | Gewicht | Laufweite |
|-------|-------|---------|-----------|
| Display (Hero) | `clamp(34px, 4.6vw, 56px)` | 700 | `-0.03em` |
| Seitentitel | `clamp(28px, 3.4vw, 40px)` | 700 | `-0.03em` |
| Abschnitt | `clamp(20px, 2.4vw, 28px)` | 700 | `-0.02em` |
| Kartentitel | `21px` | 700 | `-0.02em` |
| Fließtext | `15–18px` | 400 | normal, `line-height: 1.5` |
| UI / Button | `13–17px` | 600 | `-0.01em` |
| Kennzahl | `20–26px` | 700 | `-0.02em`, `tabular-nums` |
| Ergebnis-Zahl | `clamp(64px, 9vw, 104px)` | 700 | `-0.05em` |
| Overline / Label | `11–12px` | 600 | `0.14–0.18em`, `uppercase` |

Alle Zahlen, die sich live ändern (Uhr, Serie, Zeit, Rangliste), bekommen `font-variant-numeric: tabular-nums` — sonst springt das Layout bei jedem Tick.

Lange Zeilen: `text-wrap: balance` für Überschriften, `text-wrap: pretty` für Fließtext.

## Radius, Abstände, Tiefe

```css
--radius: 0.75rem;        /* 12px → rounded-lg; md = 10px, sm = 8px */
--radius-card: 1.375rem;  /* 22px — Karten, Quiz-Panel */
--radius-panel: 1.5rem;   /* 24px — große dunkle Flächen */
/* Pills und Avatare: 999px */
```

Eine Radius-Entscheidung, überall angewendet: Controls klein, Karten groß, Pills rund. Nichts dazwischen.

**Abstandsrhythmus:** `clamp()` durchgehend, damit Desktop und Handy dieselbe Datei teilen. Seitenpolsterung `clamp(18px, 4vw, 44px)`, vertikale Abstände `clamp(12px, 1.8vw, 22px)`.

**Tiefe entsteht durch Schatten, nicht durch Rahmen.** Rahmen sind dünn und fast transparent; die Trennung leistet der Schatten.

```css
--shadow-sm:      0 4px 14px -8px   rgb(23 28 44 / 0.40);
--shadow-md:      0 12px 26px -14px rgb(23 28 44 / 0.60);
--shadow-lg:      0 18px 46px -26px rgb(23 28 44 / 0.50);
--shadow-xl:      0 24px 60px -24px rgb(23 28 44 / 0.30);
--shadow-primary: 0 10px 24px -10px rgb(169 41 26 / 0.80);
--shadow-navy:    0 14px 32px -14px rgb(20 28 51 / 0.90);
```

## Komponenten-Konventionen

**Buttons** — vier Varianten, feste Mindesthöhen für Touch:

| Variante | Fläche | Höhe |
|----------|--------|------|
| `primary` | Verlauf `#C93B28 → #A9291A`, weißer Text, `--shadow-primary` | 48–52px |
| `secondary` | Verlauf `#1E2A4A → #141C33`, weißer Text, `--shadow-navy` | 46–52px |
| `outline` | `--card` mit `--border` | 40–46px |
| `ghost` | transparent, `--muted-foreground` | 40px |

Hover hebt um `translateY(-1px)` und verstärkt den Schatten. **Kein Verlauf ist flach:** jede Markenfläche hat Hover-, Active- und eine dezente Hintergrund-Variante.

**Eingabefelder:** Höhe 48px, Polsterung `13px 15px`, Radius `--radius`, Fläche `--input`. Fokus wechselt Rahmen auf `--ring` **und** Fläche auf `--card`.

**Fokus ist Pflicht, nicht Kür.** Jedes interaktive Element hat einen sichtbaren Hover- *und* Fokus-Zustand. Der Fokus-Ring (`--ring`, 2px, 2px Offset) darf nie wegoptimiert werden — Tastaturnutzer haben sonst nichts.

**Leerer Zustand:** zentriert, Pokéball-Motiv gedämpft, ein Satz in `--muted-foreground`, darunter die naheliegende Aktion als `primary`-Button.

**Ladezustand:** Skelettflächen in `--muted` mit sanftem Puls. Nie ein Spinner allein — das Quiz lädt Bilder von extern, und ein Skelett in Bildgröße verhindert das Springen des Layouts.

## Bewegung

Sieben Keyframes tragen das ganze Produkt. Alle respektieren `prefers-reduced-motion: reduce` — dort bleiben Zustandswechsel erhalten, Bewegung entfällt.

| Name | Zweck |
|------|-------|
| `in` | Screen-Eintritt, 0.4s ease-out, 10px von unten |
| `pop` | Richtige Antwort, neuer Rekord — kurzes Überschwingen auf 1.03 |
| `nudge` | Falsche Antwort — horizontales Rütteln, 0.4s |
| `float` | Pokéball auf dem Startscreen, 4.5s, endlos |
| `fall` | Konfetti bei persönlichem Rekord und Top-3 |
| `sheen` | Lichtstreifen über der Ranglisten-Fanfare, einmalig |
| `pulse` | Statuspunkt im Dex-Header |

## Zwei bewusste Abweichungen von der Canvas

**1. Dark Mode ergänzt.** Die Canvas ist ausschließlich hell. Dark Mode nachzurüsten bedeutet, jede Komponente zweimal anzufassen — deshalb steht er von Anfang an, abgeleitet aus den dunklen Panels, die die Canvas bereits enthält.

**2. Kontrast korrigiert.** Die Canvas nutzt `#8A91A3` für Labels und Sekundärtext. Auf Weiß erreicht das nur **2,9:1** und verfehlt die Anforderung von 4,5:1 deutlich — bei 11–12px Overlines ist das spürbar, nicht theoretisch. Sekundärtext ist deshalb auf `#5C6478` (5,9:1) gesetzt. `#8A91A3` bleibt zulässig für nicht-textliche Zwecke (Trennlinien, deaktivierte Antwortoptionen nach der Auflösung).

## Rechtlicher Hinweis zum Logo

Die Wortmarke besteht aus dem Wort „Pokémon" plus dem Zusatz „QUIZ"; das Ball-Motiv ist **in CSS selbst gezeichnet** (Verlauf, Mittellinie, Kreis) und ist kein offizielles Logo. Es dürfen keine offiziellen Pokémon-Logos, -Schriftzüge oder -Grafiken eingebunden werden. Pokémon ist eine geschützte Marke — dieses Projekt ist ein Fan-Quiz, und die Darstellung muss das erkennbar lassen.

---

_Dieses Dokument wird von `/build` gelesen, wenn Features implementiert werden. Änderungen an der visuellen Sprache gehören hierher, nicht in ein einzelnes `design.md`._
