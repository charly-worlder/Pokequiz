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
- [ ] T4 [user]  Supabase (gehostetes Projekt — braucht **nur** ein gehostetes Projekt, **keinen** App-Deploy): Passwort-Mindestlänge auf 8 setzen  · where: Dashboard → Authentication → Sign In / Providers → Email → Minimum password length: 8  · → AC-1, AC-11

<!-- T15–T18 nachgetragen am 2026-09-03 durch /refine PROJ-1. Anlass: BUG-6 aus dem
     QA-Lauf — der Reset-Link funktionierte nur im anfordernden Browser. -->

- [x] T15 [P]  E-Mail-Vorlage für den Passwort-Reset: `supabase/templates/recovery.html` mit Link auf `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`, dazu `[auth.email.template.recovery]` in `config.toml`  · files: supabase/templates/recovery.html, supabase/config.toml  · → AC-11, EC-7
- [ ] T18 [user]  Supabase (gehostetes Projekt): dieselbe Reset-Vorlage setzen  · where: Dashboard → Authentication → Email Templates → Reset Password  · → AC-11, EC-7

## Level 2 — API

<!-- Server Actions und Routenschutz. Hängt vom Datenvertrag aus Level 1 ab. Disjunkte Dateien → beide [P]. -->

- [x] T5 [P]  Server Actions: registrieren, einloggen, abmelden, Passwort-Reset anfordern, neues Passwort setzen — inkl. Unterscheidung Duplikat-E-Mail (AC-3) vs. Duplikat-Trainername (AC-2, EC-1), identischer Fehlermeldung bei falschem Login (AC-7), gleicher Bestätigungsmeldung unabhängig von Kontoexistenz beim Reset (AC-10, EC-3); ruft Supabase Auth direkt auf, keine eigene Drosselungsprüfung  · files: src/lib/auth/actions.ts, src/lib/auth/error-mapping.ts  · → AC-1, AC-2, AC-3, AC-4, AC-6, AC-7, AC-8, AC-10, AC-11, AC-12, AC-13, EC-1, EC-3, EC-4
- [x] T16 [P]  Server-Route `/auth/confirm`: liest `token_hash` und `type`, ruft `verifyOtp({ type, token_hash })`, setzt die Sitzung serverseitig, leitet auf `next` weiter (Standard `/reset-password`); bei fehlendem oder ungültigem Token Weiterleitung auf `/reset-password` mit Fehlerkennzeichnung. `/auth/confirm` muss im Proxy öffentlich erreichbar sein  · files: src/app/auth/confirm/route.ts, src/proxy.ts  · → AC-11, AC-12, EC-7
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

- [x] T14  RegisterView: Hinweistext am Trainername-Feld — „Dein Trainername ist für alle Spieler auf der Bestenliste sichtbar und kann später nicht mehr geändert werden." Dauerhaft sichtbar (kein Tooltip, kein Aufklappen), dem Feld per `aria-describedby` zugeordnet, damit Screenreader ihn beim Fokussieren vorlesen. **Keine** Bestätigungs-Checkbox  · files: src/components/auth/register-view.tsx  · → AC-15

## Parallelization

- **Ebenen sind Barrieren.** Eine Ebene startet erst, wenn die vorherige vollständig integriert und gegen ihre AC-IDs verifiziert ist. Das hält den Datenvertrag vor der UI: Schema (L1) → API (L2) → UI (L3) → Politur (L4).
- **`[P]` verlangt disjunkte Dateien.** Zwei `[P]`-Aufgaben derselben Ebene listen nie denselben Pfad unter `files:`. Würden sie dieselbe Datei berühren, sind sie **nicht** beide `[P]` — sequenziell setzen (bei einer `[P]` streichen) oder zu einer Aufgabe zusammenführen.
- **Grobkörnig, nicht mikro.** Aufgaben sind sinnvolle Prüfpunkte (18 in diesem Feature), keine Einzeiler.
- **`[user]`-Aufgaben sind nie parallel und werden nie gebaut.** Sie stehen in der Ebene, deren Code von ihnen abhängt; `/build` gibt bei Erreichen der Ebene die Übergabe aus (was, wo, welcher Wert) und macht weiter — das Kästchen bleibt offen, bis der Nutzer es abhakt.
- Während `/build` läuft jede `[P]`-Aufgabe der aktiven Ebene in einem eigenen Subagenten mit isoliertem Git-Worktree; danach integriert der Hauptagent, verifiziert gegen die AC-IDs der Ebene und hakt die Kästchen hier ab. Subagenten erklären sich nie selbst für fertig — es gibt einen Verifizierungs-Owner.
- **Schnittstelle zu PROJ-2:** T12 ist ein bewusster, temporärer Platzhalter auf `/` — PROJ-2 ersetzt `src/app/page.tsx` vollständig durch die echte Startseite (Spiel starten, spielen, Ergebnis sehen).
