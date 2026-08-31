# Projekt: Pokémon-Quiz

## Überblick

Ein kleines SaaS mit Login, bei dem Nutzer in einem Multiple-Choice-Quiz gegen eine wachsende Punktzahl (Streak) antreten: Pokémon anhand ihres Bildes erkennen und den richtigen deutschen Namen aus vier Optionen auswählen. Eine globale Bestenliste zeigt die besten Ergebnisse aller Nutzer.

## Zielgruppe

- Ich selbst
- Mein Neffe (Pokémon-Fan, kennt nur die deutschen Pokémon-Namen) als tatsächlicher Spieler

## Tech

- Frontend-Framework: Next.js
- Supabase, zunächst **lokal via Docker**
- PokeAPI als externe Datenquelle (kein Key nötig)
- UI-Library: [ERGÄNZEN, z. B. ShadCN, falls genutzt]

## Look & Feel

- Shadcn UI für Komponenten
- Design-System aus referenzierter Claude-Design-Datei: https://claude.ai/design/p/85b70f32-ae5c-49d3-9c9d-1c5ba89288c6?file=Pok%C3%A9mon-Quiz.dc.html
- Ästhetische Richtung: verspielt, bunt, Pokémon-nah — Details siehe design-briefing.md
- Analysiere das Designsystem (Readme + Designs) und nutze es für dieses Projekt

## Features

### Feature 1: Authentifizierung
- Sign-up und Login über Supabase (E-Mail/Passwort)
- Nur angemeldete Nutzer haben Zugriff auf das Quiz
- Row Level Security: Highscore-Einträge dürfen von allen Nutzern gelesen (Bestenliste), aber nur vom jeweiligen Eigentümer geschrieben werden

### Feature 2: Externe Integration – PokeAPI
- Datenquelle: [pokeapi.co](https://pokeapi.co), kein API-Key nötig, kostenlos
- Verwendete Endpunkte:
  - `/pokemon/{id}` – Sprite/Bild des jeweiligen Pokémon
  - `/pokemon-species/{id}` – deutsche Namensübersetzung (Feld `names`, `language: "de"`)
- Abfrage erfolgt live bei jeder Frage, jeweils nur für die 4 in dieser Frage gezeigten Pokémon (kein Vorab-Caching der gesamten Pokémon-Liste), um die Fair-Use-Policy der API einzuhalten

### Feature 3: Pokémon-Quiz

**Spielablauf:**
1. Rundenstart: Zeitmessung beginnt
2. Zufälliges Pokémon wird als reguläres Bild angezeigt
3. Vier deutsche Namensoptionen werden angezeigt (eine richtig, drei falsch), Position zufällig gemischt
4. Ein Pokémon erscheint innerhalb einer Runde nicht mehrfach
5. Richtige Antwort: Streak-Zähler erhöht sich um 1, nächste Frage wird geladen
6. Falsche Antwort: Runde endet, Zeit wird gestoppt, richtige Lösung wird angezeigt
7. Werden alle verfügbaren Pokémon einer Runde korrekt beantwortet (Pool erschöpft): Runde endet automatisch mit Gewinner-Meldung, Zeit wird gestoppt

**Bewertung:**
- Primäres Ranking-Kriterium: höchster erreichter Streak (Anzahl richtiger Antworten in Folge)
- Tie-Breaker bei gleichem Streak: geringere benötigte Zeit gewinnt
- Globale Top-5-Bestenliste, sichtbar für alle angemeldeten Nutzer, sortiert nach Streak absteigend, bei Gleichstand nach Zeit aufsteigend

## Out of Scope

- Kein Pro-Antwort-Timer/Zeitdruck – nur Gesamtzeit der Runde wird gemessen
- Keine Silhouette/Bildverfremdung – Pokémon wird regulär als Bild angezeigt
- Keine Kategorien, Filter oder Schwierigkeitsstufen
- Kein Freitext-Namenseingabe-Modus
