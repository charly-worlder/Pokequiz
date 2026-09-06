import 'server-only'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Drosselung der Zugangsdaten-Pfade (BUG-29, `.claude/rules/security.md`).
 *
 * **Warum sie in den Actions sitzt und nicht im Proxy.** Next.js bindet eine
 * Server Action nicht an die Route, auf der sie definiert wurde: `loginAction`
 * läuft unter `/`, unter `/privacy` und — weil der Proxy-Matcher Bild-Endungen
 * ausnimmt — unter jedem `*.png`. Eine Schranke davor ist umgehbar, gemessen im
 * QA-Lauf vom 2026-09-05 (BUG-30, BUG-31). Hier ist sie es nicht: Wer die Action
 * erreicht, erreicht auch den Zähler.
 *
 * **Zwei Zähler, weil einer beide Angriffe nicht abdeckt** (siehe
 * `docs/stacks/backend-supabase.md`): Der IP-Zähler bremst das schnelle Raten von
 * einer Stelle aus. Er hilft nicht gegen einen Angreifer, der IPs wechselt oder
 * ein gängiges Passwort gegen viele Konten probiert — dafür der Konto-Zähler.
 */

/** Grenzwerte aus `docs/production/rate-limiting.md` → Recommended Limits. */
export const LIMITS = {
  /** Login/Register: 5 Anfragen pro Minute. */
  credentialsPerIp: { limit: 5, windowSeconds: 60 },
  /** Passwort-Reset: 3 Anfragen pro 5 Minuten. */
  passwordResetPerIp: { limit: 3, windowSeconds: 300 },
  /**
   * Der Konto-Zähler ist bewusst weiter gefasst als der IP-Zähler — und das ist
   * ein Kompromiss, kein Versehen.
   *
   * Ein enger Konto-Zähler stoppt verteiltes Raten wirksam, macht aber zugleich
   * jedes Konto aussperrbar: Wer eine Adresse kennt, hält sie mit ein paar
   * Anfragen pro Minute dauerhaft draußen. Das Gegenmittel dafür wäre ein CAPTCHA
   * — `.claude/rules/security.md` nennt es in einem Atemzug mit dem Zähler —, und
   * genau das hat dieses Produkt bewusst nicht (`docs/PRD.md`: „ohne Erklärung
   * sofort loslegen").
   *
   * 20 Fehlversuche in 15 Minuten ist der gewählte Mittelweg: zu wenig, um ein
   * Passwort zu erraten, zu viel, um jemanden mit einem Skript billig
   * lahmzulegen — und das Fenster heilt von selbst aus. Die Entscheidung samt
   * ihrem Preis steht in `features/PROJ-1-user-login/design.md`.
   */
  credentialsPerAccount: { limit: 20, windowSeconds: 900 },
  /**
   * Der Passwort-Reset bekommt eine **eigene, engere** Konto-Grenze als der Login
   * (spec.md AC-19). Bis BUG-76 galt hier `credentialsPerAccount` mit — nicht
   * entschieden, sondern geerbt.
   *
   * Der Unterschied ist nicht die Zahl, sondern was begrenzt wird: Beim Login
   * begrenzt der Zähler das **Raten am eigenen Konto**. Beim Reset begrenzt er
   * **Mails an eine fremde Adresse** — das Opfer hat nichts getan, und jede Mail
   * verbraucht eine Einheit des SMTP-Kontingents, das laut `docs/PRD.md` ohnehin
   * der Engpass dieses Projekts ist. 20 je 15 Minuten waren rund 80 Mails pro
   * Stunde an einen Unbeteiligten.
   *
   * 5 pro Stunde, nicht 3: Zwei oder drei Versuche sind der ehrliche Fall, wenn
   * die Mail nicht ankommt. Der fünfte ist schon Verzweiflung — und der Reset ist
   * der einzige Weg zurück ins Konto, eine Fehlsperre trifft hier härter als
   * anderswo.
   */
  passwordResetPerAccount: { limit: 5, windowSeconds: 3600 },
  /**
   * Das Einlösen des Reset-Links (spec.md AC-20).
   *
   * **Nicht gegen das Erraten** — der Token-Hash ist zu lang dafür. Sondern gegen
   * das Leerlaufen des **gemeinsamen** Prüfkontingents des Auth-Dienstes
   * (`token_verifications`, Standard 30 je 5 Minuten): Weil die App ausschließlich
   * über Server Actions mit Supabase spricht, sieht dieses Limit für alle Spieler
   * dieselbe Server-IP (BUG-21). Wer es erschöpft, macht den Passwort-Reset für
   * **alle** unmöglich.
   *
   * 10 je 15 Minuten ist für einen Menschen, der einen Link anklickt, unerreichbar
   * weit — und eng genug, dass eine einzelne Quelle das Kontingent nicht leert.
   */
  tokenConfirmPerIp: { limit: 10, windowSeconds: 900 },
  /**
   * Das **Setzen** des neuen Passworts (BUG-91).
   *
   * `updatePasswordAction` war der einzige Zugangsdaten-Pfad ohne jeden Zähler —
   * gemessen im QA-Nachlauf vom 2026-09-06: 12 Aufrufe von einer Verbindung, null
   * abgewiesen. Das widersprach der Zusage in `spec.md` → Technical Requirements,
   * die Drosselung sitze **in den Server Actions**, und ließ AC-18 auf diesem Pfad
   * ins Leere laufen.
   *
   * Der Zweck ist derselbe wie bei `tokenConfirmPerIp`, nicht das Erraten eines
   * Passworts: Jeder Aufruf löst ein `getUser()` und ein `updateUser()` gegen
   * Supabase aus, deren gemeinsames Kontingent wegen der Server-Action-Architektur
   * für alle Spieler an derselben Server-IP hängt (BUG-21).
   *
   * **Keine E-Mail-Adresse, also nur der Verbindungs-Zähler:** Die Adresse steht
   * erst nach der Sitzungsprüfung fest, und die soll hinter der Drosselung liegen,
   * nicht davor.
   *
   * 10 je 15 Minuten, dieselbe Zahl wie beim Einlösen: Wer ein Passwort setzt, tut
   * es ein- oder zweimal; die Grenze ist für einen Menschen unerreichbar weit.
   */
  passwordUpdatePerIp: { limit: 10, windowSeconds: 900 },
} as const

