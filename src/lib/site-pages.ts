/**
 * Welche Seiten es in dieser App schon gibt.
 *
 * Hintergrund: Ein Link auf eine noch nicht gebaute Seite ist im Produktivbetrieb
 * ein toter Link — `docs/app-shell.md` verlangt deshalb, ihn erst zu zeigen, wenn
 * die Zielseite existiert. Diese Regel wurde in diesem Projekt **dreimal
 * nacheinander** verletzt, an drei verschiedenen Stellen: Fußzeile (beim Bau
 * bemerkt), Kopfzeile (BUG-23) und Ergebnis-Screen (AC-7).
 *
 * Der Grund war jedes Mal derselbe: Die Regel stand als Fließtext in einem
 * Dokument und als Open Question, aber jede Fundstelle trug ihren eigenen
 * Schalter. Deshalb liegt er jetzt hier — **ein** Wert für alle Stellen, die auf
 * dieselbe Seite zeigen.
 *
 * **PROJ-3 baut `/leaderboard` und setzt `LEADERBOARD_PAGE_EXISTS` auf `true`.**
 * Das schaltet Kopfzeile und Ergebnis-Screen gemeinsam frei; es gibt keine
 * zweite Stelle, die dabei vergessen werden könnte.
 *
 * Die Datenschutz- und Impressumsseiten laufen bewusst nicht über diese Datei:
 * Die Fußzeile führt sie in `site-footer.tsx` als Liste (`LEGAL_PAGES`), weil
 * PROJ-4 dort zwei Seiten mit Beschriftung einträgt, nicht einen Schalter
 * umlegt. `register-view.tsx` trägt aus demselben Grund seinen eigenen.
 */
export const LEADERBOARD_PAGE_EXISTS = false
