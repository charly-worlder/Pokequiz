# Datenmodell

> Die app-weite Karte davon, **welche Daten dieses Produkt speichert und wie sie zusammenhängen** — der gemeinsame Bauplan, an den sich die Tabellen jedes Features halten.
>
> - Erstellt von `/init` (der erste ganzheitliche Durchgang: Entitäten + Beziehungen).
> - Verfeinert von `/architecture`, sobald ein Feature entworfen wird.
> - **Flughöhe:** Entitäten, Beziehungen und Eigentümerschaft stehen hier (Produktebene, für alle lesbar). Spaltentypen, Indizes und konkrete Fremdschlüssel werden pro Feature in dessen `design.md` entschieden — nicht hier.

## Entitäten

_Jede Entität ist eine Art von Ding, das die App speichert. Ein Satz zum Zweck, dazu wer sie besitzt und wer sie sehen darf. Keine Spaltentypen — nur die Sache und wofür sie da ist._

| Entität | Was sie darstellt | Wem sie gehört / wer sie sieht |
|---------|-------------------|-------------------------------|
| `profiles` | Das Trainerprofil zu einem Konto — trägt den eindeutigen, öffentlichen Trainernamen | Gehört dem Nutzer. Der Trainername ist für alle angemeldeten Nutzer lesbar, die E-Mail bleibt beim Auth-System und wird nie öffentlich |
| `runs` | Eine abgeschlossene Quiz-Runde — erreichte Serie und benötigte Zeit | Gehört dem Spieler, der sie gespielt hat. **Nur der Eigentümer liest und schreibt seine Runden**; verändert oder einzeln gelöscht werden sie von niemandem. Die Rangliste greift nicht auf die Tabelle zu, sondern auf eine Abfrage, die pro Spieler ausschließlich den besten Lauf herausgibt (PROJ-3) |

## Beziehungen

- Ein Auth-Konto hat **genau ein** `profiles` — es entsteht automatisch bei der Registrierung, nicht in einem zweiten Schritt.
- Ein `profiles` hat **viele** `runs`.
- Jede `runs` gehört zu **genau einem** `profiles`.

## Speicher-Entscheidungen

Diese drei Festlegungen prägen jedes Feature, das auf dem Modell aufbaut:

**Jede abgeschlossene Runde wird als eigene Zeile gespeichert — automatisch beim Rundenende, nicht erst auf Klick.** Nichts wird je überschrieben. Das schützt Rekorde vor Fehlern in der Vergleichslogik, sorgt dafür, dass kein Ergebnis verlorengeht, wenn jemand den Tab schließt, und macht das Erfolgskriterium „startet jemand eine zweite Runde?" überhaupt erst messbar. Der Speicherbedarf ist vernachlässigbar: eine Runden-Zeile liegt bei rund 100 Byte, 100.000 Runden bei etwa 10 MB.

**Die Rangliste ist eine Abfrage, keine Tabelle.** Die globale Top-5 ergibt sich als „bester Lauf pro Spieler" über `runs`, sortiert nach Serie absteigend und bei Gleichstand nach Zeit aufsteigend. Eine zweite Tabelle daneben wäre eine Kopie, die sofort auseinanderläuft.

**Schlechte Runden sind privat — und zwar in der Datenbank, nicht erst in der Oberfläche.** Die Rangliste zeigt pro Spieler ausschließlich seinen besten Lauf. Damit das keine bloße Anzeigezusage bleibt, darf niemand die Runden eines anderen Spielers lesen; die Rangliste bezieht ihre Zeilen über eine eigens dafür gebaute Abfrage, die nur den jeweils besten Lauf herausgibt. Wäre die Tabelle für alle Angemeldeten lesbar, könnte jeder die vollständige Historie jedes anderen abrufen (festgelegt in PROJ-2 → `design.md`).

## Was bewusst *nicht* gespeichert wird

- **Keine Pokémon-Daten als Entität.** Bilder und deutsche Namen kommen von der PokeAPI, abgefragt jeweils nur für die vier in einer Frage gezeigten Pokémon. Es gibt keine `pokemon`-Tabelle und keinen auf Vorrat heruntergeladenen Pool; die Namen bleiben dadurch automatisch aktuell.

  **Das schließt einen Zwischenspeicher ausdrücklich nicht aus** — im Gegenteil: Die Fair-Use-Policy der PokeAPI bittet als erste ihrer Regeln darum, bereits abgerufene Ressourcen lokal zwischenzuspeichern („Locally cache resources whenever you request them"), und kennt seit November 2018 kein Rate-Limit mehr. Ein Cache ist ein jederzeit verwerfbares Abbild, keine Entität mit eigener Wahrheit, und taucht deshalb hier nicht auf. Verbindlich geregelt ist er in PROJ-2, AC-31.
- **Keine Fragen und keine Antworten.** Eine Runde hinterlässt nur ihr Ergebnis, nicht ihren Verlauf.
- **Keine `leaderboard`-Entität** — siehe Speicher-Entscheidungen oben.

## Skizze

```
auth-Konto
  └─ hat genau ein  profiles   (Trainername, öffentlich, eindeutig)
        └─ hat viele  runs     (Serie, Zeit, Zeitpunkt)
                        └─ Top-5 = Abfrage „bester Lauf pro Spieler", keine eigene Tabelle
```

---

_Dies ist ein lebendes Dokument. Wenn `/architecture` ein Feature entwirft, das eine Entität einführt oder ändert, aktualisiert es zuerst diese Karte, damit spätere Features gegen ein zutreffendes Bild bauen._
