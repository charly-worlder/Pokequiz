'use client'

import { useEffect, useRef, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Die Adresse des Bildes einer Frage — gebildet aus ihrem **Token**, nicht aus
 * der Pokémon-Nummer (spec.md AC-32).
 *
 * Das ist die eine Zeile, an der die ganze Verdeckung hängt. Vorher stand die
 * Nummer sichtbar in `/_next/image?url=…/official-artwork/25.png`; ein Skript in
 * der Konsole konnte sie lesen, den deutschen Namen in einer 386-Zeilen-Liste
 * nachschlagen und richtig klicken — und der Server hätte eine echte Serie
 * gezählt, weil an der Antwort nichts gefälscht war.
 */
export function questionImageUrl(token: string): string {
  return `/api/question/${token}/image`
}

/**
 * spec.md AC-20 — der Browser fragt ausschließlich die eigene Domain an; der
 * Server holt das Bild vom CDN. Keine Spieler-IP erreicht einen Nicht-EU-Dienst.
 *
 * spec.md AC-25 — eine Skelettfläche in Bildgröße, damit das Layout nicht
 * springt, wenn das Bild eintrifft. Nie ein alleinstehender Spinner.
 *
 * **Ohne die Bild-Optimierung des Frameworks, seit dem 2026-09-06.** Sie
 * speichert nach Quell-Adresse zwischen; die ist jetzt pro Frage verschieden,
 * der Zwischenspeicher liefe also immer daneben — und auf manchen Tarifen würde
 * je einmaliger Quell-Adresse abgerechnet. Die Wiederverwendung sichert
 * stattdessen der serverseitige Zwischenspeicher auf die CDN-Adresse, also auf
 * die Pokémon-Nummer (AC-31, AC-37). Der Preis ist ein rohes PNG von rund
 * 110 KB statt eines verkleinerten WebP; auf dem kritischen Pfad liegt davon nur
 * die erste Frage einer Runde, alle weiteren sind vorgeladen (AC-10).
 */
export function PokemonImage({
  src,
  alt,
  onReady,
}: {
  src: string
  alt: string
  /** spec.md AC-2 — die angezeigte Uhr startet mit dem sichtbaren Bild. */
  onReady?: () => void
}) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[280px]">
      {!loaded && <Skeleton className="absolute inset-0 rounded-[var(--radius-card-value)]" />}
      {/* eslint-disable-next-line @next/next/no-img-element -- bewusst kein next/image: siehe oben (AC-32) */}
      <img
        key={src}
        src={src}
        alt={alt}
        width={280}
        height={280}
        decoding="async"
        onLoad={() => {
          setLoaded(true)
          onReady?.()
        }}
        className="absolute inset-0 size-full object-contain"
      />
    </div>
  )
}

/**
 * spec.md AC-15 — ein Bild, das hierin nicht lädt, gilt als Fehlschlag.
 * Dieselben 5 Sekunden, die der Server der Fragezusammenstellung gibt, damit
 * eine langsame Runde **ein** Budget hat statt zweier.
 */
const PROBE_TIMEOUT_MS = 5_000

/**
 * Lädt das Bild der **vorbereiteten** Frage, während die aktuelle auf dem
 * Bildschirm steht (spec.md AC-10), und ist der Ort, an dem ein kaputtes Bild
 * auffällt, bevor der Spieler es je sieht (spec.md EC-6).
 *
 * Weil die Adresse ein Token trägt (AC-32), verrät dieses Vorladen nichts: Wer
 * die *nächste* Frage schon geladen hat, kann die *aktuelle* deshalb nicht
 * besser beantworten.
 *
 * In voller Größe gehalten, aber durchsichtig und außerhalb des Layouts: Ein
 * Container mit Größe 0 oder `display:none` würde die Anfrage verändern oder
 * unterdrücken.
 *
 * **Warum die Zeitgrenze (BUG-15, qa-report.md 2026-09-04).** `onLoad` und
 * `onError` decken ein Bild ab, das ankommt, und eines, das abgelehnt wird —
 * nicht eines, das gar nicht antwortet. Ohne Frist saß die Runde dann für immer
 * auf „Runde wird vorbereitet …": keine Fehlerkarte, kein Ausweg, und die Serie
 * beim Neuladen verloren. Der zweite Versuch ist AC-15's „einmal automatisch und
 * für den Nutzer unsichtbar neu geladen".
 */
export function ImageProbe(props: { src: string; onOk: () => void; onFail: () => void }) {
  // Auf die Adresse geschlüsselt, damit ein neues Bild einen wirklich frischen
  // Versuchszähler bekommt, statt einen, der zurückgesetzt werden muss.
  return <ProbeAttempts key={props.src} {...props} />
}

function ProbeAttempts({
  src,
  onOk,
  onFail,
}: {
  src: string
  onOk: () => void
  onFail: () => void
}) {
  const [attempt, setAttempt] = useState(0)

  /**
   * `onFail` wird vom Elternteil neu gebildet, sobald sich die Serie ändert. Über
   * ein Ref gelesen, bleibt das aus den Abhängigkeiten des Timers heraus — sonst
   * würde jede richtige Antwort die Frist neu starten, und ein hängendes Bild
   * könnte eine ganze Runde lang hängen, ohne je abzulaufen.
   */
  const onFailRef = useRef(onFail)
  useEffect(() => {
    onFailRef.current = onFail
  })

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (attempt === 0) setAttempt(1)
      else onFailRef.current()
    }, PROBE_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [attempt])

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 -z-50 aspect-square w-[280px] opacity-0"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- bewusst kein next/image: siehe questionImageUrl */}
      <img
        // Der Versuch ist der Schlüssel, nie Teil von `src`: Ein geänderter
        // Schlüssel hängt das Element neu ein und lässt den Browser erneut
        // anfragen, während die Adresse zeichengleich bleibt — der zweite Versuch
        // trifft damit weiterhin den Zwischenspeicher (AC-31, AC-37) und geht
        // weiterhin an die eigene Domain (AC-20). Ein Cache-Buster in der Adresse
        // würde beides brechen.
        key={attempt}
        src={src}
        alt=""
        width={280}
        height={280}
        onLoad={onOk}
        onError={onFail}
        className="size-full object-contain"
      />
    </div>
  )
}
