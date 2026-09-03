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
| PROJ-1 | Benutzerkonto & Login | Registrierung und Anmeldung per E-Mail/Passwort, dazu ein eindeutiger Trainername als öffentlicher Anzeigename | Approved | [Spec](PROJ-1-user-login/spec.md) | 2026-08-30 |
| PROJ-2 | Pokémon-Quiz | Eine Runde aus Bild-Fragen mit vier deutschen Namensoptionen, Serien-Zähler und Zeitmessung bis zum ersten Fehler | Approved | [Spec](PROJ-2-pokemon-quiz/spec.md) | 2026-08-30 |
| PROJ-3 | Weltrangliste | Globale Top-5 nach Serie absteigend, bei Gleichstand nach Zeit aufsteigend, mit Eintrag des eigenen Ergebnisses | Planned | [Spec](PROJ-3-leaderboard/spec.md) | 2026-08-30 |
| PROJ-4 | Datenschutz & Kontolöschung | Datenschutzerklärung und die Möglichkeit, das eigene Konto samt Ranglisten-Einträgen zu löschen | Roadmap | — | 2026-08-30 |

**Build order:** P0 (MVP): PROJ-1 → PROJ-2 → PROJ-3 · P1: PROJ-4 (braucht PROJ-1)

<!-- Add features above this line -->

## Deploy-Blocker

> Dinge, die den jetzigen Stand **nicht** kaputt machen — die Features sind zu Recht `Approved` —, die aber vor dem öffentlichen Start erledigt sein müssen. `/deploy` arbeitet diese Liste ab. Die vollständige Einordnung steht jeweils im `qa-report.md` des Features.

| Feature | Blocker | Behebbar |
|---------|---------|----------|
| PROJ-1 | **AC-8 / EC-4** — Supabases eingebautes Rate-Limit ist im lokalen Stack nicht auslösbar; der Schutz vor automatisiertem Durchprobieren ist damit unbewiesen, nicht widerlegt | erst gegen das gehostete Projekt |
| PROJ-1 | **T4** — Passwort-Mindestlänge (8) im Dashboard des gehosteten Projekts setzen. Der lokale Spiegel in `config.toml` ist gesetzt und verifiziert | erst nach dem ersten `/deploy` |
| PROJ-1 | **AC-11 / AC-12** — der Passwort-Reset-Link hängt an Site-URL und Redirect-URLs des gehosteten Projekts | erst gegen das gehostete Projekt |
| PROJ-1 | **Warnhinweis am Trainername-Feld** — dass der Name für andere Spieler sichtbar **und** dauerhaft unveränderlich ist. Kein AC verlangt das bisher; mit PROJ-3 wird der Name erstmals tatsächlich angezeigt. Aus `/dsgvo PROJ-3`, 2026-09-03. Weg: `/refine PROJ-1` → `/build` → `/qa` | **sofort** |

## Next Available ID: PROJ-5
