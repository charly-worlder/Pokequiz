# PROJ-1 — Tech Design

## Component Structure

```
/login (Route, App-Shell-Bereich "Anmeldung")
+-- AuthCard
    +-- LoginView (Standardansicht)
    |   +-- E-Mail-Feld, Passwort-Feld
    |   +-- "Passwort vergessen?"-Link -> wechselt zu ForgotPasswordView
    |   +-- Absenden-Button "Einloggen"
    |   +-- Fehlermeldung (falsche Zugangsdaten oder Sperre — AC-7, AC-8)
    |   +-- Umschalt-Link "Noch kein Konto? Registrieren" -> RegisterView
    +-- RegisterView
    |   +-- Trainername-Feld, E-Mail-Feld, Passwort-Feld
    |   +-- Link zur Datenschutzerklärung (AC-14)
    |   +-- Absenden-Button "Registrieren"
    |   +-- Fehlermeldung (Trainername vergeben / E-Mail vergeben / Validierung — AC-2, AC-3, EC-5)
    |   +-- Umschalt-Link "Schon ein Konto? Einloggen" -> LoginView
    +-- ForgotPasswordView
        +-- E-Mail-Feld
        +-- Absenden-Button "Link senden"
        +-- Bestätigungsmeldung, immer gleicher Wortlaut (AC-10, EC-3)
        +-- Zurück-Link -> LoginView

/reset-password (Route, nur über den E-Mail-Link erreichbar, nicht verlinkt)
+-- ResetPasswordForm (Client-Komponente — der Link liefert die Session nur im
    |   URL-Fragment, das ist serverseitig unsichtbar, siehe Technical Decisions)
    +-- "Link wird geprüft"-Zwischenzustand
    +-- Fehlermeldung, wenn der Link ungültig oder abgelaufen ist (AC-12)
    +-- Neues-Passwort-Feld
    +-- Absenden-Button "Passwort setzen"

Proxy (`src/proxy.ts`, kein UI, appweit — hieß bis Next.js 16 "Middleware")
+-- Sitzungsprüfung vor jeder Seite außer /login, /reset-password, /privacy, /imprint
```

