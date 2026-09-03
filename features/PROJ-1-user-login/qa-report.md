# QA Test Results

**Tested:** 2026-08-31 · **Nachprüfung nach BUG-1-Fix:** 2026-09-01
**App URL:** http://localhost:3000 (`probe.baseUrl`, lokaler Next.js-Dev-Server + lokaler Supabase-Stack)
**Tester:** QA Engineer (AI)

> Legende: `[x]` in diesem Durchlauf verifiziert (mit Beleg) · `[ ] BUG` als defekt verifiziert · `[!] NOT VERIFIED` in diesem Durchlauf nicht prüfbar (mit Grund)

Vorgehen: Lokale DB per `supabase db reset` auf einen sauberen Stand gebracht, Dev-Server gestartet, dann zwei parallele Prüfspuren gefahren — (a) funktional per echtem Chromium-Browser (Playwright, temporäres Prüf-Skript, nicht committet — `/e2e-tests` ist für dauerhafte Browser-Tests zuständig) gegen jede AC-ID/EC-ID, (b) ein unabhängiger Security-Red-Team-Subagent gegen die echte API (curl, `docker exec ... psql`, Build-Output-Grep). Zusätzlich ein echter Concurrency-Test für EC-1 (zwei gleichzeitige Registrierungen, dreifach wiederholt).

### Acceptance Criteria Status

