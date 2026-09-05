# Feature Index

> Central tracking for all features. Updated by skills automatically.

## Status Legend
- **Roadmap** - `/init` done, feature identified in feature map, no spec file yet
- **Mapped** - already built before the kit arrived; proposed by `/map`, confirmed at `/init`, no spec folder yet — `/reverse-spec` writes it
- **Spec'd** - `/reverse-spec` done: runs in production, criteria confirmed, not yet verified — `/qa` closes that gap
- **Planned** - `/write-spec` done, full spec written, architecture not yet designed
- **Architected** - `/architecture` done, tech design approved, ready to build
- **Tasked** - `/tasks` done, tasks.md approved, ready to build
- **In Progress** - `/build` active or completed, not yet in QA
- **In Review** - `/qa` active, testing in progress
- **Approved** - `/qa` passed, no critical/high bugs, ready to deploy
- **Deployed** - `/deploy` done, live in production

## Features

> The **Spec** column links to the feature **folder** (`features/PROJ-X-name/`), not a single file. Each folder contains `spec.md`, `design.md`, `tasks.md`, and `qa-report.md`.
>
> **Feature** is the name only — two to four words, the way you would say it ("User accounts & login", "Kanban board"). **Description** is one sentence of what it does. Priority and dependencies are not columns: they are the **build order** line under the table, and it is the only place they live — there is no second roadmap table anywhere else.

| ID | Feature | Description | Status | Spec | Created |
|----|---------|-------------|--------|------|---------|
| PROJ-1 | Benutzerkonto & Login | Registrierung und Anmeldung per E-Mail/Passwort, dazu ein eindeutiger Trainername als öffentlicher Anzeigename | In Review | [Spec](PROJ-1-user-login/spec.md) | 2026-08-30 |
| PROJ-2 | Pokémon-Quiz | Eine Runde aus Bild-Fragen mit vier deutschen Namensoptionen, Serien-Zähler und Zeitmessung bis zum ersten Fehler | Approved | [Spec](PROJ-2-pokemon-quiz/spec.md) | 2026-08-30 |
| PROJ-3 | Weltrangliste | Globale Top-5 nach Serie absteigend, bei Gleichstand nach Zeit aufsteigend, mit Eintrag des eigenen Ergebnisses | Planned | [Spec](PROJ-3-leaderboard/spec.md) | 2026-08-30 |
| PROJ-4 | Datenschutz & Kontolöschung | Datenschutzerklärung und die Möglichkeit, das eigene Konto samt Ranglisten-Einträgen zu löschen | Roadmap | — | 2026-08-30 |

**Build order:** P0 (MVP): PROJ-1 → PROJ-2 → PROJ-3 · P1: PROJ-4 (braucht PROJ-1)

<!-- Add features above this line -->

## Deploy-Blocker

> Dinge, die den jetzigen Stand **nicht** kaputt machen — die Features sind zu Recht `Approved` —, die aber vor dem öffentlichen Start erledigt sein müssen. `/deploy` arbeitet diese Liste ab. Die vollständige Einordnung steht jeweils im `qa-report.md` des Features.

