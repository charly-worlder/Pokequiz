import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatLeaderboardDuration } from '@/lib/leaderboard/format'
import type { AccountData } from '@/lib/account/queries'

/**
 * Die Kontodaten-Anzeige (spec.md AC-2, AC-3, AC-6, AC-7, AC-19).
 *
 * **Nur-Lese, und zwar sichtbar.** Es gibt hier kein Eingabefeld und keine
 * Speichern-Aktion (AC-3). Trainername und E-Mail zu ändern gehört zu PROJ-1;
 * ein Feld an dieser Stelle würde eine Möglichkeit vortäuschen, die es nicht
 * gibt.
 *
 * **Der Satz am Ende ist eine Zusage, kein Beiwerk** (AC-19, Art. 15 DSGVO) — und
 * er behauptet seit dem 2026-09-10 **ausdrücklich keine Vollständigkeit** mehr.
 * Er zählt auf, was hier steht, und sagt, dass daneben technischer
 * Betriebszustand existiert, der mit der Löschung verschwindet (AC-17). Die
 * frühere Fassung („das ist alles") war schlicht falsch; vier QA-Läufe haben an
 * ihr vier verschiedene Fehler gefunden.
 *
 * **Was der Test dazu leistet und was nicht:** Er hält die Feldliste des Typs
 * `AccountData` fest und schlägt an, wenn sie wächst. Ein neues Feld in der
 * **Datenbank** sieht er nicht — er kennt sie nicht. Diese Grenze steht so in
 * `design.md` → Prüfhinweise, damit niemand mehr annimmt, sie sei enger.
 */

/** Registrierdatum als `TT.MM.JJJJ` — bewusst ohne Uhrzeit. */
function formatJoinDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Berlin',
  }).format(date)
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    // Bei 320 px stapelt sich Wert unter Label statt daneben zu quetschen — die
    // E-Mail-Adresse ist der lange Wert, an dem eine einzeilige Zeile bricht.
    <div className="flex flex-col gap-0.5 border-b border-border py-3 last:border-b-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-medium break-words sm:text-right">{children}</dd>
    </div>
  )
}

export function AccountDataCard({ data }: { data: AccountData }) {
  return (
    <Card className="rounded-card">
      <CardHeader>
        <CardTitle>Dein Konto</CardTitle>
      </CardHeader>
      <CardContent>
        <dl>
          <Row label="E-Mail">{data.email}</Row>
          <Row label="Trainername">{data.trainerName}</Row>
          <Row label="Dabei seit">{formatJoinDate(data.createdAt)}</Row>
          <Row label="Runden gespielt">
            <span className="tabular">{data.roundsPlayed}</span>
          </Row>
          <Row label="Bester Lauf">
            {data.bestRun ? (
              <span className="tabular">
                Serie {data.bestRun.streak} · {formatLeaderboardDuration(data.bestRun.durationMs)}
              </span>
            ) : (
              // AC-6: ein Hinweis, keine leere Zeile und keine Null. „Serie 0"
              // wäre keine Auskunft, sondern Hohn.
              <span className="text-muted-foreground">Noch keine gewertete Runde</span>
            )}
          </Row>
        </dl>

        {/*
          AC-19, präzisiert am 2026-09-10. Hier stand „Das ist alles, was wir
          über dich gespeichert haben." — und das war **falsch**: Zu einem
          lebenden Konto führt die Datenbank zusätzlich `last_sign_in_at`,
          `updated_at`, `confirmed_at`, die Anmelde-Metadaten (in denen Adresse
          und Trainername ein zweites Mal stehen), Protokoll- und Zählerzeilen.
          Drei QA-Läufe haben das nacheinander belegt.

          Der Satz sagt jetzt beides: was aufgezählt ist, und dass es daneben
          noch etwas gibt, das mit der Löschung verschwindet (AC-17). Prüfbar
          wahr statt eine Vollständigkeit zu behaupten, die niemand hält.
        */}
        <p className="pt-4 text-[13px] text-muted-foreground">
          Das sind deine gespeicherten Kontodaten (E-Mail, Trainername,
          Registrierungsdatum, Anzahl gespielter Runden, bester Lauf). Technische
          Zeitstempel und Sicherheitszähler kommen zusätzlich dazu und verschwinden
          mit der Löschung.
        </p>
      </CardContent>
    </Card>
  )
}
