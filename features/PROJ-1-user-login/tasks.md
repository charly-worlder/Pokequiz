# PROJ-1 Tasks

> Generiert von `/tasks` aus `spec.md` + `design.md`. Der geordnete, nachvollziehbare Bauplan — die Brücke zwischen Vertrag (WAS) und Umsetzung (WIE).
> `[P]` = parallelisierbar: Die Dateien der Aufgabe sind disjunkt von jeder anderen `[P]`-Aufgabe derselben Ebene, `/build` kann sie in einen eigenen Subagenten auslagern.
> Ebenen laufen **sequenziell** (jede ist eine Barriere). Aufgaben **innerhalb** einer Ebene laufen parallel, wo `[P]` markiert ist. Jede Aufgabe referenziert die AC-IDs aus `spec.md`, die sie erfüllt — das ist die AC → Task → Test-Rückverfolgbarkeit.
> `[user]` = eine Einstellung, die nur der Nutzer treffen kann, im Dashboard eines Anbieters: `where:` statt `files:`, nie `[P]`, wird vom Nutzer abgehakt — `/build` übergibt sie, `/deploy` liefert nicht aus, solange sie offen ist.
> Owner: `/tasks` erstellt diese Datei; `/build` hakt die Kästchen ab — außer `[user]`-Aufgaben, die der Nutzer selbst abhakt.
> Kein Status-Feld hier — die abgehakten Kästchen unten sind der Fortschritt dieser Datei, der Status des Features lebt ausschließlich in `features/INDEX.md`.

## Level 1 — Data / Schema & Foundation

<!-- Fundament: Datenbank, Migration, Clients, Validierung. Läuft zuerst, weil alles andere auf dem Datenvertrag aufbaut. -->

- [x] T1 [P]  Migration: `profiles`-Tabelle, case-insensitive Unique-Index auf Trainername, RLS (SELECT für alle eingeloggten Nutzer, keine Schreibrechte über die Anwendung), Trigger legt das Profil beim Registrieren an (liest den Trainernamen aus den Nutzer-Metadata, läuft in derselben Transaktion wie die Kontoerstellung)  · files: supabase/migrations/0001_profiles.sql  · → AC-1, AC-2, EC-1
- [x] T2 [P]  Supabase-SSR-Clients (Server- und Browser-Client) für Server Actions und den Proxy  · files: src/lib/supabase/server.ts, src/lib/supabase/client.ts  · → AC-1, AC-4, AC-5, AC-6
- [x] T3 [P]  Zod-Validierungsschemas für E-Mail, Passwort (≥ 8 Zeichen) und Trainername (3–20 Zeichen, a–z/A–Z/0–9/_)  · files: src/lib/validation/auth.ts  · → AC-1, AC-2, AC-11, AC-13, EC-5
- [x] T4 [user]  Supabase (gehostetes Projekt — braucht **nur** ein gehostetes Projekt, **keinen** App-Deploy): Passwort-Mindestlänge auf 8 setzen  · where: Dashboard → Authentication → Sign In / Providers → Email → Minimum password length: 8  · → AC-1, AC-11  · **vom Nutzer gesetzt am 2026-09-05**, am selben Tag gegen das gehostete Projekt gegengemessen: 7 Zeichen → `422 weak_password`, kein Konto angelegt

<!-- T15–T18 nachgetragen am 2026-09-03 durch /refine PROJ-1. Anlass: BUG-6 aus dem
     QA-Lauf — der Reset-Link funktionierte nur im anfordernden Browser. -->

- [x] T15 [P]  E-Mail-Vorlage für den Passwort-Reset: `supabase/templates/recovery.html` mit Link auf `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`, dazu `[auth.email.template.recovery]` in `config.toml`  · files: supabase/templates/recovery.html, supabase/config.toml  · → AC-11, EC-7
- [ ] T18 [user]  Supabase (gehostetes Projekt): dieselbe Reset-Vorlage setzen  · where: Dashboard → Authentication → Email Templates → Reset Password  · → AC-11, EC-7