#### AC-1: Registrierung legt Konto + Profil an, sofortiger Login
- [x] E-Mail/Passwort/Trainername → Konto + Profil angelegt, sofort eingeloggt, keine Bestätigungsmail nötig — Playwright: `AC-1, AC-14` (register → `waitForURL('/')` → „Eingeloggt als …" sichtbar)
- [x] Passwort-Mindestlänge 8 Zeichen serverseitig erzwungen, nicht nur im Formular — `curl POST /auth/v1/signup` mit 6-Zeichen-Passwort → `422 weak_password`

#### AC-2: Doppelter Trainername (Groß-/Kleinschreibung) abgelehnt
- [x] Feldspezifischer Fehler „Dieser Trainername ist bereits vergeben." — Playwright: `AC-2, EC-1`
- [x] Auch bei direktem API-Aufruf (Zod umgangen) abgelehnt — Security-Lane: `POST /auth/v1/signup` mit Duplikat → `500 {"code":"P0001","message":"trainer_name_taken"}`

#### AC-3: Doppelte E-Mail-Adresse mit offener Meldung abgelehnt
- [x] Meldung „Diese E-Mail-Adresse ist bereits registriert." erscheint — Playwright: `AC-3`
- [x] `mapRegisterError` ordnet `error.code === 'user_already_exists'` korrekt dem E-Mail-Feld zu — `src/lib/auth/error-mapping.ts:43-45`, per Unit-Test abgesichert (`error-mapping.test.ts`)

#### AC-4: Login mit korrekten Zugangsdaten → Weiterleitung zu `/`
- [x] Playwright: `AC-4, AC-6` (Login → `waitForURL('/')`, Trainername sichtbar)

#### AC-5: Sitzung bleibt bis aktivem Logout bestehen
- [x] Neuer Browser-Kontext aus gespeichertem `storageState` (simuliert „Browser schließen und neu öffnen") bleibt eingeloggt — Playwright: `AC-5`

#### AC-6: Abmelden beendet die Sitzung, Weiterleitung zu `/login`
- [x] Playwright: `AC-4, AC-6`

#### AC-7: Identische Fehlermeldung bei falschem Passwort / unbekannter E-Mail
- [x] Byte-genau identischer Text in beiden Fällen, per UI geprüft — Playwright: `AC-7` (`expect(msg1).toBe(msg2)`, Wert: „E-Mail-Adresse oder Passwort ist falsch.")
- [x] Auch auf API-Ebene identisch — Security-Lane: beide Fälle liefern `400 {"error_code":"invalid_credentials"}`

#### AC-8: Supabases eingebautes Rate-Limit (30 Versuche / 5 Min pro IP)
- [!] NOT VERIFIED — 45 aufeinanderfolgende Fehlversuche gegen die lokale Instanz, alle `400 invalid_credentials`, kein einziges `429` (Security-Lane, reproduziert den bereits während `/build` dokumentierten Befund). Ursache laut `design.md` → Technical Decisions: die lokale Supabase-CLI setzt `GOTRUE_RATE_LIMIT_SIGN_IN_SIGN_UPS` im Auth-Container nicht, obwohl `config.toml` den Wert enthält — ein Tooling-Gap der lokalen Umgebung, kein Code-Fehler dieses Features. Nur gegen das gehostete Projekt nach dem ersten `/deploy` wirklich verifizierbar (Verifizierungsplan bereits in `design.md` hinterlegt). Siehe auch Security-Audit unten für die Einordnung des Rest-Risikos.

#### AC-10: Passwort-Reset anfordern — identische Meldung unabhängig von Kontoexistenz
- [x] Playwright: `AC-10, EC-3` (existierende und nicht-existierende Adresse liefern denselben Text)

#### AC-11: Gültiger Reset-Link → neues Passwort setzen → eingeloggt
- [x] Echter E-Mail-Link aus Mailpit ausgelesen, angeklickt, Passwort gesetzt, landet eingeloggt auf `/`, **und** das neue Passwort funktioniert für einen frischen Login — Playwright: `AC-11` (End-to-End über den echten Client-seitigen Session-Aufbau aus `reset-password-form.tsx`, nicht nur Code-Lektüre)

#### AC-12: Abgelaufener/ungültiger Reset-Link zeigt Fehlermeldung
- [x] `#error=access_denied&error_code=otp_expired` im Fragment → Fehlermeldung + „Neuen Link anfordern"-Link — Playwright: `AC-12`
- [x] Direkter Aufruf ohne jedes Fragment/Sitzung → dieselbe Fehlermeldung, kein Absturz — Playwright: `AC-12` (zweiter Teil), auch von der Security-Lane unabhängig bestätigt

#### AC-13: Leeres Formular → Validierungsfehler pro Feld, keine Seiten-Neuladen
- [x] Playwright: `AC-13` — alle drei Feldfehler erscheinen, `page.url()` bleibt `/login` (kein natives GET mit Feldern in der Query-String)

#### AC-14: Datenschutz-Link auf dem Registrierungsformular sichtbar
- [x] Playwright: `AC-1, AC-14`

### Edge Cases Status

#### EC-1: Zwei gleichzeitige Registrierungen mit demselben Trainernamen (Groß-/Kleinschreibung)
- [x] **Echter Concurrency-Test** (nicht nur sequenziell): zwei `signUp()`-Aufrufe per `Promise.all`, dreifach wiederholt — jedes Mal genau 1 Erfolg, der andere erhält `500 Database error saving new user` (Postgres-Unique-Index serialisiert den Race korrekt). Kein halb angelegtes Konto: Security-Lane bestätigt per `docker exec ... psql`, dass bei einem abgelehnten Duplikat keine verwaiste `auth.users`-Zeile zurückbleibt — die im selben Trigger geworfene Exception rollt die gesamte Transaktion zurück, wie in `supabase/migrations/0001_profiles.sql` und `design.md` zugesichert.

#### EC-2: Ausgeloggter Zugriff auf geschützte Route → Weiterleitung
- [x] Playwright: `EC-2` + Security-Lane: `curl -i http://localhost:3000/` ohne Cookies → `307` zu `/login`; `/login` und `/reset-password` bleiben `200`

#### EC-3: Reset-Anfrage für nicht existierende Adresse
- [x] Playwright: `AC-10, EC-3` (siehe oben)

#### EC-4: Wiederholter Versuch innerhalb der Sperrfrist
- [!] NOT VERIFIED — dieselbe Ursache wie AC-8; ohne ein auslösbares Limit lässt sich „bleibt weiterhin gesperrt" lokal nicht separat prüfen

#### EC-5: Ungültiger Trainername (Zeichen/Länge)
- [x] Playwright: `EC-5` (zu kurzer Name → feldspezifische Meldung „3–20 Zeichen…")

#### EC-6: Netzwerkfehler beim Absenden — Fehlermeldung + Werte bleiben erhalten
- [x] **Behoben und nachgeprüft (2026-09-01).** Abgebrochener POST auf Transportebene (Playwright `route.abort('failed')`) in drei Formularen geprüft — Login, Registrierung, Passwort-vergessen: jeweils erscheint „Die Verbindung ist fehlgeschlagen. Bitte erneut versuchen." **in der App**, alle eingegebenen Werte bleiben erhalten, der Button ist wieder aktiv. Für den Login zusätzlich der komplette Wiederholungspfad geprüft: Netzwerk wieder freigegeben, derselbe Klick erreicht den Server (normale „E-Mail-Adresse oder Passwort ist falsch."-Meldung) — Beleg: temporäres Prüf-Skript `ec6-verify.spec.ts`, 4/4 grün
- [x] Fix ohne Nebenwirkung auf den Erfolgsfall: `redirect()` aus einer Server Action ist ein *geworfenes* Kontrollfluss-Signal — ein pauschaler `catch` hätte es verschluckt. `runAuthAction` wirft es per `unstable_rethrow` (Next.js' offizielle API dafür) weiter — `src/lib/auth/run-action.ts:19`, per Unit-Test und Browser-Regression abgesichert

### Security Audit Results

_Ausgeführt von einer unabhängigen Security-Red-Team-Subagenten-Instanz mit vollem Kontext von `spec.md`/`design.md`, gegen die echte laufende App und API._

- [x] **Authentifizierungs-Umgehung:** `curl -i http://localhost:3000/` ohne Sitzung → `307` zu `/login`, nie `200` mit Inhalt — Beleg: Security-Lane-Report §1
- [x] **Autorisierung/RLS:** Anon ohne Sitzung sieht `[]` auf `profiles`; ein echter eingeloggter Nutzer kann seine eigene `trainer_name`-Zeile weder per `PATCH` noch `INSERT` noch `DELETE` ändern (0 betroffene Zeilen bzw. `403 42501`) — Beleg: Security-Lane-Report §2, `supabase/migrations/0001_profiles.sql`
- [x] **Input-Injection:** XSS- und SQL-Injection-förmige Payloads direkt gegen die API (Zod umgangen) → von der DB-`CHECK`-Constraint abgelehnt (`23514`), keine verwaiste Nutzerzeile — Beleg: Security-Lane-Report §3
- [!] **Rate Limiting (allgemein):** NOT VERIFIED — siehe AC-8/EC-4; bewusst kein App-eigener Zähler (Product Decision)
- [ ] **Brute Force auf Login:** 45 Fehlversuche gegen ein Konto, kein einziger `429` — bereits dokumentierter, akzeptierter Gap (Supabases IP-Limit ist der einzige Schutz, siehe `spec.md` Decision Log). **Eingeordnet als Medium, nicht High**, weil bewusst und wiederholt vom Nutzer bestätigte Produktentscheidung (reaktiv statt präventiv), nicht ein übersehener Ist-Zustand — aber: **auch wenn Supabases IP-Limit hosted greift, deckt es nur einen Angreifer von einer IP ab, keinen verteilten oder geduldigen Angriff auf ein einzelnes Konto, und nichts, was diese Anwendung selbst geschrieben hat.** Das gilt unabhängig vom Deploy-Ergebnis und ist als Rest-Risiko festzuhalten, nicht nur als „lokal nicht auslösbar".
- [x] **Keine Konto-Enumeration:** unbekannte E-Mail und falsches Passwort liefern identische Meldung — Beleg: AC-7 oben
- [x] **Bulk-Signup automatisierbar:** 8 Registrierungen im Skript-Loop, alle `200`, keine Bremse — bestätigt die dokumentierte, bewusste Entscheidung gegen CAPTCHA im MVP, keine neue Erkenntnis
- [x] **Zugangsdaten nie in der URL:** alle vier Formulare laufen über Server Actions (`startTransition` + `await xAction(...)`), nie ein natives GET-Formular; kein `redirect()`-Aufruf in `src/lib/auth/actions.ts` trägt E-Mail/Passwort in der Ziel-URL — Beleg: Security-Lane-Report §8, Code-Lektüre aller vier View-Komponenten
- [x] **Keine Secrets im Client-Bundle:** `npm run build` + Grep über `.next/static` nach `service_role`/`JWT_SECRET`/DB-Passwörtern → keine Treffer; einzige gefundene JWT-förmige Zeichenkette dekodiert zu `role: anon` (der öffentliche Key) — Beleg: Security-Lane-Report §6
- [x] **Keine sensiblen Daten in Antworten:** Server Actions geben nur `{error, fieldErrors, message}` zurück, nie das rohe Supabase-Antwortobjekt — Beleg: Security-Lane-Report §7, `src/lib/auth/actions.ts`
- [ ] BUG-1 (siehe unten) — kein Security-Fund, aber Robustheits-Lücke bei Netzwerkfehlern

**Informativ (kein PROJ-1-Scope):** `/login` liefert dev-seitig keine Security-Header (`X-Frame-Options` etc.) — laut `design.md`/`.claude/rules/security.md` bewusst ein Deploy-/Host-Thema, von `/security-check` nach dem Launch gegen die echte URL geprüft, kein Fund dieses Durchlaufs.

### E2E Tests
_Optionale Schicht — von `/e2e-tests` für kritische Kernabläufe geschrieben._

- Status: **nicht ausgeführt** (`/e2e-tests` für kritische Abläufe)

_Hinweis: Die funktionale Prüfung oben lief über ein temporäres Playwright-Skript (echter Chromium, nicht nur curl) — das ist kein Ersatz für die von `/e2e-tests` dauerhaft angelegte Regressionsdecke und wurde nicht committet._

### Not Verified In This Run

- [!] AC-8 / EC-4 — Supabases Rate-Limit lokal nicht auslösbar (Tooling-Gap, siehe oben) — erneut zu prüfen nach `/deploy`
- [!] Cross-Browser-Rendering (Firefox / Safari) — nur Chromium eingesetzt
- [!] Responsives Layout bei 375px / 768px / 1440px — kein Viewport-Test in diesem Durchlauf
- [!] Barrierefreiheit / Tastaturnavigation im Detail — nicht dediziert geprüft (shadcn/ui-Grundkomponenten haben eingebaute ARIA-Unterstützung, aber kein eigener Test)
- [!] `[user]`-Task T4 (Passwort-Mindestlänge im gehosteten Dashboard): strukturell noch nicht setzbar, da das gehostete Supabase-Projekt erst bei `/deploy` entsteht — kein Bug, sondern korrekt aufgeschoben. Der lokale Spiegel (`config.toml`) ist gesetzt und serverseitig bestätigt wirksam (422 bei 6-stelligem Passwort)

### Bugs Found

#### BUG-1: Netzwerkfehler beim Absenden eines Auth-Formulars zeigt eine rohe Browser-Fehlerseite statt einer In-App-Meldung
- **Status:** ✅ **BEHOBEN am 2026-09-01, im echten Browser nachgeprüft** (siehe EC-6 oben). Fix: `src/lib/auth/run-action.ts` fängt den Transportfehler ab und gibt ihn als normalen `ActionState` zurück; alle vier Formulare rufen ihre Server Action jetzt darüber auf. `unstable_rethrow` schützt dabei den `redirect()`-Erfolgspfad. Neue Unit-Tests: `src/lib/auth/run-action.test.ts` (5 Tests, beide Fix-Hälften einzeln rot nachgewiesen).
- **Severity:** High
- **Betrifft:** alle vier Formulare — `src/components/auth/login-view.tsx:41`, `register-view.tsx:37`, `forgot-password-view.tsx:35`, `reset-password-form.tsx:83`
- **Ursache:** `await xAction({}, formData)` steht in keinem `try/catch`. Schlägt der Server-Action-Aufruf selbst auf Transportebene fehl (z. B. Verbindungsabbruch, bevor die Antwort ankommt — anders als ein vom Server zurückgegebener Fehler, den `error-mapping.ts` bereits sauber behandelt), gibt es keinen Fänger.
- **Steps to Reproduce:**
  1. `/login` öffnen, E-Mail/Passwort ausfüllen
  2. Den POST-Request der Server Action auf Netzwerkebene abbrechen (reproduziert per Playwright `page.route('**/login', route => route.abort('failed'))` auf die POST-Anfrage)
  3. „Einloggen" klicken
  4. Erwartet (EC-6): Fehlermeldung im Formular, eingegebene Werte bleiben erhalten, „Erneut versuchen" möglich
  5. Tatsächlich: Chromium zeigt „This page couldn't load / Reload to try again, or go back" — die React-App ist weg, die eingegebenen Werte sind verloren
- **Priority:** Vor dem Deploy beheben — betrifft den Kernpfad (Login/Registrierung/Reset) und genau den Netzwerk-Wackelkontakt-Fall, den EC-6 im Vertrag ausdrücklich zusichert.

### Nachprüfung nach dem BUG-1-Fix (2026-09-01)

Umfang der zweiten Runde — bewusst nicht der volle AC-Sweep, sondern der Fix plus alles, was der Fix anfassen konnte:

- [x] EC-6 in drei Formularen (Login, Registrierung, Passwort-vergessen) im echten Chromium — 4/4 grün (`ec6-verify.spec.ts`)
- [x] Regression über **alle drei `ActionState`-Formen**, weil der Fix jeden Rückgabeweg umschließt: Feldfehler (AC-2, AC-3), Meldung (AC-10/EC-3), Erfolg + `redirect()` (AC-11, kompletter Reset-Flow inkl. Login mit dem neuen Passwort) — 4/4 grün (`regression.spec.ts`)
- [x] Unit-Tests 25/25 grün (5 neue in `run-action.test.ts`), `npm run build` und `npm run lint` fehlerfrei
- Nebenbefund dieser Runde: Ein Testlauf mit einem 21-stelligen Trainernamen wurde von der App korrekt abgelehnt — ungeplante Zusatzbestätigung für EC-5 exakt an der 20-Zeichen-Grenze.
- Nicht erneut ausgeführt: AC-1, AC-4 bis AC-7, AC-12 bis AC-14, EC-1, EC-2, EC-5 (Ergebnisse der ersten Runde vom 2026-08-31 gelten weiter; der Fix berührt weder Schema, RLS, Proxy noch die Validierung). AC-1/AC-4/AC-6 liefen als Nebeneffekt der Regressionstests trotzdem erneut durch.

### Summary
- **Acceptance Criteria:** 13/13 geprüfte ACs bestanden (AC-1 bis AC-14, AC-9 im Decision Log gestrichen), 1 nicht verifizierbar (AC-8, lokaler Tooling-Gap)
- **Edge Cases:** 6/6 bestanden (EC-6 nach dem Fix nachgeprüft), EC-4 nicht verifizierbar (deckungsgleich mit AC-8)
- **Bugs Found:** 1 total (1 High) — **behoben und nachgeprüft**, 0 offen
- **Security:** 10/12 Prüfungen mit Beleg verifiziert, 2 NOT VERIFIED (Rate-Limiting allgemein, deckungsgleich mit AC-8/EC-4) — Brute-Force-Check zeigt einen bereits dokumentierten, bewusst akzeptierten Medium-Rest-Risiko-Befund, keinen neuen Fund
- **Production Ready:** YES — kein offener Critical/High-Bug
- **Recommendation:** Deploy möglich. Zwei Dinge müssen aber direkt nach dem ersten `/deploy` gegen das gehostete Projekt geprüft werden, bevor die App öffentlich geht: **AC-8/EC-4** (Rate-Limit, lokal nicht auslösbar) und **AC-11/AC-12** (Reset-Link, hängt an Site-URL/Redirect-URLs des gehosteten Projekts) — beide Prüfpläne stehen in `design.md`.

> „Production Ready: YES" heißt hier ausschließlich: **kein offener Critical- oder High-Bug**. Es heißt *nicht*, dass alles geprüft wurde. Offen bleiben AC-8/EC-4 (erst hosted prüfbar), Cross-Browser, responsives Layout und ein dedizierter Barrierefreiheits-Durchgang — siehe „Not Verified In This Run".

---

## Nachlauf — 2026-09-02, nach BUG-3 und BUG-4

**Anlass:** Zwei Fehler aus dem manuellen Test des Nutzers wurden in PROJ-1 behoben (`791c786`) — die Weiterleitungsschleife und die Zugangsdaten in der URL. Dieser Lauf prüft die Fixes und die vom Nutzer geforderte Erweiterung des Sitzungs-Testfalls („Cookie da, Sitzung serverseitig ungültig").

### Der erweiterte Sitzungs-Testfall

Genau dieser Fall fehlte bisher in jeder Suite: Alle bisherigen Prüfungen simulierten eine *fehlende* Sitzung. Der reale Fall ist ein **vorhandenes, signatur-gültiges Cookie zu einer serverseitig widerrufenen Sitzung** — und nur der erzeugte die Schleife.

- [x] **BUG-3 im Browser** — angemeldet, Konto über die Admin-API gelöscht, Cookie belassen, dann F5: **kein `ERR_TOO_MANY_REDIRECTS`, genau 1 Weiterleitung, Ziel `/login`** (vorher: 19 Weiterleitungen, Abbruch)
- [x] **BUG-3 als dauerhafter Regressionstest** — `src/proxy.test.ts`, 7 Tests. Beide Hälften der Schleife sind festgehalten: die ungültige Sitzung *muss* nach `/login`, und auf `/login` darf sie *nicht* zurückgeschickt werden. Dazu eine ausdrückliche Zusicherung, dass der Proxy `getUser()` benutzt und `getClaims()` **nicht** mehr aufruft
- [x] **Rot-Nachweis, präzise** — der Proxy wurde auf `getClaims()` zurückgestellt **und** der Mock so gesetzt, dass die Signaturprüfung eine gültige Sitzung meldet, während der Auth-Server ablehnt: also exakt der Fehlerzustand. Ergebnis: **5 von 7 Tests rot**, darunter beide Schleifen-Hälften; die zwei Tests für eine echte Sitzung blieben grün. Die Tests fangen also den Fehler, nicht bloß eine Codeänderung

### Acceptance Criteria — in diesem Lauf geprüft

- [x] **AC-1** Registrierung ohne E-Mail-Bestätigung, sofort eingeloggt — Browser-Lauf
- [x] **AC-1/AC-11** Passwort-Mindestlänge greift serverseitig — 7 Zeichen: **422 „Password should be at least 8 characters"**, 8 Zeichen: 200
- [x] **AC-2** Trainername eindeutig, unabhängig von Groß-/Kleinschreibung — beide Varianten abgelehnt
- [x] **AC-3** Bereits registrierte E-Mail-Adresse gibt kein zweites Konto — 422
- [x] **AC-4** Login mit korrekten Daten führt auf `/` — Browser-Lauf
- [x] **AC-5** Sitzung überlebt einen neuen Seitenaufruf — Browser-Lauf
- [x] **AC-6** Abmelden beendet die Sitzung und führt auf `/login` — Browser-Lauf, über den **neuen** Abmelden-Button in PROJ-2s Kopfzeile
- [x] **AC-7** Identische Fehlermeldung für falsches Passwort und unbekannte Adresse — beide „Invalid login credentials", gleicher Status
- [x] **AC-10** Gleiche Bestätigungsmeldung für bekannte und unbekannte Adresse — Browser-Lauf
- [x] **AC-11** Passwort-Reset **vollständig durchgespielt**: Link aus der echten E-Mail (Mailpit) → Formular erscheint → neues Passwort gesetzt → direkt eingeloggt → Login mit dem neuen Passwort funktioniert → **das alte Passwort funktioniert nicht mehr**
- [x] **AC-12** Bereits verwendeter Link gibt kein Passwortformular mehr her (0 Felder) und zeigt „Dieser Link …" als Fehlermeldung
- [x] **AC-13** Leeres Formular zeigt Validierungsfehler ohne Neuladen — Browser-Lauf
- [x] **AC-14** Datenschutz-Hinweis im Registrierungsformular sichtbar — Browser-Lauf
- [!] **AC-8** Drosselung nach wiederholten Fehlversuchen — **NICHT VERIFIZIERT.** 30 falsche Passwörter gegen dasselbe Konto lösten **kein 429** aus, ebenso 10 Konten mit demselben Passwort. Das bestätigt die bekannte Open Question in `spec.md`: Supabases eingebautes Limit ist im lokalen CLI-Stack nicht aktiv. **Prüfbar erst gegen das gehostete Projekt**, mit demselben Verfahren

### Edge Cases

- [x] **EC-1** Trainername doppelt (auch mit anderer Schreibweise) → abgelehnt
- [x] **EC-2** Ausgeloggt auf geschützte Route → `/login`; **erweitert** um den Fall „Cookie da, Sitzung ungültig" (siehe oben)
- [x] **EC-3** Reset für unbekannte Adresse → dieselbe Meldung
- [!] **EC-4** Verhalten am erreichten IP-Limit — **NICHT VERIFIZIERT**, gleiche Ursache wie AC-8
- [x] **EC-5** Ungültige Trainernamen (zu kurz, zu lang, Leerzeichen, Emoji) → alle abgelehnt
- [!] **EC-6** Netzwerkfehler beim Absenden — **NICHT VERIFIZIERT in diesem Lauf**; abgedeckt durch `src/lib/auth/run-action.test.ts` aus dem Erstlauf

### Security

- [x] **Zugangsdaten nie in der URL (BUG-4)** — mit abgeschaltetem JavaScript sendet das Formular `POST /login`, die URL bleibt sauber. **Durch Mutation belegt:** ohne `method="post"` erscheint wieder `GET /login?email=…&password=…`
- [x] **Keine Kontoexistenz-Preisgabe** — siehe AC-7
- [x] **Authentifizierung** — `/` ohne Sitzung: 307 nach `/login`
- [x] **Autorisierung / Datenschicht** — Sicherheitsdurchgang 19/19 (fremde Runden nicht lesbar, fremdes Profil nicht beschreibbar, Injection abgewiesen, `profiles` gibt keine E-Mail heraus)
- [!] **Brute-Force-Schutz** — nicht auslösbar, siehe AC-8. **Das ist keine bestandene Prüfung**, sondern eine offene
- [!] **Massen-Registrierung** — 5 von 5 Konten per Skript angelegt. Bewusste Produktentscheidung (kein CAPTCHA im MVP, `spec.md` → Out of Scope), hier nur festgehalten

### Bugs

#### BUG-5: Zwei verschachtelte `<main>`-Elemente auf `/login` und `/reset-password`

- **Severity:** Low
- **Ursache:** PROJ-2s `PageFrame` bringt ein `<main>` mit (`page-frame.tsx:13`), PROJ-1s Seiten haben bereits eines (`login/page.tsx:5`, `reset-password/page.tsx:16`). Das ausgelieferte HTML enthält **zwei** — geprüft mit `curl`
- **Wirkung:** Ungültiges HTML; Screenreader finden zwei „main"-Landmarken statt einer, was die Landmarken-Navigation unbrauchbar macht. Keine funktionale Einschränkung
- **Regression aus PROJ-2:** Vor der Shell gab es nur das innere `<main>`
- **Fix:** Das innere `<main>` in den beiden Seiten zu einem `<div>` machen. Eine Zeile je Datei
- **Priorität:** Vor dem Deploy, aber nicht blockierend
- **Status: behoben am 2026-09-02.** Beide Seiten verwenden jetzt ein `<div>`; das ausgelieferte HTML enthaelt auf `/login` und `/reset-password` genau **ein** `<main>` (geprueft mit `curl`), Fusszeile und Inhalt unveraendert vorhanden

#### Offene `[user]`-Aufgabe: T4 (Passwort-Mindestlänge im Dashboard)

`tasks.md` → T4 ist offen: *Supabase Dashboard → Authentication → Sign In / Providers → Email → Minimum password length: 8*. Sie liegt auf einem Zugangsdaten-Pfad (AC-1, AC-11).

**Einordnung:** Die Aufgabe ist ausdrücklich für das **gehostete** Projekt ab dem ersten Deploy formuliert, und das existiert noch nicht. Der lokale Spiegel in `supabase/config.toml` ist gesetzt und in diesem Lauf **verifiziert** (7 Zeichen → 422). Sie ist damit kein Fehler im jetzigen Stand, aber ein **echter Blocker für `/deploy`** — ohne sie akzeptiert das Produktivsystem kürzere Passwörter als zugesagt.

### Die drei Prüfungen — einzeln gelaufen

| Prüfung | Kommando | Ergebnis |
|---|---|---|
| Tests | `npm test` | **92 bestanden** (85 + 7 neue Proxy-Tests) |
| Lint | `npm run lint` | **grün**, keine Befunde |
| Build | `npm run build` | **grün**, „Finished TypeScript" |

### Verdikt

- **Acceptance Criteria:** **12 von 13 verifiziert**, 1 nicht verifiziert (AC-8, lokal nicht auslösbar)
- **Edge Cases:** 4 von 6 verifiziert, 2 nicht verifiziert (EC-4 gleiche Ursache wie AC-8; EC-6 aus dem Erstlauf abgedeckt)
- **Bugs:** BUG-3 und BUG-4 **behoben und verifiziert**; **BUG-5 neu (Low)**
- **Security:** 4 von 6 Prüfungen verifiziert, 2 offen (Brute Force, Massen-Registrierung)
- **Production Ready:** **JA für diesen Stand** — kein kritischer oder hoher Fehler offen. Mit ~~zwei~~ **drei** Auflagen, die vor dem öffentlichen Start zu erledigen sind: **AC-8 gegen das gehostete Projekt prüfen**, **T4 im Dashboard setzen** und **den Warnhinweis am Trainername-Feld ergänzen** (dritte Auflage nachgetragen am 2026-09-03, siehe Nachtrag unten)
- **Weiterhin ungeprüft:** Firefox und Safari — in keinem Lauf getestet, alles lief in Chromium

---

## Nachtrag — 2026-09-03: Deploy-Blocker aus der Datenschutzprüfung zu PROJ-3

**Herkunft:** Dies ist **kein Befund aus einem QA-Lauf.** Er stammt aus `/dsgvo PROJ-3` vom 2026-09-03 und wird hier vermerkt, weil er PROJ-1 betrifft und in dieselbe Reihe gehört wie AC-8 und T4: etwas, das den jetzigen Stand nicht kaputt macht, aber vor dem öffentlichen Start erledigt sein muss.

### Offener Vertragsmangel: Der Trainername wird veröffentlicht, ohne dass die Registrierung es sagt

**Sachverhalt.** Drei Festlegungen greifen ineinander, jede für sich unauffällig:

1. `spec.md` → AC-1 nimmt den Trainernamen bei der Registrierung entgegen.
2. `spec.md` → Decision Log: „Trainername ist nach der Registrierung dauerhaft fix." Es gibt keinen Änderungsweg — auch nicht in der Datenbank, wo `0001_profiles.sql` bewusst **keine** `update`-Policy hat.
3. `0001_profiles.sql` macht den Namen für **alle angemeldeten Nutzer** lesbar (`profiles_select_authenticated`).

**Kein einziges AC verlangt, dass der Nutzer davon erfährt.** AC-14 fordert lediglich einen sichtbaren Link zur Datenschutzerklärung vor dem Absenden — das ist eine andere Zusage.

**Warum es erst jetzt auffällt.** Bis einschließlich PROJ-2 war der Trainername zwar für angemeldete Nutzer *lesbar*, wurde aber an keiner Stelle der Oberfläche **angezeigt**. Der Nutzer-Chip in der Kopfzeile zeigt jedem nur seinen eigenen. PROJ-3 ist der erste Ort, an dem der Name tatsächlich vor anderen Menschen erscheint — und dann unwiderruflich.

**Wirkung.** Ein Nutzer trägt seinen echten Namen ein, ohne zu wissen, dass er für alle anderen Spieler sichtbar und nachträglich nicht mehr änderbar ist. Der einzige Rückweg ist das Löschen des gesamten Kontos, und den gibt es erst mit PROJ-4. Das Publikum schließt laut `docs/PRD.md` absehbar Minderjährige ein — genau der Grund, aus dem dort die Datenschutz-Haltung `standard` gewählt wurde.

**Was mindestens fehlt.** Ein Warnhinweis am Trainername-Feld im Registrierungsformular, der **beide** Hälften sagt: für andere Spieler sichtbar **und** später nicht änderbar. Eine Hälfte allein genügt nicht — „öffentlich" ohne „endgültig" verschweigt genau den Teil, der die Entscheidung unumkehrbar macht.

**Priorität: Blocker für `/deploy`**, gleichrangig mit AC-8 und T4. Ein Unterschied zu jenen beiden: Die sind erst gegen das gehostete Projekt prüfbar — dieser hier ist **sofort behebbar**.

**Der Weg dorthin.** Der Hinweis ändert das Verhalten von PROJ-1 und braucht deshalb ein eigenes Acceptance Criterion. Route laut `.claude/rules/general.md` → Change Routing: **`/refine PROJ-1`** (AC ergänzen) → `/build` → `/qa`. `spec.md` wird **nicht** auf diesem Weg angefasst; sie ist der Vertrag und gehört `/refine`.

**Nicht Teil dieses Blockers, aber offen:** ob der Trainername (mindestens einmalig) änderbar sein sollte. Das ist eine Rechtsfrage, keine QA-Frage — sie liegt in `docs/privacy.md` → „Für einen Anwalt / Datenschutzbeauftragten".

---

## QA-Lauf — 2026-09-03, nach AC-15 (Hinweis am Trainername-Feld)

**Anlass:** `/build` hat T14 umgesetzt (AC-15). Geprüft wurde jedoch **nicht nur das Delta**: Alle 15 AC-IDs und 6 EC-IDs wurden in diesem Lauf neu verifiziert, ohne ein einziges Häkchen aus den Läufen vom 2026-09-01 und 2026-09-02 zu übernehmen. Das war eine bewusste Entscheidung — und sie hat sich gelohnt: Zwei der drei High-Bugs unten sind **Altlasten**, die in den früheren Läufen nicht gefunden wurden und nichts mit AC-15 zu tun haben.

**Aufbau:** Zwei `qa-engineer`-Verifizierer in getrennten Kontexten, die den Build nicht gesehen haben — Bahn A (Acceptance + Regression + Testsuite), Bahn B (Security-Red-Team). Beide gegen die laufende App (`http://localhost:3000`) und das lokale Supabase. Zusammenführung, Bewertung und dieser Report: Hauptkontext.

**Bug-Nummerierung:** Die Bahnen haben unabhängig voneinander bei BUG-1 begonnen. Hier durchnummeriert ab **BUG-6**, weil BUG-1/3/4/5 in diesem Feature bereits vergeben sind.

### Acceptance Criteria

| ID | Ergebnis | Beleg |
|----|----------|-------|
| AC-1 | [x] PASS | `registerAction` per HTTP → `x-action-redirect: /`, DB-Gegenprobe: Profil angelegt, Passwort bcrypt, keine Bestätigung nötig. Passwort < 8 → Feldfehler; Supabase lehnt zusätzlich serverseitig ab (`422 weak_password`) |
| AC-2 | [x] PASS | Registrierung mit kleingeschriebener Variante eines vergebenen Namens → Feldfehler; Durchsetzung per `profiles_trainer_name_lower_key` (`0001_profiles.sql:13`) |
| AC-3 | [x] PASS | Vergebene E-Mail → Feldfehler mit Login-Link (`error-mapping.ts:43-45`, `register-view.tsx:86-96`) |
| AC-4 | [x] PASS | Korrekter Login → `x-action-redirect: /;push` + Session-Cookie; im Browser bestätigt |
| AC-5 | [x] PASS | Cookie ist persistent (`Max-Age=34560000`), nicht sitzungsgebunden; `storageState` in frischem Browser-Kontext → `/` liefert 200 mit Startbildschirm |
| AC-6 | [x] PASS | `logoutAction` → Cookie `Max-Age=0`, Redirect `/login`; danach `/` → 307 |
| AC-7 | [x] PASS | Falsches Passwort und unbekannte Adresse liefern **identischen** String, in curl und Browser; `error-mapping.ts:61-67` verzweigt nur bei 429 |
| AC-8 | [!] **FAIL (lokal)** / NOT VERIFIED (hosted) | 35 Fehl-Logins in Folge, **kein einziges 429**, danach loggt das korrekte Passwort normal ein. Ursache belegt: `GOTRUE_RATE_LIMIT_SIGN_IN_SIGN_UPS` fehlt im lokalen Auth-Container, obwohl `config.toml:209` es setzt. → **BUG-7** |
| AC-10 | [x] PASS | Gleiche Meldung unabhängig von Kontoexistenz; Mailpit enthält genau **eine** Mail (für die existierende Adresse), keine für die unbekannte |
| AC-11 | [!] **TEILWEISE** | Im **selben** Browser vollständig grün (Reset angefordert → Mail → Link → neues Passwort → Login damit erfolgreich). **Über Gerätegrenzen hinweg gebrochen** → **BUG-6** |
| AC-12 | [x] PASS | Benutzter und tokenloser Link → „Dieser Link ist ungültig oder abgelaufen." + „Neuen Link anfordern"; serverseitig zusätzlich abgesichert (`actions.ts:146-151`) |
| AC-13 | [x] PASS | Leere Formulare → alle Feldfehler gleichzeitig; `framenavigated` auf dem Hauptframe **nicht** ausgelöst → kein Reload |
| AC-14 | [!] **Wortlaut erfüllt, Ziel defekt** | Link „Datenschutzerklärung" sichtbar mit `href="/privacy"` (`register-view.tsx:114-120`) — aber `GET /privacy` → **404** → **BUG-10** |
| AC-15 | [x] PASS | Hinweistext ohne Klick/Hover sichtbar (`register-view.tsx:68-71`), keine Checkbox im Formular; Unit-Tests grün |

_AC-9 existiert nicht — laut Decision Log gestrichen._

### Edge Cases

| ID | Ergebnis | Beleg |
|----|----------|-------|
| EC-1 | [x] PASS | 3 **parallele** Registrierungen mit demselben Trainernamen → 1 Erfolg, 2 Ablehnungen; DB: genau 1 Profil, **0** verwaiste `auth.users` ohne Profil. Zweiter Lauf mit Groß-/Kleinvarianten identisch. Garantie im Code bestätigt: Unique-Index + `SECURITY DEFINER`-Trigger in derselben Transaktion (`0001_profiles.sql:13,28-51`) |
| EC-2 | [x] PASS | `/`, `/?x=1`, `/some/deep/path`, `/api/whatever`, `/nonexistent` → alle 307 auf `/login` (Query bleibt erhalten); `/login`, `/reset-password` → 200; eingeloggt auf `/login` → 307 auf `/` |
| EC-3 | [x] PASS | Unbekannte Adresse → identische Meldung, **keine** zusätzliche Mail in Mailpit |
| EC-4 | [!] NOT VERIFIED / FAIL lokal | Deckungsgleich mit AC-8: Wo das Limit gar nicht greift, kann „bleibt weiterhin gesperrt" nicht eintreten |
| EC-5 | [x] PASS | Leerzeichen, 2 Zeichen, 21 Zeichen, Emoji → jeweils feldspezifische Ablehnung; DB-CHECK zusätzlich vorhanden |
| EC-6 | [!] **TEILWEISE FAIL** | Auth-Container per `docker pause` angehalten: Registrierung meldet korrekt „Verbindung fehlgeschlagen"; **Login meldet „E-Mail-Adresse oder Passwort ist falsch."** → **BUG-9** |

### Security-Audit (Bahn B)

| Prüfung | Ergebnis | Beleg |
|---------|----------|-------|
| Authentication Bypass | [x] PASS | Ohne Session: `/` und `/api` → 307 auf `/login`; Guard `src/proxy.ts:52-56`, serverautoritative Prüfung per `getUser()` |
| Autorisierung (Datenbankebene) | [x] PASS | Zweites Konto liest fremde Runden → `[]`; gefälschter `profile_id`-INSERT → `403 / 42501`. Anon ohne Session sieht auf `profiles` und `runs` nichts |
| Input Injection | [x] PASS | XSS-Trainername **unter Umgehung der App-Validierung** direkt an Supabase → vom DB-CHECK abgelehnt. Defense in Depth wirkt (Zod **und** Constraint) |
| Brute Force auf Zugangsdaten | [!] **FAIL** | 35 Versuche ohne Drosselung → BUG-7 |
| Account-Enumeration (Login/Reset) | [x] PASS | Identische Meldungen und Codepfade (`error-mapping.ts:61-75`) |
| Account-Enumeration (Registrierung) | [x] Bekannt, by design | Vergebene E-Mail wird offen gemeldet — dokumentierte Produktentscheidung (2026-08-31), kein Bug |
| Bulk-Signup | [!] NOT VERIFIED — nicht implementiert | 10 Konten per Schleife angelegt, alle 200, kein CAPTCHA. AC-9 bewusst gestrichen; reaktiv geplant |
| Exponierte Secrets | [x] PASS | `.next/` durchsucht: kein Service-Role-Key, kein `SECRET_KEY`, kein `JWT_SECRET` im Bundle. Nur `NEXT_PUBLIC_*` erreicht den Client |
| Sensible Daten in API-Antworten | [x] PASS | `profiles` gibt nur `id` + `trainer_name` heraus, keine E-Mail |
| Zugangsdaten in der URL | [x] PASS | Alle vier Formulare `method="post"`, kein nativer GET-Fallback |
| Security-Header | [!] **FAIL** | Keiner von `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` gesetzt → **BUG-12** |

### Bugs

#### BUG-6: Passwort-Reset funktioniert nur in dem Browser, in dem er angefordert wurde
- **Severity: High** · betrifft **AC-11**
- **Ursache:** Der Reset-Link ist PKCE. Der `code_verifier` liegt als Cookie **auf dem anfordernden Gerät** (`Set-Cookie: sb-127-auth-token-code-verifier=…` in der Antwort von `requestPasswordResetAction`). Ohne dieses Cookie ist der Tausch nicht möglich.
- **Reproduktion:** Konto anlegen → in Browser-Kontext A „Passwort vergessen?" absenden → Link aus dem Postfach in **frischem** Kontext B öffnen → „Dieser Link ist ungültig oder abgelaufen.", obwohl der Link frisch und unbenutzt ist.
- **Wirkung:** Genau der Alltagsfall „am Rechner anfordern, Mail am Handy öffnen" ist gebrochen — und die Meldung ist dabei **sachlich falsch**: Sie behauptet einen abgelaufenen Link, wo ein gültiger vorliegt. Der Nutzer fordert einen neuen an, mit demselben Ergebnis. Das ist eine Sackgasse für jeden, der sein Passwort wirklich vergessen hat.
- **Nicht durch AC-15 verursacht** — Altlast, in den Läufen vom 01./02.09. nicht entdeckt, weil dort nur innerhalb **eines** Kontexts geprüft wurde. `design.md` → Technical Decisions behauptet, die clientseitige Lösung decke „beide Formen" ab; für PKCE über Gerätegrenzen gilt das nicht.

#### BUG-7: Keine wirksame Drosselung auf dem Zugangsdaten-Pfad (lokal nachgewiesen)
- **Severity: High** · betrifft **AC-8, EC-4**
- 35 Fehl-Logins gegen dasselbe Konto von derselben IP: keine einzige Ablehnung; danach loggt das korrekte Passwort normal ein.
- **Ursache belegt:** `docker exec … env | grep RATE_LIMIT` zeigt, dass `GOTRUE_RATE_LIMIT_SIGN_IN_SIGN_UPS` im lokalen Auth-Container **nicht gesetzt** ist, obwohl `supabase/config.toml:209` `sign_in_sign_ups = 30` konfiguriert.
- **Einordnung:** Inhaltlich die bekannte Open Question — neu ist die Beweislage. Bisher stand „nicht verifizierbar"; jetzt ist **demonstriert**, dass unbegrenztes Durchprobieren lokal funktioniert. Die App hat bewusst keinen eigenen Zähler (Produktentscheidung); der einzige vorgesehene Schutz ist Supabases Per-IP-Regel — die auch im funktionierenden Zustand weder verteilte noch geduldige kontobezogene Angriffe stoppt.
- **Nicht lokal reparierbar**, aber vor dem Livegang verifizierungspflichtig.

#### BUG-8: Offene `[user]`-Aufgabe T4 auf dem Zugangsdaten-Pfad
- **Severity: High** (nach QA-Regel für offene `[user]`-Tasks auf Credential-Pfaden) · betrifft **AC-1, AC-11**
- `tasks.md:17` — Passwort-Mindestlänge 8 im gehosteten Supabase-Projekt: nicht abgehakt.
- **Entlastender Kontext:** Der lokale Spiegel ist gesetzt **und nachweislich wirksam** (`config.toml:184`; direkter API-Signup mit 5 Zeichen → `422 weak_password`). Das gehostete Projekt existiert noch nicht, die Aufgabe ist also strukturell nicht erledigbar — kein Versäumnis, aber ein echtes Gate vor `/deploy`.

#### BUG-9: Login meldet bei Supabase-Ausfall „falsches Passwort" statt Netzwerkfehler
- **Severity: Medium** · betrifft **EC-6**
- `error-mapping.ts:61-67`: `mapLoginError` verzweigt nur auf 429; jeder andere Fehler — auch ein Transportfehler ohne Status — fällt auf `WRONG_CREDENTIALS_MESSAGE`.
- **Reproduktion:** `docker pause supabase_auth_…`, dann Login mit **korrekten** Zugangsdaten → nach ~61 s „E-Mail-Adresse oder Passwort ist falsch."
- **Wirkung:** Der Nutzer hält sein Passwort für falsch und läuft in den Reset — statt es erneut zu versuchen. Der Registrierungspfad macht es richtig (`mapRegisterError` fällt auf `NETWORK_ERROR_MESSAGE`, Zeile 55); nur der Login-Pfad nicht.
- **Teilregression:** EC-6 galt am 01.09. als vollständig grün. Der damalige Fix (`run-action.ts`) behob die rohe Browser-Fehlerseite; diese Fehlklassifizierung *innerhalb* der App blieb unentdeckt.

#### BUG-10: Datenschutz-Link im Registrierungsformular zeigt auf 404
- **Severity: Medium** · betrifft **AC-14**
- `register-view.tsx:116` verlinkt `/privacy`; `GET /privacy` → **404** (curl und Browser bestätigt). `/imprint` ebenfalls 404, dort aber nirgends verlinkt.
- **Inkonsistent zur eigenen Regel des Projekts:** `site-footer.tsx:11` hält `LEGAL_PAGES` bewusst leer, „damit kein toter Link entsteht, bis PROJ-4 die Seite baut". Im Registrierungsformular wurde derselbe Gedanke nicht angewandt.
- AC-14 ist im Wortlaut erfüllt („ein Link ist sichtbar") — der Vertrag hat nur nie verlangt, dass er irgendwo hinführt.

#### BUG-11: Passwort über 72 Zeichen scheitert mit „Verbindung fehlgeschlagen"
- **Severity: Medium** · betrifft **AC-1, AC-11**
- Registrierung mit 76-Zeichen-Passwort → „Die Verbindung ist fehlgeschlagen." Tatsächliche Ursache: `400 validation_failed "Password cannot be longer than 72 characters"` (bcrypt-Grenze). Exakt 72 Zeichen → 200.
- `mapRegisterError` hat für 400 keinen Zweig (`error-mapping.ts:42-56`); `updatePasswordAction` bildet jeden Fehler auf `NETWORK_ERROR_MESSAGE` ab (`actions.ts:155-157`) — betrifft also auch den Reset-Pfad.
- **Wirkung:** Passwortmanager erzeugen solche Passphrasen. Der Nutzer bekommt kein Feld-Feedback und keinen Hinweis, was zu tun wäre.

#### BUG-12: Security-Header fehlen vollständig
- **Severity: Medium**
- `curl -i http://localhost:3000/login`: weder `X-Frame-Options` noch `X-Content-Type-Options` noch `Referrer-Policy`; keine Header-Konfiguration in `next.config.ts` oder `src/proxy.ts`.
- `.claude/rules/security.md` verlangt alle vier. Fehlendes `X-Frame-Options`/`frame-ancestors` bedeutet Clickjacking-Risiko auf der Login-Seite. HSTS ist lokal über HTTP nicht prüfbar, die anderen drei sind es und fehlen.
- Wird typischerweise beim Host konfiguriert — muss dort gegen die Live-URL verifiziert werden.

#### BUG-13: Session-Cookie ohne `HttpOnly` und ohne `Secure`
- **Severity: Medium** — **Bewertung ausdrücklich offen, siehe unten**
- `Set-Cookie: sb-127-auth-token=…; Path=/; Expires=…; Max-Age=34560000; SameSite=lax` — kein `HttpOnly`, kein `Secure`. Access- und Refresh-Token sind damit per `document.cookie` lesbar.
- **Warum es so ist:** Der clientseitige Reset-Pfad liest die Sitzung im Browser (`getSession()`), was ein `HttpOnly`-Cookie ausschließen würde. Das ist Folge einer Designentscheidung, nicht ein vergessenes Flag.
- **Ehrliche Einordnung:** Diesen Punkt hat die **Acceptance-Bahn** nebenbei bemerkt; die Security-Bahn hatte ihn nicht auf der Liste und hat ihn **nicht bewertet**. Der beobachtete Befund (die Cookie-Flags) ist gesichert, das Severity-Urteil ist es nicht. Gehört vor dem Livegang bewusst entschieden, zusammen mit BUG-6 — beide hängen am selben clientseitigen Reset-Design.

#### BUG-14: „Stattdessen einloggen" erscheint bei jedem E-Mail-Feldfehler
- **Severity: Low** · `register-view.tsx:86-96` koppelt den Hinweis an *jeden* Fehler am E-Mail-Feld, also auch an „Bitte eine gültige E-Mail-Adresse eingeben", wo er sinnlos ist.

#### BUG-15: Codekommentar widerspricht dem beobachteten Verhalten
- **Severity: Low** · `actions.ts:115-118` behauptet, der Recovery-Link liefere die Tokens „always" im URL-Fragment und „never a server-readable `?code=`". Gemessen wurde genau die `?code=`-Form. `design.md` beschreibt die Doppeldeutigkeit korrekt, der Kommentar nicht — irreführend für den nächsten, der BUG-6 anfasst.

### Regression und automatisierte Tests

- **`npm test`: 11 Dateien, 96 Tests, alle grün** (2,50 s).
- **Bestehende Playwright-Suite als Regression: 14 von 15 grün.** Der eine Fehlschlag — `tests/PROJ-2-quiz-round.spec.ts:41` in Chromium, „Erste Frage brauchte 3880 ms, erlaubt sind 3000 ms" — war bei Einzelausführung grün und in Firefox und Mobile Safari grün. **Einstufung: Flake unter 15 parallelen Workern gegen den Dev-Server, kein PROJ-1-Regressionsbruch.** Erwähnenswert bleibt: Das AC-2-Zeitbudget von PROJ-2 hat unter Last **keine Reserve**.
- **Geteilte App-Shell und Auth (PROJ-2) intakt:** ausgeloggte Kopfzeile zeigt die Merkzeile (AC-22), eingeloggte den Trainername-Chip (AC-21), `/` ausgeloggt → 307. Der PROJ-2-Kernpfad läuft in drei Browsern durch und speichert Runden.
- **Datenschicht unverändert:** `pg_policies` bestätigt `profiles_select_authenticated`, `runs_select_own`, `runs_insert_own`; `ON DELETE CASCADE` vorhanden. Deckt sich mit `docs/data-model.md`.
- Kein Feature steht auf „Deployed" — außer PROJ-2 gab es nichts zu regressionsprüfen.

### Unit-Tests aus diesem Lauf

Keine neu geschrieben. Die drei Tests zu AC-15 (`register-view.test.tsx`) stammen aus dem `/build`-Lauf und wurden dort mit Rot-Nachweis geführt; sie liefen hier als Regression grün mit. Für die neuen Bugs sind Tests Sache des Fixes, nicht dieses Laufs.

### Not Verified In This Run

- [!] **AC-8 / EC-4 gegen das gehostete Projekt** — lokal nicht auslösbar (Ursache in BUG-7 belegt). Zu prüfen nach dem ersten `/deploy`: ~35 falsche Logins gegen die öffentliche Projekt-URL, auf 429. Einstellung: **Dashboard → Authentication → Rate Limits → `sign_in_sign_ups`**
- [!] **T4** — Wert im gehosteten Projekt nicht beobachtbar, weil es das Projekt nicht gibt. **Dashboard → Authentication → Sign In / Providers → Email → Minimum password length = 8**
- [!] **Site URL / Redirect URLs im gehosteten Projekt** — lokal korrekt, hosted nicht prüfbar
- [!] **Security-Header gegen die Live-URL** — lokal fehlen alle drei prüfbaren (BUG-12); HSTS erst über HTTPS beurteilbar
- [!] **Responsives Layout bei 375 / 768 / 1440 px** — kein Viewport-Urteil. Die E2E-Suite fährt „Mobile Safari", prüft dort aber Funktion, nicht Layout
- [!] **Cross-Browser über Chromium/Firefox/WebKit hinaus** — echtes Safari, ältere Engines nicht verfügbar
- [!] **DevTools-Prüfungen** — Konsole, Netzwerk-Tab, berechnete Styles nicht durchgeführt
- [!] **Verhalten ohne JavaScript** — als bekannte Einschränkung in `design.md` dokumentiert, in diesem Lauf nicht nachgestellt
- [!] **Severity-Bewertung von BUG-13** — von keiner der beiden Bahnen abschließend beurteilt (siehe dort)

### Verdikt

- **Acceptance Criteria:** 11 von 14 geprüften bestanden · AC-8 **FAIL** (lokal) · AC-11 **teilweise** (im selben Browser grün, geräteübergreifend gebrochen) · AC-14 im Wortlaut erfüllt, Ziel defekt
- **Edge Cases:** 4 von 6 bestanden · EC-4 nicht verifizierbar · EC-6 **teilweise FAIL**
- **Bugs:** 10 neu — **3 High** (BUG-6, BUG-7, BUG-8), **5 Medium** (BUG-9 bis BUG-13), **2 Low** (BUG-14, BUG-15)
- **Security:** 8 Prüfungen mit Beleg bestanden, **2 mit Befund** (Brute Force, Security-Header), 1 NOT VERIFIED (Bulk-Signup, bewusst nicht implementiert)
- **Automatisierte Tests:** 96/96 grün · E2E 14/15 (der eine Fehlschlag ein Flake, einzeln grün)
- **Production Ready: NEIN** — drei offene High-Bugs.

> **Was „NEIN" hier heißt und was nicht.** Es heißt nicht, dass AC-15 oder der Build vom 03.09. etwas kaputt gemacht hätten — AC-15 ist grün, und die Regression ist sauber. Es heißt, dass ein **vollständiger** Sweep zwei High-Bugs gefunden hat, die in den Läufen vom 01./02.09. durchgerutscht sind: der geräteübergreifende Passwort-Reset (**BUG-6**) und die nun nachgewiesene fehlende Drosselung (**BUG-7**). PROJ-1 stand seit dem 02.09. auf `Approved` — nach diesem Lauf zu Unrecht.

> **Der wichtigste einzelne Befund ist BUG-6.** Ein Nutzer, der sein Passwort vergisst, es am Rechner zurücksetzen will und die Mail am Handy öffnet, kommt nicht wieder in sein Konto — und die App sagt ihm dabei etwas Falsches. Für ein Produkt ohne E-Mail-Bestätigung ist der Reset der einzige Weg zurück ins Konto.

---

## QA-Lauf — 2026-09-03 (zweiter Lauf des Tages), nach EC-7 und BUG-13

**Anlass:** `/build` hat den Passwort-Reset auf `token_hash` + `verifyOtp` umgestellt (T15–T17) und das Session-Cookie auf `HttpOnly`/`Secure` (BUG-13). Erneut **vollständiger Sweep**: alle 15 AC-IDs und jetzt 7 EC-IDs neu verifiziert, nichts aus früheren Läufen übernommen.

**Aufbau:** Zwei `qa-engineer`-Verifizierer in getrennten Kontexten ohne Kenntnis des Builds — Bahn A (Acceptance + Regression + Testsuite), Bahn B (Security-Red-Team). Zusammenführung und Bewertung: Hauptkontext.

**Bug-Nummerierung:** neue Befunde ab **BUG-16** (BUG-1 bis BUG-15 sind vergeben).

### Was dieser Lauf bestätigt hat

- **BUG-13 geschlossen.** Unabhängig nachgemessen: Dev `HttpOnly; SameSite=lax`, Produktions-Build zusätzlich `Secure`. Die geteilte Ablage der Cookie-Optionen wurde als Schutz gegen Flag-Verlust beim Session-Refresh erkannt.
- **BUG-15 geschlossen** (irreführender Codekommentar korrigiert).
- **Die Geräte-Bindung aus BUG-6 ist tatsächlich weg.** Bahn A hat den Token in einem **frisch gestarteten Firefox mit null Cookies** eingelöst und das Passwort gesetzt — die PKCE-Abhängigkeit vom anfordernden Gerät existiert nicht mehr.
- **`/auth/confirm` besteht die Red-Team-Prüfung:** Open-Redirect abgewehrt (auch mit gültigem Token), kein Sitzungs-Erschleichen, Token kontogebunden und einmalig.
- **Regression sauber:** `npm test` 102/102, E2E 15/15 über Chromium, Firefox und Mobile Safari, PROJ-2-Kernpfad und geteilte App-Shell intakt.

**Und trotzdem ist AC-11/EC-7 FAIL** — aus einem Grund, der mit BUG-6 nichts zu tun hat. Siehe BUG-16.

### Acceptance Criteria

| ID | Ergebnis | Beleg |
|----|----------|-------|
| AC-1 | [x] PASS | Registrierung → Redirect auf `/`, Chip mit Trainername, `profiles`-Zeile per psql bestätigt; Passwort < 8 abgelehnt (`validation/auth.ts:12`) |
| AC-2 | [x] PASS | Abweichende Groß-/Kleinschreibung → Feldfehler; Unique-Index `0001_profiles.sql:16` |
| AC-3 | [x] PASS | Vergebene E-Mail → Feldfehler mit Login-Umschalter (`register-view.tsx:96-106`) |
| AC-4 | [x] PASS | Login mit korrekten Daten → `/` |
| AC-5 | [x] PASS | Cookie persistent (Ablauf 2027-10-08, `httpOnly=true`); **neuer Browser-Prozess** mit persistiertem Cookie öffnet `/` mit 200 |
| AC-6 | [x] PASS | „Abmelden" → `/login`; anschließendes `GET /` → `/login` |
| AC-7 | [x] PASS | Falsches Passwort und unbekannte Adresse wortgleich (245 ms / 133 ms); `error-mapping.ts:61-67` verzweigt nicht |
| AC-8 | [!] NOT VERIFIED | 40 Fehl-Logins → 40× 400, kein 429. Ursache nachgeprüft: `GOTRUE_RATE_LIMIT_SIGN_IN_SIGN_UPS` fehlt in der Container-Umgebung, obwohl `config.toml:209` es setzt. Nur gehostet prüfbar → **BUG-7** (unverändert) |
| AC-10 | [x] PASS | Gleiche Meldung unabhängig von Kontoexistenz; Mail „Passwort zurücksetzen" trifft ein, Link zeigt auf `/auth/confirm?token_hash=…` |
| AC-11 | [ ] **FAIL** | Über den **tatsächlich versendeten** Link ist kein Passwortwechsel möglich → **BUG-16**. Mit host-korrigiertem Link läuft die Kette vollständig durch (Formular → 7 Zeichen abgelehnt → Passwort gesetzt → Redirect → Login mit neuem Passwort erfolgreich, altes abgelehnt) |
| AC-12 | [x] PASS | Benutzter und manipulierter Token → `?error=1`, Seite zeigt Fehlerzustand mit „Neuen Link anfordern". **Einschränkung:** durch BUG-16 erscheint dieselbe Meldung auch bei gültigen Links |
| AC-13 | [x] PASS | Leere Formulare → alle Feldmeldungen; JS-Sentinel überlebt das Absenden → kein Reload |
| AC-14 | [!] Wortlaut erfüllt, Ziel defekt | Link sichtbar mit `href="/privacy"`, aber `GET /privacy` → 404 → **BUG-10** (unverändert) |
| AC-15 | [x] PASS | Hinweistext ohne Klick/Hover sichtbar, Wortlaut zeichengenau wie im Vertrag (`register-view.tsx:76-79`) |

### Edge Cases

| ID | Ergebnis | Beleg |
|----|----------|-------|
| EC-1 | [x] PASS | Echter Race: zwei parallele Signups mit gleichem Namen in verschiedener Schreibweise → 200 + 500, genau **eine** `profiles`-Zeile; Trigger und Unique-Index in derselben Transaktion |
| EC-2 | [x] PASS | `/` und `/leaderboard` ohne Sitzung → 307 auf `/login` |
| EC-3 | [x] PASS | Reset für unbekannte Adresse: zeichengleiche Meldung, **keine** Mail in Mailpit |
| EC-4 | [!] NOT VERIFIED | Deckungsgleich mit AC-8 |
| EC-5 | [x] PASS | „ab", 21 Zeichen, Leerzeichen, Emoji, leer → jeweils Feldmeldung; serverseitig identisch abgesichert (`actions.ts:28-36`) |
| EC-6 | [x] PASS | Login-POST gekappt → „Die Verbindung ist fehlgeschlagen."; **E-Mail und Passwort bleiben erhalten**, Button wieder aktiv |
| EC-7 | [ ] **FAIL** | Die **Geräte-Unabhängigkeit selbst ist nachgewiesen** (frischer Firefox, null Cookies, host-korrigierter Link → Formular erscheint, Passwort setzbar). Der real versendete Link scheitert aber in **jedem** Browser, auch im anfordernden → **BUG-16** |

### Security-Audit (Bahn B)

| Prüfung | Ergebnis | Beleg |
|---------|----------|-------|
| Authentication Bypass | [x] PASS | `/` ohne Sitzung → 307; `getUser()` statt Signaturprüfung (`proxy.ts:51-53`) |
| Autorisierung (RLS) | [x] PASS | Mit echtem Bearer-Token von Nutzer X gegen Daten von Nutzer Y: Lesen → `[]`, gefälschter INSERT → `42501`, UPDATE/DELETE → 0 Zeilen |
| Sensible Felder | [x] PASS | `profiles` gibt nur `id`, `trainer_name`, `created_at` heraus — keine E-Mail |
| Input Injection | [x] PASS | XSS- und SQL-Payloads unter Umgehung der App direkt an Supabase → `23514` vom Check-Constraint, **kein verwaistes Konto** |
| Brute Force | [!] **FAIL** | 30 Fehlversuche ohne Drosselung → **BUG-7** |
| Account-Enumeration (Login/Reset) | [x] PASS | Identische Meldungen und Codepfade |
| Exponierte Secrets | [x] PASS | `.next/static` durchsucht nach `sb_secret`, `service_role`, `JWT_SECRET` → kein Treffer |
| Zugangsdaten in der URL | [x] PASS | Alle vier Formulare `method="post"` |
| Session-Cookie-Flags | [x] **PASS (neu)** | Dev `HttpOnly; SameSite=lax`; Produktions-Build zusätzlich `Secure` (`cookie-options.ts:19-23`) — **BUG-13 geschlossen** |
| `/auth/confirm` | [x] PASS | Fehlender/manipulierter Token → `error=1` ohne Sitzung; `next=//evil.com` abgewehrt (`route.ts:22-26`); Sitzung nur bei erfolgreichem `verifyOtp` |
| Security-Header | [!] **FAIL** | Weder Dev noch Prod liefern die vier geforderten Header → **BUG-12** (unverändert), dazu **BUG-19** |

### Bugs

#### BUG-16: Der versendete Reset-Link führt immer zu „Link ungültig oder abgelaufen"
- **Severity: High** · betrifft **AC-11, AC-12, EC-7**
- **Dies ist ein neuer Fehler, eingeführt durch den Fix vom selben Tag** — nicht der alte BUG-6. Dessen Ursache (PKCE-Bindung ans Gerät) ist nachweislich beseitigt.
- **Mechanik:** Der Mail-Link trägt den Host aus `{{ .SiteURL }}`, lokal `http://127.0.0.1:3000` (`config.toml:158`). `/auth/confirm` löst den Token korrekt ein und setzt das Cookie auf der Domain, unter der es aufgerufen wurde — **leitet aber auf einen anderen Host um**: `request.nextUrl.clone()` (`route.ts:34`) liefert `localhost:3000`, unabhängig vom eingehenden Host. Der Browser folgt nach `localhost`, schickt das auf `127.0.0.1` gesetzte Cookie nicht mit, `reset-password/page.tsx` sieht keinen Nutzer und rendert den AC-12-Fehlerzustand — über einen frischen, gültigen Link.
- **Selbst reproduziert:** `curl -i "http://127.0.0.1:3000/auth/confirm?token_hash=bogus&type=recovery"` → `location: http://localhost:3000/reset-password?error=1`.
- **Wirkung:** Der Passwort-Reset ist im aktuellen Stand **vollständig unbenutzbar** — in jedem Browser, auch in dem, der ihn angefordert hat. Da es keine E-Mail-Bestätigung gibt, ist er der einzige Weg zurück ins Konto.
- **Warum der Build ihn nicht gefunden hat:** Die Verifikation dort rief `/auth/confirm` direkt über `localhost` auf, statt dem Link zu folgen, wie er in der Mail steht. Anfrage-Host und Redirect-Host waren dadurch zufällig identisch, und der Mismatch konnte nicht auftreten. Geprüft wurde die eigene Konstruktion, nicht das ausgelieferte Artefakt.
- **Produktionsrisiko über den lokalen Fall hinaus:** Sobald Site-URL und der Host, den `request.nextUrl` liefert, auseinanderfallen — `www` gegen Apex-Domain, ein Proxy oder ein Domain-Alias —, kehrt exakt dieser Fehler zurück. Der Fix muss den Host der eingehenden Anfrage respektieren, nicht einen abgeleiteten.

#### BUG-17: `/reset-password` akzeptiert jede normale Sitzung, nicht nur eine Recovery-Sitzung
- **Severity: Medium** · **Altlast, nicht von diesem Build eingeführt**
- `reset-password/page.tsx` prüft nur, ob **ein Nutzer** angemeldet ist; `updatePasswordAction` (`actions.ts:152-158`) ebenso. Beide unterscheiden nicht zwischen einer Recovery-Sitzung und einer gewöhnlichen.
- **Wirkung:** Wer an einem offen gelassenen, angemeldeten Gerät sitzt, kann `/reset-password` aufrufen und das Passwort **ohne Eingabe des alten** ändern — und sperrt den Eigentümer damit dauerhaft aus.
- `design.md` sagt „nur über `/auth/confirm` erreichbar". Im Code steht diese Bindung nicht; das Dokument beschreibt eine Absicht, keine Durchsetzung.
- **Einordnung der Bewertung:** Von der Acceptance-Bahn als außerhalb ihres Scopes gemeldet; die Security-Bahn hatte den Punkt nicht auf ihrer Liste und hat ihn **nicht bewertet**. Der Befund ist belegt, das Severity-Urteil stammt von der Zusammenführung, nicht von einer der Prüfbahnen.

#### BUG-18: Jeder 500 bei der Registrierung wird als „Trainername bereits vergeben" angezeigt
- **Severity: Low** · betrifft **AC-3**
- `error-mapping.ts:51-53` bildet jeden Status 500 auf die Trainernamen-Meldung ab, mit dem Kommentar „nothing else in this flow produces a 500". Widerlegt: Zwei gleichzeitige Registrierungen mit **derselben E-Mail** liefern 500 mit `duplicate key … users_email_partial_key`.
- **Wirkung:** Der Nutzer sieht einen Trainernamen-Fehler für ein E-Mail-Duplikat und ändert das falsche Feld.

#### BUG-19: `X-Powered-By: Next.js` wird ausgeliefert
- **Severity: Low** · Verrät das Framework und seine Version an jeden Aufrufer, ohne Nutzen. Abschaltbar über `poweredByHeader: false` in `next.config.ts` — gehört zusammen mit BUG-12 erledigt.

#### Unverändert offen aus dem vorherigen Lauf
- **BUG-7 (High)** — AC-8, keine wirksame Drosselung; 30 bzw. 40 Fehlversuche ohne 429. Die Security-Bahn schärft nach: Selbst wenn das Limit gehostet greift, ist es **per IP** — Credential Stuffing über wechselnde IPs bleibt ungebremst, weil es keinen kontobezogenen Zähler und kein CAPTCHA gibt.
- **BUG-8 (High)** — offene `[user]`-Aufgaben auf dem Zugangsdaten-Pfad. **Jetzt zwei:** T4 (Passwort-Mindestlänge) und neu **T18** (Reset-Vorlage im gehosteten Projekt). Ohne T18 verschickt die Produktion wieder den PKCE-Standardlink und die Geräte-Bindung aus BUG-6 ist zurück.
- **BUG-10 (Medium)** — Datenschutz-Link → 404.
- **BUG-12 (Medium)** — Security-Header fehlen, in Dev **und** im Produktions-Build.
- **BUG-14 (Low)** — „Stattdessen einloggen" erscheint bei jedem E-Mail-Feldfehler.

### Regression und automatisierte Tests

- **`npm test`: 12 Dateien, 102 Tests, alle grün.**
- **E2E-Suite: 15/15 grün** über Chromium, Firefox und Mobile Safari — anders als im Vorlauf **kein** Flake.
- **PROJ-2-Kernpfad intakt:** „Runde spielen bis zum gespeicherten Ergebnis" und „Angemeldet ins Spiel, nach dem Abmelden wieder gesperrt" grün.
- **Geteilte App-Shell und Proxy intakt:** Trainername-Chip und „Abmelden" rendern, `logoutAction` beendet die Sitzung, `/` und `/leaderboard` ohne Sitzung → 307, mit Sitzung `/login` → `/`.
- **`npm run lint`: grün.**

### Not Verified In This Run

- [!] **AC-8 / EC-4 gehostet** — `GOTRUE_RATE_LIMIT_SIGN_IN_SIGN_UPS` fehlt in der lokalen Container-Umgebung. Prüfung nach dem ersten `/deploy`: ~35 Fehlversuche gegen die Live-URL. Stelle: **Dashboard → Authentication → Rate Limits → `sign_in_sign_ups`**
- [!] **T4 / T18** — gehostete Dashboard-Einstellungen von hier aus nicht einsehbar; nur der lokale Spiegel ist belegt
- [!] **Verteilter bzw. kontobezogener Brute-Force in Produktion** — strukturell offen, von hier aus nicht messbar
- [!] **Verhalten des Reset-Links unter echter Produktions-Domain** — hängt an BUG-16 und T18
- [!] **Responsives Layout bei 375 / 768 / 1440 px** — kein Viewport-Urteil. Die E2E-Suite fährt ein iPhone-13-Profil, prüft dort aber Funktion, nicht Layout
- [!] **Cross-Browser über Chromium/Firefox/WebKit hinaus** — nicht verfügbar
- [!] **DevTools-Prüfungen** — Konsole, Netzwerk-Tab, berechnete Styles nicht durchgeführt
- [!] **Severity-Bewertung von BUG-17** — von keiner Prüfbahn abschließend beurteilt (siehe dort)

### Verdikt

- **Acceptance Criteria:** 12 von 14 geprüften bestanden · **AC-11 FAIL** · AC-8 nicht verifizierbar · AC-14 im Wortlaut erfüllt, Ziel defekt
- **Edge Cases:** 5 von 7 bestanden · **EC-7 FAIL** · EC-4 nicht verifizierbar
- **Bugs:** 4 neu — **1 High** (BUG-16), 1 Medium (BUG-17), 2 Low (BUG-18, BUG-19). Unverändert offen: 2 High (BUG-7, BUG-8), 2 Medium (BUG-10, BUG-12), 1 Low (BUG-14). **Geschlossen: BUG-13, BUG-15**
- **Security:** 10 Prüfungen mit Beleg bestanden, 2 mit Befund (Brute Force, Security-Header)
- **Automatisierte Tests:** 102/102 · E2E 15/15 · Lint grün
- **Production Ready: NEIN** — drei offene High-Bugs.

> **Der Fix hat sein Ziel erreicht und ist trotzdem nicht fertig.** Die Geräte-Bindung, wegen der dieser Umbau gemacht wurde, ist beseitigt — nachgewiesen in einem frischen Browser ohne ein einziges Cookie. Darüber gelegt hat sich ein neuer Fehler derselben Klasse: Wieder scheitert der Reset, wieder mit einer Meldung, die etwas Falsches behauptet, diesmal wegen eines Host-Mismatches statt eines fehlenden Cookies. Für den Nutzer ist das Ergebnis identisch mit vorher.

> **Warum der Build das nicht gesehen hat, ist die wichtigere Lehre.** Die Verifikation dort hat `/auth/confirm` direkt über `localhost` aufgerufen, statt dem Link zu folgen, wie er in der Mail steht. Damit waren Anfrage-Host und Redirect-Host zufällig gleich und der Fehler unsichtbar. Geprüft wurde die eigene Konstruktion, nicht das ausgelieferte Artefakt — genau der Unterschied, den ein unabhängiger Verifizierer aufdeckt und der Erbauer strukturell übersieht.
