# Product Requirements Document

## Vision

Ein Web-Quiz, in dem Spieler Pokémon am Bild erkennen und den richtigen **deutschen** Namen aus vier Optionen wählen. Jede richtige Antwort verlängert eine Serie, ein Fehler beendet den Lauf — eine globale Weltrangliste macht aus dem Solo-Spiel einen Wettbewerb. Das Produkt existiert, weil deutsche Pokémon-Namen eine eigene Welt sind: Fast jedes Pokémon-Quiz im Netz arbeitet mit den englischen Namen, obwohl eine ganze Generation deutschsprachiger Fans ausschließlich „Glurak" und „Relaxo" kennt.

## Zielgruppe

Deutschsprachige Pokémon-Fans, die die Serie über die deutschen Namen kennengelernt haben — von Spielern, die mit der ersten Generation aufgewachsen sind, bis zu Kindern, die heute einsteigen. Was sie verbindet: Sie erkennen ein Pokémon sofort am Bild, aber die gängigen Quiz-Apps fragen englische Namen ab, die für sie schlicht nicht die richtigen sind.

Sie wollen ohne Erklärung sofort loslegen und wissen, wie sie im Vergleich zu anderen dastehen. Genau deshalb gibt es einen Login: Ohne Konto ist die Rangliste nicht zuordenbar.

## Kern-Features (Roadmap)

_Die Feature-Map — Name, Beschreibung, Status und Build-Reihenfolge jedes Features — lebt in **`features/INDEX.md`** und nur dort, damit nichts synchron gehalten werden muss._

Das MVP ist erst nutzbar, wenn drei Dinge zusammenspielen: ein Konto, mit dem sich ein Spieler ausweist, das Quiz selbst mit Serie und Zeitmessung, und die Rangliste, die den Wettbewerb sichtbar macht. Die PokeAPI-Anbindung ist kein eigenes Nutzererlebnis, sondern die Datenquelle unter dem Quiz — sie wird zusammen mit ihm gebaut.

Bewusst später: alles, was das Spiel variabler macht (Generationen-Auswahl, Schwierigkeitsstufen, Freitext-Eingabe). Erst muss die eine Spielform sitzen.

## Erfolgskriterien

- **Wiederholte Runden:** Mindestens die Hälfte der Spieler startet nach einem beendeten Lauf direkt eine zweite Runde — der ehrlichste Test dafür, ob das Spiel trägt.
- Eine Runde startet in **unter 3 Sekunden** vom Klick auf „Runde starten" bis zum ersten sichtbaren Pokémon.
- **Null falsche deutsche Namen:** Jede angezeigte Antwortoption stammt aus der offiziellen PokeAPI-Übersetzung, nicht aus einer handgepflegten Liste.
- Die Weltrangliste füllt sich mit echten Einträgen statt Testdaten.

## Rahmenbedingungen

- **Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS + shadcn/ui, Supabase (PostgreSQL + Auth)
- **Environment strategy:** `local` — Supabase läuft während der Entwicklung via Docker, wird bei `/deploy` in ein gehostetes Projekt migriert
- **Data region:** `eu-central-1` (Frankfurt) — nachträglich nicht änderbar ohne Migration der ganzen Datenbank
- **Data protection law:** DSGVO (EU/DE)
- **Data protection stance:** `standard` — begründet durch ein öffentliches Publikum, das absehbar auch Minderjährige einschließt (Art. 8 DSGVO), und durch Trainernamen, die für alle Nutzer sichtbar sind
- **Design system:** siehe `docs/design-system.md` — abgeleitet aus dem Claude-Design-Projekt, Richtung „Fangball · Premium"
- **Externe Datenquelle:** PokeAPI (kein API-Key, kostenlos). Abgefragt wird nur für die vier in einer Frage gezeigten Pokémon, nie der Bestand auf Vorrat. Bereits Abgerufenes wird zwischengespeichert und nicht erneut angefragt — beides verlangt die Fair-Use-Policy der API, die seit 2018 kein Rate-Limit mehr kennt, sondern um Caching und geringe Anfragehäufigkeit bittet
- **Externe Bild-Auslieferung:** Sprites kommen von einem Nicht-EU-CDN. Die dabei übertragene IP-Adresse ist ein DSGVO-Sachverhalt und wird als Anforderung behandelt, nicht als Randnotiz
- **Team:** eine Person, nebenbei. Kein Budget über die kostenlosen Tiers hinaus

## Nicht-Ziele

- **Kein Pro-Antwort-Timer** — nur die Gesamtzeit der Runde wird gemessen, und sie dient ausschließlich als Tie-Breaker
- **Keine Silhouette oder Bildverfremdung** — das Pokémon wird regulär als Bild gezeigt
- **Keine Kategorien, Filter oder Schwierigkeitsstufen**
- **Kein Freitext-Modus** für die Namenseingabe
- **Keine Monetarisierung, keine Werbung, kein Marketing-Auftritt**
- **Kein Mehrspieler in Echtzeit** — der Wettbewerb läuft asynchron über die Rangliste