**Schnittstelle zu PROJ-2:** Die Kopfzeile (Nutzer-Chip, „Abmelden") gehört zur App-Shell und damit zu PROJ-2 — sie ruft die `logout`-Aktion auf, die dieses Feature bereitstellt. PROJ-1 selbst rendert keine Kopfzeile.

## Data Model

```
profiles
- id            UUID, Primärschlüssel, identisch mit der zugehörigen auth.users-ID (1:1)
- trainer_name  Text, 3–20 Zeichen, nur a–z/A–Z/0–9/_, Pflichtfeld, eindeutig unabhängig von
                Groß-/Kleinschreibung, nach dem Anlegen nie mehr änderbar
- created_at    Zeitstempel, automatisch beim Anlegen gesetzt

Besitz: gehört dem zugehörigen Auth-Konto. Entsteht automatisch über einen Datenbank-Trigger beim
Registrieren (liest den bei der Registrierung übergebenen Trainernamen); die Anwendung legt nie
selbst eine Zeile an.

Zugriff:
- Lesen: jeder eingeloggte Nutzer darf trainer_name aller Profile lesen (Grundlage der Weltrangliste,
  PROJ-3). Ausgeloggte Besucher sehen keine Profile.
- Schreiben/Ändern/Löschen: niemand über die Anwendung — nur der anlegende Trigger schreibt einmalig.

Aufbewahrung: bis zur Kontolöschung (Löschmechanismus folgt in PROJ-4).
```

```
auth.users (von Supabase Auth verwaltet, keine eigene Tabelle dieses Features)
- E-Mail-Adresse, Passwort (ausschließlich gehasht), Anmelde-Zeitstempel, IP-Adressen der
  Auth-Anfragen — Supabase-Auth-Standardfelder.
- Der bei der Registrierung eingegebene Trainername wird als Nutzer-Metadata mitgeschickt und vom
  Trigger gelesen, lebt danach ausschließlich in profiles.

Aufbewahrung: bis zur Kontolöschung (PROJ-4).
```

## Behaviors & Access

```
Registrieren (Server Action, öffentlich)
- Serverseitig geprüft: E-Mail-Format, Passwort ≥ 8 Zeichen, Trainername 3–20 Zeichen /
  a-z,A-Z,0-9,_ — bevor überhaupt ein Auth-Aufruf stattfindet
- Legt ein Auth-Konto an, im selben Schritt (Trigger) ein profiles-Eintrag mit dem Trainernamen
- Erfolg: Sitzung wird sofort gesetzt, Weiterleitung zu / — keine E-Mail-Bestätigung nötig
- Abgelehnt, wenn: E-Mail bereits registriert (AC-3) · Trainername bereits vergeben, auch bei
  abweichender Groß-/Kleinschreibung (AC-2, EC-1) · ein Pflichtfeld fehlt oder ist ungültig
  (AC-13, EC-5)

Einloggen (Server Action, öffentlich)
- Ruft Supabase Auth direkt auf; die IP-basierte Drosselung (AC-8, EC-4) läuft vollständig in
  Supabase, kein eigener Zähler in der Anwendung. Lokal ließ sich dieses Limit nicht auslösen
  (siehe Technical Decisions) — vor Launch gegen das gehostete Projekt erneut prüfen
- Erfolg: Sitzung wird gesetzt, Weiterleitung zu /
- Abgelehnt, wenn: IP-Limit erreicht (AC-8, EC-4) · Zugangsdaten falsch oder E-Mail unbekannt — in
  beiden Fällen dieselbe Meldung (AC-7)

Passwort-Reset anfordern (Server Action, öffentlich)
- Nimmt eine E-Mail-Adresse entgegen, löst unabhängig von ihrer Existenz denselben Ablauf und
  dieselbe Bestätigungsmeldung aus (AC-10, EC-3)
- Existiert ein Konto zu dieser Adresse, verschickt Supabase Auth den Reset-Link zu /reset-password

Neues Passwort setzen (Client-Komponente + Server Action, nur mit gültiger Recovery-Sitzung)
- /reset-password prüft die Sitzung ausschließlich clientseitig: Der E-Mail-Link liefert die
  Tokens ausschließlich im URL-Fragment (#access_token=... oder #error=...), das ein Server nie
  sieht — der Browser-Supabase-Client erkennt es selbst (detectSessionInUrl, Standard) und setzt
  die Sitzung als Cookie, bevor das Formular erscheint
- Erfolg: Passwort wird geändert (≥ 8 Zeichen, AC-11), die Server Action prüft die Sitzung
  serverseitig zusätzlich (Verteidigung in der Tiefe), Weiterleitung zu /
- Abgelehnt, wenn: das Fragment einen Fehler trägt oder nach der Prüfung keine Sitzung besteht —
  Fehlermeldung statt Formular, mit der Möglichkeit einen neuen Link anzufordern (AC-12)

Abmelden (Server Action, nur eingeloggt)
- Beendet die Sitzung, Weiterleitung zu /login (AC-6). Wird von PROJ-2s Kopfzeile aufgerufen.

Routenschutz (Proxy `src/proxy.ts`, appweit)
- Vor jeder Seite außer /login, /reset-password, /privacy, /imprint: keine gültige Sitzung ->
  Weiterleitung zu /login (EC-2). Gültige Sitzung auf /login -> Weiterleitung zu /.
```

## Dependencies

- `@supabase/ssr` — serverseitiger Supabase-Client mit Cookie-Sitzungen für Next.js Server Actions und den Proxy
- `zod` (bereits vorhanden) — serverseitige Validierung von E-Mail, Passwort und Trainername an der Server-Action-Grenze
- `react-hook-form`, `@hookform/resolvers` (bereits vorhanden) — Formular-State und Client-Feedback für Login-, Registrierungs- und Reset-Formulare
- shadcn/ui `Card`, `Form`, `Input`, `Label`, `Button` (bereits vorhanden) — keine neuen UI-Komponenten nötig

## Settings the user makes

| Setting | Where | Value | Why | → AC |
| --- | --- | --- | --- | --- |
| Passwort-Mindestlänge | Supabase Dashboard → Authentication → Sign In / Providers → Email | Minimum password length: 8 | Erzwingt die zugesagte Mindestlänge serverseitig, nicht nur im Formular | AC-1, AC-11 |
| Login-/Signup-Rate-Limit (`sign_in_sign_ups`) | Supabase Dashboard → Authentication → Rate Limits | Standardwert belassen (30 Versuche / 5 Minuten pro IP); nach dem ersten Deploy dort live gegen echte wiederholte Login-Versuche prüfen | Einziger Schutz gegen automatisiertes Durchprobieren — bewusst kein App-eigener Zähler (siehe Technical Decisions); lokal ließ sich das Limit nicht auslösen | AC-8, EC-4 |
| Leaked-Password-Schutz | Supabase Dashboard → Authentication → Attack Protection | Bewusst aus | Reaktiv statt präventiv (siehe Technical Decisions); zusätzlich ein Paid-Plan-Feature | — |
| Lokaler Spiegel der Passwort-Mindestlänge | `supabase/config.toml` → `[auth]` | `minimum_password_length = 8` (bereits gesetzt) | Damit `/qa` und die lokale Entwicklung gegen dieselbe Regel laufen wie später produktiv | AC-1, AC-11 |
| Site URL & Redirect URLs | Supabase Dashboard → Authentication → URL Configuration | Site URL auf die echte Produktions-Domain setzen, Redirect URLs um `https://<domain>/**` erweitern | Ohne das bricht der Passwort-Reset-Link in Produktion genauso, wie er es hier lokal tat (siehe Technical Decisions) — geprüft mit demselben Verfahren wie AC-8, direkt nach dem ersten Deploy | AC-11, AC-12 |

## Technical Decisions

| Decision | Rationale | Alternative considered | Trade-off | Date |
| --- | --- | --- | --- | --- |
| `@supabase/ssr`-Server-Action-Muster statt clientseitigem Formular | Hält Zugangsdaten aus der URL, POST ist durch das Muster erzwungen (siehe `.claude/rules/security.md`) | Client-seitiger `fetch`-Aufruf mit `preventDefault()` | Etwas weniger SPA-Interaktivität | 2026-08-31 |
| Kein App-eigener Login-Drosselzähler — AC-8 läuft ausschließlich über Supabases eingebaute IP-Regel (`sign_in_sign_ups`, Standard 30 / 5 Min) | Bewusste produkttypische Entscheidung: reaktiv nachrüsten, wenn tatsächlicher Missbrauch auftritt, statt präventiv eine zweite, kontobezogene Drosselung zu bauen (Product Decision, siehe `spec.md`) | Upstash-Redis-Zähler pro E-Mail-Adresse (5 Versuche / 15 Min) | Ein über viele IPs verteilter Angriff auf ein einzelnes Konto bleibt ungebremst; keine kontospezifische Sperrmeldung — akzeptiertes Risiko fürs MVP | 2026-08-31 |
| Eindeutigkeit des Trainernamens per Unique-Index auf die kleingeschriebene Form, durchgesetzt im selben Trigger, der das Profil anlegt | Trigger läuft in derselben Transaktion wie das Anlegen des Auth-Kontos — ein Konflikt lässt die gesamte Registrierung fehlschlagen, kein halb angelegtes Konto (EC-1) | Nur clientseitige Prüfung vor dem Absenden | Die Anwendung muss den DB-Fehler abfangen und dem Trainername-Feld statt einem generischen Fehler zuordnen | 2026-08-31 |
| Globaler Proxy (`src/proxy.ts`) schützt alle Routen außer `/login`, `/reset-password`, `/privacy`, `/imprint` | Setzt die in `docs/app-shell.md` festgelegte Auth-Zustände-Regel durch, bevor PROJ-2/PROJ-3 überhaupt existieren. Next.js 16 hat die Datei-Konvention von `middleware.ts` (Projektwurzel) zu `src/proxy.ts` mit exportierter Funktion `proxy` umbenannt — `docs/stacks/framework-nextjs.md` spricht noch von "middleware.ts" und ist an dieser Stelle veraltet; verifiziert gegen die installierte Next.js-Version (16.3.3) und die offizielle Migrationsdoku | Jede Seite prüft ihre Sitzung selbst | Neue öffentliche Routen (z. B. spätere Seiten) müssen bewusst zur Ausnahmeliste hinzugefügt werden | 2026-08-31 |
| Kein App-eigener Test für AC-8 (Rate-Limit), obwohl empirisch geprüft | 150 aufeinanderfolgende Fehlversuche gegen die lokale Supabase-Instanz lösten nie ein 429 aus — `docker exec ... env` zeigt, dass die lokale Auth-Container-Konfiguration `GOTRUE_RATE_LIMIT_SIGN_IN_SIGN_UPS` gar nicht setzt, obwohl `supabase/config.toml` den Wert enthält (alle anderen Rate-Limit-Variablen sind gesetzt). Sieht nach einer Lücke im lokalen Supabase-CLI-Stack aus, nicht nach einem Fehler in diesem Feature | Eigenen App-Level-Zähler nachrüsten, um es lokal beweisbar zu machen | AC-8 ist damit nur gegen das gehostete Projekt nach `/deploy` wirklich verifizierbar, nicht lokal — als Open Question in `spec.md` nachgetragen. **Verifizierungsplan:** direkt nach dem ersten `/deploy` mit einem kleinen Wegwerf-Skript ca. 35 falsche Login-Versuche gegen die öffentliche Projekt-URL + den öffentlichen anon key schicken (dieselbe Methode wie hier lokal benutzt) und prüfen, ob ein 429 zurückkommt. Braucht keine Vorbereitung — beide Werte sind ohnehin öffentlich (sie stecken im ausgelieferten Browser-Bundle). Löst hosted es weiterhin nicht aus, wird die Upstash-Drosselung aus Alternative considered doch nachgerüstet, statt es unverifiziert zu lassen | 2026-08-31 |
| Proxy nutzt `getClaims()` statt `getUser()` zur Sitzungsprüfung | `getUser()` validiert bei jedem Request über einen Netzwerk-Roundtrip gegen Supabase Auth — genau das rät die offizielle Next.js-16-Doku für Proxy/Middleware ab ("avoid database checks... Proxy runs on every route, including prefetched ones"). Dieses Projekt signiert JWTs asymmetrisch (ES256, verifiziert gegen die lokale Instanz), `getClaims()` prüft die Signatur lokal ohne Netzwerk-Roundtrip und aktualisiert bei Bedarf trotzdem den Refresh-Token — deckungsgleich mit Supabases eigenem "Middleware-First"-Muster aus der `@supabase/ssr`-Doku. Per Playwright-Testlauf gegen den echten Login-Flow verifiziert (beide Redirect-Richtungen funktionieren) | `getUser()` beibehalten | Keiner — `getClaims()` ist hier strikt besser: schneller (kein Netzwerk-Call) und trotzdem eine echte kryptografische Prüfung, keine bloße Cookie-Vertrauensannahme. Die eigentliche Autorität bleiben ohnehin RLS und die Seiten-/Server-Action-eigenen `getUser()`-Aufrufe | 2026-08-31 |
| Kein CAPTCHA bei der Registrierung im MVP | Bewusste produkttypische Entscheidung: reaktiv nachrüsten, wenn tatsächlich automatisierter Missbrauch auftritt, statt präventiv zu bauen — unabhängig von der geringen erwarteten Nutzerzahl (Product Decision, siehe `spec.md`) | CAPTCHA von Anfang an bauen | Registrierung bleibt bis zu einer Nachrüstung offen für Skripte; die 5/15-Min-Login-Sperre (AC-8) schützt nur den Login, nicht die Kontoerstellung selbst | 2026-08-31 |
| Leaked-Password-Schutz (HaveIBeenPwned) bewusst nicht aktiviert | Dieselbe reaktive Logik; zusätzlich ein Paid-Plan-Feature bei Supabase, Projekt hat kein Budget über kostenlose Tiers hinaus (`docs/PRD.md` → Rahmenbedingungen) | Aktivieren und Kosten tragen | Passwörter aus bekannten Datenlecks werden nicht abgefangen | 2026-08-31 |
| Nach erfolgreichem Passwort-Reset wird der Nutzer direkt eingeloggt statt zu `/login` zurückgeschickt | Die von Supabase erzeugte Recovery-Sitzung ist bereits eine gültige Sitzung; ein Zwischenschritt wäre reine Reibung | Zu `/login` umleiten und erneuten Login verlangen | Wer den Link auf einem fremden Gerät öffnet, ist dort automatisch eingeloggt, bis er sich abmeldet | 2026-08-31 |
| `/reset-password` prüft die Recovery-Sitzung clientseitig (`getSession()` im Browser-Client) statt über einen Server-Route-Handler; `src/app/auth/confirm/route.ts` (ursprünglich gebaut) wieder entfernt | Gegen die lokale Instanz mit zwei verschiedenen Aufrufern nachvollzogen — **das Ergebnis hängt davon ab, wer `resetPasswordForEmail` aufruft**: Ein rohes `supabase-js`-Skript ohne `@supabase/ssr` erzeugte einen Link, der mit den Tokens im **URL-Fragment** weiterleitet (`#access_token=...`, bzw. bei Fehler `#error=...`); derselbe Aufruf über unsere echte `requestPasswordResetAction` (unser Server-Client aus `@supabase/ssr`, der standardmäßig PKCE nutzt) erzeugte stattdessen einen Link mit `?code=...`. Ein Fragment erreicht den Server nie, ein Route Handler mit `exchangeCodeForSession(code)` hätte also im ersten Fall nichts zu sehen bekommen. Der Browser-Client löst beide Fälle transparent: `detectSessionInUrl` (Standard an) erkennt sowohl das Fragment als auch `?code=` und stellt die Sitzung her, ganz ohne dass unser Code wissen muss, welche Form gerade vorliegt — genau deshalb ist die clientseitige Prüfung robuster als ein Route Handler, der sich auf eine bestimmte Form festlegen müsste | Server-Route-Handler mit `exchangeCodeForSession` (ursprünglicher Ansatz — funktioniert nur für die `?code=`-Form, per Playwright-Test bestätigt; wäre für die Fragment-Form blind gewesen) | **Diese Lösung hängt von der aktuellen lokalen `flow_type`-Konfiguration ab und muss nach dem ersten Cloud-Deploy erneut verifiziert werden** (zusammen mit dem AC-8-Rate-Limit-Test) — weicht die Cloud-Standardeinstellung ab, könnte derselbe Bug in anderer Form zurückkommen. Die clientseitige Lösung federt genau dieses Risiko ab, da sie beide Formen abdeckt, statt sich auf eine festzulegen | 2026-08-31 |
| `additional_redirect_urls` in `supabase/config.toml` auf `["http://127.0.0.1:3000/**", "http://localhost:3000/**"]` erweitert (Wildcards) | Der ursprüngliche Wert (`https://127.0.0.1:3000`, falsches Schema, aus dem Scaffold übernommen und nie an dieses Feature angepasst) deckte unsere tatsächliche `redirectTo`-URL nicht ab. Zusätzlich verglich GoTrues eigener Fast-Path (`site_url`-Vergleich) den Hostnamen **wörtlich** — `localhost` und `127.0.0.1` gelten als verschieden, obwohl beide auf denselben Loopback zeigen. Ohne Treffer im Fast-Path **und** in der Allow-List verwarf Supabase unsere `redirectTo`-Adresse still und fiel auf `site_url` (`/`) zurück — dort bestand keine Sitzung, der Proxy schickte auf `/login`. Genau das vom Nutzer beobachtete Symptom, gegen die lokale Instanz nachgestellt und mit dem Fix behoben (E-Mail-Link zeigt jetzt korrekt auf `/reset-password`) | `site_url` selbst auf `localhost` ändern | Deckt nur die lokale Entwicklung ab. **Muss beim ersten `/deploy` im Supabase-Dashboard des gehosteten Projekts (Authentication → URL Configuration) auf die echte Produktions-Domain gesetzt werden** — sonst tritt exakt dieser Bug dort erneut auf, nur mit der Produktions-URL statt `localhost` | 2026-08-31 |

## Open Questions
- Keine — alle im Interview offenen Punkte sind in `spec.md` → Open Questions erfasst (betreffen Recht/Deploy, nicht die Technik dieses Designs).
