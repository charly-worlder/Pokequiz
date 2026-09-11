# Pokémon Quiz — deutsche Namen

Ein Web-Quiz, in dem Spieler Pokémon am Bild erkennen und den richtigen **deutschen** Namen aus vier Optionen wählen. Jede richtige Antwort verlängert eine Serie, ein Fehler beendet den Lauf. Eine globale Weltrangliste macht aus dem Solo-Spiel einen Wettbewerb.

Warum es das gibt: Fast jedes Pokémon-Quiz im Netz fragt die **englischen** Namen ab — obwohl eine ganze Generation deutschsprachiger Fans ausschließlich „Glurak" und „Relaxo" kennt.

Gebaut als Praxisprüfung des **Accelerator-Kurses**, ausschließlich mit dem spec-getriebenen Workflow des AI Engineering Kits.

---

## Schnellstart

Getestet unter Windows 11 mit Node 24 und Docker Desktop. Linux und macOS funktionieren identisch.

**Voraussetzungen:** Node.js ≥ 20.9 (Anforderung von Next 16), Docker Desktop (läuft), Git.

```bash
git clone https://github.com/charly-worlder/Pokequiz.git
cd Pokequiz
npm install
```

**1. Supabase lokal starten** — lädt beim ersten Mal einige Container herunter, das dauert ein paar Minuten:

```bash
npx supabase start
```

Am Ende gibt der Befehl die Zugangsdaten der lokalen Instanz aus. Drei davon werden gleich gebraucht — je nach CLI-Version als Liste oder als JSON beschriftet:

| gebraucht wird | heißt in der Ausgabe |
|---|---|
| die API-Adresse | `API URL` bzw. `API_URL` |
| der öffentliche Schlüssel | `anon key` bzw. `ANON_KEY` |
| der Server-Schlüssel | `service_role key` bzw. `SERVICE_ROLE_KEY` |

Erneut abrufen lassen sie sich jederzeit mit `npx supabase status`.

**2. `.env.local` anlegen** — im Projektstammverzeichnis, mit genau diesen vier Zeilen:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key aus Schritt 1>
SUPABASE_SERVICE_ROLE_KEY=<service_role key aus Schritt 1>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

> **`SUPABASE_SERVICE_ROLE_KEY` trägt bewusst kein `NEXT_PUBLIC_`-Präfix.** Der Schlüssel hebt Row Level Security vollständig auf; mit dem Präfix würde Next.js ihn in das ausgelieferte JavaScript backen und an jeden Besucher ausliefern. Die vollständige Beschreibung jeder Variablen steht in `.env.local.example`.

**3. Datenbankschema anlegen** — spielt die 20 Migrationen aus `supabase/migrations/` ein:

```bash
npx supabase db reset
```

**4. Starten:**

```bash
npm run dev
```

→ **http://localhost:3000**

Es gibt **keine E-Mail-Bestätigung** bei der Registrierung. Eine erfundene Adresse wie `test@example.com` genügt, Passwort mindestens 8 Zeichen. Danach kann sofort gespielt werden.

### Passwort-Reset testen

Die Mail wird **nicht versendet**, sondern von Mailpit abgefangen, das mit `supabase start` mitläuft:

→ **http://localhost:54324**

Dort liegt die Nachricht mit dem Reset-Link. Ein echter Versand bräuchte einen eigenen SMTP-Dienst und eine verifizierte Absenderdomain — siehe `features/INDEX.md` → Deploy-Blocker.

### Auf dem Handy testen

Der Dev-Server ist im lokalen Netz erreichbar, die Ausgabe von `npm run dev` nennt die Adresse unter „Network". Damit Next die Anfragen nicht als fremden Ursprung blockiert, muss diese IP in `next.config.ts` unter `allowedDevOrigins` stehen — dort ist aktuell `192.168.0.165` eingetragen und muss gegen die eigene getauscht werden.

---

## Zum Supabase-Setup

