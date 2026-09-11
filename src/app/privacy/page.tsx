import type { Metadata } from 'next'
import Link from 'next/link'

import { LegalPage, LegalSection, Placeholder, PlaceholderNotice } from '@/components/legal/legal-page'

/**
 * Die Datenschutzerklärung (Art. 13 DSGVO).
 *
 * Öffentlich, ohne Anmeldung — `src/proxy.ts` führt `/privacy` in
 * `PUBLIC_PATHS`, und `docs/app-shell.md` → Auth-Zustände nennt sie als eine der
 * vier ausgeloggt erreichbaren Seiten. Sie gehört ausdrücklich **in** den
 * Suchindex; es stehen keine fremden Daten darauf.
 *
 * **Der Inhalt ist aus `docs/privacy.md` abgeleitet** — dem Verarbeitungsverzeichnis,
 * das `/dsgvo` pflegt. Ändert ein Feature, was gespeichert wird, ändert sich
 * zuerst jenes Dokument und dann diese Seite. Weil hier bewusst kein Spec-Zyklus
 * läuft, deckt **kein Test** diese Übereinstimmung ab; sie ist Handarbeit und
 * gehört in jeden `/audit`.
 *
 * **Zwei Zusagen sind absichtlich eingeschränkt formuliert**, weil PROJ-4 sie so
 * und nicht weiter halten kann: Sicherungskopien werden nicht rückwirkend
 * bearbeitet (spec.md → EC-9), und das Betriebsprotokoll des Auth-Dienstes
 * enthält die E-Mail-Adresse auch nach der Löschung (EC-14). „Vollständig
 * gelöscht" ohne diese beiden Sätze wäre schlicht falsch.
 */