<!-- T20–T23 nachgetragen am 2026-09-05 durch /refine PROJ-1. Anlass: BUG-29 aus dem
     QA-Lauf zu PROJ-2 — die Zugangsdaten-Pfade waren ungedrosselt, und die Nachbesserungen
     (BUG-39, BUG-47, BUG-54, BUG-56) liefen ohne Task-Zeile. Die Arbeit war zum Zeitpunkt
     des Nachtrags bereits erledigt, gemessen und getestet; diese Zeilen beauftragen nichts
     Neues, sie halten die Kette AC → Task → Test intakt. -->

- [x] T20 [P]  Migrationen der Drosselung: Zählertabelle `auth_throttle`, Hochzählen **und** Prüfen in einem einzigen Statement, damit gleichzeitige Anfragen sich nicht überholen (`0003`); Erstattung des eigenen Versuchs nach erfolgreichem Login, mit `greatest(attempts - 1, 0)` gegen negative Zähler (`0004`); Aufbewahrung — Aufräumen im Zählpfad plus Trigger auf `auth.users`, der die Konto-Schlüssel mit dem Konto löscht, während die IP-Schlüssel bewusst stehen bleiben (`0005`). Ausführungsrecht ausschließlich für `service_role`  · files: supabase/migrations/0003_auth_throttle.sql, supabase/migrations/0004_auth_throttle_refund.sql, supabase/migrations/0005_auth_throttle_retention.sql  · → AC-8, AC-16, AC-17, AC-18, EC-4
- [x] T21 [P]  Supabase-Admin-Client mit dem Service-Role-Schlüssel: `server-only`, bewusst **ohne** `NEXT_PUBLIC_`-Präfix. Nachgemessen gegen einen Produktions-Build, dass der Schlüssel weder in `.next/static` noch in einer ausgelieferten Antwort auftaucht — mit Kontrollstring, sonst wäre der Negativbefund wertlos  · files: src/lib/supabase/admin.ts  · → AC-18

## Level 2 — API

<!-- Server Actions und Routenschutz. Hängt vom Datenvertrag aus Level 1 ab. Disjunkte Dateien → beide [P]. -->

- [x] T5 [P]  Server Actions: registrieren, einloggen, abmelden, Passwort-Reset anfordern, neues Passwort setzen — inkl. Unterscheidung Duplikat-E-Mail (AC-3) vs. Duplikat-Trainername (AC-2, EC-1), identischer Fehlermeldung bei falschem Login (AC-7), gleicher Bestätigungsmeldung unabhängig von Kontoexistenz beim Reset (AC-10, EC-3); ruft Supabase Auth direkt auf. ~~keine eigene Drosselungsprüfung~~ — **überholt am 2026-09-05:** Die eigene Drosselung kam mit T22 hinzu und sitzt in genau diesen Actions  · files: src/lib/auth/actions.ts, src/lib/auth/error-mapping.ts  · → AC-1, AC-2, AC-3, AC-4, AC-6, AC-7, AC-10, AC-11, AC-12, AC-13, EC-1, EC-3
- [x] T16 [P]  Server-Route `/auth/confirm`: liest `token_hash` und `type`, ruft `verifyOtp({ type, token_hash })`, setzt die Sitzung serverseitig, leitet auf `next` weiter (Standard `/reset-password`); bei fehlendem oder ungültigem Token Weiterleitung auf `/reset-password` mit Fehlerkennzeichnung. `/auth/confirm` muss im Proxy öffentlich erreichbar sein  · files: src/app/auth/confirm/route.ts, src/proxy.ts  · → AC-11, AC-12, EC-7
- [x] T22  Drosselung in den Server Actions selbst — **nicht** im Proxy, weil Next.js eine Server Action nicht an ihre Route bindet und eine Schranke am Pfad über jede andere Route umgehbar wäre (BUG-30, BUG-31). Enthält: Verbindungs-Zähler (5/Min für Login und Registrierung, getrennte Schlüssel; 3/5 Min für den Reset), Konto-Zähler (20/15 Min), Erstattung des eigenen Versuchs bei erfolgreichem Login, Leeren des Konto-Zählers, und Verweigerung statt Durchlassen, wenn der Zähler nicht erreichbar ist. **Nicht `[P]`:** berührt dieselben Dateien wie T5  · files: src/lib/auth/throttle.ts, src/lib/auth/actions.ts, src/lib/auth/error-mapping.ts  · → AC-8, AC-16, AC-17, AC-18, EC-4, EC-8, EC-9
- [x] T24  Eigene Konto-Grenze für den Passwort-Reset (AC-19): `LIMITS` bekommt einen Wert `passwordResetPerAccount` (5 / 3600 s), und `registerAttempt` nimmt ihn für den Scope `password-reset` statt `credentialsPerAccount`. Die Meldung bleibt die von AC-10, damit über die Kontoexistenz weiterhin nichts verraten wird. **Nicht `[P]`:** dieselbe Datei wie T22  · files: src/lib/auth/throttle.ts, src/lib/auth/throttle.test.ts  · → AC-19, AC-17
- [x] T25  Drosselung der Token-Einlösung (AC-20): `/auth/confirm` ruft vor `verifyOtp` denselben Zähler auf wie die Actions, mit einem eigenen Scope und 10 / 900 s je Verbindung; bei Abweisung Weiterleitung in den bestehenden Fehlerzustand von AC-12, ohne neue Meldung. **Nicht `[P]`:** hängt an T24 (gemeinsame `LIMITS`) und berührt die Route aus T16  · files: src/app/auth/confirm/route.ts, src/lib/auth/throttle.ts, src/app/auth/confirm/route.test.ts  · → AC-20, AC-12
- [x] T6 [P]  Proxy: Routenschutz (ausgeloggt → `/login` außer `/login`, `/reset-password`, `/privacy`, `/imprint`; eingeloggt auf `/login` → `/`) — Next.js 16 benennt "Middleware" in "Proxy" um  · files: src/proxy.ts  · → EC-2

