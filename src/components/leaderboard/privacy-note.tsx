/**
 * spec.md AC-24 — in einem Satz, welche Daten hier für andere angemeldete
 * Spieler sichtbar sind und dass ausschließlich der beste Lauf erscheint.
 * Ohne Klick, ohne Aufklappen.
 *
 * **Warum das eine eigene Komponente auf Seitenebene ist und nicht ein Absatz in
 * der Karte.** Genau so stand es im Entwurf („Datenschutz-Satz in gedämpfter
 * Schrift", als Geschwister der Karte). Gebaut war er zunächst *innerhalb* der
 * Karte — und damit hinter zwei vorzeitigen Rückgaben: Im Leerzustand und im
 * Fehlerzustand kehrte `LeaderboardCard` zurück, bevor der Absatz an die Reihe
 * kam. Der Hinweis erreichte jeden **außer** dem neuen Spieler, der die Rangliste
 * zuerst leer sieht — also genau den, dessen Trainername als Nächstes
 * veröffentlicht wird. Gefunden im QA-Lauf vom 2026-09-08, von zwei Prüfbahnen
 * unabhängig voneinander (AC-24, Art. 13 DSGVO).
 *
 * Auf Seitenebene kann derselbe Fehler nicht wiederkehren: Der Satz hängt an
 * keiner Bedingung mehr. Und weil `loading.tsx` ihn ebenfalls rendert — er ist
 * statischer Text und braucht keine Daten —, springt das Layout beim Eintreffen
 * der Daten an dieser Stelle nicht (AC-16).
 */
export function LeaderboardPrivacyNote() {
  return (
    <p className="px-3 pt-5 text-[13px] text-muted-foreground text-pretty sm:px-4">
      Andere angemeldete Spieler sehen hier deinen Trainernamen, deine beste Serie und die
      dazugehörige Zeit — immer nur deinen besten Lauf, nie deine übrigen Runden.
    </p>
  )
}
