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

/auth/confirm (Server-Route, kein UI — Ziel des E-Mail-Links, ab 2026-09-03)
+-- verifyOtp({ type: 'recovery', token_hash }) -> setzt die Sitzung serverseitig
+-- Erfolg: Weiterleitung zu /reset-password · Fehler: zu /reset-password?error=1

/reset-password (Route, nur über /auth/confirm erreichbar, nicht verlinkt)
+-- Serverseitige Sitzungsprüfung (die Sitzung besteht bereits, siehe Technical Decisions)
    +-- Fehlermeldung, wenn der Link ungültig oder abgelaufen ist (AC-12)
    +-- ResetPasswordForm: Neues-Passwort-Feld
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

Reset-Link einlösen (Server-Route /auth/confirm, öffentlich — ab 2026-09-03)
- Der E-Mail-Link zeigt auf /auth/confirm?token_hash=...&type=recovery&next=/reset-password.
  Die Route ruft verifyOtp({ type, token_hash }) auf und setzt die Sitzung serverseitig als Cookie
- Der token_hash ist an das Konto gebunden, nicht an den anfordernden Browser — deshalb funktioniert
  der Link auf jedem Gerät (EC-7). Genau das konnte der alte Weg nicht: Er brauchte den
  code_verifier als Cookie auf dem anfordernden Gerät (BUG-6)
- Abgelehnt, wenn: token_hash fehlt, ungültig, abgelaufen oder bereits benutzt — Weiterleitung zu
  /reset-password mit Fehlerkennzeichnung (AC-12)

Neues Passwort setzen (Server-Komponente + Server Action, nur mit gültiger Recovery-Sitzung)
- /reset-password prüft die Sitzung serverseitig; sie besteht zu diesem Zeitpunkt bereits, weil
  /auth/confirm sie gesetzt hat. Kein clientseitiges Auslesen des URL-Fragments mehr
- Erfolg: Passwort wird geändert (≥ 8 Zeichen, AC-11), die Server Action prüft die Sitzung
  erneut (Verteidigung in der Tiefe), Weiterleitung zu /
