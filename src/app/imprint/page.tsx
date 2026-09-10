import type { Metadata } from 'next'
import Link from 'next/link'

import { LegalPage, LegalSection, Placeholder, PlaceholderNotice } from '@/components/legal/legal-page'

/**
 * Das Impressum (§ 5 DDG, § 18 Abs. 2 MStV).
 *
 * Öffentlich, ohne Anmeldung — `src/proxy.ts` führt `/imprint` in
 * `PUBLIC_PATHS`. Anders als `/account` und `/leaderboard` gehört diese Seite
 * ausdrücklich **in** den Suchindex: Ein Impressum, das nur Angemeldete sehen,
 * ist keines. Es stehen auch keine fremden Daten darauf.
 */
export const metadata: Metadata = {
  title: 'Impressum',
}

export default function ImprintPage() {
  return (
    <LegalPage title="Impressum" lead="Angaben gemäß § 5 DDG.">
      <PlaceholderNotice />

      <LegalSection title="Diensteanbieter">
        <p>
          Worlder
          <br />
          <Placeholder>Straße und Hausnummer</Placeholder>
          <br />
          <Placeholder>Postleitzahl und Ort</Placeholder>
          <br />
          Deutschland
        </p>
        <p>
          Vertreten durch: <Placeholder>Vor- und Nachname der vertretungsberechtigten Person</Placeholder>
          <br />
          Rechtsform: <Placeholder>Rechtsform</Placeholder>
          <br />
          Registereintrag: <Placeholder>Registergericht und Registernummer, falls vorhanden</Placeholder>
          <br />
          Umsatzsteuer-Identifikationsnummer nach § 27a UStG:{' '}
          <Placeholder>USt-IdNr., falls vorhanden</Placeholder>
        </p>
      </LegalSection>

      <LegalSection title="Kontakt">
        <p>
          E-Mail: <Placeholder>Kontakt-E-Mail-Adresse</Placeholder>
          <br />
          Telefon: <Placeholder>Telefonnummer</Placeholder>
        </p>
        <p className="text-muted-foreground">
          Über diese Adresse laufen auch Anfragen zum Datenschutz — siehe{' '}
          <Link
            href="/privacy"
            className="rounded underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Datenschutzerklärung
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV">
        <p>
          <Placeholder>Vor- und Nachname</Placeholder>
          <br />
          <Placeholder>Anschrift, falls abweichend von oben</Placeholder>
        </p>
      </LegalSection>

      <LegalSection title="Streitbeilegung">
        <p>
          Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren
          vor einer Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </LegalSection>

      <LegalSection title="Haftung für Inhalte und Links">
        <p>
          Für eigene Inhalte auf diesen Seiten sind wir nach den allgemeinen Gesetzen
          verantwortlich. Wir sind jedoch nicht verpflichtet, übermittelte oder
          gespeicherte fremde Informationen zu überwachen oder nach Umständen zu
          forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
        </p>
        <p>
          Dieses Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte
          wir keinen Einfluss haben. Für diese Inhalte ist stets der jeweilige Anbieter
          verantwortlich. Werden uns Rechtsverletzungen bekannt, entfernen wir solche
          Links umgehend.
        </p>
      </LegalSection>

      <LegalSection title="Urheberrecht und Marken">
        <p>
          Dies ist ein nicht-kommerzielles Fan-Projekt. <strong>Pokémon</strong> sowie
          die Namen, Bezeichnungen und Abbildungen der Pokémon sind Marken bzw.
          urheberrechtlich geschützte Werke ihrer jeweiligen Inhaber (Nintendo,
          Creatures Inc., GAME FREAK Inc., The Pokémon Company). Es besteht keine
          Verbindung zu diesen Unternehmen und keine Unterstützung durch sie.
        </p>
        <p>
          Bilder und deutsche Namen werden zur Laufzeit über die{' '}
          <a
            href="https://pokeapi.co"
            rel="noreferrer noopener"
            className="rounded underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            PokeAPI
          </a>{' '}
          bezogen und nicht dauerhaft gespeichert.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