type Limit = { limit: number; windowSeconds: number }

/**
 * Die anfragende IP, so gut sie serverseitig feststellbar ist.
 *
 * `x-forwarded-for` kann ein Client selbst setzen, solange kein Reverse Proxy
 * davorsteht, der den Header überschreibt. Der IP-Zähler ist deshalb die
 * schwächere der beiden Hälften — er bremst das gewöhnliche schnelle Raten, nicht
 * den, der den Header fälscht. Genau dagegen steht der Konto-Zähler, den man
 * nicht umgehen kann, indem man sich eine andere Herkunft ausdenkt.
 *
 * Beim `/deploy` gehört der Header vom Host gesetzt und clientseitige Werte
 * verworfen — dieselbe Hausaufgabe wie bei BUG-18 (`X-Forwarded-Host`).
 */
async function clientIp(): Promise<string> {
  const headerList = await headers()
  const forwarded = headerList.get('x-forwarded-for')
  // Der erste Eintrag ist der ursprüngliche Client; alles dahinter sind Proxys.
  const first = forwarded?.split(',')[0]?.trim()
  return first || headerList.get('x-real-ip') || 'unbekannt'
}

/** Adressen sind Groß-/Kleinschreibung egal — sonst wären `A@b.de` und `a@b.de` zwei Zähler. */
function accountKey(scope: string, email: string) {
  return `${scope}:account:${email.trim().toLowerCase()}`
}