- Abgelehnt, wenn: keine Sitzung besteht oder /auth/confirm einen Fehler gemeldet hat —
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
| E-Mail-Vorlage „Reset Password" | Supabase Dashboard → Authentication → Email Templates → Reset Password | Link auf `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password` setzen (identisch zur lokalen Vorlage in `supabase/templates/recovery.html`) | Ohne diese Vorlage verschickt das gehostete Projekt weiter den Standard-Link mit `?code=`, und BUG-6 ist in Produktion zurück — der Reset funktioniert dann nur auf dem anfordernden Gerät | AC-11, EC-7 |
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
| ⚠️ **ÜBERHOLT am 2026-09-03 durch BUG-6 — siehe die Zeile darunter.** `/reset-password` prüft die Recovery-Sitzung clientseitig (`getSession()` im Browser-Client) statt über einen Server-Route-Handler; `src/app/auth/confirm/route.ts` (ursprünglich gebaut) wieder entfernt | Gegen die lokale Instanz mit zwei verschiedenen Aufrufern nachvollzogen — **das Ergebnis hängt davon ab, wer `resetPasswordForEmail` aufruft**: Ein rohes `supabase-js`-Skript ohne `@supabase/ssr` erzeugte einen Link, der mit den Tokens im **URL-Fragment** weiterleitet (`#access_token=...`, bzw. bei Fehler `#error=...`); derselbe Aufruf über unsere echte `requestPasswordResetAction` (unser Server-Client aus `@supabase/ssr`, der standardmäßig PKCE nutzt) erzeugte stattdessen einen Link mit `?code=...`. Ein Fragment erreicht den Server nie, ein Route Handler mit `exchangeCodeForSession(code)` hätte also im ersten Fall nichts zu sehen bekommen. Der Browser-Client löst beide Fälle transparent: `detectSessionInUrl` (Standard an) erkennt sowohl das Fragment als auch `?code=` und stellt die Sitzung her, ganz ohne dass unser Code wissen muss, welche Form gerade vorliegt — genau deshalb ist die clientseitige Prüfung robuster als ein Route Handler, der sich auf eine bestimmte Form festlegen müsste | Server-Route-Handler mit `exchangeCodeForSession` (ursprünglicher Ansatz — funktioniert nur für die `?code=`-Form, per Playwright-Test bestätigt; wäre für die Fragment-Form blind gewesen) | **Diese Lösung hängt von der aktuellen lokalen `flow_type`-Konfiguration ab und muss nach dem ersten Cloud-Deploy erneut verifiziert werden** (zusammen mit dem AC-8-Rate-Limit-Test) — weicht die Cloud-Standardeinstellung ab, könnte derselbe Bug in anderer Form zurückkommen. Die clientseitige Lösung federt genau dieses Risiko ab, da sie beide Formen abdeckt, statt sich auf eine festzulegen | 2026-08-31 |
| **Passwort-Reset auf `token_hash` + `verifyOtp` in einer Server-Route umstellen** (ersetzt die überholte Zeile darüber) | Die Abwägung vom 2026-08-31 stellte zwei Optionen gegenüber — Tokens im URL-Fragment vs. `?code=` — und wählte die clientseitige Lösung, weil sie **beide Formen** abdeckt. Übersehen wurde, dass beide betrachteten Wege dieselbe Schwäche teilen: Sie brauchen Zustand **auf dem anfordernden Gerät**. Bei PKCE liegt der `code_verifier` als Cookie dort; wer den Link woanders öffnet, hat ihn nicht. Die clientseitige Lösung deckte also beide *Formen* ab, aber nur *ein Gerät* — und der ursprüngliche `exchangeCodeForSession`-Handler wäre an derselben Cookie-Bindung ebenso gescheitert, nur mit anderer Fehlermeldung. Der von Supabase für serverseitige Anwendungen empfohlene dritte Weg wurde nie geprüft: In der E-Mail-Vorlage `{{ .TokenHash }}` statt des Standard-Links, dazu eine Route, die `verifyOtp({ type: 'recovery', token_hash })` aufruft. Der braucht **kein** `code_verifier`-Cookie, ist damit an das Konto statt an den Browser gebunden und erfüllt EC-7 | Bei der clientseitigen Lösung bleiben und die Geräte-Bindung als Einschränkung dokumentieren — verworfen, weil AC-11 fremde Geräte nie ausgeschlossen hat (siehe Product Decision 2026-09-03) | Die E-Mail-Vorlage wird Teil der Konfiguration und muss im gehosteten Projekt erneut gesetzt werden (neuer `[user]`-Task T18). Dafür entfällt die Abhängigkeit von der `flow_type`-Einstellung, die die überholte Entscheidung ausdrücklich als offenes Risiko notiert hatte. Zusätzlich zu prüfen: Ob das Session-Cookie damit `HttpOnly` werden kann (BUG-13) — der Grund dagegen war, dass der Client die Sitzung selbst lesen musste, und der entfällt | 2026-09-03 |
| `additional_redirect_urls` in `supabase/config.toml` auf `["http://127.0.0.1:3000/**", "http://localhost:3000/**"]` erweitert (Wildcards) | Der ursprüngliche Wert (`https://127.0.0.1:3000`, falsches Schema, aus dem Scaffold übernommen und nie an dieses Feature angepasst) deckte unsere tatsächliche `redirectTo`-URL nicht ab. Zusätzlich verglich GoTrues eigener Fast-Path (`site_url`-Vergleich) den Hostnamen **wörtlich** — `localhost` und `127.0.0.1` gelten als verschieden, obwohl beide auf denselben Loopback zeigen. Ohne Treffer im Fast-Path **und** in der Allow-List verwarf Supabase unsere `redirectTo`-Adresse still und fiel auf `site_url` (`/`) zurück — dort bestand keine Sitzung, der Proxy schickte auf `/login`. Genau das vom Nutzer beobachtete Symptom, gegen die lokale Instanz nachgestellt und mit dem Fix behoben (E-Mail-Link zeigt jetzt korrekt auf `/reset-password`) | `site_url` selbst auf `localhost` ändern | Deckt nur die lokale Entwicklung ab. **Muss beim ersten `/deploy` im Supabase-Dashboard des gehosteten Projekts (Authentication → URL Configuration) auf die echte Produktions-Domain gesetzt werden** — sonst tritt exakt dieser Bug dort erneut auf, nur mit der Produktions-URL statt `localhost` | 2026-08-31 |

