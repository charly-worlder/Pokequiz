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
| PROJ-2 | Pokémon-Quiz | Eine Runde aus Bild-Fragen mit vier deutschen Namensoptionen, Serien-Zähler und Zeitmessung bis zum ersten Fehler | In Progress | [Spec](PROJ-2-pokemon-quiz/spec.md) | 2026-08-30 |
| PROJ-3 | Weltrangliste | Globale Top-5 nach Serie absteigend, bei Gleichstand nach Zeit aufsteigend, mit Eintrag des eigenen Ergebnisses | Planned | [Spec](PROJ-3-leaderboard/spec.md) | 2026-08-30 |
| PROJ-4 | Datenschutz & Kontolöschung | Datenschutzerklärung und die Möglichkeit, das eigene Konto samt Ranglisten-Einträgen zu löschen | Roadmap | — | 2026-08-30 |

**Build order:** P0 (MVP): PROJ-1 → PROJ-2 → PROJ-3 · P1: PROJ-4 (braucht PROJ-1)

<!-- Add features above this line -->

## Deploy-Blocker

> Dinge, die den jetzigen Stand **nicht** kaputt machen — die Features sind zu Recht `Approved` —, die aber vor dem öffentlichen Start erledigt sein müssen. `/deploy` arbeitet diese Liste ab. Die vollständige Einordnung steht jeweils im `qa-report.md` des Features.

| Feature | Blocker | Behebbar |
|---------|---------|----------|
| PROJ-1 | ~~**AC-8 / EC-4** — Rate-Limit lokal nicht auslösbar~~ — **erledigt** am 2026-09-04: gegen das gehostete Projekt gemessen, 429 bei Versuch 33. BUG-7 geschlossen | ✅ |
| PROJ-1 | **AC-8 verspricht einen Schutz, den die Architektur nicht liefern kann** (BUG-21) — die Messung bestätigt: Das Limit greift **pro IP**. Die App leitet aber alle Logins über Server Actions, Supabase sieht daher für jeden Spieler dieselbe Server-IP. Folge: entweder sperren 30 Fehlversuche **alle** Spieler gemeinsam aus (DoS-Hebel), oder das Limit greift nie. Braucht `/refine` auf AC-8 und die Entscheidung über einen eigenen, kontobezogenen Zähler | jetzt entscheidbar, Messung liegt vor |
| **PROJEKT** | **Site-URL im gehosteten Projekt steht auf `http://localhost:3000`** — vom abgebrochenen `supabase config push` geschrieben, am 2026-09-04 im Dashboard bestätigt. Ohne Korrektur zeigt jeder Mail-Link in Produktion ins Leere. Zusammen mit der Absender-Domain zu setzen | beim Deploy, zwingend |
| **PROJEKT** | **Eigener SMTP-Dienst und Absender-Domain fehlen** — Supabases eingebauter Versand stellt nur an Team-Adressen zu (2/Stunde, nicht für Produktion). **Der Passwort-Reset funktioniert für echte Spieler damit gar nicht**, und ohne eigenen SMTP bleiben die E-Mail-Vorlagen im Free Tier gesperrt. Siehe `docs/PRD.md` → Rahmenbedingungen | **blockiert** — keine Domain vorhanden (Stand 2026-09-04) |
| PROJ-1 | **T18** — Reset-Mail-Vorlage im gehosteten Projekt setzen. Ohne sie verschickt die Produktion den PKCE-Standardlink und der geräteübergreifende Reset (EC-7) ist erneut kaputt. **Nicht setzbar**, solange kein eigener SMTP-Dienst konfiguriert ist: `supabase config push` scheitert mit `400 Email template modification is not available for free tier projects using the default email provider` | erst nach eigenem SMTP |
| PROJ-1 | **T4** — Passwort-Mindestlänge (8) im Dashboard des gehosteten Projekts setzen. Der lokale Spiegel in `config.toml` ist gesetzt und verifiziert | erst nach dem ersten `/deploy` |
| PROJ-1 | **AC-11 / AC-12** — der Passwort-Reset-Link hängt an Site-URL und Redirect-URLs des gehosteten Projekts | erst gegen das gehostete Projekt |
| PROJ-1 | ~~**Warnhinweis am Trainername-Feld**~~ — **erledigt** am 2026-09-03: `AC-15` gebaut (`T14`) und im QA-Lauf verifiziert | ✅ |
| PROJ-1 | **Security-Header fehlen** — `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` sind nirgends gesetzt (BUG-12). Werden beim Host konfiguriert und müssen gegen die Live-URL geprüft werden. **Am 2026-09-04 im QA-Lauf zu PROJ-2 neu bewertet: Medium statt Low** — es trifft jede Route, auch die Shell, und `Referrer-Policy` ist in einem Produkt mit Bild-Weiterleitung nicht kosmetisch | beim Deploy |
| PROJ-1 | **Die Drosselung braucht einen Host, der `x-forwarded-for` selbst setzt** (BUG-53) — ohne einen solchen Header fallen **alle** Spieler auf den gemeinsamen Zählerschlüssel `unbekannt` mit 5 Versuchen pro Minute; der Schutz wird dann zur Aussperr-Waffe gegen die eigenen Nutzer. Beim gewählten Host prüfen und clientseitige Werte verwerfen — dieselbe Hausaufgabe wie bei BUG-18 | beim Deploy |
| PROJ-2 | **`X-Forwarded-Host` hebelt die Origin-Prüfung der Server Actions aus** (BUG-18) — aus dem Browser nicht ausnutzbar (`sameSite: lax`, Preflight scheitert), **aber** ein echter CSRF-Vektor, sobald ein Reverse Proxy oder CDN davorsteht, das clientseitige `X-Forwarded-Host`-Header nicht verwirft. Beim gewählten Host prüfen und den Header dort strippen | beim Deploy |

## Next Available ID: PROJ-5