## Level 3 — UI

<!-- Client-Komponenten. Hängt vom API-Vertrag aus Level 2 ab ("Datenvertrag vor UI"). Disjunkte Dateien → alle [P]. -->

- [x] T7 [P]  `/login`-Seite + AuthCard-Umschalter zwischen LoginView, RegisterView und ForgotPasswordView  · files: src/app/login/page.tsx, src/components/auth/auth-card.tsx  · → AC-1, AC-14
- [x] T8 [P]  LoginView: E-Mail-/Passwort-Feld, Fehler-/Sperr-Meldung, Umschalt-Link  · files: src/components/auth/login-view.tsx  · → AC-4, AC-7, AC-8, AC-13
- [x] T9 [P]  RegisterView: Trainername-/E-Mail-/Passwort-Feld, Link zur Datenschutzerklärung, feldspezifische Fehlermeldungen  · files: src/components/auth/register-view.tsx  · → AC-1, AC-2, AC-3, AC-13, AC-14, EC-5
- [x] T10 [P]  ForgotPasswordView: E-Mail-Feld, immer gleiche Bestätigungsmeldung  · files: src/components/auth/forgot-password-view.tsx  · → AC-10, EC-3
- [x] T11 [P]  `/reset-password`-Seite + Formular: Code-Tausch gegen Recovery-Sitzung, neues-Passwort-Feld, Fehlermeldung bei ungültigem/abgelaufenem Link  · files: src/app/reset-password/page.tsx, src/components/auth/reset-password-form.tsx  · → AC-11, AC-12
- [x] T17  `/reset-password` auf serverseitige Sitzungsprüfung umstellen: Seite prüft die Sitzung auf dem Server und rendert entweder das Formular oder den AC-12-Fehlerzustand; die clientseitige Fragment-/`getSession()`-Logik und der „Link wird geprüft"-Zwischenzustand entfallen. Dabei den überholten Kommentar in `actions.ts:115-118` korrigieren (BUG-15) und prüfen, ob das Session-Cookie jetzt `HttpOnly` werden kann (BUG-13) — falls ja, als eigener Befund melden, nicht stillschweigend mitändern. **Nicht `[P]`:** hängt an T16 und berührt dieselbe Route  · files: src/app/reset-password/page.tsx, src/components/auth/reset-password-form.tsx, src/lib/auth/actions.ts  · → AC-11, AC-12, EC-7
- [x] T12 [P]  Platzhalter-Startseite (bestehende Scaffold-Seite): zeigt „Eingeloggt als {Trainername}" + Abmelden-Button, rein zur Testbarkeit von AC-4/AC-6 bis PROJ-2 die echte Startseite baut  · files: src/app/page.tsx  · → AC-4, AC-6

## Level 4 — Polish

<!-- Querschnittliche Zustände über alle Formulare hinweg, plus Integrationsdurchlauf gegen jede AC/EC. -->