**Die Entwicklung läuft gegen eine lokale Supabase-Instanz in Docker.** Das ist die in `docs/PRD.md` festgelegte Environment-Strategie (`local`) und der Weg, den die Anleitung oben beschreibt.

**Zusätzlich existiert ein kostenloses Supabase-Cloud-Projekt** (`Pokequiz-PRO`, Region eu-central-1 / Frankfurt). Es trägt seit dem 2026-09-11 dasselbe Schema, eingespielt mit `supabase db push` — vier Tabellen mit Row Level Security, alle Trigger, `pg_cron`. Verifiziert über einen Schema-Dump, nicht über die Erfolgsmeldung des Befehls.

**Die App verbindet sich zur Laufzeit nicht dorthin**, und das ist Absicht. Für einen Prüfer ist die lokale Variante die vollständigere: Der Passwort-Reset funktioniert dort über Mailpit, während der eingebaute Versand eines Free-Tier-Projekts nur an Adressen im Projektteam zustellt — bei 2 Mails pro Stunde. Umgeschaltet würde allein über `NEXT_PUBLIC_SUPABASE_URL`; einen Schalter im Code gibt es nicht.

---

## Was das Produkt kann

| Feature | Beschreibung | Spec |
|---|---|---|
| **PROJ-1** — Benutzerkonto & Login | Registrierung und Anmeldung per E-Mail/Passwort, eindeutiger Trainername als öffentlicher Anzeigename, Passwort-Reset, zweiteilige Missbrauchs-Drosselung je Verbindung und je Konto | [spec](features/PROJ-1-user-login/spec.md) |
| **PROJ-2** — Pokémon-Quiz | Eine **serverseitig geführte** Runde: Der Server vergibt die Fragen, prüft die Antworten, zählt die Serie und misst die Zeit. Bilder und deutsche Namen kommen von der PokeAPI | [spec](features/PROJ-2-pokemon-quiz/spec.md) |
| **PROJ-3** — Weltrangliste | Globale Top-5 nach Serie absteigend, bei Gleichstand nach Zeit aufsteigend, mit dem eigenen Ergebnis auch außerhalb der Top-5 | [spec](features/PROJ-3-leaderboard/spec.md) |
| **PROJ-4** — Kontolöschung | Kontobereich `/account` mit allem, was gespeichert ist, und der endgültigen Löschung samt Runden und Ranglisteneintrag (Art. 15 und 17 DSGVO) | [spec](features/PROJ-4-account-deletion/spec.md) |

Status aller Features: [`features/INDEX.md`](features/INDEX.md).

### Zuordnung zu den Prüfungsanforderungen

- **Feature 1 (Pflicht) — Sign-up und Login über Supabase, Row Level Security:** PROJ-1. RLS ist auf **vier** Tabellen aktiv (`profiles`, `runs`, `active_runs`, `auth_throttle`).
- **Feature 2 (Pflicht) — Integration zu einem externen Tool:** die **PokeAPI**, ohne Schlüssel und kostenlos. Im Vertrag als **PROJ-2, AC-20 und AC-31**. Die Anfragen stellt der Server, nicht der Browser: Sonst ginge bei jeder Frage die IP eines Spielers an ein Nicht-EU-CDN. Bereits Abgerufenes wird zwischengespeichert, wie es die Fair-Use-Policy der API verlangt.
- **Feature 3 (frei) — der eigentliche Nutzen:** PROJ-2, das Quiz selbst. PROJ-3 und PROJ-4 sind darüber hinausgegangen.

PROJ-2 trägt **42 Akzeptanzkriterien** statt der empfohlenen 8–12. Der Grund steht im Decision Log: Die erste Fassung führte die Runde im Browser, und ein einziger manipulierter Aufruf trug eine Serie von 386 in die Rangliste ein (BUG-19). `/refine PROJ-2` hat den Vertrag daraufhin auf eine serverseitig geführte Runde umgestellt — das kostete AC-32 bis AC-43.

---

## Technik