| Feature | Blocker | Behebbar |
|---------|---------|----------|
| PROJ-1 | ~~**AC-8 / EC-4** — Rate-Limit lokal nicht auslösbar~~ — **erledigt** am 2026-09-04: gegen das gehostete Projekt gemessen, 429 bei Versuch 33. BUG-7 geschlossen | ✅ |
| PROJ-1 | ~~**AC-8 verspricht einen Schutz, den die Architektur nicht liefern kann** (BUG-21)~~ — **erledigt** am 2026-09-05. Beide geforderten Hälften liegen vor: Der eigene, zweiteilige Zähler ist seit BUG-29 gebaut und gemessen (Verbindung 5/Min, Konto 20/15 Min, Erstattung bei Erfolg), und `/refine` hat AC-8 und EC-4 darauf umgeschrieben sowie AC-16/AC-17/AC-18 und EC-8/EC-9 ergänzt. Supabases Regel steht nur noch als zweite Ebene im Vertrag, ausdrücklich als Untergrenze statt als Schutz. **Die Wirksamkeit der IP-Hälfte hängt weiterhin an BUG-61** (Zeile weiter unten) — das ist jetzt auch in AC-8 als Bedingung ausgeschrieben, statt stillschweigend vorausgesetzt zu werden | ✅ |
| **PROJEKT** | **Site-URL im gehosteten Projekt steht auf `http://localhost:3000`** — vom abgebrochenen `supabase config push` geschrieben, am 2026-09-04 im Dashboard bestätigt. Ohne Korrektur zeigt jeder Mail-Link in Produktion ins Leere. Zusammen mit der Absender-Domain zu setzen | beim Deploy, zwingend |
| **PROJEKT** | **Eigener SMTP-Dienst und Absender-Domain fehlen** — Supabases eingebauter Versand stellt nur an Team-Adressen zu (2/Stunde, nicht für Produktion). **Der Passwort-Reset funktioniert für echte Spieler damit gar nicht**, und ohne eigenen SMTP bleiben die E-Mail-Vorlagen im Free Tier gesperrt. Siehe `docs/PRD.md` → Rahmenbedingungen | **blockiert** — keine Domain vorhanden (Stand 2026-09-04) |
| PROJ-1 | **T18** — Reset-Mail-Vorlage im gehosteten Projekt setzen. Ohne sie verschickt die Produktion den PKCE-Standardlink und der geräteübergreifende Reset (EC-7) ist erneut kaputt. **Nicht setzbar**, solange kein eigener SMTP-Dienst konfiguriert ist: `supabase config push` scheitert mit `400 Email template modification is not available for free tier projects using the default email provider` | erst nach eigenem SMTP |
| PROJ-1 | **T4** — Passwort-Mindestlänge (8) im Dashboard des gehosteten Projekts setzen. Der lokale Spiegel in `config.toml` ist gesetzt und verifiziert | erst nach dem ersten `/deploy` |
| PROJ-1 | **AC-11 / AC-12** — der Passwort-Reset-Link hängt an Site-URL und Redirect-URLs des gehosteten Projekts | erst gegen das gehostete Projekt |
| PROJ-1 | ~~**Warnhinweis am Trainername-Feld**~~ — **erledigt** am 2026-09-03: `AC-15` gebaut (`T14`) und im QA-Lauf verifiziert | ✅ |
| PROJ-1 | **Security-Header fehlen** — `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` sind nirgends gesetzt (BUG-12). Werden beim Host konfiguriert und müssen gegen die Live-URL geprüft werden. **Am 2026-09-04 im QA-Lauf zu PROJ-2 neu bewertet: Medium statt Low** — es trifft jede Route, auch die Shell, und `Referrer-Policy` ist in einem Produkt mit Bild-Weiterleitung nicht kosmetisch | beim Deploy |
| PROJ-1 | **⛔ Härtester Deploy-Blocker: Der Host muss `x-forwarded-for` selbst setzen und einen vom Client mitgebrachten Wert verwerfen** (BUG-61, ursprünglich High — am 2026-09-05 auf Entscheidung des Nutzers zum Deploy-Blocker umgestuft; BUG-53 geht darin auf). **Beide Richtungen sind Pflicht:** *(a)* Setzt der Host **gar keinen** Header, fallen alle Spieler auf den gemeinsamen Zählerschlüssel `unbekannt` mit 5 Versuchen pro Minute — der Schutz wird zur Aussperr-Waffe gegen die eigenen Nutzer. *(b)* **Hängt** der Host nur **an**, statt zu überschreiben (der gewöhnliche nginx-Aufbau mit `proxy_add_x_forwarded_for`), bleibt der erste Eintrag angreiferkontrolliert und die IP-Hälfte der Drosselung ist mit einer Kopfzeile abschaltbar: **gemessen 40 Rateversuche gegen 40 verschiedene Konten in 5 s, null abgewiesen**, dazu 25 neue Konten in 9 s. Ohne CAPTCHA (bewusst nicht vorhanden) ist der IP-Zähler die einzige Bremse gegen Passwort-Spraying.<br>**Anbieter-Voraussetzung:** ein Host, der den Header selbst setzt bzw. überschreibt — **Vercel tut das**; bei einem eigenen nginx/Traefik-Aufbau muss die Konfiguration ausdrücklich auf Überschreiben statt Anhängen gestellt werden. `deploy` steht in `.ai-eng-kit` noch auf `null`.<br>**Schließbedingung — und nur diese:** gegen die **echte Live-URL** gemessen, dass ein selbst gesetzter `x-forwarded-for` den Zähler **nicht** beeinflusst (Rateversuche mit rotierendem Header müssen ab dem 6. abgewiesen werden). Erst dann gilt BUG-61 als geschlossen. Eine Zusage des Anbieters in einer Dokumentation genügt nicht | beim Deploy, **zwingend** |
| PROJ-2 | **`X-Forwarded-Host` hebelt die Origin-Prüfung der Server Actions aus** (BUG-18) — aus dem Browser nicht ausnutzbar (`sameSite: lax`, Preflight scheitert), **aber** ein echter CSRF-Vektor, sobald ein Reverse Proxy oder CDN davorsteht, das clientseitige `X-Forwarded-Host`-Header nicht verwirft. Beim gewählten Host prüfen und den Header dort strippen | beim Deploy |

## Next Available ID: PROJ-5
