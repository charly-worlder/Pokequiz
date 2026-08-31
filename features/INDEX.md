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
| PROJ-1 | Benutzerkonto & Login | Registrierung und Anmeldung per E-Mail/Passwort, dazu ein eindeutiger Trainername als öffentlicher Anzeigename | Tasked | [Spec](PROJ-1-user-login/spec.md) | 2026-08-30 |
| PROJ-2 | Pokémon-Quiz | Eine Runde aus Bild-Fragen mit vier deutschen Namensoptionen, Serien-Zähler und Zeitmessung bis zum ersten Fehler | Roadmap | — | 2026-08-30 |
| PROJ-3 | Weltrangliste | Globale Top-5 nach Serie absteigend, bei Gleichstand nach Zeit aufsteigend, mit Eintrag des eigenen Ergebnisses | Roadmap | — | 2026-08-30 |
| PROJ-4 | Datenschutz & Kontolöschung | Datenschutzerklärung und die Möglichkeit, das eigene Konto samt Ranglisten-Einträgen zu löschen | Roadmap | — | 2026-08-30 |

**Build order:** P0 (MVP): PROJ-1 → PROJ-2 → PROJ-3 · P1: PROJ-4 (braucht PROJ-1)

<!-- Add features above this line -->

## Next Available ID: PROJ-5