## Open Questions
- Keine — alle im Interview offenen Punkte sind in `spec.md` → Open Questions erfasst (betreffen Recht/Deploy, nicht die Technik dieses Designs).

---

## Nachtrag 2026-09-02 — BUG-3 und BUG-4 aus dem manuellen Test

**Der Proxy prüft die Sitzung jetzt mit `getUser()` statt `getClaims()`** (BUG-3). Die ursprüngliche Entscheidung für `getClaims()` war für sich richtig begründet — lokale Signaturprüfung ohne Netzwerkaufruf, wie es die Next-Doku für den Proxy empfiehlt. Sie wurde aber gefährlich, sobald PROJ-2 in `page.tsx` eine zweite, strengere Prüfung mit `getUser()` einführte: Eine widerrufene Sitzung besteht die Signaturprüfung weiterhin und fällt bei der Serverprüfung durch, also schickten sich Proxy und Seite gegenseitig im Kreis (`ERR_TOO_MANY_REDIRECTS`, 19 Weiterleitungen).

Es gibt jetzt **genau eine maßgebliche Quelle** für den Anmeldestatus, und das ist der Auth-Server. Eine billige Prüfung, die der teuren widersprechen kann, ist schlechter als eine langsamere, die es nicht kann.

**Gemessene Kosten** (lokal, Supabase im Docker auf demselben Rechner, je 12 angemeldete Navigationen auf `/`):

| Variante | Median | Mittel |
|---|---|---|
| `getClaims()` | 144 ms | 139,2 ms |
| `getUser()` | 166 ms | 168,8 ms |

Rund **25 ms mehr pro Navigation**, etwa +20 %. In Produktion liegt der Auth-Server eine echte Netzwerkstrecke entfernt (eu-central-1), dort ist mit mehr zu rechnen — grob 50–100 ms. Der Aufschlag trifft auch Prefetches, weil der Matcher sie erfasst. Für eine App mit zwei navigierbaren Bereichen ist das vertretbar; sollte es je stören, wäre die Alternative **nicht**, zu `getClaims()` zurückzukehren, sondern die ungültigen Cookies zu löschen, sobald `getUser()` sie ablehnt — dann verschwindet der Widerspruch an der Wurzel statt durch eine zweite Wahrheit.

**Die vier Auth-Formulare tragen jetzt `method="post"`** (BUG-4). Ohne dieses Attribut fielen sie bei fehlender Hydration auf das HTML-Standardverhalten zurück — ein natives GET mit E-Mail und Passwort in der Adresszeile. `onSubmit` mit `preventDefault()` sieht regelkonform aus und schützt nur, solange das JavaScript läuft. Nachgewiesen mit abgeschaltetem JavaScript: ohne das Attribut `GET /login?email=…&password=…`, mit ihm `POST /login`.

`allowedDevOrigins` in `next.config.ts` ist ergänzt, damit das JavaScript beim Testen über die LAN-Adresse überhaupt lädt. Das beseitigt nur **einen** Auslöser; die Absicherung ist das `method`-Attribut.

**Bekannte Einschränkung:** Ohne JavaScript sendet das Formular zwar sicher per POST, die Anmeldung funktioniert dann aber nicht — die Seite hat keinen Server-Action-Endpunkt für einen nativen POST. Das ist bewusst so: Ziel war, das Leck zu schließen, nicht die App ohne JavaScript lauffähig zu machen. Ein fehlgeschlagener Login ist ungleich besser als ein durchgereichtes Passwort.

---

## Drosselung der Zugangsdaten-Pfade (2026-09-05)