async function count(key: string, { limit, windowSeconds }: Limit): Promise<boolean> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('register_auth_attempt', {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })

  // Fehlt die Migration oder ist die Datenbank weg, wird **nicht** durchgewunken.
  // Eine Drosselung, die im Fehlerfall stillschweigend aufmacht, ist genau dann
  // nicht da, wenn etwas nicht stimmt.
  if (error) throw new Error(`Drosselung nicht zählbar: ${error.message}`)
  return data === true
}

export type ThrottleScope =
  | 'login'
  | 'register'
  | 'password-reset'
  | 'token-confirm'
  | 'password-update'

/** Welche Grenze für welchen Vorgang gilt — an einer Stelle, statt verstreut. */
function limitsFor(scope: ThrottleScope): { ip: Limit; account: Limit } {
  switch (scope) {
    case 'password-reset':
      return { ip: LIMITS.passwordResetPerIp, account: LIMITS.passwordResetPerAccount }
    case 'token-confirm':
      // Beim Einlösen ist keine Adresse bekannt — der Token verrät sie erst nach
      // der Prüfung. Der Konto-Wert steht hier nur, damit der Rückgabetyp
      // vollständig ist; `registerAttempt` benutzt ihn ohne E-Mail nie.
      return { ip: LIMITS.tokenConfirmPerIp, account: LIMITS.credentialsPerAccount }
    case 'password-update':
      // Wie beim Einlösen ist hier keine Adresse bekannt: Sie steht erst fest,
      // nachdem die Sitzung geprüft wurde — und diese Prüfung liegt bewusst
      // **hinter** der Drosselung. Der Konto-Wert bleibt ungenutzt.
      return { ip: LIMITS.passwordUpdatePerIp, account: LIMITS.credentialsPerAccount }
    default:
      return { ip: LIMITS.credentialsPerIp, account: LIMITS.credentialsPerAccount }
  }
}

/** Welcher der beiden Zähler abgewiesen hat — für die Meldung an den Nutzer. */
export type ThrottleBlock = 'connection' | 'account' | null

/**
 * Zählt einen Versuch auf beiden Zählern und meldet, ob er erlaubt bleibt — und
 * bei einer Abweisung, **welcher** Zähler sie ausgelöst hat (BUG-67).
 *
 * **Beide werden immer gezählt**, auch wenn der erste schon abgelehnt hat: Sonst
 * könnte ein Angreifer den Konto-Zähler leer halten, indem er den IP-Zähler
 * absichtlich überlaufen lässt.
 *
 * **Sperren beide, gewinnt das Konto.** Sein Fenster ist das längere (15 Minuten
 * beim Login, eine Stunde beim Reset, gegen 60 Sekunden bei der Verbindung) —
 * „warte eine Minute" wäre dann ein falscher Rat.
 */
export async function registerAttempt(
  scope: ThrottleScope,
  email: string | null
): Promise<{ allowed: boolean; blockedBy: ThrottleBlock }> {
  const { ip: ipLimit, account: accountLimit } = limitsFor(scope)

  const [ipAllowed, accountAllowed] = await Promise.all([
    count(`${scope}:ip:${await clientIp()}`, ipLimit),
    email ? count(accountKey(scope, email), accountLimit) : Promise.resolve(true),
  ])

  const blockedBy: ThrottleBlock = !accountAllowed ? 'account' : !ipAllowed ? 'connection' : null
  return { allowed: ipAllowed && accountAllowed, blockedBy }
}