| | |
|---|---|
| **Framework** | Next.js 16 (App Router), React 19, TypeScript |
| **Styling** | Tailwind CSS 4 + shadcn/ui |
| **Backend** | Supabase — PostgreSQL, Auth, Row Level Security |
| **Validierung** | Zod + react-hook-form |
| **Tests** | Vitest (Unit) · Playwright (E2E, drei Engines) |
| **Externe Datenquelle** | PokeAPI (kein API-Key) |

### Befehle

```bash
npm run dev        # Entwicklungsserver auf localhost:3000
npm run build      # Produktions-Build
npm run lint       # ESLint
npm test           # Unit-Tests (Vitest)
npm run test:e2e   # E2E-Tests (Playwright) — startet den Dev-Server selbst
npm run test:all   # beides nacheinander
```

Für `npm run test:e2e` müssen die Browser einmalig installiert werden: `npx playwright install`. Die Suite läuft in Chromium, Firefox und Mobile Safari.

Stand des letzten vollständigen Laufs: **Lint 0 · TypeScript 0 · Unit 316/316 · Build erfolgreich · E2E 203 bestanden, 1 übersprungen** (ein dokumentierter WebKit-Fall, festgehalten in `features/PROJ-4-account-deletion/qa-report.md`).

---

## Wie dieses Projekt entstanden ist

Ausschließlich über den spec-getriebenen Workflow des AI Engineering Kits. Jedes Feature hat denselben Weg genommen:

```
/write-spec  →  /architecture  →  /tasks  →  /build  →  /qa
```

Pro Feature liegen vier Artefakte in `features/PROJ-X-name/`:

| Datei | Inhalt |
|---|---|
| `spec.md` | der Vertrag — Akzeptanzkriterien mit stabilen IDs (`AC-1`, `AC-2`, …) und Edge Cases. Während `/build` **read-only** |
| `design.md` | der technische Entwurf samt Decision Log |
| `tasks.md` | die geordnete Aufgabenliste, jede Aufgabe auf AC-IDs abgebildet |
| `qa-report.md` | der Prüfbericht, gegen dieselben AC-IDs |

Die Kette **AC → Task → Test** ist über alle vier Features lückenlos. Verifiziert wurde von `qa-engineer`-Subagenten in Kontexten, die den Bau nicht kannten — bei PROJ-4 in fünf Durchgängen mit je drei unabhängigen Bahnen.

**Die QA-Berichte sind kumulativ:** Ältere Durchgänge bleiben unverändert stehen, samt ihrer offenen Kästchen. Gültig ist immer der **unterste** Abschnitt. Ein Bericht, der nachträglich grün geschrieben wird, wäre nichts mehr wert.

Bekannte, bewusst getragene Restrisiken und die offenen Punkte vor einem echten Livegang stehen gesammelt in [`features/INDEX.md`](features/INDEX.md) → Deploy-Blocker.

> **Impressum und Datenschutzerklärung tragen Platzhaltertext.** Die App geht vorerst nicht live; jede fehlende Angabe ist auf den Seiten sichtbar markiert. Vor einem öffentlichen Start müssen sie zwingend ersetzt werden — ein unvollständiges Impressum ist nach DDG abmahnfähig, und eine Datenschutzerklärung mit Platzhaltern erfüllt Art. 13 DSGVO nicht.

---

## Rechtliches

Nicht-kommerzielles Fan-Projekt. **Pokémon** sowie die Namen und Abbildungen der Pokémon sind Marken bzw. urheberrechtlich geschützte Werke ihrer jeweiligen Inhaber (Nintendo, Creatures Inc., GAME FREAK Inc., The Pokémon Company). Es besteht keine Verbindung zu diesen Unternehmen.

Das AI Engineering Kit, mit dem dieses Projekt gebaut wurde, stammt von **Alex Sprogis** ([YouTube](https://www.youtube.com/@alex.sprogis) · [Website](https://alexsprogis.de)) und steht unter MIT-Lizenz.