export const metadata: Metadata = {
  title: 'Datenschutzerklärung',
}

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Datenschutzerklärung"
      lead="Welche Daten dieses Quiz speichert, wozu, wie lange — und wie du sie wieder loswirst."
    >
      <PlaceholderNotice />

      <LegalSection title="Verantwortlicher">
        <p>
          Worlder
          <br />
          <Placeholder>Anschrift</Placeholder>
          <br />
          E-Mail: <Placeholder>Kontakt-E-Mail-Adresse</Placeholder>
        </p>
        <p className="text-muted-foreground">
          Vollständige Angaben im{' '}
          <Link
            href="/imprint"
            className="rounded underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Impressum
          </Link>
          . Eine Datenschutzbeauftragte oder einen Datenschutzbeauftragten gibt es
          nicht; die Voraussetzungen des § 38 BDSG liegen nicht vor.
        </p>
      </LegalSection>

      <LegalSection title="Was gespeichert wird">
        <p>
          <strong>Zum Konto:</strong> deine E-Mail-Adresse, ein Hash deines Passworts
          (nie das Passwort selbst), dein Trainername und der Zeitpunkt der
          Registrierung. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO — ohne Konto
          ist ein Ranglisten-Eintrag niemandem zuzuordnen.
        </p>
        <p>
          <strong>Zu deinen Runden:</strong> je abgeschlossener Runde die erreichte
          Serie, die benötigte Zeit und der Zeitpunkt. Während eine Runde läuft,
          zusätzlich ihr Spielstand — welche Pokémon schon gezogen wurden, die aktuelle
          Lösung, die Zwischenzeit. Dieser Spielstand wird am Rundenende gelöscht,
          spätestens zwei Stunden nach dem letzten Lebenszeichen. Rechtsgrundlage ist
          Art. 6 Abs. 1 lit. b DSGVO.
        </p>
        <p>
          <strong>Zum Schutz vor Missbrauch:</strong> bei jedem Anmelde-,
          Registrierungs-, Passwort-Reset- und Löschversuch werden IP-Adresse und
          E-Mail-Adresse als Schlüssel eines Fehlversuchszählers gespeichert, dazu
          Zeitpunkt und Anzahl. Ohne diesen Zähler könnte jemand Passwörter unbegrenzt
          durchprobieren. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO — unser
          berechtigtes Interesse an einem Konto, das dir gehört und nicht dem, der am
          längsten rät.
        </p>
        <p>
          <strong>Beim Aufruf der Seite</strong> fallen beim Hosting-Anbieter die
          üblichen Server-Logs an (IP-Adresse, Zeitpunkt, aufgerufene Adresse).
          Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO.
        </p>
      </LegalSection>

      <LegalSection title="Was andere Spieler sehen">
        <p>
          Die Weltrangliste zeigt <strong>Trainername, beste Serie und die dazugehörige
          Zeit</strong> — für alle angemeldeten Spieler sichtbar, sobald du mindestens
          eine Runde mit einer Serie von 1 oder mehr abgeschlossen hast. Deine
          E-Mail-Adresse erscheint dort nie, und auch nicht deine schlechteren Runden:
          Die Rangliste gibt pro Spieler ausschließlich den besten Lauf heraus.
        </p>
        <p>
          <strong>Der Trainername lässt sich nachträglich nicht ändern.</strong> Wer ihn
          zurücknehmen will, hat als einzigen Weg die Löschung des Kontos. Wähle
          deshalb keinen Namen, mit dem du persönlich identifizierbar bist — dein
          echter Name, deine Schule oder dein Wohnort gehören dort nicht hinein.
        </p>
      </LegalSection>

      <LegalSection title="Wie lange">
        <p>
          Konto, Trainername und Runden bleiben, <strong>bis du dein Konto löschst</strong>.
          Es gibt keine automatische Löschung ruhender Konten.
        </p>
        <p>
          Die Zeilen des Fehlversuchszählers verfallen nach Ablauf ihres Zeitfensters;
          Zeilen, die eine E-Mail-Adresse enthalten, verschwinden zusätzlich sofort mit
          dem Konto. Die Server-Logs des Hosting-Anbieters werden nach{' '}
          <Placeholder>Aufbewahrungsfrist des Hosting-Anbieters</Placeholder> gelöscht.
        </p>
      </LegalSection>

      <LegalSection title="Konto löschen — sofort und endgültig">
        <p>
          Unter{' '}
          <Link
            href="/account"
            className="rounded underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            „Dein Konto“
          </Link>{' '}
          siehst du alles, was zu dir gespeichert ist, und kannst das Konto dort selbst
          löschen. Zur Bestätigung wird dein Passwort abgefragt. Die Löschung geschieht{' '}
          <strong>sofort und ist nicht rückgängig zu machen</strong> — es gibt keine
          Karenzzeit, keinen Papierkorb und keine Möglichkeit, das Konto
          wiederherzustellen. Mit dem Konto verschwinden dein Trainername, alle deine
          Runden und dein Eintrag in der Weltrangliste; der Trainername ist danach
          wieder frei.
        </p>
        <p>
          <strong>Zwei Einschränkungen, die wir offen benennen.</strong> Erstens werden{' '}
          <em>Sicherungskopien</em> der Datenbank nicht rückwirkend bearbeitet: Bis eine
          Sicherung turnusmäßig ausläuft, kann sie deine Daten noch enthalten
          (Aufbewahrungsfrist: <Placeholder>Frist des Datenbank-Anbieters</Placeholder>).
          Zweitens führt der Anmeldedienst ein technisches <em>Betriebsprotokoll</em>, in
          dem deine E-Mail-Adresse weiterhin auftaucht — einschließlich des Eintrags über
          die Löschung selbst. Dieses Protokoll erzeugt die Anwendung nicht und kann es
          nicht bearbeiten (Aufbewahrungsfrist:{' '}
          <Placeholder>Frist des Anmeldedienstes</Placeholder>). Im laufenden Betrieb der
          Datenbank bleibt darüber hinaus nichts zurück.
        </p>
      </LegalSection>

      <LegalSection title="Wer die Daten sonst verarbeitet">
        <p>
          <strong>Supabase</strong> betreibt Datenbank und Anmeldedienst. Die Daten
          liegen in der Region eu-central-1 (Frankfurt am Main). Grundlage ist ein
          Auftragsverarbeitungsvertrag (AVV) nach Art. 28 DSGVO.
        </p>
        <p>
          <strong>Hosting:</strong> <Placeholder>Hosting-Anbieter</Placeholder>.{' '}
          <strong>E-Mail-Versand</strong> (Passwort-Reset):{' '}
          <Placeholder>SMTP-Anbieter</Placeholder>.
        </p>
        <p>
          <strong>Die PokeAPI erhält keine Daten von dir.</strong> Bilder und deutsche
          Namen holt unser Server und reicht sie an deinen Browser weiter. Die PokeAPI
          und ihr Bild-Netzwerk sehen deshalb nur die Adresse unseres Servers, nie deine
          — sonst wäre bei jeder einzelnen Frage eine Übermittlung in ein Drittland im
          Spiel.
        </p>
      </LegalSection>

      <LegalSection title="Keine Analyse, kein Tracking, kein Cookie-Banner">
        <p>
          Dieses Quiz bindet keine Analyse-, Werbe- oder Fehler-Tracking-Dienste ein und
          lädt keine Schriften von fremden Servern. Gesetzt werden ausschließlich die
          Cookies, die für die Anmeldung technisch erforderlich sind — dafür ist nach
          § 25 Abs. 2 TDDDG keine Einwilligung nötig, und deshalb gibt es hier kein
          Einwilligungsbanner. Es findet keine automatisierte Entscheidungsfindung und
          kein Profiling statt.
        </p>
      </LegalSection>

      <LegalSection title="Deine Rechte">
        <p>
          Du hast das Recht auf <strong>Auskunft</strong> (Art. 15),{' '}
          <strong>Berichtigung</strong> (Art. 16), <strong>Löschung</strong> (Art. 17),{' '}
          <strong>Einschränkung der Verarbeitung</strong> (Art. 18),{' '}
          <strong>Datenübertragbarkeit</strong> (Art. 20) und <strong>Widerspruch</strong>{' '}
          gegen Verarbeitungen auf Grundlage eines berechtigten Interesses (Art. 21
          DSGVO).
        </p>
        <p>
          Auskunft und Löschung kannst du <strong>selbst und sofort</strong> ausüben — die
          Seite „Dein Konto“ zeigt die gespeicherten Kontodaten an und löscht das Konto
          auf Wunsch. Für alles Übrige genügt eine Nachricht an die oben genannte
          Adresse; wir antworten innerhalb eines Monats (Art. 12 Abs. 3 DSGVO). Einen
          maschinenlesbaren Download deiner Daten bieten wir derzeit nicht an; auf
          Anfrage stellen wir die gespeicherten Angaben in Textform bereit.
        </p>
        <p>
          Unabhängig davon kannst du dich bei einer Datenschutz-Aufsichtsbehörde
          beschweren (Art. 77 DSGVO), etwa bei{' '}
          <Placeholder>zuständige Aufsichtsbehörde des Bundeslandes</Placeholder>.
        </p>
      </LegalSection>

      <LegalSection title="Stand">
        <p className="text-muted-foreground">
          Diese Erklärung wurde zuletzt am 10. September 2026 geändert. Sie wird
          angepasst, sobald sich ändert, welche Daten das Quiz verarbeitet.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