/**
 * Räumt nach einer **erfolgreichen Anmeldung** auf — und tut dabei zwei
 * verschiedene Dinge, weil die beiden Zähler verschiedene Angriffe abwehren.
 *
 * **Konto-Zähler: gelöscht.** Wer sich viermal vertippt und beim fünften Mal
 * richtig liegt, soll nicht den Rest des Fensters mit einem fast vollen Zähler
 * herumlaufen. Das ist unbedenklich: Der Konto-Zähler schützt genau dieses eine
 * Konto, und wer sein eigenes Passwort kennt, greift es nicht an.
 *
 * **IP-Zähler: um genau diesen einen Versuch erstattet, nicht geleert.** Damit
 * zählt er im Ergebnis nur noch **Fehl**versuche. Die beiden Fehler, zwischen
 * denen diese Zeile liegt, erklären warum:
 *
 * - **BUG-39** (High): Vorher wurde der IP-Zähler bei jedem geglückten Login
 *   *gelöscht*. Das machte ihn abschaltbar — wer ein einziges eigenes Konto
 *   besitzt, schiebt zwischen seine Rateversuche je einen erfolgreichen Login
 *   und fängt von vorn an, ganz ohne Header-Fälschung. Gemessen: 24
 *   Passwortversuche gegen 24 Konten von einer IP in 3,6 Sekunden, null
 *   abgewiesen. Eine Bremse, die der Angreifer selbst lösen kann, ist keine —
 *   und gegen **Passwort-Spraying** ist sie die einzige, weil der Konto-Zähler
 *   dort nichts sieht (jedes Opferkonto bekommt genau einen Versuch).
 * - **BUG-54** (Medium): Der Fix dafür ließ den Zähler stehen — und traf damit
 *   die Falschen. Gezählt wird **vor** der Passwortprüfung, ein geglückter Login
 *   verbrauchte also Budget. Gemessen: acht verschiedene Spieler mit richtigem
 *   Passwort hinter einer geteilten Adresse — fünf kommen hinein, drei sehen
 *   „Zu viele Versuche". Das trifft Familien- und Schulanschlüsse und
 *   Mobilfunk-CGNAT; die Zielgruppe im PRD schließt Kinder ausdrücklich ein.
 *
 * Die Erstattung löst beides: Ein erfolgreicher Login kostet unterm Strich
 * nichts, und ein Angreifer bekommt dadurch keinen einzigen zusätzlichen
 * Rateversuch — er hat weiter genau `credentialsPerIp.limit` **Fehl**versuche je
 * Fenster, egal wie oft er sich dazwischen selbst anmeldet.
 *
 * **Warum erstattet und nicht „erst prüfen, dann zählen":** Das Hochzählen und
 * das Prüfen stecken bewusst in einem einzigen SQL-Statement (`0003`), damit
 * gleichzeitige Anfragen sich nicht überholen. Getrenntes Lesen und Schreiben
 * würde genau diese Lücke wieder aufreißen — 100 parallele Anfragen sähen alle
 * den Zähler auf 0.
 *
 * **Diese Funktion gilt nur für den Login.** Sie nimmt bewusst keinen `scope`
 * entgegen: Registrierung und Passwort-Reset dürfen **nicht** erstatten, weil
 * dort die begrenzte Sache die Handlung selbst ist — Konten anlegen, Mails
 * verschicken — und nicht das Raten. Mit Erstattung wäre die Massenanlage von
 * Konten unbegrenzt (BUG-47).
 */
export async function settleSuccessfulLogin(email: string): Promise<void> {
  const admin = createAdminClient()
  const scope: ThrottleScope = 'login'

  const [cleared, refunded] = await Promise.all([
    admin.rpc('clear_auth_attempts', { p_keys: [accountKey(scope, email)] }),
    admin.rpc('refund_auth_attempt', { p_key: `${scope}:ip:${await clientIp()}` }),
  ])

  // Ein Fehler hier macht den erfolgreichen Login nicht ungültig — er lässt nur
  // den Zähler stehen. Das ist die sichere Richtung, also kein Wurf.
  const failure = cleared.error ?? refunded.error
  if (failure) {
    console.error('Zähler konnte nach erfolgreicher Anmeldung nicht bereinigt werden', failure)
  }
}