Eingebaut nach **BUG-29** aus dem QA-Lauf zu PROJ-2: 35 Fehlversuche gegen ein bestehendes Konto ergaben 35-mal dieselbe Antwort, ohne Sperre — und zwar über `POST /`, nicht über `/login`. Next.js bindet eine Server Action nicht an ihre Route, und der Proxy-Matcher nimmt Bild-Endungen aus; eine Schranke am Pfad war damit über `/privacy` oder ein beliebiges `*.png` umgehbar (BUG-30, BUG-31). **Die Drosselung sitzt deshalb in den Actions selbst.**

| Decision | Rationale | Alternative considered | Trade-off | Date |
| --- | --- | --- | --- | --- |
| **Zähler in Postgres statt Upstash Redis** | Das Stack-Pack nennt Upstash (`docs/stacks/framework-nextjs.md`). Dagegen sprach der Projektstand, nicht die Technik: Dieses Projekt hängt bereits an einem externen Dienst, der seit Tagen blockiert (SMTP, `docs/PRD.md`). Ein zweiter externer Blocker auf einem High-Befund wäre der falsche Tausch. Postgres ist da, funktioniert lokal und gehostet gleich und braucht kein neues Konto | Upstash Redis nach Stack-Pack; ein Zähler im Prozessspeicher | **Jeder Rateversuch schreibt in die Produktivdatenbank** — der Angreifer flutet genau das, was ihn bremsen soll. Bei dieser Größenordnung mit Index und schmaler Tabelle unkritisch, und Supabases eigenes Per-IP-Limit sitzt als Untergrenze davor. Upstash bleibt der dokumentierte Ausbauweg | 2026-09-05 |
| **Der Zähler läuft mit dem Service-Role-Schlüssel, nicht mit dem Browser-Schlüssel** | Wäre die Zählfunktion für `anon` ausführbar, wäre die Drosselung eine **Aussperr-Waffe**: fünf Aufrufe mit fremder Adresse, und der Betroffene kommt nicht mehr an sein Konto. Die Funktionen sind ausschließlich für `service_role` freigegeben; `anon` bekommt `42501 permission denied` (gemessen) | Die Funktion für alle freigeben und auf Wohlverhalten hoffen | **Ein Schlüssel, der RLS vollständig aufhebt, lebt jetzt in der App.** Er entsteht nur in `src/lib/supabase/admin.ts`, die Datei trägt `server-only`, und der Name hat bewusst kein `NEXT_PUBLIC_`-Präfix — sonst landete er im ausgelieferten JavaScript | 2026-09-05 |
| **Fehlt der Schlüssel, verweigern die Anmelde-Pfade den Dienst** | Eine Drosselung, die im Fehlerfall stillschweigend aufmacht, ist genau dann nicht da, wenn etwas nicht stimmt. Ein fehlender Service-Role-Schlüssel in Produktion ist ein Deploy-Fehler und soll laut sein | Fail-open mit Logeintrag | Ohne `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` kann sich niemand anmelden — auch lokal nicht. Verifiziert: `loginAction` antwortet mit „SUPABASE_SERVICE_ROLE_KEY fehlt …" statt still durchzulassen | 2026-09-05 |
| **Der Konto-Zähler ist weiter gefasst (20 / 15 min) als der IP-Zähler (5 / min)** | Ein enger Konto-Zähler stoppt verteiltes Raten wirksam — und macht zugleich **jedes Konto aussperrbar**: Wer eine Adresse kennt, hält sie mit ein paar Anfragen pro Minute draußen. Das übliche Gegenmittel ist ein CAPTCHA, das `.claude/rules/security.md` in einem Atemzug mit dem Zähler nennt und das dieses Produkt bewusst nicht hat (`docs/PRD.md`: „ohne Erklärung sofort loslegen") | Beide Zähler eng; nur IP-Zähler; CAPTCHA nachrüsten | **Der Preis ist benannt, nicht beseitigt:** 20 Fehlversuche in 15 Minuten sind zu wenig zum Erraten eines Passworts, aber ein hartnäckiger Angreifer kann ein bekanntes Konto weiterhin phasenweise blockieren. Das Fenster heilt von selbst aus. Sollte je ein CAPTCHA hinzukommen, gehört dieser Zähler enger gestellt | 2026-09-05 |

**Dass der Service-Role-Schlüssel nicht im Browser landet, ist nachgemessen — nicht abgeleitet** (2026-09-05, gegen `next build` in Produktionskonfiguration):

- **Im gebauten Ordner:** 17 Dateien unter `.next/static` und 49 vorgerenderte Dateien unter `.next/server` durchsucht — **kein Treffer**.
- **Über die Leitung:** `next start` gestartet und 17 tatsächlich ausgelieferte Antworten geprüft (`/login`, `/`, `/reset-password`, `/auth/confirm`, eine 404 — dazu jede von diesen Seiten verlinkte `.js`- und `.css`-Datei) — **kein Treffer**. Der Ordner allein hätte nicht gereicht: Die RSC-Nutzlast steckt im HTML und entsteht erst beim Ausliefern.
- **Mit Kontrolle, sonst wäre das Ergebnis wertlos.** Eine Suche, die nichts findet, kann auch am falschen Ort suchen. Der erste Kontrollstring war der ANON-Schlüssel — und der wurde **ebenfalls nicht gefunden**. Ursache: Diese App hat gar keinen Browser-Supabase-Client (nur `server.ts`, `proxy.ts`, `admin.ts`), alles läuft über Server Actions; auch der öffentliche Schlüssel steht zu Recht nicht im Bundle. Als Kontrolle dienen deshalb zwei Texte aus `use client`-Komponenten: einer aus dem ausgelieferten HTML (4 Treffer) und einer, der **nur** im nachgeladenen Chunk steht (1 Treffer). Erst damit ist belegt, dass die Suche das ausgelieferte JavaScript wirklich erreicht.

Nebenbefund, der über die Drosselung hinaus gilt: **Der Browser spricht nie direkt mit Supabase.** Das deckt sich mit `PROJ-2-no-third-party.spec.ts` und ist der Grund, warum hier überhaupt kein öffentlicher Schlüssel ausgeliefert wird.

**Was die IP-Hälfte wert ist, ehrlich gesagt:** `x-forwarded-for` kann ein Client selbst setzen, solange kein Reverse Proxy davorsteht, der den Header überschreibt. Der IP-Zähler bremst also das gewöhnliche schnelle Raten, nicht den, der den Header fälscht — gegen den steht der Konto-Zähler, den man nicht umgehen kann, indem man sich eine andere Herkunft ausdenkt. Beim `/deploy` gehört der Header vom Host gesetzt und clientseitige Werte verworfen; dieselbe Hausaufgabe wie bei BUG-18 (`X-Forwarded-Host`).

**Gegen die laufende Datenbank belegt:** `anon` bekommt auf beide Funktionen `42501 permission denied`; der Server zählt 5 erlaubte und lehnt den 6. ab; `clear_auth_attempts` setzt zurück; und **10 parallele Versuche bei Limit 5 ergeben genau 5 erlaubte und 5 abgelehnte** — der atomare Upsert hält unter Gleichzeitigkeit, ein Zählen in zwei Schritten hätte hier die Lücke.

### Nachtrag 2026-09-05 — BUG-39: Der erfolgreiche Login löscht nur noch den Konto-Zähler

Der QA-Lauf vom selben Tag hat an dieser Drosselung einen **High** gefunden, und er saß nicht in der Zählung, sondern im Aufräumen danach.

**Was falsch war.** `clearAttempts()` löschte nach jedem geglückten Login **beide** Schlüssel — auch `login:ip:<IP>`. Damit war der IP-Zähler von jedem abschaltbar, der **ein einziges eigenes Konto** besitzt: raten, sich selbst anmelden, weiter raten. Keine Header-Fälschung nötig, kein Sonderwissen. Gemessen: **24 Passwortversuche gegen 24 verschiedene Konten von einer IP in 3,6 Sekunden, null abgewiesen.**

**Warum das den Schutz im Kern traf.** Gegen **Passwort-Spraying** — ein gängiges Passwort gegen viele Konten — greift der Konto-Zähler grundsätzlich nicht, weil jedes Opferkonto genau einen Versuch abbekommt. Genau für diesen Angriff ist der IP-Zähler da; das steht so auch im Kopfkommentar von `throttle.ts`. Eine Bremse, die der Angreifer selbst lösen kann, ist keine.

**Was jetzt gilt:** Der erfolgreiche Login löscht ausschließlich `login:account:<adresse>`. Der IP-Zähler bleibt stehen und heilt nach 60 Sekunden von selbst aus.

| Decision | Rationale | Alternative considered | Trade-off | Date |
| --- | --- | --- | --- | --- |
| **Ein erfolgreicher Login löscht nur den Konto-Zähler, nie den IP-Zähler** | Der IP-Zähler ist die einzige Bremse gegen Passwort-Spraying, und er darf nicht von dem gelöst werden können, den er bremsen soll. Ein eigenes Konto zu haben ist keine Berechtigung, den gemeinsamen Zähler zurückzusetzen | Den IP-Zähler nur bei „wenigen" Fehlversuchen mitlöschen (verschiebt die Grenze, schließt die Lücke nicht); den Reset ganz streichen (nimmt dem Nutzer die Kulanz nach Tippfehlern ohne Sicherheitsgewinn) | **Hinter einer geteilten Adresse — Haushalt, Büro-NAT — zählen die Fehlversuche des einen weiter, während der nächste sich anmeldet.** Das ist dieselbe Grenze, die der IP-Zähler ohnehin setzt: Sie heilt nach 60 Sekunden aus und sperrt niemanden aus seinem Konto, weil ein richtiges Passwort in der nächsten Minute wieder durchgeht. Die Kulanz nach Tippfehlern bleibt vollständig erhalten, denn der Konto-Zähler ist der, der einen einzelnen Nutzer aussperren würde | 2026-09-05 |

**Der Abnahmetest prüft das Szenario, nicht die Zeile.** `tests/PROJ-1-throttle.spec.ts` fährt von **einer** Verbindung: vier Rateversuche gegen fremde Konten → ein erfolgreicher Login mit dem eigenen Konto → ein weiterer Rateversuch, der abgewiesen werden **muss**. Ein Test wie „nach dem Login ist der Konto-Zähler leer" wäre auch gegen den kaputten Code grün gewesen, denn der Konto-Zähler wurde ja ebenfalls geleert; der Fehler saß daneben. Gegengeprüft: Mit dem alten Verhalten fällt der Test genau an dieser Stelle.

**Beim Aufräumen mitgefunden — und es betraf die Prüfung selbst:** Die gefälschten Testadressen aus `tests/fixtures.ts` waren pro Lauf identisch (`2001:db8:0::1` …). Weil die Zählerzeilen 60 Sekunden weiterleben, erbte jeder zweite Lauf innerhalb einer Minute den Zähler des vorigen — der Abnahmetest, der seinen Zähler absichtlich bis an die Grenze füllt, schlug dann schon beim ersten Versuch fehl. Die Adressen tragen jetzt eine Kennung je Lauf.

> **Überholt seit BUG-54:** die Entscheidungszeile dieses Nachtrags („Ein erfolgreicher Login löscht nur den Konto-Zähler, nie den IP-Zähler") samt ihrer Abwägung. Der dort als tragbar beschriebene Preis war größer, als der Satz vermuten ließ — die Lösung im nächsten Abschnitt behält den Sicherheitsgewinn und streicht den Preis. Der Nachtrag bleibt unverändert stehen, weil er den Weg dorthin erklärt.

### Nachtrag 2026-09-05 (später) — BUG-54: Der IP-Zähler zählt nur noch Fehlversuche

Der QA-Nachlauf zum BUG-39-Fix hat gemessen, was die Abwägung oben nur benannt hat: **Acht verschiedene Spieler mit richtigem Passwort hinter einer geteilten Adresse — fünf kommen hinein, drei sehen „Zu viele Versuche von dieser Verbindung".** Ebenso wird der sechste Anmelde-/Abmelde-Durchlauf desselben Spielers abgewiesen.

**Warum das schwerer wiegt, als es zuerst aussah.** Gezählt wird **vor** der Passwortprüfung — ein geglückter Login verbrauchte also Budget. Betroffen sind Familien- und Schulanschlüsse und Mobilfunk-CGNAT, wo sich sehr viele Nutzer eine öffentliche Adresse teilen. Die Zielgruppe im PRD schließt Kinder ausdrücklich ein. Der Satz „hinter einer geteilten Adresse zählen die Fehlversuche des einen weiter" liest sich harmlos; „fünf Anmeldungen pro Minute für alle Nutzer eines Schulanschlusses zusammen" liest sich anders. **Eine Grenze ohne Zahl ist eine Grenze, die niemand prüft.**

**Was jetzt gilt:** Ein erfolgreicher Login erstattet **genau den einen Versuch**, den er selbst hochgezählt hat (`refund_auth_attempt`, Migration `0004`). Der IP-Zähler zählt damit im Ergebnis nur noch Fehlversuche.

| Decision | Rationale | Alternative considered | Trade-off | Date |
| --- | --- | --- | --- | --- |
| **Der IP-Zähler zählt nur Fehlversuche — ein geglückter Login erstattet seinen eigenen Versuch** | Löst BUG-39 und BUG-54 zugleich: Der Erfolg kostet den legitimen Nutzer nichts, und er bringt dem Angreifer nichts, weil nur *sein eigener* Versuch zurückkommt und nicht der Zähler geleert wird. Wer rät, hat weiterhin genau `credentialsPerIp.limit` Fehlversuche je Fenster — egal wie oft er sich dazwischen selbst anmeldet | **Erst prüfen, dann bei Misserfolg zählen** — verworfen: Das Hochzählen und das Prüfen stecken bewusst in *einem* SQL-Statement (`0003`), damit gleichzeitige Anfragen sich nicht überholen (nachgemessen mit 10 parallelen Versuchen bei Limit 5). Getrenntes Lesen und Schreiben reißt genau diese Lücke wieder auf: 100 parallele Anfragen sähen alle den Zähler auf 0. · Das Limit anheben — verschiebt die Grenze, ohne die Ursache zu berühren, und schwächt den Schutz für alle | **Ein zusätzlicher Datenbank-Aufruf je erfolgreicher Anmeldung.** Er läuft parallel zum Leeren des Konto-Zählers und blockiert die Anmeldung nicht; schlägt er fehl, bleibt der Zähler stehen — die sichere Richtung. Zweitens: `greatest(attempts - 1, 0)` ist nötig, weil eine Erstattung nach einem Fensterwechsel sonst einen negativen Zähler und damit stilles Freibudget erzeugen würde | 2026-09-05 |

**Die Erstattung gilt ausschließlich für den Login.** `settleSuccessfulLogin()` nimmt bewusst **keinen** `scope` entgegen, damit die Abgrenzung strukturell ist und nicht nur als Kommentar dasteht: Bei **Registrierung** und **Passwort-Reset** ist die begrenzte Sache die Handlung selbst — Konten anlegen, Mails verschicken —, nicht das Raten. Würden erfolgreiche Registrierungen erstattet, wäre die Massenanlage von Konten unbegrenzt (BUG-47); beim Reset wäre es ein Versand-Vektor.

**Zwei Abnahmetests, weil einer die Zusage nicht aufspannt.** Der IP-Zähler ist zweimal in Folge in die jeweils andere Richtung gekippt, und beide Male war das damalige Verhalten durch *einen* Test gedeckt. Nachgemessen mit beiden falschen Fassungen:

| Codestand | „Angreifer wird gebremst" (BUG-39) | „Erfolge kosten nichts" (BUG-54) |
|---|---|---|
| Urzustand — Login **löscht** den IP-Zähler | **rot** („Der eigene Login hat den IP-Zähler zurückgesetzt") | grün |
| Zwischenstand — Login lässt den Zähler stehen | rot (meldet dabei bereits BUG-54) | **rot** |
| Jetzt — Login erstattet seinen einen Versuch | grün | grün |

Der Urzustand hätte also den BUG-54-Test bestanden, der Zwischenstand keinen von beiden. **Erst beide zusammen beschreiben, was gelten soll: Gezählt werden Fehlversuche, sonst nichts.**