- [x] T13  Netzwerkfehler-Behandlung über alle vier Formulare hinweg (Fehlermeldung + „Erneut versuchen", eingegebene Werte bleiben erhalten) und Integrationsdurchlauf gegen alle AC-IDs und EC-IDs aus `spec.md`  · files: src/components/auth/login-view.tsx, src/components/auth/register-view.tsx, src/components/auth/forgot-password-view.tsx, src/components/auth/reset-password-form.tsx  · → EC-6

<!-- Nachgetragen am 2026-09-03 durch /refine PROJ-1. Anlass: /dsgvo PROJ-3 deckte auf,
     dass der Trainername veröffentlicht wird, ohne dass die Registrierung es sagt.
     Nicht [P]: berührt dieselbe Datei wie T9 und läuft deshalb nie parallel dazu. -->

- [x] T19  RegisterView: Der Datenschutz-Hinweis trägt einen Link nur, wenn `/privacy` existiert — bis dahin unverlinkter Text. Nach dem Muster von `site-footer.tsx` (`LEGAL_PAGES`), damit PROJ-4 beide Stellen an einer erkennbaren Konvention findet  · files: src/components/auth/register-view.tsx  · → AC-14
- [x] T23  Abnahmetests der Drosselung, zweiseitig angelegt: `tests/PROJ-1-throttle.spec.ts` fährt von **einer** Verbindung und prüft beide Richtungen — der Angreifer wird gebremst (BUG-39) **und** ein Erfolg kostet nichts (BUG-54); einer der beiden allein war bei jedem der drei Codestände grün und hätte den jeweiligen Fehler durchgelassen. `src/lib/auth/throttle.test.ts` deckt Schlüsselbildung, Grenzwerte, den engeren Reset-Wert und das Werfen-statt-Durchwinken bei Datenbankfehlern ab  · files: tests/PROJ-1-throttle.spec.ts, src/lib/auth/throttle.test.ts  · → AC-8, AC-16, AC-17, AC-18
- [x] T14  RegisterView: Hinweistext am Trainername-Feld — „Dein Trainername ist für alle Spieler auf der Bestenliste sichtbar und kann später nicht mehr geändert werden." Dauerhaft sichtbar (kein Tooltip, kein Aufklappen), dem Feld per `aria-describedby` zugeordnet, damit Screenreader ihn beim Fokussieren vorlesen. **Keine** Bestätigungs-Checkbox  · files: src/components/auth/register-view.tsx  · → AC-15

## Parallelization

- **Ebenen sind Barrieren.** Eine Ebene startet erst, wenn die vorherige vollständig integriert und gegen ihre AC-IDs verifiziert ist. Das hält den Datenvertrag vor der UI: Schema (L1) → API (L2) → UI (L3) → Politur (L4).
- **`[P]` verlangt disjunkte Dateien.** Zwei `[P]`-Aufgaben derselben Ebene listen nie denselben Pfad unter `files:`. Würden sie dieselbe Datei berühren, sind sie **nicht** beide `[P]` — sequenziell setzen (bei einer `[P]` streichen) oder zu einer Aufgabe zusammenführen.
- **Grobkörnig, nicht mikro.** Aufgaben sind sinnvolle Prüfpunkte (24 in diesem Feature), keine Einzeiler.
- **`[user]`-Aufgaben sind nie parallel und werden nie gebaut.** Sie stehen in der Ebene, deren Code von ihnen abhängt; `/build` gibt bei Erreichen der Ebene die Übergabe aus (was, wo, welcher Wert) und macht weiter — das Kästchen bleibt offen, bis der Nutzer es abhakt.
- Während `/build` läuft jede `[P]`-Aufgabe der aktiven Ebene in einem eigenen Subagenten mit isoliertem Git-Worktree; danach integriert der Hauptagent, verifiziert gegen die AC-IDs der Ebene und hakt die Kästchen hier ab. Subagenten erklären sich nie selbst für fertig — es gibt einen Verifizierungs-Owner.
- **Schnittstelle zu PROJ-2:** T12 ist ein bewusster, temporärer Platzhalter auf `/` — PROJ-2 ersetzt `src/app/page.tsx` vollständig durch die echte Startseite (Spiel starten, spielen, Ergebnis sehen).
